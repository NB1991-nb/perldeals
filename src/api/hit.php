<?php
declare(strict_types=1);
/*
 * Datensparsame Besucherzählung: pro Tag nur Anzahl der Seitenaufrufe je Quelle (z. B. google, chatgpt)
 * und Seitentyp (z. B. deal, kaufberatung). Keine Cookies, keine IP-Adressen, keine Nutzer-IDs, keine URLs.
 */
require __DIR__ . '/lib/bootstrap.php';
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(204); exit; }
$ua = strtolower((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|headless|lighthouse/', $ua)) { http_response_code(204); exit; }
$in = json_decode((string)file_get_contents('php://input', false, null, 0, 600), true);
if (!is_array($in)) { http_response_code(204); exit; }

function pd_source(string $ref, string $utm): string {
    $utm = strtolower(preg_replace('/[^a-z0-9_-]/i', '', $utm));
    if ($utm !== '') return substr('utm:' . $utm, 0, 40);
    $h = strtolower(preg_replace('/^www\./', '', $ref));
    if ($h === '' ) return 'direkt';
    if ($h === 'perldeals.com') return 'intern';
    $map = ['google.' => 'google', 'bing.com' => 'bing', 'duckduckgo.com' => 'duckduckgo', 'ecosia.org' => 'ecosia', 'chatgpt.com' => 'chatgpt', 'chat.openai.com' => 'chatgpt',
        'perplexity.ai' => 'perplexity', 'claude.ai' => 'claude', 'gemini.google.com' => 'gemini', 'copilot.microsoft.com' => 'copilot', 'you.com' => 'you.com',
        'facebook.com' => 'facebook', 'm.facebook.com' => 'facebook', 'l.facebook.com' => 'facebook', 'instagram.com' => 'instagram', 'l.instagram.com' => 'instagram',
        'pinterest.' => 'pinterest', 'linkedin.com' => 'linkedin', 'lnkd.in' => 'linkedin', 't.me' => 'telegram', 'web.telegram.org' => 'telegram', 'whatsapp.com' => 'whatsapp', 'wa.me' => 'whatsapp',
        'tiktok.com' => 'tiktok', 'youtube.com' => 'youtube', 'reddit.com' => 'reddit', 'mydealz.de' => 'mydealz'];
    foreach ($map as $k => $v) { if ($h === $k || str_ends_with($h, '.' . $k) || str_starts_with($h, $k) || str_contains($h, $k)) return $v; }
    return substr(preg_replace('/[^a-z0-9.-]/', '', $h), 0, 40) ?: 'andere';
}
// Kampagnen-Auswertung (z. B. Newsletter): nur Kampagne, Element und Ereignis, keine Personendaten
$camp = strtolower(preg_replace('/[^a-z0-9_-]/i', '', substr((string)($in['c'] ?? ''), 0, 40)));
if ($camp !== '') {
    $cont = strtolower(preg_replace('/[^a-z0-9_-]/i', '', substr((string)($in['x'] ?? ''), 0, 40))) ?: '-';
    $ev = in_array($in['e'] ?? '', ['visit', 'click', 'alarm', 'page', 'cta'], true) ? $in['e'] : 'visit';
    try {
        $db = db();
        if (pd_rate('hitc|' . pd_ip_key(), 200, 3600)) {
            $db->exec("CREATE TABLE IF NOT EXISTS campaign_daily (day DATE NOT NULL, campaign VARCHAR(40) NOT NULL, content VARCHAR(40) NOT NULL, event VARCHAR(10) NOT NULL, hits INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (day, campaign, content, event)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $db->prepare("INSERT INTO campaign_daily (day, campaign, content, event, hits) VALUES (CURRENT_DATE(), ?, ?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1")->execute([$camp, $cont, $ev]);
        }
    } catch (Throwable $e) {}
    if ($ev !== 'visit') { http_response_code(204); exit; } // Klicks/Anmeldungen nicht zusätzlich als Seitenaufruf zählen
}
// Seitenaufrufe und Shop-Klicks je Pfad (anonym: nur Tag + Pfad + Zähler)
$path = strtolower(preg_replace('#[^a-z0-9/._-]#i', '', substr((string)($in['pa'] ?? ''), 0, 160)));
$path = preg_replace('#/+#', '/', $path);
if (($in['e'] ?? '') === 'out') {
    if ($path !== '') try { $db = db(); if (pd_rate('hito|' . pd_ip_key(), 120, 3600)) {
        $db->exec("CREATE TABLE IF NOT EXISTS pages_daily (day DATE NOT NULL, path VARCHAR(160) NOT NULL, views INT UNSIGNED NOT NULL DEFAULT 0, outs INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (day, path)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $db->prepare("INSERT INTO pages_daily (day, path, outs) VALUES (CURRENT_DATE(), ?, 1) ON DUPLICATE KEY UPDATE outs = outs + 1")->execute([$path]); } } catch (Throwable $e) {}
    http_response_code(204); exit;
}
$src = pd_source(substr((string)($in['r'] ?? ''), 0, 120), substr((string)($in['u'] ?? ''), 0, 40));
$types = ['', 'deals', 'kaufberatung', 'ratgeber', 'bestenliste', 'gutscheine', 'rabatte', 'kategorie', 'shop', 'geschenke', 'black-friday', 'singles-day', 'cyber-monday', 'weihnachtsangebote', 'berater', 'konto'];
$p = strtolower(preg_replace('/[^a-z-]/i', '', (string)($in['p'] ?? '')));
$lang = !empty($in['en']) ? 'en' : 'de';
$type = in_array($p, $types, true) ? ($p === '' ? 'start' : $p) : 'andere';
$type = $lang . ':' . $type;
try {
    $db = db();
    if (!pd_rate('hit|' . pd_ip_key(), 120, 3600)) { http_response_code(204); exit; }
    $db->exec("CREATE TABLE IF NOT EXISTS visits_daily (day DATE NOT NULL, source VARCHAR(40) NOT NULL, page_type VARCHAR(30) NOT NULL, hits INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (day, source, page_type)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $st = $db->prepare("INSERT INTO visits_daily (day, source, page_type, hits) VALUES (CURRENT_DATE(), ?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1");
    $st->execute([$src, $type]);
    if ($path !== '') {
        $db->exec("CREATE TABLE IF NOT EXISTS pages_daily (day DATE NOT NULL, path VARCHAR(160) NOT NULL, views INT UNSIGNED NOT NULL DEFAULT 0, outs INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (day, path)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $db->prepare("INSERT INTO pages_daily (day, path, views) VALUES (CURRENT_DATE(), ?, 1) ON DUPLICATE KEY UPDATE views = views + 1")->execute([$path]);
    }
} catch (Throwable $e) { /* Zählung darf die Seite nie stören */ }
http_response_code(204);
