<?php
declare(strict_types=1);
/*
 * eBay-API-Anbindung fuer die Buchhaltung (Keyset "BHG Buchhaltung", Nico 22.11.2026).
 * Zugangsdaten und Tokens liegen nur im geschuetzten Ordner private/ auf dem Server,
 * nie im Repository. Ins Repo kommt nur der SHA-256-Hash des Zugriffsschluessels.
 */
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

const EB_KEY_HASH = 'e5a439fa4b45c4d14802e645349b442ac181f35bf3bbdd1128d36d4edd890ef9';
const EB_SCOPES = 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly https://api.ebay.com/oauth/api_scope/sell.finances https://api.ebay.com/oauth/api_scope/sell.account.readonly';

function eb_dir(): string {
    $d = dirname(__DIR__, 2) . '/private/ebay';
    if (!is_dir($d)) { @mkdir($d, 0700, true); }
    return $d;
}
function eb_read(string $name): ?array {
    $f = eb_dir() . '/' . $name . '.php';
    if (!is_file($f)) return null;
    $v = require $f;
    return is_array($v) ? $v : null;
}
function eb_write(string $name, array $data): void {
    $f = eb_dir() . '/' . $name . '.php';
    $php = "<?php\nreturn json_decode(base64_decode('" . base64_encode(json_encode($data)) . "'), true);\n";
    file_put_contents($f . '.tmp', $php, LOCK_EX);
    @chmod($f . '.tmp', 0600);
    rename($f . '.tmp', $f);
}
function eb_key_ok(): bool {
    $k = (string)($_SERVER['HTTP_X_EB_KEY'] ?? '');
    return $k !== '' && hash_equals(EB_KEY_HASH, hash('sha256', $k));
}
function eb_json(int $status, $data): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    echo is_string($data) ? $data : json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function eb_http(string $method, string $url, array $headers, ?string $body = null): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if ($body !== null) { curl_setopt($ch, CURLOPT_POSTFIELDS, $body); }
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [$code, $res === false ? json_encode(['curl_error' => $err]) : (string)$res];
}
function eb_token_request(array $form): array {
    $c = eb_read('config');
    if (!$c) return [503, '{"error":"not_configured"}'];
    return eb_http('POST', 'https://api.ebay.com/identity/v1/oauth2/token', [
        'Content-Type: application/x-www-form-urlencoded',
        'Authorization: Basic ' . base64_encode($c['client_id'] . ':' . $c['cert_id']),
    ], http_build_query($form));
}
/* Tauscht den Autorisierungscode gegen Tokens und speichert sie. */
function eb_exchange_code(string $code): array {
    $c = eb_read('config');
    if (!$c) return [false, 'not_configured'];
    [$st, $body] = eb_token_request(['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $c['runame']]);
    $j = json_decode($body, true);
    if ($st !== 200 || empty($j['refresh_token'])) return [false, 'token_exchange_failed (' . $st . '): ' . substr((string)($j['error_description'] ?? $j['error'] ?? $body), 0, 200)];
    eb_write('token', [
        'access_token' => $j['access_token'],
        'access_expires' => time() + (int)$j['expires_in'] - 120,
        'refresh_token' => $j['refresh_token'],
        'refresh_expires' => time() + (int)($j['refresh_token_expires_in'] ?? 0),
        'connected_at' => date('c'),
    ]);
    return [true, 'ok'];
}
function eb_access_token(): ?string {
    $t = eb_read('token');
    if (!$t) return null;
    if (time() < (int)$t['access_expires']) return $t['access_token'];
    [$st, $body] = eb_token_request(['grant_type' => 'refresh_token', 'refresh_token' => $t['refresh_token'], 'scope' => EB_SCOPES]);
    $j = json_decode($body, true);
    if ($st !== 200 || empty($j['access_token'])) return null;
    $t['access_token'] = $j['access_token'];
    $t['access_expires'] = time() + (int)$j['expires_in'] - 120;
    eb_write('token', $t);
    return $t['access_token'];
}
