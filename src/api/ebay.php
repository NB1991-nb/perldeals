<?php
declare(strict_types=1);
/*
 * Geschuetzte eBay-Schnittstelle fuer die Buchhaltung. Jeder Aufruf braucht den Header X-Eb-Key.
 *   POST ?a=setup   Body {client_id, cert_id, runame}  -> speichert die App-Zugangsdaten in private/
 *   GET  ?a=authurl                                     -> Einwilligungs-Link fuer eBay
 *   GET  ?a=status                                      -> verbunden ja/nein (ohne Geheimnisse)
 *   GET  ?a=call&path=/sell/...                         -> nur lesende GET-Aufrufe an erlaubte eBay-Pfade
 */
require __DIR__ . '/lib/ebay.php';

if (!eb_key_ok()) { eb_json(404, ['error' => 'not_found']); }
$a = (string)($_GET['a'] ?? '');

if ($a === 'setup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = json_decode((string)file_get_contents('php://input'), true);
    foreach (['client_id', 'cert_id', 'runame'] as $k) {
        if (!is_array($in) || !is_string($in[$k] ?? null) || !preg_match('/^[A-Za-z0-9_\-]{8,120}$/', $in[$k])) eb_json(400, ['error' => 'bad_' . $k]);
    }
    eb_write('config', ['client_id' => $in['client_id'], 'cert_id' => $in['cert_id'], 'runame' => $in['runame'], 'saved_at' => date('c')]);
    eb_json(200, ['ok' => true]);
}

if ($a === 'authurl') {
    $c = eb_read('config');
    if (!$c) eb_json(503, ['error' => 'not_configured']);
    $state = 'bhg-' . bin2hex(random_bytes(12));
    eb_write('state', ['state' => $state, 'expires' => time() + 1800]);
    eb_json(200, ['url' => 'https://auth.ebay.com/oauth2/authorize?' . http_build_query([
        'client_id' => $c['client_id'], 'response_type' => 'code', 'redirect_uri' => $c['runame'],
        'scope' => EB_SCOPES, 'state' => $state, 'prompt' => 'login',
    ], '', '&', PHP_QUERY_RFC3986)]);
}

if ($a === 'signing_error') { eb_json(200, eb_read('signing_error') ?? []); }

if ($a === 'status') {
    $t = eb_read('token');
    eb_json(200, [
        'configured' => eb_read('config') !== null,
        'connected' => $t !== null,
        'connected_at' => $t['connected_at'] ?? null,
        'refresh_valid_until' => isset($t['refresh_expires']) ? date('c', (int)$t['refresh_expires']) : null,
        'token_works' => $t !== null && eb_access_token() !== null,
    ]);
}

if ($a === 'call' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $path = (string)($_GET['path'] ?? '');
    if (!preg_match('#^/(sell/(fulfillment|finances|account|analytics|marketing|inventory)|commerce/(identity|taxonomy))/v1(_beta)?/[A-Za-z0-9_\-/]*(\?[A-Za-z0-9_\-=&%:.,\[\]{}|+]*)?$#', $path) || str_contains((string)parse_url($path, PHP_URL_PATH), '..')) {
        eb_json(400, ['error' => 'path_not_allowed']);
    }
    $tok = eb_access_token();
    if (!$tok) eb_json(503, ['error' => 'not_connected']);
    $host = (str_starts_with($path, '/sell/finances') || str_starts_with($path, '/commerce/identity')) ? 'https://apiz.ebay.com' : 'https://api.ebay.com';
    $sigHeaders = str_starts_with($path, '/sell/finances') ? eb_signature_headers($tok, 'GET', $host, $path) : [];
    [$st, $body] = eb_http('GET', $host . $path, array_merge($sigHeaders, [
        'Authorization: Bearer ' . $tok,
        'Accept: application/json',
        'X-EBAY-C-MARKETPLACE-ID: EBAY_DE',
        'Accept-Language: de-DE',
    ]));
    eb_json($st ?: 502, $body);
}

eb_json(400, ['error' => 'unknown_action']);
