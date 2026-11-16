<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }
/*
 * Rundmails an Newsletter-Abonnenten (nur newsletter = 1 und bestätigt). Versand durch cron.php, max. 150 Mails pro Lauf.
 * Felder: id (eindeutig, nie wiederverwenden), subject, paragraphs (Absätze, Text), button [Text, URL] optional,
 *   send_after (UTC, 'Y-m-d H:i'), test (true = nur an kontakt@perldeals.com), topics (optional: nur Abonnenten,
 *   die zusätzlich den Reseller-Alarm mit einem dieser Themen haben, z. B. ['pokemon','lego']).
 * Beispiel:
 *   ['id' => 'bf-start-2026', 'subject' => 'Black Friday startet', 'paragraphs' => ['…'], 'button' => ['Zu den Deals', 'https://perldeals.com/black-friday/'], 'send_after' => '2026-11-20 07:00', 'test' => true],
 */
return [
];
