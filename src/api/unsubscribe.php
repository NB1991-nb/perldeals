<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

/*
 * One-click unsubscribe without login.
 * GET  -> confirmation page with a button (mail scanners only send GET, so nothing changes yet)
 * POST -> unsubscribes (also handles RFC 8058 "List-Unsubscribe=One-Click" from mail clients)
 */

$method = pd_method('GET', 'POST');
$t = (string)($_GET['t'] ?? '');
$info = pd_unsub_parse($t);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$pdo = $info ? db() : null;
$user = null;
if ($info) {
    $st = $pdo->prepare("SELECT id, email, lang FROM users WHERE id = ?");
    $st->execute([$info['user_id']]);
    $user = $st->fetch() ?: null;
}
$lang = $user['lang'] ?? (str_starts_with((string)($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''), 'en') ? 'en' : 'de');
$L = $lang === 'en'
    ? ['title' => 'Unsubscribe', 'alerts' => 'price alert emails', 'newsletter' => 'the daily deals newsletter', 'reseller' => 'the reseller deal alarm', 'codes' => 'the voucher alert', 'all' => 'all emails from perldeals',
       'ask' => 'Do you want to stop receiving %s?', 'btn' => 'Unsubscribe', 'done' => 'Done. You will no longer receive %s.',
       'bad' => 'This link is invalid or the account no longer exists.', 'acc' => 'Manage all email settings in your account', 'home' => 'Back to perldeals']
    : ['title' => 'Abmelden', 'alerts' => 'Preisalarm-E-Mails', 'newsletter' => 'den täglichen Deal-Newsletter', 'reseller' => 'den Reseller-Deal-Alarm', 'codes' => 'den Gutschein-Alarm', 'all' => 'alle E-Mails von perldeals',
       'ask' => 'Möchtest du %s abbestellen?', 'btn' => 'Abbestellen', 'done' => 'Erledigt. Du erhältst keine %s mehr.',
       'bad' => 'Dieser Link ist ungültig oder das Konto existiert nicht mehr.', 'acc' => 'Alle E-Mail-Einstellungen in deinem Konto verwalten', 'home' => 'Zurück zu perldeals'];

$msg = '';
$form = '';
if (!$info || !$user) {
    http_response_code($info ? 200 : 400);
    $msg = $L['bad'];
} else {
    $what = $L[$info['type']];
    if ($method === 'POST') {
        $map = ['alerts' => 'alerts_enabled = 0', 'newsletter' => 'newsletter = 0, newsletter_consent_at = NULL', 'all' => 'alerts_enabled = 0, newsletter = 0, newsletter_consent_at = NULL'];
        if ($info['type'] === 'reseller' || $info['type'] === 'all') { pd_reseller_tables(); $pdo->prepare('DELETE FROM reseller_alerts WHERE user_id = ?')->execute([$user['id']]); }
        if ($info['type'] === 'codes' || $info['type'] === 'all') { pd_code_tables(); $pdo->prepare('DELETE FROM code_alerts WHERE user_id = ?')->execute([$user['id']]); }
        if ($info['type'] !== 'reseller' && $info['type'] !== 'codes') $pdo->prepare('UPDATE users SET ' . $map[$info['type']] . ' WHERE id = ?')->execute([$user['id']]);
        pd_log_consent((int)$user['id'], $user['email'], 'unsubscribe_' . $info['type'], false, 'link');
        if ($lang === 'de' && $info['type'] === 'newsletter') $what = 'Deal-Newsletter';
        if ($lang === 'de' && $info['type'] === 'all') $what = 'E-Mails von perldeals';
        if ($lang === 'de' && $info['type'] === 'reseller') $what = 'Reseller-Alarm-E-Mails';
        if ($lang === 'de' && $info['type'] === 'codes') $what = 'Gutschein-Alarm-E-Mails';
        $msg = sprintf($L['done'], $what);
    } else {
        $msg = sprintf($L['ask'], $what);
        $form = '<form method="post" action="/api/unsubscribe.php?t=' . pd_e($t) . '"><button class="btn btn-primary" type="submit">' . pd_e($L['btn']) . '</button></form>';
    }
}
$acc = pd_account_url($lang);
?><!doctype html>
<html lang="<?= $lang ?>"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title><?= pd_e($L['title']) ?> · perldeals</title><link rel="stylesheet" href="/assets/style.css"><script src="/assets/theme.js"></script></head>
<body><main class="wrap legal"><div class="eyebrow">perldeals</div><h1><?= pd_e($L['title']) ?></h1>
<p><?= pd_e($msg) ?></p><?= $form ?>
<p><a href="<?= pd_e($acc) ?>"><?= pd_e($L['acc']) ?></a> · <a href="/"><?= pd_e($L['home']) ?></a></p></main></body></html>
