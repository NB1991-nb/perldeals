<?php
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

/**
 * Minimal SMTP client (STARTTLS + AUTH LOGIN) for IONOS mail.
 * Sends multipart/alternative (text + HTML) messages.
 */
final class PdMailer
{
    /** @var resource|null */
    private $sock = null;

    public function __construct(private string $host, private int $port, private string $user, private string $pass) {}

    public static function fromConfig(): self
    {
        $c = pd_config();
        return new self($c['smtp_host'] ?? 'smtp.ionos.de', (int)($c['smtp_port'] ?? 587), $c['smtp_user'] ?? PD_FROM, (string)($c['smtp_pass'] ?? ''));
    }

    private function line(): string
    {
        $out = '';
        while (($l = fgets($this->sock, 1024)) !== false) {
            $out .= $l;
            if (strlen($l) < 4 || $l[3] === ' ') break;
        }
        return $out;
    }

    /** @param string $label safe name for error messages; never the command itself (AUTH sends credentials) */
    private function cmd(string $c, array $expect, string $label = ''): string
    {
        if ($c !== '') fwrite($this->sock, $c . "\r\n");
        $r = $this->line();
        if (!in_array((int)substr($r, 0, 3), $expect, true)) {
            $name = $label !== '' ? $label : ($c === '' ? 'greeting' : preg_replace('/[^A-Z ]/', '', strtoupper(substr($c, 0, 9))));
            throw new RuntimeException('SMTP error after ' . trim($name) . ': ' . trim(substr($r, 0, 200)));
        }
        return $r;
    }

    public function connect(): void
    {
        if ($this->sock) return;
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $this->host]]);
        $this->sock = stream_socket_client("tcp://{$this->host}:{$this->port}", $errno, $err, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$this->sock) throw new RuntimeException("SMTP connect failed: $err");
        stream_set_timeout($this->sock, 20);
        $this->cmd('', [220]);
        $this->cmd('EHLO perldeals.com', [250]);
        $this->cmd('STARTTLS', [220]);
        if (!stream_socket_enable_crypto($this->sock, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
            throw new RuntimeException('STARTTLS failed');
        }
        $this->cmd('EHLO perldeals.com', [250]);
        $this->cmd('AUTH LOGIN', [334]);
        $this->cmd(base64_encode($this->user), [334], 'AUTH user');
        $this->cmd(base64_encode($this->pass), [235], 'AUTH password');
    }

    public function close(): void
    {
        if ($this->sock) { try { $this->cmd('QUIT', [221]); } catch (Throwable $e) {} fclose($this->sock); $this->sock = null; }
    }

    private static function clean(string $v): string { return trim(str_replace(["\r", "\n"], ' ', $v)); }

    private static function hdr(string $v): string { return '=?UTF-8?B?' . base64_encode(self::clean($v)) . '?='; }

    /**
     * @param array<string,string> $extraHeaders
     */
    public function send(string $to, string $subject, string $text, string $html, array $extraHeaders = [], array $attachments = []): void
    {
        $to = self::clean($to);
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('bad recipient');
        $this->connect();
        $boundary = 'pd' . bin2hex(random_bytes(12));
        $headers = [
            'Date' => gmdate('D, d M Y H:i:s') . ' +0000',
            'From' => self::hdr('perldeals') . ' <' . PD_FROM . '>',
            'To' => '<' . $to . '>',
            'Subject' => self::hdr($subject),
            'Message-ID' => '<' . bin2hex(random_bytes(16)) . '@perldeals.com>',
            'MIME-Version' => '1.0',
            'Content-Type' => 'multipart/alternative; boundary="' . $boundary . '"',
        ];
        $mixed = $attachments ? 'pdm' . bin2hex(random_bytes(12)) : '';
        if ($mixed) $headers['Content-Type'] = 'multipart/mixed; boundary="' . $mixed . '"';
        foreach ($extraHeaders as $k => $v) { $headers[self::clean($k)] = self::clean($v); }
        $msg = '';
        foreach ($headers as $k => $v) $msg .= "$k: $v\r\n";
        if ($mixed) $msg .= "\r\n--$mixed\r\nContent-Type: multipart/alternative; boundary=\"$boundary\"\r\n";
        $msg .= "\r\n--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
              . quoted_printable_encode(preg_replace("/\r?\n/", "\r\n", $text))
              . "\r\n--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
              . quoted_printable_encode($html)
              . "\r\n--$boundary--\r\n";
        if ($mixed) {
            foreach ($attachments as $a) {
                $name = preg_replace('/[^A-Za-z0-9._-]/', '_', (string)$a['name']);
                $msg .= "\r\n--$mixed\r\nContent-Type: " . self::clean((string)$a['type']) . "; name=\"$name\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$name\"\r\n\r\n"
                      . chunk_split(base64_encode((string)$a['data']), 76, "\r\n");
            }
            $msg .= "\r\n--$mixed--\r\n";
        }
        $msg = preg_replace('/(?<!\r)\n/', "\r\n", $msg);
        $msg = preg_replace('/^\./m', '..', $msg);

        $this->cmd('MAIL FROM:<' . PD_FROM . '>', [250]);
        $this->cmd('RCPT TO:<' . $to . '>', [250, 251]);
        $this->cmd('DATA', [354]);
        fwrite($this->sock, $msg . "\r\n.\r\n");
        $this->cmd('', [250]);
        $this->cmd('RSET', [250]);
    }
}

/* ---------- e-mail templates ---------- */

function pd_e(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8'); }

function pd_mail_layout(string $lang, string $title, string $innerHtml, array $footerLinks): string
{
    $foot = implode(' · ', array_map(fn($l) => '<a href="' . pd_e($l[1]) . '" style="color:#55645F">' . pd_e($l[0]) . '</a>', $footerLinks));
    $legal = $lang === 'en'
        ? 'perldeals · Nico Bökenkröger · Iburger Straße 20 · 49170 Hagen a.T.W. · Germany. Links marked “Ad” earn us a commission; your price stays the same.'
        : 'perldeals · Nico Bökenkröger · Iburger Straße 20 · 49170 Hagen a.T.W. Mit „Anzeige“ markierte Links bringen uns eine Provision; dein Preis ändert sich nicht.';
    return '<!doctype html><html lang="' . $lang . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' . pd_e($title) . '</title></head>'
        . '<body style="margin:0;background:#F1F4F2;font-family:Helvetica,Arial,sans-serif;color:#0E1C1B">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">'
        . '<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #D3DCD8" cellspacing="0" cellpadding="0">'
        . '<tr><td style="padding:22px 24px 8px;font-size:20px;font-weight:800;letter-spacing:-.02em">perldeals</td></tr>'
        . '<tr><td style="padding:8px 24px 20px;font-size:15px;line-height:1.55">' . $innerHtml . '</td></tr></table>'
        . '<table role="presentation" width="100%" style="max-width:560px" cellspacing="0" cellpadding="0"><tr><td style="padding:16px 8px;font-size:12px;line-height:1.6;color:#55645F">'
        . $foot . '<br>' . pd_e($legal) . '</td></tr></table>'
        . '</td></tr></table></body></html>';
}

function pd_btn(string $href, string $label): string
{
    return '<p style="margin:20px 0"><a href="' . pd_e($href) . '" style="background:#0B776B;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;display:inline-block">' . pd_e($label) . '</a></p>';
}

function pd_account_url(string $lang): string { return PD_SITE . ($lang === 'en' ? '/en/account/' : '/konto/'); }
