<?php
declare(strict_types=1);
/*
 * eBay OAuth Accept-/Decline-Seite fuer das API-Keyset "BHG Buchhaltung" (Nico 22.11.2026).
 * Zeigt nach der Einwilligung den einmaligen Autorisierungscode an (gueltig ca. 5 Minuten),
 * damit er gegen ein Token getauscht werden kann. Es wird nichts gespeichert.
 */
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
header('Referrer-Policy: no-referrer');
header('Content-Type: text/html; charset=utf-8');
$code = (string)($_GET['code'] ?? '');
$state = (string)($_GET['state'] ?? '');
$ok = $code !== '' && strlen($code) < 2000 && preg_match('/^bhg-[A-Za-z0-9]{8,40}$/', $state);
echo '<!doctype html><meta name="robots" content="noindex"><title>eBay-Verbindung</title><body style="font-family:sans-serif;max-width:720px;margin:40px auto">';
if ($ok) {
    echo '<h1>eBay-Verbindung bestaetigt</h1><p>Autorisierungscode:</p><pre id="code" style="white-space:pre-wrap;word-break:break-all">' . htmlspecialchars($code) . '</pre><p>State: <span id="state">' . htmlspecialchars($state) . '</span></p>';
} else {
    echo '<h1>eBay-Verbindung nicht erteilt</h1><p>Es wurde kein gueltiger Code uebergeben.</p>';
}
echo '</body>';
