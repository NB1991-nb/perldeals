<?php
declare(strict_types=1);
/*
 * Ankauf-Auftrag (Einsendung) – Formular auf /reseller/ankauf/auftrag/ (seit 08.11.2026).
 * POST: name, email, street, city, phone?, kategorie, positionen, preis?, bezug?, agb=1, eigentum=1, website (Honeypot)
 * Erzeugt eine Auftragsnummer, schickt dem Kunden die Auftragsbestätigung (Versandadresse, Begleitzettel, Ablauf)
 * und perldeals eine Kopie (Antwort-an = Kunde). Es wird nichts auf dem Server gespeichert.
 */
require __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/mailer.php';

pd_method('POST');
pd_same_origin();
$back = '/reseller/ankauf/auftrag/';
$fail = function (string $why) use ($back) { header('Location: ' . $back . '?fehler=' . rawurlencode($why) . '#auftrag-formular', true, 303); exit; };

if (trim((string)($_POST['website'] ?? '')) !== '') { header('Location: /reseller/ankauf/auftrag-danke/', true, 303); exit; } // Bot
if (!pd_rate('auftrag|' . pd_ip_key(), 3, 3600) || !pd_rate('auftrag-day|' . pd_ip_key(), 8, 86400) || !pd_rate('auftrag-all', 150, 86400)) $fail('limit');

$clip = fn(string $k, int $n) => mb_substr(trim(str_replace(["\r\n", "\r"], "\n", (string)($_POST[$k] ?? ''))), 0, $n);
$one = fn(string $k, int $n) => trim(preg_replace('/\s+/', ' ', $clip($k, $n)));
$name = $one('name', 80); $email = pd_email($_POST['email'] ?? null);
$street = $one('street', 100); $city = $one('city', 80);
$phone = preg_replace('/[^0-9+ \/()-]/', '', $one('phone', 40));
$cats = ['Pokémon-Karten','One-Piece-Karten','Yu-Gi-Oh-Karten','Andere Sammelkarten','Retro-Konsolen','Videospiele','LEGO','Sonstiges'];
$cat = in_array($_POST['kategorie'] ?? '', $cats, true) ? $_POST['kategorie'] : 'Sonstiges';
$pos = $clip('positionen', 4000); $preis = $one('preis', 20); $bezug = $one('bezug', 80);
if ($name === '' || !$email || $street === '' || $city === '' || mb_strlen($pos) < 10) $fail('felder');
if (($_POST['agb'] ?? '') !== '1' || ($_POST['eigentum'] ?? '') !== '1') $fail('consent');

$nr = 'PD-' . gmdate('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
$when = (new DateTime('now', new DateTimeZone('Europe/Berlin')))->format('d.m.Y H:i');

$ship = "perldeals Ankauf\nNico Bökenkröger\nIburger Straße 20\n49170 Hagen am Teutoburger Wald";
$slip = implode("\n", [
    "BEGLEITZETTEL – bitte ins Paket legen",
    "Auftragsnummer: $nr",
    "Name: $name",
    "Anschrift: $street, $city",
    "E-Mail: $email" . ($phone ? " · Telefon: $phone" : ''),
    "Kategorie: $cat",
    "Inhalt:",
    $pos,
]);

$cust = implode("\n", [
    "Hallo $name,",
    "",
    "danke für deinen Ankauf-Auftrag bei perldeals. Deine Auftragsnummer: $nr",
    "",
    "Wichtig: Der Auftrag ist noch kein Verkauf. Nach Eingang prüfen wir deine Ware und schicken dir ein verbindliches Angebot per E-Mail (in der Regel innerhalb von 5 Werktagen, gültig 7 Tage). Erst wenn du es annimmst, kommt der Kauf zustande. Dann überweisen wir innerhalb von 3 Werktagen und erstatten dir die Kosten eines versicherten Standardversands.",
    "",
    "SO SCHICKST DU DEINE WARE EIN",
    "1. Karten einzeln in Hüllen (Sleeves), wertvolle zusätzlich in Toploader. Sammlungen und Bulk in Kartenboxen, versiegelte Ware in Luftpolsterfolie.",
    "2. Alles in einen stabilen Karton mit Füllmaterial, nichts darf verrutschen. Bitte keine ungepolsterten Briefe.",
    "3. Diesen Begleitzettel ausdrucken und ins Paket legen (oder die Auftragsnummer gut lesbar auf einen Zettel schreiben).",
    "4. Ab 50 € Warenwert versichert und mit Sendungsnummer verschicken. Beleg aufheben – die Versandkosten erstatten wir beim Ankauf.",
    "5. Gern kurz per E-Mail die Sendungsnummer schicken.",
    "",
    "VERSANDADRESSE",
    $ship,
    "",
    $slip,
    "",
    "Lehnst du unser Angebot ab, senden wir deine Ware versichert zurück; das Rückporto nennen wir dir vorher, es trägt der Verkäufer.",
    "Ankaufbedingungen: " . PD_SITE . "/reseller/ankauf/bedingungen/",
    "Datenschutz: " . PD_SITE . "/datenschutz/",
    "",
    "Fragen? Antworte einfach auf diese E-Mail oder schreib uns per WhatsApp.",
    "",
    "Viele Grüße",
    "perldeals",
]);
$custHtml = '<div style="font:15px/1.55 Arial,sans-serif;color:#0d2522;max-width:640px">' . nl2br(pd_e($cust)) . '</div>';

$own = implode("\n", [
    "Neuer Ankauf-Auftrag $nr ($when)", "",
    "Name: $name", "E-Mail: $email", "Telefon: " . ($phone ?: '-'), "Anschrift: $street, $city",
    "Kategorie: $cat", "Preisvorstellung: " . ($preis ?: '-'), "Bezug/Vorabangebot: " . ($bezug ?: '-'), "",
    "Positionen:", $pos, "",
    "Ankaufbedingungen akzeptiert: ja · Eigentum/18+ bestätigt: ja",
]);
try {
    $m = PdMailer::fromConfig();
    $m->send($email, "Dein Ankauf-Auftrag $nr bei perldeals – Versandadresse & Begleitzettel", $cust, $custHtml, ['Reply-To' => PD_FROM]);
    $m->send(PD_FROM, "Ankauf-Auftrag $nr: $cat – $name", $own, '<pre style="font:14px/1.5 monospace;white-space:pre-wrap">' . pd_e($own) . '</pre>', ['Reply-To' => $email]);
    $m->close();
} catch (Throwable $e) {
    error_log('auftrag mail: ' . $e->getMessage());
    $fail('mail');
}
header('Location: /reseller/ankauf/auftrag-danke/', true, 303);
exit;
