<?php
declare(strict_types=1);
/*
 * Kurzbewerbung (Formular auf /karriere/). Lebenslauf ist NIE Pflicht, kann aber angehängt werden.
 * POST multipart/form-data: stelle, name, email?, phone?, nachricht, consent, website (Honeypot), lebenslauf (optional, 1 Datei, max. 10 MB: PDF, DOC, DOCX, JPG, PNG, HEIC)
 * Mindestens E-Mail ODER Telefon. Sendet die Bewerbung an kontakt@perldeals.com (Antwort-an = Bewerber, falls E-Mail). Es wird nichts gespeichert.
 */
require __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/mailer.php';

pd_method('POST');
pd_same_origin();
$back = '/karriere/';
$fail = function (string $why) use ($back) { header('Location: ' . $back . '?fehler=' . rawurlencode($why) . '#bewerben', true, 303); exit; };
if (trim((string)($_POST['website'] ?? '')) !== '') { header('Location: /karriere/danke/', true, 303); exit; } // Bot
if (!pd_rate('bewerbung|' . pd_ip_key(), 4, 3600) || !pd_rate('bewerbung-day|' . pd_ip_key(), 10, 86400) || !pd_rate('bewerbung-all', 150, 86400)) $fail('limit');

$clip = fn(string $k, int $n) => mb_substr(trim(str_replace(["\r\n", "\r"], "\n", (string)($_POST[$k] ?? ''))), 0, $n);
$stellen = ['Aushilfe Versand & eBay-Listings (Hagen a.T.W.)', 'Einkäufer für Sammlerware & Technik', 'Initiativbewerbung'];
$stelle = in_array($_POST['stelle'] ?? '', $stellen, true) ? $_POST['stelle'] : $stellen[0];
$name = $clip('name', 80);
$email = pd_email($_POST['email'] ?? null);
$phone = preg_replace('/[^0-9+ \/()-]/', '', $clip('phone', 40));
$msg = $clip('nachricht', 2000);
if ($name === '' || (!$email && strlen(preg_replace('/\D/', '', $phone)) < 6)) $fail('kontakt');
if (mb_strlen($msg) < 5) $fail('felder');
if (($_POST['consent'] ?? '') !== '1') $fail('consent');

$att = [];
$f = $_FILES['lebenslauf'] ?? null;
if ($f && is_array($f) && !is_array($f['name']) && ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) $fail('datei');
    $size = (int)$f['size']; if ($size <= 0 || $size > 10 * 1024 * 1024) $fail('datei-gross');
    $ok = ['application/pdf' => 'pdf', 'application/msword' => 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
           'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/heic' => 'heic', 'image/heif' => 'heif'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if ($mime === 'application/zip' && preg_match('/\.docx$/i', (string)$f['name'])) $mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!isset($ok[$mime])) $fail('datei-typ');
    if (in_array($mime, ['image/jpeg', 'image/png'], true) && @getimagesize($f['tmp_name']) === false) $fail('datei-typ');
    $att[] = ['name' => 'lebenslauf.' . $ok[$mime], 'type' => $mime, 'data' => file_get_contents($f['tmp_name'])];
}

$lines = ["Neue Bewerbung über perldeals.com/karriere", "", "Stelle: $stelle", "Name: $name", "E-Mail: " . ($email ?: '-'), "Telefon/WhatsApp: " . ($phone ?: '-'),
    "Lebenslauf: " . ($att ? 'ja (Anhang)' : 'nein'), "", "Nachricht:", $msg, "", "Zeit: " . gmdate('d.m.Y H:i') . " UTC", "Einwilligung Datenschutz: ja"];
$text = implode("\n", $lines);
$html = '<pre style="font:14px/1.5 monospace;white-space:pre-wrap">' . pd_e($text) . '</pre>';
try {
    $m = PdMailer::fromConfig();
    $m->send(PD_FROM, "Bewerbung: $name – $stelle", $text, $html, $email ? ['Reply-To' => $email] : [], $att);
    $m->close();
} catch (Throwable $e) {
    error_log('bewerbung mail: ' . $e->getMessage());
    $fail('mail');
}
header('Location: /karriere/danke/', true, 303);
exit;
