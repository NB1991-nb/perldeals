<?php
declare(strict_types=1);

/*
 * perldeals API bootstrap: configuration, database, sessions, security helpers.
 * The configuration file lives OUTSIDE the web root (../private/perldeals-config.json)
 * and is written by the deployment from GitHub secrets.
 */

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

const PD_SITE = 'https://perldeals.com';
const PD_FROM = 'kontakt@perldeals.com';
const PD_SESSION_COOKIE = '__Host-pd_session';
const PD_SESSION_DAYS = 30;
const PD_LOGIN_MINUTES = 30;
const PD_MAX_ALERTS = 25;

function pd_webroot(): string { return dirname(__DIR__, 2); }

function pd_config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    // Written by the deployment; the folder is blocked for web access and the file is PHP, so it never prints its contents.
    $file = pd_webroot() . '/private/perldeals-config.php';
    if (!is_file($file)) { pd_fail(503, 'not_configured'); }
    $cfg = require $file;
    if (!is_array($cfg) || empty($cfg['db_host'])) { pd_fail(503, 'not_configured'); }
    return $cfg;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = pd_config();
    $pdo = new PDO(
        'mysql:host=' . $c['db_host'] . ';dbname=' . $c['db_name'] . ';charset=utf8mb4',
        $c['db_user'], $c['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
    );
    $pdo->exec("SET time_zone = '+00:00'");
    pd_migrate($pdo);
    return $pdo;
}

function pd_migrate(PDO $pdo): void {
    try {
        $v = $pdo->query("SELECT v FROM settings WHERE k = 'schema'")->fetchColumn();
        if ((string)$v === '1') return;
    } catch (PDOException $e) { /* first run */ }
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (k VARCHAR(40) PRIMARY KEY, v TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(254) NOT NULL UNIQUE,
        lang CHAR(2) NOT NULL DEFAULT 'de',
        verified_at DATETIME NULL,
        created_at DATETIME NOT NULL,
        alerts_enabled TINYINT(1) NOT NULL DEFAULT 1,
        alert_frequency VARCHAR(10) NOT NULL DEFAULT 'instant',
        newsletter TINYINT(1) NOT NULL DEFAULT 0,
        newsletter_consent_at DATETIME NULL,
        last_digest_at DATETIME NULL,
        last_newsletter_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS login_tokens (
        token_hash CHAR(64) PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        INDEX (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS sessions (
        id_hash CHAR(64) PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        csrf CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        INDEX (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS alerts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        keyword VARCHAR(80) NOT NULL,
        cat VARCHAR(20) NULL,
        max_price DECIMAL(10,2) NULL,
        created_at DATETIME NOT NULL,
        INDEX (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS alert_hits (
        alert_id INT UNSIGNED NOT NULL,
        deal_id VARCHAR(100) NOT NULL,
        queued_at DATETIME NOT NULL,
        sent_at DATETIME NULL,
        PRIMARY KEY (alert_id, deal_id),
        FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS rate_limits (k CHAR(64) PRIMARY KEY, window_start INT UNSIGNED NOT NULL, cnt INT UNSIGNED NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS consent_log (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NULL,
        email_hash CHAR(64) NOT NULL,
        kind VARCHAR(30) NOT NULL,
        value TINYINT(1) NOT NULL,
        source VARCHAR(30) NOT NULL,
        at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("INSERT INTO settings (k, v) VALUES ('schema', '1') ON DUPLICATE KEY UPDATE v = '1'");
}

function pd_secret(): string {
    static $s = null;
    if ($s !== null) return $s;
    $pdo = db();
    $s = $pdo->query("SELECT v FROM settings WHERE k = 'app_secret'")->fetchColumn();
    if (!$s) {
        $s = bin2hex(random_bytes(32));
        $pdo->prepare("INSERT IGNORE INTO settings (k, v) VALUES ('app_secret', ?)")->execute([$s]);
        $s = $pdo->query("SELECT v FROM settings WHERE k = 'app_secret'")->fetchColumn();
    }
    return (string)$s;
}

function now_utc(): string { return gmdate('Y-m-d H:i:s'); }
function pd_hash(string $v): string { return hash('sha256', $v); }
function pd_hmac(string $v): string { return hash_hmac('sha256', $v, pd_secret()); }
function b64url(string $b): string { return rtrim(strtr(base64_encode($b), '+/', '-_'), '='); }

/* ---------- HTTP helpers ---------- */

function pd_headers_api(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}

function pd_fail(int $code, string $error): never {
    if (!headers_sent()) { http_response_code($code); pd_headers_api(); }
    echo json_encode(['ok' => false, 'error' => $error]);
    exit;
}

function pd_json(array $data, int $code = 200): never {
    http_response_code($code);
    pd_headers_api();
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function pd_method(string ...$allowed): string {
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($m, $allowed, true)) pd_fail(405, 'method_not_allowed');
    return $m;
}

/* Reject cross-site requests for state-changing calls (in addition to SameSite cookies and CSRF tokens). */
function pd_same_origin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && $origin !== PD_SITE) pd_fail(403, 'bad_origin');
    $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($site !== '' && !in_array($site, ['same-origin', 'none'], true)) pd_fail(403, 'bad_origin');
}

function pd_body(): array {
    $raw = file_get_contents('php://input', false, null, 0, 8192);
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) pd_fail(400, 'bad_json');
    return $data;
}

function pd_ip_key(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    // IPv6: auf das /64-Netz kürzen, sonst lassen sich Limits mit wechselnden Adressen umgehen
    if (str_contains($ip, ':')) { $bin = @inet_pton($ip); if ($bin !== false && strlen($bin) === 16) $ip = inet_ntop(substr($bin, 0, 8) . str_repeat("\0", 8)) . '/64'; }
    return pd_hmac('ip|' . $ip);
}

/** Fixed-window rate limit. Returns false when exceeded. */
function pd_rate(string $bucket, int $max, int $windowSeconds): bool {
    $pdo = db();
    $k = pd_hash($bucket);
    $now = time();
    $win = $now - ($now % $windowSeconds);
    $pdo->prepare("INSERT INTO rate_limits (k, window_start, cnt) VALUES (?, ?, 1)
                   ON DUPLICATE KEY UPDATE cnt = IF(window_start = VALUES(window_start), cnt + 1, 1), window_start = VALUES(window_start)")
        ->execute([$k, $win]);
    $st = $pdo->prepare("SELECT cnt FROM rate_limits WHERE k = ?");
    $st->execute([$k]);
    return (int)$st->fetchColumn() <= $max;
}

/* ---------- validation ---------- */

function pd_email(?string $e): ?string {
    $e = strtolower(trim((string)$e));
    if ($e === '' || strlen($e) > 254 || preg_match('/[\r\n]/', $e)) return null;
    return filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : null;
}

function pd_lang(?string $l): string { return $l === 'en' ? 'en' : 'de'; }

const PD_RS_TOPICS = ['pokemon', 'onepiece', 'lego', 'konsolen', 'top', 'netzwerk'];

/* Reseller-Deal-Alarm: one row per user (topics, filters); hits are queued per user and item. */
function pd_reseller_tables(): void {
    static $done = false;
    if ($done) return;
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS reseller_alerts (
        user_id INT UNSIGNED PRIMARY KEY,
        topics VARCHAR(120) NOT NULL,
        min_discount TINYINT UNSIGNED NOT NULL DEFAULT 0,
        min_margin DECIMAL(10,2) NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS reseller_hits (
        user_id INT UNSIGNED NOT NULL,
        item_id VARCHAR(100) NOT NULL,
        queued_at DATETIME NOT NULL,
        sent_at DATETIME NULL,
        PRIMARY KEY (user_id, item_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $done = true;
}

/** "t=pokemon,lego;d=30;m=20" <-> array */
function pd_rs_pack(array $topics, int $minDisc, ?float $minMargin): string {
    return 't=' . implode(',', $topics) . ';d=' . $minDisc . ';m=' . ($minMargin === null ? '' : (string)$minMargin);
}
function pd_rs_unpack(string $s): array {
    $o = ['topics' => [], 'min_discount' => 0, 'min_margin' => null];
    foreach (explode(';', $s) as $part) {
        [$k, $v] = array_pad(explode('=', $part, 2), 2, '');
        if ($k === 't') $o['topics'] = array_values(array_intersect(PD_RS_TOPICS, explode(',', $v)));
        if ($k === 'd') $o['min_discount'] = max(0, min(90, (int)$v));
        if ($k === 'm' && $v !== '') $o['min_margin'] = (float)$v;
    }
    return $o;
}

/* Gutschein-Alarm (seit 05.11.2026): eine Zeile je Nutzer mit Shop-Liste ("all" = alle Shops); Treffer je Nutzer und Gutschein. */
function pd_code_tables(): void {
    static $done = false;
    if ($done) return;
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS code_alerts (
        user_id INT UNSIGNED PRIMARY KEY,
        shops VARCHAR(1000) NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS code_hits (
        user_id INT UNSIGNED NOT NULL,
        item_id VARCHAR(120) NOT NULL,
        queued_at DATETIME NOT NULL,
        sent_at DATETIME NULL,
        PRIMARY KEY (user_id, item_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $done = true;
}
function pd_code_shops(array $in): array {
    $out = [];
    foreach ($in as $k) { $k = strtolower((string)$k); if (preg_match('/^[a-z0-9]{2,30}$/', $k)) $out[] = $k; }
    $out = array_values(array_unique($out));
    if (in_array('all', $out, true)) return ['all'];
    return array_slice($out, 0, 40);
}

const PD_CATS = ['phone', 'watch', 'headphones', 'speaker', 'tv', 'computer', 'smarthome', 'kitchen', 'home', 'tools', 'garden', 'sport', 'toys', 'vegan', 'b2b'];

/* ---------- sessions ---------- */

function pd_set_session_cookie(string $value, int $expires): void {
    setcookie(PD_SESSION_COOKIE, $value, [
        'expires' => $expires, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function pd_create_session(int $userId): array {
    $raw = b64url(random_bytes(32));
    $csrf = bin2hex(random_bytes(32));
    $exp = time() + PD_SESSION_DAYS * 86400;
    db()->prepare("INSERT INTO sessions (id_hash, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)")
        ->execute([pd_hash($raw), $userId, $csrf, gmdate('Y-m-d H:i:s', $exp)]);
    pd_set_session_cookie($raw, $exp);
    return ['csrf' => $csrf];
}

function pd_session(): ?array {
    $raw = $_COOKIE[PD_SESSION_COOKIE] ?? '';
    if (!is_string($raw) || $raw === '' || strlen($raw) > 100) return null;
    $st = db()->prepare("SELECT s.id_hash, s.csrf, u.* FROM sessions s JOIN users u ON u.id = s.user_id
                         WHERE s.id_hash = ? AND s.expires_at > UTC_TIMESTAMP()");
    $st->execute([pd_hash($raw)]);
    $row = $st->fetch();
    return $row ?: null;
}

function pd_require_session(bool $checkCsrf = true): array {
    $s = pd_session();
    if (!$s) pd_fail(401, 'not_logged_in');
    if ($checkCsrf) {
        pd_same_origin();
        $t = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($t) || !hash_equals($s['csrf'], $t)) pd_fail(403, 'bad_csrf');
    }
    return $s;
}

/* ---------- unsubscribe links (signed, no login needed) ---------- */

function pd_unsub_token(int $userId, string $type): string {
    $payload = $userId . '.' . $type;
    return $payload . '.' . substr(pd_hmac('unsub|' . $payload), 0, 32);
}

function pd_unsub_parse(string $t): ?array {
    if (!preg_match('/^(\d{1,10})\.(alerts|newsletter|reseller|codes|all)\.([a-f0-9]{32})$/', $t, $m)) return null;
    $expected = substr(pd_hmac('unsub|' . $m[1] . '.' . $m[2]), 0, 32);
    if (!hash_equals($expected, $m[3])) return null;
    return ['user_id' => (int)$m[1], 'type' => $m[2]];
}

function pd_log_consent(?int $userId, string $email, string $kind, bool $value, string $source): void {
    db()->prepare("INSERT INTO consent_log (user_id, email_hash, kind, value, source, at) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$userId, pd_hash($email), $kind, $value ? 1 : 0, $source, now_utc()]);
}

require_once __DIR__ . '/mailer.php';
