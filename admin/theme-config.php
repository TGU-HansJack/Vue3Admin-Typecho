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

$title = 'Theme Settings';
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

    <style>
        html, body { margin: 0; padding: 0; background: transparent; }
    </style>
</head>
<body>
<?php
try {
    if (\Widget\Themes\Config::isExists()) {
        \Widget\Themes\Config::alloc()->config()->render();
    } else {
        echo '<div style="padding:12px 0;color:#737373;">This theme does not provide configurable options.</div>';
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo '<div style="padding:12px 0;color:#d03050;">'
        . htmlspecialchars($e->getMessage(), ENT_QUOTES)
        . '</div>';
}
?>

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
