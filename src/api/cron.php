<?php
declare(strict_types=1);

/*
 * perldeals mail worker. Läuft alle 15 Min. als IONOS-UnixCron über api/lib/cron-cli.php (PHP CLI).
 *  1. Matches new deals against users' price alerts and queues hits.
 *  2. Sends instant alert mails; sends daily alert digests at 08:00 (Europe/Berlin).
 *  3. Sends the "Tages-Perlen" newsletter at 08:00 to subscribers who opted in.
 *  Seit 06.11.2026: einmalige Erinnerung an unbestätigte Anmeldungen (2d), Wochen-Überblick sonntags zu den eigenen Themen (2e).
 */

require __DIR__ . '/lib/bootstrap.php';
if (PHP_SAPI !== 'cli') {
    // Seit 06.11.2026 läuft der Cron als IONOS-UnixCron (api/lib/cron-cli.php, CLI, ohne Schlüssel).
    // Web-Aufruf nur noch für Notfälle mit Schlüssel im Header "X-Cron-Key" oder per POST – nie mehr in der URL.
    $key = (string)($_SERVER['HTTP_X_CRON_KEY'] ?? $_POST['k'] ?? '');
    $expected = (string)(pd_config()['cron_key'] ?? '');
    if ($expected === '' || strlen($key) < 32 || !hash_equals($expected, $key)) { http_response_code(404); exit; }
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    header('Referrer-Policy: no-referrer');
    ignore_user_abort(true);
    set_time_limit(240);
    define('STDERR', fopen('php://output', 'w'));
}

if (PHP_SAPI === 'cli') { try { db()->prepare("REPLACE INTO settings (k, v) VALUES ('cron_cli_seen', ?)")->execute([gmdate('c')]); } catch (Throwable $e) {} }
// Sperre gegen Doppelläufe (Web- und UnixCron laufen beim Umstieg parallel)
if (!pd_rate('cron-run', 1, 240)) { echo "skipped: ran recently\n"; exit; }

const PD_MAX_MAILS_PER_RUN = 150;

$pdo = db();
$deals = json_decode((string)@file_get_contents(pd_webroot() . '/data/deals.json'), true);
if (!is_array($deals) || empty($deals['deals'])) { fwrite(STDERR, "no deals.json\n"); exit(1); }
$byId = [];
foreach ($deals['deals'] as $d) $byId[$d['id']] = $d;

function pd_norm(string $s): string {
    $s = mb_strtolower($s);
    return strtr($s, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss', '-' => ' ']);
}

/* ---------- 1. match ---------- */
$alerts = $pdo->query("SELECT a.* FROM alerts a JOIN users u ON u.id = a.user_id WHERE u.verified_at IS NOT NULL AND u.alerts_enabled = 1")->fetchAll();
$ins = $pdo->prepare("INSERT IGNORE INTO alert_hits (alert_id, deal_id, queued_at) VALUES (?, ?, ?)");
foreach ($alerts as $a) {
    $words = array_filter(explode(' ', pd_norm($a['keyword'])), fn($w) => mb_strlen($w) >= 2);
    $created = strtotime($a['created_at'] . ' UTC');
    foreach ($deals['deals'] as $d) {
        if (strtotime($d['added']) < $created - 3600) continue;              // only deals newer than the alert
        if ($a['cat'] && $a['cat'] !== $d['cat'] && !($a['cat'] === 'vegan' && !empty($d['vegan']))) continue;
        if ($a['max_price'] !== null && (empty($d['np']) ? (float)$d['now'] > (float)$a['max_price'] : true)) continue;
        $hay = pd_norm($d['title']['de'] . ' ' . $d['title']['en'] . ' ' . $d['brand']);
        foreach ($words as $w) { if (!str_contains($hay, $w)) continue 2; }
        $ins->execute([$a['id'], $d['id'], now_utc()]);
    }
}

/* ---------- helpers ---------- */
$sent = 0;
$mailer = null;
function pd_mailer(): PdMailer { global $mailer; return $mailer ??= PdMailer::fromConfig(); }

function pd_eur(float $v, string $lang): string {
    return $lang === 'en' ? '€' . number_format($v, 2, '.', ',') : number_format($v, 2, ',', '.') . ' €';
}

function pd_deal_rows(array $list, string $lang): array {
    $html = ''; $text = '';
    foreach ($list as $d) {
        if (!empty($d['np'])) {
            $url = PD_SITE . ($lang === 'en' ? '/en/deals/' : '/deals/') . rawurlencode($d['id']) . '/';
            $title = $d['title'][$lang] ?? $d['title']['de'];
            $html .= '<tr><td style="padding:12px 0;border-top:1px solid #E6ECE9"><a href="' . pd_e($url) . '" style="color:#0E1C1B;font-weight:600;text-decoration:none">' . pd_e($title) . '</a><br><span style="color:#55645F">' . pd_e($lang === 'en' ? 'Current price on Amazon' : 'Aktueller Preis bei Amazon') . '</span></td></tr>';
            $text .= "- $title\n  $url\n";
            continue;
        }
        $url = PD_SITE . ($lang === 'en' ? '/en/deals/' : '/deals/') . rawurlencode($d['id']) . '/';
        $pct = (int)round((1 - $d['now'] / $d['was']) * 100);
        $title = $d['title'][$lang] ?? $d['title']['de'];
        $html .= '<tr><td style="padding:12px 0;border-top:1px solid #E6ECE9"><a href="' . pd_e($url) . '" style="color:#0E1C1B;font-weight:600;text-decoration:none">' . pd_e($title) . '</a><br>'
            . '<span style="font-size:18px;font-weight:800">' . pd_e(pd_eur((float)$d['now'], $lang)) . '</span> '
            . '<span style="color:#55645F;text-decoration:line-through">' . pd_e(pd_eur((float)$d['was'], $lang)) . '</span> '
            . '<span style="color:#D63B23;font-weight:600">−' . $pct . '%</span></td></tr>';
        $text .= "- $title: " . pd_eur((float)$d['now'], $lang) . ' (−' . $pct . "%)\n  $url\n";
    }
    return ['<table role="presentation" width="100%" cellspacing="0" cellpadding="0">' . $html . '</table>', $text];
}

function pd_send_user_mail(array $u, string $type, string $subject, string $introHtml, string $introText, array $list): bool {
    $lang = $u['lang'];
    $unsubUrl = PD_SITE . '/api/unsubscribe.php?t=' . pd_unsub_token((int)$u['id'], $type);
    [$rowsHtml, $rowsText] = pd_deal_rows($list, $lang);
    $stamp = $lang === 'en' ? 'Prices on Amazon.de at the time the deal was posted; they may have changed.' : 'Preise bei Amazon.de zum Zeitpunkt der Veröffentlichung; sie können sich inzwischen geändert haben.';
    $inner = $introHtml . $rowsHtml . '<p style="color:#55645F;font-size:12px">' . pd_e($stamp) . '</p>';
    $links = $lang === 'en'
        ? [['Unsubscribe', $unsubUrl], ['Email settings', pd_account_url($lang)]]
        : [['Abbestellen', $unsubUrl], ['E-Mail-Einstellungen', pd_account_url($lang)]];
    $text = $introText . "\n" . $rowsText . "\n$stamp\n\n" . ($lang === 'en' ? 'Unsubscribe: ' : 'Abbestellen: ') . $unsubUrl . "\n" . ($lang === 'en' ? 'Email settings: ' : 'E-Mail-Einstellungen: ') . pd_account_url($lang) . "\n";
    try {
        pd_mailer()->send($u['email'], $subject, $text, pd_mail_layout($lang, $subject, $inner, $links), [
            'List-Unsubscribe' => '<' . $unsubUrl . '>, <mailto:' . PD_FROM . '?subject=unsubscribe>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
        return true;
    } catch (Throwable $e) {
        error_log('perldeals mail failed: ' . $e->getMessage());
        return false;
    }
}

$berlin = new DateTime('now', new DateTimeZone('Europe/Berlin'));
$isMorning = (int)$berlin->format('G') === 8;
$todayStartUtc = (new DateTime($berlin->format('Y-m-d') . ' 00:00', new DateTimeZone('Europe/Berlin')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');

/* ---------- 2. alert mails ---------- */
$users = $pdo->query("SELECT DISTINCT u.* FROM users u JOIN alerts a ON a.user_id = u.id JOIN alert_hits h ON h.alert_id = a.id
                      WHERE h.sent_at IS NULL AND u.alerts_enabled = 1 AND u.verified_at IS NOT NULL")->fetchAll();
$hitsSt = $pdo->prepare("SELECT h.alert_id, h.deal_id, a.keyword FROM alert_hits h JOIN alerts a ON a.id = h.alert_id WHERE a.user_id = ? AND h.sent_at IS NULL");
$markSt = $pdo->prepare("UPDATE alert_hits h JOIN alerts a ON a.id = h.alert_id SET h.sent_at = ? WHERE a.user_id = ? AND h.sent_at IS NULL");
foreach ($users as $u) {
    if ($sent >= PD_MAX_MAILS_PER_RUN) break;
    if ($u['alert_frequency'] === 'daily' && (!$isMorning || ($u['last_digest_at'] && $u['last_digest_at'] >= $todayStartUtc))) continue;
    $hitsSt->execute([$u['id']]);
    $list = []; $keywords = [];
    foreach ($hitsSt->fetchAll() as $h) {
        if (isset($byId[$h['deal_id']])) { $list[$h['deal_id']] = $byId[$h['deal_id']]; $keywords[$h['keyword']] = true; }
    }
    if (!$list) { $markSt->execute([now_utc(), $u['id']]); continue; }
    $kw = implode(', ', array_keys($keywords));
    $n = count($list);
    if ($u['lang'] === 'en') {
        $subject = $n === 1 ? 'Price alert: ' . reset($list)['title']['en'] : "Price alert: $n new deals for “{$kw}”";
        $intro = "Good news: there " . ($n === 1 ? 'is a new deal' : "are $n new deals") . " matching your price alert “{$kw}”.";
    } else {
        $subject = $n === 1 ? 'Preisalarm: ' . reset($list)['title']['de'] : "Preisalarm: $n neue Deals zu „{$kw}“";
        $intro = "Gute Nachricht: Zu deinem Preisalarm „{$kw}“ gibt es " . ($n === 1 ? 'einen neuen Deal.' : "$n neue Deals.");
    }
    if (pd_send_user_mail($u, 'alerts', $subject, '<p>' . pd_e($intro) . '</p>', $intro, array_values($list))) {
        $markSt->execute([now_utc(), $u['id']]);
        if ($u['alert_frequency'] === 'daily') $pdo->prepare("UPDATE users SET last_digest_at = ? WHERE id = ?")->execute([now_utc(), $u['id']]);
        $sent++;
    }
}


/* ---------- 2b. Reseller-Deal-Alarm (instant) ---------- */
function pd_rs_topics(array $d): array {
    $t = ($d['title']['de'] ?? '') . ' ' . ($d['brand'] ?? '');
    $r = [];
    if (preg_match('/pok[eé]mon/iu', $t)) $r[] = 'pokemon';
    if (preg_match('/one piece/i', $t)) $r[] = 'onepiece';
    if (preg_match('/\blego\b/i', $t)) $r[] = 'lego';
    if (preg_match('/playstation|\bps5\b|nintendo switch|xbox|steam deck|spielkonsole|handheld-konsole/i', $t)) $r[] = 'konsolen';
    return $r;
}
$rsData = json_decode((string)@file_get_contents(pd_webroot() . '/data/reseller.json'), true);
$rsItems = [];
if (is_array($rsData)) {
    $uplift = (float)($rsData['uplift'] ?? 0.22);
    $eurDe = fn(float $v) => number_format($v, 2, ',', '.') . ' €';
    $dayDe = fn(?string $s) => $s ? date('d.m.Y', strtotime($s . ' 12:00')) : 'Datum offen';
    foreach ($deals['deals'] as $d) {
        $topics = pd_rs_topics($d);
        if (!empty($d['np'])) continue;
        $p = (int)round((1 - $d['now'] / $d['was']) * 100);
        if ($p >= 40 || !empty($d['low'])) $topics[] = 'top';
        if (!$topics) continue;
        $eolV = null;
        if (in_array('lego', $topics, true)) foreach ($rsData['eol'] ?? [] as $s) { if (preg_match('/\b' . preg_quote($s['num'], '/') . '\b/', $d['id'] . ' ' . $d['title']['de'])) { $eolV = (float)$s['market']['value']; break; } }
        $market = isset($d['rs']['market']) ? (float)$d['rs']['market'] : $eolV;
        $margin = $market !== null ? $market - (float)$d['now'] : null;
        $rsItems[] = ['id' => 'deal:' . $d['id'], 'topics' => $topics, 'added' => $d['added'], 'filter' => true, 'pct' => $p, 'margin' => $margin,
            'title' => $d['title']['de'], 'url' => PD_SITE . '/deals/' . rawurlencode($d['id']) . '/',
            'line' => $eurDe((float)$d['now']) . ' statt ' . $eurDe((float)$d['was']) . " (−$p %)" . ($margin !== null ? ' · Marge ca. ' . $eurDe($margin) . ' (Schätzung)' : '') . (!empty($d['rs']['limit']) ? ' · Limit: ' . $d['rs']['limit'] : '')];
    }
    foreach ($rsData['releases'] ?? [] as $r) {
        $prices = array_filter(array_map(fn($x) => $x['price'] ? $x['type'] . ': ' . $eurDe((float)$x['price']) : null, $r['products']));
        $rsItems[] = ['id' => $r['id'], 'topics' => [$r['game']], 'added' => $r['added'], 'filter' => false,
            'title' => '📅 ' . $r['name'], 'url' => PD_SITE . ($r['game'] === 'pokemon' ? '/reseller/pokemon/' : '/reseller/one-piece/') . '#' . $r['id'],
            'line' => 'Termin: ' . $dayDe($r['date']) . ($r['confirmed'] ? '' : ' (unbestätigt)') . ($prices ? ' · ' . implode(', ', array_slice($prices, 0, 3)) : '') . ($r['retailers'] ? ' · bei ' . implode(', ', $r['retailers']) : '')];
    }
    foreach ($rsData['promos'] ?? [] as $pr) {
        if (!empty($pr['to']) && $pr['to'] < gmdate('Y-m-d')) continue;
        $rsItems[] = ['id' => $pr['id'], 'topics' => array_unique(array_merge($pr['topics'], ['top'])), 'added' => $pr['added'], 'filter' => false,
            'title' => '🏷️ ' . $pr['retailer'] . ': ' . $pr['title'], 'url' => PD_SITE . '/reseller/aktionen/#' . $pr['id'],
            'line' => ($pr['from'] ? $dayDe($pr['from']) : '') . ($pr['to'] ? ' bis ' . $dayDe($pr['to']) : '')];
    }
    foreach ($rsData['own'] ?? [] as $o) {
        if (($o['status'] ?? '') !== 'verfügbar') continue;
        $rsItems[] = ['id' => $o['id'], 'topics' => ['netzwerk'], 'added' => $o['added'], 'filter' => false,
            'title' => '🤝 Direkt von perldeals: ' . $o['title'], 'url' => PD_SITE . '/reseller/angebote/#' . $o['id'],
            'line' => $eurDe((float)$o['price']) . (!empty($o['condition']) ? ' · ' . $o['condition'] : '') . (!empty($o['qty']) ? ' · ' . $o['qty'] . ' Stück' : '')];
    }
    foreach ($rsData['eol'] ?? [] as $s) {
        if (empty($s['best']) || ($s['discountPct'] ?? 0) <= 0) continue;
        $rsItems[] = ['id' => $s['id'], 'topics' => ['lego'], 'added' => $s['added'], 'filter' => true, 'pct' => (int)$s['discountPct'], 'margin' => $s['margin'],
            'title' => '🧱 LEGO ' . $s['num'] . ' ' . $s['name'] . ' (EOL ' . $s['eol'] . ')', 'url' => PD_SITE . '/reseller/lego-eol/#' . $s['id'],
            'line' => $eurDe((float)$s['best']['price']) . ' bei ' . $s['best']['shop'] . ' (−' . $s['discountPct'] . ' % auf UVP) · Marge ca. ' . $eurDe((float)$s['margin']) . ' (Schätzung)'];
    }
}
if ($rsItems && $sent < PD_MAX_MAILS_PER_RUN) {
    pd_reseller_tables();
    $subs = $pdo->query("SELECT r.*, u.email, u.lang FROM reseller_alerts r JOIN users u ON u.id = r.user_id WHERE u.verified_at IS NOT NULL")->fetchAll();
    $insR = $pdo->prepare("INSERT IGNORE INTO reseller_hits (user_id, item_id, queued_at) VALUES (?, ?, ?)");
    $byItem = [];
    foreach ($rsItems as $it) $byItem[$it['id']] = $it;
    foreach ($subs as $s) {
        $topics = explode(',', $s['topics']);
        $created = strtotime($s['created_at'] . ' UTC');
        foreach ($rsItems as $it) {
            if (strtotime($it['added']) < $created - 3600) continue;
            if (!array_intersect($topics, $it['topics'])) continue;
            if ($it['filter']) {
                if ((int)$s['min_discount'] > 0 && $it['pct'] < (int)$s['min_discount']) continue;
                if ($s['min_margin'] !== null && ($it['margin'] === null || $it['margin'] < (float)$s['min_margin'])) continue;
            }
            $insR->execute([$s['user_id'], $it['id'], now_utc()]);
        }
    }
    $pend = $pdo->prepare("SELECT item_id FROM reseller_hits WHERE user_id = ? AND sent_at IS NULL");
    $markR = $pdo->prepare("UPDATE reseller_hits SET sent_at = ? WHERE user_id = ? AND sent_at IS NULL");
    foreach ($subs as $s) {
        if ($sent >= PD_MAX_MAILS_PER_RUN) break;
        $pend->execute([$s['user_id']]);
        $list = array_values(array_filter(array_map(fn($r) => $byItem[$r['item_id']] ?? null, $pend->fetchAll())));
        if (!$list) { $markR->execute([now_utc(), $s['user_id']]); continue; }
        $n = count($list);
        $subject = $n === 1 ? 'Reseller-Alarm: ' . ltrim(preg_replace('/^\X\s/u', '', $list[0]['title'])) : "Reseller-Alarm: $n neue Treffer";
        $rowsH = ''; $rowsT = '';
        foreach ($list as $it) {
            $rowsH .= '<tr><td style="padding:12px 0;border-top:1px solid #E6ECE9"><a href="' . pd_e($it['url']) . '" style="color:#0E1C1B;font-weight:600;text-decoration:none">' . pd_e($it['title']) . '</a><br><span style="color:#55645F">' . pd_e($it['line']) . '</span></td></tr>';
            $rowsT .= '- ' . $it['title'] . "\n  " . $it['line'] . "\n  " . $it['url'] . "\n";
        }
        $note = 'Marktwerte und Margen sind Schätzungen vor Gebühren und Versand und können sich ändern. Preise zum Zeitpunkt der Veröffentlichung.';
        $unsubUrl = PD_SITE . '/api/unsubscribe.php?t=' . pd_unsub_token((int)$s['user_id'], 'reseller');
        $intro = $n === 1 ? 'Zu deinem Reseller-Deal-Alarm gibt es einen neuen Treffer:' : "Zu deinem Reseller-Deal-Alarm gibt es $n neue Treffer:";
        $html = '<p>' . pd_e($intro) . '</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' . $rowsH . '</table>' . pd_btn(PD_SITE . '/reseller/', 'Alle Reseller-Deals') . '<p style="color:#55645F;font-size:12px">' . pd_e($note) . '</p>';
        $text = $intro . "\n\n" . $rowsT . "\n" . $note . "\n\nAbmelden: " . $unsubUrl . "\n";
        try {
            pd_mailer()->send($s['email'], $subject, $text, pd_mail_layout('de', $subject, $html, [['Reseller-Alarm abbestellen', $unsubUrl], ['perldeals.com/reseller', PD_SITE . '/reseller/']]), [
                'List-Unsubscribe' => '<' . $unsubUrl . '>, <mailto:' . PD_FROM . '?subject=unsubscribe>',
                'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
            ]);
            $markR->execute([now_utc(), $s['user_id']]);
            $sent++;
        } catch (Throwable $e) { error_log('perldeals reseller mail failed: ' . $e->getMessage()); }
    }
}


/* ---------- 2c. Gutschein-Alarm (seit 05.11.2026) ----------
   Quelle: /data/codes-live.json (vom Build geschrieben, alle aktiven Codes inkl. Awin). Pro Nutzer höchstens eine Mail alle 6 Stunden. */
$codesLive = json_decode((string)@file_get_contents(pd_webroot() . '/data/codes-live.json'), true);
if (is_array($codesLive) && !empty($codesLive['codes']) && $sent < PD_MAX_MAILS_PER_RUN) {
    pd_code_tables();
    $cById = [];
    foreach ($codesLive['codes'] as $c) $cById[$c['id']] = $c;
    $subs = $pdo->query("SELECT c.*, u.email, u.lang FROM code_alerts c JOIN users u ON u.id = c.user_id WHERE u.verified_at IS NOT NULL")->fetchAll();
    $insC = $pdo->prepare("INSERT IGNORE INTO code_hits (user_id, item_id, queued_at) VALUES (?, ?, ?)");
    foreach ($subs as $s) {
        $shops = explode(',', $s['shops']);
        $all = in_array('all', $shops, true);
        foreach ($codesLive['codes'] as $c) if ($all || in_array($c['shop'], $shops, true)) $insC->execute([$s['user_id'], $c['id'], now_utc()]);
    }
    $last = $pdo->prepare("SELECT MAX(sent_at) FROM code_hits WHERE user_id = ?");
    $pendC = $pdo->prepare("SELECT item_id FROM code_hits WHERE user_id = ? AND sent_at IS NULL");
    $markC = $pdo->prepare("UPDATE code_hits SET sent_at = ? WHERE user_id = ? AND sent_at IS NULL");
    foreach ($subs as $s) {
        if ($sent >= PD_MAX_MAILS_PER_RUN) break;
        $last->execute([$s['user_id']]);
        $l = $last->fetchColumn();
        if ($l && strtotime($l . ' UTC') > time() - 6 * 3600) continue;
        $pendC->execute([$s['user_id']]);
        $list = array_values(array_filter(array_map(fn($r) => $cById[$r['item_id']] ?? null, $pendC->fetchAll())));
        if (!$list) { $markC->execute([now_utc(), $s['user_id']]); continue; }
        usort($list, fn($a, $b) => strcmp($a['shopName'], $b['shopName']));
        $list = array_slice($list, 0, 15);
        $de = ($s['lang'] ?? 'de') !== 'en';
        $n = count($list);
        $subject = $de ? ($n === 1 ? 'Neuer Gutschein: ' . $list[0]['shopName'] . ' – ' . $list[0]['title'] : "Gutschein-Alarm: $n neue Gutscheine") : ($n === 1 ? 'New voucher: ' . $list[0]['shopName'] : "Voucher alert: $n new vouchers");
        $rowsH = ''; $rowsT = '';
        foreach ($list as $c) {
            $until = !empty($c['validUntil']) ? ($de ? ' · gültig bis ' : ' · valid until ') . date('d.m.Y', strtotime($c['validUntil'] . ' 12:00')) : '';
            $codeH = $c['code'] ? '<span style="display:inline-block;font-family:Menlo,monospace;font-weight:700;border:1px dashed #0F7B6C;border-radius:6px;padding:3px 8px;margin:4px 0">' . pd_e($c['code']) . '</span><br>' : '';
            $rowsH .= '<tr><td style="padding:12px 0;border-top:1px solid #E6ECE9"><a href="' . pd_e($c['url']) . '" style="color:#0E1C1B;font-weight:600;text-decoration:none">' . pd_e($c['shopName'] . ': ' . $c['title']) . '</a><br>' . $codeH . '<span style="color:#55645F;font-size:13px">' . pd_e(mb_substr((string)$c['conditions'], 0, 160)) . pd_e($until) . '</span></td></tr>';
            $rowsT .= '- ' . $c['shopName'] . ': ' . $c['title'] . ($c['code'] ? ' · Code: ' . $c['code'] : '') . $until . "\n  " . $c['url'] . "\n";
        }
        $unsubUrl = PD_SITE . '/api/unsubscribe.php?t=' . pd_unsub_token((int)$s['user_id'], 'codes');
        $intro = $de ? ($n === 1 ? 'Für deine Shops gibt es einen neuen Gutschein:' : "Für deine Shops gibt es $n neue Gutscheine und Aktionen:") : "There are $n new vouchers for your shops:";
        $note = $de ? 'Bedingungen (Mindestbestellwert, Neukunden, Ausschlüsse) bitte im Shop prüfen. Anzeige: Links sind Partnerlinks, für dich gleicher Preis.' : 'Please check the conditions in the shop. Ad: affiliate links, same price for you.';
        $html = '<p>' . pd_e($intro) . '</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' . $rowsH . '</table>' . pd_btn(PD_SITE . '/rabatte/', $de ? 'Alle Gutscheine' : 'All vouchers') . '<p style="color:#55645F;font-size:12px">' . pd_e($note) . '</p>';
        $text = $intro . "\n\n" . $rowsT . "\n" . $note . "\n\n" . ($de ? 'Abmelden: ' : 'Unsubscribe: ') . $unsubUrl . "\n";
        try {
            pd_mailer()->send($s['email'], $subject, $text, pd_mail_layout($de ? 'de' : 'en', $subject, $html, [[$de ? 'Gutschein-Alarm abbestellen' : 'Unsubscribe', $unsubUrl], [$de ? 'Shops ändern' : 'Change shops', PD_SITE . '/gutschein-alarm/']]), [
                'List-Unsubscribe' => '<' . $unsubUrl . '>, <mailto:' . PD_FROM . '?subject=unsubscribe>',
                'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
            ]);
            $markC->execute([now_utc(), $s['user_id']]);
            $sent++;
        } catch (Throwable $e) { error_log('perldeals code mail failed: ' . $e->getMessage()); }
    }
}

/* ---------- 2d. Erinnerung an unbestätigte Anmeldungen (seit 06.11.2026) ----------
 * Einmalig ca. 24 h nach der Anmeldung eine zweite Bestätigungsmail mit neuem Link (Double-Opt-in bleibt erhalten).
 * Ohne Bestätigung werden die Daten weiterhin nach 7 Tagen gelöscht. */
try { $pdo->exec("ALTER TABLE pending_subs ADD COLUMN reminded TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $e) { /* exists */ }
if ($sent < PD_MAX_MAILS_PER_RUN) try {
    $rem = $pdo->query("SELECT p.*, u.email, u.lang FROM pending_subs p JOIN users u ON u.id = p.user_id
                        WHERE u.verified_at IS NULL AND p.reminded = 0 AND p.expires_at > UTC_TIMESTAMP()
                          AND p.expires_at <= UTC_TIMESTAMP() + INTERVAL 48 HOUR
                          AND NOT EXISTS (SELECT 1 FROM pending_subs q WHERE q.user_id = p.user_id AND q.reminded = 1)
                        ORDER BY p.expires_at LIMIT 80")->fetchAll();
    $seenU = [];
    $kinds = ['reseller' => ['den Reseller-Deal-Alarm', 'the reseller deal alarm'], 'codes' => ['den Gutschein-Alarm', 'the voucher alert'],
              'bf' => ['den Newsletter mit den besten Deals und den Black-Friday-Alarm', 'the newsletter with the best deals and the Black Friday alarm'],
              'alert' => ['deinen Deal-Alarm', 'your deal alert']];
    foreach ($rem as $p) {
        if ($sent >= PD_MAX_MAILS_PER_RUN) break;
        if (isset($seenU[$p['user_id']])) continue; $seenU[$p['user_id']] = true;
        $de = $p['lang'] !== 'en';
        $raw = b64url(random_bytes(32));
        $pdo->prepare("INSERT INTO pending_subs (token_hash, user_id, kind, keyword, cat, max_price, source, expires_at, also_nl, reminded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
            ->execute([pd_hash($raw), $p['user_id'], $p['kind'], $p['keyword'], $p['cat'], $p['max_price'], $p['source'], gmdate('Y-m-d H:i:s', time() + 3 * 86400), $p['also_nl']]);
        $pdo->prepare("UPDATE pending_subs SET reminded = 1 WHERE user_id = ?")->execute([$p['user_id']]);
        $what = ($kinds[$p['kind']] ?? $kinds['alert'])[$de ? 0 : 1];
        $link = PD_SITE . '/api/subscribe.php?confirm=' . $raw . '&lang=' . ($de ? 'de' : 'en');
        $subject = $de ? 'Erinnerung: Bitte bestätige deine Anmeldung bei perldeals' : 'Reminder: please confirm your perldeals sign-up';
        $msg = $de ? "du hast dich gestern auf perldeals.com für $what angemeldet, die Anmeldung aber noch nicht bestätigt. Ohne Bestätigung dürfen wir dir nichts schicken. Ein Klick genügt:"
                   : "you signed up on perldeals.com for $what yesterday but have not confirmed yet. Without confirmation we cannot send you anything. One click is enough:";
        $foot = $de ? 'Wenn du das nicht möchtest, ignoriere diese E-Mail einfach. Dies ist die einzige Erinnerung; nicht bestätigte Adressen löschen wir nach 7 Tagen.'
                    : "If you don't want this, simply ignore this email. This is the only reminder; unconfirmed addresses are deleted after 7 days.";
        $inner = '<p>' . ($de ? 'Hallo,' : 'Hi,') . '</p><p>' . pd_e($msg) . '</p>' . pd_btn($link, $de ? 'Jetzt bestätigen' : 'Confirm now') . '<p style="color:#55645F;font-size:13px">' . pd_e($foot) . '</p>';
        $text = ($de ? "Hallo,\n\n" : "Hi,\n\n") . $msg . "\n$link\n\n" . $foot . "\n";
        try {
            pd_mailer()->send($p['email'], $subject, $text, pd_mail_layout($de ? 'de' : 'en', $subject, $inner, [['perldeals.com', PD_SITE]]));
            $sent++;
        } catch (Throwable $e) { error_log('perldeals reminder mail failed: ' . $e->getMessage()); }
    }
} catch (Throwable $e) { error_log('perldeals reminder step failed: ' . $e->getMessage()); }

/* ---------- 2e. Wochen-Überblick zu den eigenen Themen (seit 06.11.2026) ----------
 * Sonntags ab 10 Uhr (Berlin): wer einen Deal-Alarm hat, bekommt die stärksten Deals der Woche zu seinen Suchbegriffen/Kategorien
 * (auch über dem Wunschpreis); wer den Reseller-Alarm hat, die Termine der nächsten 14 Tage und die besten Treffer der Woche zu seinen Themen.
 * Abmeldung über denselben Link wie der jeweilige Alarm. */
try { $pdo->exec("ALTER TABLE users ADD COLUMN last_weekly_at DATETIME NULL"); } catch (Throwable $e) { /* exists */ }
if ((int)$berlin->format('N') === 7 && (int)$berlin->format('G') >= 10 && $sent < PD_MAX_MAILS_PER_RUN) {
    $weekAgo = time() - 7 * 86400;
    $recent = array_values(array_filter($deals['deals'], fn($d) => strtotime($d['added']) >= $weekAgo));
    usort($recent, fn($a, $b) => (empty($a['np']) ? ($a['was'] - $a['now']) / $a['was'] : 0) <=> (empty($b['np']) ? ($b['was'] - $b['now']) / $b['was'] : 0));
    $recent = array_reverse($recent);
    $due = $pdo->prepare("SELECT * FROM users WHERE id = ? AND verified_at IS NOT NULL AND (last_weekly_at IS NULL OR last_weekly_at < UTC_TIMESTAMP() - INTERVAL 6 DAY)");
    $doneW = $pdo->prepare("UPDATE users SET last_weekly_at = ? WHERE id = ?");
    // a) Deal-Alarm-Nutzer
    $au = $pdo->query("SELECT DISTINCT a.user_id FROM alerts a JOIN users u ON u.id = a.user_id WHERE u.verified_at IS NOT NULL AND u.alerts_enabled = 1")->fetchAll(PDO::FETCH_COLUMN);
    $aSt = $pdo->prepare("SELECT keyword, cat FROM alerts WHERE user_id = ?");
    foreach ($au as $uid) {
        if ($sent >= PD_MAX_MAILS_PER_RUN) break;
        $due->execute([$uid]); $u = $due->fetch(); if (!$u) continue;
        $aSt->execute([$uid]); $als = $aSt->fetchAll();
        $list = []; $labels = [];
        foreach ($als as $a) {
            $labels[] = $a['keyword'] !== '' ? $a['keyword'] : ucfirst((string)$a['cat']);
            $words = array_filter(explode(' ', pd_norm((string)$a['keyword'])), fn($w) => mb_strlen($w) >= 2);
            foreach ($recent as $d) {
                if ($a['cat'] && $a['cat'] !== $d['cat'] && !($a['cat'] === 'vegan' && !empty($d['vegan']))) continue;
                $hay = pd_norm($d['title']['de'] . ' ' . $d['title']['en'] . ' ' . $d['brand']);
                foreach ($words as $w) { if (!str_contains($hay, $w)) continue 2; }
                $list[$d['id']] = $d;
            }
        }
        $doneW->execute([now_utc(), $uid]);
        $list = array_slice(array_values($list), 0, 8);
        if (!$list) continue;
        $en = $u['lang'] === 'en';
        $lab = implode(', ', array_unique($labels));
        $subject = $en ? "Your week at perldeals: top deals for “{$lab}”" : "Dein Wochen-Überblick: die besten Deals zu „{$lab}“";
        $intro = $en ? "Here are the strongest deals of the past 7 days matching your alert “{$lab}”, checked against price history."
                     : "Hier sind die stärksten Deals der letzten 7 Tage zu deinem Deal-Alarm „{$lab}“, geprüft gegen den Preisverlauf.";
        if (pd_send_user_mail($u, 'alerts', $subject, '<p>' . pd_e($intro) . '</p>', $intro, $list)) $sent++;
    }
    // b) Reseller-Alarm-Nutzer
    if ($rsItems) {
        pd_reseller_tables();
        $rsu = $pdo->query("SELECT r.* FROM reseller_alerts r JOIN users u ON u.id = r.user_id WHERE u.verified_at IS NOT NULL")->fetchAll();
        $soon = time() + 14 * 86400;
        foreach ($rsu as $s) {
            if ($sent >= PD_MAX_MAILS_PER_RUN) break;
            $due->execute([$s['user_id']]); $u = $due->fetch(); if (!$u) continue;
            $topics = explode(',', $s['topics']);
            $dates = []; $best = [];
            foreach ($rsData['releases'] ?? [] as $r) {
                $t = $r['date'] ? strtotime($r['date'] . ' 12:00') : null;
                if ($t && $t >= time() - 86400 && $t <= $soon && in_array($r['game'], $topics, true)) $dates[] = $r['id'];
            }
            foreach ($rsItems as $it) {
                if (!array_intersect($topics, $it['topics'])) continue;
                if (in_array($it['id'], $dates, true)) { $best[$it['id']] = $it; continue; }
                if (strtotime($it['added']) >= $weekAgo) $best[$it['id']] = $it;
            }
            $doneW->execute([now_utc(), $s['user_id']]);
            $list = array_slice(array_values($best), 0, 10);
            if (!$list) continue;
            $rowsH = ''; $rowsT = '';
            foreach ($list as $it) {
                $rowsH .= '<tr><td style="padding:12px 0;border-top:1px solid #E6ECE9"><a href="' . pd_e($it['url']) . '" style="color:#0E1C1B;font-weight:600;text-decoration:none">' . pd_e($it['title']) . '</a><br><span style="color:#55645F">' . pd_e($it['line']) . '</span></td></tr>';
                $rowsT .= '- ' . $it['title'] . "\n  " . $it['line'] . "\n  " . $it['url'] . "\n";
            }
            $subject = 'Dein Reseller-Wochenüberblick: Termine und beste Treffer';
            $intro = 'Hier sind die Termine der nächsten 14 Tage und die besten Treffer der Woche zu deinen Reseller-Themen.';
            $note = 'Marktwerte und Margen sind Schätzungen vor Gebühren und Versand. Preise zum Zeitpunkt der Veröffentlichung.';
            $unsubUrl = PD_SITE . '/api/unsubscribe.php?t=' . pd_unsub_token((int)$s['user_id'], 'reseller');
            $html = '<p>' . pd_e($intro) . '</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' . $rowsH . '</table>' . pd_btn(PD_SITE . '/reseller/', 'Alle Reseller-Deals') . '<p style="color:#55645F;font-size:12px">' . pd_e($note) . '</p>';
            try {
                pd_mailer()->send($u['email'], $subject, $intro . "\n\n" . $rowsT . "\n" . $note . "\n\nAbmelden: " . $unsubUrl . "\n", pd_mail_layout('de', $subject, $html, [['Reseller-Alarm abbestellen', $unsubUrl], ['perldeals.com/reseller', PD_SITE . '/reseller/']]), [
                    'List-Unsubscribe' => '<' . $unsubUrl . '>, <mailto:' . PD_FROM . '?subject=unsubscribe>',
                    'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
                ]);
                $sent++;
            } catch (Throwable $e) { error_log('perldeals weekly reseller mail failed: ' . $e->getMessage()); }
        }
    }
}

/* ---------- 3. daily newsletter ---------- */
if ($isMorning && $sent < PD_MAX_MAILS_PER_RUN) {
    $top = $deals['deals'];
    $top = array_values(array_filter($top, fn($d) => empty($d['np'])));
    usort($top, fn($a, $b) => (($b['low'] ?? false) <=> ($a['low'] ?? false)) ?: (($b['was'] - $b['now']) / $b['was'] <=> ($a['was'] - $a['now']) / $a['was']));
    $top = array_slice($top, 0, 6);
    $st = $pdo->prepare("SELECT * FROM users WHERE newsletter = 1 AND verified_at IS NOT NULL AND (last_newsletter_at IS NULL OR last_newsletter_at < ?) LIMIT ?");
    $st->bindValue(1, $todayStartUtc);
    $st->bindValue(2, PD_MAX_MAILS_PER_RUN - $sent, PDO::PARAM_INT);
    $st->execute();
    foreach ($st->fetchAll() as $u) {
        $en = $u['lang'] === 'en';
        $subject = $en ? 'Today’s pearls: the best deals of the day' : 'Die Perlen des Tages: die besten Deals von heute';
        $intro = $en ? 'Here are today’s strongest deals, checked against price history.' : 'Hier sind die stärksten Deals von heute, geprüft gegen den Preisverlauf.';
        if (pd_send_user_mail($u, 'newsletter', $subject, '<p>' . pd_e($intro) . '</p>', $intro, $top)) {
            $pdo->prepare("UPDATE users SET last_newsletter_at = ? WHERE id = ?")->execute([now_utc(), $u['id']]);
            $sent++;
        }
    }
}


/* ---------- 3b. Rundmails (lib/campaigns.php), nur an bestätigte Newsletter-Abonnenten ---------- */
$campaigns = is_file(__DIR__ . '/lib/campaigns.php') ? (require __DIR__ . '/lib/campaigns.php') : [];
if ($campaigns && $sent < PD_MAX_MAILS_PER_RUN) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS campaign_sends (campaign_id VARCHAR(60) NOT NULL, user_id INT UNSIGNED NOT NULL, sent_at DATETIME NOT NULL, PRIMARY KEY (campaign_id, user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    foreach ($campaigns as $cp) {
        if ($sent >= PD_MAX_MAILS_PER_RUN) break;
        if (empty($cp['id']) || empty($cp['subject']) || empty($cp['paragraphs'])) continue;
        if (!empty($cp['send_after']) && strtotime($cp['send_after'] . ' UTC') > time()) continue;
        $cid = substr((string)$cp['id'], 0, 60);
        $html = implode('', array_map(fn($p) => '<p>' . pd_e((string)$p) . '</p>', $cp['paragraphs'])) . (!empty($cp['button']) ? pd_btn((string)$cp['button'][1], (string)$cp['button'][0]) : '');
        $text = implode("\n\n", $cp['paragraphs']) . (!empty($cp['button']) ? "\n\n" . $cp['button'][0] . ': ' . $cp['button'][1] : '');
        if (!empty($cp['test'])) {
            $tid = 'test:' . $cid;
            $done = $pdo->prepare("SELECT 1 FROM campaign_sends WHERE campaign_id = ? AND user_id = 0"); $done->execute([$tid]);
            if ($done->fetchColumn()) continue;
            try {
                pd_mailer()->send(PD_FROM, '[TEST] ' . $cp['subject'], $text . "\n\n(Testversand, Abmeldelink erscheint im echten Versand)", pd_mail_layout('de', $cp['subject'], $html . '<p style="color:#55645F;font-size:12px">Testversand. Im echten Versand steht hier der Abmeldelink.</p>', [['perldeals.com', PD_SITE]]));
                $pdo->prepare("INSERT INTO campaign_sends (campaign_id, user_id, sent_at) VALUES (?, 0, ?)")->execute([$tid, now_utc()]);
                $sent++;
            } catch (Throwable $e) { error_log('perldeals campaign test failed: ' . $e->getMessage()); }
            continue;
        }
        $sql = "SELECT u.* FROM users u WHERE u.newsletter = 1 AND u.verified_at IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM campaign_sends s WHERE s.campaign_id = ? AND s.user_id = u.id)";
        $args = [$cid];
        if (!empty($cp['topics'])) {
            pd_reseller_tables();
            $or = []; foreach ($cp['topics'] as $t) { $or[] = "FIND_IN_SET(?, r.topics)"; $args[] = (string)$t; }
            $sql .= " AND EXISTS (SELECT 1 FROM reseller_alerts r WHERE r.user_id = u.id AND (" . implode(' OR ', $or) . "))";
        }
        $sql .= " LIMIT " . (int)(PD_MAX_MAILS_PER_RUN - $sent);
        $st = $pdo->prepare($sql); $st->execute($args);
        $mark = $pdo->prepare("INSERT IGNORE INTO campaign_sends (campaign_id, user_id, sent_at) VALUES (?, ?, ?)");
        foreach ($st->fetchAll() as $u) {
            $unsubUrl = PD_SITE . '/api/unsubscribe.php?t=' . pd_unsub_token((int)$u['id'], 'newsletter');
            try {
                pd_mailer()->send($u['email'], $cp['subject'], $text . "\n\nNewsletter abbestellen: " . $unsubUrl . "\n",
                    pd_mail_layout('de', $cp['subject'], $html, [['Newsletter abbestellen', $unsubUrl], ['E-Mail-Einstellungen', pd_account_url('de')]]), [
                    'List-Unsubscribe' => '<' . $unsubUrl . '>, <mailto:' . PD_FROM . '?subject=unsubscribe>',
                    'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
                ]);
                $mark->execute([$cid, $u['id'], now_utc()]);
                $sent++;
            } catch (Throwable $e) { error_log('perldeals campaign mail failed: ' . $e->getMessage()); }
        }
    }
}

if ($mailer) $mailer->close();

/* ---------- 4. nightly database backup (03:xx Berlin) into the protected /private folder, 14 days kept ---------- */
if ((int)$berlin->format('G') === 3) {
    $dir = pd_webroot() . '/private/backups';
    $file = $dir . '/db-' . $berlin->format('Y-m-d') . '.json.gz';
    if (!is_file($file)) {
        pd_reseller_tables();
        pd_code_tables();
        $pdo->exec("CREATE TABLE IF NOT EXISTS campaign_sends (campaign_id VARCHAR(60) NOT NULL, user_id INT UNSIGNED NOT NULL, sent_at DATETIME NOT NULL, PRIMARY KEY (campaign_id, user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        @mkdir($dir, 0700, true);
        if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        $dump = ['created' => gmdate('c'), 'tables' => []];
        foreach (['settings', 'users', 'login_tokens', 'sessions', 'alerts', 'alert_hits', 'consent_log', 'reseller_alerts', 'reseller_hits', 'code_alerts', 'code_hits', 'campaign_sends'] as $t) {
            $dump['tables'][$t] = $pdo->query("SELECT * FROM `$t`")->fetchAll(PDO::FETCH_ASSOC);
        }
        if (@file_put_contents($file, gzencode(json_encode($dump, JSON_UNESCAPED_UNICODE), 9)) !== false) {
            @chmod($file, 0600);
            echo "backup written: " . basename($file) . "\n";
        }
        foreach (glob($dir . '/db-*.json.gz') ?: [] as $old) {
            if (filemtime($old) < time() - 14 * 86400) @unlink($old);
        }
    }
}
$pdo->exec("DELETE FROM rate_limits WHERE window_start < UNIX_TIMESTAMP() - 86400");
// data minimisation: email addresses that were never confirmed are deleted after 7 days (pending requests cascade)
$pdo->exec("DELETE FROM users WHERE verified_at IS NULL AND created_at < UTC_TIMESTAMP() - INTERVAL 7 DAY");
$pdo->exec("DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()");
$pdo->exec("DELETE FROM login_tokens WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY");
echo date('c') . " perldeals cron: $sent mails sent\n";

/* ---------- Letzter Lauf (für die Kontrolle in stats.php: Web- oder CLI-Aufruf) ---------- */
try { db()->prepare("REPLACE INTO settings (k, v) VALUES ('cron_last', ?)")->execute([json_encode(['at' => gmdate('c'), 'sapi' => PHP_SAPI])]); } catch (Throwable $e) {}
