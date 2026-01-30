<?php

require_once __DIR__ . '/bootstrap.php';

if (!$user->hasLogin()) {
    $referer = $request->getRequestUri();
    $response->redirect(
        \Typecho\Common::url('login.php', $options->adminUrl) . '?referer=' . urlencode((string) $referer)
    );
    exit;
}

// 至少需要投稿权限
$user->pass('contributor');
