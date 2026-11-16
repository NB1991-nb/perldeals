<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

pd_method('POST');
pd_same_origin();
$action = $_GET['action'] ?? '';
$in = pd_body();

if ($action === 'request') {
    // Honeypot: bots fill hidden fields. Pretend success.
    if (!empty($in['website'])) pd_json(['sent' => true]);

    $email = pd_email($in['email'] ?? null);
    $lang = pd_lang($in['lang'] ?? 'de');
    if (!$email) pd_fail(422, 'invalid_email');

    if (!pd_rate('login-ip|' . pd_ip_key(), 8, 900) || !pd_rate('login-mail|' . $email, 3, 900)) {
        pd_fail(429, 'too_many_requests');
    }

    $pdo = db();
    $st = $pdo->prepare("SELECT id, lang FROM users WHERE email = ?");
    $st->execute([$email]);
    $user = $st->fetch();
    if (!$user) {
        $pdo->prepare("INSERT INTO users (email, lang, created_at) VALUES (?, ?, ?)")->execute([$email, $lang, now_utc()]);
        $userId = (int)$pdo->lastInsertId();
    } else {
        $userId = (int)$user['id'];
    }

    $raw = b64url(random_bytes(32));
    $pdo->prepare("INSERT INTO login_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
        ->execute([pd_hash($raw), $userId, gmdate('Y-m-d H:i:s', time() + PD_LOGIN_MINUTES * 60)]);
    $pdo->exec("DELETE FROM login_tokens WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY");

    $link = pd_account_url($lang) . '#login=' . $raw;
    if ($lang === 'en') {
        $subject = 'Your sign-in link for perldeals';
        $text = "Hi,\n\nclick this link to sign in to perldeals. It is valid for " . PD_LOGIN_MINUTES . " minutes and works once:\n$link\n\nIf you did not request this, simply ignore this email. No account will be activated.\n";
        $inner = '<p>Hi,</p><p>click the button to sign in to perldeals. The link is valid for ' . PD_LOGIN_MINUTES . ' minutes and works once.</p>'
            . pd_btn($link, 'Sign in') . '<p style="color:#55645F;font-size:13px">If you did not request this, simply ignore this email. No account will be activated.</p>';
    } else {
        $subject = 'Dein Anmeldelink für perldeals';
        $text = "Hallo,\n\nmit diesem Link meldest du dich bei perldeals an. Er gilt " . PD_LOGIN_MINUTES . " Minuten und funktioniert einmal:\n$link\n\nDu hast das nicht angefordert? Dann ignoriere diese E-Mail einfach. Es wird kein Konto aktiviert.\n";
        $inner = '<p>Hallo,</p><p>mit dem Button meldest du dich bei perldeals an. Der Link gilt ' . PD_LOGIN_MINUTES . ' Minuten und funktioniert einmal.</p>'
            . pd_btn($link, 'Jetzt anmelden') . '<p style="color:#55645F;font-size:13px">Du hast das nicht angefordert? Dann ignoriere diese E-Mail einfach. Es wird kein Konto aktiviert.</p>';
    }
    try {
        $m = PdMailer::fromConfig();
        $m->send($email, $subject, $text, pd_mail_layout($lang, $subject, $inner, [[ 'perldeals.com', PD_SITE ]]));
        $m->close();
    } catch (Throwable $e) {
        error_log('perldeals login mail failed: ' . $e->getMessage());
        pd_fail(502, 'mail_failed');
    }
    // Same answer whether or not the account existed (no account enumeration).
    pd_json(['sent' => true]);
}

if ($action === 'verify') {
    $raw = (string)($in['token'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{40,50}$/', $raw)) pd_fail(400, 'invalid_token');
    if (!pd_rate('verify-ip|' . pd_ip_key(), 20, 900)) pd_fail(429, 'too_many_requests');
    $pdo = db();
    $pdo->beginTransaction();
    $st = $pdo->prepare("SELECT user_id FROM login_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE");
    $st->execute([pd_hash($raw)]);
    $uid = $st->fetchColumn();
    if (!$uid) { $pdo->rollBack(); pd_fail(400, 'invalid_token'); }
    $pdo->prepare("UPDATE login_tokens SET used_at = ? WHERE token_hash = ?")->execute([now_utc(), pd_hash($raw)]);
    $pdo->prepare("UPDATE users SET verified_at = COALESCE(verified_at, ?) WHERE id = ?")->execute([now_utc(), $uid]);
    $pdo->commit();
    $pdo->exec("DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()");
    $s = pd_create_session((int)$uid);
    pd_json(['csrf' => $s['csrf']]);
}

if ($action === 'logout') {
    $s = pd_require_session();
    db()->prepare("DELETE FROM sessions WHERE id_hash = ?")->execute([$s['id_hash']]);
    pd_set_session_cookie('', time() - 3600);
    pd_json([]);
}

pd_fail(404, 'unknown_action');
