<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

$method = pd_method('GET', 'POST');

if ($method === 'GET') {
    $s = pd_session();
    if (!$s) pd_fail(401, 'not_logged_in');
    $st = db()->prepare("SELECT id, keyword, cat, max_price, created_at FROM alerts WHERE user_id = ? ORDER BY created_at DESC");
    $st->execute([$s['id']]);
    pd_json([
        'email' => $s['email'],
        'lang' => $s['lang'],
        'csrf' => $s['csrf'],
        'prefs' => [
            'alerts_enabled' => (bool)$s['alerts_enabled'],
            'alert_frequency' => $s['alert_frequency'],
            'newsletter' => (bool)$s['newsletter'],
        ],
        'alerts' => array_map(fn($a) => [
            'id' => (int)$a['id'], 'keyword' => $a['keyword'], 'cat' => $a['cat'],
            'max_price' => $a['max_price'] !== null ? (float)$a['max_price'] : null, 'created_at' => $a['created_at'],
        ], $st->fetchAll()),
    ]);
}

$s = pd_require_session();
$in = pd_body();
$action = $_GET['action'] ?? '';
$pdo = db();

if ($action === 'prefs') {
    $alertsEnabled = !empty($in['alerts_enabled']);
    $freq = ($in['alert_frequency'] ?? '') === 'daily' ? 'daily' : 'instant';
    $newsletter = !empty($in['newsletter']);
    $lang = pd_lang($in['lang'] ?? $s['lang']);
    // consent_at zuerst setzen: MySQL wertet SET-Zuweisungen von links nach rechts aus
    $pdo->prepare("UPDATE users SET newsletter_consent_at = IF(? = 1 AND newsletter = 0, ?, IF(? = 0, NULL, newsletter_consent_at)),
                   alerts_enabled = ?, alert_frequency = ?, newsletter = ?, lang = ? WHERE id = ?")
        ->execute([$newsletter ? 1 : 0, now_utc(), $newsletter ? 1 : 0, $alertsEnabled ? 1 : 0, $freq, $newsletter ? 1 : 0, $lang, $s['id']]);
    if ((bool)$s['newsletter'] !== $newsletter) pd_log_consent((int)$s['id'], $s['email'], 'newsletter', $newsletter, 'account');
    if ((bool)$s['alerts_enabled'] !== $alertsEnabled) pd_log_consent((int)$s['id'], $s['email'], 'alerts', $alertsEnabled, 'account');
    pd_json([]);
}

if ($action === 'delete') {
    pd_log_consent(null, $s['email'], 'account_deleted', false, 'account');
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$s['id']]);
    pd_set_session_cookie('', time() - 3600);
    pd_json([]);
}

pd_fail(404, 'unknown_action');
