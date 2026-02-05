<?php

require_once __DIR__ . '/common.php';

@header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (session_status() !== PHP_SESSION_ACTIVE) {
    @session_start();
}

function v3a_github_oauth_html(string $title, string $message, bool $ok = false): void
{
    $titleEsc = htmlspecialchars($title, ENT_QUOTES);
    $msgEsc = htmlspecialchars($message, ENT_QUOTES);
    $payload = json_encode(
        [
            'source' => 'v3a-github-oauth',
            'ok' => $ok ? 1 : 0,
            'message' => $message,
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    if (!is_string($payload) || $payload === '') {
        $payload = '{"source":"v3a-github-oauth","ok":0,"message":"Unknown"}';
    }

    echo '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />';
    echo '<meta name="viewport" content="width=device-width,initial-scale=1" />';
    echo '<title>' . $titleEsc . '</title>';
    echo '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.6;padding:20px;background:#f5f5f5;color:#171717}';
    echo '.card{max-width:680px;margin:40px auto;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:18px 20px}';
    echo '.title{font-size:16px;font-weight:700;margin:0 0 8px}.muted{color:#737373;font-size:13px}';
    echo '.btn{display:inline-block;margin-top:12px;padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#171717;text-decoration:none}</style>';
    echo '</head><body><div class="card">';
    echo '<div class="title">' . $titleEsc . '</div>';
    echo '<div class="muted">' . $msgEsc . '</div>';
    echo '<a class="btn" href="javascript:window.close();">关闭窗口</a>';
    echo '</div>';
    echo '<script>(function(){try{if(window.opener){window.opener.postMessage(' . $payload . ',\"*\");}}catch(e){}';
    echo 'try{window.close();}catch(e){}';
    echo '})();</script>';
    echo '</body></html>';
}

function v3a_github_http_post_form(string $url, array $data, array $headers = [], int $timeout = 10): array
{
    $timeout = max(3, min(30, (int) $timeout));
    $body = http_build_query($data, '', '&', PHP_QUERY_RFC3986);

    $headerLines = [];
    foreach ($headers as $k => $v) {
        $k = trim((string) $k);
        if ($k === '') {
            continue;
        }
        $headerLines[] = $k . ': ' . trim((string) $v);
    }
    $headerLines[] = 'Content-Type: application/x-www-form-urlencoded';

    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headerLines);
        $resBody = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = (string) curl_error($ch);
        curl_close($ch);

        if (!is_string($resBody)) {
            throw new \RuntimeException('HTTP request failed');
        }
        if ($status >= 400) {
            throw new \RuntimeException('HTTP ' . $status . ($err !== '' ? (': ' . $err) : ''));
        }
        return ['status' => $status, 'body' => $resBody];
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'timeout' => $timeout,
            'header' => implode("\r\n", $headerLines),
            'content' => $body,
        ],
    ]);
    $resBody = @file_get_contents($url, false, $ctx);
    if (!is_string($resBody)) {
        throw new \RuntimeException('HTTP request failed');
    }
    return ['status' => 200, 'body' => $resBody];
}

function v3a_github_http_get_json(string $url, array $headers = [], int $timeout = 10): array
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
        $resBody = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = (string) curl_error($ch);
        curl_close($ch);

        if (!is_string($resBody)) {
            throw new \RuntimeException('HTTP request failed');
        }
        if ($status >= 400) {
            throw new \RuntimeException('HTTP ' . $status . ($err !== '' ? (': ' . $err) : ''));
        }

        $decoded = json_decode($resBody, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('Invalid JSON response');
        }
        return $decoded;
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => $timeout,
            'header' => implode("\r\n", $headerLines),
        ],
    ]);
    $resBody = @file_get_contents($url, false, $ctx);
    if (!is_string($resBody)) {
        throw new \RuntimeException('HTTP request failed');
    }

    $decoded = json_decode($resBody, true);
    if (!is_array($decoded)) {
        throw new \RuntimeException('Invalid JSON response');
    }
    return $decoded;
}

function v3a_upsert_option($db, string $name, $value, int $user = 0): void
{
    $exists = 0;
    try {
        $exists = (int) ($db->fetchObject(
            $db->select(['COUNT(*)' => 'num'])->from('table.options')->where('name = ? AND user = ?', $name, $user)
        )->num ?? 0);
    } catch (\Throwable $e) {
        $exists = 0;
    }

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

$pluginOptions = null;
try {
    $pluginOptions = $options->plugin('Vue3Admin');
} catch (\Throwable $e) {
}

$clientId = trim((string) ($pluginOptions->githubClientId ?? ''));
$clientSecret = trim((string) ($pluginOptions->githubClientSecret ?? ''));

if ($clientId === '' || $clientSecret === '') {
    v3a_github_oauth_html('GitHub 登录不可用', '请先在 Vue3Admin 插件设置中填写 GitHub OAuth Client ID/Secret。', false);
    exit;
}

$mode = strtolower(trim((string) ($request->get('mode') ?? '')));

if ($mode === 'callback') {
    $code = trim((string) ($request->get('code') ?? ''));
    $state = trim((string) ($request->get('state') ?? ''));

    $sessState = (string) ($_SESSION['v3a_github_oauth_state'] ?? '');
    $sessUid = (int) ($_SESSION['v3a_github_oauth_uid'] ?? 0);
    $sessTs = (int) ($_SESSION['v3a_github_oauth_ts'] ?? 0);

    unset($_SESSION['v3a_github_oauth_state'], $_SESSION['v3a_github_oauth_uid'], $_SESSION['v3a_github_oauth_ts']);

    if ($code === '' || $state === '') {
        v3a_github_oauth_html('GitHub 登录失败', '缺少回调参数，请重试。', false);
        exit;
    }
    if ($sessState === '' || !hash_equals($sessState, $state)) {
        v3a_github_oauth_html('GitHub 登录失败', 'State 校验失败，请重试。', false);
        exit;
    }
    if ($sessUid <= 0 || $sessUid !== (int) ($user->uid ?? 0)) {
        v3a_github_oauth_html('GitHub 登录失败', '用户校验失败，请重试。', false);
        exit;
    }
    if ($sessTs <= 0 || (time() - $sessTs) > 900) {
        v3a_github_oauth_html('GitHub 登录失败', '登录已超时，请重试。', false);
        exit;
    }

    $redirectUri = $options->adminUrl('github-oauth.php', true) . '?mode=callback';
    try {
        $tokenRes = v3a_github_http_post_form(
            'https://github.com/login/oauth/access_token',
            [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'code' => $code,
                'redirect_uri' => $redirectUri,
                'state' => $state,
            ],
            ['Accept' => 'application/json', 'User-Agent' => 'Vue3Admin']
        );

        $tokenJson = json_decode((string) ($tokenRes['body'] ?? ''), true);
        if (!is_array($tokenJson)) {
            throw new \RuntimeException('Invalid token response');
        }
        $accessToken = trim((string) ($tokenJson['access_token'] ?? ''));
        if ($accessToken === '') {
            throw new \RuntimeException('Missing access_token');
        }

        $userJson = v3a_github_http_get_json(
            'https://api.github.com/user',
            [
                'Accept' => 'application/vnd.github+json',
                'User-Agent' => 'Vue3Admin',
                'Authorization' => 'Bearer ' . $accessToken,
            ],
            10
        );

        $login = trim((string) ($userJson['login'] ?? ''));
        $id = (int) ($userJson['id'] ?? 0);
        $avatar = trim((string) ($userJson['avatar_url'] ?? ''));
        $html = trim((string) ($userJson['html_url'] ?? ''));

        if ($login === '' || $id <= 0) {
            throw new \RuntimeException('Invalid user profile');
        }

        $stored = [
            'login' => $login,
            'id' => $id,
            'avatar_url' => $avatar,
            'html_url' => $html,
            'updatedAt' => time(),
        ];
        $encoded = json_encode($stored, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || $encoded === '') {
            throw new \RuntimeException('Encode failed');
        }

        $db = \Typecho\Db::get();
        v3a_upsert_option($db, 'v3a_github_user', $encoded, (int) ($user->uid ?? 0));
    } catch (\Throwable $e) {
        v3a_github_oauth_html('GitHub 登录失败', $e->getMessage() !== '' ? $e->getMessage() : '请求失败，请重试。', false);
        exit;
    }

    v3a_github_oauth_html('GitHub 登录成功', '已绑定 GitHub 账号：@' . $login . '。现在可回到创意工坊继续提交。', true);
    exit;
}

// Start OAuth flow
$state = '';
try {
    $state = bin2hex(random_bytes(16));
} catch (\Throwable $e) {
    $state = (string) md5(uniqid('v3a', true));
}

$_SESSION['v3a_github_oauth_state'] = $state;
$_SESSION['v3a_github_oauth_uid'] = (int) ($user->uid ?? 0);
$_SESSION['v3a_github_oauth_ts'] = time();

$redirectUri = $options->adminUrl('github-oauth.php', true) . '?mode=callback';
$auth = 'https://github.com/login/oauth/authorize?' . http_build_query(
    [
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'scope' => 'read:user',
        'state' => $state,
    ],
    '',
    '&',
    PHP_QUERY_RFC3986
);

$response->redirect($auth);
exit;

