<?php

ob_start();
@ini_set('display_errors', '0');
@ini_set('display_startup_errors', '0');

require_once __DIR__ . '/common.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

/**
 * 统一 JSON 输出
 */
function v3a_json(int $code, $data = null, string $message = ''): void
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

function v3a_exit_json(int $code, $data = null, string $message = ''): void
{
    if (ob_get_level()) {
        ob_clean();
    }
    v3a_json($code, $data, $message);
    exit;
}

/**
 * Upsert option (global/user).
 */
function v3a_upsert_option($db, string $name, $value, int $user = 0): void
{
    $value = v3a_encode_option_value($name, $value);

    $exists = (int) ($db->fetchObject(
        $db->select(['COUNT(*)' => 'num'])->from('table.options')->where('name = ? AND user = ?', $name, $user)
    )->num ?? 0);

    if ($exists > 0) {
        $db->query(
            $db->update('table.options')->rows(['value' => $value])->where('name = ? AND user = ?', $name, $user),
            \Typecho\Db::WRITE
        );
        return;
    }

    $db->query(
        $db->insert('table.options')->rows(['name' => $name, 'value' => $value, 'user' => $user]),
        \Typecho\Db::WRITE
    );
}

function v3a_option_requires_serialized_value(string $name): bool
{
    return $name === 'plugins'
        || $name === 'routingTable'
        || strpos($name, 'theme:') === 0
        || strpos($name, 'plugin:') === 0
        || strpos($name, '_plugin:') === 0;
}

function v3a_try_unserialize_assoc(string $raw): array
{
    if ($raw === '') {
        return [];
    }

    $decoded = @unserialize($raw);
    return is_array($decoded) ? $decoded : [];
}

function v3a_decode_assoc_option($value): array
{
    $raw = trim((string) ($value ?? ''));
    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        return $decoded;
    }

    return v3a_try_unserialize_assoc($raw);
}

function v3a_encode_option_value(string $name, $value)
{
    if (!v3a_option_requires_serialized_value($name)) {
        return $value;
    }

    if (is_array($value)) {
        return serialize($value);
    }

    if (is_object($value)) {
        return serialize((array) $value);
    }

    if (is_string($value)) {
        $raw = trim($value);
        if ($raw === '') {
            return $value;
        }

        if (preg_match('/^a:\\d+:\\{.*\\}$/s', $raw)) {
            return $value;
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return serialize($decoded);
        }
    }

    return $value;
}

function v3a_is_absolute_path(string $path): bool
{
    if ($path === '') {
        return false;
    }

    $first = $path[0];
    if ($first === '/' || $first === '\\') {
        return true;
    }

    return (bool) preg_match('/^[A-Za-z]:[\\\\\/]/', $path);
}

function v3a_plugin_root_dir($options): string
{
    $root = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\');
    $normalize = static function (string $path) use ($root): string {
        $path = trim($path);
        if ($path === '') {
            return '';
        }

        if (!v3a_is_absolute_path($path) && $root !== '') {
            $path = $root . DIRECTORY_SEPARATOR . ltrim($path, '/\\');
        }

        return rtrim($path, '/\\');
    };

    $candidates = [];

    try {
        $dir = $normalize((string) $options->pluginDir);
        if ($dir !== '') {
            $candidates[] = $dir;
        }
    } catch (\Throwable $e) {
    }

    try {
        if (is_object($options) && method_exists($options, 'pluginDir')) {
            $dir = $normalize((string) $options->pluginDir(null));
            if ($dir !== '') {
                $candidates[] = $dir;
            }
        }
    } catch (\Throwable $e) {
    }

    $pluginDir = trim((string) (__TYPECHO_PLUGIN_DIR__ ?? '/usr/plugins'));
    if ($pluginDir !== '') {
        $candidates[] = $normalize($pluginDir);
    }

    if ($root !== '') {
        $candidates[] = rtrim($root . DIRECTORY_SEPARATOR . 'usr' . DIRECTORY_SEPARATOR . 'plugins', '/\\');
    }

    foreach ($candidates as $candidate) {
        if ($candidate !== '' && is_dir($candidate)) {
            return $candidate;
        }
    }

    foreach ($candidates as $candidate) {
        if ($candidate !== '') {
            return $candidate;
        }
    }

    return $root;
}

/**
 * @return array<string,mixed>
 */
function v3a_json_assoc($value): array
{
    $raw = trim((string) ($value ?? ''));
    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function v3a_truncate(string $value, int $max = 120): string
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

function v3a_gravatar_mirror_url(string $mail, int $size = 64, string $default = 'mm', string $rating = 'g'): string
{
    $mail = strtolower(trim($mail));
    $hash = md5($mail);
    $size = max(1, min(512, (int) $size));
    $default = $default !== '' ? $default : 'mm';
    $rating = $rating !== '' ? $rating : 'g';

    $base = 'https://cdn.sep.cc/avatar/' . $hash;
    $qs = http_build_query(['s' => $size, 'd' => $default, 'r' => $rating], '', '&', PHP_QUERY_RFC3986);
    return $qs !== '' ? ($base . '?' . $qs) : $base;
}

function v3a_normalize_semver(string $ver): string
{
    $ver = trim($ver);
    if ($ver === '') {
        return '';
    }

    // v1.2.3 => 1.2.3
    $ver = preg_replace('/^[vV]/', '', $ver);
    $ver = preg_replace('/[^0-9A-Za-z.+-]/', '', $ver);
    return trim($ver);
}

/**
 * @return array{rawVersion:string,version:string,deployVersion:string,build:int}
 */
function v3a_vue3admin_version_info(): array
{
    $deployVersion = '';
    $build = 0;

    try {
        $adminDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'Vue3Admin';
        $markerPath = $adminDir . DIRECTORY_SEPARATOR . '.v3a_deploy_version';
        if (is_file($markerPath)) {
            $deployVersion = trim((string) @file_get_contents($markerPath));
            if ($deployVersion !== '') {
                $parts = explode('+', $deployVersion, 2);
                $build = isset($parts[1]) ? (int) $parts[1] : 0;
            }
        }
    } catch (\Throwable $e) {
    }

    $rawVersion = '';
    if ($deployVersion !== '') {
        $parts = explode('+', $deployVersion, 2);
        $rawVersion = trim((string) ($parts[0] ?? ''));
    }

    if ($rawVersion === '') {
        // Fallback: parse from plugin file (usr/plugins/Vue3Admin/Plugin.php)
        try {
            $pluginFile = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'Vue3Admin' . DIRECTORY_SEPARATOR . 'Plugin.php';
            if (is_file($pluginFile)) {
                $raw = (string) @file_get_contents($pluginFile);
                if ($raw !== '' && preg_match('/private\\s+const\\s+VERSION\\s*=\\s*[\\\'\\"]([^\\\'\\"]+)[\\\'\\"]\\s*;/', $raw, $m)) {
                    $rawVersion = (string) ($m[1] ?? '');
                }
            }
        } catch (\Throwable $e) {
        }
    }

    $rawVersion = trim($rawVersion);
    $version = v3a_normalize_semver($rawVersion);

    return [
        'rawVersion' => $rawVersion,
        'version' => $version,
        'deployVersion' => $deployVersion,
        'build' => (int) $build,
    ];
}

/**
 * @return array{status:int,body:string}
 */
function v3a_http_get(string $url, array $headers = [], int $timeout = 8): array
{
    $timeout = max(3, min(30, (int) $timeout));

    $headerLines = [];
    foreach ($headers as $k => $v) {
        $k = trim((string) $k);
        if ($k === '') {
            continue;
        }
        $headerLines[] = $k . ': ' . trim((string) $v);
    }

    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headerLines);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = (string) curl_error($ch);
        curl_close($ch);

        if (!is_string($body)) {
            throw new \RuntimeException('HTTP request failed');
        }
        if ($status >= 400) {
            throw new \RuntimeException('HTTP ' . $status . ($err !== '' ? (': ' . $err) : ''));
        }
        return ['status' => $status, 'body' => $body];
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => $timeout,
            'header' => implode("\r\n", $headerLines),
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if (!is_string($body)) {
        throw new \RuntimeException('HTTP request failed');
    }
    return ['status' => 200, 'body' => $body];
}

/**
 * @return mixed
 */
function v3a_http_get_json(string $url, array $headers = [], int $timeout = 8)
{
    $res = v3a_http_get($url, $headers, $timeout);
    $decoded = json_decode((string) ($res['body'] ?? ''), true);
    if ($decoded === null) {
        throw new \RuntimeException('Invalid JSON response');
    }
    return $decoded;
}

function v3a_mkdir_p(string $dir): void
{
    if ($dir === '') {
        return;
    }
    if (is_dir($dir)) {
        return;
    }
    @mkdir($dir, 0755, true);
}

function v3a_rmdir_recursive(string $dir): void
{
    $dir = rtrim($dir, '/\\');
    if ($dir === '' || !is_dir($dir)) {
        return;
    }

    try {
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $item) {
            if ($item->isDir()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }
    } catch (\Throwable $e) {
    }

    @rmdir($dir);
}

/**
 * LocalStorage sqlite PDO (cache/v3a_data.sqlite).
 */
function v3a_local_pdo(): ?\PDO
{
    try {
        if (class_exists('\\TypechoPlugin\\Vue3Admin\\LocalStorage')) {
            return \TypechoPlugin\Vue3Admin\LocalStorage::pdo();
        }
    } catch (\Throwable $e) {
    }

    return null;
}

function v3a_local_pdo_or_fail(): \PDO
{
    $pdo = v3a_local_pdo();
    if (!$pdo) {
        throw new \RuntimeException('Local storage unavailable: please enable PHP extension pdo_sqlite.');
    }
    return $pdo;
}

function v3a_copy_directory(string $source, string $target): void
{
    $source = rtrim($source, '/\\');
    $target = rtrim($target, '/\\');
    if ($source === '' || $target === '' || !is_dir($source)) {
        throw new \RuntimeException('Copy source dir not found');
    }

    v3a_mkdir_p($target);
    if (!is_dir($target)) {
        throw new \RuntimeException('Cannot create dir: ' . $target);
    }

    $captureFsError = function (callable $fn): array {
        $err = '';
        set_error_handler(function ($errno, $errstr) use (&$err) {
            $err = (string) $errstr;
            return true;
        });
        try {
            $ok = (bool) $fn();
        } finally {
            restore_error_handler();
        }
        return [$ok, $err];
    };

    $iterator = new \RecursiveIteratorIterator(
        new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS),
        \RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $subPath = $iterator->getSubPathName();
        $destPath = $target . DIRECTORY_SEPARATOR . $subPath;

        if ($item->isDir()) {
            if (!is_dir($destPath)) {
                @mkdir($destPath, 0755, true);
            }
            continue;
        }

        $dir = dirname($destPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $srcPath = $item->getPathname();

        // Fast path: try overwrite directly.
        [$ok, $err] = $captureFsError(function () use ($srcPath, $destPath) {
            return copy($srcPath, $destPath);
        });
        if ($ok) {
            continue;
        }

        // Fallback: write to temp file then replace (handles read-only target files on some hosts).
        $tmpPath = $dir
            . DIRECTORY_SEPARATOR
            . '.v3a_tmp_'
            . basename($destPath)
            . '_'
            . substr(md5((string) mt_rand()), 0, 8);

        [$tmpOk, $tmpErr] = $captureFsError(function () use ($srcPath, $tmpPath) {
            return copy($srcPath, $tmpPath);
        });
        if (!$tmpOk) {
            $msg = $tmpErr !== '' ? $tmpErr : $err;
            throw new \RuntimeException('Cannot copy file: ' . $destPath . ($msg !== '' ? (' (' . $msg . ')') : ''));
        }

        [$renOk, $renErr] = $captureFsError(function () use ($tmpPath, $destPath) {
            return rename($tmpPath, $destPath);
        });
        if (!$renOk && file_exists($destPath)) {
            // Windows: rename() won't overwrite. Delete target only after temp is ready.
            $captureFsError(function () use ($destPath) {
                return @unlink($destPath);
            });
            [$renOk, $renErr] = $captureFsError(function () use ($tmpPath, $destPath) {
                return rename($tmpPath, $destPath);
            });
        }

        if (!$renOk) {
            @unlink($tmpPath);
            $msg = $renErr !== '' ? $renErr : ($err !== '' ? $err : 'rename failed');
            throw new \RuntimeException('Cannot copy file: ' . $destPath . ($msg !== '' ? (' (' . $msg . ')') : ''));
        }
    }
}

function v3a_http_download_to_file(string $url, string $destPath, array $headers = [], int $timeout = 30): void
{
    $timeout = max(5, min(120, (int) $timeout));
    $destDir = dirname($destPath);
    v3a_mkdir_p($destDir);

    $headerLines = [];
    foreach ($headers as $k => $v) {
        $k = trim((string) $k);
        if ($k === '') {
            continue;
        }
        $headerLines[] = $k . ': ' . trim((string) $v);
    }

    $fp = @fopen($destPath, 'wb');
    if (!$fp) {
        throw new \RuntimeException('Cannot write file: ' . $destPath);
    }

    try {
        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_FILE, $fp);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
            curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headerLines);
            $ok = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = (string) curl_error($ch);
            curl_close($ch);
            if (!$ok || $status >= 400) {
                throw new \RuntimeException('HTTP ' . $status . ($err !== '' ? (': ' . $err) : ''));
            }
            return;
        }

        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => $timeout,
                'header' => implode("\r\n", $headerLines),
            ],
        ]);
        $in = @fopen($url, 'rb', false, $ctx);
        if (!$in) {
            throw new \RuntimeException('HTTP request failed');
        }
        while (!feof($in)) {
            $buf = fread($in, 8192);
            if ($buf === false) {
                break;
            }
            fwrite($fp, $buf);
        }
        fclose($in);
    } finally {
        fclose($fp);
    }
}

function v3a_extract_zip_to(string $zipPath, string $destDir): void
{
    v3a_mkdir_p($destDir);
    if (!class_exists('\\ZipArchive')) {
        throw new \RuntimeException('Missing ZipArchive extension');
    }
    $zip = new \ZipArchive();
    $code = $zip->open($zipPath);
    if ($code !== true) {
        throw new \RuntimeException('Open zip failed');
    }
    if (!$zip->extractTo($destDir)) {
        $zip->close();
        throw new \RuntimeException('Extract zip failed');
    }
    $zip->close();
}

function v3a_find_vue3admin_plugin_root(string $baseDir): string
{
    $baseDir = rtrim($baseDir, '/\\');
    if ($baseDir === '' || !is_dir($baseDir)) {
        return '';
    }

    try {
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($baseDir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($it as $item) {
            if (!$item->isFile()) {
                continue;
            }
            if (strtolower($item->getFilename()) !== 'plugin.php') {
                continue;
            }
            $path = $item->getPathname();
            $raw = @file_get_contents($path);
            if (!is_string($raw) || $raw === '') {
                continue;
            }
            if (strpos($raw, 'namespace TypechoPlugin\\Vue3Admin') === false) {
                continue;
            }
            if (strpos($raw, 'class Plugin') === false) {
                continue;
            }
            return dirname($path);
        }
    } catch (\Throwable $e) {
    }

    return '';
}

function v3a_vue3admin_read_plugin_version(string $pluginRoot): string
{
    $pluginRoot = rtrim($pluginRoot, '/\\');
    $file = $pluginRoot . DIRECTORY_SEPARATOR . 'Plugin.php';
    if (!is_file($file)) {
        return '';
    }
    $raw = (string) @file_get_contents($file);
    if ($raw === '') {
        return '';
    }
    if (preg_match('/private\\s+const\\s+VERSION\\s*=\\s*[\\\'\\"]([^\\\'\\"]+)[\\\'\\"]\\s*;/', $raw, $m)) {
        return trim((string) ($m[1] ?? ''));
    }
    return '';
}

function v3a_vue3admin_deploy_version_from_plugin(string $pluginRoot): string
{
    $ver = v3a_vue3admin_read_plugin_version($pluginRoot);
    $ver = trim($ver);
    if ($ver === '') {
        return '';
    }

    $paths = [
        $pluginRoot . '/admin/index.php',
        $pluginRoot . '/admin/login.php',
        $pluginRoot . '/admin/register.php',
        $pluginRoot . '/admin/api.php',
        $pluginRoot . '/admin/track.php',
        $pluginRoot . '/admin/extending.php',
        $pluginRoot . '/admin/common.php',
        $pluginRoot . '/admin/bootstrap.php',
        $pluginRoot . '/admin/plugin-config.php',
        $pluginRoot . '/admin/theme-config.php',
        $pluginRoot . '/admin/options-plugin.php',
        $pluginRoot . '/admin/options-theme.php',
        $pluginRoot . '/admin/assets/app.js',
        $pluginRoot . '/admin/assets/app.css',
    ];

    $build = 0;
    foreach ($paths as $p) {
        $mtime = @filemtime($p);
        if ($mtime !== false) {
            $build = max($build, (int) $mtime);
        }
    }

    return $ver . '+' . (string) $build;
}

/**
 * @return array{type:string,name:string}
 */
function v3a_device_info_from_ua(string $ua): array
{
    $ua = trim($ua);
    $u = strtolower($ua);
    if ($u === '') {
        return ['type' => '', 'name' => ''];
    }

    // Bot
    $bot = '';
    if (strpos($u, 'googlebot') !== false) {
        $bot = 'Googlebot';
    } elseif (strpos($u, 'bingbot') !== false) {
        $bot = 'Bingbot';
    } elseif (strpos($u, 'baiduspider') !== false) {
        $bot = 'Baiduspider';
    } elseif (strpos($u, 'yandex') !== false && strpos($u, 'bot') !== false) {
        $bot = 'YandexBot';
    } elseif (strpos($u, 'duckduckbot') !== false) {
        $bot = 'DuckDuckBot';
    } elseif (strpos($u, 'slurp') !== false) {
        $bot = 'Yahoo Slurp';
    } elseif (
        strpos($u, 'bot') !== false
        || strpos($u, 'spider') !== false
        || strpos($u, 'crawler') !== false
    ) {
        $bot = 'Bot';
    }
    if ($bot !== '') {
        return ['type' => 'bot', 'name' => $bot];
    }

    // Device type
    $type = 'desktop';
    $device = '';
    if (strpos($u, 'ipad') !== false) {
        $type = 'tablet';
        $device = 'iPad';
    } elseif (strpos($u, 'tablet') !== false) {
        $type = 'tablet';
        $device = '平板';
    } elseif (strpos($u, 'iphone') !== false) {
        $type = 'mobile';
        $device = 'iPhone';
    } elseif (strpos($u, 'ipod') !== false) {
        $type = 'mobile';
        $device = 'iPod';
    } elseif (strpos($u, 'android') !== false) {
        $type = strpos($u, 'mobile') !== false ? 'mobile' : 'tablet';
        $device = $type === 'mobile' ? 'Android 手机' : 'Android 平板';
        if (preg_match('/android\\s[0-9\\.]+;\\s*([^;\\)]+?)(?:\\s+build\\/|;|\\))/i', $ua, $m)) {
            $model = trim((string) ($m[1] ?? ''));
            if ($model !== '' && strlen($model) <= 40) {
                $device = $model;
            }
        }
    } elseif (strpos($u, 'mobile') !== false) {
        $type = 'mobile';
        $device = '手机';
    }

    // OS
    $os = '';
    if (preg_match('/windows nt\\s*([0-9\\.]+)/i', $ua, $m)) {
        $ver = (string) ($m[1] ?? '');
        $map = [
            '10.0' => 'Windows 10/11',
            '6.3' => 'Windows 8.1',
            '6.2' => 'Windows 8',
            '6.1' => 'Windows 7',
            '6.0' => 'Windows Vista',
            '5.1' => 'Windows XP',
        ];
        $os = $map[$ver] ?? ('Windows ' . $ver);
    } elseif (strpos($u, 'ipad') !== false && preg_match('/os\\s*([0-9_]+)/i', $ua, $m)) {
        $os = 'iPadOS ' . str_replace('_', '.', (string) ($m[1] ?? ''));
    } elseif ((strpos($u, 'iphone') !== false || strpos($u, 'ipod') !== false) && preg_match('/iphone os\\s*([0-9_]+)/i', $ua, $m)) {
        $os = 'iOS ' . str_replace('_', '.', (string) ($m[1] ?? ''));
    } elseif (strpos($u, 'android') !== false && preg_match('/android\\s*([0-9\\.]+)/i', $ua, $m)) {
        $os = 'Android ' . (string) ($m[1] ?? '');
    } elseif (strpos($u, 'mac os x') !== false && strpos($u, 'iphone') === false && strpos($u, 'ipad') === false) {
        if (preg_match('/mac os x\\s*([0-9_]+)/i', $ua, $m)) {
            $os = 'macOS ' . str_replace('_', '.', (string) ($m[1] ?? ''));
        } else {
            $os = 'macOS';
        }
    } elseif (strpos($u, 'linux') !== false) {
        $os = 'Linux';
    }

    // Browser / App
    $browser = '';
    if (strpos($u, 'micromessenger') !== false) {
        $browser = '微信';
        if (preg_match('/micromessenger\\/(\\d+)(?:\\.(\\d+))?/i', $ua, $m)) {
            $major = (string) ($m[1] ?? '');
            $minor = (string) ($m[2] ?? '');
            $browser .= $minor !== '' ? (' ' . $major . '.' . $minor) : (' ' . $major);
        }
    } elseif (preg_match('/edg\\/(\\d+)/i', $ua, $m)) {
        $browser = 'Edge ' . (string) ($m[1] ?? '');
    } elseif (preg_match('/opr\\/(\\d+)/i', $ua, $m)) {
        $browser = 'Opera ' . (string) ($m[1] ?? '');
    } elseif (preg_match('/chrome\\/(\\d+)/i', $ua, $m) && strpos($u, 'edg/') === false && strpos($u, 'opr/') === false) {
        $browser = 'Chrome ' . (string) ($m[1] ?? '');
    } elseif (preg_match('/firefox\\/(\\d+)/i', $ua, $m)) {
        $browser = 'Firefox ' . (string) ($m[1] ?? '');
    } elseif (strpos($u, 'safari/') !== false && strpos($u, 'chrome/') === false && strpos($u, 'chromium') === false) {
        if (preg_match('/version\\/(\\d+)/i', $ua, $m)) {
            $browser = 'Safari ' . (string) ($m[1] ?? '');
        } else {
            $browser = 'Safari';
        }
    }

    $parts = [];
    if ($device !== '') {
        $parts[] = $device;
    }
    if ($os !== '') {
        $parts[] = $os;
    }
    if ($browser !== '') {
        $parts[] = $browser;
    }

    $name = implode(' · ', array_values(array_unique($parts)));
    if ($name === '') {
        $name = $type === 'mobile' ? '手机' : ($type === 'tablet' ? '平板' : '电脑');
    }

    return ['type' => $type, 'name' => $name];
}

/**
 * Backup helpers (Typecho .dat format, compatible with old admin/backup.php).
 */
function v3a_backup_header_template(): string
{
    return '%TYPECHO_BACKUP_XXXX%';
}

function v3a_backup_header_version(): string
{
    return '0001';
}

function v3a_backup_header(): string
{
    return str_replace('XXXX', v3a_backup_header_version(), v3a_backup_header_template());
}

/**
 * @return array<string,int>
 */
function v3a_backup_types(): array
{
    return [
        'contents' => 1,
        'comments' => 2,
        'metas' => 3,
        'relationships' => 4,
        'users' => 5,
        'fields' => 6,
    ];
}

/**
 * @return array<string,array<int,string>>
 */
function v3a_backup_fields_map(): array
{
    return [
        'contents' => [
            'cid',
            'title',
            'slug',
            'created',
            'modified',
            'text',
            'order',
            'authorId',
            'template',
            'type',
            'status',
            'password',
            'commentsNum',
            'allowComment',
            'allowPing',
            'allowFeed',
            'parent',
        ],
        'comments' => [
            'coid',
            'cid',
            'created',
            'author',
            'authorId',
            'ownerId',
            'mail',
            'url',
            'ip',
            'agent',
            'text',
            'type',
            'status',
            'parent',
        ],
        'metas' => [
            'mid',
            'name',
            'slug',
            'type',
            'description',
            'count',
            'order',
            'parent',
        ],
        'relationships' => ['cid', 'mid'],
        'users' => [
            'uid',
            'name',
            'password',
            'mail',
            'url',
            'screenName',
            'created',
            'activated',
            'logged',
            'group',
            'authCode',
        ],
        'fields' => [
            'cid',
            'name',
            'type',
            'str_value',
            'int_value',
            'float_value',
        ],
    ];
}

function v3a_backup_apply_fields(string $table, array $data, array &$lastIds): array
{
    $map = v3a_backup_fields_map();
    if (!isset($map[$table]) || !is_array($map[$table])) {
        return $data;
    }

    $allowed = $map[$table];

    $result = [];
    foreach ($data as $key => $val) {
        $index = array_search($key, $allowed, true);
        if ($index === false) {
            continue;
        }
        $result[$key] = $val;

        if ($index === 0 && !in_array($table, ['relationships', 'fields'], true)) {
            $id = is_numeric($val) ? (int) $val : 0;
            if ($id > 0) {
                $lastIds[$table] = isset($lastIds[$table])
                    ? max((int) $lastIds[$table], $id)
                    : $id;
            }
        }
    }

    return $result;
}

function v3a_backup_build_buffer(int $type, array $data): string
{
    $body = '';
    $schema = [];

    foreach ($data as $key => $val) {
        if ($val === null) {
            $schema[$key] = null;
            continue;
        }

        $str = (string) $val;
        $schema[$key] = strlen($str);
        $body .= $str;
    }

    $header = json_encode($schema);
    return \Typecho\Common::buildBackupBuffer((string) $type, (string) $header, $body);
}

function v3a_backup_export_to_file($db, $options, string $path): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $fp = @fopen($path, 'wb');
    if (!$fp) {
        throw new \RuntimeException('Cannot write backup file');
    }

    $header = v3a_backup_header();
    fwrite($fp, $header);

    $types = v3a_backup_types();
    $lastIds = [];

    foreach ($types as $table => $val) {
        $page = 1;
        do {
            $rows = $db->fetchAll($db->select()->from('table.' . $table)->page($page, 20));
            $page++;

            foreach ((array) $rows as $row) {
                if (!is_array($row)) {
                    continue;
                }

                $filtered = v3a_backup_apply_fields($table, $row, $lastIds);
                fwrite($fp, v3a_backup_build_buffer((int) $val, $filtered));
            }
        } while (count((array) $rows) === 20);
    }

    fwrite($fp, $header);
    fclose($fp);
}

function v3a_backup_parse_header($str, &$version): bool
{
    if (!is_string($str) || strlen($str) !== strlen(v3a_backup_header_template())) {
        return false;
    }

    if (!preg_match("/%TYPECHO_BACKUP_[A-Z0-9]{4}%/", $str)) {
        return false;
    }

    $version = substr($str, 16, -1);
    return true;
}

function v3a_backup_relogin(array &$userRow, $options): void
{
    if (empty($userRow['authCode'])) {
        $userRow['authCode'] = function_exists('openssl_random_pseudo_bytes')
            ? bin2hex(openssl_random_pseudo_bytes(16))
            : sha1(\Typecho\Common::randString(20));
    }

    $t = time();
    try {
        $t = (int) ($options->time ?? $t);
    } catch (\Throwable $e) {
    }

    $userRow['activated'] = $t;
    $userRow['logged'] = $t;

    \Typecho\Cookie::set('__typecho_uid', (string) ($userRow['uid'] ?? ''));
    \Typecho\Cookie::set('__typecho_authCode', \Typecho\Common::hash((string) ($userRow['authCode'] ?? '')));
}

function v3a_backup_import_from_file($db, $options, string $path): array
{
    $fp = @fopen($path, 'rb');
    if (!$fp) {
        throw new \RuntimeException('Cannot read backup file');
    }

    $fileSize = (int) (@filesize($path) ?: 0);
    $headerSize = strlen(v3a_backup_header_template());
    if ($fileSize < $headerSize * 2) {
        @fclose($fp);
        throw new \RuntimeException('Invalid backup file');
    }

    $version = '';
    $fileHeader = @fread($fp, $headerSize);
    if (!v3a_backup_parse_header($fileHeader, $version)) {
        @fclose($fp);
        throw new \RuntimeException('Invalid backup file');
    }

    fseek($fp, $fileSize - $headerSize);
    $fileFooter = @fread($fp, $headerSize);
    if (!v3a_backup_parse_header($fileFooter, $version)) {
        @fclose($fp);
        throw new \RuntimeException('Invalid backup file');
    }

    fseek($fp, $headerSize);
    $offset = $headerSize;

    $types = v3a_backup_types();
    $reverse = array_flip($types);

    $cleared = [];
    $lastIds = [];
    $relogged = false;
    $rows = 0;

    while (!feof($fp) && $offset + $headerSize < $fileSize) {
        $buffer = \Typecho\Common::extractBackupBuffer($fp, $offset, (string) $version);
        if (!$buffer) {
            @fclose($fp);
            throw new \RuntimeException('Restore failed');
        }

        [$type, $header, $body] = $buffer;
        if (!isset($reverse[$type])) {
            continue;
        }

        $table = (string) $reverse[$type];
        $schema = json_decode((string) $header, true);
        if (!is_array($schema)) {
            continue;
        }

        $data = [];
        $pos = 0;
        foreach ($schema as $key => $len) {
            if ($len === null) {
                $data[$key] = null;
                continue;
            }

            $n = is_numeric($len) ? (int) $len : 0;
            $data[$key] = substr((string) $body, $pos, $n);
            $pos += $n;
        }

        try {
            if (empty($cleared[$table])) {
                $db->truncate('table.' . $table);
                $cleared[$table] = true;
            }

            if (!$relogged && $table === 'users' && ($data['group'] ?? '') === 'administrator') {
                v3a_backup_relogin($data, $options);
                $relogged = true;
            }

            $filtered = v3a_backup_apply_fields($table, $data, $lastIds);
            $db->query($db->insert('table.' . $table)->rows($filtered));
            $rows++;
        } catch (\Throwable $e) {
            @fclose($fp);
            throw $e;
        }
    }

    try {
        if (false !== strpos(strtolower((string) $db->getAdapterName()), 'pgsql')) {
            foreach ($lastIds as $table => $id) {
                $seq = $db->getPrefix() . $table . '_seq';
                $db->query('ALTER SEQUENCE ' . $seq . ' RESTART WITH ' . (((int) $id) + 1));
            }
        }
    } catch (\Throwable $e) {
    }

    @fclose($fp);

    return [
        'rows' => $rows,
        'tables' => array_keys($cleared),
    ];
}

function v3a_decode_rule(string $rule): string
{
    return (string) preg_replace("/\\[([_a-z0-9-]+)[^\\]]*\\]/i", "{\\1}", $rule);
}

function v3a_encode_rule(string $rule): string
{
    return str_replace(
        ['{cid}', '{slug}', '{category}', '{directory}', '{year}', '{month}', '{day}', '{mid}'],
        [
            '[cid:digital]',
            '[slug]',
            '[category]',
            '[directory:split:0]',
            '[year:digital:4]',
            '[month:digital:2]',
            '[day:digital:2]',
            '[mid:digital]',
        ],
        $rule
    );
}

function v3a_permalink_try_rewrite_request($options): bool
{
    $siteUrl = (string) ($options->siteUrl ?? '');
    if ($siteUrl === '') {
        return false;
    }

    $client = \Typecho\Http\Client::get();
    if (!$client) {
        return false;
    }

    $client->setData(['do' => 'remoteCallback'])
        ->setHeader('User-Agent', (string) ($options->generator ?? 'Typecho'))
        ->setHeader('X-Requested-With', 'XMLHttpRequest')
        ->send(\Typecho\Common::url('/action/ajax', $siteUrl));

    return 200 == $client->getResponseStatus() && 'OK' == $client->getResponseBody();
}

/**
 * Check rewrite availability like old admin.
 *
 * @return array{ok:bool,message:string}
 */
function v3a_permalink_check_rewrite($options): array
{
    $rootDir = defined('__TYPECHO_ROOT_DIR__') ? __TYPECHO_ROOT_DIR__ : dirname(__DIR__);
    $htaccessPath = rtrim((string) $rootDir, "/\\") . '/.htaccess';
    $isApache = strpos(php_sapi_name(), 'apache') !== false;

    $siteUrl = (string) ($options->siteUrl ?? '');
    $parsed = @parse_url($siteUrl);
    $basePath = '/';
    if (is_array($parsed) && !empty($parsed['path'])) {
        $basePath = (string) $parsed['path'];
    }
    $basePath = rtrim($basePath, '/') . '/';

    $hasWrote = false;
    if ($isApache && !file_exists($htaccessPath) && is_writable($rootDir)) {
        $hasWrote = file_put_contents(
            $htaccessPath,
            "<IfModule mod_rewrite.c>\n"
            . "RewriteEngine On\n"
            . "RewriteBase {$basePath}\n"
            . "RewriteCond %{REQUEST_FILENAME} !-f\n"
            . "RewriteCond %{REQUEST_FILENAME} !-d\n"
            . "RewriteRule ^(.*)$ {$basePath}index.php/$1 [L]\n"
            . "</IfModule>"
        );
    }

    try {
        if (v3a_permalink_try_rewrite_request($options)) {
            return ['ok' => true, 'message' => ''];
        }

        if (false !== $hasWrote) {
            @unlink($htaccessPath);

            $hasWrote = file_put_contents(
                $htaccessPath,
                "<IfModule mod_rewrite.c>\n"
                . "RewriteEngine On\n"
                . "RewriteBase {$basePath}\n"
                . "RewriteCond %{REQUEST_FILENAME} !-f\n"
                . "RewriteCond %{REQUEST_FILENAME} !-d\n"
                . "RewriteRule . {$basePath}index.php [L]\n"
                . "</IfModule>"
            );

            if (v3a_permalink_try_rewrite_request($options)) {
                return ['ok' => true, 'message' => ''];
            }

            @unlink($htaccessPath);
        }
    } catch (\Throwable $e) {
        if ($hasWrote) {
            @unlink($htaccessPath);
        }
    }

    $message = '重写功能检测失败，请检查你的服务器设置。';
    if (
        $isApache
        && !file_exists($htaccessPath)
        && !is_writable($rootDir)
    ) {
        $message .= ' 检测到你使用了 Apache，但程序无法在根目录创建 .htaccess 文件。请调整目录权限，或手动创建 .htaccess。';
    }
    $message .= ' 如果你仍然想启用此功能，请勾选“仍然启用”后再次保存。';

    return ['ok' => false, 'message' => $message];
}

function v3a_is_json_request(): bool
{
    $contentType = (string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '');
    return stripos($contentType, 'application/json') !== false;
}

function v3a_read_json_body(): array
{
    if (!v3a_is_json_request()) {
        return [];
    }

    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function v3a_payload(): array
{
    $json = v3a_read_json_body();
    return !empty($json) ? $json : (is_array($_POST) ? $_POST : []);
}

/**
 * JSON friendly CSRF protect.
 *
 * Typecho's built-in $security->protect() relies on HTTP Referer and responds with
 * a redirect (HTML), which breaks fetch(). This helper validates the token against
 * multiple possible suffixes and always returns JSON on failure.
 */
function v3a_security_protect($security, $request): void
{
    $token = (string) ($request->get('_') ?? '');

    $referer = (string) ($request->getReferer() ?? '');
    if ($token !== '' && $referer !== '' && hash_equals($security->getToken($referer), $token)) {
        return;
    }

    $csrfRef = v3a_string($request->get('csrfRef', ''), '');
    if ($token !== '' && $csrfRef !== '' && hash_equals($security->getToken($csrfRef), $token)) {
        return;
    }

    // Fallback: allow clients that generate token from request URL.
    $requestUrl = (string) ($request->getRequestUrl() ?? '');
    if ($token !== '' && $requestUrl !== '' && hash_equals($security->getToken($requestUrl), $token)) {
        return;
    }

    v3a_exit_json(403, null, 'Forbidden');
}

function v3a_require_role($user, string $role): void
{
    try {
        if ($user && method_exists($user, 'pass') && $user->pass($role, true)) {
            return;
        }
    } catch (\Throwable $e) {
    }

    v3a_exit_json(403, null, 'Forbidden');
}

/**
 * ACL config (Vue3Admin internal).
 *
 * Stored in table.options: name=v3a_acl_config user=0
 */
function v3a_acl_default_config(): array
{
    return [
        'version' => 1,
        'groups' => [
            'administrator' => [
                'posts' => ['write' => 1, 'manage' => 1, 'taxonomy' => 1, 'scopeAll' => 1],
                'comments' => ['manage' => 1, 'scopeAll' => 1],
                'pages' => ['manage' => 1],
                'files' => ['access' => 1, 'upload' => 1, 'scopeAll' => 1, 'maxSizeMb' => 0, 'types' => []],
                'friends' => ['manage' => 1],
                'data' => ['manage' => 1],
                'subscribe' => ['manage' => 1],
                'users' => ['manage' => 1],
                'maintenance' => ['manage' => 1],
            ],
            'editor' => [
                'posts' => ['write' => 1, 'manage' => 1, 'taxonomy' => 1, 'scopeAll' => 1],
                'comments' => ['manage' => 1, 'scopeAll' => 1],
                'pages' => ['manage' => 1],
                'files' => ['access' => 1, 'upload' => 1, 'scopeAll' => 1, 'maxSizeMb' => 0, 'types' => []],
                'friends' => ['manage' => 0],
                'data' => ['manage' => 0],
                'subscribe' => ['manage' => 0],
                'users' => ['manage' => 0],
                'maintenance' => ['manage' => 0],
            ],
            'contributor' => [
                'posts' => ['write' => 1, 'manage' => 1, 'taxonomy' => 0, 'scopeAll' => 0],
                'comments' => ['manage' => 0, 'scopeAll' => 0],
                'pages' => ['manage' => 0],
                'files' => ['access' => 1, 'upload' => 1, 'scopeAll' => 0, 'maxSizeMb' => 5, 'types' => []],
                'friends' => ['manage' => 0],
                'data' => ['manage' => 0],
                'subscribe' => ['manage' => 0],
                'users' => ['manage' => 0],
                'maintenance' => ['manage' => 0],
            ],
            'subscriber' => [
                'posts' => ['write' => 0, 'manage' => 0, 'taxonomy' => 0, 'scopeAll' => 0],
                'comments' => ['manage' => 0, 'scopeAll' => 0],
                'pages' => ['manage' => 0],
                'files' => ['access' => 0, 'upload' => 0, 'scopeAll' => 0, 'maxSizeMb' => 0, 'types' => []],
                'friends' => ['manage' => 0],
                'data' => ['manage' => 0],
                'subscribe' => ['manage' => 0],
                'users' => ['manage' => 0],
                'maintenance' => ['manage' => 0],
            ],
            'visitor' => [
                'posts' => ['write' => 0, 'manage' => 0, 'taxonomy' => 0, 'scopeAll' => 0],
                'comments' => ['manage' => 0, 'scopeAll' => 0],
                'pages' => ['manage' => 0],
                'files' => ['access' => 0, 'upload' => 0, 'scopeAll' => 0, 'maxSizeMb' => 0, 'types' => []],
                'friends' => ['manage' => 0],
                'data' => ['manage' => 0],
                'subscribe' => ['manage' => 0],
                'users' => ['manage' => 0],
                'maintenance' => ['manage' => 0],
            ],
        ],
    ];
}

function v3a_acl_sanitize_types($types): array
{
    if (!is_array($types)) {
        return [];
    }

    $out = [];
    foreach ($types as $t) {
        $v = strtolower(trim((string) $t));
        $v = ltrim($v, '.');
        if ($v === '') {
            continue;
        }
        $out[$v] = true;
    }

    $keys = array_keys($out);
    sort($keys);
    return $keys;
}

function v3a_acl_sanitize_group($group): array
{
    $g = is_array($group) ? $group : [];

    $posts = isset($g['posts']) && is_array($g['posts']) ? $g['posts'] : [];
    $comments = isset($g['comments']) && is_array($g['comments']) ? $g['comments'] : [];
    $pages = isset($g['pages']) && is_array($g['pages']) ? $g['pages'] : [];
    $files = isset($g['files']) && is_array($g['files']) ? $g['files'] : [];
    $friends = isset($g['friends']) && is_array($g['friends']) ? $g['friends'] : [];
    $data = isset($g['data']) && is_array($g['data']) ? $g['data'] : [];
    $subscribe = isset($g['subscribe']) && is_array($g['subscribe']) ? $g['subscribe'] : [];
    $users = isset($g['users']) && is_array($g['users']) ? $g['users'] : [];
    $maintenance = isset($g['maintenance']) && is_array($g['maintenance']) ? $g['maintenance'] : [];

    $maxSizeMb = (int) ($files['maxSizeMb'] ?? 0);
    if ($maxSizeMb < 0) {
        $maxSizeMb = 0;
    }
    if ($maxSizeMb > 2048) {
        $maxSizeMb = 2048;
    }

    return [
        'posts' => [
            'write' => v3a_bool_int($posts['write'] ?? 0),
            'manage' => v3a_bool_int($posts['manage'] ?? 0),
            'taxonomy' => v3a_bool_int($posts['taxonomy'] ?? 0),
            'scopeAll' => v3a_bool_int($posts['scopeAll'] ?? 0),
        ],
        'comments' => [
            'manage' => v3a_bool_int($comments['manage'] ?? 0),
            'scopeAll' => v3a_bool_int($comments['scopeAll'] ?? 0),
        ],
        'pages' => [
            'manage' => v3a_bool_int($pages['manage'] ?? 0),
        ],
        'files' => [
            'access' => v3a_bool_int($files['access'] ?? 0),
            'upload' => v3a_bool_int($files['upload'] ?? 0),
            'scopeAll' => v3a_bool_int($files['scopeAll'] ?? 0),
            'maxSizeMb' => $maxSizeMb,
            'types' => v3a_acl_sanitize_types($files['types'] ?? []),
        ],
        'friends' => ['manage' => v3a_bool_int($friends['manage'] ?? 0)],
        'data' => ['manage' => v3a_bool_int($data['manage'] ?? 0)],
        'subscribe' => ['manage' => v3a_bool_int($subscribe['manage'] ?? 0)],
        'users' => ['manage' => v3a_bool_int($users['manage'] ?? 0)],
        'maintenance' => ['manage' => v3a_bool_int($maintenance['manage'] ?? 0)],
    ];
}

function v3a_acl_merge_group_with_base(array $baseGroup, $group): array
{
    $g = is_array($group) ? $group : [];
    return array_replace_recursive($baseGroup, $g);
}

function v3a_upload_safe_name(string &$name): string
{
    $name = str_replace(['"', '<', '>'], '', $name);
    $name = str_replace('\\', '/', $name);
    $name = false === strpos($name, '/') ? ('a' . $name) : str_replace('/', '/a', $name);
    $info = pathinfo($name);
    $name = substr((string) ($info['basename'] ?? ''), 1);

    $ext = isset($info['extension']) ? strtolower((string) $info['extension']) : '';
    $ext = ltrim($ext, '.');
    return $ext;
}

function v3a_make_upload_dir(string $path): bool
{
    $path = preg_replace('/\\\\+/', '/', $path);
    $path = rtrim((string) $path, '/');
    if ($path === '') {
        return false;
    }
    if (is_dir($path)) {
        return true;
    }

    @mkdir($path, 0755, true);
    return is_dir($path);
}

function v3a_upload_handle_default(array $file)
{
    if (empty($file['name'])) {
        return false;
    }

    $safeName = (string) $file['name'];
    $ext = v3a_upload_safe_name($safeName);
    $file['name'] = $safeName;

    if ($ext === '') {
        return false;
    }

    $date = new \Typecho\Date();
    $uploadDir = defined('__TYPECHO_UPLOAD_DIR__') ? __TYPECHO_UPLOAD_DIR__ : \Widget\Upload::UPLOAD_DIR;
    $uploadRootDir = defined('__TYPECHO_UPLOAD_ROOT_DIR__') ? __TYPECHO_UPLOAD_ROOT_DIR__ : __TYPECHO_ROOT_DIR__;
    $dir = \Typecho\Common::url($uploadDir, $uploadRootDir) . '/' . $date->year . '/' . $date->month;

    if (!is_dir($dir)) {
        if (!v3a_make_upload_dir($dir)) {
            return false;
        }
    }

    $fileName = sprintf('%u', crc32(uniqid())) . '.' . $ext;
    $fullPath = $dir . '/' . $fileName;

    if (isset($file['tmp_name'])) {
        if (!@move_uploaded_file((string) $file['tmp_name'], $fullPath)) {
            return false;
        }
    } elseif (isset($file['bytes'])) {
        if (!file_put_contents($fullPath, $file['bytes'])) {
            return false;
        }
    } elseif (isset($file['bits'])) {
        if (!file_put_contents($fullPath, $file['bits'])) {
            return false;
        }
    } else {
        return false;
    }

    if (!isset($file['size'])) {
        $file['size'] = filesize($fullPath);
    }

    return [
        'name' => $file['name'],
        'path' => $uploadDir . '/' . $date->year . '/' . $date->month . '/' . $fileName,
        'size' => $file['size'],
        'type' => $ext,
        'mime' => \Typecho\Common::mimeContentType($fullPath),
    ];
}

function v3a_upload_handle_best($options, array $file)
{
    $handles = [];
    try {
        $plugins = $options ? ($options->plugins ?? null) : null;
        $plugins = is_array($plugins) ? $plugins : [];
        $handles = isset($plugins['handles']) && is_array($plugins['handles']) ? $plugins['handles'] : [];
    } catch (\Throwable $e) {
        $handles = [];
    }

    // Typecho plugin handle key: "Widget_Upload:uploadHandle"
    $handleKey = \Typecho\Common::nativeClassName(\Widget\Upload::class) . ':uploadHandle';
    $list = isset($handles[$handleKey]) && is_array($handles[$handleKey]) ? $handles[$handleKey] : [];

    // Call the last registered handler only to avoid multiple handlers double-moving the same tmp file.
    $callback = null;
    $maxWeight = null;
    foreach ($list as $w => $cb) {
        $fw = (float) $w;
        if ($maxWeight === null || $fw >= $maxWeight) {
            $maxWeight = $fw;
            $callback = $cb;
        }
    }

    if ($callback) {
        try {
            $r = call_user_func($callback, $file);
            if (is_array($r) && !empty($r)) {
                return $r;
            }
        } catch (\Throwable $e) {
        }
    }

    return v3a_upload_handle_default($file);
}

function v3a_acl_sanitize_config($config): array
{
    $base = v3a_acl_default_config();
    $cfg = is_array($config) ? $config : [];

    $version = isset($cfg['version']) && is_numeric($cfg['version']) ? (int) $cfg['version'] : 1;
    if ($version <= 0) {
        $version = 1;
    }

    $out = [
        'version' => $version,
        'groups' => [],
    ];

    $groups = isset($cfg['groups']) && is_array($cfg['groups']) ? $cfg['groups'] : [];
    foreach (array_keys($base['groups']) as $k) {
        $merged = v3a_acl_merge_group_with_base($base['groups'][$k], $groups[$k] ?? []);
        $out['groups'][$k] = v3a_acl_sanitize_group($merged);
    }

    return $out;
}

function v3a_acl_load($db): array
{
    $name = 'v3a_acl_config';

    $raw = '';
    try {
        $row = $db->fetchObject(
            $db->select('value')
                ->from('table.options')
                ->where('name = ? AND user = ?', $name, 0)
                ->limit(1)
        );
        $raw = (string) ($row->value ?? '');
    } catch (\Throwable $e) {
    }

    $decoded = null;
    if ($raw !== '') {
        $decoded = json_decode($raw, true);
    }

    if (!is_array($decoded)) {
        $decoded = v3a_acl_default_config();
        try {
            v3a_upsert_option($db, $name, json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 0);
        } catch (\Throwable $e) {
        }
    }

    $sanitized = v3a_acl_sanitize_config($decoded);
    try {
        $rawDecoded = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $rawSanitized = json_encode($sanitized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (is_string($rawDecoded) && is_string($rawSanitized) && $rawDecoded !== $rawSanitized) {
            v3a_upsert_option($db, $name, $rawSanitized, 0);
        }
    } catch (\Throwable $e) {
    }

    return $sanitized;
}

function v3a_acl_for_user($db, $user): array
{
    static $cached = null;
    if (is_array($cached)) {
        return $cached;
    }

    $cfg = v3a_acl_load($db);
    $group = 'subscriber';
    try {
        $group = strtolower(trim((string) ($user->group ?? 'subscriber')));
    } catch (\Throwable $e) {
    }

    $cached = isset($cfg['groups'][$group]) && is_array($cfg['groups'][$group])
        ? $cfg['groups'][$group]
        : v3a_acl_sanitize_group([]);

    return $cached;
}

function v3a_int($value, int $default = 0): int
{
    if (is_int($value)) {
        return $value;
    }
    if (is_numeric($value)) {
        return (int) $value;
    }
    return $default;
}

function v3a_string($value, string $default = ''): string
{
    if (is_string($value)) {
        return trim($value);
    }
    if (is_numeric($value)) {
        return (string) $value;
    }
    return $default;
}

function v3a_bool_int($value): int
{
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }
    if (is_numeric($value)) {
        return ((int) $value) ? 1 : 0;
    }
    if (is_string($value)) {
        $v = strtolower(trim($value));
        if (in_array($v, ['1', 'true', 'yes', 'on'], true)) {
            return 1;
        }
        if (in_array($v, ['0', 'false', 'no', 'off'], true)) {
            return 0;
        }
    }
    return 0;
}

/**
 * Default slug: when slug is empty, use cid (if not occupied in same type group).
 */
function v3a_default_slug_to_cid($db, int $cid, array $types): bool
{
    if ($cid <= 0) {
        return false;
    }

	    $slug = (string) $cid;
	    $typeList = array_values(array_filter(array_map('strval', $types), function ($t) {
	        return $t !== '';
	    }));

    if (!empty($typeList)) {
        try {
            $row = $db->fetchObject(
                $db->select('cid')
                    ->from('table.contents')
                    ->where('slug = ?', $slug)
                    ->where('cid <> ?', $cid)
                    ->where('type IN ?', $typeList)
                    ->limit(1)
            );
            if ((int) ($row->cid ?? 0) > 0) {
                return false;
            }
        } catch (\Throwable $e) {
        }
    }

    try {
        $affected = (int) $db->query(
            $db->update('table.contents')->rows(['slug' => $slug])->where('cid = ?', $cid),
            \Typecho\Db::WRITE
        );
        return $affected > 0;
    } catch (\Throwable $e) {
        return false;
    }
}

/**
 * Friends apply settings (front-end v3a_links.php templates).
 *
 * @return array{
 *  allowTypeSelect:int,
 *  defaultType:string,
 *  allowedTypes:array{friend:int,collection:int},
 *  required:array{email:int,avatar:int,description:int,message:int}
 * }
 */
function v3a_friends_apply_settings_default(): array
{
    return [
        'allowTypeSelect' => 0,
        'defaultType' => 'friend',
        'allowedTypes' => [
            'friend' => 1,
            'collection' => 0,
        ],
        'required' => [
            'email' => 0,
            'avatar' => 0,
            'description' => 0,
            'message' => 0,
        ],
    ];
}

/**
 * @param mixed $input
 * @return array{
 *  allowTypeSelect:int,
 *  defaultType:string,
 *  allowedTypes:array{friend:int,collection:int},
 *  required:array{email:int,avatar:int,description:int,message:int}
 * }
 */
function v3a_friends_apply_settings_sanitize($input): array
{
    $out = v3a_friends_apply_settings_default();
    if (!is_array($input)) {
        return $out;
    }

    $out['allowTypeSelect'] = v3a_bool_int($input['allowTypeSelect'] ?? 0);

    $allowedTypes = is_array($input['allowedTypes'] ?? null) ? $input['allowedTypes'] : [];
    $out['allowedTypes']['friend'] = v3a_bool_int($allowedTypes['friend'] ?? 0);
    $out['allowedTypes']['collection'] = v3a_bool_int($allowedTypes['collection'] ?? 0);
    if (empty($out['allowedTypes']['friend']) && empty($out['allowedTypes']['collection'])) {
        $out['allowedTypes']['friend'] = 1;
    }

    $defaultType = strtolower(trim(v3a_string($input['defaultType'] ?? 'friend', 'friend')));
    if (!in_array($defaultType, ['friend', 'collection'], true)) {
        $defaultType = 'friend';
    }
    if (empty($out['allowedTypes'][$defaultType])) {
        $defaultType = !empty($out['allowedTypes']['friend']) ? 'friend' : 'collection';
    }
    $out['defaultType'] = $defaultType;

    $required = is_array($input['required'] ?? null) ? $input['required'] : [];
    $out['required']['email'] = v3a_bool_int($required['email'] ?? 0);
    $out['required']['avatar'] = v3a_bool_int($required['avatar'] ?? 0);
    $out['required']['description'] = v3a_bool_int($required['description'] ?? 0);
    $out['required']['message'] = v3a_bool_int($required['message'] ?? 0);

    return $out;
}

function v3a_layout_text($layout): string
{
    if (!$layout) {
        return '';
    }

    ob_start();
    try {
        $layout->html();
    } catch (\Throwable $e) {
    }
    $out = ob_get_clean();
    return v3a_string($out, '');
}

function v3a_plain_text(string $raw): string
{
    $s = trim(strip_tags($raw));
    if ($s === '') {
        return '';
    }
    try {
        $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    } catch (\Throwable $e) {
    }
    return trim($s);
}

function v3a_default_fields_for_editor($widget, $options, string $kind): array
{
    $layout = new \Typecho\Widget\Helper\Layout();

    // Collect default field items from plugins + theme (same as old admin).
    try {
        ob_start();
        \Widget\Base\Contents::pluginHandle()->call('getDefaultFieldItems', $layout);
        $widget::pluginHandle()->call('getDefaultFieldItems', $layout);
        ob_end_clean();
    } catch (\Throwable $e) {
        @ob_end_clean();
    }

    $configFile = $options->themeFile($options->theme, 'functions.php');
    if (is_string($configFile) && $configFile !== '' && file_exists($configFile)) {
        try {
            ob_start();
            require_once $configFile;

            if (function_exists('themeFields')) {
                themeFields($layout);
            }
            if ($kind === 'post' && function_exists('themePostFields')) {
                themePostFields($layout);
            }
            if ($kind === 'page' && function_exists('themePageFields')) {
                themePageFields($layout);
            }
            ob_end_clean();
        } catch (\Throwable $e) {
            @ob_end_clean();
        }
    }

    $fields = null;
    try {
        $fields = $widget->fields ?? null;
    } catch (\Throwable $e) {
    }
    if (!$fields) {
        $fields = new \Typecho\Config();
    }

    $out = [];
    $items = $layout->getItems();
    foreach ($items as $item) {
        if (!($item instanceof \Typecho\Widget\Helper\Form\Element)) {
            continue;
        }
        if (empty($item->input)) {
            continue;
        }

        $rawName = v3a_string($item->input->getAttribute('name') ?? '', '');
        if ($rawName === '') {
            continue;
        }

        $name = '';
        if (preg_match('/^fields\\[(.+)\\]$/', $rawName, $m)) {
            $name = v3a_string($m[1] ?? '', '');
        } elseif (preg_match('/^(.+)\\[\\]$/', $rawName, $m)) {
            $name = v3a_string($m[1] ?? '', '');
        } else {
            $name = $rawName;
        }
        $name = trim($name);
        if ($name === '') {
            continue;
        }

        // Skip read-only fields (old admin behavior).
        $readOnly = false;
        try {
            $isFieldReadOnly = \Widget\Base\Contents::pluginHandle()
                ->trigger($plugged)->call('isFieldReadOnly', $name);
            if ($plugged && $isFieldReadOnly) {
                $readOnly = true;
            }
        } catch (\Throwable $e) {
        }
        if ($readOnly) {
            continue;
        }
        try {
            $isFieldReadOnly = $widget::pluginHandle()
                ->trigger($plugged)->call('isFieldReadOnly', $name);
            if ($plugged && $isFieldReadOnly) {
                $readOnly = true;
            }
        } catch (\Throwable $e) {
        }
        if ($readOnly) {
            continue;
        }

        // Apply saved value (if exists).
        try {
            if (isset($fields->{$name})) {
                $item->value($fields->{$name});
            }
        } catch (\Throwable $e) {
        }

        $inputType = 'text';
        if ($item instanceof \Typecho\Widget\Helper\Form\Element\Textarea) {
            $inputType = 'textarea';
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Select) {
            $inputType = 'select';
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Radio) {
            $inputType = 'radio';
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Checkbox) {
            $inputType = 'checkbox';
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Number) {
            $inputType = 'number';
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Url) {
            $inputType = 'url';
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Password) {
            $inputType = 'password';
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Hidden) {
            continue;
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Submit) {
            continue;
        } elseif ($item instanceof \Typecho\Widget\Helper\Form\Element\Fake) {
            continue;
        }

        $label = '';
        try {
            $label = v3a_plain_text(v3a_layout_text($item->label));
        } catch (\Throwable $e) {
        }
        if ($label === '') {
            $label = $name;
        }

        $description = '';
        try {
            if (!empty($item->container)) {
                foreach ((array) $item->container->getItems() as $c) {
                    if (!($c instanceof \Typecho\Widget\Helper\Layout)) {
                        continue;
                    }
                    if ($c->getTagName() !== 'p') {
                        continue;
                    }
                    $cls = v3a_string($c->getAttribute('class') ?? '', '');
                    if (strpos($cls, 'description') === false) {
                        continue;
                    }
                    $description = v3a_plain_text(v3a_layout_text($c));
                    break;
                }
            }
        } catch (\Throwable $e) {
        }

        $placeholder = '';
        try {
            $placeholder = v3a_string($item->input->getAttribute('placeholder') ?? '', '');
        } catch (\Throwable $e) {
        }

        $choices = [];
        if ($inputType === 'select') {
            try {
                foreach ((array) $item->input->getItems() as $opt) {
                    if (!($opt instanceof \Typecho\Widget\Helper\Layout)) {
                        continue;
                    }
                    if ($opt->getTagName() !== 'option') {
                        continue;
                    }
                    $v = v3a_string($opt->getAttribute('value') ?? '', '');
                    $t = v3a_plain_text(v3a_layout_text($opt));
                    $choices[] = [
                        'value' => $v,
                        'label' => $t !== '' ? $t : $v,
                    ];
                }
            } catch (\Throwable $e) {
            }
        } elseif ($inputType === 'radio' || $inputType === 'checkbox') {
            try {
                if (!empty($item->container)) {
                    foreach ((array) $item->container->getItems() as $span) {
                        if (!($span instanceof \Typecho\Widget\Helper\Layout)) {
                            continue;
                        }
                        if ($span->getTagName() !== 'span') {
                            continue;
                        }

                        $input = null;
                        $lbl = null;
                        foreach ((array) $span->getItems() as $node) {
                            if (!($node instanceof \Typecho\Widget\Helper\Layout)) {
                                continue;
                            }
                            if ($node->getTagName() === 'input') {
                                $input = $node;
                            } elseif ($node->getTagName() === 'label') {
                                $lbl = $node;
                            }
                        }
                        if (!$input) {
                            continue;
                        }
                        $v = v3a_string($input->getAttribute('value') ?? '', '');
                        if ($v === '') {
                            continue;
                        }
                        $t = $lbl ? v3a_plain_text(v3a_layout_text($lbl)) : $v;
                        $choices[] = [
                            'value' => $v,
                            'label' => $t !== '' ? $t : $v,
                        ];
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        $value = $item->value ?? '';
        if ($inputType === 'checkbox') {
            if (is_array($value)) {
                $value = array_values(array_map('strval', $value));
            } elseif ($value === null || $value === '') {
                $value = [];
            } else {
                $value = [(string) $value];
            }
        } elseif ($inputType === 'select' || $inputType === 'radio') {
            if (is_array($value) || is_object($value)) {
                $value = '';
            } else {
                $value = $value === null ? '' : (string) $value;
            }
        } else {
            if (!is_array($value) && !is_object($value)) {
                $value = $value === null ? '' : (string) $value;
            }
        }

        $out[$name] = [
            'name' => $name,
            'label' => $label,
            'description' => $description,
            'inputType' => $inputType,
            'placeholder' => $placeholder,
            'options' => $choices,
            'value' => $value,
        ];
    }

    return array_values($out);
}

/**
 * Post edit proxy: reuse Typecho internal publish/save logic without redirect.
 */
class V3A_PostEditProxy extends \Widget\Contents\Post\Edit
{
    /**
     * @return array{cid:int,draftId:int|null,status:string,type:string,permalink:string}
     * @throws \Typecho\Db\Exception
     * @throws \Typecho\Widget\Exception
     */
    public function v3aWrite(string $mode): array
    {
        $this->prepare();

        $contents = $this->request->from(
            'password',
            'allowComment',
            'allowPing',
            'allowFeed',
            'slug',
            'tags',
            'text',
            'visibility'
        );

        $contents['category'] = $this->request->getArray('category');
        $contents['title'] = $this->request->get('title', _t('未命名文档'));
        $contents['created'] = $this->getCreated();

        if ($this->request->is('markdown=1') && $this->options->markdown) {
            $contents['text'] = '<!--markdown-->' . $contents['text'];
        }

        $contents = self::pluginHandle()->filter('write', $contents, $this);

        if ($mode === 'publish') {
            $contents['type'] = 'post';
            $this->publish($contents);

            self::pluginHandle()->call('finishPublish', $contents, $this);

            $trackback = array_filter(
                array_unique(preg_split("/(\r|\n|\r\n)/", trim($this->request->get('trackback', ''))))
            );
            \Widget\Service::alloc()->sendPing($this, $trackback);

            return [
                'cid' => (int) $this->cid,
                'draftId' => null,
                'status' => (string) $this->status,
                'type' => (string) $this->type,
                'permalink' => (string) $this->permalink,
            ];
        }

        $contents['type'] = 'post_draft';
        $draftId = $this->save($contents);

        self::pluginHandle()->call('finishSave', $contents, $this);

        return [
            'cid' => (int) $this->cid,
            'draftId' => (int) $draftId,
            'status' => (string) $this->status,
            'type' => (string) $this->type,
            'permalink' => (string) $this->permalink,
        ];
    }

    /**
     * @param int[] $cids
     * @return int deleted count
     * @throws \Typecho\Db\Exception
     */
    public function v3aDelete(array $cids): int
    {
        $deleteCount = 0;

        foreach ($cids as $cid) {
            $post = (int) $cid;
            if ($post <= 0) {
                continue;
            }

            // 删除插件接口
            self::pluginHandle()->call('delete', $post, $this);

            $condition = $this->db->sql()->where('cid = ?', $post);
            $postObject = $this->db->fetchObject(
                $this->db->select('status', 'type')
                    ->from('table.contents')
                    ->where('cid = ? AND (type = ? OR type = ?)', $post, 'post', 'post_draft')
            );

            if ($this->isWriteable(clone $condition) && count((array) $postObject) && $this->delete($condition)) {
                /** 删除分类 */
                $this->setCategories(
                    $post,
                    [],
                    'publish' == $postObject->status && 'post' == $postObject->type
                );

                /** 删除标签 */
                $this->setTags(
                    $post,
                    null,
                    'publish' == $postObject->status && 'post' == $postObject->type
                );

                /** 删除评论 */
                $this->db->query($this->db->delete('table.comments')->where('cid = ?', $post));

                /** 解除附件关联 */
                $this->unAttach($post);

                /** 删除草稿 */
                $draft = $this->db->fetchRow(
                    $this->db->select('cid')
                        ->from('table.contents')
                        ->where('table.contents.parent = ? AND table.contents.type = ?', $post, 'revision')
                        ->limit(1)
                );

                /** 删除自定义字段 */
                $this->deleteFields($post);

                if (!empty($draft)) {
                    $this->deleteContent((int) $draft['cid']);
                    $this->deleteFields((int) $draft['cid']);
                }

                // 完成删除插件接口
                self::pluginHandle()->call('finishDelete', $post, $this);

                $deleteCount++;
            }
        }

        return $deleteCount;
    }

    /**
     * Override Typecho default meta count update to avoid UNSIGNED underflow.
     *
     * @throws \Typecho\Db\Exception
     */
    public function setCategories(int $cid, array $categories, bool $beforeCount = true, bool $afterCount = true)
    {
        $categories = array_unique(array_map('trim', $categories));

        /** Get existing categories */
        $existCategories = array_column(
            $this->db->fetchAll(
                $this->db->select('table.metas.mid')
                    ->from('table.metas')
                    ->join('table.relationships', 'table.relationships.mid = table.metas.mid')
                    ->where('table.relationships.cid = ?', $cid)
                    ->where('table.metas.type = ?', 'category')
            ),
            'mid'
        );

        /** Delete existing categories */
        if ($existCategories) {
            foreach ($existCategories as $category) {
                $this->db->query(
                    $this->db->delete('table.relationships')
                        ->where('cid = ?', $cid)
                        ->where('mid = ?', $category)
                );

                if ($beforeCount) {
                    $this->db->query(
                        $this->db->update('table.metas')
                            ->expression('count', 'CASE WHEN count > 0 THEN count - 1 ELSE 0 END', false)
                            ->where('mid = ?', $category)
                    );
                }
            }
        }

        /** Insert categories */
        if ($categories) {
            foreach ($categories as $category) {
                if (
                    !$this->db->fetchRow(
                        $this->db->select('mid')->from('table.metas')->where('mid = ?', $category)->limit(1)
                    )
                ) {
                    continue;
                }

                $this->db->query(
                    $this->db->insert('table.relationships')->rows(['mid' => $category, 'cid' => $cid])
                );

                if ($afterCount) {
                    $this->db->query(
                        $this->db->update('table.metas')
                            ->expression('count', 'count + 1')
                            ->where('mid = ?', $category)
                    );
                }
            }
        }
    }

    /**
     * Override Typecho default meta count update to avoid UNSIGNED underflow.
     *
     * @throws \Typecho\Db\Exception
     */
    public function setTags(int $cid, ?string $tags, bool $beforeCount = true, bool $afterCount = true)
    {
        $tags = str_replace('，', ',', $tags ?? '');
        $tags = array_unique(array_map('trim', explode(',', $tags)));
        $tags = array_filter($tags, [\Typecho\Validate::class, 'xssCheck']);

        /** Get existing tags */
        $existTags = array_column(
            $this->db->fetchAll(
                $this->db->select('table.metas.mid')
                    ->from('table.metas')
                    ->join('table.relationships', 'table.relationships.mid = table.metas.mid')
                    ->where('table.relationships.cid = ?', $cid)
                    ->where('table.metas.type = ?', 'tag')
            ),
            'mid'
        );

        /** Delete existing tags */
        if ($existTags) {
            foreach ($existTags as $tag) {
                if (0 == strlen($tag)) {
                    continue;
                }

                $this->db->query(
                    $this->db->delete('table.relationships')
                        ->where('cid = ?', $cid)
                        ->where('mid = ?', $tag)
                );

                if ($beforeCount) {
                    $this->db->query(
                        $this->db->update('table.metas')
                            ->expression('count', 'CASE WHEN count > 0 THEN count - 1 ELSE 0 END', false)
                            ->where('mid = ?', $tag)
                    );
                }
            }
        }

        /** Scan & insert tags */
        $insertTags = \Widget\Base\Metas::alloc()->scanTags($tags);

        if ($insertTags) {
            foreach ($insertTags as $tag) {
                if (0 == strlen($tag)) {
                    continue;
                }

                $this->db->query(
                    $this->db->insert('table.relationships')->rows(['mid' => $tag, 'cid' => $cid])
                );

                if ($afterCount) {
                    $this->db->query(
                        $this->db->update('table.metas')
                            ->expression('count', 'count + 1')
                            ->where('mid = ?', $tag)
                    );
                }
            }
        }
    }
}

class V3A_AttachmentEditProxy extends \Widget\Contents\Attachment\Edit
{
    /**
     * @param int[] $cids
     * @return int
     * @throws \Typecho\Db\Exception
     */
    public function v3aDelete(array $cids): int
    {
        $deleteCount = 0;
        $this->deleteByIds($cids, $deleteCount);
        return $deleteCount;
    }
}

class V3A_PageEditProxy extends \Widget\Contents\Page\Edit
{
    /**
     * @return array{cid:int,draftId:int|null,status:string,type:string,permalink:string,parent:int,template:string}
     * @throws \Typecho\Db\Exception
     * @throws \Typecho\Widget\Exception
     */
    public function v3aWrite(string $mode): array
    {
        $this->prepare();

        $contents = $this->request->from(
            'text',
            'template',
            'allowComment',
            'allowPing',
            'allowFeed',
            'slug',
            'order',
            'visibility'
        );

        $contents['title'] = $this->request->get('title', _t('未命名页面'));
        $contents['created'] = $this->getCreated();
        $contents['parent'] = $this->getParent();

        if ($this->request->is('markdown=1') && $this->options->markdown) {
            $contents['text'] = '<!--markdown-->' . $contents['text'];
        }

        $contents = self::pluginHandle()->filter('write', $contents, $this);

        if ($mode === 'publish') {
            $contents['type'] = 'page';
            $this->publish($contents, false);

            self::pluginHandle()->call('finishPublish', $contents, $this);
            \Widget\Service::alloc()->sendPing($this);

            return [
                'cid' => (int) $this->cid,
                'draftId' => null,
                'status' => (string) $this->status,
                'type' => (string) $this->type,
                'permalink' => (string) $this->permalink,
                'parent' => (int) $this->parent,
                'template' => (string) $this->template,
            ];
        }

        $contents['type'] = 'page_draft';
        $draftId = $this->save($contents, false);

        self::pluginHandle()->call('finishSave', $contents, $this);

        return [
            'cid' => (int) $this->cid,
            'draftId' => (int) $draftId,
            'status' => (string) $this->status,
            'type' => (string) $this->type,
            'permalink' => (string) $this->permalink,
            'parent' => (int) $this->parent,
            'template' => (string) $this->template,
        ];
    }

    /**
     * @param int[] $cids
     * @return int deleted count
     * @throws \Typecho\Db\Exception
     */
    public function v3aDelete(array $cids): int
    {
        $deleteCount = 0;

        foreach ($cids as $cid) {
            $page = (int) $cid;
            if ($page <= 0) {
                continue;
            }

            // 删除插件接口
            self::pluginHandle()->call('delete', $page, $this);

            $parent = (int) ($this->db->fetchObject($this->select()->where('cid = ?', $page))->parent ?? 0);

            if ($this->delete($this->db->sql()->where('cid = ?', $page))) {
                /** 删除评论 */
                $this->db->query($this->db->delete('table.comments')->where('cid = ?', $page));

                /** 解除附件关联 */
                $this->unAttach($page);

                /** 解除首页关联 */
                if ($this->options->frontPage == 'page:' . $page) {
                    $this->db->query(
                        $this->db->update('table.options')->rows(['value' => 'recent'])->where('name = ?', 'frontPage')
                    );
                }

                /** 删除草稿 */
                $draft = $this->db->fetchRow(
                    $this->db->select('cid')
                        ->from('table.contents')
                        ->where('table.contents.parent = ? AND table.contents.type = ?', $page, 'revision')
                        ->limit(1)
                );

                /** 删除自定义字段 */
                $this->deleteFields($page);

                if (!empty($draft)) {
                    $this->deleteContent((int) $draft['cid'], false);
                    $this->deleteFields((int) $draft['cid']);
                }

                // update parent
                $this->update(
                    ['parent' => $parent],
                    $this->db->sql()
                        ->where('parent = ?', $page)
                        ->where('type = ? OR type = ?', 'page', 'page_draft')
                );

                // 完成删除插件接口
                self::pluginHandle()->call('finishDelete', $page, $this);

                $deleteCount++;
            }
        }

        return $deleteCount;
    }
}

class V3A_CommentsEditProxy extends \Widget\Comments\Edit
{
    /**
     * @throws \Typecho\Db\Exception
     */
    private function v3aMarkOne(int $coid, string $status): bool
    {
        $comment = $this->db->fetchRow(
            $this->select()->where('coid = ?', $coid)->limit(1),
            [$this, 'push']
        );

        if ($comment && $this->commentIsWriteable()) {
            /** 增加评论编辑插件接口 */
            self::pluginHandle()->call('mark', $comment, $this, $status);

            /** 不必更新的情况 */
            if ($status == $comment['status']) {
                return false;
            }

            /** 更新评论 */
            $this->db->query(
                $this->db->update('table.comments')->rows(['status' => $status])->where('coid = ?', $coid)
            );

            /** 更新相关内容的评论数 */
            if ('approved' == $comment['status'] && 'approved' != $status) {
                $this->db->query(
                    $this->db->update('table.contents')
                        ->expression('commentsNum', 'commentsNum - 1')
                        ->where('cid = ? AND commentsNum > 0', $comment['cid'])
                );
            } elseif ('approved' != $comment['status'] && 'approved' == $status) {
                $this->db->query(
                    $this->db->update('table.contents')
                        ->expression('commentsNum', 'commentsNum + 1')
                        ->where('cid = ?', $comment['cid'])
                );
            }

            return true;
        }

        return false;
    }

    /**
     * @param int[] $coids
     * @throws \Typecho\Db\Exception
     */
    public function v3aMark(array $coids, string $status): int
    {
        $updateRows = 0;
        foreach ($coids as $coid) {
            if ($this->v3aMarkOne((int) $coid, $status)) {
                $updateRows++;
            }
        }
        return $updateRows;
    }

    /**
     * @param int[] $coids
     * @throws \Typecho\Db\Exception
     */
    public function v3aDelete(array $coids): int
    {
        $deleteRows = 0;

        foreach ($coids as $coid) {
            $comment = $this->db->fetchRow(
                $this->select()->where('coid = ?', (int) $coid)->limit(1),
                [$this, 'push']
            );

            if ($comment && $this->commentIsWriteable()) {
                self::pluginHandle()->call('delete', $comment, $this);

                /** 删除评论 */
                $this->db->query($this->db->delete('table.comments')->where('coid = ?', (int) $coid));

                /** 更新相关内容的评论数 */
                if ('approved' == $comment['status']) {
                    $this->db->query(
                        $this->db->update('table.contents')
                            ->expression('commentsNum', 'commentsNum - 1')
                            ->where('cid = ?', $comment['cid'])
                    );
                }

                self::pluginHandle()->call('finishDelete', $comment, $this);

                $deleteRows++;
            }
        }

        return $deleteRows;
    }

    /**
     * @return array updated comment
     * @throws \Typecho\Db\Exception
     */
    public function v3aEdit(int $coid): array
    {
        $commentSelect = $this->db->fetchRow(
            $this->select()->where('coid = ?', $coid)->limit(1),
            [$this, 'push']
        );

        if ($commentSelect && $this->commentIsWriteable()) {
            $comment = [];
            $comment['text'] = $this->request->get('text');
            $comment['author'] = $this->request->filter('strip_tags', 'trim', 'xss')->get('author');
            $comment['mail'] = $this->request->filter('strip_tags', 'trim', 'xss')->get('mail');
            $comment['url'] = $this->request->filter('url')->get('url');

            if ($this->request->is('created')) {
                $comment['created'] = $this->request->filter('int')->get('created');
            }

            /** 评论插件接口 */
            $comment = self::pluginHandle()->filter('edit', $comment, $this);

            /** 更新评论 */
            $this->update($comment, $this->db->sql()->where('coid = ?', $coid));

            $updated = $this->db->fetchRow(
                $this->select()->where('coid = ?', $coid)->limit(1),
                [$this, 'push']
            );
            if (is_array($updated)) {
                $updated['content'] = $this->content;
            }

            /** 评论插件接口 */
            self::pluginHandle()->call('finishEdit', $this);

            return is_array($updated) ? $updated : [];
        }

        throw new \RuntimeException('Edit comment failed');
    }

    /**
     * @return array inserted comment
     * @throws \Typecho\Db\Exception
     */
    public function v3aReply(int $coid): array
    {
        $commentSelect = $this->db->fetchRow(
            $this->select()->where('coid = ?', $coid)->limit(1),
            [$this, 'push']
        );

        if ($commentSelect && $this->commentIsWriteable()) {
            $comment = [
                'cid' => $commentSelect['cid'],
                'created' => $this->options->time,
                'agent' => $this->request->getAgent(),
                'ip' => $this->request->getIp(),
                'ownerId' => $commentSelect['ownerId'],
                'authorId' => $this->user->uid,
                'type' => 'comment',
                'author' => $this->user->screenName,
                'mail' => $this->user->mail,
                'url' => $this->user->url,
                'parent' => $coid,
                'text' => $this->request->get('text'),
                'status' => 'approved',
            ];

            /** 评论插件接口 */
            self::pluginHandle()->call('comment', $comment, $this);

            /** 回复评论 */
            $commentId = $this->insert($comment);

            $inserted = $this->db->fetchRow(
                $this->select()->where('coid = ?', $commentId)->limit(1),
                [$this, 'push']
            );
            if (is_array($inserted)) {
                $inserted['content'] = $this->content;
            }

            /** 评论完成接口 */
            self::pluginHandle()->call('finishComment', $this);

            return is_array($inserted) ? $inserted : [];
        }

        throw new \RuntimeException('Reply comment failed');
    }
}

try {
    $db = \Typecho\Db::get();

    // API 调用日志：Vue3Admin 后台面板不写入 v3a_api_log（避免把后台请求计入统计/污染数据）。

    $do = trim((string) $request->get('do'));

	    if ($do === 'upgrade.settings.get') {
	        v3a_require_role($user, 'administrator');
	        $acl = v3a_acl_for_user($db, $user);
	        if (empty($acl['maintenance']['manage'])) {
	            v3a_exit_json(403, null, 'Forbidden');
	        }

        $value = '';
        try {
            $value = (string) ($db->fetchObject(
                $db->select('value')->from('table.options')->where('name = ? AND user = ?', 'v3a_upgrade_settings', 0)->limit(1)
            )->value ?? '');
        } catch (\Throwable $e) {
            $value = '';
        }
	
	        $cfg = v3a_json_assoc($value);
	        $network = strtolower(trim((string) ($cfg['network'] ?? '')));
	        if (!in_array($network, ['gitcode', 'github', 'ghfast'], true)) {
	            $network = 'github';
	        }
	        v3a_exit_json(0, [
	            'strict' => !empty($cfg['strict']) ? 1 : 0,
	            'globalReplace' => !empty($cfg['globalReplace']) ? 1 : 0,
	            'network' => $network,
	        ]);
	    }

    if ($do === 'upgrade.settings.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

	        $payload = v3a_payload();
	        $strict = !empty($payload['strict']) ? 1 : 0;
	        $globalReplace = !empty($payload['globalReplace']) ? 1 : 0;
	        $network = strtolower(trim((string) ($payload['network'] ?? '')));
	        if (!in_array($network, ['gitcode', 'github', 'ghfast'], true)) {
	            $network = 'github';
	        }
	
	        $cfg = [
	            'strict' => $strict,
	            'globalReplace' => $globalReplace,
	            'network' => $network,
	            'updatedAt' => time(),
	        ];
	        v3a_upsert_option($db, 'v3a_upgrade_settings', json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 0);
	
	        v3a_exit_json(0, [
	            'strict' => $strict,
	            'globalReplace' => $globalReplace,
	            'network' => $network,
	        ]);
	    }

	    if ($do === 'upgrade.releases') {
	        v3a_require_role($user, 'administrator');
	        $acl = v3a_acl_for_user($db, $user);
	        if (empty($acl['maintenance']['manage'])) {
	            v3a_exit_json(403, null, 'Forbidden');
	        }
	
	        $strict = 0;
	        try {
	            $strict = !empty($request->get('strict')) ? 1 : 0;
	        } catch (\Throwable $e) {
	            $strict = 0;
	        }
	
	        $network = '';
	        try {
	            $network = trim((string) $request->get('network'));
	        } catch (\Throwable $e) {
	            $network = '';
	        }
	        if ($network === '') {
	            try {
	                $raw = (string) ($db->fetchObject(
	                    $db->select('value')->from('table.options')->where('name = ? AND user = ?', 'v3a_upgrade_settings', 0)->limit(1)
	                )->value ?? '');
	                $cfg = v3a_json_assoc($raw);
	                $network = (string) ($cfg['network'] ?? '');
	            } catch (\Throwable $e) {
	                $network = '';
	            }
	        }
	        $network = strtolower(trim($network));
	        if (!in_array($network, ['gitcode', 'github', 'ghfast'], true)) {
	            $network = 'github';
	        }
	
	        $proxy = $network === 'ghfast' ? 'https://ghfast.top/' : '';
	
	        $headers = [
	            'Accept' => 'application/vnd.github+json',
	            'User-Agent' => 'Vue3Admin-Typecho',
	        ];

	        $now = time();
	        $cacheName = ($strict ? 'v3a_upgrade_releases_cache_strict_' : 'v3a_upgrade_releases_cache_') . $network;
	        $cacheTtl = 300;
	        $cached = null;
	        try {
	            $raw = (string) ($db->fetchObject(
	                $db->select('value')->from('table.options')->where('name = ? AND user = ?', $cacheName, 0)->limit(1)
            )->value ?? '');
            $obj = v3a_json_assoc($raw);
            $ts = (int) ($obj['time'] ?? 0);
            $data = $obj['data'] ?? null;
            if ($ts > 0 && ($now - $ts) < $cacheTtl && is_array($data)) {
                $cached = $data;
            }
        } catch (\Throwable $e) {
            $cached = null;
        }

        $remote = $cached;
        if (!is_array($remote)) {
	            $remote = [
	                'fetchedAt' => $now,
	                'releases' => [],
	                'latest' => null,
	                'latestCommit' => null,
	            ];
	
	            $releasesUrl = $proxy . 'https://api.github.com/repos/TGU-HansJack/Vue3Admin-Typecho/releases?per_page=20';
	            $rows = v3a_http_get_json($releasesUrl, $headers, 8);
	            $out = [];
	            if (is_array($rows)) {
	                foreach ($rows as $r) {
	                    if (!is_array($r)) {
                        continue;
                    }
                    $tag = trim((string) ($r['tag_name'] ?? ''));
                    if ($tag === '') {
                        continue;
                    }
                    $out[] = [
                        'tag' => $tag,
                        'version' => v3a_normalize_semver($tag),
                        'name' => (string) ($r['name'] ?? ''),
                        'body' => (string) ($r['body'] ?? ''),
                        'url' => (string) ($r['html_url'] ?? ''),
                        'publishedAt' => (string) ($r['published_at'] ?? ''),
                        'isPrerelease' => !empty($r['prerelease']) ? 1 : 0,
                        'isDraft' => !empty($r['draft']) ? 1 : 0,
                    ];
                }
            }

            $latest = null;
            foreach ($out as $r) {
                if (!empty($r['isDraft'])) {
                    continue;
                }
                $latest = $r;
                break;
            }

            $remote['releases'] = $out;
            $remote['latest'] = $latest;
	
	            if ($strict) {
	                try {
	                    $commitsUrl = $proxy . 'https://api.github.com/repos/TGU-HansJack/Vue3Admin-Typecho/commits?per_page=1';
	                    $rows = v3a_http_get_json($commitsUrl, $headers, 8);
	                    $commitRow = null;
	                    if (is_array($rows) && isset($rows[0]) && is_array($rows[0])) {
	                        $commitRow = $rows[0];
                    } elseif (is_array($rows) && isset($rows['sha'])) {
                        $commitRow = $rows;
                    }

                    if (is_array($commitRow)) {
                        $sha = (string) ($commitRow['sha'] ?? '');
                        $msg = '';
                        $date = '';
                        try {
                            $msg = (string) ($commitRow['commit']['message'] ?? '');
                            $date = (string) ($commitRow['commit']['author']['date'] ?? '');
                        } catch (\Throwable $e) {
                        }
                        $remote['latestCommit'] = [
                            'sha' => $sha,
                            'short' => $sha !== '' ? substr($sha, 0, 7) : '',
                            'message' => $msg,
                            'date' => $date,
                            'url' => (string) ($commitRow['html_url'] ?? ''),
                        ];
                    }
                } catch (\Throwable $e) {
                    $remote['latestCommit'] = null;
                }
            }

            try {
                v3a_upsert_option($db, $cacheName, json_encode(['time' => $now, 'data' => $remote], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 0);
            } catch (\Throwable $e) {
            }
        }

        $cur = v3a_vue3admin_version_info();
        $currentVersion = (string) ($cur['version'] ?? '');
        $currentBuild = (int) ($cur['build'] ?? 0);

        $latest = is_array($remote['latest'] ?? null) ? (array) $remote['latest'] : null;
        $latestVer = $latest ? (string) ($latest['version'] ?? '') : '';

        $updateAvailable = 0;
        if ($currentVersion !== '' && $latestVer !== '' && function_exists('version_compare')) {
            $updateAvailable = version_compare($latestVer, $currentVersion, '>') ? 1 : 0;
        }

        $strictUpdateAvailable = 0;
        if ($strict && $currentBuild > 0 && is_array($remote['latestCommit'] ?? null)) {
            $date = (string) ($remote['latestCommit']['date'] ?? '');
            $ts = $date !== '' ? (int) strtotime($date) : 0;
            if ($ts > 0 && $ts > $currentBuild) {
                $strictUpdateAvailable = 1;
            }
        }

        v3a_exit_json(0, [
            'current' => $cur,
            'latest' => $latest,
            'updateAvailable' => $updateAvailable,
            'releases' => $remote['releases'] ?? [],
            'strict' => $strict ? 1 : 0,
            'latestCommit' => $remote['latestCommit'] ?? null,
            'strictUpdateAvailable' => $strictUpdateAvailable,
        ]);
    }

    if ($do === 'upgrade.run') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

	        $payload = v3a_payload();
	        $strict = !empty($payload['strict']) ? 1 : 0;
	        $globalReplace = !empty($payload['globalReplace']) ? 1 : 0;
	        $network = strtolower(trim((string) ($payload['network'] ?? '')));
	        if (!in_array($network, ['gitcode', 'github', 'ghfast'], true)) {
	            $network = 'github';
	        }
	        $proxy = $network === 'ghfast' ? 'https://ghfast.top/' : '';
	
	        $headers = [
	            'Accept' => 'application/vnd.github+json',
	            'User-Agent' => 'Vue3Admin-Typecho',
	        ];

        $cur = v3a_vue3admin_version_info();
        $currentVersion = (string) ($cur['version'] ?? '');
        $currentBuild = (int) ($cur['build'] ?? 0);

        $zipUrl = '';
        $targetLabel = '';
        $targetKind = $strict ? 'commit' : 'release';

        $latestVer = '';
        $latestCommitTs = 0;

        try {
            if ($strict) {
	                $commitsUrl = $proxy . 'https://api.github.com/repos/TGU-HansJack/Vue3Admin-Typecho/commits?per_page=1';
                $rows = v3a_http_get_json($commitsUrl, $headers, 12);
                $commitRow = null;
                if (is_array($rows) && isset($rows[0]) && is_array($rows[0])) {
                    $commitRow = $rows[0];
                } elseif (is_array($rows) && isset($rows['sha'])) {
                    $commitRow = $rows;
                }

                if (!is_array($commitRow)) {
                    v3a_exit_json(502, null, '获取最新 commit 失败');
                }

                $sha = trim((string) ($commitRow['sha'] ?? ''));
                if ($sha === '') {
                    v3a_exit_json(502, null, '获取最新 commit 失败');
                }

                $date = '';
                try {
                    $date = (string) ($commitRow['commit']['author']['date'] ?? '');
                } catch (\Throwable $e) {
                }
                $latestCommitTs = $date !== '' ? (int) strtotime($date) : 0;

                $targetLabel = substr($sha, 0, 7);
	                $zipUrl = $network === 'gitcode'
	                    ? ('https://gitcode.com/TGU-HansJack/Vue3Admin-Typecho/archive/' . rawurlencode($sha) . '.zip')
	                    : ($proxy . 'https://codeload.github.com/TGU-HansJack/Vue3Admin-Typecho/zip/' . rawurlencode($sha));
            } else {
	                $releasesUrl = $proxy . 'https://api.github.com/repos/TGU-HansJack/Vue3Admin-Typecho/releases?per_page=20';
                $rows = v3a_http_get_json($releasesUrl, $headers, 12);
                $latestRow = null;
                if (is_array($rows)) {
                    foreach ($rows as $r) {
                        if (!is_array($r)) {
                            continue;
                        }
                        if (!empty($r['draft'])) {
                            continue;
                        }
                        $tag = trim((string) ($r['tag_name'] ?? ''));
                        if ($tag === '') {
                            continue;
                        }
                        $latestRow = $r;
                        break;
                    }
                }

                if (!is_array($latestRow)) {
                    v3a_exit_json(502, null, '未找到可用的 release');
                }

                $tag = trim((string) ($latestRow['tag_name'] ?? ''));
                if ($tag === '') {
                    v3a_exit_json(502, null, '未找到可用的 release');
                }

                $latestVer = v3a_normalize_semver($tag);
                $targetLabel = $tag;
	                $zipUrl = $network === 'gitcode'
	                    ? ('https://gitcode.com/TGU-HansJack/Vue3Admin-Typecho/archive/' . rawurlencode($tag) . '.zip')
	                    : ($proxy . 'https://codeload.github.com/TGU-HansJack/Vue3Admin-Typecho/zip/refs/tags/' . rawurlencode($tag));
            }
        } catch (\Throwable $e) {
            v3a_exit_json(502, null, $e->getMessage() !== '' ? $e->getMessage() : '获取升级源失败');
        }

        // Server-side safety check: allow repeated runs but give a friendly message when already latest.
        if ($strict) {
            if ($currentBuild > 0 && $latestCommitTs > 0 && $latestCommitTs <= $currentBuild) {
                v3a_exit_json(0, [
                    'updated' => 0,
                    'strict' => 1,
                    'globalReplace' => $globalReplace ? 1 : 0,
                    'target' => $targetLabel,
                    'kind' => $targetKind,
                    'message' => '当前已是最新版本（commit）',
                ]);
            }
        } else {
            if (
                $currentVersion !== ''
                && $latestVer !== ''
                && function_exists('version_compare')
                && !version_compare($latestVer, $currentVersion, '>')
            ) {
                v3a_exit_json(0, [
                    'updated' => 0,
                    'strict' => 0,
                    'globalReplace' => $globalReplace ? 1 : 0,
                    'target' => $targetLabel,
                    'kind' => $targetKind,
                    'message' => '当前已是最新版本（release）',
                ]);
            }
        }

        $tmpDir = '';
        try {
            $tmpRoot = rtrim((string) @sys_get_temp_dir(), '/\\');
            if ($tmpRoot === '') {
                $tmpRoot = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr' . DIRECTORY_SEPARATOR . 'uploads';
            }
            $tmpDir = $tmpRoot . DIRECTORY_SEPARATOR . 'v3a_upgrade_' . date('Ymd_His') . '_' . substr(md5((string) mt_rand()), 0, 8);
            $zipPath = $tmpDir . DIRECTORY_SEPARATOR . 'package.zip';
            $extractDir = $tmpDir . DIRECTORY_SEPARATOR . 'extract';
            v3a_mkdir_p($extractDir);

            $downloadHeaders = [
                'Accept' => 'application/octet-stream',
                'User-Agent' => 'Vue3Admin-Typecho',
            ];

            v3a_http_download_to_file($zipUrl, $zipPath, $downloadHeaders, 60);
            if (!is_file($zipPath) || (int) (@filesize($zipPath) ?: 0) < 1024) {
                throw new \RuntimeException('下载升级包失败');
            }
            $sig = @file_get_contents($zipPath, false, null, 0, 4);
            if (!is_string($sig) || substr($sig, 0, 2) !== 'PK') {
                throw new \RuntimeException('升级包不是有效的 ZIP 文件');
            }

            v3a_extract_zip_to($zipPath, $extractDir);
            $pkgRoot = v3a_find_vue3admin_plugin_root($extractDir);
            if ($pkgRoot === '') {
                throw new \RuntimeException('升级包结构异常：未找到 Vue3Admin 插件目录');
            }

            $pluginDir = '';
            try {
                $pluginDir = (string) ($options->pluginDir('Vue3Admin') ?? '');
            } catch (\Throwable $e) {
                $pluginDir = '';
            }
            if ($pluginDir === '') {
                $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                    . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'Vue3Admin';
            }
            $pluginDir = rtrim($pluginDir, '/\\');

            if (!is_dir($pluginDir)) {
                throw new \RuntimeException('插件目录不存在：' . $pluginDir);
            }

            $pluginUpdated = 0;
            $pluginUpdateError = '';
            try {
                v3a_copy_directory($pkgRoot, $pluginDir);
                $pluginUpdated = 1;
            } catch (\Throwable $e) {
                $pluginUpdated = 0;
                $pluginUpdateError = $e->getMessage();
                if (!$globalReplace) {
                    throw $e;
                }
            }

            $deployed = 0;
            if ($globalReplace) {
                $adminSource = rtrim($pkgRoot, '/\\') . DIRECTORY_SEPARATOR . 'admin';
                if (!is_dir($adminSource)) {
                    throw new \RuntimeException('升级包缺少 admin 目录');
                }

                $deployDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'Vue3Admin';
                $deployDir = rtrim($deployDir, '/\\');

                v3a_copy_directory($adminSource, $deployDir);

                $deployVersion = v3a_vue3admin_deploy_version_from_plugin($pkgRoot);
                if ($deployVersion === '') {
                    $deployVersion = v3a_vue3admin_deploy_version_from_plugin($pluginDir);
                }
                if ($deployVersion !== '') {
                    @file_put_contents($deployDir . DIRECTORY_SEPARATOR . '.v3a_deploy_version', $deployVersion);
                }

                $deployed = 1;
            }

	            // Clear release cache so the UI can reflect the updated state immediately.
	            try {
	                $keys = [
	                    'v3a_upgrade_releases_cache',
	                    'v3a_upgrade_releases_cache_strict',
	                ];
	                foreach (['github', 'gitcode', 'ghfast'] as $net) {
	                    $keys[] = 'v3a_upgrade_releases_cache_' . $net;
	                    $keys[] = 'v3a_upgrade_releases_cache_strict_' . $net;
	                }
	                foreach ($keys as $k) {
	                    v3a_upsert_option($db, $k, '', 0);
	                }
	            } catch (\Throwable $e) {
	            }

            $message = $globalReplace
                ? '已完成升级，并已同步更新站点 /Vue3Admin/ 目录。'
                : '已完成升级（未开启全局替换，站点 /Vue3Admin/ 目录未更新）。';
            if (!$pluginUpdated) {
                $message .= ' 注意：插件目录更新失败（请检查 usr/plugins/Vue3Admin 写权限），但已完成 /Vue3Admin/ 更新。';
                if ($pluginUpdateError !== '') {
                    $message .= ' 错误：' . $pluginUpdateError;
                }
            }

            v3a_rmdir_recursive($tmpDir);
            $tmpDir = '';

            v3a_exit_json(0, [
                'updated' => 1,
                'strict' => $strict ? 1 : 0,
                'globalReplace' => $globalReplace ? 1 : 0,
                'pluginUpdated' => $pluginUpdated ? 1 : 0,
                'pluginUpdateError' => $pluginUpdateError,
                'deployed' => $deployed,
                'target' => $targetLabel,
                'kind' => $targetKind,
                'message' => $message,
            ]);
        } catch (\Throwable $e) {
            if ($tmpDir !== '') {
                v3a_rmdir_recursive($tmpDir);
            }
            v3a_exit_json(500, null, $e->getMessage() !== '' ? $e->getMessage() : '升级失败');
        }
    }

    if ($do === 'workshop.list') {
        v3a_require_role($user, 'administrator');

        $parseGithub = function (string $url): array {
            $url = trim($url);
            if ($url === '') {
                return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
            }

            // git@github.com:owner/repo(.git)
            if (preg_match('/^git@github\\.com:([^\\/\\s]+)\\/([^\\s]+?)(?:\\.git)?$/i', $url, $m)) {
                return ['owner' => (string) ($m[1] ?? ''), 'repo' => (string) ($m[2] ?? ''), 'branch' => '', 'subdir' => ''];
            }

            if (!preg_match('/^https?:\\/\\//i', $url)) {
                return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
            }

            $parts = @parse_url($url);
            if (!is_array($parts)) {
                return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
            }

            $host = strtolower((string) ($parts['host'] ?? ''));
            if ($host === 'www.github.com') {
                $host = 'github.com';
            }

            $path = (string) ($parts['path'] ?? '');
	            $segs = array_values(array_filter(explode('/', trim($path, '/')), function ($v) {
	                return $v !== '';
	            }));

            if ($host === 'github.com') {
                if (count($segs) < 2) {
                    return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
                }

                $owner = (string) ($segs[0] ?? '');
                $repo = (string) ($segs[1] ?? '');
                $repo = preg_replace('/\\.git$/i', '', $repo);

                $branch = '';
                $subdir = '';
                if (isset($segs[2]) && $segs[2] === 'tree' && isset($segs[3])) {
                    $branch = (string) ($segs[3] ?? '');
                    $rest = array_slice($segs, 4);
                    $subdir = $rest ? implode('/', $rest) : '';
                }

                return ['owner' => $owner, 'repo' => $repo, 'branch' => $branch, 'subdir' => $subdir];
            }

            if ($host === 'raw.githubusercontent.com') {
                if (count($segs) < 3) {
                    return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
                }
                $owner = (string) ($segs[0] ?? '');
                $repo = (string) ($segs[1] ?? '');
                $branch = (string) ($segs[2] ?? '');
                $rest = array_slice($segs, 3);
                $subdir = $rest ? implode('/', $rest) : '';
                return ['owner' => $owner, 'repo' => $repo, 'branch' => $branch, 'subdir' => $subdir];
            }

            return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
        };

        $pickStr = function (array $item, array $keys, string $default = ''): string {
            foreach ($keys as $k) {
                if (!array_key_exists($k, $item)) {
                    continue;
                }
                $v = $item[$k];
                if (is_string($v) || is_numeric($v)) {
                    $s = trim((string) $v);
                    if ($s !== '') {
                        return $s;
                    }
                }
            }
            return $default;
        };

        $pickAny = function (array $item, array $keys) {
            foreach ($keys as $k) {
                if (array_key_exists($k, $item)) {
                    return $item[$k];
                }
            }
            return null;
        };

        $pickBool = function (array $item, array $keys, ?bool $default = null): ?bool {
            foreach ($keys as $k) {
                if (!array_key_exists($k, $item)) {
                    continue;
                }
                $v = $item[$k];
                if (is_bool($v)) {
                    return $v;
                }
                if (is_numeric($v)) {
                    return ((int) $v) ? true : false;
                }
                if (is_string($v)) {
                    $vv = strtolower(trim($v));
                    if (in_array($vv, ['1', 'true', 'yes', 'on'], true)) {
                        return true;
                    }
                    if (in_array($vv, ['0', 'false', 'no', 'off'], true)) {
                        return false;
                    }
                }
            }
            return $default;
        };

        $localRepo = '';
        $localFile = '';
        try {
            $rootDir = defined('__TYPECHO_ROOT_DIR__') ? (string) __TYPECHO_ROOT_DIR__ : dirname(__DIR__);
            $parent = rtrim(dirname(rtrim($rootDir, "/\\")), "/\\");
            $localRepo = $parent . DIRECTORY_SEPARATOR . 'Craft-Typecho';
            $localFile = rtrim($localRepo, "/\\") . DIRECTORY_SEPARATOR . 'repo.json';
        } catch (\Throwable $e) {
            $localRepo = '';
            $localFile = '';
        }

        $meta = [
            'source' => '',
            'sourceText' => '',
            'path' => '',
            'url' => '',
            'updatedAt' => 0,
            'fetchedAt' => time(),
            'candidates' => [],
        ];

        $decoded = null;
	        if ($localFile !== '' && is_file($localFile)) {
	            $raw = (string) @file_get_contents($localFile);
	            $decoded = json_decode($raw, true);
	            if (!is_array($decoded)) {
	                v3a_exit_json(400, null, 'Invalid local repo.json');
	            }

            $meta['source'] = 'local';
            $meta['sourceText'] = '本地';
	            $meta['path'] = $localFile;
	            $meta['updatedAt'] = (int) (@filemtime($localFile) ?: 0);
	        } else {
	            $candidates = [
	                'https://cdn.jsdelivr.net/gh/TGU-HansJack/Craft-Typecho@main/repo.json',
	            ];
	            $meta['candidates'] = $candidates;
	
	            $headers = [
	                'Accept' => 'application/json',
	                'User-Agent' => 'Vue3Admin-Typecho',
            ];

            $lastErr = '';
            foreach ($candidates as $u) {
                try {
                    $decoded = v3a_http_get_json($u, $headers, 15);
                    $meta['source'] = 'remote';
                    $meta['sourceText'] = '远程';
                    $meta['url'] = $u;
                    $meta['updatedAt'] = time();
                    break;
                } catch (\Throwable $e) {
                    $lastErr = $e->getMessage();
                    $decoded = null;
                }
            }

            if (!is_array($decoded)) {
                $suffix = $lastErr !== '' ? (': ' . $lastErr) : '';
                v3a_exit_json(404, null, 'repo.json not found' . $suffix);
            }
        }

        $itemsRaw = [];
        if (is_array($decoded)) {
            if (array_values($decoded) === $decoded) {
                $itemsRaw = $decoded;
            } elseif (isset($decoded['projects']) && is_array($decoded['projects'])) {
                $itemsRaw = $decoded['projects'];
            } elseif (isset($decoded['items']) && is_array($decoded['items'])) {
                $itemsRaw = $decoded['items'];
            } elseif (isset($decoded['list']) && is_array($decoded['list'])) {
                $itemsRaw = $decoded['list'];
            } elseif (isset($decoded['data']) && is_array($decoded['data'])) {
                if (isset($decoded['data']['projects']) && is_array($decoded['data']['projects'])) {
                    $itemsRaw = $decoded['data']['projects'];
                } elseif (array_values($decoded['data']) === $decoded['data']) {
                    $itemsRaw = $decoded['data'];
                }
            }

            if (!$meta['updatedAt'] && isset($decoded['updatedAt'])) {
                $ua = $decoded['updatedAt'];
                if (is_numeric($ua)) {
                    $meta['updatedAt'] = (int) $ua;
                } elseif (is_string($ua)) {
                    $ts = @strtotime($ua);
                    if (is_int($ts) && $ts > 0) {
                        $meta['updatedAt'] = $ts;
                    }
                }
            }
        }

        $pluginBase = rtrim((string) __TYPECHO_ROOT_DIR__, "/\\") . (string) __TYPECHO_PLUGIN_DIR__;
        $themeBase = rtrim((string) __TYPECHO_ROOT_DIR__, "/\\") . (string) __TYPECHO_THEME_DIR__;

        $out = [];
        foreach ((array) $itemsRaw as $idx => $it) {
            if (!is_array($it)) {
                continue;
            }

            $name = $pickStr($it, ['name', 'title', 'projectName', '项目名称'], '');
            $typeRaw = strtolower($pickStr($it, ['type', 'projectType', '项目类型'], ''));
            if ($typeRaw === '插件') {
                $typeRaw = 'plugin';
            } elseif ($typeRaw === '主题') {
                $typeRaw = 'theme';
            }
            $type = $typeRaw;

            $link = $pickStr($it, ['link', 'url', 'repo', 'projectLink', '项目链接'], '');
            $desc = $pickStr($it, ['description', 'desc', 'intro', 'projectIntro', '项目介绍'], '');
            $typecho = $pickAny($it, ['typecho', 'typechoVersion', 'typechoVersions', 'supportTypecho', '支持Typecho版本']);
            $ver = $pickStr($it, ['version', 'projectVersion', '项目的版本号'], '');
            $author = $pickStr($it, ['author', '作者'], '');
            $readme = $pickStr($it, ['readme', 'readmeUrl', 'docs', 'docsUrl', 'documentation', 'doc', 'manual', '使用文档', '文档'], '');

            $gh = $parseGithub($link);
            $isGithub = $pickBool($it, ['isGithub', 'isGitHub', 'github', '是否GitHub仓库'], null);
            if ($isGithub === null) {
                $isGithub = ($gh['owner'] !== '' && $gh['repo'] !== '');
            }

            $direct = $pickBool($it, ['direct', 'directFetch', 'supportDirect', 'supportsDirect', '是否支持直接获取', '支持直接获取'], null);
            if ($direct === null) {
                $direct = $isGithub ? true : false;
            }

            $branch = $pickStr($it, ['branch', 'ref', 'defaultBranch'], '');
            if ($branch === '') {
                $branch = (string) ($gh['branch'] ?? '');
            }
            $subdir = $pickStr($it, ['subdir', 'path', 'subPath', '子目录'], '');
            if ($subdir === '') {
                $subdir = (string) ($gh['subdir'] ?? '');
            }

            $dir = $pickStr($it, ['dir', 'installDir', 'folder', 'directory', 'slug', '目录'], '');
            if ($dir === '' && $gh['repo'] !== '') {
                $dir = (string) $gh['repo'];
            }

            $dir = trim($dir);
            if ($dir !== '' && !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]*$/', $dir)) {
                $dir = '';
            }

            $canInstall = false;
            if (in_array($type, ['plugin', 'theme'], true) && $link !== '' && $isGithub && $direct && $dir !== '') {
                $canInstall = true;
            }

            $installed = false;
            if ($canInstall) {
                $base = $type === 'theme' ? $themeBase : $pluginBase;
                $target = rtrim($base, "/\\") . DIRECTORY_SEPARATOR . $dir;
                $installed = is_dir($target);
            }

            $id = $pickStr($it, ['id', 'key'], '');
            if ($id === '') {
                $id = substr(md5($type . '|' . $dir . '|' . $link . '|' . (string) $idx), 0, 12);
            }

            $out[] = [
                'id' => $id,
                'name' => $name !== '' ? $name : ($dir !== '' ? $dir : ('项目' . (string) ($idx + 1))),
                'type' => $type,
                'link' => $link,
                'description' => $desc,
                'typecho' => $typecho,
                'version' => $ver,
                'author' => $author,
                'readme' => $readme,
                'isGithub' => $isGithub ? 1 : 0,
                'direct' => $direct ? 1 : 0,
                'branch' => $branch,
                'subdir' => $subdir,
                'dir' => $dir,
                'canInstall' => $canInstall ? 1 : 0,
                'installed' => $installed ? 1 : 0,
            ];
        }

        v3a_exit_json(0, [
            'items' => $out,
            'meta' => $meta,
        ]);
    }

    if ($do === 'workshop.install') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $payload = v3a_payload();
        $type = strtolower(v3a_string($payload['type'] ?? '', ''));
        if (!in_array($type, ['plugin', 'theme'], true)) {
            v3a_exit_json(400, null, 'Invalid type');
        }

        $link = v3a_string($payload['link'] ?? '', '');
        if ($link === '') {
            v3a_exit_json(400, null, 'Missing link');
        }

        $parseGithub = function (string $url): array {
            $url = trim($url);
            if ($url === '') {
                return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
            }

            if (preg_match('/^git@github\\.com:([^\\/\\s]+)\\/([^\\s]+?)(?:\\.git)?$/i', $url, $m)) {
                return ['owner' => (string) ($m[1] ?? ''), 'repo' => (string) ($m[2] ?? ''), 'branch' => '', 'subdir' => ''];
            }

            if (!preg_match('/^https?:\\/\\//i', $url)) {
                return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
            }

            $parts = @parse_url($url);
            if (!is_array($parts)) {
                return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
            }

            $host = strtolower((string) ($parts['host'] ?? ''));
            if ($host === 'www.github.com') {
                $host = 'github.com';
            }

            $path = (string) ($parts['path'] ?? '');
	            $segs = array_values(array_filter(explode('/', trim($path, '/')), function ($v) {
	                return $v !== '';
	            }));

            if ($host === 'github.com') {
                if (count($segs) < 2) {
                    return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
                }

                $owner = (string) ($segs[0] ?? '');
                $repo = (string) ($segs[1] ?? '');
                $repo = preg_replace('/\\.git$/i', '', $repo);

                $branch = '';
                $subdir = '';
                if (isset($segs[2]) && $segs[2] === 'tree' && isset($segs[3])) {
                    $branch = (string) ($segs[3] ?? '');
                    $rest = array_slice($segs, 4);
                    $subdir = $rest ? implode('/', $rest) : '';
                }

                return ['owner' => $owner, 'repo' => $repo, 'branch' => $branch, 'subdir' => $subdir];
            }

            if ($host === 'raw.githubusercontent.com') {
                if (count($segs) < 3) {
                    return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
                }
                $owner = (string) ($segs[0] ?? '');
                $repo = (string) ($segs[1] ?? '');
                $branch = (string) ($segs[2] ?? '');
                $rest = array_slice($segs, 3);
                $subdir = $rest ? implode('/', $rest) : '';
                return ['owner' => $owner, 'repo' => $repo, 'branch' => $branch, 'subdir' => $subdir];
            }

            return ['owner' => '', 'repo' => '', 'branch' => '', 'subdir' => ''];
        };

        $gh = $parseGithub($link);
        $owner = trim((string) ($gh['owner'] ?? ''));
        $repo = trim((string) ($gh['repo'] ?? ''));
        if ($owner === '' || $repo === '') {
            v3a_exit_json(400, null, 'Not a GitHub repository link');
        }

        $dir = v3a_string($payload['dir'] ?? '', '');
        $dir = $dir !== '' ? $dir : $repo;
        $dir = trim($dir);
        if ($dir === '' || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]*$/', $dir)) {
            v3a_exit_json(400, null, 'Invalid install dir');
        }

        $branch = v3a_string($payload['branch'] ?? '', '');
        if ($branch === '') {
            $branch = trim((string) ($gh['branch'] ?? ''));
        }

        $subdir = v3a_string($payload['subdir'] ?? '', '');
        if ($subdir === '') {
            $subdir = trim((string) ($gh['subdir'] ?? ''));
        }
        $subdir = trim($subdir, "/\\");
        if ($subdir !== '' && (strpos($subdir, '..') !== false || preg_match('/^[A-Za-z]:/', $subdir))) {
            v3a_exit_json(400, null, 'Invalid subdir');
        }

        $overwrite = !empty($payload['overwrite']) ? 1 : 0;

        // Determine default branch (best-effort)
        if ($branch === '') {
            try {
                $headers = [
                    'Accept' => 'application/vnd.github+json',
                    'User-Agent' => 'Vue3Admin-Typecho',
                ];
                $info = v3a_http_get_json('https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo), $headers, 10);
                if (is_array($info) && isset($info['default_branch'])) {
                    $branch = trim((string) $info['default_branch']);
                }
            } catch (\Throwable $e) {
            }
        }
        if ($branch === '') {
            $branch = 'main';
        }

        $ref = $branch;
        $zipUrls = [];
        if (strpos($ref, 'refs/') === 0) {
            $zipUrls[] = 'https://codeload.github.com/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/zip/' . $ref;
        } else {
            $zipUrls[] = 'https://codeload.github.com/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/zip/refs/heads/' . rawurlencode($ref);
        }
        if ($ref === 'main') {
            $zipUrls[] = 'https://codeload.github.com/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/zip/refs/heads/master';
        } elseif ($ref === 'master') {
            $zipUrls[] = 'https://codeload.github.com/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/zip/refs/heads/main';
        }

        $tmpDir = '';
        try {
            $tmpRoot = rtrim((string) @sys_get_temp_dir(), '/\\');
            if ($tmpRoot === '') {
                $tmpRoot = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr' . DIRECTORY_SEPARATOR . 'uploads';
            }
            $tmpDir = $tmpRoot . DIRECTORY_SEPARATOR . 'v3a_workshop_' . date('Ymd_His') . '_' . substr(md5((string) mt_rand()), 0, 8);
            $zipPath = $tmpDir . DIRECTORY_SEPARATOR . 'package.zip';
            $extractDir = $tmpDir . DIRECTORY_SEPARATOR . 'extract';
            v3a_mkdir_p($extractDir);

            $downloadHeaders = [
                'Accept' => 'application/octet-stream',
                'User-Agent' => 'Vue3Admin-Typecho',
            ];

            $downloadedFrom = '';
            $lastErr = '';
            foreach ($zipUrls as $u) {
                try {
                    $downloadedFrom = $u;
                    v3a_http_download_to_file($u, $zipPath, $downloadHeaders, 60);
                    $lastErr = '';
                    break;
                } catch (\Throwable $e) {
                    $lastErr = $e->getMessage();
                    $downloadedFrom = '';
                    @unlink($zipPath);
                }
            }
            if ($downloadedFrom === '') {
                throw new \RuntimeException('Download failed' . ($lastErr !== '' ? (': ' . $lastErr) : ''));
            }

            if (!is_file($zipPath) || (int) (@filesize($zipPath) ?: 0) < 1024) {
                throw new \RuntimeException('Downloaded zip is too small');
            }
            $sig = @file_get_contents($zipPath, false, null, 0, 4);
            if (!is_string($sig) || substr($sig, 0, 2) !== 'PK') {
                throw new \RuntimeException('Invalid zip file');
            }

            v3a_extract_zip_to($zipPath, $extractDir);

            $dirs = glob(rtrim($extractDir, "/\\") . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR);
            if (!is_array($dirs) || count($dirs) !== 1) {
                throw new \RuntimeException('Invalid package structure');
            }
            $pkgRoot = (string) ($dirs[0] ?? '');
            if ($pkgRoot === '' || !is_dir($pkgRoot)) {
                throw new \RuntimeException('Invalid package root');
            }

            $src = $pkgRoot;
            if ($subdir !== '') {
                $src = rtrim($pkgRoot, "/\\") . DIRECTORY_SEPARATOR . $subdir;
            }
            if (!is_dir($src)) {
                throw new \RuntimeException('Subdir not found: ' . $subdir);
            }

            $base = rtrim((string) __TYPECHO_ROOT_DIR__, "/\\") . ($type === 'theme' ? (string) __TYPECHO_THEME_DIR__ : (string) __TYPECHO_PLUGIN_DIR__);
            $dest = rtrim($base, "/\\") . DIRECTORY_SEPARATOR . $dir;

            if (is_dir($dest)) {
                if (!$overwrite) {
                    throw new \RuntimeException('Target already exists');
                }
                v3a_rmdir_recursive($dest);
            }

            v3a_copy_directory($src, $dest);

            v3a_rmdir_recursive($tmpDir);
            $tmpDir = '';

            v3a_exit_json(0, [
                'installed' => 1,
                'type' => $type,
                'dir' => $dir,
                'target' => $dest,
                'downloadedFrom' => $downloadedFrom,
            ]);
        } catch (\Throwable $e) {
            if ($tmpDir !== '') {
                v3a_rmdir_recursive($tmpDir);
            }
            v3a_exit_json(500, null, $e->getMessage() !== '' ? $e->getMessage() : 'Install failed');
        }
    }

    if ($do === 'shoutu.stats') {
        v3a_require_role($user, 'administrator');

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }

        if (!$enabled) {
            v3a_exit_json(0, [
                'enabled' => false,
                'stats' => null,
                'lists' => ['whitelist' => 0, 'banlist' => 0, 'cidr' => 0],
                'banLog' => [],
                'updatedAt' => 0,
                'globalWhitelist' => [],
                'cidrList' => [],
            ]);
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;
        $statsPath = $cacheDir . 'protection_stats.json';

        $stats = [
            'total_blocks' => 0,
            'cc_blocks' => 0,
            'sqli_blocks' => 0,
            'xss_blocks' => 0,
            'file_inclusion_blocks' => 0,
            'php_code_blocks' => 0,
        ];

        $updatedAt = 0;
        if (is_file($statsPath)) {
            $updatedAt = (int) (@filemtime($statsPath) ?: 0);
            $raw = @file_get_contents($statsPath);
            if (is_string($raw) && trim($raw) !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    foreach (array_keys($stats) as $k) {
                        $stats[$k] = (int) ($decoded[$k] ?? 0);
                    }
                }
            }
        }

        $countListFile = function (string $path): int {
            try {
                if (!is_file($path)) {
                    return 0;
                }
                $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if (!is_array($lines)) {
                    return 0;
                }
                return count($lines);
            } catch (\Throwable $e) {
                return 0;
            }
        };

        $lists = [
            'whitelist' => $countListFile($cacheDir . 'whitelist_managed.txt'),
            'banlist' => $countListFile($cacheDir . 'banlist_managed.txt'),
            'cidr' => $countListFile($cacheDir . 'cidr_banlist.txt'),
        ];

        $banLog = [];
        try {
            $banLogPath = $cacheDir . 'ban_log.txt';
            if (is_file($banLogPath)) {
                $lines = @file($banLogPath, FILE_IGNORE_NEW_LINES);
                if (is_array($lines)) {
                    $lines = array_values(array_filter(array_map('trim', $lines), 'strlen'));
                    if (count($lines) > 40) {
                        $lines = array_slice($lines, -40);
                    }
                    $banLog = $lines;
                }
            }
        } catch (\Throwable $e) {
        }

        $analyticsEnabled = false;
        try {
            $shoutuOptions = $options->plugin('ShouTuTa');
            $analyticsEnabled = !empty($shoutuOptions->enableAnalytics);
        } catch (\Throwable $e) {
        }

        $tz = 0;
        try {
            $tz = (int) ($options->timezone ?? 0);
        } catch (\Throwable $e) {
        }

        $analytics = [
            'enabled' => $analyticsEnabled ? 1 : 0,
            'available' => 0,
            'today' => ['requests' => 0, 'uv' => 0],
            'yesterday' => ['requests' => 0, 'uv' => 0],
            'topPages' => [],
            'topIps' => [],
            'trend24h' => [],
            'logs' => [],
            'lastId' => 0,
            'threatTop' => [],
        ];

        $analyticsDbPath = $cacheDir . 'analytics.db';
        $geoipDbPath = $cacheDir . 'GeoLite2-Country.mmdb';
        $geoipAutoload = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'lib' . DIRECTORY_SEPARATOR . 'autoload.php';

        if ($analyticsEnabled && is_file($analyticsDbPath) && extension_loaded('pdo_sqlite')) {
            $analytics['available'] = 1;

            $geoReader = null;
            $geoCache = [];
            try {
                if (is_file($geoipDbPath) && is_file($geoipAutoload)) {
                    require_once $geoipAutoload;
                    $geoReader = new \GeoIp2\Database\Reader($geoipDbPath);
                }
            } catch (\Throwable $e) {
                $geoReader = null;
            }

            $geoLookup = function (string $ip) use (&$geoCache, $geoReader): string {
                $ip = trim($ip);
                if ($ip === '') {
                    return '';
                }
                if (isset($geoCache[$ip])) {
                    return $geoCache[$ip];
                }
                $geo = '';
                if ($geoReader) {
                    try {
                        $record = $geoReader->country($ip);
                        $geo = (string) (($record->country->names['zh-CN'] ?? '') ?: ($record->country->name ?? ''));
                    } catch (\Throwable $e) {
                        $geo = '';
                    }
                }
                $geoCache[$ip] = $geo;
                return $geo;
            };

            $now = time();
            $todayStart = (int) (floor(($now + $tz) / 86400) * 86400 - $tz);
            $todayEnd = $todayStart + 86400;
            $yesterdayStart = $todayStart - 86400;
            $yesterdayEnd = $todayStart;

            $todayStartStr = gmdate('Y-m-d H:i:s', $todayStart);
            $todayEndStr = gmdate('Y-m-d H:i:s', $todayEnd);
            $yesterdayStartStr = gmdate('Y-m-d H:i:s', $yesterdayStart);
            $yesterdayEndStr = gmdate('Y-m-d H:i:s', $yesterdayEnd);

            try {
                $pdo = new \PDO('sqlite:' . $analyticsDbPath);
                $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

                $sumStmt = $pdo->prepare('SELECT COUNT(*) AS total, COUNT(DISTINCT ip_address) AS uv FROM requests WHERE timestamp >= :start AND timestamp < :end');

                $sumStmt->execute([':start' => $todayStartStr, ':end' => $todayEndStr]);
                $row = $sumStmt->fetch(\PDO::FETCH_ASSOC) ?: [];
                $analytics['today'] = [
                    'requests' => (int) ($row['total'] ?? 0),
                    'uv' => (int) ($row['uv'] ?? 0),
                ];

                $sumStmt->execute([':start' => $yesterdayStartStr, ':end' => $yesterdayEndStr]);
                $row = $sumStmt->fetch(\PDO::FETCH_ASSOC) ?: [];
                $analytics['yesterday'] = [
                    'requests' => (int) ($row['total'] ?? 0),
                    'uv' => (int) ($row['uv'] ?? 0),
                ];

                // Hot pages (today)
                $stmt = $pdo->prepare('SELECT request_uri AS uri, COUNT(*) AS cnt FROM requests WHERE timestamp >= :start AND timestamp < :end GROUP BY request_uri ORDER BY cnt DESC LIMIT 15');
                $stmt->execute([':start' => $todayStartStr, ':end' => $todayEndStr]);
                $analytics['topPages'] = array_map(function ($r) {
                    return [
                        'uri' => (string) ($r['uri'] ?? ''),
                        'count' => (int) ($r['cnt'] ?? 0),
                    ];
                }, $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);

                // Top IPs (today)
                $stmt = $pdo->prepare('SELECT ip_address AS ip, COUNT(*) AS cnt FROM requests WHERE timestamp >= :start AND timestamp < :end GROUP BY ip_address ORDER BY cnt DESC LIMIT 15');
                $stmt->execute([':start' => $todayStartStr, ':end' => $todayEndStr]);
                $topIps = [];
                foreach (($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $r) {
                    $ip = (string) ($r['ip'] ?? '');
                    $topIps[] = [
                        'ip' => $ip,
                        'geo' => $geoLookup($ip),
                        'count' => (int) ($r['cnt'] ?? 0),
                    ];
                }
                $analytics['topIps'] = $topIps;

                // 24h trend (per hour)
                $hourStart = (int) (floor(($now + $tz) / 3600) * 3600 - $tz);
                $trendStart = $hourStart - 23 * 3600;
                $trendEnd = $hourStart + 3600;

                $trendStartStr = gmdate('Y-m-d H:i:s', $trendStart);
                $trendEndStr = gmdate('Y-m-d H:i:s', $trendEnd);

                $bucketStart = (int) floor(($trendStart + $tz) / 3600);
                $bucketEnd = $bucketStart + 24;
                $bucketCounts = [];

                $stmt = $pdo->prepare('SELECT CAST((CAST(strftime(\'%s\', timestamp) AS INTEGER) + :tz) / 3600 AS INTEGER) AS bucket, COUNT(*) AS cnt FROM requests WHERE timestamp >= :start AND timestamp < :end GROUP BY bucket ORDER BY bucket ASC');
                $stmt->execute([':tz' => $tz, ':start' => $trendStartStr, ':end' => $trendEndStr]);
                foreach (($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $r) {
                    $b = (int) ($r['bucket'] ?? 0);
                    $bucketCounts[$b] = (int) ($r['cnt'] ?? 0);
                }

                $trend = [];
                for ($b = $bucketStart; $b < $bucketEnd; $b++) {
                    $ts = $b * 3600 - $tz;
                    $trend[] = ['ts' => $ts, 'count' => (int) ($bucketCounts[$b] ?? 0)];
                }
                $analytics['trend24h'] = $trend;

                // Recent logs (latest 60)
                $stmt = $pdo->query('SELECT id, ip_address, request_method, request_uri, protocol, status_code, timestamp FROM requests ORDER BY id DESC LIMIT 60');
                $rows = $stmt ? ($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) : [];
                $rows = array_reverse($rows);

                $logs = [];
                $lastId = 0;
                foreach ($rows as $r) {
                    $id = (int) ($r['id'] ?? 0);
                    $ip = (string) ($r['ip_address'] ?? '');
                    $ts = 0;
                    try {
                        $dt = new \DateTime((string) ($r['timestamp'] ?? ''), new \DateTimeZone('UTC'));
                        $ts = (int) $dt->getTimestamp();
                    } catch (\Throwable $e) {
                        $ts = 0;
                    }

                    $method = (string) (($r['request_method'] ?? '') ?: 'GET');
                    $uri = (string) (($r['request_uri'] ?? '') ?: '/');
                    $proto = (string) (($r['protocol'] ?? '') ?: 'HTTP/1.1');
                    $statusCode = (int) ($r['status_code'] ?? 200);

                    $logs[] = [
                        'id' => $id,
                        'ts' => $ts,
                        'geo' => $geoLookup($ip),
                        'ip' => $ip,
                        'req' => trim($method . ' ' . $uri . ' ' . $proto),
                        'status_code' => $statusCode,
                    ];
                    $lastId = max($lastId, $id);
                }
                $analytics['logs'] = $logs;
                $analytics['lastId'] = $lastId;

                // Threat top (blocked IPs)
                $stmt = $pdo->query('SELECT ip_address AS ip, COUNT(*) AS cnt, MAX(timestamp) AS last_seen FROM requests WHERE status_code IN (403, 418) GROUP BY ip_address HAVING COUNT(*) > 10 ORDER BY cnt DESC LIMIT 60');
                $threatRows = $stmt ? ($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) : [];
                $threatTop = [];
                foreach ($threatRows as $r) {
                    $ip = (string) ($r['ip'] ?? '');
                    $lastSeen = 0;
                    try {
                        $dt = new \DateTime((string) ($r['last_seen'] ?? ''), new \DateTimeZone('UTC'));
                        $lastSeen = (int) $dt->getTimestamp();
                    } catch (\Throwable $e) {
                        $lastSeen = 0;
                    }
                    $threatTop[] = [
                        'ip' => $ip,
                        'masked' => preg_replace('/(\\.[0-9]+)$/', '.x', $ip),
                        'geo' => $geoLookup($ip),
                        'count' => (int) ($r['cnt'] ?? 0),
                        'lastSeen' => $lastSeen,
                    ];
                }
                $analytics['threatTop'] = $threatTop;
            } catch (\Throwable $e) {
                $analytics['available'] = 0;
            }
        }

        $globalWhitelist = [];
        try {
            $path = $cacheDir . 'global_whitelist.json';
            if (is_file($path)) {
                $raw = @file_get_contents($path);
                $data = json_decode((string) $raw, true);
                if (is_array($data)) {
                    $i = 0;
                    foreach ($data as $ip => $remark) {
                        if ($i >= 500) {
                            break;
                        }
                        $globalWhitelist[] = [
                            'ip' => (string) $ip,
                            'remark' => (string) $remark,
                        ];
                        $i++;
                    }
                }
            }
        } catch (\Throwable $e) {
            $globalWhitelist = [];
        }

        $cidrList = [];
        try {
            $path = $cacheDir . 'cidr_banlist.txt';
            if (is_file($path)) {
                $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if (is_array($lines)) {
                    $lines = array_values(array_filter(array_map('trim', $lines), 'strlen'));
                    if (count($lines) > 500) {
                        $lines = array_slice($lines, -500);
                    }
                    $cidrList = $lines;
                }
            }
        } catch (\Throwable $e) {
            $cidrList = [];
        }

        v3a_exit_json(0, [
            'enabled' => true,
            'stats' => $stats,
            'lists' => $lists,
            'banLog' => $banLog,
            'updatedAt' => $updatedAt,
            'globalWhitelist' => $globalWhitelist,
            'cidrList' => $cidrList,
            'analytics' => $analytics,
            'timezone' => $tz,
        ]);
    }

    if ($do === 'shoutu.logs.since') {
        v3a_require_role($user, 'administrator');

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }

        $lastId = 0;
        try {
            $lastId = (int) ($request->get('last_id') ?? 0);
        } catch (\Throwable $e) {
        }

        if (!$enabled) {
            v3a_exit_json(0, ['logs' => [], 'lastId' => $lastId]);
        }

        $analyticsEnabled = false;
        try {
            $shoutuOptions = $options->plugin('ShouTuTa');
            $analyticsEnabled = !empty($shoutuOptions->enableAnalytics);
        } catch (\Throwable $e) {
        }

        if (!$analyticsEnabled) {
            v3a_exit_json(0, ['logs' => [], 'lastId' => $lastId]);
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;
        $analyticsDbPath = $cacheDir . 'analytics.db';
        if (!is_file($analyticsDbPath) || !extension_loaded('pdo_sqlite')) {
            v3a_exit_json(0, ['logs' => [], 'lastId' => $lastId]);
        }

        $geoipDbPath = $cacheDir . 'GeoLite2-Country.mmdb';
        $geoipAutoload = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'lib' . DIRECTORY_SEPARATOR . 'autoload.php';

        $tz = 0;
        try {
            $tz = (int) ($options->timezone ?? 0);
        } catch (\Throwable $e) {
        }

        $geoReader = null;
        $geoCache = [];
        try {
            if (is_file($geoipDbPath) && is_file($geoipAutoload)) {
                require_once $geoipAutoload;
                $geoReader = new \GeoIp2\Database\Reader($geoipDbPath);
            }
        } catch (\Throwable $e) {
            $geoReader = null;
        }

        $geoLookup = function (string $ip) use (&$geoCache, $geoReader): string {
            $ip = trim($ip);
            if ($ip === '') {
                return '';
            }
            if (isset($geoCache[$ip])) {
                return $geoCache[$ip];
            }
            $geo = '';
            if ($geoReader) {
                try {
                    $record = $geoReader->country($ip);
                    $geo = (string) (($record->country->names['zh-CN'] ?? '') ?: ($record->country->name ?? ''));
                } catch (\Throwable $e) {
                    $geo = '';
                }
            }
            $geoCache[$ip] = $geo;
            return $geo;
        };

        $logs = [];
        $maxId = $lastId;
        try {
            $pdo = new \PDO('sqlite:' . $analyticsDbPath);
            $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            $stmt = $pdo->prepare('SELECT id, ip_address, request_method, request_uri, protocol, status_code, timestamp FROM requests WHERE id > :last_id ORDER BY id ASC LIMIT 200');
            $stmt->execute([':last_id' => $lastId]);
            foreach (($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $r) {
                $id = (int) ($r['id'] ?? 0);
                $ip = (string) ($r['ip_address'] ?? '');
                $ts = 0;
                try {
                    $dt = new \DateTime((string) ($r['timestamp'] ?? ''), new \DateTimeZone('UTC'));
                    $ts = (int) $dt->getTimestamp();
                } catch (\Throwable $e) {
                    $ts = 0;
                }

                $method = (string) (($r['request_method'] ?? '') ?: 'GET');
                $uri = (string) (($r['request_uri'] ?? '') ?: '/');
                $proto = (string) (($r['protocol'] ?? '') ?: 'HTTP/1.1');
                $statusCode = (int) ($r['status_code'] ?? 200);

                $logs[] = [
                    'id' => $id,
                    'ts' => $ts,
                    'geo' => $geoLookup($ip),
                    'ip' => $ip,
                    'req' => trim($method . ' ' . $uri . ' ' . $proto),
                    'status_code' => $statusCode,
                ];
                $maxId = max($maxId, $id);
            }
        } catch (\Throwable $e) {
            $logs = [];
            $maxId = $lastId;
        }

        v3a_exit_json(0, ['logs' => $logs, 'lastId' => $maxId, 'timezone' => $tz]);
    }

    if ($do === 'shoutu.ip.logs') {
        v3a_require_role($user, 'administrator');

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }

        $ip = '';
        try {
            $ip = trim((string) ($request->get('ip') ?? ''));
        } catch (\Throwable $e) {
        }
        $ip = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';

        if (!$enabled || $ip === '') {
            v3a_exit_json(0, ['ip' => $ip, 'logs' => []]);
        }

        $analyticsEnabled = false;
        try {
            $shoutuOptions = $options->plugin('ShouTuTa');
            $analyticsEnabled = !empty($shoutuOptions->enableAnalytics);
        } catch (\Throwable $e) {
        }

        if (!$analyticsEnabled) {
            v3a_exit_json(0, ['ip' => $ip, 'logs' => []]);
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;
        $analyticsDbPath = $cacheDir . 'analytics.db';
        if (!is_file($analyticsDbPath) || !extension_loaded('pdo_sqlite')) {
            v3a_exit_json(0, ['ip' => $ip, 'logs' => []]);
        }

        $tz = 0;
        try {
            $tz = (int) ($options->timezone ?? 0);
        } catch (\Throwable $e) {
        }

        $logs = [];
        try {
            $pdo = new \PDO('sqlite:' . $analyticsDbPath);
            $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            $stmt = $pdo->prepare('SELECT id, request_method, request_uri, protocol, status_code, user_agent, timestamp FROM requests WHERE ip_address = :ip ORDER BY id DESC LIMIT 100');
            $stmt->execute([':ip' => $ip]);
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            $rows = array_reverse($rows);

            foreach ($rows as $r) {
                $id = (int) ($r['id'] ?? 0);
                $ts = 0;
                try {
                    $dt = new \DateTime((string) ($r['timestamp'] ?? ''), new \DateTimeZone('UTC'));
                    $ts = (int) $dt->getTimestamp();
                } catch (\Throwable $e) {
                    $ts = 0;
                }

                $logs[] = [
                    'id' => $id,
                    'ts' => $ts,
                    'method' => (string) (($r['request_method'] ?? '') ?: 'GET'),
                    'uri' => (string) (($r['request_uri'] ?? '') ?: '/'),
                    'protocol' => (string) (($r['protocol'] ?? '') ?: 'HTTP/1.1'),
                    'status_code' => (int) ($r['status_code'] ?? 200),
                    'ua' => (string) (($r['user_agent'] ?? '') ?: ''),
                ];
            }
        } catch (\Throwable $e) {
            $logs = [];
        }

        v3a_exit_json(0, ['ip' => $ip, 'logs' => $logs, 'timezone' => $tz]);
    }

    if ($do === 'shoutu.unblock') {
        v3a_require_role($user, 'administrator');
        v3a_security_protect($security, $request);

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }
        if (!$enabled) {
            v3a_exit_json(404, null, 'Not found');
        }

        $payload = v3a_payload();
        $ip = trim((string) ($payload['ip'] ?? ''));
        $ip = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
        if ($ip === '') {
            v3a_exit_json(400, null, 'Invalid IP');
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;

        @unlink($cacheDir . md5('ban_info_' . $ip));
        @unlink($cacheDir . md5('ban_tier_' . $ip));

        $banlistPath = $cacheDir . 'banlist_managed.txt';
        try {
            if (is_file($banlistPath)) {
                $lines = @file($banlistPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $lines = is_array($lines) ? $lines : [];
                $lines = array_values(array_filter($lines, function ($line) use ($ip) {
                    return trim((string) $line) !== $ip;
                }));
                @file_put_contents($banlistPath, implode(PHP_EOL, $lines) . (count($lines) ? PHP_EOL : ''), LOCK_EX);
            }
        } catch (\Throwable $e) {
        }

        v3a_exit_json(0, ['ok' => 1]);
    }

    if ($do === 'shoutu.whitelist.add') {
        v3a_require_role($user, 'administrator');
        v3a_security_protect($security, $request);

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }
        if (!$enabled) {
            v3a_exit_json(404, null, 'Not found');
        }

        $payload = v3a_payload();
        $ip = trim((string) ($payload['ip'] ?? ''));
        $ip = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
        if ($ip === '') {
            v3a_exit_json(400, null, 'Invalid IP');
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;
        $whitelistPath = $cacheDir . 'whitelist_managed.txt';

        $exists = false;
        try {
            $lines = @file($whitelistPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $lines = is_array($lines) ? array_map('trim', $lines) : [];
            $exists = in_array($ip, $lines, true);
        } catch (\Throwable $e) {
        }

        if (!$exists) {
            @file_put_contents($whitelistPath, $ip . PHP_EOL, FILE_APPEND | LOCK_EX);
        }

        v3a_exit_json(0, ['ok' => 1, 'exists' => $exists ? 1 : 0]);
    }

    if ($do === 'shoutu.ban.perm') {
        v3a_require_role($user, 'administrator');
        v3a_security_protect($security, $request);

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }
        if (!$enabled) {
            v3a_exit_json(404, null, 'Not found');
        }

        $payload = v3a_payload();
        $ip = trim((string) ($payload['ip'] ?? ''));
        $ip = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
        if ($ip === '') {
            v3a_exit_json(400, null, 'Invalid IP');
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;
        $banlistPath = $cacheDir . 'banlist_managed.txt';

        $exists = false;
        try {
            $lines = @file($banlistPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $lines = is_array($lines) ? array_map('trim', $lines) : [];
            $exists = in_array($ip, $lines, true);
        } catch (\Throwable $e) {
        }

        if (!$exists) {
            @file_put_contents($banlistPath, $ip . PHP_EOL, FILE_APPEND | LOCK_EX);
        }

        v3a_exit_json(0, ['ok' => 1, 'exists' => $exists ? 1 : 0]);
    }

    if ($do === 'shoutu.cidr.add') {
        v3a_require_role($user, 'administrator');
        v3a_security_protect($security, $request);

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }
        if (!$enabled) {
            v3a_exit_json(404, null, 'Not found');
        }

        $payload = v3a_payload();
        $raw = (string) ($payload['cidr_list'] ?? $payload['list'] ?? '');
        $raw = str_replace("\r", "\n", $raw);
        $lines = array_values(array_filter(array_map('trim', explode("\n", $raw)), 'strlen'));
        if (!count($lines)) {
            v3a_exit_json(400, null, 'Empty list');
        }

        $normalize = function (string $entry): ?string {
            $v = trim($entry);
            if ($v === '' || strlen($v) > 80) {
                return null;
            }
            if (filter_var($v, FILTER_VALIDATE_IP) !== false) {
                return $v;
            }
            if (strpos($v, '/') === false) {
                return null;
            }
            [$ip, $bits] = explode('/', $v, 2);
            $ip = trim($ip);
            $bits = trim($bits);
            if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
                return null;
            }
            if (!preg_match('/^\\d+$/', $bits)) {
                return null;
            }
            $n = (int) $bits;
            $max = strpos($ip, ':') !== false ? 128 : 32;
            if ($n < 0 || $n > $max) {
                return null;
            }
            return $ip . '/' . $n;
        };

        $entries = [];
        foreach ($lines as $line) {
            $n = $normalize((string) $line);
            if ($n !== null) {
                $entries[$n] = true;
            }
        }
        $entries = array_keys($entries);
        if (!count($entries)) {
            v3a_exit_json(400, null, 'No valid entries');
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;
        $cidrPath = $cacheDir . 'cidr_banlist.txt';

        $current = [];
        try {
            $cur = @file($cidrPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $cur = is_array($cur) ? array_map('trim', $cur) : [];
            foreach ($cur as $v) {
                if ($v !== '') {
                    $current[$v] = true;
                }
            }
        } catch (\Throwable $e) {
        }

        $added = [];
        foreach ($entries as $v) {
            if (!isset($current[$v])) {
                $added[] = $v;
            }
        }

        if (count($added)) {
            @file_put_contents($cidrPath, implode(PHP_EOL, $added) . PHP_EOL, FILE_APPEND | LOCK_EX);
        }

        v3a_exit_json(0, ['ok' => 1, 'added' => count($added), 'entries' => $added]);
    }

    if ($do === 'shoutu.globalWhitelist.add') {
        v3a_require_role($user, 'administrator');
        v3a_security_protect($security, $request);

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }
        if (!$enabled) {
            v3a_exit_json(404, null, 'Not found');
        }

        $payload = v3a_payload();
        $ip = trim((string) ($payload['ip'] ?? ''));
        $ip = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
        $remark = trim((string) ($payload['remark'] ?? ''));
        if ($ip === '') {
            v3a_exit_json(400, null, 'Invalid IP');
        }
        if (strlen($remark) > 200) {
            $remark = substr($remark, 0, 200);
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;
        $path = $cacheDir . 'global_whitelist.json';

        $ok = false;
        try {
            $fp = @fopen($path, 'c+');
            if ($fp && flock($fp, LOCK_EX)) {
                $raw = stream_get_contents($fp);
                $data = json_decode((string) $raw, true);
                if (!is_array($data)) {
                    $data = [];
                }
                $data[$ip] = $remark;
                ftruncate($fp, 0);
                rewind($fp);
                fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                flock($fp, LOCK_UN);
                $ok = true;
            }
            if ($fp) {
                fclose($fp);
            }
        } catch (\Throwable $e) {
        }

        if (!$ok) {
            v3a_exit_json(500, null, 'Write failed');
        }

        v3a_exit_json(0, ['ok' => 1]);
    }

    if ($do === 'shoutu.globalWhitelist.remove') {
        v3a_require_role($user, 'administrator');
        v3a_security_protect($security, $request);

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }
        if (!$enabled) {
            v3a_exit_json(404, null, 'Not found');
        }

        $payload = v3a_payload();
        $ip = trim((string) ($payload['ip'] ?? ''));
        $ip = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
        if ($ip === '') {
            v3a_exit_json(400, null, 'Invalid IP');
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;
        $path = $cacheDir . 'global_whitelist.json';

        $ok = false;
        $removed = 0;
        try {
            $fp = @fopen($path, 'c+');
            if ($fp && flock($fp, LOCK_EX)) {
                $raw = stream_get_contents($fp);
                $data = json_decode((string) $raw, true);
                if (!is_array($data)) {
                    $data = [];
                }
                if (isset($data[$ip])) {
                    unset($data[$ip]);
                    $removed = 1;
                }
                ftruncate($fp, 0);
                rewind($fp);
                fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                flock($fp, LOCK_UN);
                $ok = true;
            }
            if ($fp) {
                fclose($fp);
            }
        } catch (\Throwable $e) {
        }

        if (!$ok) {
            v3a_exit_json(500, null, 'Write failed');
        }

        v3a_exit_json(0, ['ok' => 1, 'removed' => $removed]);
    }

    if ($do === 'shoutu.purge_ip') {
        v3a_require_role($user, 'administrator');
        v3a_security_protect($security, $request);

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }
        if (!$enabled) {
            v3a_exit_json(404, null, 'Not found');
        }

        $payload = v3a_payload();
        $ip = trim((string) ($payload['ip'] ?? ''));
        $ip = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
        if ($ip === '') {
            v3a_exit_json(400, null, 'Invalid IP');
        }

        $pluginDir = '';
        try {
            $pluginDir = (string) ($options->pluginDir('ShouTuTa') ?? '');
        } catch (\Throwable $e) {
        }
        if ($pluginDir === '') {
            $pluginDir = rtrim((string) (__TYPECHO_ROOT_DIR__ ?? ''), '/\\') . DIRECTORY_SEPARATOR . 'usr'
                . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'ShouTuTa';
        }

        $cacheDir = rtrim($pluginDir, '/\\') . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR;

        @unlink($cacheDir . md5('ban_info_' . $ip));
        @unlink($cacheDir . md5('ban_tier_' . $ip));

        try {
            $banListPath = $cacheDir . 'banlist_managed.txt';
            if (is_file($banListPath)) {
                $lines = @file($banListPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $lines = is_array($lines) ? $lines : [];
                $newList = array_values(array_filter($lines, function ($v) use ($ip) {
                    return trim((string) $v) !== $ip;
                }));
                @file_put_contents($banListPath, implode(PHP_EOL, $newList) . (empty($newList) ? '' : PHP_EOL), LOCK_EX);
            }
        } catch (\Throwable $e) {
        }

        @unlink($cacheDir . md5('cc_requests_' . $ip));
        @unlink($cacheDir . md5('edge_score_' . $ip));
        @unlink($cacheDir . md5('404_strikes_' . $ip));
        @unlink($cacheDir . md5('abuseipdb_' . $ip));

        $analyticsDbPath = $cacheDir . 'analytics.db';
        if (is_file($analyticsDbPath) && extension_loaded('pdo_sqlite')) {
            try {
                $pdo = new \PDO('sqlite:' . $analyticsDbPath);
                $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
                $stmt = $pdo->prepare('DELETE FROM requests WHERE ip_address = :ip');
                $stmt->execute([':ip' => $ip]);
            } catch (\Throwable $e) {
            }
        }

        @unlink($cacheDir . 'threat_center_cache.json');

        v3a_exit_json(0, ['ok' => 1]);
    }

    if ($do === 'shoutu.abuseipdb.check') {
        v3a_require_role($user, 'administrator');

        $enabled = false;
        try {
            $plugins = \Typecho\Plugin::export();
            $activated = (array) ($plugins['activated'] ?? []);
            $enabled = isset($activated['ShouTuTa']);
        } catch (\Throwable $e) {
        }
        if (!$enabled) {
            v3a_exit_json(404, null, 'Not found');
        }

        $ip = '';
        try {
            $ip = trim((string) ($request->get('ip') ?? ''));
        } catch (\Throwable $e) {
        }
        $ip = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
        if ($ip === '') {
            v3a_exit_json(400, null, 'Invalid IP');
        }

        $use = false;
        $key = '';
        try {
            $shoutuOptions = $options->plugin('ShouTuTa');
            $use = !empty($shoutuOptions->enableAbuseIPDB);
            $key = (string) ($shoutuOptions->abuseIPDBKey ?? '');
        } catch (\Throwable $e) {
        }

        if (!$use || $key === '') {
            v3a_exit_json(400, null, 'AbuseIPDB disabled or missing key');
        }

        if (!function_exists('curl_init')) {
            v3a_exit_json(500, null, 'cURL is missing');
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.abuseipdb.com/api/v2/check?ipAddress=' . urlencode($ip));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Key: ' . $key, 'Accept: application/json']);
        $response = curl_exec($ch);
        $httpCode = (int) (curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 0);
        curl_close($ch);

        if ($httpCode !== 200 || !is_string($response) || trim($response) === '') {
            v3a_exit_json(500, null, 'AbuseIPDB request failed');
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            v3a_exit_json(500, null, 'Invalid AbuseIPDB response');
        }

        $score = 0;
        try {
            $score = (int) ($decoded['data']['abuseConfidenceScore'] ?? 0);
        } catch (\Throwable $e) {
            $score = 0;
        }

        v3a_exit_json(0, ['ip' => $ip, 'score' => $score, 'data' => $decoded['data'] ?? null]);
    }

    if ($do === 'dashboard') {
        v3a_require_role($user, 'subscriber');

        $stat = \Widget\Stat::alloc();

        $todayStart = strtotime(date('Y-m-d 00:00:00'));
        $todayEnd = strtotime('+1 days', $todayStart);
        $fromStart = strtotime('-29 days', $todayStart);

        $summary = [
            'posts' => (int) ($stat->publishedPostsNum ?? 0),
            'pages' => (int) ($stat->publishedPagesNum ?? 0),
            'comments' => (int) ($stat->publishedCommentsNum ?? 0),
            'commentsWaiting' => (int) ($stat->waitingCommentsNum ?? 0),
            'categories' => (int) ($stat->categoriesNum ?? 0),
            'tags' => (int) ($stat->tagsNum ?? 0),
            'totalChars' => 0,
            'visitPv' => 0,
            'visitUv' => 0,
            'todayUv' => 0,
            'apiCalls' => 0,
            'friendLinks' => 0,
            'friendLinkApply' => 0,
            'postLikes' => 0,
            'siteLikes' => 0,
        ];

        $pdo = v3a_local_pdo();

        // 全站字符数
        try {
            $row = $db->fetchObject(
                $db->select(['SUM(LENGTH(table.contents.text))' => 'num'])
                    ->from('table.contents')
                    ->where('table.contents.status = ?', 'publish')
                    ->where('table.contents.type = ? OR table.contents.type = ?', 'post', 'page')
            );
            $summary['totalChars'] = (int) ($row->num ?? 0);
        } catch (\Throwable $e) {
        }

        // 访问量 / IP
        try {
            if ($pdo) {
                $summary['visitPv'] = (int) (($pdo->query('SELECT COUNT(id) FROM v3a_visit_log')->fetchColumn()) ?: 0);
                $summary['visitUv'] = (int) (($pdo->query('SELECT COUNT(DISTINCT ip) FROM v3a_visit_log')->fetchColumn()) ?: 0);

                $stmt = $pdo->prepare('SELECT COUNT(DISTINCT ip) FROM v3a_visit_log WHERE created >= :start AND created < :end');
                $stmt->execute([':start' => $todayStart, ':end' => $todayEnd]);
                $summary['todayUv'] = (int) ($stmt->fetchColumn() ?: 0);
            }
        } catch (\Throwable $e) {
        }

        // 实时数据（mx-admin 仪表盘顶部）
        $realtime = [
            'onlineNow' => 0,
            'todayVisitors' => (int) ($summary['todayUv'] ?? 0),
            'todayMaxOnline' => 0,
        ];
        try {
            if ($pdo) {
                $since = time() - 300;
                $stmt = $pdo->prepare('SELECT COUNT(DISTINCT ip) FROM v3a_visit_log WHERE created >= :since');
                $stmt->execute([':since' => $since]);
                $realtime['onlineNow'] = (int) ($stmt->fetchColumn() ?: 0);
            }
        } catch (\Throwable $e) {
        }
        try {
            if ($pdo) {
                $stmt = $pdo->prepare(
                    "SELECT MAX(num) FROM (
                        SELECT COUNT(DISTINCT ip) AS num
                        FROM v3a_visit_log
                        WHERE created >= :start AND created < :end
                        GROUP BY CAST(created / 300 AS INTEGER)
                    )"
                );
                $stmt->execute([':start' => $todayStart, ':end' => $todayEnd]);
                $realtime['todayMaxOnline'] = (int) ($stmt->fetchColumn() ?: 0);
            }
        } catch (\Throwable $e) {
        }

        // API 调用
        try {
            if ($pdo) {
                $summary['apiCalls'] = (int) (($pdo->query('SELECT COUNT(id) FROM v3a_api_log')->fetchColumn()) ?: 0);
            }
        } catch (\Throwable $e) {
        }

        // 友链
        try {
            if ($pdo) {
                $stmt = $pdo->query('SELECT COUNT(id) FROM v3a_friend_link WHERE status = 1');
                $summary['friendLinks'] = (int) ($stmt ? ($stmt->fetchColumn() ?: 0) : 0);

                $stmt = $pdo->query('SELECT COUNT(id) FROM v3a_friend_link_apply WHERE status = 0');
                $summary['friendLinkApply'] = (int) ($stmt ? ($stmt->fetchColumn() ?: 0) : 0);
            }
        } catch (\Throwable $e) {
        }

        // 点赞
        try {
            if ($pdo) {
                $stmt = $pdo->prepare('SELECT COUNT(id) FROM v3a_like WHERE type = :type');
                $stmt->execute([':type' => 'post']);
                $summary['postLikes'] = (int) ($stmt->fetchColumn() ?: 0);

                $stmt->execute([':type' => 'site']);
                $summary['siteLikes'] = (int) ($stmt->fetchColumn() ?: 0);
            }
        } catch (\Throwable $e) {
        }

        // 发布趋势（博文）
        $publishTrendMap = [];
        for ($i = 0; $i < 30; $i++) {
            $d = date('Y-m-d', strtotime("+{$i} days", $fromStart));
            $publishTrendMap[$d] = 0;
        }
        try {
            $rows = $db->fetchAll(
                $db->select('created')
                    ->from('table.contents')
                    ->where('type = ?', 'post')
                    ->where('status = ?', 'publish')
                    ->where('created >= ?', $fromStart)
            );
            foreach ($rows as $r) {
                $d = date('Y-m-d', (int) $r['created']);
                if (array_key_exists($d, $publishTrendMap)) {
                    $publishTrendMap[$d]++;
                }
            }
        } catch (\Throwable $e) {
        }
        $publishTrend = [];
        foreach ($publishTrendMap as $d => $c) {
            $publishTrend[] = ['date' => $d, 'count' => (int) $c];
        }

        // 发布趋势（页面）用于仪表盘双折线
        $pageTrendMap = [];
        for ($i = 0; $i < 30; $i++) {
            $d = date('Y-m-d', strtotime("+{$i} days", $fromStart));
            $pageTrendMap[$d] = 0;
        }
        try {
            $rows = $db->fetchAll(
                $db->select('created')
                    ->from('table.contents')
                    ->where('type = ?', 'page')
                    ->where('status = ?', 'publish')
                    ->where('created >= ?', $fromStart)
            );
            foreach ($rows as $r) {
                $d = date('Y-m-d', (int) $r['created']);
                if (array_key_exists($d, $pageTrendMap)) {
                    $pageTrendMap[$d]++;
                }
            }
        } catch (\Throwable $e) {
        }
        $pageTrend = [];
        foreach ($pageTrendMap as $d => $c) {
            $pageTrend[] = ['date' => $d, 'count' => (int) $c];
        }

        // 评论活跃度
        $commentTrendMap = [];
        for ($i = 0; $i < 30; $i++) {
            $d = date('Y-m-d', strtotime("+{$i} days", $fromStart));
            $commentTrendMap[$d] = 0;
        }
        try {
            $rows = $db->fetchAll(
                $db->select('created')
                    ->from('table.comments')
                    ->where('status = ?', 'approved')
                    ->where('created >= ?', $fromStart)
            );
            foreach ($rows as $r) {
                $d = date('Y-m-d', (int) $r['created']);
                if (array_key_exists($d, $commentTrendMap)) {
                    $commentTrendMap[$d]++;
                }
            }
        } catch (\Throwable $e) {
        }
        $commentActivity = [];
        foreach ($commentTrendMap as $d => $c) {
            $commentActivity[] = ['date' => $d, 'count' => (int) $c];
        }

        // 分类分布（bar）
        $categoryDistribution = [];
        try {
            $rows = $db->fetchAll(
                $db->select('table.metas.name', ['COUNT(table.contents.cid)' => 'count'])
                    ->from('table.metas')
                    ->join('table.relationships', 'table.relationships.mid = table.metas.mid', \Typecho\Db::LEFT_JOIN)
                    ->join(
                        'table.contents',
                        "table.contents.cid = table.relationships.cid AND table.contents.type = 'post' AND table.contents.status = 'publish'",
                        \Typecho\Db::LEFT_JOIN
                    )
                    ->where('table.metas.type = ?', 'category')
                    ->group('table.metas.mid')
                    ->order('count', \Typecho\Db::SORT_DESC)
            );
            foreach ($rows as $r) {
                $categoryDistribution[] = [
                    'name' => (string) $r['name'],
                    'count' => (int) $r['count'],
                ];
            }
        } catch (\Throwable $e) {
        }

        // 热门文章 Top 10（按评论数）
        $hotPosts = [];
        try {
            $rows = $db->fetchAll(
                $db->select('table.contents.cid', 'table.contents.title', ['COUNT(table.comments.coid)' => 'comments'])
                    ->from('table.contents')
                    ->join(
                        'table.comments',
                        "table.comments.cid = table.contents.cid AND table.comments.status = 'approved'",
                        \Typecho\Db::LEFT_JOIN
                    )
                    ->where('table.contents.type = ?', 'post')
                    ->where('table.contents.status = ?', 'publish')
                    ->group('table.contents.cid')
                    ->order('comments', \Typecho\Db::SORT_DESC)
                    ->limit(10)
            );
            foreach ($rows as $r) {
                $permalink = '';
                try {
                    $post = \Widget\Contents\Post\Edit::alloc(null, ['cid' => (int) $r['cid']], false)->prepare();
                    $permalink = (string) ($post->permalink ?? '');
                } catch (\Throwable $e) {
                }
                $hotPosts[] = [
                    'cid' => (int) $r['cid'],
                    'title' => (string) $r['title'],
                    'comments' => (int) $r['comments'],
                    'permalink' => $permalink,
                ];
            }
        } catch (\Throwable $e) {
        }

        // 标签热词 Top 20
        $tagTop = [];
        try {
            $rows = $db->fetchAll(
                $db->select('table.metas.mid', 'table.metas.name', ['COUNT(table.contents.cid)' => 'count'])
                    ->from('table.metas')
                    ->join('table.relationships', 'table.relationships.mid = table.metas.mid', \Typecho\Db::LEFT_JOIN)
                    ->join(
                        'table.contents',
                        "table.contents.cid = table.relationships.cid AND table.contents.type = 'post' AND table.contents.status = 'publish'",
                        \Typecho\Db::LEFT_JOIN
                    )
                    ->where('table.metas.type = ?', 'tag')
                    ->group('table.metas.mid')
                    ->order('count', \Typecho\Db::SORT_DESC)
                    ->limit(20)
            );
            foreach ($rows as $r) {
                $tagTop[] = [
                    'mid' => (int) ($r['mid'] ?? 0),
                    'name' => (string) $r['name'],
                    'count' => (int) $r['count'],
                ];
            }
        } catch (\Throwable $e) {
        }

        // 关系图谱（标签-文章二部图，标签取 Top 20）
        $tagGraph = ['nodes' => [], 'links' => []];
        try {
            $tagMids = [];
            $tagMap = [];
            foreach ($tagTop as $t) {
                $mid = (int) ($t['mid'] ?? 0);
                if ($mid <= 0) {
                    continue;
                }
                $tagMids[] = $mid;
                $tagMap[$mid] = $t;
            }

            if (!empty($tagMids)) {
                foreach ($tagMids as $mid) {
                    $tagGraph['nodes'][] = [
                        'id' => 't:' . $mid,
                        'kind' => 'tag',
                        'category' => 0,
                        'mid' => (int) $mid,
                        'name' => (string) ($tagMap[$mid]['name'] ?? ''),
                        'count' => (int) ($tagMap[$mid]['count'] ?? 0),
                    ];
                }

                $rows = $db->fetchAll(
                    $db->select(
                        'table.contents.cid',
                        'table.contents.title',
                        'table.contents.modified',
                        'table.relationships.mid'
                    )
                        ->from('table.relationships')
                        ->join(
                            'table.contents',
                            "table.contents.cid = table.relationships.cid AND table.contents.type = 'post' AND table.contents.status = 'publish'"
                        )
                        ->where('table.relationships.mid IN ?', $tagMids)
                        ->order('table.contents.modified', \Typecho\Db::SORT_DESC)
                        ->limit(2000)
                );

                $maxPosts = 140;
                $posts = [];
                foreach ($rows as $r) {
                    $cid = (int) ($r['cid'] ?? 0);
                    $mid = (int) ($r['mid'] ?? 0);
                    if ($cid <= 0 || $mid <= 0) {
                        continue;
                    }

                    if (!isset($posts[$cid])) {
                        if (count($posts) >= $maxPosts) {
                            continue;
                        }
                        $posts[$cid] = [
                            'cid' => $cid,
                            'title' => (string) ($r['title'] ?? ''),
                            'mids' => [],
                        ];
                    }

                    if (!in_array($mid, $posts[$cid]['mids'], true)) {
                        $posts[$cid]['mids'][] = $mid;
                    }
                }

                foreach ($posts as $p) {
                    $cid = (int) ($p['cid'] ?? 0);
                    if ($cid <= 0) {
                        continue;
                    }

                    $title = (string) ($p['title'] ?? '');
                    $tagGraph['nodes'][] = [
                        'id' => 'p:' . $cid,
                        'kind' => 'post',
                        'category' => 1,
                        'cid' => $cid,
                        'name' => $title,
                        'short' => v3a_truncate($title, 26),
                    ];

                    foreach ((array) ($p['mids'] ?? []) as $mid) {
                        $mid = (int) $mid;
                        if ($mid <= 0) {
                            continue;
                        }
                        $tagGraph['links'][] = [
                            'source' => 't:' . $mid,
                            'target' => 'p:' . $cid,
                        ];
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        // 系统信息（用于“实时信息/版本”展示）
        $system = [
            'typechoVersion' => defined('\\Typecho\\Common::VERSION') ? \Typecho\Common::VERSION : '',
            'phpVersion' => PHP_VERSION,
            'serverTime' => time(),
            'timezone' => function_exists('date_default_timezone_get') ? date_default_timezone_get() : '',
        ];

        // 最近文章
        $recentPosts = [];
        try {
            $rows = $db->fetchAll(
                $db->select('cid', 'title', 'created')
                    ->from('table.contents')
                    ->where('type = ?', 'post')
                    ->where('status = ?', 'publish')
                    ->order('created', \Typecho\Db::SORT_DESC)
                    ->limit(6)
            );
            foreach ($rows as $r) {
                $recentPosts[] = [
                    'cid' => (int) $r['cid'],
                    'title' => (string) ($r['title'] ?? ''),
                    'created' => (int) ($r['created'] ?? 0),
                ];
            }
        } catch (\Throwable $e) {
        }

        // 最近评论
        $recentComments = [];
        try {
            $rows = $db->fetchAll(
                $db->select('coid', 'cid', 'author', 'text', 'created')
                    ->from('table.comments')
                    ->order('created', \Typecho\Db::SORT_DESC)
                    ->limit(6)
            );
            foreach ($rows as $r) {
                $text = (string) ($r['text'] ?? '');
                $text = strip_tags($text);
                $text = preg_replace('/\\s+/u', ' ', $text);
                $recentComments[] = [
                    'coid' => (int) $r['coid'],
                    'cid' => (int) $r['cid'],
                    'author' => (string) ($r['author'] ?? ''),
                    'text' => v3a_truncate((string) $text, 120),
                    'created' => (int) ($r['created'] ?? 0),
                ];
            }
        } catch (\Throwable $e) {
        }

        // 本周访问趋势（PV / IP）
        // Align with old mx-admin: 7-day rolling window, ending at today.
        $visitWeekTrend = [];
        try {
            $trendStart = strtotime('-6 days', $todayStart);
            $trendEnd = (int) $todayEnd;

            $labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            $bucket = [];
            $days = [];
            for ($i = 0; $i < 7; $i++) {
                $ts = strtotime("+{$i} days", $trendStart);
                $d = date('Y-m-d', $ts);
                $days[] = [
                    'date' => $d,
                    'day' => $labels[(int) date('w', $ts)] ?? $d,
                ];
                $bucket[$d] = ['pv' => 0, 'uv' => 0];
            }

            if ($pdo) {
                $stmt = $pdo->prepare(
                    "SELECT strftime('%Y-%m-%d', created, 'unixepoch') AS d,
                            COUNT(id) AS pv,
                            COUNT(DISTINCT ip) AS uv
                     FROM v3a_visit_log
                     WHERE created >= :start AND created < :end
                     GROUP BY d"
                );
                $stmt->execute([':start' => $trendStart, ':end' => $trendEnd]);
                foreach ((array) $stmt->fetchAll() as $r) {
                    $d = (string) ($r['d'] ?? '');
                    if ($d !== '' && isset($bucket[$d])) {
                        $bucket[$d]['pv'] = (int) ($r['pv'] ?? 0);
                        $bucket[$d]['uv'] = (int) ($r['uv'] ?? 0);
                    }
                }
            }

            foreach ($days as $dayRow) {
                $d = (string) ($dayRow['date'] ?? '');
                $visitWeekTrend[] = [
                    'date' => $d,
                    'day' => (string) ($dayRow['day'] ?? $d),
                    'pv' => (int) ($bucket[$d]['pv'] ?? 0),
                    'ip' => (int) ($bucket[$d]['uv'] ?? 0),
                ];
            }

            // Ensure "today IP" matches the metric card.
            $n = count($visitWeekTrend);
            if ($n > 0) {
                $last = $n - 1;
                if (($visitWeekTrend[$last]['date'] ?? '') === date('Y-m-d', $todayStart)) {
                    $visitWeekTrend[$last]['ip'] = (int) ($summary['todayUv'] ?? 0);
                }
            }
        } catch (\Throwable $e) {
        }

        v3a_exit_json(0, [
            'summary' => $summary,
            'realtime' => $realtime,
            'visitWeekTrend' => $visitWeekTrend,
            'publishTrend' => $publishTrend,
            'pageTrend' => $pageTrend,
            'categoryDistribution' => $categoryDistribution,
            'commentActivity' => $commentActivity,
            'hotPosts' => $hotPosts,
            'tagTop' => $tagTop,
            'tagGraph' => $tagGraph,
            'system' => $system,
            'recentPosts' => $recentPosts,
            'recentComments' => $recentComments,
        ]);
    }

    if ($do === 'posts.list') {
        v3a_require_role($user, 'contributor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $page = max(1, (int) $request->get('page', 1));
        $pageSize = (int) $request->get('pageSize', 20);
        $pageSize = max(1, min(50, $pageSize));

        $status = v3a_string($request->get('status', 'all'), 'all');
        $scope = v3a_string($request->get('scope', 'mine'), 'mine');
        if ($scope === 'all' && (empty($acl['posts']['scopeAll']) || !$user->pass('editor', true))) {
            $scope = 'mine';
        }
        $keywords = v3a_string($request->get('keywords', ''), '');
        $category = (int) $request->get('category', 0);

        $select = $db->select(
            'table.contents.cid',
            'table.contents.title',
            'table.contents.created',
            'table.contents.modified',
            'table.contents.type',
            'table.contents.status',
            'table.contents.password',
            'table.contents.commentsNum',
            'table.contents.authorId'
        )
            ->from('table.contents')
            ->where('table.contents.parent = ?', 0)
            ->where('table.contents.type = ? OR table.contents.type = ?', 'post', 'post_draft');

        if (!$user->pass('editor', true) || $scope !== 'all') {
            $select->where('table.contents.authorId = ?', (int) $user->uid);
        }

        if ($status === 'draft') {
            $select->where('table.contents.type = ?', 'post_draft');
        } elseif ($status === 'waiting') {
            $select->where('table.contents.status = ?', 'waiting');
        } elseif ($status === 'publish') {
            $select->where('table.contents.type = ?', 'post')
                ->where('table.contents.status = ?', 'publish');
        } elseif ($status === 'private') {
            $select->where('table.contents.type = ?', 'post')
                ->where('table.contents.status = ?', 'private');
        } elseif ($status === 'hidden') {
            $select->where('table.contents.type = ?', 'post')
                ->where('table.contents.status = ?', 'hidden');
        }

        if ($category > 0) {
            $select->join('table.relationships', 'table.contents.cid = table.relationships.cid')
                ->where('table.relationships.mid = ?', $category);
        }

        if ($keywords !== '') {
            $words = preg_split('/\\s+/u', $keywords);
            $whereParts = [];
            $bind = [];
            foreach ((array) $words as $w) {
                $w = trim((string) $w);
                if ($w === '') {
                    continue;
                }
                $whereParts[] = '(table.contents.title LIKE ? OR table.contents.text LIKE ?)';
                $bind[] = '%' . $w . '%';
                $bind[] = '%' . $w . '%';
            }
            if (!empty($whereParts)) {
                $select->where(implode(' AND ', $whereParts), ...$bind);
            }
        }

        $countSelect = clone $select;
        $countSelect->cleanAttribute('fields');
        $countSelect->cleanAttribute('order');
        $countSelect->cleanAttribute('limit');
        $countSelect->cleanAttribute('offset');
        $countSelect->select(['COUNT(DISTINCT table.contents.cid)' => 'num']);

        $total = 0;
        try {
            $total = (int) ($db->fetchObject($countSelect)->num ?? 0);
        } catch (\Throwable $e) {
        }

        $select->order('table.contents.cid', \Typecho\Db::SORT_DESC)
            ->page($page, $pageSize);

        $rows = [];
        try {
            $rows = $db->fetchAll($select);
        } catch (\Throwable $e) {
        }

        $cids = [];
        $authorIds = [];
        foreach ($rows as $r) {
            $cid = (int) ($r['cid'] ?? 0);
            if ($cid > 0) {
                $cids[] = $cid;
            }
            $aid = (int) ($r['authorId'] ?? 0);
            if ($aid > 0) {
                $authorIds[] = $aid;
            }
        }
        $cids = array_values(array_unique($cids));
        $authorIds = array_values(array_unique($authorIds));

        $catsByCid = [];
        if (!empty($cids)) {
            try {
                $catRows = $db->fetchAll(
                    $db->select(
                        'table.relationships.cid',
                        'table.metas.mid',
                        'table.metas.name'
                    )
                        ->from('table.relationships')
                        ->join('table.metas', 'table.relationships.mid = table.metas.mid')
                        ->where('table.relationships.cid IN ?', $cids)
                        ->where('table.metas.type = ?', 'category')
                );

                foreach ($catRows as $cr) {
                    $cid = (int) ($cr['cid'] ?? 0);
                    if (!isset($catsByCid[$cid])) {
                        $catsByCid[$cid] = [];
                    }
                    $catsByCid[$cid][] = [
                        'mid' => (int) ($cr['mid'] ?? 0),
                        'name' => (string) ($cr['name'] ?? ''),
                    ];
                }
            } catch (\Throwable $e) {
            }
        }

        $tagsByCid = [];
        if (!empty($cids)) {
            try {
                $tagRows = $db->fetchAll(
                    $db->select(
                        'table.relationships.cid',
                        'table.metas.mid',
                        'table.metas.name'
                    )
                        ->from('table.relationships')
                        ->join('table.metas', 'table.relationships.mid = table.metas.mid')
                        ->where('table.relationships.cid IN ?', $cids)
                        ->where('table.metas.type = ?', 'tag')
                );

                foreach ($tagRows as $tr) {
                    $cid = (int) ($tr['cid'] ?? 0);
                    if (!isset($tagsByCid[$cid])) {
                        $tagsByCid[$cid] = [];
                    }
                    $tagsByCid[$cid][] = [
                        'mid' => (int) ($tr['mid'] ?? 0),
                        'name' => (string) ($tr['name'] ?? ''),
                    ];
                }
            } catch (\Throwable $e) {
            }
        }

        $likesByCid = [];
        if (!empty($cids)) {
            try {
                $pdo = v3a_local_pdo();
                if ($pdo) {
                    $placeholders = implode(',', array_fill(0, count($cids), '?'));
                    $stmt = $pdo->prepare(
                        "SELECT cid, COUNT(id) AS num FROM v3a_like WHERE type = 'post' AND cid IN ({$placeholders}) GROUP BY cid"
                    );
                    $stmt->execute(array_values($cids));
                    foreach ((array) $stmt->fetchAll() as $lr) {
                        $cid = (int) ($lr['cid'] ?? 0);
                        if ($cid > 0) {
                            $likesByCid[$cid] = (int) ($lr['num'] ?? 0);
                        }
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        $authorById = [];
        if (!empty($authorIds)) {
            try {
                $aRows = $db->fetchAll(
                    $db->select('uid', 'name', 'screenName')
                        ->from('table.users')
                        ->where('uid IN ?', $authorIds)
                );
                foreach ($aRows as $ar) {
                    $uid = (int) ($ar['uid'] ?? 0);
                    $authorById[$uid] = (string) ($ar['screenName'] ?? $ar['name'] ?? '');
                }
            } catch (\Throwable $e) {
            }
        }

        $items = [];
        foreach ($rows as $r) {
            $cid = (int) ($r['cid'] ?? 0);
            $aid = (int) ($r['authorId'] ?? 0);

            $permalink = '';
            if ($cid > 0 && (string) ($r['type'] ?? '') !== 'post_draft') {
                try {
                    $post = \Widget\Contents\Post\Edit::alloc(null, ['cid' => $cid], false)->prepare();
                    $permalink = (string) ($post->permalink ?? '');
                } catch (\Throwable $e) {
                }
            }
            $items[] = [
                'cid' => $cid,
                'title' => (string) ($r['title'] ?? ''),
                'permalink' => $permalink,
                'created' => (int) ($r['created'] ?? 0),
                'modified' => (int) ($r['modified'] ?? 0),
                'type' => (string) ($r['type'] ?? ''),
                'status' => (string) ($r['status'] ?? ''),
                'password' => (string) ($r['password'] ?? ''),
                'commentsNum' => (int) ($r['commentsNum'] ?? 0),
                'author' => [
                    'uid' => $aid,
                    'name' => $authorById[$aid] ?? '',
                ],
                'categories' => $catsByCid[$cid] ?? [],
                'tags' => $tagsByCid[$cid] ?? [],
                'likes' => $likesByCid[$cid] ?? 0,
            ];
        }

        $pageCount = $pageSize > 0 ? (int) ceil($total / $pageSize) : 1;

        v3a_exit_json(0, [
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'pageCount' => $pageCount,
            ],
        ]);
    }

    if ($do === 'posts.get') {
        v3a_require_role($user, 'contributor');

        $cid = (int) $request->get('cid', 0);

        $acl = v3a_acl_for_user($db, $user);
        if ($cid > 0) {
            if (empty($acl['posts']['manage'])) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        } else {
            if (empty($acl['posts']['write'])) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        }

        try {
            if ($cid > 0) {
                $post = \Widget\Contents\Post\Edit::alloc(null, ['cid' => $cid], false)->prepare();
            } else {
                $post = \Widget\Contents\Post\Edit::alloc(null, [], false)->prepare();
            }

            $tags = [];
            foreach ((array) ($post->tags ?? []) as $t) {
                if (!is_array($t)) {
                    continue;
                }
                $name = (string) ($t['name'] ?? '');
                if ($name !== '') {
                    $tags[] = $name;
                }
            }

            $categories = [];
            foreach ((array) ($post->categories ?? []) as $c) {
                if (!is_array($c)) {
                    continue;
                }
                $mid = (int) ($c['mid'] ?? 0);
                if ($mid > 0) {
                    $categories[] = $mid;
                }
            }

            $fieldItems = [];
            try {
                $rows = $post->getFieldItems();
                foreach ($rows as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $name = (string) ($row['name'] ?? '');
                    $type = (string) ($row['type'] ?? 'str');
                    if ($name === '') {
                        continue;
                    }
                    $value = null;
                    if ($type === 'int') {
                        $value = (int) ($row['int_value'] ?? 0);
                    } elseif ($type === 'float') {
                        $value = (float) ($row['float_value'] ?? 0);
                    } elseif ($type === 'json') {
                        $raw = (string) ($row['str_value'] ?? '');
                        $decoded = json_decode($raw, true);
                        $value = json_last_error() === JSON_ERROR_NONE ? $decoded : $raw;
                    } else {
                        $value = (string) ($row['str_value'] ?? '');
                    }
                    $fieldItems[] = [
                        'name' => $name,
                        'type' => $type,
                        'value' => $value,
                    ];
                }
            } catch (\Throwable $e) {
            }

            $visibility = 'publish';
            if (!empty($post->password)) {
                $visibility = 'password';
            } else {
                $visibility = (string) ($post->status ?? 'publish');
            }

            $defaultFields = [];
            try {
                $defaultFields = v3a_default_fields_for_editor($post, $options, 'post');
            } catch (\Throwable $e) {
            }

            v3a_exit_json(0, [
                'defaultFields' => $defaultFields,
                'post' => [
                    'cid' => (int) $post->cid,
                    'title' => (string) ($post->title ?? ''),
                    'slug' => (string) ($post->slug ?? ''),
                    'text' => (string) ($post->text ?? ''),
                    'created' => (int) ($post->created ?? 0),
                    'modified' => (int) ($post->modified ?? 0),
                    'type' => (string) ($post->type ?? ''),
                    'status' => (string) ($post->status ?? ''),
                    'visibility' => $visibility,
                    'password' => (string) ($post->password ?? ''),
                    'allowComment' => (int) ($post->allowComment ?? 0),
                    'allowPing' => (int) ($post->allowPing ?? 0),
                    'allowFeed' => (int) ($post->allowFeed ?? 0),
                    'categories' => $categories,
                    'tags' => implode(',', $tags),
                    'fields' => $fieldItems,
                    'isMarkdown' => (bool) ($post->isMarkdown ?? false),
                ],
                'capabilities' => [
                    'markdownEnabled' => (bool) ($options->markdown ?? false),
                    'canPublish' => (bool) $user->pass('editor', true),
                ],
            ]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'posts.save' || $do === 'posts.publish') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['write'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();

        // Normalize expected request keys for widget.
        $cid = v3a_int($payload['cid'] ?? 0, 0);
        $slugEmpty = trim((string) ($payload['slug'] ?? '')) === '';

        $widgetRequest = [
            'title' => $payload['title'] ?? '',
            'slug' => $payload['slug'] ?? '',
            'text' => $payload['text'] ?? '',
            'tags' => $payload['tags'] ?? '',
            'visibility' => $payload['visibility'] ?? '',
            'password' => $payload['password'] ?? '',
            'allowComment' => v3a_bool_int($payload['allowComment'] ?? 0),
            'allowPing' => v3a_bool_int($payload['allowPing'] ?? 0),
            'allowFeed' => v3a_bool_int($payload['allowFeed'] ?? 0),
            'markdown' => v3a_bool_int($payload['markdown'] ?? 0),
            'trackback' => $payload['trackback'] ?? '',
        ];

        if ($cid > 0) {
            $widgetRequest['cid'] = $cid;
        }
        if ($slugEmpty && $cid > 0) {
            $widgetRequest['slug'] = (string) $cid;
        }

        $categories = $payload['category'] ?? $payload['categories'] ?? [];
        if (!is_array($categories)) {
            $categories = [];
        }
	        $widgetRequest['category'] = array_values(array_filter(array_map('intval', $categories), function ($v) {
	            return $v > 0;
	        }));

        $fields = $payload['fields'] ?? [];
        if (is_array($fields)) {
            // Support both legacy arrays and simple list.
            if (isset($fields['fieldNames'], $fields['fieldTypes'], $fields['fieldValues'])) {
                $widgetRequest['fieldNames'] = is_array($fields['fieldNames']) ? $fields['fieldNames'] : [];
                $widgetRequest['fieldTypes'] = is_array($fields['fieldTypes']) ? $fields['fieldTypes'] : [];
                $widgetRequest['fieldValues'] = is_array($fields['fieldValues']) ? $fields['fieldValues'] : [];
            } else {
                $fieldNames = [];
                $fieldTypes = [];
                $fieldValues = [];
                $widgetRequest['fields'] = [];
                foreach ($fields as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $name = v3a_string($row['name'] ?? '', '');
                    $type = v3a_string($row['type'] ?? 'str', 'str');
                    if ($name === '') {
                        continue;
                    }
                    if (!in_array($type, ['str', 'int', 'float', 'json'], true)) {
                        $type = 'str';
                    }
                    $value = $row['value'] ?? '';

                    // JSON fields: prefer `fields[name]=array` so Typecho can store as json once.
                    if ($type === 'json') {
                        if (is_string($value)) {
                            $trim = trim($value);
                            if ($trim !== '' && ($trim[0] === '{' || $trim[0] === '[')) {
                                $decoded = json_decode($trim, true);
                                if (json_last_error() === JSON_ERROR_NONE) {
                                    $value = $decoded;
                                }
                            }
                        }

                        if (is_array($value) || is_object($value)) {
                            $widgetRequest['fields'][$name] = $value;
                            continue;
                        }

                        // Fallback: treat as string.
                        $type = 'str';
                    } elseif (is_array($value) || is_object($value)) {
                        $widgetRequest['fields'][$name] = $value;
                        continue;
                    }

                    if ($type === 'int') {
                        $value = (string) intval($value);
                    } elseif ($type === 'float') {
                        $value = (string) floatval($value);
                    } else {
                        $value = (string) $value;
                    }
                    $fieldNames[] = $name;
                    $fieldTypes[] = $type;
                    $fieldValues[] = $value;
                }
                $widgetRequest['fieldNames'] = $fieldNames;
                $widgetRequest['fieldTypes'] = $fieldTypes;
                $widgetRequest['fieldValues'] = $fieldValues;
            }
        }

        try {
            $mode = $do === 'posts.publish' ? 'publish' : 'save';
            $res = V3A_PostEditProxy::alloc(null, $widgetRequest, false)->v3aWrite(
                $mode === 'publish' ? 'publish' : 'save'
            );

            if ($slugEmpty) {
                $savedCid = (int) ($res['cid'] ?? 0);
                if ($savedCid > 0) {
                    $slugUpdated = v3a_default_slug_to_cid($db, $savedCid, ['post', 'post_draft']);
                    if ($slugUpdated) {
                        try {
                            $post = \Widget\Contents\Post\Edit::alloc(null, ['cid' => $savedCid], false)->prepare();
                            $res['permalink'] = (string) ($post->permalink ?? ($res['permalink'] ?? ''));
                        } catch (\Throwable $e) {
                        }
                    }

                    try {
                        $row = $db->fetchObject(
                            $db->select('slug')->from('table.contents')->where('cid = ?', $savedCid)->limit(1)
                        );
                        $res['slug'] = (string) ($row->slug ?? '');
                    } catch (\Throwable $e) {
                    }
                }
            }
            v3a_exit_json(0, $res);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'posts.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $cids = $payload['cids'] ?? $payload['cid'] ?? $payload['ids'] ?? [];
        if (is_numeric($cids)) {
            $cids = [(int) $cids];
        }
        if (!is_array($cids)) {
            $cids = [];
        }
	        $cids = array_values(array_unique(array_filter(array_map('intval', $cids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($cids)) {
            v3a_exit_json(400, null, 'Missing cid');
        }

        try {
            $deleted = V3A_PostEditProxy::alloc()->v3aDelete($cids);
            v3a_exit_json(0, ['deleted' => (int) $deleted]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'posts.status') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $status = v3a_string($payload['status'] ?? '', '');
        if (!in_array($status, ['publish', 'hidden', 'private', 'waiting'], true)) {
            v3a_exit_json(400, null, 'Invalid status');
        }

        if ($status === 'publish' && !$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $cids = $payload['cids'] ?? $payload['cid'] ?? $payload['ids'] ?? [];
        if (is_numeric($cids)) {
            $cids = [(int) $cids];
        }
        if (!is_array($cids)) {
            $cids = [];
        }
	        $cids = array_values(array_unique(array_filter(array_map('intval', $cids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($cids)) {
            v3a_exit_json(400, null, 'Missing cid');
        }

        $uid = (int) ($user->uid ?? 0);
        if ($uid <= 0) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        try {
            $isEditor = (bool) $user->pass('editor', true);

            $itemsQuery = $db->select('cid', 'status')
                ->from('table.contents')
                ->where('type = ?', 'post')
                ->where('cid IN ?', $cids);
            if (!$isEditor) {
                $itemsQuery->where('authorId = ?', $uid);
            }

            $items = $db->fetchAll($itemsQuery);
            if (empty($items)) {
                v3a_exit_json(0, ['updated' => 0]);
            }

	            $allowedCids = array_values(array_unique(array_filter(array_map(
	                function ($row) {
	                    return (int) ($row['cid'] ?? 0);
	                },
	                (array) $items
	            ), function ($v) {
	                return $v > 0;
	            })));

            if (empty($allowedCids)) {
                v3a_exit_json(0, ['updated' => 0]);
            }

            $cidOps = [];
            foreach ($items as $row) {
                $cid = (int) ($row['cid'] ?? 0);
                if ($cid <= 0) {
                    continue;
                }

                $oldStatus = (string) ($row['status'] ?? '');
                if ($status === 'publish' && $oldStatus !== 'publish') {
                    $cidOps[$cid] = '+';
                } elseif ($status !== 'publish' && $oldStatus === 'publish') {
                    $cidOps[$cid] = '-';
                }
            }

            $rows = [
                'status' => $status,
                'modified' => (int) ($options->time ?? time()),
            ];

            $update = $db->update('table.contents')
                ->rows($rows)
                ->where('type = ?', 'post')
                ->where('cid IN ?', $allowedCids);
            if (!$isEditor) {
                $update->where('authorId = ?', $uid);
            }

            $updated = (int) $db->query($update);

            if (!empty($cidOps)) {
                $relRows = $db->fetchAll(
                    $db->select('cid', 'mid')
                        ->from('table.relationships')
                        ->where('cid IN ?', array_keys($cidOps))
                );

                $midDelta = [];
                foreach ((array) $relRows as $rel) {
                    $cid = (int) ($rel['cid'] ?? 0);
                    $mid = (int) ($rel['mid'] ?? 0);
                    if ($cid <= 0 || $mid <= 0) {
                        continue;
                    }
                    $op = $cidOps[$cid] ?? null;
                    if ($op === '+') {
                        $midDelta[$mid] = ($midDelta[$mid] ?? 0) + 1;
                    } elseif ($op === '-') {
                        $midDelta[$mid] = ($midDelta[$mid] ?? 0) - 1;
                    }
                }

                foreach ($midDelta as $mid => $delta) {
                    $delta = (int) $delta;
                    if ($delta === 0) {
                        continue;
                    }

                    if ($delta > 0) {
                        $expr = 'count + ' . $delta;
                    } else {
                        $n = abs($delta);
                        $expr = 'CASE WHEN count >= ' . $n . ' THEN count - ' . $n . ' ELSE 0 END';
                    }

                    $db->query(
                        $db->update('table.metas')
                            ->expression('count', $expr, false)
                            ->where('mid = ? AND (type = ? OR type = ?)', (int) $mid, 'category', 'tag'),
                        \Typecho\Db::WRITE
                    );
                }
            }

            v3a_exit_json(0, ['updated' => $updated]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'pages.list') {
        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['pages']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $keywords = v3a_string($request->get('keywords', ''), '');
        $status = v3a_string($request->get('status', 'all'), 'all'); // all|publish|hidden|draft
 
        // Load all pages (include children) for tree rendering; filter later.
        $rows = $db->fetchAll(
            $db->select(
                'table.contents.cid',
                'table.contents.title',
                'table.contents.slug',
                'table.contents.created',
                'table.contents.modified',
                'table.contents.type',
                'table.contents.status',
                'table.contents.commentsNum',
                'table.contents.order',
                'table.contents.parent',
                'table.contents.template',
                'table.contents.text'
            )
                ->from('table.contents')
                ->where('table.contents.type = ? OR table.contents.type = ?', 'page', 'page_draft')
                ->order('table.contents.order', \Typecho\Db::SORT_ASC)
                ->order('table.contents.cid', \Typecho\Db::SORT_DESC)
        );

        $itemsByCid = [];
        $children = [];
        foreach ($rows as $r) {
            $cid = (int) ($r['cid'] ?? 0);
            if ($cid <= 0) {
                continue;
            }
            $parent = (int) ($r['parent'] ?? 0);
            $itemsByCid[$cid] = [
                'cid' => $cid,
                'title' => (string) ($r['title'] ?? ''),
                'slug' => (string) ($r['slug'] ?? ''),
                'created' => (int) ($r['created'] ?? 0),
                'modified' => (int) ($r['modified'] ?? 0),
                'type' => (string) ($r['type'] ?? ''),
                'status' => (string) ($r['status'] ?? ''),
                'commentsNum' => (int) ($r['commentsNum'] ?? 0),
                'order' => (int) ($r['order'] ?? 0),
                'parent' => $parent,
                'template' => (string) ($r['template'] ?? ''),
                'text' => (string) ($r['text'] ?? ''),
            ];
            if (!isset($children[$parent])) {
                $children[$parent] = [];
            }
            $children[$parent][] = $cid;
        }

        foreach ($children as $pid => $list) {
            usort(
                $list,
                function (int $a, int $b) use ($itemsByCid): int {
                    $oa = (int) ($itemsByCid[$a]['order'] ?? 0);
                    $ob = (int) ($itemsByCid[$b]['order'] ?? 0);
                    if ($oa === $ob) {
                        return $b <=> $a;
                    }
                    return $oa <=> $ob;
                }
            );
            $children[$pid] = $list;
        }

        $result = [];
        $walk = function (int $parent, int $level) use (&$walk, &$result, $children, $itemsByCid): void {
            foreach (($children[$parent] ?? []) as $cid) {
                if (!isset($itemsByCid[$cid])) {
                    continue;
                }
                $item = $itemsByCid[$cid];
                $item['levels'] = $level;
                $result[] = $item;
                $walk($cid, $level + 1);
            }
        };
        $walk(0, 0);

        if ($status !== 'all') {
            $result = array_values(array_filter($result, function ($item) use ($status): bool {
                $type = (string) ($item['type'] ?? '');
                $st = (string) ($item['status'] ?? '');
                if ($status === 'draft') {
                    return $type === 'page_draft';
                }
                if ($status === 'publish') {
                    return $type === 'page' && $st === 'publish';
                }
                if ($status === 'hidden') {
                    return $type === 'page' && $st === 'hidden';
                }
                return true;
            }));
        }

        if ($keywords !== '') {
            $words = preg_split('/\\s+/u', $keywords);
	            $words = array_values(array_filter(array_map('trim', (array) $words), function ($v) {
	                return $v !== '';
	            }));
            if (!empty($words)) {
                $result = array_values(array_filter($result, function ($item) use ($words): bool {
                    $hay = (string) (($item['title'] ?? '') . "\n" . ($item['text'] ?? ''));
                    foreach ($words as $w) {
                        if ($w === '') {
                            continue;
                        }
                        if (stripos($hay, $w) === false) {
                            return false;
                        }
                    }
                    return true;
                }));

                // Search results: flatten indentation.
                foreach ($result as &$it) {
                    if (is_array($it)) {
                        $it['levels'] = 0;
                    }
                }
                unset($it);
            }
        }

        foreach ($result as &$it) {
            if (is_array($it)) {
                unset($it['text']);
            }
        }
        unset($it);

        v3a_exit_json(0, ['items' => $result]);
    }

    if ($do === 'pages.get') {
        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['pages']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $cid = (int) $request->get('cid', 0);
        $parent = (int) $request->get('parent', 0);

        try {
            if ($cid > 0) {
                $page = \Widget\Contents\Page\Edit::alloc(null, ['cid' => $cid], false)->prepare();
            } else {
                $page = \Widget\Contents\Page\Edit::alloc(null, ['parent' => $parent], false)->prepare();
            }

            $fieldItems = [];
            try {
                $rows = $page->getFieldItems();
                foreach ($rows as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $name = (string) ($row['name'] ?? '');
                    $type = (string) ($row['type'] ?? 'str');
                    if ($name === '') {
                        continue;
                    }
                    $value = null;
                    if ($type === 'int') {
                        $value = (int) ($row['int_value'] ?? 0);
                    } elseif ($type === 'float') {
                        $value = (float) ($row['float_value'] ?? 0);
                    } elseif ($type === 'json') {
                        $raw = (string) ($row['str_value'] ?? '');
                        $decoded = json_decode($raw, true);
                        $value = json_last_error() === JSON_ERROR_NONE ? $decoded : $raw;
                    } else {
                        $value = (string) ($row['str_value'] ?? '');
                    }
                    $fieldItems[] = [
                        'name' => $name,
                        'type' => $type,
                        'value' => $value,
                    ];
                }
            } catch (\Throwable $e) {
            }

            $templates = [];
            try {
                $t = $page->getTemplates();
                if (is_array($t)) {
                    foreach ($t as $k => $v) {
                        $templates[] = ['value' => (string) $k, 'label' => (string) $v];
                    }
                }
            } catch (\Throwable $e) {
            }

            $parentOptions = [['cid' => 0, 'title' => _t('不选择'), 'levels' => 0]];
            try {
                $parents = \Widget\Contents\Page\Admin::allocWithAlias(
                    'v3a_page_parents',
                    'ignoreRequest=1' . ($cid > 0 ? '&ignore=' . $cid : '')
                );
                while ($parents->next()) {
                    $parentOptions[] = [
                        'cid' => (int) $parents->cid,
                        'title' => (string) ($parents->title ?? ''),
                        'levels' => (int) ($parents->levels ?? 0),
                    ];
                }
            } catch (\Throwable $e) {
            }

            $defaultFields = [];
            try {
                $defaultFields = v3a_default_fields_for_editor($page, $options, 'page');
            } catch (\Throwable $e) {
            }

            v3a_exit_json(0, [
                'defaultFields' => $defaultFields,
                'page' => [
                    'cid' => (int) ($page->cid ?? 0),
                    'title' => (string) ($page->title ?? ''),
                    'slug' => (string) ($page->slug ?? ''),
                    'text' => (string) ($page->text ?? ''),
                    'created' => (int) ($page->created ?? 0),
                    'modified' => (int) ($page->modified ?? 0),
                    'type' => (string) ($page->type ?? ''),
                    'status' => (string) ($page->status ?? ''),
                    'visibility' => (string) ($page->status ?? 'publish'),
                    'template' => (string) ($page->template ?? ''),
                    'order' => (int) ($page->order ?? 0),
                    'parent' => (int) ($page->parent ?? 0),
                    'allowComment' => (int) ($page->allowComment ?? 0),
                    'allowPing' => (int) ($page->allowPing ?? 0),
                    'allowFeed' => (int) ($page->allowFeed ?? 0),
                    'fields' => $fieldItems,
                    'isMarkdown' => (bool) ($page->isMarkdown ?? false),
                ],
                'templates' => $templates,
                'parentOptions' => $parentOptions,
                'capabilities' => [
                    'markdownEnabled' => (bool) ($options->markdown ?? false),
                    'canPublish' => (bool) $user->pass('editor', true),
                ],
            ]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'pages.save' || $do === 'pages.publish') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);

        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['pages']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();

        $cid = v3a_int($payload['cid'] ?? 0, 0);
        $slugEmpty = trim((string) ($payload['slug'] ?? '')) === '';

        $widgetRequest = [
            'title' => $payload['title'] ?? '',
            'slug' => $payload['slug'] ?? '',
            'text' => $payload['text'] ?? '',
            'template' => $payload['template'] ?? '',
            'order' => v3a_int($payload['order'] ?? 0, 0),
            'parent' => v3a_int($payload['parent'] ?? 0, 0),
            'visibility' => $payload['visibility'] ?? 'publish',
            'allowComment' => v3a_bool_int($payload['allowComment'] ?? 0),
            'allowPing' => v3a_bool_int($payload['allowPing'] ?? 0),
            'allowFeed' => v3a_bool_int($payload['allowFeed'] ?? 0),
            'markdown' => v3a_bool_int($payload['markdown'] ?? 0),
        ];

        if ($cid > 0) {
            $widgetRequest['cid'] = $cid;
        }
        if ($slugEmpty && $cid > 0) {
            $widgetRequest['slug'] = (string) $cid;
        }

        $fields = $payload['fields'] ?? [];
        if (is_array($fields)) {
            if (isset($fields['fieldNames'], $fields['fieldTypes'], $fields['fieldValues'])) {
                $widgetRequest['fieldNames'] = is_array($fields['fieldNames']) ? $fields['fieldNames'] : [];
                $widgetRequest['fieldTypes'] = is_array($fields['fieldTypes']) ? $fields['fieldTypes'] : [];
                $widgetRequest['fieldValues'] = is_array($fields['fieldValues']) ? $fields['fieldValues'] : [];
            } else {
                $fieldNames = [];
                $fieldTypes = [];
                $fieldValues = [];
                $widgetRequest['fields'] = [];
                foreach ($fields as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $name = v3a_string($row['name'] ?? '', '');
                    $type = v3a_string($row['type'] ?? 'str', 'str');
                    if ($name === '') {
                        continue;
                    }
                    if (!in_array($type, ['str', 'int', 'float', 'json'], true)) {
                        $type = 'str';
                    }
                    $value = $row['value'] ?? '';

                    if ($type === 'json') {
                        if (is_string($value)) {
                            $trim = trim($value);
                            if ($trim !== '' && ($trim[0] === '{' || $trim[0] === '[')) {
                                $decoded = json_decode($trim, true);
                                if (json_last_error() === JSON_ERROR_NONE) {
                                    $value = $decoded;
                                }
                            }
                        }

                        if (is_array($value) || is_object($value)) {
                            $widgetRequest['fields'][$name] = $value;
                            continue;
                        }

                        $type = 'str';
                    } elseif (is_array($value) || is_object($value)) {
                        $widgetRequest['fields'][$name] = $value;
                        continue;
                    }

                    if ($type === 'int') {
                        $value = (string) intval($value);
                    } elseif ($type === 'float') {
                        $value = (string) floatval($value);
                    } else {
                        $value = (string) $value;
                    }
                    $fieldNames[] = $name;
                    $fieldTypes[] = $type;
                    $fieldValues[] = $value;
                }
                $widgetRequest['fieldNames'] = $fieldNames;
                $widgetRequest['fieldTypes'] = $fieldTypes;
                $widgetRequest['fieldValues'] = $fieldValues;
            }
        }

        try {
            $mode = $do === 'pages.publish' ? 'publish' : 'save';
            $res = V3A_PageEditProxy::alloc(null, $widgetRequest, false)->v3aWrite(
                $mode === 'publish' ? 'publish' : 'save'
            );

            if ($slugEmpty) {
                $savedCid = (int) ($res['cid'] ?? 0);
                if ($savedCid > 0) {
                    $slugUpdated = v3a_default_slug_to_cid($db, $savedCid, ['page', 'page_draft']);
                    if ($slugUpdated) {
                        try {
                            $page = \Widget\Contents\Page\Edit::alloc(null, ['cid' => $savedCid], false)->prepare();
                            $res['permalink'] = (string) ($page->permalink ?? ($res['permalink'] ?? ''));
                        } catch (\Throwable $e) {
                        }
                    }

                    try {
                        $row = $db->fetchObject(
                            $db->select('slug')->from('table.contents')->where('cid = ?', $savedCid)->limit(1)
                        );
                        $res['slug'] = (string) ($row->slug ?? '');
                    } catch (\Throwable $e) {
                    }
                }
            }
            v3a_exit_json(0, $res);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'pages.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);

        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['pages']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $cids = $payload['cids'] ?? $payload['cid'] ?? $payload['ids'] ?? [];
        if (is_numeric($cids)) {
            $cids = [(int) $cids];
        }
        if (!is_array($cids)) {
            $cids = [];
        }
	        $cids = array_values(array_unique(array_filter(array_map('intval', $cids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($cids)) {
            v3a_exit_json(400, null, 'Missing cid');
        }

        try {
            $deleted = V3A_PageEditProxy::alloc()->v3aDelete($cids);
            v3a_exit_json(0, ['deleted' => (int) $deleted]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'comments.list') {
        v3a_require_role($user, 'editor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['comments']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $page = max(1, (int) $request->get('page', 1));
        $pageSize = (int) $request->get('pageSize', 20);
        $pageSize = max(1, min(50, $pageSize));

        $status = v3a_string($request->get('status', 'approved'), 'approved'); // approved|waiting|spam|hold|all
        $scope = v3a_string($request->get('scope', 'mine'), 'mine'); // mine|all (editors only)
        if ($scope === 'all' && empty($acl['comments']['scopeAll'])) {
            $scope = 'mine';
        }
        $keywords = v3a_string($request->get('keywords', ''), '');
        $cid = (int) $request->get('cid', 0);

        $select = $db->select(
            'table.comments.coid',
            'table.comments.cid',
            'table.comments.created',
            'table.comments.status',
            'table.comments.author',
            'table.comments.mail',
            'table.comments.url',
            'table.comments.text',
            'table.comments.parent',
            'table.comments.ownerId',
            'table.comments.authorId',
            'table.comments.ip'
        )->from('table.comments');

        if (!$user->pass('editor', true) || $scope !== 'all') {
            $select->where('table.comments.ownerId = ?', (int) $user->uid);
        }

        if ($cid > 0) {
            $select->where('table.comments.cid = ?', $cid);
        }

        if (in_array($status, ['approved', 'waiting', 'spam'], true)) {
            $select->where('table.comments.status = ?', $status);
        } elseif ($status === 'hold') {
            $select->where('table.comments.status <> ?', 'approved');
        } elseif ($status !== 'all') {
            $select->where('table.comments.status = ?', 'approved');
        }

        if ($keywords !== '') {
            $words = preg_split('/\\s+/u', $keywords);
            $whereParts = [];
            $bind = [];
            foreach ((array) $words as $w) {
                $w = trim((string) $w);
                if ($w === '') {
                    continue;
                }
                $whereParts[] = '(table.comments.author LIKE ? OR table.comments.mail LIKE ? OR table.comments.text LIKE ?)';
                $bind[] = '%' . $w . '%';
                $bind[] = '%' . $w . '%';
                $bind[] = '%' . $w . '%';
            }
            if (!empty($whereParts)) {
                $select->where(implode(' AND ', $whereParts), ...$bind);
            }
        }

        $countSelect = clone $select;
        $total = (int) ($db->fetchObject(
            $countSelect->select(['COUNT(table.comments.coid)' => 'num'])->from('table.comments')
        )->num ?? 0);

        $select->order('table.comments.coid', \Typecho\Db::SORT_DESC)->page($page, $pageSize);
        $rows = $db->fetchAll($select);

        $postTitleByCid = [];
        $postTypeByCid = [];
        $postStatusByCid = [];
        $postIds = [];
        foreach ($rows as $r) {
            $id = (int) ($r['cid'] ?? 0);
            if ($id > 0) {
                $postIds[] = $id;
            }
        }
        $postIds = array_values(array_unique($postIds));
        if (!empty($postIds)) {
            try {
                $cRows = $db->fetchAll(
                    $db->select('cid', 'title', 'type', 'status')->from('table.contents')->where('cid IN ?', $postIds)
                );
                foreach ($cRows as $cr) {
                    $id = (int) ($cr['cid'] ?? 0);
                    $postTitleByCid[$id] = (string) ($cr['title'] ?? '');
                    $postTypeByCid[$id] = (string) ($cr['type'] ?? '');
                    $postStatusByCid[$id] = (string) ($cr['status'] ?? '');
                }
            } catch (\Throwable $e) {
            }
        }

        $items = [];
        foreach ($rows as $r) {
            $mail = (string) ($r['mail'] ?? '');
            $text = (string) ($r['text'] ?? '');
            $plain = strip_tags($text);
            $plain = preg_replace('/\\s+/u', ' ', (string) $plain);

            $postCid = (int) ($r['cid'] ?? 0);
            $items[] = [
                'coid' => (int) ($r['coid'] ?? 0),
                'cid' => $postCid,
                'author' => (string) ($r['author'] ?? ''),
                'mail' => $mail,
                'avatar' => v3a_gravatar_mirror_url($mail, 64),
                'url' => (string) ($r['url'] ?? ''),
                'text' => (string) ($r['text'] ?? ''),
                'excerpt' => v3a_truncate((string) $plain, 120),
                'status' => (string) ($r['status'] ?? ''),
                'created' => (int) ($r['created'] ?? 0),
                'ip' => (string) ($r['ip'] ?? ''),
                'parent' => (int) ($r['parent'] ?? 0),
                'post' => [
                    'cid' => $postCid,
                    'title' => $postTitleByCid[$postCid] ?? '',
                    'type' => $postTypeByCid[$postCid] ?? '',
                    'status' => $postStatusByCid[$postCid] ?? '',
                ],
            ];
        }

        $pageCount = $pageSize > 0 ? (int) ceil($total / $pageSize) : 1;
        v3a_exit_json(0, [
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'pageCount' => $pageCount,
            ],
        ]);
    }

    if ($do === 'comments.get') {
        v3a_require_role($user, 'editor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['comments']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $coid = (int) $request->get('coid', 0);
        if ($coid <= 0) {
            v3a_exit_json(400, null, 'Missing coid');
        }

        $row = $db->fetchRow(
            $db->select(
                'table.comments.coid',
                'table.comments.cid',
                'table.comments.created',
                'table.comments.status',
                'table.comments.author',
                'table.comments.mail',
                'table.comments.url',
                'table.comments.text',
                'table.comments.parent',
                'table.comments.ownerId',
                'table.comments.authorId',
                'table.comments.ip',
                'table.comments.agent'
            )
                ->from('table.comments')
                ->where('table.comments.coid = ?', $coid)
                ->limit(1)
        );

        if (!$row) {
            v3a_exit_json(404, null, 'Not Found');
        }

        $ownerId = (int) ($row['ownerId'] ?? 0);
        if (empty($acl['comments']['scopeAll']) && $ownerId !== (int) $user->uid) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $postCid = (int) ($row['cid'] ?? 0);
        $post = null;
        if ($postCid > 0) {
            try {
                $p = $db->fetchRow(
                    $db->select('cid', 'title', 'type', 'status')
                        ->from('table.contents')
                        ->where('cid = ?', $postCid)
                        ->limit(1)
                );
                if ($p) {
                    $post = [
                        'cid' => (int) ($p['cid'] ?? 0),
                        'title' => (string) ($p['title'] ?? ''),
                        'type' => (string) ($p['type'] ?? ''),
                        'status' => (string) ($p['status'] ?? ''),
                    ];
                }
            } catch (\Throwable $e) {
            }
        }

        v3a_exit_json(0, [
            'comment' => [
                'coid' => (int) ($row['coid'] ?? 0),
                'cid' => $postCid,
                'author' => (string) ($row['author'] ?? ''),
                'mail' => (string) ($row['mail'] ?? ''),
                'avatar' => v3a_gravatar_mirror_url((string) ($row['mail'] ?? ''), 96),
                'url' => (string) ($row['url'] ?? ''),
                'text' => (string) ($row['text'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'created' => (int) ($row['created'] ?? 0),
                'ip' => (string) ($row['ip'] ?? ''),
                'agent' => (string) ($row['agent'] ?? ''),
                'parent' => (int) ($row['parent'] ?? 0),
                'ownerId' => $ownerId,
                'authorId' => (int) ($row['authorId'] ?? 0),
            ],
            'post' => $post,
        ]);
    }

    if ($do === 'comments.mark') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'editor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['comments']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $status = v3a_string($payload['status'] ?? '', '');
        if (!in_array($status, ['approved', 'waiting', 'spam'], true)) {
            v3a_exit_json(400, null, 'Invalid status');
        }

        $coids = $payload['coids'] ?? $payload['coid'] ?? $payload['ids'] ?? [];
        if (is_numeric($coids)) {
            $coids = [(int) $coids];
        }
        if (!is_array($coids)) {
            $coids = [];
        }
	        $coids = array_values(array_unique(array_filter(array_map('intval', $coids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($coids)) {
            v3a_exit_json(400, null, 'Missing coid');
        }

        if (empty($acl['comments']['scopeAll'])) {
            $uid = (int) ($user->uid ?? 0);
            if ($uid <= 0) {
                v3a_exit_json(403, null, 'Forbidden');
            }

            $forbidden = (int) ($db->fetchObject(
                $db->select(['COUNT(coid)' => 'num'])
                    ->from('table.comments')
                    ->where('coid IN ?', $coids)
                    ->where('ownerId <> ?', $uid)
            )->num ?? 0);
            if ($forbidden > 0) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        }

        try {
            $updated = V3A_CommentsEditProxy::alloc()->v3aMark($coids, $status);
            v3a_exit_json(0, ['updated' => (int) $updated]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'comments.edit') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'editor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['comments']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $coid = v3a_int($payload['coid'] ?? 0, 0);
        if ($coid <= 0) {
            v3a_exit_json(400, null, 'Missing coid');
        }

        if (empty($acl['comments']['scopeAll'])) {
            $uid = (int) ($user->uid ?? 0);
            if ($uid <= 0) {
                v3a_exit_json(403, null, 'Forbidden');
            }
            $row = $db->fetchRow(
                $db->select('coid', 'ownerId')->from('table.comments')->where('coid = ?', $coid)->limit(1)
            );
            $ownerId = (int) ($row['ownerId'] ?? 0);
            if (empty($row) || $ownerId !== $uid) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        }

        $widgetRequest = [
            'coid' => $coid,
            'text' => $payload['text'] ?? '',
            'author' => $payload['author'] ?? '',
            'mail' => $payload['mail'] ?? '',
            'url' => $payload['url'] ?? '',
        ];
        if (isset($payload['created'])) {
            $widgetRequest['created'] = v3a_int($payload['created'] ?? 0, 0);
        }

        try {
            $comment = V3A_CommentsEditProxy::alloc(null, $widgetRequest, false)->v3aEdit($coid);
            v3a_exit_json(0, ['comment' => $comment]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'comments.reply') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'editor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['comments']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $coid = v3a_int($payload['coid'] ?? 0, 0);
        $text = v3a_string($payload['text'] ?? '', '');
        if ($coid <= 0) {
            v3a_exit_json(400, null, 'Missing coid');
        }
        if ($text === '') {
            v3a_exit_json(400, null, 'Missing text');
        }

        if (empty($acl['comments']['scopeAll'])) {
            $uid = (int) ($user->uid ?? 0);
            if ($uid <= 0) {
                v3a_exit_json(403, null, 'Forbidden');
            }
            $row = $db->fetchRow(
                $db->select('coid', 'ownerId')->from('table.comments')->where('coid = ?', $coid)->limit(1)
            );
            $ownerId = (int) ($row['ownerId'] ?? 0);
            if (empty($row) || $ownerId !== $uid) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        }

        try {
            $comment = V3A_CommentsEditProxy::alloc(null, ['coid' => $coid, 'text' => $text], false)->v3aReply(
                $coid
            );
            v3a_exit_json(0, ['comment' => $comment]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'comments.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'editor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['comments']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $coids = $payload['coids'] ?? $payload['coid'] ?? $payload['ids'] ?? [];
        if (is_numeric($coids)) {
            $coids = [(int) $coids];
        }
        if (!is_array($coids)) {
            $coids = [];
        }
	        $coids = array_values(array_unique(array_filter(array_map('intval', $coids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($coids)) {
            v3a_exit_json(400, null, 'Missing coid');
        }

        if (empty($acl['comments']['scopeAll'])) {
            $uid = (int) ($user->uid ?? 0);
            if ($uid <= 0) {
                v3a_exit_json(403, null, 'Forbidden');
            }

            $forbidden = (int) ($db->fetchObject(
                $db->select(['COUNT(coid)' => 'num'])
                    ->from('table.comments')
                    ->where('coid IN ?', $coids)
                    ->where('ownerId <> ?', $uid)
            )->num ?? 0);
            if ($forbidden > 0) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        }

        try {
            $deleted = V3A_CommentsEditProxy::alloc()->v3aDelete($coids);
            v3a_exit_json(0, ['deleted' => (int) $deleted]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'files.list') {
        v3a_require_role($user, 'contributor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['files']['access'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $page = max(1, (int) $request->get('page', 1));
        $pageSize = (int) $request->get('pageSize', 20);
        $pageSize = max(1, min(60, $pageSize));
        $keywords = v3a_string($request->get('keywords', ''), '');

        $select = $db->select(
            'table.contents.cid',
            'table.contents.title',
            'table.contents.created',
            'table.contents.modified',
            'table.contents.parent',
            'table.contents.authorId',
            'table.contents.text'
        )
            ->from('table.contents')
            ->where('table.contents.type = ?', 'attachment');

        if (!$user->pass('editor', true) || empty($acl['files']['scopeAll'])) {
            $select->where('table.contents.authorId = ?', (int) $user->uid);
        }

        if ($keywords !== '') {
            $words = preg_split('/\\s+/u', $keywords);
            $whereParts = [];
            $bind = [];
            foreach ((array) $words as $w) {
                $w = trim((string) $w);
                if ($w === '') {
                    continue;
                }
                $whereParts[] = '(table.contents.title LIKE ?)';
                $bind[] = '%' . $w . '%';
            }
            if (!empty($whereParts)) {
                $select->where(implode(' AND ', $whereParts), ...$bind);
            }
        }

        $countSelect = clone $select;
        $countSelect->cleanAttribute('fields');
        $countSelect->cleanAttribute('order');
        $countSelect->cleanAttribute('limit');
        $countSelect->cleanAttribute('offset');
        $countSelect->select(['COUNT(DISTINCT table.contents.cid)' => 'num']);

        $total = 0;
        try {
            $total = (int) ($db->fetchObject($countSelect)->num ?? 0);
        } catch (\Throwable $e) {
        }

        $select->order('table.contents.created', \Typecho\Db::SORT_DESC)
            ->page($page, $pageSize);

        $rows = [];
        try {
            $rows = $db->fetchAll($select);
        } catch (\Throwable $e) {
        }

        $parentIds = [];
        foreach ($rows as $r) {
            $pid = (int) ($r['parent'] ?? 0);
            if ($pid > 0) {
                $parentIds[] = $pid;
            }
        }
        $parentIds = array_values(array_unique($parentIds));

        $parentMap = [];
        if (!empty($parentIds)) {
            try {
                $pRows = $db->fetchAll(
                    $db->select('cid', 'title', 'type')
                        ->from('table.contents')
                        ->where('cid IN ?', $parentIds)
                );
                foreach ($pRows as $pr) {
                    $parentMap[(int) $pr['cid']] = [
                        'cid' => (int) $pr['cid'],
                        'title' => (string) ($pr['title'] ?? ''),
                        'type' => (string) ($pr['type'] ?? ''),
                    ];
                }
            } catch (\Throwable $e) {
            }
        }

        $items = [];
        foreach ($rows as $r) {
            $cid = (int) ($r['cid'] ?? 0);
            $meta = [];
            $raw = (string) ($r['text'] ?? '');
            if ($raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    $meta = $decoded;
                }
            }

            $url = '';
            $isImage = false;
            $mime = (string) ($meta['mime'] ?? '');
            $size = (int) ($meta['size'] ?? 0);
            try {
                if (!empty($meta['path'])) {
                    $cfg = new \Typecho\Config($meta);
                    $url = \Widget\Upload::attachmentHandle($cfg);
                }
            } catch (\Throwable $e) {
            }
            if ($mime !== '') {
                $isImage = stripos($mime, 'image/') === 0;
            }

            $parentId = (int) ($r['parent'] ?? 0);

            $items[] = [
                'cid' => $cid,
                'title' => (string) ($r['title'] ?? ''),
                'created' => (int) ($r['created'] ?? 0),
                'modified' => (int) ($r['modified'] ?? 0),
                'authorId' => (int) ($r['authorId'] ?? 0),
                'parent' => $parentId > 0 ? ($parentMap[$parentId] ?? ['cid' => $parentId]) : null,
                'file' => [
                    'name' => (string) ($meta['name'] ?? ''),
                    'path' => (string) ($meta['path'] ?? ''),
                    'type' => (string) ($meta['type'] ?? ''),
                    'mime' => $mime,
                    'size' => $size,
                    'bytes' => number_format(ceil($size / 1024)) . ' Kb',
                    'isImage' => $isImage,
                    'url' => $url,
                ],
            ];
        }

        $pageCount = $pageSize > 0 ? (int) ceil($total / $pageSize) : 1;

        v3a_exit_json(0, [
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'pageCount' => $pageCount,
            ],
        ]);
    }

    if ($do === 'files.upload') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['files']['access']) || empty($acl['files']['upload'])) {
            v3a_exit_json(403, null, '当前用户组无上传权限');
        }

        if (empty($_FILES) || !is_array($_FILES)) {
            v3a_exit_json(400, null, 'Missing file');
        }

        $file = null;
        if (isset($_FILES['file']) && is_array($_FILES['file'])) {
            $file = $_FILES['file'];
        } else {
            foreach ($_FILES as $f) {
                if (is_array($f)) {
                    $file = $f;
                    break;
                }
            }
        }

        if (!$file || !is_array($file)) {
            v3a_exit_json(400, null, 'Missing file');
        }

        // If multiple uploads in one field, take the first one.
        if (is_array($file['name'] ?? null)) {
            $idx = 0;
            $file = [
                'name' => (string) (($file['name'][$idx] ?? '') ?: ''),
                'type' => (string) (($file['type'][$idx] ?? '') ?: ''),
                'tmp_name' => (string) (($file['tmp_name'][$idx] ?? '') ?: ''),
                'error' => (int) ($file['error'][$idx] ?? UPLOAD_ERR_NO_FILE),
                'size' => (int) (($file['size'][$idx] ?? 0) ?: 0),
            ];
        }

        $err = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
        if ($err !== UPLOAD_ERR_OK) {
            v3a_exit_json(400, null, 'Upload failed');
        }

        $tmp = isset($file['tmp_name']) ? (string) $file['tmp_name'] : '';
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            v3a_exit_json(400, null, 'Upload failed');
        }

        // Match Typecho behavior for ajax filename.
        if ($request->isAjax() && isset($file['name'])) {
            $file['name'] = urldecode((string) $file['name']);
        }

        $name = trim((string) ($file['name'] ?? ''));
        if ($name === '') {
            v3a_exit_json(400, null, 'Upload failed');
        }

        $size = isset($file['size']) ? (int) $file['size'] : 0;
        $maxSizeMb = (int) ($acl['files']['maxSizeMb'] ?? 0);
        if ($maxSizeMb > 0 && $size > $maxSizeMb * 1024 * 1024) {
            v3a_exit_json(413, null, '文件过大（上限 ' . $maxSizeMb . 'MB）');
        }

        $ext = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
        $ext = ltrim($ext, '.');

        if ($ext === '') {
            v3a_exit_json(400, null, '不允许的文件类型');
        }

        // Always block dangerous extensions (even if misconfigured).
        if (preg_match('/^(php|php\\d+|phtml|pht|phar|cgi|pl|py|rb|sh|bat|cmd|com|exe|dll|asp|aspx|jsp)$/i', $ext)) {
            v3a_exit_json(400, null, '不允许的文件类型：.' . $ext);
        }

        $aclTypes = isset($acl['files']['types']) && is_array($acl['files']['types']) ? $acl['files']['types'] : [];
        if (!empty($aclTypes) && !in_array($ext, $aclTypes, true)) {
            v3a_exit_json(400, ['ext' => $ext, 'allowed' => $aclTypes], '当前用户组不允许上传：.' . $ext);
        }

        // Respect global attachmentTypes (Typecho setting).
        $siteAllowedRaw = is_array($options->allowedAttachmentTypes ?? null) ? $options->allowedAttachmentTypes : [];
	        $siteAllowed = array_values(array_unique(array_filter(array_map(static function ($t) {
	            $v = strtolower(trim((string) $t));
	            return $v;
	        }, $siteAllowedRaw), static function ($v) {
	            return $v !== '';
	        })));

        if (empty($siteAllowed)) {
            v3a_exit_json(400, null, '站点未开启允许上传的附件类型，请在「设定-存储-附件类型」中配置');
        }

        if (!in_array($ext, $siteAllowed, true)) {
            v3a_exit_json(400, ['ext' => $ext, 'allowed' => $siteAllowed], '不允许的文件类型：.' . $ext);
        }

        $result = null;
        $result = v3a_upload_handle_best($options, $file);
        if ($result === false || !is_array($result)) {
            v3a_exit_json(500, null, '上传失败（权限/类型/目录不可写）');
        }

        // Insert attachment record (similar to Typecho core upload action)
        try {
            $struct = [
                'title' => (string) ($result['name'] ?? $name),
                'slug' => (string) ($result['name'] ?? $name),
                'type' => 'attachment',
                'status' => 'publish',
                'text' => json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'allowComment' => 1,
                'allowPing' => 0,
                'allowFeed' => 1,
            ];

            if (isset($request->cid)) {
                $parentCid = (int) $request->filter('int')->get('cid');
                if ($parentCid > 0) {
                    try {
                        $w = \Widget\Upload::alloc();
                        if ($w->isWriteable($db->sql()->where('cid = ?', $parentCid))) {
                            $struct['parent'] = $parentCid;
                        }
                    } catch (\Throwable $e) {
                    }
                }
            }

            $w = \Widget\Upload::alloc();
            $insertId = (int) $w->insert($struct);

            $url = '';
            $isImage = false;
            try {
                $cfg = new \Typecho\Config($result);
                $url = \Widget\Upload::attachmentHandle($cfg);
            } catch (\Throwable $e) {
                $url = '';
            }
            $mime = (string) ($result['mime'] ?? '');
            if ($mime !== '') {
                $isImage = stripos($mime, 'image/') === 0;
            }

            v3a_exit_json(0, [
                'url' => $url,
                'file' => [
                    'cid' => $insertId,
                    'title' => (string) ($result['name'] ?? $name),
                    'type' => (string) ($result['type'] ?? $ext),
                    'size' => (int) ($result['size'] ?? $size),
                    'bytes' => number_format(ceil(((int) ($result['size'] ?? $size)) / 1024)) . ' Kb',
                    'isImage' => $isImage,
                    'url' => $url,
                    'permalink' => '',
                ],
            ]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'files.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['files']['access'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $cids = $payload['cids'] ?? $payload['cid'] ?? $payload['ids'] ?? [];
        if (is_numeric($cids)) {
            $cids = [(int) $cids];
        }
        if (!is_array($cids)) {
            $cids = [];
        }
	        $cids = array_values(array_unique(array_filter(array_map('intval', $cids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($cids)) {
            v3a_exit_json(400, null, 'Missing cid');
        }

        if (!$user->pass('editor', true) || empty($acl['files']['scopeAll'])) {
            $uid = (int) ($user->uid ?? 0);
            if ($uid <= 0) {
                v3a_exit_json(403, null, 'Forbidden');
            }

            $owned = [];
            try {
                $rows = $db->fetchAll(
                    $db->select('cid')
                        ->from('table.contents')
                        ->where('type = ?', 'attachment')
                        ->where('cid IN ?', $cids)
                        ->where('authorId = ?', $uid)
                );
                foreach ((array) $rows as $r) {
                    $cid = (int) ($r['cid'] ?? 0);
                    if ($cid > 0) {
                        $owned[] = $cid;
                    }
                }
            } catch (\Throwable $e) {
            }

            $cids = array_values(array_unique($owned));
            if (empty($cids)) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        }

        try {
            $deleted = V3A_AttachmentEditProxy::alloc()->v3aDelete($cids);
            v3a_exit_json(0, ['deleted' => (int) $deleted]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'friends.stateCount') {
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $counts = [
            'friends' => 0,
            'audit' => 0,
            'outdate' => 0,
            'reject' => 0,
            'banned' => 0,
        ];

        try {
            $pdo = v3a_local_pdo();
            if ($pdo) {
                $stmt = $pdo->prepare('SELECT COUNT(id) FROM v3a_friend_link WHERE status = :status');
                $stmt->execute([':status' => 1]);
                $counts['friends'] = (int) ($stmt->fetchColumn() ?: 0);

                $stmt->execute([':status' => 2]);
                $counts['outdate'] = (int) ($stmt->fetchColumn() ?: 0);

                $stmt->execute([':status' => 3]);
                $counts['banned'] = (int) ($stmt->fetchColumn() ?: 0);

                $stmt2 = $pdo->prepare('SELECT COUNT(id) FROM v3a_friend_link_apply WHERE status = :status');
                $stmt2->execute([':status' => 0]);
                $counts['audit'] = (int) ($stmt2->fetchColumn() ?: 0);

                $stmt2->execute([':status' => 2]);
                $counts['reject'] = (int) ($stmt2->fetchColumn() ?: 0);
            }

        } catch (\Throwable $e) {
        }

        v3a_exit_json(0, $counts);
    }

    if ($do === 'friends.settings.get') {
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $raw = '';
        try {
            $raw = (string) ($options->v3a_friend_apply_settings ?? '');
        } catch (\Throwable $e) {
        }

        $decoded = null;
        if (trim($raw) !== '') {
            try {
                $decoded = json_decode($raw, true);
            } catch (\Throwable $e) {
            }
        }

        $settings = v3a_friends_apply_settings_sanitize(is_array($decoded) ? $decoded : null);
        v3a_exit_json(0, $settings);
    }

    if ($do === 'friends.settings.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $settings = v3a_friends_apply_settings_sanitize($payload);

        try {
            v3a_upsert_option(
                $db,
                'v3a_friend_apply_settings',
                json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                0
            );
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }

        v3a_exit_json(0, $settings);
    }

    if ($do === 'friends.list') {
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $state = (int) $request->get('state', 0);
        $page = max(1, (int) $request->get('page', 1));
        $pageSize = (int) $request->get('pageSize', 20);
        $pageSize = max(1, min(50, $pageSize));
        $keywords = v3a_string($request->get('keywords', ''), '');

        $source = 'link';
        $status = 1;

        if ($state === 1) {
            $source = 'apply';
            $status = 0;
        } elseif ($state === 2) {
            $source = 'link';
            $status = 2;
        } elseif ($state === 3) {
            $source = 'apply';
            $status = 2;
        } elseif ($state === 4) {
            $source = 'link';
            $status = 3;
        }

        $pdo = v3a_local_pdo();
        if (!$pdo) {
            v3a_exit_json(500, null, 'Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }

        $table = $source === 'apply' ? 'v3a_friend_link_apply' : 'v3a_friend_link';

        $whereParts = ['status = :status'];
        $params = [':status' => $status];

        if ($keywords !== '') {
            $words = preg_split('/\\s+/u', $keywords);
            $idx = 0;
            foreach ((array) $words as $w) {
                $w = trim((string) $w);
                if ($w === '') {
                    continue;
                }
                try {
                    $w = \Typecho\Common::filterSearchQuery($w);
                } catch (\Throwable $e) {
                }

                $key = ':kw' . $idx;
                $params[$key] = '%' . $w . '%';

                if ($source === 'apply') {
                    $whereParts[] = "(name LIKE {$key} OR url LIKE {$key} OR email LIKE {$key} OR description LIKE {$key} OR message LIKE {$key})";
                } else {
                    $whereParts[] = "(name LIKE {$key} OR url LIKE {$key} OR email LIKE {$key} OR description LIKE {$key})";
                }
                $idx++;
            }
        }

        $whereSql = implode(' AND ', $whereParts);

        $total = 0;
        try {
            $stmt = $pdo->prepare("SELECT COUNT(id) FROM {$table} WHERE {$whereSql}");
            $stmt->execute($params);
            $total = (int) ($stmt->fetchColumn() ?: 0);
        } catch (\Throwable $e) {
            $total = 0;
        }

        $rows = [];
        try {
            $offset = ($page - 1) * $pageSize;
            $fields = $source === 'apply'
                ? 'id,name,url,avatar,description,type,email,message,status,created'
                : 'id,name,url,avatar,description,type,email,status,created';
            $sql = "SELECT {$fields} FROM {$table} WHERE {$whereSql} ORDER BY id DESC LIMIT :limit OFFSET :offset";

            $stmt = $pdo->prepare($sql);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', (int) $pageSize, \PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int) $offset, \PDO::PARAM_INT);
            $stmt->execute();
            $rows = (array) $stmt->fetchAll();
        } catch (\Throwable $e) {
            $rows = [];
        }

        $items = [];
        foreach ((array) $rows as $r) {
            $item = [
                'id' => (int) ($r['id'] ?? 0),
                'name' => (string) ($r['name'] ?? ''),
                'url' => (string) ($r['url'] ?? ''),
                'avatar' => (string) ($r['avatar'] ?? ''),
                'description' => (string) ($r['description'] ?? ''),
                'type' => (string) ($r['type'] ?? 'friend'),
                'email' => (string) ($r['email'] ?? ''),
                'status' => (int) ($r['status'] ?? 0),
                'created' => (int) ($r['created'] ?? 0),
                'source' => $source,
            ];

            if ($source === 'apply') {
                $item['message'] = (string) ($r['message'] ?? '');
            }

            $items[] = $item;
        }

        $pageCount = $pageSize > 0 ? (int) ceil($total / $pageSize) : 1;

        v3a_exit_json(0, [
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'pageCount' => $pageCount,
            ],
        ]);
    }

    if ($do === 'friends.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $id = (int) ($payload['id'] ?? 0);

        $name = trim(v3a_string($payload['name'] ?? '', ''));
        if ($name === '') {
            v3a_exit_json(400, null, 'Name required');
        }

        $url = trim(v3a_string($payload['url'] ?? '', ''));
        if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
            v3a_exit_json(400, null, 'Invalid url');
        }

        $avatar = trim(v3a_string($payload['avatar'] ?? '', ''));
        $description = trim(v3a_string($payload['description'] ?? '', ''));

        $type = strtolower(trim(v3a_string($payload['type'] ?? 'friend', 'friend')));
        $allowedTypes = ['friend', 'collection'];
        if (!in_array($type, $allowedTypes, true)) {
            $type = 'friend';
        }

        $email = trim(v3a_string($payload['email'] ?? '', ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            v3a_exit_json(400, null, 'Invalid email');
        }

        $status = (int) ($payload['status'] ?? 1);
        if (!in_array($status, [1, 2, 3], true)) {
            $status = 1;
        }

        $created = (int) ($payload['created'] ?? 0);
        if ($created <= 0) {
            $created = time();
        }

        $rows = [
            'name' => $name,
            'url' => $url,
            'avatar' => $avatar,
            'description' => $description,
            'type' => $type,
            'email' => $email,
            'status' => $status,
        ];

        $pdo = v3a_local_pdo();
        if (!$pdo) {
            v3a_exit_json(500, null, 'Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }

        try {
            if ($id > 0) {
                // Keep created if not explicitly passed in.
                if (!isset($payload['created'])) {
                    unset($rows['created']);
                } else {
                    $rows['created'] = $created;
                }

                $sets = [];
                $params = [':id' => $id];
                foreach ($rows as $k => $v) {
                    $sets[] = $k . ' = :' . $k;
                    $params[':' . $k] = $v;
                }

                if (!empty($sets)) {
                    $stmt = $pdo->prepare('UPDATE v3a_friend_link SET ' . implode(', ', $sets) . ' WHERE id = :id');
                    $stmt->execute($params);
                }
                v3a_exit_json(0, ['id' => $id]);
            }

            $rows['created'] = $created;

            $cols = array_keys($rows);
            $placeholders = array_map(function ($c) {
                return ':' . $c;
            }, $cols);

            $stmt = $pdo->prepare(
                'INSERT INTO v3a_friend_link (' . implode(',', $cols) . ') VALUES (' . implode(',', $placeholders) . ')'
            );
            $params = [];
            foreach ($rows as $k => $v) {
                $params[':' . $k] = $v;
            }
            $stmt->execute($params);
            $newId = (int) $pdo->lastInsertId();
            v3a_exit_json(0, ['id' => $newId]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'friends.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $ids = $payload['ids'] ?? $payload['id'] ?? [];
        if (is_numeric($ids)) {
            $ids = [(int) $ids];
        }
        if (!is_array($ids)) {
            $ids = [];
        }
	        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($ids)) {
            v3a_exit_json(400, null, 'Missing id');
        }

        try {
            $pdo = v3a_local_pdo_or_fail();
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $pdo->prepare("DELETE FROM v3a_friend_link WHERE id IN ({$placeholders})");
            $stmt->execute(array_values($ids));
            $deleted = (int) $stmt->rowCount();
            v3a_exit_json(0, ['deleted' => $deleted]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'friends.apply.audit') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $id = (int) ($payload['id'] ?? 0);
        if ($id <= 0) {
            v3a_exit_json(400, null, 'Missing id');
        }

        $action = strtolower(trim(v3a_string($payload['action'] ?? '', '')));
        if (!in_array($action, ['pass', 'reject'], true)) {
            v3a_exit_json(400, null, 'Invalid action');
        }

        $pdo = v3a_local_pdo();
        if (!$pdo) {
            v3a_exit_json(500, null, 'Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }

        try {
            $stmt = $pdo->prepare(
                'SELECT id,name,url,avatar,description,type,email,message,status,created FROM v3a_friend_link_apply WHERE id = :id LIMIT 1'
            );
            $stmt->execute([':id' => $id]);
            $apply = $stmt->fetch(\PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            $apply = null;
        }

        if (!is_array($apply)) {
            v3a_exit_json(404, null, 'Not found');
        }

        $applyStatus = (int) ($apply['status'] ?? 0);
        if ($action === 'pass') {
            if ($applyStatus !== 0) {
                v3a_exit_json(400, null, 'Not pending');
            }

            $name = trim(v3a_string($payload['name'] ?? ($apply['name'] ?? ''), ''));
            if ($name === '') {
                v3a_exit_json(400, null, 'Name required');
            }

            $url = trim(v3a_string($payload['url'] ?? ($apply['url'] ?? ''), ''));
            if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
                v3a_exit_json(400, null, 'Invalid url');
            }

            $avatar = trim(v3a_string($payload['avatar'] ?? ($apply['avatar'] ?? ''), ''));
            $description = trim(v3a_string($payload['description'] ?? ($apply['description'] ?? ''), ''));

            $type = strtolower(trim(v3a_string($payload['type'] ?? ($apply['type'] ?? 'friend'), 'friend')));
            $allowedTypes = ['friend', 'collection'];
            if (!in_array($type, $allowedTypes, true)) {
                $type = 'friend';
            }

            $email = trim(v3a_string($payload['email'] ?? ($apply['email'] ?? ''), ''));
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                v3a_exit_json(400, null, 'Invalid email');
            }

            $created = (int) ($apply['created'] ?? 0);
            if ($created <= 0) {
                $created = time();
            }

            $rows = [
                'name' => $name,
                'url' => $url,
                'avatar' => $avatar,
                'description' => $description,
                'type' => $type,
                'email' => $email,
                'status' => 1,
                'created' => $created,
            ];

            try {
                $pdo->beginTransaction();

                // Ensure still pending (avoid concurrent audits).
                $stmt = $pdo->prepare('SELECT status FROM v3a_friend_link_apply WHERE id = :id LIMIT 1');
                $stmt->execute([':id' => $id]);
                $cur = (int) ($stmt->fetchColumn() ?: 0);
                if ($cur !== 0) {
                    $pdo->rollBack();
                    v3a_exit_json(400, null, 'Not pending');
                }

                $cols = array_keys($rows);
                $placeholders = array_map(function ($c) {
                    return ':' . $c;
                }, $cols);
                $stmt = $pdo->prepare(
                    'INSERT INTO v3a_friend_link (' . implode(',', $cols) . ') VALUES (' . implode(',', $placeholders) . ')'
                );
                $params = [];
                foreach ($rows as $k => $v) {
                    $params[':' . $k] = $v;
                }
                $stmt->execute($params);
                $newId = (int) $pdo->lastInsertId();

                $stmt = $pdo->prepare('UPDATE v3a_friend_link_apply SET status = 1 WHERE id = :id');
                $stmt->execute([':id' => $id]);

                $pdo->commit();
                v3a_exit_json(0, ['id' => $newId]);
            } catch (\Throwable $e) {
                try {
                    $pdo->rollBack();
                } catch (\Throwable $e2) {
                }
                v3a_exit_json(500, null, $e->getMessage());
            }
        }

        // reject
        try {
            $stmt = $pdo->prepare('UPDATE v3a_friend_link_apply SET status = 2 WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $updated = (int) $stmt->rowCount();
            v3a_exit_json(0, ['updated' => $updated]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'friends.checkHealth') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $timeoutMs = (int) ($payload['timeoutMs'] ?? $payload['timeout'] ?? 8000);
        $timeoutMs = max(1000, min(20000, $timeoutMs));
        $limit = (int) ($payload['limit'] ?? 50);
        $limit = max(1, min(200, $limit));

        $pdo = v3a_local_pdo();
        if (!$pdo) {
            v3a_exit_json(500, null, 'Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }

        $rows = [];
        try {
            $stmt = $pdo->prepare('SELECT id,url FROM v3a_friend_link WHERE status = 1 ORDER BY id DESC LIMIT :limit');
            $stmt->bindValue(':limit', (int) $limit, \PDO::PARAM_INT);
            $stmt->execute();
            $rows = (array) $stmt->fetchAll();
        } catch (\Throwable $e) {
        }

        $result = [];
        foreach ((array) $rows as $r) {
            $id = (int) ($r['id'] ?? 0);
            $url = trim((string) ($r['url'] ?? ''));
            if ($id <= 0) {
                continue;
            }

            $status = 0;
            $message = '';

            if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
                $message = 'Invalid URL';
            } elseif (function_exists('curl_init')) {
                try {
                    $ch = curl_init($url);
                    curl_setopt_array($ch, [
                        CURLOPT_NOBODY => true,
                        CURLOPT_FOLLOWLOCATION => true,
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_TIMEOUT_MS => $timeoutMs,
                        CURLOPT_CONNECTTIMEOUT_MS => min(4000, $timeoutMs),
                        CURLOPT_MAXREDIRS => 5,
                        CURLOPT_USERAGENT => 'Vue3Admin/1.0 (+Typecho)',
                        CURLOPT_SSL_VERIFYPEER => false,
                        CURLOPT_SSL_VERIFYHOST => 0,
                    ]);

                    curl_exec($ch);
                    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    $err = (string) curl_error($ch);
                    curl_close($ch);

                    $message = $err !== '' ? $err : ('HTTP ' . $status);
                } catch (\Throwable $e) {
                    $message = $e->getMessage();
                }
            } else {
                try {
                    $ctx = stream_context_create([
                        'http' => [
                            'method' => 'HEAD',
                            'timeout' => (int) ceil($timeoutMs / 1000),
                            'ignore_errors' => true,
                        ],
                        'ssl' => [
                            'verify_peer' => false,
                            'verify_peer_name' => false,
                        ],
                    ]);

                    $headers = @get_headers($url, 1, $ctx);
                    if (is_array($headers) && isset($headers[0]) && preg_match('/\\s(\\d{3})\\s/', (string) $headers[0], $m)) {
                        $status = (int) $m[1];
                        $message = 'HTTP ' . $status;
                    } else {
                        $message = 'Unknown';
                    }
                } catch (\Throwable $e) {
                    $message = $e->getMessage();
                }
            }

            $result[(string) $id] = [
                'id' => $id,
                'status' => $status,
                'message' => $message,
            ];
        }

        v3a_exit_json(0, $result);
    }

    if ($do === 'friends.migrateAvatars') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['friends']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        if (!function_exists('curl_init')) {
            v3a_exit_json(400, null, 'cURL not available');
        }

        $payload = v3a_payload();
        $timeoutMs = (int) ($payload['timeoutMs'] ?? $payload['timeout'] ?? 10000);
        $timeoutMs = max(1000, min(60000, $timeoutMs));
        $limit = (int) ($payload['limit'] ?? 200);
        $limit = max(1, min(500, $limit));
        $maxBytes = (int) ($payload['maxBytes'] ?? 60000);
        $maxBytes = max(4096, min(200000, $maxBytes));

        $pdo = v3a_local_pdo();
        if (!$pdo) {
            v3a_exit_json(500, null, 'Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }

        $rows = [];
        try {
            $stmt = $pdo->prepare('SELECT id,avatar FROM v3a_friend_link WHERE status = 1 ORDER BY id DESC LIMIT :limit');
            $stmt->bindValue(':limit', (int) $limit, \PDO::PARAM_INT);
            $stmt->execute();
            $rows = (array) $stmt->fetchAll();
        } catch (\Throwable $e) {
        }

        $migrated = 0;
        $skipped = 0;
        foreach ((array) $rows as $r) {
            $id = (int) ($r['id'] ?? 0);
            $avatar = trim((string) ($r['avatar'] ?? ''));
            if ($id <= 0) {
                continue;
            }

            if ($avatar === '' || stripos($avatar, 'data:') === 0) {
                $skipped++;
                continue;
            }

            if (!preg_match('/^https?:\\/\\//i', $avatar) || !filter_var($avatar, FILTER_VALIDATE_URL)) {
                $skipped++;
                continue;
            }

            $data = '';
            $tooLarge = false;

            try {
                $ch = curl_init($avatar);
                curl_setopt_array($ch, [
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_RETURNTRANSFER => false,
                    CURLOPT_TIMEOUT_MS => $timeoutMs,
                    CURLOPT_CONNECTTIMEOUT_MS => min(5000, $timeoutMs),
                    CURLOPT_MAXREDIRS => 5,
                    CURLOPT_USERAGENT => 'Vue3Admin/1.0 (+Typecho)',
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => 0,
                    CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$data, $maxBytes, &$tooLarge): int {
                        $len = strlen($chunk);
                        $remain = $maxBytes - strlen($data);
                        if ($remain <= 0) {
                            $tooLarge = true;
                            return 0;
                        }
                        if ($len > $remain) {
                            $data .= substr($chunk, 0, $remain);
                            $tooLarge = true;
                            return 0;
                        }
                        $data .= $chunk;
                        return $len;
                    },
                ]);

                curl_exec($ch);
                $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $contentType = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
                curl_close($ch);

                if ($tooLarge || $code < 200 || $code >= 400 || $data === '') {
                    $skipped++;
                    continue;
                }

                $mime = trim(strtolower(preg_replace('/;.*/', '', $contentType)));
                if ($mime === '' || stripos($mime, 'image/') !== 0) {
                    $skipped++;
                    continue;
                }

                $dataUri = 'data:' . $mime . ';base64,' . base64_encode($data);

                $stmt = $pdo->prepare('UPDATE v3a_friend_link SET avatar = :avatar WHERE id = :id');
                $stmt->execute([':avatar' => $dataUri, ':id' => $id]);
                $migrated++;
            } catch (\Throwable $e) {
                $skipped++;
            }
        }

        v3a_exit_json(0, ['migrated' => $migrated, 'skipped' => $skipped]);
    }

    if ($do === 'users.list') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['users']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $page = max(1, (int) $request->get('page', 1));
        $pageSize = (int) $request->get('pageSize', 20);
        $pageSize = max(1, min(50, $pageSize));

        $keywords = v3a_string($request->get('keywords', ''), '');
        $group = v3a_string($request->get('group', 'all'), 'all');

        $select = $db->select(
            'table.users.uid',
            'table.users.name',
            'table.users.screenName',
            'table.users.mail',
            'table.users.url',
            'table.users.group',
            'table.users.created'
        )->from('table.users');

        if ($group !== '' && $group !== 'all') {
            $select->where('table.users.group = ?', $group);
        }

        if ($keywords !== '') {
            $words = preg_split('/\\s+/u', $keywords);
            $whereParts = [];
            $bind = [];
            foreach ((array) $words as $w) {
                $w = trim((string) $w);
                if ($w === '') {
                    continue;
                }
                try {
                    $w = \Typecho\Common::filterSearchQuery($w);
                } catch (\Throwable $e) {
                }

                $whereParts[] = '(table.users.name LIKE ? OR table.users.screenName LIKE ? OR table.users.mail LIKE ?)';
                $bind[] = '%' . $w . '%';
                $bind[] = '%' . $w . '%';
                $bind[] = '%' . $w . '%';
            }
            if (!empty($whereParts)) {
                $select->where(implode(' AND ', $whereParts), ...$bind);
            }
        }

        $countSelect = clone $select;
        $countSelect->cleanAttribute('fields');
        $countSelect->cleanAttribute('order');
        $countSelect->cleanAttribute('limit');
        $countSelect->cleanAttribute('offset');
        $countSelect->select(['COUNT(DISTINCT table.users.uid)' => 'num']);

        $total = 0;
        try {
            $total = (int) ($db->fetchObject($countSelect)->num ?? 0);
        } catch (\Throwable $e) {
        }

        $select->order('table.users.uid', \Typecho\Db::SORT_ASC)
            ->page($page, $pageSize);

        $rows = [];
        try {
            $rows = $db->fetchAll($select);
        } catch (\Throwable $e) {
        }

        $uids = [];
        foreach ($rows as $r) {
            $uid = (int) ($r['uid'] ?? 0);
            if ($uid > 0) {
                $uids[] = $uid;
            }
        }
        $uids = array_values(array_unique($uids));

        $postsNumByUid = [];
        if (!empty($uids)) {
            try {
                $pRows = $db->fetchAll(
                    $db->select('authorId', ['COUNT(cid)' => 'num'])
                        ->from('table.contents')
                        ->where('type = ?', 'post')
                        ->where('status = ?', 'publish')
                        ->where('authorId IN ?', $uids)
                        ->group('authorId')
                );
                foreach ($pRows as $pr) {
                    $aid = (int) ($pr['authorId'] ?? 0);
                    if ($aid > 0) {
                        $postsNumByUid[$aid] = (int) ($pr['num'] ?? 0);
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        $items = [];
        foreach ($rows as $r) {
            $uid = (int) ($r['uid'] ?? 0);
            $items[] = [
                'uid' => $uid,
                'name' => (string) ($r['name'] ?? ''),
                'screenName' => (string) ($r['screenName'] ?? ''),
                'mail' => (string) ($r['mail'] ?? ''),
                'url' => (string) ($r['url'] ?? ''),
                'group' => (string) ($r['group'] ?? ''),
                'created' => (int) ($r['created'] ?? 0),
                'postsNum' => $postsNumByUid[$uid] ?? 0,
            ];
        }

        $pageCount = $pageSize > 0 ? (int) ceil($total / $pageSize) : 1;

        v3a_exit_json(0, [
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'pageCount' => $pageCount,
            ],
        ]);
    }

    if ($do === 'users.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['users']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        v3a_security_protect($security, $request);

        $payload = v3a_payload();
        $uids = $payload['uids'] ?? $payload['uid'] ?? $payload['ids'] ?? [];
        if (is_numeric($uids)) {
            $uids = [(int) $uids];
        }
        if (!is_array($uids)) {
            $uids = [];
        }
	        $uids = array_values(array_unique(array_filter(array_map('intval', $uids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($uids)) {
            v3a_exit_json(400, null, 'Missing uid');
        }

        $currentUid = (int) ($user->uid ?? 0);
        $masterUid = 0;
        try {
            $masterUid = (int) ($db->fetchObject(
                $db->select(['MIN(uid)' => 'num'])->from('table.users')
            )->num ?? 0);
        } catch (\Throwable $e) {
        }

        $deleteUids = [];
        foreach ($uids as $uid) {
            if ($uid === $currentUid) {
                continue;
            }
            if ($masterUid > 0 && $uid === $masterUid) {
                continue;
            }
            $deleteUids[] = $uid;
        }

        $deleted = 0;
        if (!empty($deleteUids)) {
            try {
                foreach ($deleteUids as $uid) {
                    $affected = $db->query(
                        $db->delete('table.users')->where('uid = ?', $uid),
                        \Typecho\Db::WRITE
                    );
                    if (is_numeric($affected)) {
                        $deleted += (int) $affected;
                    } elseif ($affected) {
                        $deleted++;
                    }
                }
            } catch (\Throwable $e) {
                v3a_exit_json(500, null, $e->getMessage());
            }
        }

        v3a_exit_json(0, ['deleted' => (int) $deleted]);
    }

    if ($do === 'users.update') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['users']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        v3a_security_protect($security, $request);

        $payload = v3a_payload();
        $uid = v3a_int($payload['uid'] ?? 0, 0);
        if ($uid <= 0) {
            v3a_exit_json(400, null, 'Missing uid');
        }

        $exists = null;
        try {
            $exists = $db->fetchRow(
                $db->select('uid', 'name')
                    ->from('table.users')
                    ->where('uid = ?', $uid)
                    ->limit(1)
            );
        } catch (\Throwable $e) {
        }
        if (!$exists) {
            v3a_exit_json(404, null, 'User not found');
        }

        $name = (string) ($exists['name'] ?? '');

        $screenName = trim(v3a_string($payload['screenName'] ?? '', ''));
        if ($screenName === '') {
            $screenName = $name;
        }

        $mail = trim(v3a_string($payload['mail'] ?? '', ''));
        if ($mail === '') {
            v3a_exit_json(400, null, 'Email required');
        }
        if (!filter_var($mail, FILTER_VALIDATE_EMAIL)) {
            v3a_exit_json(400, null, 'Invalid email');
        }

        try {
            $mailExists = $db->fetchRow(
                $db->select('uid')
                    ->from('table.users')
                    ->where('mail = ?', $mail)
                    ->where('uid <> ?', $uid)
                    ->limit(1)
            );
            if ($mailExists) {
                v3a_exit_json(400, null, 'Email exists');
            }
        } catch (\Throwable $e) {
        }

        try {
            $snExists = $db->fetchRow(
                $db->select('uid')
                    ->from('table.users')
                    ->where('screenName = ?', $screenName)
                    ->where('uid <> ?', $uid)
                    ->limit(1)
            );
            if ($snExists) {
                v3a_exit_json(400, null, 'Screen name exists');
            }
        } catch (\Throwable $e) {
        }

        $url = trim(v3a_string($payload['url'] ?? '', ''));
        if ($url !== '' && !filter_var($url, FILTER_VALIDATE_URL)) {
            v3a_exit_json(400, null, 'Invalid url');
        }

        $group = strtolower(trim(v3a_string($payload['group'] ?? 'subscriber', 'subscriber')));
        $allowedGroups = ['administrator', 'editor', 'contributor', 'subscriber', 'visitor'];
        if (!in_array($group, $allowedGroups, true)) {
            v3a_exit_json(400, null, 'Invalid group');
        }

        $update = [
            'mail' => $mail,
            'screenName' => $screenName,
            'url' => $url,
            'group' => $group,
        ];

        $password = v3a_string($payload['password'] ?? '', '');
        $confirm = v3a_string($payload['confirm'] ?? '', '');
        if ($password !== '') {
            if (function_exists('mb_strlen')) {
                if (mb_strlen($password) < 6) {
                    v3a_exit_json(400, null, 'Password too short');
                }
            } elseif (strlen($password) < 6) {
                v3a_exit_json(400, null, 'Password too short');
            }

            if ($confirm === '' || $confirm !== $password) {
                v3a_exit_json(400, null, 'Password confirm mismatch');
            }

            $hasher = new \Utils\PasswordHash(8, true);
            $update['password'] = $hasher->hashPassword($password);
        }

        try {
            $db->query(
                $db->update('table.users')->rows($update)->where('uid = ?', $uid),
                \Typecho\Db::WRITE
            );
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }

        v3a_exit_json(0, [
            'updated' => 1,
            'user' => [
                'uid' => $uid,
                'name' => $name,
                'screenName' => $screenName,
                'mail' => $mail,
                'url' => $url,
                'group' => $group,
            ],
        ]);
    }

    if ($do === 'data.visit.list') {
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['data']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $page = max(1, (int) $request->get('page', 1));
        $pageSize = (int) $request->get('pageSize', 20);
        $pageSize = max(1, min(50, $pageSize));

        $keywords = v3a_string($request->get('keywords', ''), '');
        $onlyPosts = v3a_bool_int($request->get('onlyPosts', 0));

        $pdo = v3a_local_pdo();
        if (!$pdo) {
            v3a_exit_json(500, null, 'Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }

        $whereParts = [];
        $params = [];

        if ($keywords !== '') {
            $whereParts[] = '(ip LIKE :kw OR uri LIKE :kw OR referer LIKE :kw)';
            $params[':kw'] = '%' . $keywords . '%';
        }

        if ($onlyPosts) {
            $whereParts[] = "ctype = 'post'";
        }

        $whereSql = !empty($whereParts) ? ('WHERE ' . implode(' AND ', $whereParts)) : '';

        $total = 0;
        try {
            $stmt = $pdo->prepare("SELECT COUNT(id) FROM v3a_visit_log {$whereSql}");
            $stmt->execute($params);
            $total = (int) ($stmt->fetchColumn() ?: 0);
        } catch (\Throwable $e) {
            $total = 0;
        }

        $rows = [];
        try {
            $offset = ($page - 1) * $pageSize;
            $sql = "SELECT id,ip,uri,cid,ctype,referer,ua,created FROM v3a_visit_log {$whereSql} ORDER BY id DESC LIMIT :limit OFFSET :offset";
            $stmt = $pdo->prepare($sql);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', (int) $pageSize, \PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int) $offset, \PDO::PARAM_INT);
            $stmt->execute();
            $rows = (array) $stmt->fetchAll();
        } catch (\Throwable $e) {
            $rows = [];
        }

        $contentByCid = [];
        $cids = [];
        foreach ((array) $rows as $r) {
            $cid = isset($r['cid']) && $r['cid'] !== null ? (int) $r['cid'] : 0;
            if ($cid > 0) {
                $cids[] = $cid;
            }
        }
        $cids = array_values(array_unique($cids));
        if (!empty($cids)) {
            try {
                $contentRows = $db->fetchAll(
                    $db->select('cid', 'title', 'type')
                        ->from('table.contents')
                        ->where('cid IN ?', $cids)
                );
                foreach ((array) $contentRows as $cr) {
                    $cid = (int) ($cr['cid'] ?? 0);
                    if ($cid > 0) {
                        $contentByCid[$cid] = [
                            'title' => (string) ($cr['title'] ?? ''),
                            'type' => (string) ($cr['type'] ?? ''),
                        ];
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        $items = [];
        foreach ((array) $rows as $r) {
            if (!is_array($r)) {
                continue;
            }

            $cid = isset($r['cid']) && $r['cid'] !== null ? (int) $r['cid'] : null;
            $mapped = ($cid !== null && isset($contentByCid[$cid])) ? $contentByCid[$cid] : null;

            $ua = isset($r['ua']) ? (string) ($r['ua'] ?? '') : '';
            $deviceInfo = v3a_device_info_from_ua($ua);

            $type = '';
            if (is_array($mapped)) {
                $type = (string) ($mapped['type'] ?? '');
            }
            if ($type === '') {
                $type = (string) ($r['ctype'] ?? '');
            }

            $items[] = [
                'id' => (int) ($r['id'] ?? 0),
                'ip' => (string) ($r['ip'] ?? ''),
                'uri' => (string) ($r['uri'] ?? ''),
                'cid' => $cid,
                'title' => is_array($mapped) ? (string) ($mapped['title'] ?? '') : '',
                'type' => $type,
                'referer' => isset($r['referer']) && $r['referer'] !== null ? (string) $r['referer'] : '',
                'ua' => $ua,
                'deviceType' => (string) ($deviceInfo['type'] ?? ''),
                'device' => (string) ($deviceInfo['name'] ?? ''),
                'created' => (int) ($r['created'] ?? 0),
            ];
        }

        $pageCount = $pageSize > 0 ? (int) ceil($total / $pageSize) : 1;

        v3a_exit_json(0, [
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'pageCount' => $pageCount,
            ],
        ]);
    }

    if ($do === 'data.api.list') {
        v3a_require_role($user, 'subscriber');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['data']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $page = max(1, (int) $request->get('page', 1));
        $pageSize = (int) $request->get('pageSize', 20);
        $pageSize = max(1, min(50, $pageSize));

        $keywords = v3a_string($request->get('keywords', ''), '');

        $pdo = v3a_local_pdo();
        if (!$pdo) {
            v3a_exit_json(500, null, 'Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }

        $whereParts = [];
        $params = [];
        if ($keywords !== '') {
            $whereParts[] = '(ip LIKE :kw OR path LIKE :kw OR query LIKE :kw)';
            $params[':kw'] = '%' . $keywords . '%';
        }
        $whereSql = !empty($whereParts) ? ('WHERE ' . implode(' AND ', $whereParts)) : '';

        $total = 0;
        try {
            $stmt = $pdo->prepare("SELECT COUNT(id) FROM v3a_api_log {$whereSql}");
            $stmt->execute($params);
            $total = (int) ($stmt->fetchColumn() ?: 0);
        } catch (\Throwable $e) {
            $total = 0;
        }

        $rows = [];
        try {
            $offset = ($page - 1) * $pageSize;
            $stmt = $pdo->prepare(
                "SELECT id,ip,method,path,query,created FROM v3a_api_log {$whereSql} ORDER BY id DESC LIMIT :limit OFFSET :offset"
            );
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', (int) $pageSize, \PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int) $offset, \PDO::PARAM_INT);
            $stmt->execute();
            $rows = (array) $stmt->fetchAll();
        } catch (\Throwable $e) {
            $rows = [];
        }

        $items = [];
        foreach ((array) $rows as $r) {
            if (!is_array($r)) {
                continue;
            }
            $items[] = [
                'id' => (int) ($r['id'] ?? 0),
                'ip' => (string) ($r['ip'] ?? ''),
                'method' => (string) ($r['method'] ?? 'GET'),
                'path' => (string) ($r['path'] ?? ''),
                'query' => isset($r['query']) && $r['query'] !== null ? (string) $r['query'] : '',
                'created' => (int) ($r['created'] ?? 0),
            ];
        }

        $pageCount = $pageSize > 0 ? (int) ceil($total / $pageSize) : 1;

        v3a_exit_json(0, [
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'pageCount' => $pageCount,
            ],
        ]);
    }

    if ($do === 'metas.categories') {
        v3a_require_role($user, 'contributor');

        try {
            $rows = \Widget\Metas\Category\Rows::alloc()->to($categories);
            $items = [];
            while ($categories->next()) {
                $items[] = [
                    'mid' => (int) $categories->mid,
                    'name' => (string) ($categories->name ?? ''),
                    'slug' => (string) ($categories->slug ?? ''),
                    'description' => (string) ($categories->description ?? ''),
                    'parent' => (int) ($categories->parent ?? 0),
                    'count' => (int) ($categories->count ?? 0),
                    'order' => (int) ($categories->order ?? 0),
                    'levels' => (int) ($categories->levels ?? 0),
                ];
            }

            v3a_exit_json(0, [
                'items' => $items,
                'defaultCategory' => (int) ($options->defaultCategory ?? 0),
            ]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'metas.tags') {
        v3a_require_role($user, 'contributor');

        try {
            $rows = $db->fetchAll(
                $db->select('mid', 'name', 'slug', 'count')
                    ->from('table.metas')
                    ->where('type = ?', 'tag')
                    ->order('mid', \Typecho\Db::SORT_DESC)
            );
            $items = [];
            foreach ($rows as $r) {
                $items[] = [
                    'mid' => (int) ($r['mid'] ?? 0),
                    'name' => (string) ($r['name'] ?? ''),
                    'slug' => (string) ($r['slug'] ?? ''),
                    'count' => (int) ($r['count'] ?? 0),
                ];
            }
            v3a_exit_json(0, ['items' => $items]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'metas.category.default') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['taxonomy'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $mid = v3a_int($payload['mid'] ?? $payload['id'] ?? 0, 0);
        if ($mid <= 0) {
            v3a_exit_json(400, null, 'Missing mid');
        }

        $exists = $db->fetchRow(
            $db->select('mid')
                ->from('table.metas')
                ->where('type = ?', 'category')
                ->where('mid = ?', $mid)
                ->limit(1)
        );
        if (empty($exists)) {
            v3a_exit_json(404, null, '分类不存在');
        }

        try {
            v3a_upsert_option($db, 'defaultCategory', $mid, 0);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }

        v3a_exit_json(0, ['defaultCategory' => $mid]);
    }

    if ($do === 'metas.category.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['taxonomy'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $mid = v3a_int($payload['mid'] ?? 0, 0);
        $name = v3a_string($payload['name'] ?? '', '');
        $slugIn = v3a_string($payload['slug'] ?? '', '');
        $description = v3a_string($payload['description'] ?? '', '');
        $parent = v3a_int($payload['parent'] ?? 0, 0);

        if ($name === '') {
            v3a_exit_json(400, null, '分类名称不能为空');
        }

        if ($mid > 0 && $parent === $mid) {
            v3a_exit_json(400, null, '父级分类不能是自身');
        }

        // Ensure parent exists
        if ($parent > 0) {
            $exists = $db->fetchRow(
                $db->select('mid')
                    ->from('table.metas')
                    ->where('type = ?', 'category')
                    ->where('mid = ?', $parent)
                    ->limit(1)
            );
            if (empty($exists)) {
                $parent = 0;
            }
        }

        $slug = \Typecho\Common::slugName($slugIn !== '' ? $slugIn : $name);

        // Name unique under same parent
        $nameCheckQuery = $db->select('mid')
            ->from('table.metas')
            ->where('type = ?', 'category')
            ->where('name = ?', $name)
            ->where('parent = ?', $parent)
            ->limit(1);
        if ($mid > 0) {
            $nameCheckQuery->where('mid <> ?', $mid);
        }
        $nameCheck = $db->fetchRow($nameCheckQuery);
        if (!empty($nameCheck)) {
            v3a_exit_json(409, null, '分类名称已存在');
        }

        // Slug unique
        if ($slug !== '') {
            $slugCheckQuery = $db->select('mid')
                ->from('table.metas')
                ->where('type = ?', 'category')
                ->where('slug = ?', $slug)
                ->limit(1);
            if ($mid > 0) {
                $slugCheckQuery->where('mid <> ?', $mid);
            }
            $slugCheck = $db->fetchRow($slugCheckQuery);
            if (!empty($slugCheck)) {
                v3a_exit_json(409, null, '缩略名已存在');
            }
        }

        if ($mid > 0) {
            $current = $db->fetchRow(
                $db->select('mid', 'parent')
                    ->from('table.metas')
                    ->where('type = ?', 'category')
                    ->where('mid = ?', $mid)
                    ->limit(1)
            );
            if (empty($current)) {
                v3a_exit_json(404, null, '分类不存在');
            }

            $update = [
                'name' => $name,
                'slug' => $slug,
                'description' => $description,
                'parent' => $parent,
            ];

            if ((int) ($current['parent'] ?? 0) !== $parent) {
                $maxOrder = (int) ($db->fetchObject(
                    $db->select(['MAX(order)' => 'maxOrder'])
                        ->from('table.metas')
                        ->where('type = ?', 'category')
                        ->where('parent = ?', $parent)
                )->maxOrder ?? 0);
                $update['order'] = $maxOrder + 1;
            }

            $db->query(
                $db->update('table.metas')->rows($update)->where('mid = ? AND type = ?', $mid, 'category'),
                \Typecho\Db::WRITE
            );
        } else {
            $maxOrder = (int) ($db->fetchObject(
                $db->select(['MAX(order)' => 'maxOrder'])
                    ->from('table.metas')
                    ->where('type = ?', 'category')
                    ->where('parent = ?', $parent)
            )->maxOrder ?? 0);

            $mid = (int) $db->query(
                $db->insert('table.metas')->rows([
                    'name' => $name,
                    'slug' => $slug,
                    'type' => 'category',
                    'description' => $description,
                    'parent' => $parent,
                    'count' => 0,
                    'order' => $maxOrder + 1,
                ]),
                \Typecho\Db::WRITE
            );
        }

        $row = $db->fetchRow(
            $db->select('mid', 'name', 'slug', 'description', 'parent', 'count', 'order')
                ->from('table.metas')
                ->where('type = ?', 'category')
                ->where('mid = ?', $mid)
                ->limit(1)
        );
        v3a_exit_json(0, ['category' => $row]);
    }

    if ($do === 'metas.category.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['taxonomy'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $mids = $payload['mids'] ?? $payload['mid'] ?? $payload['ids'] ?? [];
        if (is_numeric($mids)) {
            $mids = [(int) $mids];
        }
        if (!is_array($mids)) {
            $mids = [];
        }
	        $mids = array_values(array_unique(array_filter(array_map('intval', $mids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($mids)) {
            v3a_exit_json(400, null, 'Missing mid');
        }

        $defaultCategory = (int) ($options->defaultCategory ?? 0);
        if ($defaultCategory > 0 && in_array($defaultCategory, $mids, true)) {
            v3a_exit_json(409, null, '默认分类不可删除');
        }

        $deleted = 0;
        foreach ($mids as $mid) {
            $row = $db->fetchRow(
                $db->select('mid', 'parent')
                    ->from('table.metas')
                    ->where('type = ?', 'category')
                    ->where('mid = ?', $mid)
                    ->limit(1)
            );
            if (empty($row)) {
                continue;
            }

            $parent = (int) ($row['parent'] ?? 0);
            $db->query($db->delete('table.relationships')->where('mid = ?', $mid), \Typecho\Db::WRITE);
            $affected = (int) $db->query(
                $db->delete('table.metas')->where('mid = ? AND type = ?', $mid, 'category'),
                \Typecho\Db::WRITE
            );
            if ($affected > 0) {
                $db->query(
                    $db->update('table.metas')->rows(['parent' => $parent])
                        ->where('type = ?', 'category')
                        ->where('parent = ?', $mid),
                    \Typecho\Db::WRITE
                );
                $deleted++;
            }
        }

        v3a_exit_json(0, ['deleted' => $deleted]);
    }

    if ($do === 'metas.tag.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['taxonomy'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $mid = v3a_int($payload['mid'] ?? 0, 0);
        $name = v3a_string($payload['name'] ?? '', '');
        $slugIn = v3a_string($payload['slug'] ?? '', '');

        if ($name === '') {
            v3a_exit_json(400, null, '标签名称不能为空');
        }

        $slug = \Typecho\Common::slugName($slugIn !== '' ? $slugIn : $name);

        $nameCheckQuery = $db->select('mid')
            ->from('table.metas')
            ->where('type = ?', 'tag')
            ->where('name = ?', $name)
            ->limit(1);
        if ($mid > 0) {
            $nameCheckQuery->where('mid <> ?', $mid);
        }
        $nameCheck = $db->fetchRow($nameCheckQuery);
        if (!empty($nameCheck)) {
            v3a_exit_json(409, null, '标签名称已存在');
        }

        if ($slug !== '') {
            $slugCheckQuery = $db->select('mid')
                ->from('table.metas')
                ->where('type = ?', 'tag')
                ->where('slug = ?', $slug)
                ->limit(1);
            if ($mid > 0) {
                $slugCheckQuery->where('mid <> ?', $mid);
            }
            $slugCheck = $db->fetchRow($slugCheckQuery);
            if (!empty($slugCheck)) {
                v3a_exit_json(409, null, '缩略名已存在');
            }
        }

        if ($mid > 0) {
            $exists = $db->fetchRow(
                $db->select('mid')->from('table.metas')->where('type = ?', 'tag')->where('mid = ?', $mid)->limit(1)
            );
            if (empty($exists)) {
                v3a_exit_json(404, null, '标签不存在');
            }

            $db->query(
                $db->update('table.metas')->rows(['name' => $name, 'slug' => $slug])->where('mid = ? AND type = ?', $mid, 'tag'),
                \Typecho\Db::WRITE
            );
        } else {
            $mid = (int) $db->query(
                $db->insert('table.metas')->rows([
                    'name' => $name,
                    'slug' => $slug,
                    'type' => 'tag',
                    'description' => '',
                    'parent' => 0,
                    'count' => 0,
                    'order' => 0,
                ]),
                \Typecho\Db::WRITE
            );
        }

        $row = $db->fetchRow(
            $db->select('mid', 'name', 'slug', 'count')
                ->from('table.metas')
                ->where('type = ?', 'tag')
                ->where('mid = ?', $mid)
                ->limit(1)
        );
        v3a_exit_json(0, ['tag' => $row]);
    }

    if ($do === 'metas.tag.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('editor', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }
        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['posts']['taxonomy'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $mids = $payload['mids'] ?? $payload['mid'] ?? $payload['ids'] ?? [];
        if (is_numeric($mids)) {
            $mids = [(int) $mids];
        }
        if (!is_array($mids)) {
            $mids = [];
        }
	        $mids = array_values(array_unique(array_filter(array_map('intval', $mids), function ($v) {
	            return $v > 0;
	        })));
        if (empty($mids)) {
            v3a_exit_json(400, null, 'Missing mid');
        }

        $deleted = 0;
        foreach ($mids as $mid) {
            $db->query($db->delete('table.relationships')->where('mid = ?', $mid), \Typecho\Db::WRITE);
            $affected = (int) $db->query(
                $db->delete('table.metas')->where('mid = ? AND type = ?', $mid, 'tag'),
                \Typecho\Db::WRITE
            );
            if ($affected > 0) {
                $deleted++;
            }
        }

        v3a_exit_json(0, ['deleted' => $deleted]);
    }

    if ($do === 'settings.get') {
        $isAdmin = (bool) $user->pass('administrator', true);

        $langs = [];
        try {
            $langMap = \Widget\Options\General::getLangs();
            foreach ((array) $langMap as $k => $v) {
                $langs[] = ['value' => (string) $k, 'label' => (string) $v];
            }
        } catch (\Throwable $e) {
        }

        $frontPagePages = [];
        try {
            $rows = $db->fetchAll(
                $db->select('cid', 'title')
                    ->from('table.contents')
                    ->where('type = ?', 'page')
                    ->where('status = ?', 'publish')
                    ->where('created < ?', $options->time)
                    ->order('created', \Typecho\Db::SORT_DESC)
            );
            foreach ($rows as $r) {
                $frontPagePages[] = [
                    'cid' => (int) ($r['cid'] ?? 0),
                    'title' => (string) ($r['title'] ?? ''),
                ];
            }
        } catch (\Throwable $e) {
        }

        $frontPageFiles = [];
        try {
            $base = $options->themeFile($options->theme);
            $files = glob($options->themeFile($options->theme, '*.php'));
            foreach ((array) $files as $file) {
                $rel = trim(str_replace($base, '', (string) $file), "/\\");
                if ($rel === '' || $rel === 'functions.php') {
                    continue;
                }
                $frontPageFiles[] = $rel;
            }
            sort($frontPageFiles);
        } catch (\Throwable $e) {
        }

        $frontPage = (string) ($options->frontPage ?? 'recent');
        $frontPageType = 'recent';
        $frontPageValue = '';
        if (strpos($frontPage, ':') !== false) {
            [$frontPageType, $frontPageValue] = explode(':', $frontPage, 2);
        } elseif ($frontPage !== '') {
            $frontPageType = $frontPage;
        }

        $routingTable = [];
        try {
            $routingTable = (array) ($options->routingTable ?? []);
        } catch (\Throwable $e) {
        }

        $defaultRegisterGroup = 'subscriber';
        try {
            $row = $db->fetchObject(
                $db->select('value')
                    ->from('table.options')
                    ->where('name = ? AND user = ?', 'defaultRegisterGroup', 0)
                    ->limit(1)
            );
            $v = trim((string) ($row->value ?? ''));
            if ($v !== '') {
                $defaultRegisterGroup = $v;
            }
        } catch (\Throwable $e) {
        }

        $allowedRegisterGroups = ['visitor', 'subscriber', 'contributor', 'editor'];
        if (!in_array($defaultRegisterGroup, $allowedRegisterGroups, true)) {
            $defaultRegisterGroup = 'subscriber';
        }

        $userOptions = [
            'markdown' => (int) ($options->markdown ?? 0),
            'xmlrpcMarkdown' => (int) ($options->xmlrpcMarkdown ?? 0),
            'autoSave' => (int) ($options->autoSave ?? 0),
            'defaultAllowComment' => (int) ($options->defaultAllowComment ?? 0),
            'defaultAllowPing' => (int) ($options->defaultAllowPing ?? 0),
            'defaultAllowFeed' => (int) ($options->defaultAllowFeed ?? 0),
        ];
        try {
            $uid = (int) ($user->uid ?? 0);
            if ($uid > 0) {
                $rows = $db->fetchAll(
                    $db->select('name', 'value')->from('table.options')->where('user = ?', $uid)
                );
                foreach ((array) $rows as $row) {
                    $name = (string) ($row['name'] ?? '');
                    if ($name === '' || !array_key_exists($name, $userOptions)) {
                        continue;
                    }
                    $userOptions[$name] = (int) ($row['value'] ?? 0);
                }
            }
        } catch (\Throwable $e) {
        }

        $ai = [];
        try {
            if (class_exists('\\TypechoPlugin\\Vue3Admin\\Ai')) {
                $ai = \TypechoPlugin\Vue3Admin\Ai::getConfig($options);
            }
        } catch (\Throwable $e) {
        }

        v3a_exit_json(0, [
            'isAdmin' => $isAdmin,
            'profile' => [
                'uid' => (int) ($user->uid ?? 0),
                'name' => (string) ($user->name ?? ''),
                'screenName' => (string) ($user->screenName ?? ''),
                'mail' => (string) ($user->mail ?? ''),
                'url' => (string) ($user->url ?? ''),
                'avatar' => v3a_gravatar_mirror_url((string) ($user->mail ?? ''), 160, 'mm', 'X'),
                'group' => (string) ($user->group ?? ''),
            ],
            'userOptions' => $userOptions,
            'site' => [
                'siteUrl' => (string) ($options->siteUrl ?? ''),
                'siteUrlLocked' => defined('__TYPECHO_SITE_URL__'),
                'title' => (string) ($options->title ?? ''),
                'description' => (string) ($options->description ?? ''),
                'keywords' => (string) ($options->keywords ?? ''),
                'allowRegister' => (int) ($options->allowRegister ?? 0),
                'defaultRegisterGroup' => $defaultRegisterGroup,
                'allowXmlRpc' => (int) ($options->allowXmlRpc ?? 0),
                'lang' => (string) ($options->lang ?? 'zh_CN'),
                'timezone' => (int) ($options->timezone ?? 28800),
            ],
            'storage' => [
                'attachmentTypes' => (string) ($options->attachmentTypes ?? ''),
            ],
            'reading' => [
                'postDateFormat' => (string) ($options->postDateFormat ?? ''),
                'frontPage' => $frontPage,
                'frontPageType' => $frontPageType,
                'frontPageValue' => $frontPageValue,
                'frontArchive' => (int) ($options->frontArchive ?? 0),
                'archivePattern' => isset($routingTable['archive']['url'])
                    ? v3a_decode_rule((string) $routingTable['archive']['url'])
                    : '',
                'pageSize' => (int) ($options->pageSize ?? 10),
                'postsListSize' => (int) ($options->postsListSize ?? 10),
                'feedFullText' => (int) ($options->feedFullText ?? 0),
            ],
            'discussion' => [
                'commentDateFormat' => (string) ($options->commentDateFormat ?? ''),
                'commentsListSize' => (int) ($options->commentsListSize ?? 20),
                'commentsShowCommentOnly' => (int) ($options->commentsShowCommentOnly ?? 0),
                'commentsMarkdown' => (int) ($options->commentsMarkdown ?? 0),
                'commentsShowUrl' => (int) ($options->commentsShowUrl ?? 0),
                'commentsUrlNofollow' => (int) ($options->commentsUrlNofollow ?? 0),
                'commentsAvatar' => (int) ($options->commentsAvatar ?? 0),
                'commentsAvatarRating' => (string) ($options->commentsAvatarRating ?? 'G'),
                'commentsPageBreak' => (int) ($options->commentsPageBreak ?? 0),
                'commentsPageSize' => (int) ($options->commentsPageSize ?? 10),
                'commentsPageDisplay' => (string) ($options->commentsPageDisplay ?? 'last'),
                'commentsThreaded' => (int) ($options->commentsThreaded ?? 0),
                'commentsMaxNestingLevels' => (int) ($options->commentsMaxNestingLevels ?? 3),
                'commentsOrder' => (string) ($options->commentsOrder ?? 'DESC'),
                'commentsRequireModeration' => (int) ($options->commentsRequireModeration ?? 0),
                'commentsWhitelist' => (int) ($options->commentsWhitelist ?? 0),
                'commentsRequireMail' => (int) ($options->commentsRequireMail ?? 0),
                'commentsRequireUrl' => (int) ($options->commentsRequireUrl ?? 0),
                'commentsCheckReferer' => (int) ($options->commentsCheckReferer ?? 0),
                'commentsAntiSpam' => (int) ($options->commentsAntiSpam ?? 0),
                'commentsAutoClose' => (int) ($options->commentsAutoClose ?? 0),
                'commentsPostTimeoutDays' => (int) intval(((int) ($options->commentsPostTimeout ?? 0)) / (24 * 3600)),
                'commentsPostIntervalEnable' => (int) ($options->commentsPostIntervalEnable ?? 0),
                'commentsPostIntervalMins' => (float) round(((float) ($options->commentsPostInterval ?? 0)) / 60, 1),
                'commentsHTMLTagAllowed' => (string) ($options->commentsHTMLTagAllowed ?? ''),
            ],
            'notify' => [
                'mailEnabled' => (int) ($options->v3a_mail_enabled ?? 0),
                'commentNotifyEnabled' => (int) ($options->v3a_mail_comment_enabled ?? 0),
                // backward-compatible: default to commentNotifyEnabled if option not set yet
                'commentWaitingNotifyEnabled' => (int) ($options->v3a_mail_comment_waiting_enabled ?? ($options->v3a_mail_comment_enabled ?? 0)),
                'commentReplyNotifyEnabled' => (int) ($options->v3a_mail_comment_reply_enabled ?? 0),
                'friendLinkNotifyEnabled' => (int) ($options->v3a_mail_friendlink_enabled ?? 0),
                'templateStyle' => (string) ($options->v3a_mail_template_style ?? 'v3a'),
                'smtpFrom' => (string) ($options->v3a_mail_smtp_from ?? ''),
                'smtpHost' => (string) ($options->v3a_mail_smtp_host ?? ''),
                'smtpPort' => (int) ($options->v3a_mail_smtp_port ?? 465),
                'smtpUser' => (string) ($options->v3a_mail_smtp_user ?? ''),
                'smtpPass' => '',
                'smtpSecure' => (int) ($options->v3a_mail_smtp_secure ?? 1),
                'commentTemplate' => (string) ($options->v3a_mail_comment_template ?? ''),
                'commentWaitingTemplate' => (string) ($options->v3a_mail_comment_waiting_template ?? ''),
                'commentReplyTemplate' => (string) ($options->v3a_mail_comment_reply_template ?? ''),
                'friendLinkTemplate' => (string) ($options->v3a_mail_friendlink_template ?? ''),
                'hasSmtpPass' => (string) ($options->v3a_mail_smtp_pass ?? '') === '' ? 0 : 1,
                'lastError' => v3a_json_assoc($options->v3a_mail_last_error ?? ''),
                'lastSuccess' => v3a_json_assoc($options->v3a_mail_last_success ?? ''),
            ],
            'ai' => $ai,
            'permalink' => [
                'rewrite' => (int) ($options->rewrite ?? 0),
                'rewriteLocked' => defined('__TYPECHO_REWRITE__'),
                'postUrl' => (string) ($routingTable['post']['url'] ?? ''),
                'pagePattern' => isset($routingTable['page']['url'])
                    ? v3a_decode_rule((string) $routingTable['page']['url'])
                    : '',
                'categoryPattern' => isset($routingTable['category']['url'])
                    ? v3a_decode_rule((string) $routingTable['category']['url'])
                    : '',
                'customPattern' => isset($routingTable['post']['url'])
                    ? v3a_decode_rule((string) $routingTable['post']['url'])
                    : '',
            ],
            'lists' => [
                'langs' => $langs,
                'frontPagePages' => $frontPagePages,
                'frontPageFiles' => $frontPageFiles,
            ],
        ]);
    }

    if ($do === 'acl.get') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $config = v3a_acl_load($db);
        v3a_exit_json(0, ['config' => $config]);
    }

    if ($do === 'acl.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }

        v3a_security_protect($security, $request);
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $config = $payload['config'] ?? [];
        if (is_string($config)) {
            $decoded = json_decode($config, true);
            $config = is_array($decoded) ? $decoded : [];
        }

        $sanitized = v3a_acl_sanitize_config(is_array($config) ? $config : []);
        try {
            v3a_upsert_option(
                $db,
                'v3a_acl_config',
                json_encode($sanitized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                0
            );
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }

        v3a_exit_json(0, ['config' => $sanitized]);
    }

    if ($do === 'settings.user.profile.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        $uid = (int) ($user->uid ?? 0);
        if ($uid <= 0) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $screenName = v3a_string($payload['screenName'] ?? '', '');
        $mail = v3a_string($payload['mail'] ?? '', '');
        $url = v3a_string($payload['url'] ?? '', '');

        if ($screenName === '') {
            $screenName = (string) ($user->name ?? '');
        }

        if ($mail === '' || !filter_var($mail, FILTER_VALIDATE_EMAIL)) {
            v3a_exit_json(400, null, '邮箱格式错误');
        }

        if ($url !== '' && !filter_var($url, FILTER_VALIDATE_URL)) {
            v3a_exit_json(400, null, '个人主页地址格式错误');
        }

        $mailExists = $db->fetchRow(
            $db->select('uid')->from('table.users')->where('mail = ?', $mail)->where('uid <> ?', $uid)->limit(1)
        );
        if (!empty($mailExists)) {
            v3a_exit_json(409, null, '电子邮箱地址已经存在');
        }

        $screenNameExists = $db->fetchRow(
            $db->select('uid')
                ->from('table.users')
                ->where('screenName = ?', $screenName)
                ->where('uid <> ?', $uid)
                ->limit(1)
        );
        if (!empty($screenNameExists)) {
            v3a_exit_json(409, null, '昵称已经存在');
        }

        $db->query(
            $db->update('table.users')
                ->rows(['screenName' => $screenName, 'mail' => $mail, 'url' => $url])
                ->where('uid = ?', $uid),
            \Typecho\Db::WRITE
        );

        v3a_exit_json(0, [
            'profile' => [
                'uid' => $uid,
                'name' => (string) ($user->name ?? ''),
                'screenName' => $screenName,
                'mail' => $mail,
                'url' => $url,
                'group' => (string) ($user->group ?? ''),
            ],
        ]);
    }

    if ($do === 'settings.user.options.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        $uid = (int) ($user->uid ?? 0);
        if ($uid <= 0) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();

        $defaultAllow = $payload['defaultAllow'] ?? [];
        if (!is_array($defaultAllow)) {
            $defaultAllow = [];
        }

        $settings = [
            'autoSave' => v3a_bool_int($payload['autoSave'] ?? 0),
            'markdown' => v3a_bool_int($payload['markdown'] ?? 0),
            'xmlrpcMarkdown' => v3a_bool_int($payload['xmlrpcMarkdown'] ?? 0),
            'defaultAllowComment' => in_array('comment', $defaultAllow, true) ? 1 : 0,
            'defaultAllowPing' => in_array('ping', $defaultAllow, true) ? 1 : 0,
            'defaultAllowFeed' => in_array('feed', $defaultAllow, true) ? 1 : 0,
        ];

        foreach ($settings as $name => $value) {
            $exists = (int) ($db->fetchObject(
                $db->select(['COUNT(*)' => 'num'])->from('table.options')->where('name = ? AND user = ?', $name, $uid)
            )->num ?? 0);
            if ($exists > 0) {
                $db->query(
                    $db->update('table.options')->rows(['value' => $value])->where('name = ? AND user = ?', $name, $uid),
                    \Typecho\Db::WRITE
                );
            } else {
                $db->query(
                    $db->insert('table.options')->rows(['name' => $name, 'value' => $value, 'user' => $uid]),
                    \Typecho\Db::WRITE
                );
            }
        }

        v3a_exit_json(0, ['userOptions' => $settings]);
    }

    if ($do === 'settings.user.password.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        $uid = (int) ($user->uid ?? 0);
        if ($uid <= 0) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $password = (string) ($payload['password'] ?? '');
        $confirm = (string) ($payload['confirm'] ?? '');
        if ($password === '') {
            v3a_exit_json(400, null, '必须填写密码');
        }
        if (strlen($password) < 6) {
            v3a_exit_json(400, null, '为了保证账户安全, 请输入至少六位的密码');
        }
        if ($confirm !== '' && $confirm !== $password) {
            v3a_exit_json(400, null, '两次输入的密码不一致');
        }

        $hasher = new \Utils\PasswordHash(8, true);
        $hashed = $hasher->hashPassword($password);

        $db->query(
            $db->update('table.users')->rows(['password' => $hashed])->where('uid = ?', $uid),
            \Typecho\Db::WRITE
        );

        v3a_exit_json(0, ['updated' => 1]);
    }

    if ($do === 'settings.site.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();

        $settings = [
            'title' => v3a_string($payload['title'] ?? '', ''),
            'description' => v3a_string($payload['description'] ?? '', ''),
            'keywords' => v3a_string($payload['keywords'] ?? '', ''),
            'allowRegister' => v3a_bool_int($payload['allowRegister'] ?? 0),
            'allowXmlRpc' => v3a_int($payload['allowXmlRpc'] ?? 0, 0),
            'lang' => v3a_string($payload['lang'] ?? '', (string) ($options->lang ?? 'zh_CN')),
            'timezone' => v3a_int($payload['timezone'] ?? 28800, 28800),
        ];

        $defaultRegisterGroup = strtolower(v3a_string($payload['defaultRegisterGroup'] ?? 'subscriber', 'subscriber'));
        $allowedRegisterGroups = ['visitor', 'subscriber', 'contributor', 'editor'];
        if (!in_array($defaultRegisterGroup, $allowedRegisterGroups, true)) {
            $defaultRegisterGroup = 'subscriber';
        }

        if (!defined('__TYPECHO_SITE_URL__') && isset($payload['siteUrl'])) {
            $settings['siteUrl'] = rtrim(v3a_string($payload['siteUrl'] ?? '', ''), '/');
        }

        try {
            $langMap = \Widget\Options\General::getLangs();
            if (!empty($settings['lang']) && !isset($langMap[$settings['lang']])) {
                $settings['lang'] = (string) ($options->lang ?? 'zh_CN');
            }
        } catch (\Throwable $e) {
        }

        foreach ($settings as $name => $value) {
            $db->query(
                $db->update('table.options')->rows(['value' => $value])->where('name = ?', $name),
                \Typecho\Db::WRITE
            );
        }

        v3a_upsert_option($db, 'defaultRegisterGroup', $defaultRegisterGroup, 0);
        $settings['defaultRegisterGroup'] = $defaultRegisterGroup;

        v3a_exit_json(0, ['site' => $settings]);
    }

    if ($do === 'settings.storage.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $types = $payload['attachmentTypes'] ?? [];
        if (!is_array($types)) {
            $types = [];
        }

        $other = v3a_string($payload['attachmentTypesOther'] ?? '', '');

        $keep = [];
        if (in_array('@image@', $types, true)) {
            $keep[] = '@image@';
        }
        if (in_array('@media@', $types, true)) {
            $keep[] = '@media@';
        }
        if (in_array('@doc@', $types, true)) {
            $keep[] = '@doc@';
        }
        if (in_array('@other@', $types, true) && $other !== '') {
            $parts = array_filter(array_map('trim', explode(',', strtolower($other))));
	            $parts = array_values(array_filter($parts, function ($ext) {
	                return !preg_match("/^(php|php4|php5|sh|asp|jsp|rb|py|pl|dll|exe|bat)$/i", (string) $ext);
	            }));
            if (!empty($parts)) {
                $keep[] = implode(',', $parts);
            }
        }

        $value = implode(',', $keep);
        $db->query(
            $db->update('table.options')->rows(['value' => $value])->where('name = ?', 'attachmentTypes'),
            \Typecho\Db::WRITE
        );

        v3a_exit_json(0, ['storage' => ['attachmentTypes' => $value]]);
    }

    if ($do === 'settings.content.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();

        $frontPageType = v3a_string($payload['frontPageType'] ?? 'recent', 'recent');
        $frontPage = 'recent';

        if ($frontPageType === 'page') {
            $pageId = v3a_int($payload['frontPagePage'] ?? 0, 0);
            if ($pageId > 0) {
                $exists = $db->fetchRow(
                    $db->select('cid')
                        ->from('table.contents')
                        ->where('type = ?', 'page')
                        ->where('status = ?', 'publish')
                        ->where('created < ?', $options->time)
                        ->where('cid = ?', $pageId)
                        ->limit(1)
                );
                if ($exists) {
                    $frontPage = 'page:' . $pageId;
                }
            }
        } elseif ($frontPageType === 'file') {
            $file = v3a_string($payload['frontPageFile'] ?? '', '');
            $file = trim($file, " ./\\");
            if ($file !== '') {
                $path = $options->themeFile($options->theme, $file);
                if (file_exists($path)) {
                    $frontPage = 'file:' . $file;
                }
            }
        } else {
            $frontPageType = 'recent';
            $frontPage = 'recent';
        }

        $frontArchive = 0;
        $routingTable = (array) ($options->routingTable ?? []);
        if ($frontPage !== 'recent') {
            $frontArchive = v3a_bool_int($payload['frontArchive'] ?? 0);
            if ($frontArchive) {
                $archivePattern = v3a_string($payload['archivePattern'] ?? '', '');
                $routingTable['archive']['url'] = '/' . ltrim(v3a_encode_rule($archivePattern), '/');
                $routingTable['archive_page']['url'] = rtrim((string) $routingTable['archive']['url'], '/') . '/page/[page:digital]/';
                if (isset($routingTable[0])) {
                    unset($routingTable[0]);
                }

                $db->query(
                    $db->update('table.options')
                        ->rows(['value' => v3a_encode_option_value('routingTable', $routingTable)])
                        ->where('name = ?', 'routingTable'),
                    \Typecho\Db::WRITE
                );
            }
        }

        $settings = [
            'postDateFormat' => v3a_string($payload['postDateFormat'] ?? '', ''),
            'frontPage' => $frontPage,
            'frontArchive' => $frontArchive,
            'pageSize' => v3a_int($payload['pageSize'] ?? 10, 10),
            'postsListSize' => v3a_int($payload['postsListSize'] ?? 10, 10),
            'feedFullText' => v3a_bool_int($payload['feedFullText'] ?? 0),
        ];

        foreach ($settings as $name => $value) {
            $db->query(
                $db->update('table.options')->rows(['value' => $value])->where('name = ?', $name),
                \Typecho\Db::WRITE
            );
        }

        v3a_exit_json(0, ['reading' => $settings]);
    }

    if ($do === 'settings.discussion.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();

        $settings = [
            'commentDateFormat' => v3a_string($payload['commentDateFormat'] ?? '', ''),
            'commentsListSize' => v3a_int($payload['commentsListSize'] ?? 20, 20),
            'commentsShowCommentOnly' => v3a_bool_int($payload['commentsShowCommentOnly'] ?? 0),
            'commentsMarkdown' => v3a_bool_int($payload['commentsMarkdown'] ?? 0),
            'commentsShowUrl' => v3a_bool_int($payload['commentsShowUrl'] ?? 0),
            'commentsUrlNofollow' => v3a_bool_int($payload['commentsUrlNofollow'] ?? 0),
            'commentsAvatar' => v3a_bool_int($payload['commentsAvatar'] ?? 0),
            'commentsAvatarRating' => v3a_string($payload['commentsAvatarRating'] ?? 'G', 'G'),
            'commentsPageBreak' => v3a_bool_int($payload['commentsPageBreak'] ?? 0),
            'commentsPageSize' => v3a_int($payload['commentsPageSize'] ?? 10, 10),
            'commentsPageDisplay' => v3a_string($payload['commentsPageDisplay'] ?? 'last', 'last') === 'first'
                ? 'first'
                : 'last',
            'commentsThreaded' => v3a_bool_int($payload['commentsThreaded'] ?? 0),
            'commentsMaxNestingLevels' => min(7, max(2, v3a_int($payload['commentsMaxNestingLevels'] ?? 3, 3))),
            'commentsOrder' => v3a_string($payload['commentsOrder'] ?? 'DESC', 'DESC') === 'ASC' ? 'ASC' : 'DESC',
            'commentsRequireModeration' => v3a_bool_int($payload['commentsRequireModeration'] ?? 0),
            'commentsWhitelist' => v3a_bool_int($payload['commentsWhitelist'] ?? 0),
            'commentsRequireMail' => v3a_bool_int($payload['commentsRequireMail'] ?? 0),
            'commentsRequireUrl' => v3a_bool_int($payload['commentsRequireUrl'] ?? 0),
            'commentsCheckReferer' => v3a_bool_int($payload['commentsCheckReferer'] ?? 0),
            'commentsAntiSpam' => v3a_bool_int($payload['commentsAntiSpam'] ?? 0),
            'commentsAutoClose' => v3a_bool_int($payload['commentsAutoClose'] ?? 0),
            'commentsPostTimeout' => max(0, v3a_int($payload['commentsPostTimeoutDays'] ?? 0, 0)) * 24 * 3600,
            'commentsPostIntervalEnable' => v3a_bool_int($payload['commentsPostIntervalEnable'] ?? 0),
            'commentsPostInterval' => max(0.0, (float) ($payload['commentsPostIntervalMins'] ?? 0)) * 60,
            'commentsHTMLTagAllowed' => v3a_string($payload['commentsHTMLTagAllowed'] ?? '', ''),
        ];

        if (!in_array($settings['commentsAvatarRating'], ['G', 'PG', 'R', 'X'], true)) {
            $settings['commentsAvatarRating'] = 'G';
        }

        foreach ($settings as $name => $value) {
            $db->query(
                $db->update('table.options')->rows(['value' => $value])->where('name = ?', $name),
                \Typecho\Db::WRITE
            );
        }

        v3a_exit_json(0, ['discussion' => $settings]);
    }

    if ($do === 'settings.notify.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();

        $mailEnabled = v3a_bool_int($payload['mailEnabled'] ?? 0);
        $commentNotifyEnabled = v3a_bool_int($payload['commentNotifyEnabled'] ?? 0);
        // backward-compatible: if not provided, follow commentNotifyEnabled
        $commentWaitingNotifyEnabled = v3a_bool_int($payload['commentWaitingNotifyEnabled'] ?? $commentNotifyEnabled);
        $commentReplyNotifyEnabled = v3a_bool_int($payload['commentReplyNotifyEnabled'] ?? 0);
        $friendLinkNotifyEnabled = v3a_bool_int($payload['friendLinkNotifyEnabled'] ?? 0);
        $templateStyle = v3a_string($payload['templateStyle'] ?? 'v3a', 'v3a');
        $smtpFrom = v3a_string($payload['smtpFrom'] ?? '', '');
        $smtpHost = v3a_string($payload['smtpHost'] ?? '', '');
        $smtpPort = v3a_int($payload['smtpPort'] ?? 465, 465);
        $smtpUser = v3a_string($payload['smtpUser'] ?? '', '');
        $smtpPass = v3a_string($payload['smtpPass'] ?? '', '');
        $smtpSecure = v3a_bool_int($payload['smtpSecure'] ?? 1);
        $commentTemplate = v3a_string($payload['commentTemplate'] ?? '', '');
        $commentWaitingTemplate = v3a_string($payload['commentWaitingTemplate'] ?? '', '');
        $commentReplyTemplate = v3a_string($payload['commentReplyTemplate'] ?? '', '');
        $friendLinkTemplate = v3a_string($payload['friendLinkTemplate'] ?? '', '');

        if (!in_array($templateStyle, ['v3a', 'cn_default', 'cn_pure'], true)) {
            $templateStyle = 'v3a';
        }

        if ($smtpFrom !== '' && !filter_var($smtpFrom, FILTER_VALIDATE_EMAIL)) {
            v3a_exit_json(400, null, '发件邮箱地址格式错误');
        }
        if ($smtpPort <= 0 || $smtpPort > 65535) {
            v3a_exit_json(400, null, 'SMTP 端口格式错误');
        }

        $hasExistingPass = (string) ($options->v3a_mail_smtp_pass ?? '') !== '';
        if (
            $mailEnabled
            && ($commentNotifyEnabled || $commentWaitingNotifyEnabled || $commentReplyNotifyEnabled || $friendLinkNotifyEnabled)
        ) {
            if ($smtpFrom === '' || !filter_var($smtpFrom, FILTER_VALIDATE_EMAIL)) {
                v3a_exit_json(400, null, '发件邮箱地址不能为空');
            }
            if (trim($smtpHost) === '') {
                v3a_exit_json(400, null, 'SMTP 主机不能为空');
            }
            if (trim($smtpUser) === '') {
                v3a_exit_json(400, null, 'SMTP 用户名不能为空');
            }
            if (!$hasExistingPass && trim($smtpPass) === '') {
                v3a_exit_json(400, null, 'SMTP 密码不能为空');
            }
        }

        v3a_upsert_option($db, 'v3a_mail_enabled', $mailEnabled, 0);
        v3a_upsert_option($db, 'v3a_mail_comment_enabled', $commentNotifyEnabled, 0);
        v3a_upsert_option($db, 'v3a_mail_comment_waiting_enabled', $commentWaitingNotifyEnabled, 0);
        v3a_upsert_option($db, 'v3a_mail_comment_reply_enabled', $commentReplyNotifyEnabled, 0);
        v3a_upsert_option($db, 'v3a_mail_friendlink_enabled', $friendLinkNotifyEnabled, 0);
        v3a_upsert_option($db, 'v3a_mail_template_style', $templateStyle, 0);
        v3a_upsert_option($db, 'v3a_mail_smtp_from', $smtpFrom, 0);
        v3a_upsert_option($db, 'v3a_mail_smtp_host', $smtpHost, 0);
        v3a_upsert_option($db, 'v3a_mail_smtp_port', $smtpPort, 0);
        v3a_upsert_option($db, 'v3a_mail_smtp_user', $smtpUser, 0);
        v3a_upsert_option($db, 'v3a_mail_smtp_secure', $smtpSecure, 0);
        v3a_upsert_option($db, 'v3a_mail_comment_template', $commentTemplate, 0);
        v3a_upsert_option($db, 'v3a_mail_comment_waiting_template', $commentWaitingTemplate, 0);
        v3a_upsert_option($db, 'v3a_mail_comment_reply_template', $commentReplyTemplate, 0);
        v3a_upsert_option($db, 'v3a_mail_friendlink_template', $friendLinkTemplate, 0);
        if (trim($smtpPass) !== '') {
            v3a_upsert_option($db, 'v3a_mail_smtp_pass', $smtpPass, 0);
        }

        $notify = [
            'mailEnabled' => $mailEnabled,
            'commentNotifyEnabled' => $commentNotifyEnabled,
            'commentWaitingNotifyEnabled' => $commentWaitingNotifyEnabled,
            'commentReplyNotifyEnabled' => $commentReplyNotifyEnabled,
            'friendLinkNotifyEnabled' => $friendLinkNotifyEnabled,
            'templateStyle' => $templateStyle,
            'smtpFrom' => $smtpFrom,
            'smtpHost' => $smtpHost,
            'smtpPort' => $smtpPort,
            'smtpUser' => $smtpUser,
            'smtpPass' => '',
            'smtpSecure' => $smtpSecure,
            'commentTemplate' => $commentTemplate,
            'commentWaitingTemplate' => $commentWaitingTemplate,
            'commentReplyTemplate' => $commentReplyTemplate,
            'friendLinkTemplate' => $friendLinkTemplate,
            'hasSmtpPass' => (trim($smtpPass) !== '' || $hasExistingPass) ? 1 : 0,
            'lastError' => v3a_json_assoc($options->v3a_mail_last_error ?? ''),
            'lastSuccess' => v3a_json_assoc($options->v3a_mail_last_success ?? ''),
        ];

        v3a_exit_json(0, ['notify' => $notify]);
    }

    if ($do === 'settings.notify.test') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $to = trim((string) ($user->mail ?? ''));
        $toName = (string) ($user->screenName ?? $user->name ?? '');
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            v3a_exit_json(400, null, '当前登录用户未设置有效邮箱地址，请先在「设定 → 用户」中保存邮箱。');
        }

        try {
            if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Plugin')) {
                $pluginFile = rtrim(v3a_plugin_root_dir($options), '/\\') . DIRECTORY_SEPARATOR . 'Vue3Admin'
                    . DIRECTORY_SEPARATOR . 'Plugin.php';
                if (is_file($pluginFile)) {
                    require_once $pluginFile;
                }
            }

            if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Plugin')) {
                v3a_exit_json(500, null, 'Vue3Admin Plugin not loaded');
            }

            $result = \TypechoPlugin\Vue3Admin\Plugin::sendTestMail($to, $toName);

            $optLastError = '';
            $optLastSuccess = '';
            try {
                $optLastError = (string) ($db->fetchObject(
                    $db->select('value')->from('table.options')->where('name = ? AND user = ?', 'v3a_mail_last_error', 0)->limit(1)
                )->value ?? '');
            } catch (\Throwable $e) {
            }
            try {
                $optLastSuccess = (string) ($db->fetchObject(
                    $db->select('value')->from('table.options')->where('name = ? AND user = ?', 'v3a_mail_last_success', 0)->limit(1)
                )->value ?? '');
            } catch (\Throwable $e) {
            }

            $payloadOut = [
                'sent' => (int) (($result['ok'] ?? 0) ? 1 : 0),
                'to' => (string) ($result['to'] ?? $to),
                'message' => (string) ($result['message'] ?? ''),
                'notify' => [
                    'lastError' => v3a_json_assoc($optLastError),
                    'lastSuccess' => v3a_json_assoc($optLastSuccess),
                ],
            ];

            if (!empty($result['ok'])) {
                v3a_exit_json(0, $payloadOut);
            }

            v3a_exit_json(400, $payloadOut, (string) ($result['message'] ?? '发送失败'));
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'settings.system.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $enableRewriteAnyway = v3a_bool_int($payload['enableRewriteAnyway'] ?? 0);

        $routingTable = (array) ($options->routingTable ?? []);

        $postPattern = v3a_string($payload['postPattern'] ?? '', '');
        $customPattern = v3a_string($payload['customPattern'] ?? '', '');
        $postUrl = $postPattern === 'custom' ? v3a_encode_rule($customPattern) : $postPattern;
        if ($postUrl !== '') {
            $routingTable['post']['url'] = '/' . ltrim($postUrl, '/');
        }

        if (isset($payload['pagePattern'])) {
            $routingTable['page']['url'] = '/' . ltrim(v3a_encode_rule(v3a_string($payload['pagePattern'] ?? '', '')), '/');
        }
        if (isset($payload['categoryPattern'])) {
            $routingTable['category']['url'] = '/' . ltrim(
                v3a_encode_rule(v3a_string($payload['categoryPattern'] ?? '', '')),
                '/'
            );
            $routingTable['category_page']['url'] = rtrim((string) $routingTable['category']['url'], '/') . '/[page:digital]/';
        }

        if (isset($routingTable[0])) {
            unset($routingTable[0]);
        }

        $settings = [];
        if (!defined('__TYPECHO_REWRITE__') && isset($payload['rewrite'])) {
            $settings['rewrite'] = v3a_bool_int($payload['rewrite'] ?? 0);

            if (
                $settings['rewrite']
                && !((int) ($options->rewrite ?? 0))
                && !$enableRewriteAnyway
            ) {
                $check = v3a_permalink_check_rewrite($options);
                if (empty($check['ok'])) {
                    $message = (string) ($check['message'] ?? 'Rewrite check failed');
                    v3a_exit_json(
                        400,
                        [
                            'rewriteCheck' => [
                                'ok' => false,
                                'message' => $message,
                                'needEnableRewriteAnyway' => 1,
                            ],
                        ],
                        $message
                    );
                }
            }
            $db->query(
                $db->update('table.options')->rows(['value' => $settings['rewrite']])->where('name = ?', 'rewrite'),
                \Typecho\Db::WRITE
            );
        }

        $db->query(
            $db->update('table.options')
                ->rows(['value' => v3a_encode_option_value('routingTable', $routingTable)])
                ->where('name = ?', 'routingTable'),
            \Typecho\Db::WRITE
        );

        v3a_exit_json(0, [
            'permalink' => [
                'rewrite' => isset($settings['rewrite']) ? (int) $settings['rewrite'] : (int) ($options->rewrite ?? 0),
                'postUrl' => (string) ($routingTable['post']['url'] ?? ''),
                'pagePattern' => isset($routingTable['page']['url']) ? v3a_decode_rule((string) $routingTable['page']['url']) : '',
                'categoryPattern' => isset($routingTable['category']['url'])
                    ? v3a_decode_rule((string) $routingTable['category']['url'])
                    : '',
                'customPattern' => isset($routingTable['post']['url'])
                    ? v3a_decode_rule((string) $routingTable['post']['url'])
                    : '',
            ],
        ]);
    }

    if ($do === 'settings.ai.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Ai')) {
            v3a_exit_json(500, null, 'AI module not loaded');
        }

        $payload = v3a_payload();
        try {
            $res = \TypechoPlugin\Vue3Admin\Ai::saveConfig($db, is_array($payload) ? $payload : []);
            v3a_exit_json(0, $res);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'ai.translate.get') {
        v3a_require_role($user, 'contributor');

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Ai')) {
            v3a_exit_json(500, null, 'AI module not loaded');
        }

        $cid = (int) $request->get('cid', 0);
        $lang = v3a_string($request->get('lang', ''), '');
        $ctype = strtolower(trim(v3a_string($request->get('ctype', 'post'), 'post')));
        $ctype = $ctype === 'page' ? 'page' : 'post';

        if ($cid <= 0 || $lang === '') {
            v3a_exit_json(400, null, 'Missing cid/lang');
        }

        $translation = \TypechoPlugin\Vue3Admin\Ai::getTranslation($cid, $ctype, $lang);
        v3a_exit_json(0, ['translation' => $translation]);
    }

    if ($do === 'ai.translate.generate') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Ai')) {
            v3a_exit_json(500, null, 'AI module not loaded');
        }

        $payload = v3a_payload();
        $cid = v3a_int($payload['cid'] ?? 0, 0);
        $lang = v3a_string($payload['lang'] ?? '', '');
        $ctype = strtolower(trim(v3a_string($payload['ctype'] ?? 'post', 'post')));
        $ctype = $ctype === 'page' ? 'page' : 'post';

        if ($cid <= 0 || $lang === '') {
            v3a_exit_json(400, null, 'Missing cid/lang');
        }

        $cfg = \TypechoPlugin\Vue3Admin\Ai::getRuntimeConfig($options);
        if (empty($cfg['enabled']) || empty($cfg['features']['translate'])) {
            v3a_exit_json(400, null, 'AI 翻译未启用');
        }

        $allowedLangs = (array) ($cfg['languages'] ?? []);
        if (!empty($allowedLangs) && !in_array(strtolower(trim($lang)), $allowedLangs, true)) {
            v3a_exit_json(400, null, '不支持的语言');
        }

        $acl = v3a_acl_for_user($db, $user);

        if ($ctype === 'post') {
            if (empty($acl['posts']['manage'])) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        } else {
            if (empty($acl['pages']['manage'])) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        }

        $select = $db->select('cid', 'title', 'text', 'type', 'authorId')
            ->from('table.contents')
            ->where('cid = ?', $cid)
            ->where('parent = ?', 0);

        if ($ctype === 'post') {
            $select->where('type = ? OR type = ?', 'post', 'post_draft');
            $scopeAll = !empty($acl['posts']['scopeAll']) && $user->pass('editor', true);
            if (!$scopeAll) {
                $select->where('authorId = ?', (int) ($user->uid ?? 0));
            }
        } else {
            $select->where('type = ? OR type = ?', 'page', 'page_draft');
            if (!$user->pass('editor', true)) {
                $select->where('authorId = ?', (int) ($user->uid ?? 0));
            }
        }

        $row = $db->fetchRow($select->limit(1));
        if (!$row) {
            v3a_exit_json(404, null, 'Content not found');
        }

        $title = (string) ($row['title'] ?? '');
        $rawText = (string) ($row['text'] ?? '');
        $markdown = false;
        if (strpos($rawText, '<!--markdown-->') === 0) {
            $markdown = true;
            $rawText = substr($rawText, 15);
        }

        try {
            $res = \TypechoPlugin\Vue3Admin\Ai::translate($cfg, $title, $rawText, $lang, $markdown);
            $saved = \TypechoPlugin\Vue3Admin\Ai::saveTranslation(
                $cid,
                $ctype,
                $lang,
                (string) ($res['title'] ?? ''),
                (string) ($res['text'] ?? ''),
                (string) ($res['model'] ?? '')
            );
            v3a_exit_json(0, ['translation' => $saved]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'ai.summary.get') {
        v3a_require_role($user, 'contributor');

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Ai')) {
            v3a_exit_json(500, null, 'AI module not loaded');
        }

        $cid = (int) $request->get('cid', 0);
        $lang = v3a_string($request->get('lang', ''), '');
        $ctype = strtolower(trim(v3a_string($request->get('ctype', 'post'), 'post')));
        $ctype = $ctype === 'page' ? 'page' : 'post';

        if ($cid <= 0 || $lang === '') {
            v3a_exit_json(400, null, 'Missing cid/lang');
        }

        $summary = \TypechoPlugin\Vue3Admin\Ai::getSummary($cid, $ctype, $lang);
        v3a_exit_json(0, ['summary' => $summary]);
    }

    if ($do === 'ai.summary.generate') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Ai')) {
            v3a_exit_json(500, null, 'AI module not loaded');
        }

        $payload = v3a_payload();
        $cid = v3a_int($payload['cid'] ?? 0, 0);
        $lang = v3a_string($payload['lang'] ?? '', '');
        $ctype = strtolower(trim(v3a_string($payload['ctype'] ?? 'post', 'post')));
        $ctype = $ctype === 'page' ? 'page' : 'post';

        if ($cid <= 0 || $lang === '') {
            v3a_exit_json(400, null, 'Missing cid/lang');
        }

        $cfg = \TypechoPlugin\Vue3Admin\Ai::getRuntimeConfig($options);
        if (empty($cfg['enabled']) || empty($cfg['features']['summary'])) {
            v3a_exit_json(400, null, 'AI 摘要未启用');
        }

        $allowedLangs = (array) ($cfg['languages'] ?? []);
        if (!empty($allowedLangs) && !in_array(strtolower(trim($lang)), $allowedLangs, true)) {
            v3a_exit_json(400, null, '不支持的语言');
        }

        $acl = v3a_acl_for_user($db, $user);

        if ($ctype === 'post') {
            if (empty($acl['posts']['manage'])) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        } else {
            if (empty($acl['pages']['manage'])) {
                v3a_exit_json(403, null, 'Forbidden');
            }
        }

        $select = $db->select('cid', 'title', 'text', 'type', 'authorId')
            ->from('table.contents')
            ->where('cid = ?', $cid)
            ->where('parent = ?', 0);

        if ($ctype === 'post') {
            $select->where('type = ? OR type = ?', 'post', 'post_draft');
            $scopeAll = !empty($acl['posts']['scopeAll']) && $user->pass('editor', true);
            if (!$scopeAll) {
                $select->where('authorId = ?', (int) ($user->uid ?? 0));
            }
        } else {
            $select->where('type = ? OR type = ?', 'page', 'page_draft');
            if (!$user->pass('editor', true)) {
                $select->where('authorId = ?', (int) ($user->uid ?? 0));
            }
        }

        $row = $db->fetchRow($select->limit(1));
        if (!$row) {
            v3a_exit_json(404, null, 'Content not found');
        }

        $title = (string) ($row['title'] ?? '');
        $rawText = (string) ($row['text'] ?? '');
        if (strpos($rawText, '<!--markdown-->') === 0) {
            $rawText = substr($rawText, 15);
        }

        try {
            $res = \TypechoPlugin\Vue3Admin\Ai::summarize($cfg, $title, $rawText, $lang);
            $saved = \TypechoPlugin\Vue3Admin\Ai::saveSummary(
                $cid,
                $ctype,
                $lang,
                (string) ($res['summary'] ?? ''),
                (string) ($res['model'] ?? '')
            );
            v3a_exit_json(0, ['summary' => $saved]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'ai.polish') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Ai')) {
            v3a_exit_json(500, null, 'AI module not loaded');
        }

        $cfg = \TypechoPlugin\Vue3Admin\Ai::getRuntimeConfig($options);
        if (empty($cfg['enabled']) || empty($cfg['features']['polish'])) {
            v3a_exit_json(400, null, 'AI 润色未启用');
        }

        $payload = v3a_payload();
        $text = v3a_string($payload['text'] ?? '', '');
        if (trim($text) === '') {
            v3a_exit_json(400, null, 'Missing text');
        }

        try {
            $res = \TypechoPlugin\Vue3Admin\Ai::polish($cfg, $text);
            v3a_exit_json(0, ['text' => (string) ($res['text'] ?? ''), 'model' => (string) ($res['model'] ?? '')]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'ai.slug') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'contributor');

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\Ai')) {
            v3a_exit_json(500, null, 'AI module not loaded');
        }

        $cfg = \TypechoPlugin\Vue3Admin\Ai::getRuntimeConfig($options);
        if (empty($cfg['enabled']) || empty($cfg['features']['slug'])) {
            v3a_exit_json(400, null, 'AI 缩略名未启用');
        }

        $payload = v3a_payload();
        $title = v3a_string($payload['title'] ?? '', '');
        if (trim($title) === '') {
            v3a_exit_json(400, null, 'Missing title');
        }

        try {
            $res = \TypechoPlugin\Vue3Admin\Ai::makeSlug($cfg, $title);
            v3a_exit_json(0, ['slug' => (string) ($res['slug'] ?? ''), 'model' => (string) ($res['model'] ?? '')]);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'themes.list') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $themes = glob(__TYPECHO_ROOT_DIR__ . __TYPECHO_THEME_DIR__ . '/*', GLOB_ONLYDIR);
        $result = [];

        foreach ((array) $themes as $dir) {
            $dir = (string) $dir;
            if ($dir === '') {
                continue;
            }

            $themeFile = rtrim($dir, "/\\") . '/index.php';
            if (!file_exists($themeFile)) {
                continue;
            }

            $info = \Typecho\Plugin::parseInfo($themeFile);
            $name = basename($dir);
            $info['name'] = $name;
            $info['activated'] = ((string) ($options->theme ?? '')) === $name ? 1 : 0;

            $screen = array_filter(glob(rtrim($dir, "/\\") . '/*'), function ($path) {
                return is_string($path) && preg_match("/screenshot\\.(jpg|png|gif|bmp|jpeg|webp|avif)$/i", $path);
            });
            if ($screen) {
                $info['screen'] = (string) $options->themeUrl(basename((string) current($screen)), $name);
            } else {
                $info['screen'] = (string) \Typecho\Common::url('noscreen.png', $options->adminStaticUrl('img'));
            }

            $result[] = $info;
        }

        // Put activated theme at top
        usort($result, function ($a, $b) {
            return (int) (($b['activated'] ?? 0) <=> ($a['activated'] ?? 0));
        });

        v3a_exit_json(0, [
            'current' => (string) ($options->theme ?? ''),
            'themes' => $result,
        ]);
    }

    if ($do === 'themes.activate') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $theme = trim(v3a_string($payload['theme'] ?? '', ''), './');
        if ($theme === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $theme)) {
            v3a_exit_json(400, null, 'Invalid theme');
        }

        $themeDir = $options->themeFile($theme);
        if (!is_dir($themeDir)) {
            v3a_exit_json(404, null, 'Theme not found');
        }

        // Delete old theme settings
        $oldTheme = (string) (($options->missingTheme ?? '') !== '' ? ($options->missingTheme ?? '') : ($options->theme ?? ''));
        if ($oldTheme !== '') {
            $db->query(
                $db->delete('table.options')->where('name = ? AND user = ?', 'theme:' . $oldTheme, 0),
                \Typecho\Db::WRITE
            );
        }

        v3a_upsert_option($db, 'theme', $theme, 0);

        // Unbind homepage file routing
        $frontPage = (string) ($options->frontPage ?? 'recent');
        if (strpos($frontPage, 'file:') === 0) {
            v3a_upsert_option($db, 'frontPage', 'recent', 0);
        }

        // Init theme config (default values)
        try {
            $configFile = $options->themeFile($theme, 'functions.php');
            if (file_exists($configFile)) {
                require_once $configFile;
                if (function_exists('themeConfig')) {
                    $form = new \Typecho\Widget\Helper\Form();
                    themeConfig($form);
                    $defaults = $form->getValues();
                    if (!empty($defaults)) {
                        $handled = false;
                        if (function_exists('themeConfigHandle')) {
                            themeConfigHandle($defaults, true);
                            $handled = true;
                        }
                        if (!$handled) {
                            v3a_upsert_option(
                                $db,
                                'theme:' . $theme,
                                $defaults,
                                0
                            );
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        v3a_exit_json(0, ['current' => $theme]);
    }

    if ($do === 'themes.files') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $theme = v3a_string($request->get('theme', ''), '');
        $theme = $theme !== '' ? trim($theme, './') : (string) ($options->theme ?? '');
        if ($theme === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $theme)) {
            v3a_exit_json(400, null, 'Invalid theme');
        }

        $dir = $options->themeFile($theme);
        $writeable = (!defined('__TYPECHO_THEME_WRITEABLE__') || __TYPECHO_THEME_WRITEABLE__)
            && (string) ($options->missingTheme ?? '') === '';

        if (!is_dir($dir) || !$writeable) {
            v3a_exit_json(400, null, 'Theme not writable');
        }

        $files = array_filter(glob(rtrim($dir, "/\\") . '/*'), function ($path) {
            return is_string($path) && preg_match("/\\.(php|js|css|vbs)$/i", $path);
        });

        $result = [];
        foreach ((array) $files as $file) {
            $result[] = basename((string) $file);
        }
        sort($result);

        v3a_exit_json(0, [
            'theme' => $theme,
            'files' => $result,
        ]);
    }

    if ($do === 'themes.file.get') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $theme = v3a_string($request->get('theme', ''), '');
        $file = v3a_string($request->get('file', ''), '');
        $theme = $theme !== '' ? trim($theme, './') : (string) ($options->theme ?? '');

        if ($theme === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $theme)) {
            v3a_exit_json(400, null, 'Invalid theme');
        }
        if ($file === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $file)) {
            v3a_exit_json(400, null, 'Invalid file');
        }

        $dir = $options->themeFile($theme);
        $path = rtrim($dir, "/\\") . '/' . $file;
        if (!is_dir($dir) || !file_exists($path)) {
            v3a_exit_json(404, null, 'File not found');
        }

        $writeable = (!defined('__TYPECHO_THEME_WRITEABLE__') || __TYPECHO_THEME_WRITEABLE__)
            && (string) ($options->missingTheme ?? '') === ''
            && is_writable($path);

        $content = (string) file_get_contents($path);
        v3a_exit_json(0, [
            'theme' => $theme,
            'file' => $file,
            'content' => $content,
            'writeable' => $writeable ? 1 : 0,
        ]);
    }

    if ($do === 'themes.file.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $theme = trim(v3a_string($payload['theme'] ?? '', ''), './');
        $file = v3a_string($payload['file'] ?? '', '');
        $content = (string) ($payload['content'] ?? '');

        if ($theme === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $theme)) {
            v3a_exit_json(400, null, 'Invalid theme');
        }
        if ($file === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $file)) {
            v3a_exit_json(400, null, 'Invalid file');
        }

        $dir = $options->themeFile($theme);
        $path = rtrim($dir, "/\\") . '/' . $file;

        $writeable = (!defined('__TYPECHO_THEME_WRITEABLE__') || __TYPECHO_THEME_WRITEABLE__)
            && (string) ($options->missingTheme ?? '') === '';

        if (!is_dir($dir) || !file_exists($path) || !is_writable($path) || !$writeable) {
            v3a_exit_json(400, null, 'File not writable');
        }

        $handle = @fopen($path, 'wb');
        if (!$handle) {
            v3a_exit_json(500, null, 'Write failed');
        }
        $written = fwrite($handle, $content);
        fclose($handle);
        if ($written === false) {
            v3a_exit_json(500, null, 'Write failed');
        }

        v3a_exit_json(0, ['saved' => 1]);
    }

    if ($do === 'themes.config.get') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $theme = v3a_string($request->get('theme', ''), '');
        $theme = $theme !== '' ? trim($theme, './') : (string) ($options->theme ?? '');
        if ($theme === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $theme)) {
            v3a_exit_json(400, null, 'Invalid theme');
        }

        $configFile = $options->themeFile($theme, 'functions.php');
        if (!file_exists($configFile)) {
            v3a_exit_json(0, ['theme' => $theme, 'exists' => 0, 'fields' => []]);
        }

        require_once $configFile;
        if (!function_exists('themeConfig')) {
            v3a_exit_json(0, ['theme' => $theme, 'exists' => 0, 'fields' => []]);
        }

        $themeOptions = [];
        try {
            $row = $db->fetchObject(
                $db->select('value')->from('table.options')->where('name = ? AND user = ?', 'theme:' . $theme, 0)
            );
            $raw = is_object($row) ? (string) ($row->value ?? '') : '';
            $themeOptions = v3a_decode_assoc_option($raw);
        } catch (\Throwable $e) {
        }

        $form = new \Typecho\Widget\Helper\Form();
        ob_start();
        themeConfig($form);
        $configHtml = (string) ob_get_clean();
        $inputs = $form->getInputs();

        $fields = [];
        foreach ((array) $inputs as $name => $input) {
            if (!is_string($name) || $name === '' || !($input instanceof \Typecho\Widget\Helper\Form\Element)) {
                continue;
            }

            // Override with stored values when available
            if (array_key_exists($name, $themeOptions)) {
                $input->value($themeOptions[$name]);
            } else {
                try {
                    if (isset($options->{$name})) {
                        $input->value($options->{$name});
                    }
                } catch (\Throwable $e) {
                }
            }

            $type = 'text';
            if ($input instanceof \Typecho\Widget\Helper\Form\Element\Textarea) {
                $type = 'textarea';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Select) {
                $type = 'select';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Radio) {
                $type = 'radio';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Checkbox) {
                $type = 'checkbox';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Number) {
                $type = 'number';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Password) {
                $type = 'password';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Url) {
                $type = 'url';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Hidden) {
                $type = 'hidden';
            }

            $desc = '';
            try {
                foreach ((array) ($input->container ? $input->container->getItems() : []) as $item) {
                    if (!($item instanceof \Typecho\Widget\Helper\Layout)) {
                        continue;
                    }
                    $cls = (string) ($item->getAttribute('class') ?? '');
                    if ($item->getTagName() === 'p' && strpos($cls, 'description') !== false) {
                        $desc = v3a_layout_text($item);
                        break;
                    }
                }
            } catch (\Throwable $e) {
            }

            $optionsList = [];
            try {
                if ($type === 'select' && $input->input instanceof \Typecho\Widget\Helper\Layout) {
                    foreach ((array) $input->input->getItems() as $opt) {
                        if (!($opt instanceof \Typecho\Widget\Helper\Layout)) {
                            continue;
                        }
                        $optionsList[] = [
                            'value' => (string) ($opt->getAttribute('value') ?? ''),
                            'label' => v3a_layout_text($opt),
                        ];
                    }
                } elseif (($type === 'radio' || $type === 'checkbox') && $input->container) {
                    foreach ((array) $input->container->getItems() as $node) {
                        if (!($node instanceof \Typecho\Widget\Helper\Layout)) {
                            continue;
                        }
                        if ($node->getTagName() !== 'span') {
                            continue;
                        }
                        $sub = (array) $node->getItems();
                        $subInput = null;
                        $subLabel = null;
                        foreach ($sub as $subNode) {
                            if (!($subNode instanceof \Typecho\Widget\Helper\Layout)) {
                                continue;
                            }
                            if ($subNode->getTagName() === 'input') {
                                $subInput = $subNode;
                            } elseif ($subNode->getTagName() === 'label') {
                                $subLabel = $subNode;
                            }
                        }
                        if ($subInput) {
                            $optionsList[] = [
                                'value' => (string) ($subInput->getAttribute('value') ?? ''),
                                'label' => $subLabel ? v3a_layout_text($subLabel) : '',
                            ];
                        }
                    }
                }
            } catch (\Throwable $e) {
            }

            $fields[] = [
                'name' => $name,
                'type' => $type,
                'label' => v3a_layout_text($input->label),
                'description' => $desc,
                'options' => $optionsList,
                'value' => $input->value,
            ];
        }

        v3a_exit_json(0, [
            'theme' => $theme,
            'exists' => 1,
            'fields' => $fields,
            'html' => $configHtml,
        ]);
    }

    if ($do === 'themes.config.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $theme = v3a_string($payload['theme'] ?? '', '');
        $theme = $theme !== '' ? trim($theme, './') : (string) ($options->theme ?? '');
        if ($theme === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $theme)) {
            v3a_exit_json(400, null, 'Invalid theme');
        }

        $configFile = $options->themeFile($theme, 'functions.php');
        if (!file_exists($configFile)) {
            v3a_exit_json(404, null, 'Theme config not found');
        }

        require_once $configFile;
        if (!function_exists('themeConfig')) {
            v3a_exit_json(400, null, 'Theme config not supported');
        }

        $values = isset($payload['values']) && is_array($payload['values']) ? $payload['values'] : [];

        $form = new \Typecho\Widget\Helper\Form();
        themeConfig($form);
        $inputs = $form->getInputs();

        $settings = [];
        foreach ((array) $inputs as $name => $input) {
            if (!is_string($name) || $name === '') {
                continue;
            }
            if (!array_key_exists($name, $values)) {
                continue;
            }

            $v = $values[$name];
            if ($input instanceof \Typecho\Widget\Helper\Form\Element\Checkbox) {
                $settings[$name] = is_array($v) ? array_values($v) : (isset($v) ? [$v] : []);
            } else {
                $settings[$name] = $v;
            }
        }

        $handled = false;
        if (function_exists('themeConfigHandle')) {
            themeConfigHandle($settings, false);
            $handled = true;
        }

        if (!$handled) {
            v3a_upsert_option(
                $db,
                'theme:' . $theme,
                $settings,
                0
            );
        }

        v3a_exit_json(0, ['saved' => 1]);
    }

    if ($do === 'plugins.list') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $pluginRoot = v3a_plugin_root_dir($options);
        $pluginDirs = $pluginRoot !== '' ? glob(rtrim($pluginRoot, '/\\') . DIRECTORY_SEPARATOR . '*') : [];
        $plugins = \Typecho\Plugin::export();
        $activatedPlugins = (array) ($plugins['activated'] ?? []);

        $activated = [];
        $inactive = [];

        foreach ((array) $pluginDirs as $pluginDir) {
            if (!is_string($pluginDir) || $pluginDir === '') {
                continue;
            }

            $pluginName = '';
            $pluginFileName = '';
            if (is_dir($pluginDir)) {
                $pluginName = basename($pluginDir);
                $pluginFileName = rtrim($pluginDir, "/\\") . '/Plugin.php';
            } elseif (file_exists($pluginDir) && basename($pluginDir) !== 'index.php') {
                $pluginFileName = $pluginDir;
                $part = explode('.', basename($pluginDir));
                if (count($part) === 2 && strtolower($part[1]) === 'php') {
                    $pluginName = $part[0];
                }
            }

            if ($pluginName === '' || $pluginFileName === '' || !file_exists($pluginFileName)) {
                continue;
            }

            $info = \Typecho\Plugin::parseInfo($pluginFileName);
            $info['name'] = $pluginName;
            $info['dependence'] = \Typecho\Plugin::checkDependence($info['since'] ?? null) ? 1 : 0;

            $manageable = !empty($info['activate']) || !empty($info['deactivate']) || !empty($info['config']) || !empty($info['personalConfig']);
            $info['manageable'] = $manageable ? 1 : 0;
            $info['canConfig'] = (!empty($info['config']) || !empty($info['personalConfig'])) ? 1 : 0;

            if ($manageable) {
                $info['activated'] = isset($activatedPlugins[$pluginName]) ? 1 : 0;
                if (isset($activatedPlugins[$pluginName])) {
                    unset($activatedPlugins[$pluginName]);
                }
            } else {
                $info['activated'] = 1;
            }

            if (!empty($info['activated'])) {
                $activated[] = $info;
            } else {
                $inactive[] = $info;
            }
        }

        // Missing plugins but still activated in options
        foreach ($activatedPlugins as $pluginName => $_val) {
            if (!is_string($pluginName) || $pluginName === '') {
                continue;
            }
            $activated[] = [
                'name' => $pluginName,
                'title' => $pluginName,
                'description' => '插件文件缺失',
                'author' => '',
                'homepage' => '',
                'version' => '',
                'since' => '',
                'dependence' => 1,
                'activate' => 1,
                'deactivate' => 1,
                'config' => 0,
                'personalConfig' => 0,
                'manageable' => 1,
                'canConfig' => 0,
                'activated' => 1,
                'missing' => 1,
            ];
        }

        v3a_exit_json(0, [
            'activated' => $activated,
            'inactive' => $inactive,
        ]);
    }

    if ($do === 'plugins.activate') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $pluginName = v3a_string($payload['plugin'] ?? '', '');
        if ($pluginName === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $pluginName)) {
            v3a_exit_json(400, null, 'Invalid plugin');
        }

        [$pluginFileName, $className] = \Typecho\Plugin::portal($pluginName, v3a_plugin_root_dir($options));
        $info = \Typecho\Plugin::parseInfo($pluginFileName);
        if (!\Typecho\Plugin::checkDependence($info['since'] ?? null)) {
            v3a_exit_json(400, null, 'Plugin version dependence not met');
        }

        $plugins = \Typecho\Plugin::export();
        $activatedPlugins = (array) ($plugins['activated'] ?? []);

        require_once $pluginFileName;

        if (isset($activatedPlugins[$pluginName]) || !class_exists($className) || !method_exists($className, 'activate')) {
            v3a_exit_json(400, null, 'Unable to activate plugin');
        }

        call_user_func([$className, 'activate']);
        \Typecho\Plugin::activate($pluginName);
        v3a_upsert_option(
            $db,
            'plugins',
            \Typecho\Plugin::export(),
            0
        );

        // Init config defaults
        try {
            if (method_exists($className, 'config')) {
                $form = new \Typecho\Widget\Helper\Form();
                call_user_func([$className, 'config'], $form);
                $vals = $form->getValues();
                if (!empty($vals)) {
                    $handled = false;
                    if (method_exists($className, 'configHandle')) {
                        call_user_func([$className, 'configHandle'], $vals, true);
                        $handled = true;
                    }
                    if (!$handled) {
                        \Widget\Plugins\Edit::configPlugin($pluginName, $vals, false);
                    }
                }
            }

            if (method_exists($className, 'personalConfig')) {
                $form = new \Typecho\Widget\Helper\Form();
                call_user_func([$className, 'personalConfig'], $form);
                $vals = $form->getValues();
                if (!empty($vals)) {
                    $handled = false;
                    if (method_exists($className, 'personalConfigHandle')) {
                        call_user_func([$className, 'personalConfigHandle'], $vals, true);
                        $handled = true;
                    }
                    if (!$handled) {
                        \Widget\Plugins\Edit::configPlugin($pluginName, $vals, true);
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        v3a_exit_json(0, ['activated' => 1]);
    }

    if ($do === 'plugins.deactivate') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $pluginName = v3a_string($payload['plugin'] ?? '', '');
        if ($pluginName === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $pluginName)) {
            v3a_exit_json(400, null, 'Invalid plugin');
        }

        $plugins = \Typecho\Plugin::export();
        $activatedPlugins = (array) ($plugins['activated'] ?? []);
        $pluginFileExist = true;
        $pluginFileName = '';
        $className = '';

        try {
            [$pluginFileName, $className] = \Typecho\Plugin::portal($pluginName, v3a_plugin_root_dir($options));
        } catch (\Throwable $e) {
            $pluginFileExist = false;
            if (!isset($activatedPlugins[$pluginName])) {
                throw $e;
            }
        }

        if (!isset($activatedPlugins[$pluginName])) {
            v3a_exit_json(400, null, 'Unable to deactivate plugin');
        }

        if ($pluginFileExist) {
            require_once $pluginFileName;
            if (!class_exists($className) || !method_exists($className, 'deactivate')) {
                v3a_exit_json(400, null, 'Unable to deactivate plugin');
            }
            call_user_func([$className, 'deactivate']);
        }

        \Typecho\Plugin::deactivate($pluginName);
        v3a_upsert_option(
            $db,
            'plugins',
            \Typecho\Plugin::export(),
            0
        );

        // Clear plugin options
        $db->query(
            $db->delete('table.options')->where('name = ? AND user = ?', 'plugin:' . $pluginName, 0),
            \Typecho\Db::WRITE
        );
        $db->query(
            $db->delete('table.options')->where('name = ? AND user = ?', '_plugin:' . $pluginName, 0),
            \Typecho\Db::WRITE
        );

        v3a_exit_json(0, ['deactivated' => 1]);
    }

    if ($do === 'plugins.config.get') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $pluginName = v3a_string($request->get('plugin', ''), '');
        if ($pluginName === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $pluginName)) {
            v3a_exit_json(400, null, 'Invalid plugin');
        }

        $plugins = \Typecho\Plugin::export();
        $activatedPlugins = (array) ($plugins['activated'] ?? []);
        if (!isset($activatedPlugins[$pluginName])) {
            v3a_exit_json(400, null, 'Plugin not activated');
        }

        [$pluginFileName, $className] = \Typecho\Plugin::portal($pluginName, v3a_plugin_root_dir($options));
        if (!file_exists($pluginFileName)) {
            v3a_exit_json(404, null, 'Plugin not found');
        }

        require_once $pluginFileName;
        if (!class_exists($className) || !method_exists($className, 'config')) {
            v3a_exit_json(0, ['plugin' => $pluginName, 'exists' => 0, 'fields' => []]);
        }

        $pluginOptions = [];
        try {
            $row = $db->fetchObject(
                $db->select('value')->from('table.options')->where('name = ? AND user = ?', 'plugin:' . $pluginName, 0)
            );
            $raw = is_object($row) ? (string) ($row->value ?? '') : '';
            $pluginOptions = v3a_decode_assoc_option($raw);
        } catch (\Throwable $e) {
        }

        $form = new \Typecho\Widget\Helper\Form();
        call_user_func([$className, 'config'], $form);
        $inputs = $form->getInputs();

        $fields = [];
        foreach ((array) $inputs as $name => $input) {
            if (!is_string($name) || $name === '' || !($input instanceof \Typecho\Widget\Helper\Form\Element)) {
                continue;
            }

            if (array_key_exists($name, $pluginOptions)) {
                $input->value($pluginOptions[$name]);
            }

            $type = 'text';
            if ($input instanceof \Typecho\Widget\Helper\Form\Element\Textarea) {
                $type = 'textarea';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Select) {
                $type = 'select';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Radio) {
                $type = 'radio';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Checkbox) {
                $type = 'checkbox';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Number) {
                $type = 'number';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Password) {
                $type = 'password';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Url) {
                $type = 'url';
            } elseif ($input instanceof \Typecho\Widget\Helper\Form\Element\Hidden) {
                $type = 'hidden';
            }

            $desc = '';
            try {
                foreach ((array) ($input->container ? $input->container->getItems() : []) as $item) {
                    if (!($item instanceof \Typecho\Widget\Helper\Layout)) {
                        continue;
                    }
                    $cls = (string) ($item->getAttribute('class') ?? '');
                    if ($item->getTagName() === 'p' && strpos($cls, 'description') !== false) {
                        $desc = v3a_layout_text($item);
                        break;
                    }
                }
            } catch (\Throwable $e) {
            }

            $optionsList = [];
            try {
                if ($type === 'select' && $input->input instanceof \Typecho\Widget\Helper\Layout) {
                    foreach ((array) $input->input->getItems() as $opt) {
                        if (!($opt instanceof \Typecho\Widget\Helper\Layout)) {
                            continue;
                        }
                        $optionsList[] = [
                            'value' => (string) ($opt->getAttribute('value') ?? ''),
                            'label' => v3a_layout_text($opt),
                        ];
                    }
                } elseif (($type === 'radio' || $type === 'checkbox') && $input->container) {
                    foreach ((array) $input->container->getItems() as $node) {
                        if (!($node instanceof \Typecho\Widget\Helper\Layout)) {
                            continue;
                        }
                        if ($node->getTagName() !== 'span') {
                            continue;
                        }
                        $sub = (array) $node->getItems();
                        $subInput = null;
                        $subLabel = null;
                        foreach ($sub as $subNode) {
                            if (!($subNode instanceof \Typecho\Widget\Helper\Layout)) {
                                continue;
                            }
                            if ($subNode->getTagName() === 'input') {
                                $subInput = $subNode;
                            } elseif ($subNode->getTagName() === 'label') {
                                $subLabel = $subNode;
                            }
                        }
                        if ($subInput) {
                            $optionsList[] = [
                                'value' => (string) ($subInput->getAttribute('value') ?? ''),
                                'label' => $subLabel ? v3a_layout_text($subLabel) : '',
                            ];
                        }
                    }
                }
            } catch (\Throwable $e) {
            }

            $fields[] = [
                'name' => $name,
                'type' => $type,
                'label' => v3a_layout_text($input->label),
                'description' => $desc,
                'options' => $optionsList,
                'value' => $input->value,
            ];
        }

        v3a_exit_json(0, [
            'plugin' => $pluginName,
            'exists' => 1,
            'fields' => $fields,
        ]);
    }

    if ($do === 'plugins.config.html') {
        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $pluginName = v3a_string($request->get('plugin', ''), '');
        if ($pluginName === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $pluginName)) {
            v3a_exit_json(400, null, 'Invalid plugin');
        }

        $plugins = \Typecho\Plugin::export();
        $activatedPlugins = (array) ($plugins['activated'] ?? []);
        if (!isset($activatedPlugins[$pluginName])) {
            v3a_exit_json(400, null, 'Plugin not activated');
        }

        [$pluginFileName, $className] = \Typecho\Plugin::portal(
            $pluginName,
            v3a_plugin_root_dir($options)
        );
        if (!file_exists($pluginFileName)) {
            v3a_exit_json(404, null, 'Plugin not found');
        }

        require_once $pluginFileName;
        if (!class_exists($className) || !method_exists($className, 'config')) {
            v3a_exit_json(0, ['plugin' => $pluginName, 'exists' => 0, 'html' => '']);
        }

        $origGet = $_GET;
        $html = '';
        try {
            $_GET['config'] = $pluginName;
            ob_start();
            \Widget\Plugins\Config::alloc()->config()->render();
            $html = (string) ob_get_clean();
        } catch (\Throwable $e) {
            if (ob_get_level()) {
                ob_end_clean();
            }
            $html = '<div class="message error"><ul><li>'
                . htmlspecialchars($e->getMessage(), ENT_QUOTES)
                . '</li></ul></div>';
        } finally {
            $_GET = $origGet;
        }

        v3a_exit_json(0, [
            'plugin' => $pluginName,
            'exists' => 1,
            'html' => $html,
        ]);
    }

    if ($do === 'plugins.config.save') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);

        if (!$user->pass('administrator', true)) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $pluginName = v3a_string($payload['plugin'] ?? '', '');
        if ($pluginName === '' || !preg_match("/^([_0-9a-z-. ])+$/i", $pluginName)) {
            v3a_exit_json(400, null, 'Invalid plugin');
        }

        $plugins = \Typecho\Plugin::export();
        $activatedPlugins = (array) ($plugins['activated'] ?? []);
        if (!isset($activatedPlugins[$pluginName])) {
            v3a_exit_json(400, null, 'Plugin not activated');
        }

        [$pluginFileName, $className] = \Typecho\Plugin::portal($pluginName, v3a_plugin_root_dir($options));
        if (!file_exists($pluginFileName)) {
            v3a_exit_json(404, null, 'Plugin not found');
        }

        require_once $pluginFileName;
        if (!class_exists($className) || !method_exists($className, 'config')) {
            v3a_exit_json(400, null, 'Plugin config not supported');
        }

        $values = isset($payload['values']) && is_array($payload['values']) ? $payload['values'] : [];

        $form = new \Typecho\Widget\Helper\Form();
        call_user_func([$className, 'config'], $form);
        $inputs = $form->getInputs();

        $settings = [];
        foreach ((array) $inputs as $name => $input) {
            if (!is_string($name) || $name === '') {
                continue;
            }
            if (!array_key_exists($name, $values)) {
                continue;
            }

            $v = $values[$name];
            if ($input instanceof \Typecho\Widget\Helper\Form\Element\Checkbox) {
                $settings[$name] = is_array($v) ? array_values($v) : (isset($v) ? [$v] : []);
            } else {
                $settings[$name] = $v;
            }
        }

        if (method_exists($className, 'configCheck')) {
            $result = call_user_func([$className, 'configCheck'], $settings);
            if (!empty($result) && is_string($result)) {
                v3a_exit_json(400, null, $result);
            }
        }

        $handled = false;
        if (method_exists($className, 'configHandle')) {
            call_user_func([$className, 'configHandle'], $settings, false);
            $handled = true;
        }

        if (!$handled) {
            \Widget\Plugins\Edit::configPlugin($pluginName, $settings, false);
        }

        v3a_exit_json(0, ['saved' => 1]);
    }

    if ($do === 'v3a.data.export') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        try {
            if (!class_exists('\\TypechoPlugin\\Vue3Admin\\LocalStorage')) {
                v3a_exit_json(500, null, 'LocalStorage not loaded');
            }

            $res = \TypechoPlugin\Vue3Admin\LocalStorage::exportZip((string) ($options->siteUrl ?? ''));
            v3a_exit_json(0, $res);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'v3a.data.import') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\LocalStorage')) {
            v3a_exit_json(500, null, 'LocalStorage not loaded');
        }

        if (empty($_FILES) || !isset($_FILES['file']) || !is_array($_FILES['file'])) {
            v3a_exit_json(400, null, 'Missing file');
        }

        $f = $_FILES['file'];
        $err = isset($f['error']) ? (int) $f['error'] : 0;
        if ($err !== UPLOAD_ERR_OK) {
            v3a_exit_json(400, null, 'Upload failed');
        }

        $tmp = isset($f['tmp_name']) ? (string) $f['tmp_name'] : '';
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            v3a_exit_json(400, null, 'Upload failed');
        }

        try {
            @set_time_limit(0);
            $res = \TypechoPlugin\Vue3Admin\LocalStorage::importZip($tmp);
            @unlink($tmp);
            v3a_exit_json(0, $res);
        } catch (\Throwable $e) {
            @unlink($tmp);
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'v3a.data.download') {
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        if (!class_exists('\\TypechoPlugin\\Vue3Admin\\LocalStorage')) {
            v3a_exit_json(500, null, 'LocalStorage not loaded');
        }

        $file = v3a_string($request->get('file', ''), '');
        $file = basename($file);
        if ($file === '' || !preg_match('/^[0-9a-zA-Z][0-9a-zA-Z._-]*\\.zip$/', $file)) {
            v3a_exit_json(400, null, 'Invalid file');
        }

        $path = \TypechoPlugin\Vue3Admin\LocalStorage::exportFilePath($file);
        if (!is_file($path)) {
            v3a_exit_json(404, null, 'Not Found');
        }

        if (ob_get_level()) {
            ob_clean();
        }

        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . addslashes($file) . '"');
        header('Content-Length: ' . (string) (@filesize($path) ?: 0));
        readfile($path);
        exit;
    }

    if ($do === 'v3a.legacy.maintain') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        try {
            if (!class_exists('\\TypechoPlugin\\Vue3Admin\\LocalStorage')) {
                v3a_exit_json(500, null, 'LocalStorage not loaded');
            }

            @set_time_limit(0);
            $res = \TypechoPlugin\Vue3Admin\LocalStorage::migrateLegacy($db, true);
            v3a_exit_json(0, $res);
        } catch (\Throwable $e) {
            v3a_exit_json(500, null, $e->getMessage());
        }
    }

    if ($do === 'backup.list') {
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $dir = defined('__TYPECHO_BACKUP_DIR__') ? (string) __TYPECHO_BACKUP_DIR__ : '';
        if ($dir === '') {
            v3a_exit_json(500, null, 'Backup dir not configured');
        }

        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $items = [];
        $pattern = rtrim($dir, "/\\") . '/*.dat';
        foreach ((array) glob($pattern) as $path) {
            if (!is_string($path) || $path === '') {
                continue;
            }

            $name = basename($path);
            if ($name === '') {
                continue;
            }

            $items[] = [
                'file' => $name,
                'size' => (int) (@filesize($path) ?: 0),
                'time' => (int) (@filemtime($path) ?: 0),
            ];
        }

        usort($items, static function ($a, $b) {
            $at = is_array($a) ? (int) ($a['time'] ?? 0) : 0;
            $bt = is_array($b) ? (int) ($b['time'] ?? 0) : 0;
            return $bt <=> $at;
        });

        v3a_exit_json(0, [
            'dir' => $dir,
            'items' => $items,
        ]);
    }

    if ($do === 'backup.export') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $dir = defined('__TYPECHO_BACKUP_DIR__') ? (string) __TYPECHO_BACKUP_DIR__ : '';
        if ($dir === '') {
            v3a_exit_json(500, null, 'Backup dir not configured');
        }

        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $host = '';
        try {
            $host = (string) parse_url((string) ($options->siteUrl ?? ''), PHP_URL_HOST);
        } catch (\Throwable $e) {
        }
        $host = strtolower(trim($host));
        $host = $host !== '' ? preg_replace('/[^0-9a-z._-]+/i', '_', $host) : 'site';

        $suffix = '';
        try {
            $suffix = bin2hex(random_bytes(4));
        } catch (\Throwable $e) {
            $suffix = uniqid();
        }

        $file = date('Ymd_His') . '_' . $host . '_' . $suffix . '.dat';
        $path = rtrim($dir, "/\\") . DIRECTORY_SEPARATOR . $file;

        @set_time_limit(0);
        v3a_backup_export_to_file($db, $options, $path);

        v3a_exit_json(0, [
            'file' => $file,
        ]);
    }

    if ($do === 'backup.delete') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $payload = v3a_payload();
        $file = v3a_string($payload['file'] ?? '', '');
        $file = basename($file);
        if ($file === '' || !preg_match('/^[0-9a-zA-Z][0-9a-zA-Z._-]*\\.dat$/', $file)) {
            v3a_exit_json(400, null, 'Invalid file');
        }

        $dir = defined('__TYPECHO_BACKUP_DIR__') ? (string) __TYPECHO_BACKUP_DIR__ : '';
        $path = rtrim($dir, "/\\") . DIRECTORY_SEPARATOR . $file;
        if (!is_file($path)) {
            v3a_exit_json(404, null, 'Not Found');
        }

        @unlink($path);
        v3a_exit_json(0, ['deleted' => 1]);
    }

    if ($do === 'backup.import') {
        if (!$request->isPost()) {
            v3a_exit_json(405, null, 'Method Not Allowed');
        }
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $path = '';
        $isUploaded = false;

        if (!empty($_FILES) && isset($_FILES['file']) && is_array($_FILES['file'])) {
            $f = $_FILES['file'];
            $err = isset($f['error']) ? (int) $f['error'] : 0;
            if ($err !== UPLOAD_ERR_OK) {
                v3a_exit_json(400, null, 'Upload failed');
            }

            $tmp = isset($f['tmp_name']) ? (string) $f['tmp_name'] : '';
            if ($tmp === '' || !is_uploaded_file($tmp)) {
                v3a_exit_json(400, null, 'Upload failed');
            }

            $path = $tmp;
            $isUploaded = true;
        } else {
            $payload = v3a_payload();
            $file = v3a_string($payload['file'] ?? '', '');
            $file = basename($file);
            if ($file === '' || !preg_match('/^[0-9a-zA-Z][0-9a-zA-Z._-]*\\.dat$/', $file)) {
                v3a_exit_json(400, null, 'Invalid file');
            }

            $dir = defined('__TYPECHO_BACKUP_DIR__') ? (string) __TYPECHO_BACKUP_DIR__ : '';
            $path = rtrim($dir, "/\\") . DIRECTORY_SEPARATOR . $file;
            if (!is_file($path)) {
                v3a_exit_json(404, null, 'Not Found');
            }
        }

        @set_time_limit(0);
        $result = v3a_backup_import_from_file($db, $options, $path);

        // Uploaded tmp file will be removed by PHP automatically, but we clean it anyway.
        if ($isUploaded) {
            @unlink($path);
        }

        v3a_exit_json(0, [
            'imported' => 1,
            'result' => $result,
        ]);
    }

    if ($do === 'backup.download') {
        v3a_security_protect($security, $request);
        v3a_require_role($user, 'administrator');

        $acl = v3a_acl_for_user($db, $user);
        if (empty($acl['maintenance']['manage'])) {
            v3a_exit_json(403, null, 'Forbidden');
        }

        $file = v3a_string($request->get('file', ''), '');
        $file = basename($file);
        if ($file === '' || !preg_match('/^[0-9a-zA-Z][0-9a-zA-Z._-]*\\.dat$/', $file)) {
            v3a_exit_json(400, null, 'Invalid file');
        }

        $dir = defined('__TYPECHO_BACKUP_DIR__') ? (string) __TYPECHO_BACKUP_DIR__ : '';
        $path = rtrim($dir, "/\\") . DIRECTORY_SEPARATOR . $file;
        if (!is_file($path)) {
            v3a_exit_json(404, null, 'Not Found');
        }

        if (ob_get_level()) {
            ob_clean();
        }

        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . addslashes($file) . '"');
        header('Content-Length: ' . (string) (@filesize($path) ?: 0));
        readfile($path);
        exit;
    }

    v3a_exit_json(404, null, 'Unknown action');
} catch (\Throwable $e) {
    v3a_exit_json(500, null, $e->getMessage());
}
