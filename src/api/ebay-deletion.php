<?php
declare(strict_types=1);
/*
 * eBay Marketplace Account Deletion endpoint (Pflicht fuer eBay-API-Keyset "BHG Buchhaltung", Nico 22.11.2026).
 * GET  ?challenge_code=... -> {"challengeResponse": sha256(challengeCode . verificationToken . endpoint)}
 * POST (Loesch-Benachrichtigung) -> 200; Inhalt wird nur kurz protokolliert, damit Nico die
 *      betroffenen eBay-Nutzer in Lexware/Excel pruefen kann (keine weiteren Daten).
 */
header('Cache-Control: no-store');
const PD_EBAY_ENDPOINT = 'https://perldeals.com/api/ebay-deletion.php';
const PD_EBAY_VTOKEN = '9r8gbKpGvagv0fdtof8AZgcISdb4GN9UgGLWzHRXcmofFGA8BzDYy1qn5Eimn0Ky';

$m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($m === 'GET') {
    $code = (string)($_GET['challenge_code'] ?? '');
    if ($code === '' || strlen($code) > 200) { http_response_code(400); exit; }
    header('Content-Type: application/json');
    echo json_encode(['challengeResponse' => hash('sha256', $code . PD_EBAY_VTOKEN . PD_EBAY_ENDPOINT)]);
    exit;
}
if ($m === 'POST') {
    $raw = (string)file_get_contents('php://input', false, null, 0, 20000);
    $j = json_decode($raw, true);
    $user = is_array($j) ? (string)($j['notification']['data']['username'] ?? '') : '';
    $dir = dirname(__DIR__) . '/private';
    if (is_dir($dir) && $user !== '') {
        @file_put_contents($dir . '/ebay-deletions.log', gmdate('c') . "\t" . preg_replace('/[^A-Za-z0-9._-]/', '', $user) . "\n", FILE_APPEND | LOCK_EX);
    }
    http_response_code(200);
    exit;
}
http_response_code(405);
