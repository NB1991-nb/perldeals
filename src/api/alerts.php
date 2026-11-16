<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

pd_method('POST');
$s = pd_require_session();
$in = pd_body();
$action = $_GET['action'] ?? '';
$pdo = db();

if ($action === 'create') {
    $kw = trim(preg_replace('/\s+/u', ' ', (string)($in['keyword'] ?? '')));
    $kw = mb_substr(strip_tags($kw), 0, 80);
    $cat = in_array($in['cat'] ?? null, PD_CATS, true) ? $in['cat'] : null;
    $max = null;
    if (isset($in['max_price']) && $in['max_price'] !== '' && $in['max_price'] !== null) {
        $max = round((float)str_replace(',', '.', (string)$in['max_price']), 2);
        if ($max <= 0 || $max > 100000) pd_fail(422, 'invalid_price');
    }
    if (mb_strlen($kw) < 2 && $cat === null) pd_fail(422, 'keyword_required');
    if (!pd_rate('alert-create|' . $s['id'], 30, 3600)) pd_fail(429, 'too_many_requests');
    $st = $pdo->prepare("SELECT COUNT(*) FROM alerts WHERE user_id = ?");
    $st->execute([$s['id']]);
    if ((int)$st->fetchColumn() >= PD_MAX_ALERTS) pd_fail(422, 'too_many_alerts');
    $pdo->prepare("INSERT INTO alerts (user_id, keyword, cat, max_price, created_at) VALUES (?, ?, ?, ?, ?)")
        ->execute([$s['id'], $kw, $cat, $max, now_utc()]);
    pd_json(['id' => (int)$pdo->lastInsertId()], 201);
}

if ($action === 'delete') {
    $id = (int)($in['id'] ?? 0);
    $pdo->prepare("DELETE FROM alerts WHERE id = ? AND user_id = ?")->execute([$id, $s['id']]);
    pd_json([]);
}

pd_fail(404, 'unknown_action');
