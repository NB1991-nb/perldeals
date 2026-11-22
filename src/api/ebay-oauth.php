<?php
declare(strict_types=1);
/*
 * eBay OAuth Accept-/Decline-Seite fuer das API-Keyset "BHG Buchhaltung" (Nico 22.11.2026).
 * Nimmt den Autorisierungscode entgegen, prueft den State und tauscht den Code direkt auf
 * dem Server gegen Tokens (gespeichert im geschuetzten Ordner private/ebay). Angezeigt wird nichts Geheimes.
 */
require __DIR__ . '/lib/ebay.php';
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
header('Referrer-Policy: no-referrer');
header('Content-Type: text/html; charset=utf-8');
$code = (string)($_GET['code'] ?? '');
$state = (string)($_GET['state'] ?? '');
$saved = eb_read('state');
$stateOk = $saved && hash_equals((string)$saved['state'], $state) && time() < (int)$saved['expires'];
$msg = '';
$ok = false;
if ($code === '' || strlen($code) > 2000) {
    $msg = 'eBay hat keinen Code uebergeben (Zugriff abgelehnt oder Seite direkt aufgerufen).';
} elseif (!$stateOk) {
    $msg = 'Der Link ist abgelaufen oder gehoert nicht zu dieser Anfrage. Bitte einen neuen Link anfordern.';
} else {
    [$ok, $info] = eb_exchange_code($code);
    if ($ok) { eb_write('state', ['state' => '', 'expires' => 0]); }
    $msg = $ok ? 'Die Buchhaltung kann jetzt auf eBay zugreifen. Du kannst dieses Fenster schliessen.' : 'Der Code konnte nicht eingetauscht werden: ' . $info;
}
echo '<!doctype html><meta name="robots" content="noindex"><title>eBay-Verbindung</title><body style="font-family:sans-serif;max-width:720px;margin:40px auto">';
echo $ok ? '<h1>eBay-Verbindung hergestellt</h1>' : '<h1>eBay-Verbindung nicht erteilt</h1>';
echo '<p>' . htmlspecialchars($msg) . '</p></body>';
