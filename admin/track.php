<?php

ob_start();
@ini_set('display_errors', '0');
@ini_set('display_startup_errors', '0');

// Minimal bootstrap (public endpoint): find config.inc.php and init Typecho without forcing __TYPECHO_ADMIN__.
if (!defined('__TYPECHO_ROOT_DIR__')) {
    $dir = __DIR__;
    $config = '';
    for ($i = 0; $i < 8; $i++) {
        $candidate = rtrim((string) $dir, "/\\") . '/config.inc.php';
        if (file_exists($candidate)) {
            $config = $candidate;
            break;
        }
        $parent = dirname($dir);
        if ($parent === $dir) {
            break;
        }
        $dir = $parent;
    }

    if ($config === '' || !@include_once $config) {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(
            ['code' => 500, 'message' => 'Missing Config File', 'data' => null],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        exit;
    }
}

\Widget\Init::alloc();
\Widget\Options::alloc()->to($options);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function v3a_track_json(int $code, $data = null, string $message = ''): void
{
    echo json_encode(
        [
            'code' => $code,
            'message' => $message,
            'data' => $data,
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
}

function v3a_track_exit_json(int $code, $data = null, string $message = ''): void
{
    if (ob_get_level()) {
        ob_clean();
    }
    v3a_track_json($code, $data, $message);
    exit;
}

function v3a_track_truncate(string $value, int $max = 255): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    if (function_exists('mb_substr')) {
        return (string) mb_substr($value, 0, $max);
    }

    return substr($value, 0, $max);
}

function v3a_track_payload(): array
{
    $raw = (string) file_get_contents('php://input');
    $trimmed = trim($raw);
    if ($trimmed !== '') {
        $decoded = json_decode($trimmed, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    if (!empty($_POST) && is_array($_POST)) {
        return $_POST;
    }

    if (!empty($_GET) && is_array($_GET)) {
        return $_GET;
    }

    return [];
}

function v3a_track_normalize_uri(string $raw): string
{
    $raw = trim($raw);
    if ($raw === '') {
        return '';
    }

    $parsed = @parse_url($raw);
    if (is_array($parsed)) {
        $path = isset($parsed['path']) ? (string) $parsed['path'] : '';
        $query = isset($parsed['query']) ? (string) $parsed['query'] : '';
        $uri = $path;
        if ($query !== '') {
            $uri .= '?' . $query;
        }
        $raw = $uri;
    }

    if ($raw !== '' && $raw[0] !== '/') {
        $raw = '/' . $raw;
    }

    return $raw;
}

try {
    $request = \Typecho\Request::getInstance();
    $ip = (string) $request->getIp();

    // Avoid "unknown" being counted as valid statistics.
    if ($ip === '' || $ip === 'unknown') {
        v3a_track_exit_json(0, ['logged' => 0]);
    }

    $payload = v3a_track_payload();

    $path = (string) ($payload['path'] ?? $payload['uri'] ?? '');
    if ($path === '') {
        $path = (string) ($request->getReferer() ?? '');
    }

    $uri = v3a_track_normalize_uri($path);
    if ($uri === '') {
        v3a_track_exit_json(0, ['logged' => 0]);
    }

    // Never count Vue3Admin/admin itself.
    if (strpos($uri, '/Vue3Admin') === 0 || strpos($uri, '/admin') === 0) {
        v3a_track_exit_json(0, ['logged' => 0]);
    }

    $cid = null;
    if (isset($payload['cid']) && is_numeric($payload['cid'])) {
        $n = (int) $payload['cid'];
        if ($n > 0) {
            $cid = $n;
        }
    }

    $referer = trim((string) ($payload['referrer'] ?? $payload['referer'] ?? ''));
    $ua = (string) ($request->getAgent() ?? '');

    $now = time();
    $db = \Typecho\Db::get();

    // Deduplicate: when both server-side hook and footer beacon run, they may double count.
    $uriTruncated = v3a_track_truncate($uri, 255);
    $since = $now - 10;
    try {
        $dup = (int) ($db->fetchObject(
            $db->select(['COUNT(id)' => 'num'])
                ->from('table.v3a_visit_log')
                ->where('ip = ?', $ip)
                ->where('uri = ?', $uriTruncated)
                ->where('created >= ?', $since)
        )->num ?? 0);

        if ($dup > 0) {
            v3a_track_exit_json(0, ['logged' => 0, 'dedup' => 1]);
        }
    } catch (\Throwable $e) {
    }

    $db->query(
        $db->insert('table.v3a_visit_log')->rows([
            'ip' => $ip,
            'uri' => $uriTruncated,
            'cid' => $cid,
            'referer' => $referer === '' ? null : v3a_track_truncate($referer, 255),
            'ua' => $ua === '' ? null : v3a_track_truncate($ua, 255),
            'created' => $now,
        ]),
        \Typecho\Db::WRITE
    );

    v3a_track_exit_json(0, ['logged' => 1]);
} catch (\Throwable $e) {
    v3a_track_exit_json(0, ['logged' => 0]);
}
