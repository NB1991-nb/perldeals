<?php
declare(strict_types=1);
/* Auswertung der Besucherquellen (nur mit Schlüssel). Liefert Summen je Tag/Quelle/Seitentyp, keine personenbezogenen Daten. */
require __DIR__ . '/lib/bootstrap.php';
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
$key = (string)($_GET['k'] ?? '');
// Nur der SHA-256-Hash des Schlüssels steht im Code; der Schlüssel selbst liegt nicht im Repository.
const PD_STATS_KEY_SHA256 = 'e4b82795613d67f71b73f0a91b1d4c315f6a7503f8c7a9e17be64b956e60db9b';
if (strlen($key) < 32 || !hash_equals(PD_STATS_KEY_SHA256, hash('sha256', $key))) { http_response_code(404); exit; }
$days = max(1, min(90, (int)($_GET['days'] ?? 28)));
try {
    $db = db();
    $db->exec("CREATE TABLE IF NOT EXISTS visits_daily (day DATE NOT NULL, source VARCHAR(40) NOT NULL, page_type VARCHAR(30) NOT NULL, hits INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (day, source, page_type)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $st = $db->prepare("SELECT day, source, page_type, hits FROM visits_daily WHERE day >= (CURRENT_DATE() - INTERVAL ? DAY) ORDER BY day DESC, hits DESC");
    $st->execute([$days]);
    $rows = $st->fetchAll();
    $bySource = [];
    foreach ($rows as $r) { $bySource[$r['source']] = ($bySource[$r['source']] ?? 0) + (int)$r['hits']; }
    arsort($bySource);
    // Anmeldungen, nur Zahlen (keine E-Mail-Adressen)
    $n = fn(string $q) => (int)$db->query($q)->fetchColumn();
    $subs = ['users_total' => $n("SELECT COUNT(*) FROM users"), 'users_confirmed' => $n("SELECT COUNT(*) FROM users WHERE verified_at IS NOT NULL"),
        'newsletter_bf' => $n("SELECT COUNT(*) FROM users WHERE newsletter = 1 AND verified_at IS NOT NULL"),
        'price_alerts' => $n("SELECT COUNT(*) FROM alerts a JOIN users u ON u.id = a.user_id WHERE u.verified_at IS NOT NULL"),
        'price_alert_users' => $n("SELECT COUNT(DISTINCT a.user_id) FROM alerts a JOIN users u ON u.id = a.user_id WHERE u.verified_at IS NOT NULL")];
    try { pd_reseller_tables(); $subs['reseller_alarm'] = $n("SELECT COUNT(*) FROM reseller_alerts"); } catch (Throwable $e) {}
    try { pd_code_tables(); $subs['code_alarm'] = $n("SELECT COUNT(*) FROM code_alerts"); } catch (Throwable $e) {}
    try { $subs['pending_unconfirmed'] = $n("SELECT COUNT(*) FROM pending_subs WHERE expires_at > UTC_TIMESTAMP()"); } catch (Throwable $e) {}
    $subs['consent_by_source'] = $db->query("SELECT kind, source, SUM(value = 1) AS optin, SUM(value = 0) AS optout FROM consent_log GROUP BY kind, source")->fetchAll();
    $camp = [];
    try { $st2 = $db->prepare("SELECT campaign, content, event, SUM(hits) AS hits FROM campaign_daily WHERE day >= (CURRENT_DATE() - INTERVAL ? DAY) GROUP BY campaign, content, event ORDER BY campaign, hits DESC"); $st2->execute([$days]); $camp = $st2->fetchAll(); } catch (Throwable $e) {}
    $srv = ['php' => PHP_VERSION];
    try { $srv['cron_cli_seen'] = $db->query("SELECT v FROM settings WHERE k = 'cron_cli_seen'")->fetchColumn(); } catch (Throwable $e) {}
    try { $srv['cron_last'] = json_decode((string)$db->query("SELECT v FROM settings WHERE k = 'cron_last'")->fetchColumn(), true); } catch (Throwable $e) {}
    $pages = [];
    try { $ps = $db->prepare("SELECT path, SUM(views) AS views, SUM(outs) AS outs FROM pages_daily WHERE day >= (CURRENT_DATE() - INTERVAL ? DAY) GROUP BY path ORDER BY views DESC LIMIT 50"); $ps->execute([$days]); $pages = $ps->fetchAll(); } catch (Throwable $e) {}
    $shops = []; $shopPages = []; $outPages = [];
    try { $s3 = $db->prepare("SELECT shop, SUM(hits) AS clicks FROM outs_shop_daily WHERE day >= (CURRENT_DATE() - INTERVAL ? DAY) GROUP BY shop ORDER BY clicks DESC"); $s3->execute([$days]); $shops = $s3->fetchAll(); } catch (Throwable $e) {}
    try { $s4 = $db->prepare("SELECT shop, path, SUM(hits) AS clicks FROM outs_shop_daily WHERE day >= (CURRENT_DATE() - INTERVAL ? DAY) GROUP BY shop, path ORDER BY clicks DESC LIMIT 100"); $s4->execute([$days]); $shopPages = $s4->fetchAll(); } catch (Throwable $e) {}
    try { $s5 = $db->prepare("SELECT path, SUM(views) AS views, SUM(outs) AS outs FROM pages_daily WHERE day >= (CURRENT_DATE() - INTERVAL ? DAY) GROUP BY path HAVING outs > 0 ORDER BY outs DESC LIMIT 1000"); $s5->execute([$days]); $outPages = $s5->fetchAll(); } catch (Throwable $e) {}
    pd_json(['srv' => $srv, 'pages' => $pages, 'out_pages' => $outPages, 'shops' => $shops, 'shop_pages' => $shopPages, 'campaigns' => $camp, 'subscriptions' => $subs, 'days' => $days, 'total' => array_sum($bySource), 'by_source' => $bySource, 'rows' => $rows]);
} catch (Throwable $e) { pd_fail(500, 'db'); }
