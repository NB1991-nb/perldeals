<?php
declare(strict_types=1);
/*
 * Ankauf-Anfrage mit Fotos (Formular auf /reseller/karten-ankauf/ und den Ankauf-Unterseiten).
 * POST multipart/form-data: name, email, phone?, kategorie, beschreibung, plz?, consent, website (Honeypot), fotos[] (max. 6 Bilder, je ≤ 8 MB)
 * Sendet die Anfrage mit den Fotos als Anhang an kontakt@perldeals.com (Antwort-an = Absender). Es wird nichts gespeichert.
 */
require __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/mailer.php';

pd_method('POST');
pd_same_origin();
$back = '/reseller/karten-ankauf/';
$fail = function (string $why) use ($back) { header('Location: ' . $back . '?fehler=' . rawurlencode($why) . '#ankauf-formular', true, 303); exit; };

if (trim((string)($_POST['website'] ?? '')) !== '') { header('Location: /reseller/ankauf/danke/', true, 303); exit; } // Bot
if (!pd_rate('ankauf|' . pd_ip_key(), 4, 3600) || !pd_rate('ankauf-day|' . pd_ip_key(), 12, 86400) || !pd_rate('ankauf-all', 200, 86400)) $fail('limit');

$clip = fn(string $k, int $n) => mb_substr(trim(str_replace(["\r\n", "\r"], "\n", (string)($_POST[$k] ?? ''))), 0, $n);
$name = $clip('name', 80); $email = pd_email($_POST['email'] ?? null); $phone = preg_replace('/[^0-9+ \/()-]/', '', $clip('phone', 40));
$cats = ['Pokémon-Karten','Yu-Gi-Oh-Karten','One-Piece-Karten','Andere Sammelkarten','Retro-Konsolen','Videospiele','LEGO','Sonstiges'];
$cat = in_array($_POST['kategorie'] ?? '', $cats, true) ? $_POST['kategorie'] : 'Sonstiges';
$desc = $clip('beschreibung', 3000); $plz = preg_replace('/[^0-9A-Za-z -]/', '', $clip('plz', 12));
if ($name === '' || !$email || mb_strlen($desc) < 10) $fail('felder');
if (($_POST['consent'] ?? '') !== '1') $fail('consent');

$att = []; $total = 0;
$files = $_FILES['fotos'] ?? null;
if ($files && is_array($files['name'])) {
    $fi = new finfo(FILEINFO_MIME_TYPE);
    $ok = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/heic' => 'heic', 'image/heif' => 'heif'];
    for ($i = 0, $n = count($files['name']); $i < $n && count($att) < 6; $i++) {
        if (($files['error'][$i] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) continue;
        if ($files['error'][$i] !== UPLOAD_ERR_OK || !is_uploaded_file($files['tmp_name'][$i])) $fail('foto');
        $size = (int)$files['size'][$i]; if ($size <= 0 || $size > 8 * 1024 * 1024) $fail('foto-gross');
        $total += $size; if ($total > 25 * 1024 * 1024) $fail('foto-gross');
        $mime = $fi->file($files['tmp_name'][$i]);
        if (!isset($ok[$mime])) $fail('foto-typ');
        if (in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) && @getimagesize($files['tmp_name'][$i]) === false) $fail('foto-typ');
        $att[] = ['name' => 'foto-' . (count($att) + 1) . '.' . $ok[$mime], 'type' => $mime, 'data' => file_get_contents($files['tmp_name'][$i])];
    }
}

$lines = ["Neue Ankauf-Anfrage über perldeals.com", "", "Kategorie: $cat", "Name: $name", "E-Mail: $email", "Telefon/WhatsApp: " . ($phone ?: '-'), "PLZ/Ort: " . ($plz ?: '-'), "Fotos: " . count($att), "", "Beschreibung:", $desc, "", "Zeit: " . gmdate('d.m.Y H:i') . " UTC", "Einwilligung Datenschutz: ja"];
$text = implode("\n", $lines);
$html = '<pre style="font:14px/1.5 monospace;white-space:pre-wrap">' . pd_e($text) . '</pre>';
try {
    $m = PdMailer::fromConfig();
    $m->send(PD_FROM, "Ankauf-Anfrage: $cat (" . count($att) . " Fotos)", $text, $html, ['Reply-To' => $email], $att);
    $m->close();
} catch (Throwable $e) {
    error_log('ankauf mail: ' . $e->getMessage());
    $fail('mail');
}
header('Location: /reseller/ankauf/danke/', true, 303);
exit;
