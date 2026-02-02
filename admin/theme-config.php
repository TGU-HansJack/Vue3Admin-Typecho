<?php

require_once __DIR__ . '/common.php';

header('Content-Type: text/html; charset=UTF-8');

// Make theme assets resolve to current host (port included) to avoid 404 when siteUrl is not the same as the panel URL.
try {
    $currentHost = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $configuredSiteUrl = (string) ($options->siteUrl ?? '');
    $siteHost = (string) (parse_url($configuredSiteUrl, PHP_URL_HOST) ?? '');
    $sitePort = (int) (parse_url($configuredSiteUrl, PHP_URL_PORT) ?? 0);
    $siteHostPort = $siteHost !== '' ? ($sitePort > 0 ? ($siteHost . ':' . $sitePort) : $siteHost) : '';

    if (
        $currentHost !== '' &&
        ($configuredSiteUrl === '' || $siteHostPort === '' || strcasecmp($currentHost, $siteHostPort) !== 0)
    ) {
        $prefix = (string) ($request->getUrlPrefix() ?? '');
        $rootUrl = (string) ($options->rootUrl ?? '/');
        if ($prefix !== '') {
            $options->siteUrl = rtrim($prefix, '/') . $rootUrl;
        }
    }
} catch (\Throwable $e) {
}

$theme = '';
try {
    $theme = (string) ($options->theme ?? '');
} catch (\Throwable $e) {
}

$title = '主题设置';
if ($theme !== '') {
    $title .= ' - ' . $theme;
}

?><!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="<?php echo htmlspecialchars((string) ($options->charset ?? 'utf-8'), ENT_QUOTES); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <base target="_blank">
    <title><?php echo htmlspecialchars($title, ENT_QUOTES); ?></title>

    <link rel="stylesheet" href="../admin/css/normalize.css">
    <link rel="stylesheet" href="../admin/css/grid.css">
    <link rel="stylesheet" href="../admin/css/style.css">

    <style>
        html, body { margin: 0; padding: 0; background: transparent; }
        body { padding: 16px; }
        .container { max-width: none; }
        .typecho-page-main { margin: 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="row typecho-page-main" role="main">
            <div class="col-mb-12" role="form">
                <?php
                try {
                    if (\Widget\Themes\Config::isExists()) {
                        \Widget\Themes\Config::alloc()->config()->render();
                    } else {
                        echo '<div class="message notice"><ul><li>当前主题没有提供可配置项。</li></ul></div>';
                    }
                } catch (\Throwable $e) {
                    http_response_code(500);
                    echo '<div class="message error"><ul><li>'
                        . htmlspecialchars($e->getMessage(), ENT_QUOTES)
                        . '</li></ul></div>';
                }
                ?>
            </div>
        </div>
    </div>

<script>
    // Ensure form submits stay in this iframe even when <base target="_blank"> is set.
    (function () {
        try {
            var forms = document.getElementsByTagName('form');
            for (var i = 0; i < forms.length; i++) {
                if (!forms[i].getAttribute('target')) {
                    forms[i].setAttribute('target', '_self');
                }
            }
        } catch (e) {}
    })();
</script>
</body>
</html>
