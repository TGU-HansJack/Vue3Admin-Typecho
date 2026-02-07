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

$localStorageFile = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
    . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'Vue3Admin' . DIRECTORY_SEPARATOR . 'LocalStorage.php';
if (is_file($localStorageFile)) {
    require_once $localStorageFile;
}

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

function v3a_track_server(string $key): string
{
    if (!isset($_SERVER[$key])) {
        return '';
    }
    return trim((string) $_SERVER[$key]);
}

function v3a_track_strip_ip(string $ip): string
{
    $ip = trim($ip);
    $ip = trim($ip, "\"' ");
    if ($ip === '') {
        return '';
    }

    // [IPv6]:port
    if (preg_match('/^\\[([0-9a-f:]+)\\]:(\\d+)$/i', $ip, $m)) {
        return (string) $m[1];
    }

    // IPv4:port
    if (preg_match('/^(\\d{1,3}(?:\\.\\d{1,3}){3}):(\\d+)$/', $ip, $m)) {
        return (string) $m[1];
    }

    return $ip;
}

function v3a_track_valid_ip(string $ip): bool
{
    $ip = trim($ip);
    if ($ip === '') {
        return false;
    }
    return filter_var($ip, FILTER_VALIDATE_IP) !== false;
}

function v3a_track_public_ip(string $ip): bool
{
    $ip = trim($ip);
    if ($ip === '') {
        return false;
    }
    return filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) !== false;
}

function v3a_track_client_ip(string $fallback = ''): string
{
    $candidates = [];

    // CDN / Proxy headers
    $cf = v3a_track_server('HTTP_CF_CONNECTING_IP');
    if ($cf !== '') {
        $candidates[] = $cf;
    }

    $xri = v3a_track_server('HTTP_X_REAL_IP');
    if ($xri !== '') {
        $candidates[] = $xri;
    }

    $forwarded = v3a_track_server('HTTP_FORWARDED');
    if ($forwarded !== '') {
        $parts = explode(',', $forwarded);
        foreach ($parts as $p) {
            if (preg_match('/for=(\"?)(\\[?[0-9a-f:.]+\\]?)(\\1)/i', $p, $m)) {
                $candidates[] = (string) $m[2];
            }
        }
    }

    $xff = v3a_track_server('HTTP_X_FORWARDED_FOR');
    if ($xff !== '') {
        foreach (explode(',', $xff) as $part) {
            $candidates[] = $part;
        }
    }

    $remote = v3a_track_server('REMOTE_ADDR');
    if ($remote !== '') {
        $candidates[] = $remote;
    }

    if ($fallback !== '') {
        $candidates[] = $fallback;
    }

    $valid = [];
    foreach ($candidates as $raw) {
        $ip = v3a_track_strip_ip((string) $raw);
        if (!v3a_track_valid_ip($ip)) {
            continue;
        }
        $valid[] = $ip;
    }

    // De-duplicate while preserving order.
    $dedup = [];
    foreach ($valid as $ip) {
        if (in_array($ip, $dedup, true)) {
            continue;
        }
        $dedup[] = $ip;
    }

    // Prefer public IP.
    foreach ($dedup as $ip) {
        if (v3a_track_public_ip($ip)) {
            return $ip;
        }
    }

    return $dedup[0] ?? '';
}

try {
    $request = \Typecho\Request::getInstance();
    $fallbackIp = (string) $request->getIp();
    $ip = v3a_track_client_ip($fallbackIp);

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

    $ctype = trim((string) ($payload['ctype'] ?? $payload['type'] ?? ''));

    $logged = 0;
    try {
        if (class_exists('\\TypechoPlugin\\Vue3Admin\\LocalStorage')) {
            $logged = \TypechoPlugin\Vue3Admin\LocalStorage::logVisit($ip, $uri, $cid, $ctype, $referer, $ua, $now) ? 1 : 0;
        }
    } catch (\Throwable $e) {
    }

    v3a_track_exit_json(0, ['logged' => $logged]);
} catch (\Throwable $e) {
    v3a_track_exit_json(0, ['logged' => 0]);
}
