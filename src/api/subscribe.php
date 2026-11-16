<?php
declare(strict_types=1);
/*
 * One-step sign-up without an account page, with double opt-in:
 *  POST {email, lang, kind: "bf" | "alert", keyword?, cat?, max_price?, website (honeypot)}
 *    -> stores a pending request and mails a confirmation link
 *  GET ?confirm=<token>
 *    -> applies it (newsletter incl. Black Friday deal alarm, or a price alert), verifies the address, redirects
 */
require __DIR__ . '/lib/bootstrap.php';

function pd_pending_table(): void {
    db()->exec("CREATE TABLE IF NOT EXISTS pending_subs (
        token_hash CHAR(64) PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        kind VARCHAR(10) NOT NULL,
        keyword VARCHAR(80) NULL,
        cat VARCHAR(20) NULL,
        max_price DECIMAL(10,2) NULL,
        source VARCHAR(30) NOT NULL,
        expires_at DATETIME NOT NULL,
        INDEX (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    try { db()->exec("ALTER TABLE pending_subs ADD COLUMN also_nl TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $e) { /* exists */ }
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['confirm'])) {
    // GET zeigt nur eine Bestätigungsseite: Link-Scanner in Mailsystemen rufen Links automatisch auf, eintragen erst per POST (echter Klick)
    $raw = (string)$_GET['confirm'];
    $lang = pd_lang($_GET['lang'] ?? 'de');
    $de = $lang !== 'en';
    $ok = (bool)preg_match('/^[A-Za-z0-9_-]{40,50}$/', $raw);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $title = $de ? 'Anmeldung bestätigen' : 'Confirm your subscription';
    $msg = $ok ? ($de ? 'Bitte bestätige mit einem Klick, dass du die E-Mails von perldeals erhalten möchtest.' : 'Please confirm with one click that you want to receive emails from perldeals.')
               : ($de ? 'Dieser Bestätigungslink ist ungültig.' : 'This confirmation link is invalid.');
    $form = $ok ? '<form method="post" action="/api/subscribe.php?confirm=' . pd_e($raw) . '&amp;lang=' . pd_e($lang) . '"><button class="btn btn-primary" type="submit">' . pd_e($de ? 'Jetzt bestätigen' : 'Confirm now') . '</button></form>' : '';
    echo '<!doctype html><html lang="' . pd_e($lang) . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>' . pd_e($title) . ' · perldeals</title><link rel="stylesheet" href="/assets/style.css"><script src="/assets/theme.js"></script></head><body><main class="wrap legal"><div class="eyebrow">perldeals</div><h1>' . pd_e($title) . '</h1><p>' . pd_e($msg) . '</p>' . $form . '<p><a href="/">' . pd_e($de ? 'Zur Startseite' : 'Home') . '</a></p></main></body></html>';
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_GET['confirm'])) {
    $raw = (string)$_GET['confirm'];
    $lang = pd_lang($_GET['lang'] ?? 'de');
    $back = PD_SITE . ($lang === 'en' ? '/en/account/' : '/konto/');
    if (!preg_match('/^[A-Za-z0-9_-]{40,50}$/', $raw) || !pd_rate('confirm-ip|' . pd_ip_key(), 30, 900)) { header('Location: ' . $back . '?bestaetigt=0', true, 303); exit; }
    pd_pending_table();
    $pdo = db();
    $st = $pdo->prepare("SELECT p.*, u.email FROM pending_subs p JOIN users u ON u.id = p.user_id WHERE p.token_hash = ? AND p.expires_at > UTC_TIMESTAMP()");
    $st->execute([pd_hash($raw)]);
    $p = $st->fetch();
    if (!$p) { header('Location: ' . $back . '?bestaetigt=0', true, 303); exit; }
    $uid = (int)$p['user_id'];
    $pdo->prepare("UPDATE users SET verified_at = COALESCE(verified_at, ?) WHERE id = ?")->execute([now_utc(), $uid]);
    if ($p['kind'] === 'reseller') {
        pd_reseller_tables();
        $o = pd_rs_unpack((string)$p['keyword']);
        $pdo->prepare("INSERT INTO reseller_alerts (user_id, topics, min_discount, min_margin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
                       ON DUPLICATE KEY UPDATE topics = VALUES(topics), min_discount = VALUES(min_discount), min_margin = VALUES(min_margin), updated_at = VALUES(updated_at)")
            ->execute([$uid, implode(',', $o['topics']), $o['min_discount'], $o['min_margin'], now_utc(), now_utc()]);
        pd_log_consent($uid, $p['email'], 'reseller', true, 'doi-' . $p['source']);
    } elseif ($p['kind'] === 'codes') {
        pd_code_tables();
        $new = pd_code_shops(explode(',', substr((string)$p['keyword'], 2)));
        $old = $pdo->prepare("SELECT shops FROM code_alerts WHERE user_id = ?"); $old->execute([$uid]);
        $prev = $old->fetchColumn();
        $merged = $prev === false ? $new : pd_code_shops(array_merge(explode(',', (string)$prev), $new));
        $pdo->prepare("INSERT INTO code_alerts (user_id, shops, created_at, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE shops = VALUES(shops), updated_at = VALUES(updated_at)")
            ->execute([$uid, implode(',', $merged), now_utc(), now_utc()]);
        pd_log_consent($uid, $p['email'], 'codes', true, 'doi-' . $p['source']);
    } elseif ($p['kind'] === 'bf') {
        $pdo->prepare("UPDATE users SET newsletter = 1, newsletter_consent_at = COALESCE(newsletter_consent_at, ?) WHERE id = ?")->execute([now_utc(), $uid]);
        pd_log_consent($uid, $p['email'], 'newsletter', true, 'doi-' . $p['source']);
    } else {
        $c = $pdo->prepare("SELECT COUNT(*) FROM alerts WHERE user_id = ?");
        $c->execute([$uid]);
        if ((int)$c->fetchColumn() < PD_MAX_ALERTS) {
            $pdo->prepare("INSERT INTO alerts (user_id, keyword, cat, max_price, created_at) VALUES (?, ?, ?, ?, ?)")
                ->execute([$uid, $p['keyword'] ?? '', $p['cat'], $p['max_price'], now_utc()]);
        }
        pd_log_consent($uid, $p['email'], 'alerts', true, 'doi-' . $p['source']);
    }
    if (!empty($p['also_nl']) && $p['kind'] !== 'bf') {
        $pdo->prepare("UPDATE users SET newsletter = 1, newsletter_consent_at = COALESCE(newsletter_consent_at, ?) WHERE id = ?")->execute([now_utc(), $uid]);
        pd_log_consent($uid, $p['email'], 'newsletter', true, 'doi-' . $p['source'] . '-addon');
    }
    $pdo->prepare("DELETE FROM pending_subs WHERE token_hash = ?")->execute([pd_hash($raw)]);
    if ($p['kind'] === 'reseller') $back = PD_SITE . '/reseller/';
    if ($p['kind'] === 'codes') $back = PD_SITE . '/gutschein-alarm/';
    header('Location: ' . $back . '?bestaetigt=' . ($p['kind'] === 'bf' ? 'newsletter' : ($p['kind'] === 'reseller' ? 'reseller' : ($p['kind'] === 'codes' ? 'codes' : 'alarm'))), true, 303);
    exit;
}

pd_method('POST');
pd_same_origin();
$in = pd_body();
if (!empty($in['website'])) pd_json(['sent' => true]);
$email = pd_email($in['email'] ?? null);
$lang = pd_lang($in['lang'] ?? 'de');
if (!$email) pd_fail(422, 'invalid_email');
$kind = in_array($in['kind'] ?? '', ['alert', 'reseller', 'codes'], true) ? $in['kind'] : 'bf';
$rs = null;
$codeShops = [];
if ($kind === 'codes') {
    $codeShops = pd_code_shops(is_array($in['topics'] ?? null) ? $in['topics'] : []);
    if (!$codeShops) pd_fail(422, 'shops_required');
}
if ($kind === 'reseller') {
    $topics = array_values(array_intersect(PD_RS_TOPICS, is_array($in['topics'] ?? null) ? $in['topics'] : []));
    if (!$topics) pd_fail(422, 'topics_required');
    $md = (int)($in['min_discount'] ?? 0); $md = in_array($md, [0, 20, 30, 40, 50], true) ? $md : 0;
    $mm = trim((string)($in['min_margin'] ?? ''));
    $mm = $mm === '' ? null : round((float)str_replace(',', '.', $mm), 2);
    if ($mm !== null && ($mm <= 0 || $mm > 5000)) $mm = null;
    $rs = ['topics' => $topics, 'd' => $md, 'm' => $mm];
}
$kw = mb_substr(strip_tags(trim(preg_replace('/\s+/u', ' ', (string)($in['keyword'] ?? '')))), 0, 80);
$cat = in_array($in['cat'] ?? null, PD_CATS, true) ? $in['cat'] : null;
$max = null;
if (isset($in['max_price']) && $in['max_price'] !== '' && $in['max_price'] !== null) {
    $max = round((float)str_replace(',', '.', (string)$in['max_price']), 2);
    if ($max <= 0 || $max > 100000) $max = null;
}
if ($kind === 'alert' && mb_strlen($kw) < 2 && $cat === null) pd_fail(422, 'keyword_required');
$label = mb_strlen($kw) >= 2 ? mb_substr(trim(preg_replace('/[^\p{L}\p{N} .,+\-]/u', '', $kw)), 0, 40) : ($lang === 'en' ? 'all ' . $cat . ' deals' : 'alle Deals der Kategorie ' . ucfirst((string)$cat));
$source = preg_replace('/[^a-z0-9-]/', '', (string)($in['source'] ?? 'web')) ?: 'web';
if (!pd_rate('sub-ip|' . pd_ip_key(), 8, 900) || !pd_rate('sub-mail|' . $email, 3, 3600) || !pd_rate('mail-day|' . $email, 4, 86400)) pd_fail(429, 'too_many_requests');

pd_pending_table();
$pdo = db();
$st = $pdo->prepare("SELECT id FROM users WHERE email = ?");
$st->execute([$email]);
$uid = $st->fetchColumn();
if (!$uid) {
    $pdo->prepare("INSERT INTO users (email, lang, created_at) VALUES (?, ?, ?)")->execute([$email, $lang, now_utc()]);
    $uid = (int)$pdo->lastInsertId();
}
$raw = b64url(random_bytes(32));
$alsoNl = !empty($in['newsletter']) && $kind !== 'bf';
$pdo->prepare("INSERT INTO pending_subs (token_hash, user_id, kind, keyword, cat, max_price, source, expires_at, also_nl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    ->execute([pd_hash($raw), $uid, $kind, $kind === 'alert' ? $kw : ($kind === 'codes' ? 's=' . implode(',', $codeShops) : ($rs ? pd_rs_pack($rs['topics'], $rs['d'], $rs['m']) : null)), $kind === 'reseller' ? null : $cat, $kind === 'reseller' ? null : $max, mb_substr($source, 0, 24), gmdate('Y-m-d H:i:s', time() + 3 * 86400), $alsoNl ? 1 : 0]);
$pdo->exec("DELETE FROM pending_subs WHERE expires_at < UTC_TIMESTAMP()");

$link = PD_SITE . '/api/subscribe.php?confirm=' . $raw . '&lang=' . $lang;
$de = $lang === 'de';
if ($kind === 'reseller') {
    $names = ['pokemon' => 'Pokémon', 'onepiece' => 'One Piece', 'lego' => 'LEGO', 'konsolen' => 'Konsolen', 'top' => 'beste Deals & Aktionen', 'netzwerk' => 'Angebote direkt von perldeals'];
    $tl = implode(', ', array_map(fn($t) => $names[$t], $rs['topics']));
    $subject = $de ? 'Bitte bestätigen: Reseller-Deal-Alarm von perldeals' : 'Please confirm: perldeals reseller deal alarm';
    $what = $de ? 'den Reseller-Deal-Alarm (' . $tl . ')' . ($rs['d'] ? ', ab ' . $rs['d'] . ' % Rabatt' : '') . ($rs['m'] ? ', ab ' . number_format($rs['m'], 0, ',', '.') . ' € Marge' : '')
                : 'the reseller deal alarm (' . $tl . ')';
} elseif ($kind === 'codes') {
    $subject = $de ? 'Bitte bestätigen: Gutschein-Alarm von perldeals' : 'Please confirm: perldeals voucher alert';
    $sl = $codeShops === ['all'] ? ($de ? 'alle Shops' : 'all shops') : implode(', ', array_slice($codeShops, 0, 8)) . (count($codeShops) > 8 ? ' …' : '');
    $what = $de ? 'den Gutschein-Alarm (' . $sl . ')' : 'the voucher alert (' . $sl . ')';
} elseif ($kind === 'bf') {
    $subject = $de ? 'Bitte bestätigen: Deal-Alarm von perldeals' : 'Please confirm: perldeals deal alarm';
    $what = $de ? 'den Newsletter „Perlen des Tages“ mit den besten Deals und dem Black-Friday-Deal-Alarm' : 'the "Pearls of the day" newsletter with the best deals and the Black Friday deal alarm';
} else {
    $subject = $de ? 'Bitte bestätigen: dein Deal-Alarm von perldeals' : 'Please confirm your perldeals deal alert';
    $what = $de ? 'einen Deal-Alarm für „' . $label . '“' . ($max ? ' unter ' . number_format($max, 2, ',', '.') . ' €' : '') : 'a deal alert for "' . $label . '"' . ($max ? ' below €' . number_format($max, 2) : '');
}
if ($kind === 'alert' || $kind === 'reseller') $what .= $de ? ' (mit einem Wochen-Überblick am Sonntag zu deinen Themen)' : ' (including a weekly overview on Sundays for your topics)';
if ($alsoNl) $what .= $de ? ' sowie den perldeals-Newsletter mit den besten Deals und Aktionen' : ' and the perldeals newsletter with the best deals and promotions';
$text = ($de ? "Hallo,\n\ndu hast auf perldeals.com $what bestellt. Bitte bestätige das mit diesem Link (gültig 3 Tage):\n$link\n\nWenn du das nicht warst, ignoriere diese E-Mail einfach. Ohne Bestätigung schicken wir dir nichts. Abmelden kannst du dich jederzeit über den Link in jeder E-Mail.\n"
             : "Hi,\n\nyou signed up on perldeals.com for $what. Please confirm with this link (valid for 3 days):\n$link\n\nIf this wasn't you, simply ignore this email. Without confirmation we will not send you anything. You can unsubscribe anytime via the link in every email.\n");
$inner = '<p>' . ($de ? 'Hallo,' : 'Hi,') . '</p><p>' . htmlspecialchars($de ? "du hast auf perldeals.com $what bestellt. Bitte bestätige das mit einem Klick." : "you signed up on perldeals.com for $what. Please confirm with one click.") . '</p>'
    . pd_btn($link, $de ? 'Jetzt bestätigen' : 'Confirm now')
    . '<p style="color:#55645F;font-size:13px">' . ($de ? 'Wenn du das nicht warst, ignoriere diese E-Mail einfach. Ohne Bestätigung schicken wir dir nichts.' : "If this wasn't you, simply ignore this email. Without confirmation we will not send you anything.") . '</p>';
try {
    $m = PdMailer::fromConfig();
    $m->send($email, $subject, $text, pd_mail_layout($lang, $subject, $inner, [['perldeals.com', PD_SITE]]));
    $m->close();
} catch (Throwable $e) {
    error_log('perldeals subscribe mail failed: ' . $e->getMessage());
    pd_fail(502, 'mail_failed');
}
pd_json(['sent' => true]);
