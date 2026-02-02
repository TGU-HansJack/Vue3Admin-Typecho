<?php

require_once __DIR__ . '/common.php';

// Plugin config is admin-only.
if (!$user->pass('administrator', true)) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

header('Content-Type: text/html; charset=UTF-8');

// Make admin assets resolve to current host (port included) to avoid 404 when siteUrl is not the same as the panel URL.
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

$plugin = '';
try {
    $plugin = (string) ($request->get('config') ?? '');
} catch (\Throwable $e) {
}

$title = '插件设置';
if ($plugin !== '') {
    $title .= ' - ' . $plugin;
}

?><!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="<?php echo htmlspecialchars((string) ($options->charset ?? 'utf-8'), ENT_QUOTES); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <base target="_blank">
    <title><?php echo htmlspecialchars($title, ENT_QUOTES); ?></title>

    <link rel="stylesheet" href="<?php $options->adminStaticUrl('css', 'normalize.css'); ?>">
    <link rel="stylesheet" href="<?php $options->adminStaticUrl('css', 'grid.css'); ?>">
    <link rel="stylesheet" href="<?php $options->adminStaticUrl('css', 'style.css'); ?>">

    <style>
        :root {
            --color-primary: #171717;
            --color-primary-shallow: #404040;
            --radius-md: 0.375rem; /* 6px */
            --radius-lg: 0.5rem; /* 8px */
            --radius-xl: 0.75rem; /* 12px */
            --sidebar-border: #e5e5e5;
            --v3a-text: #171717;
            --v3a-muted: #737373;
            --v3a-danger: #d03050;
            --v3a-shadow: 0 1px 2px rgba(0, 0, 0, 0.04),
                0 0 0 1px rgba(0, 0, 0, 0.04);
            --v3a-focus: 0 0 0 4px rgba(0, 0, 0, 0.06);
        }

        * { box-sizing: border-box; }

        html, body { margin: 0; padding: 0; background: transparent; }
        body {
            padding: 16px;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
            font-size: 13px;
            line-height: 1.7;
            color: var(--v3a-text);
        }

        a {
            color: var(--color-primary);
            text-decoration: underline;
            text-decoration-thickness: from-font;
            text-underline-offset: 2px;
        }

        a:hover { color: var(--color-primary-shallow); }

        code, pre, .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
                "Courier New", monospace;
        }

        pre {
            padding: 10px;
            border: 1px solid var(--sidebar-border);
            border-radius: var(--radius-md);
            background: rgba(0, 0, 0, 0.02);
            overflow: auto;
        }

        .container { max-width: none; }
        .main .body { padding: 0; }
        .typecho-page-main { margin: 0; }

        .typecho-option {
            list-style: none;
            margin: 0 0 12px;
            padding: 0;
            border: 1px solid var(--sidebar-border);
            border-radius: var(--radius-xl);
            background: rgba(255, 255, 255, 0.92);
            box-shadow: var(--v3a-shadow);
        }

        .typecho-option > li { padding: 14px 16px; }

        .typecho-label {
            display: block;
            margin: 0 0 10px;
            font-size: 13px;
            font-weight: 600;
            color: var(--v3a-text);
        }

        .description {
            margin: 8px 0 0;
            font-size: 12px;
            line-height: 1.6;
            color: var(--v3a-muted);
        }

        input[type="text"],
        input[type="url"],
        input[type="password"],
        input[type="email"],
        input[type="number"],
        select,
        textarea {
            width: 100%;
            border: 1px solid var(--sidebar-border);
            border-radius: var(--radius-md);
            outline: none;
            background: #fff;
            color: rgba(0, 0, 0, 0.82);
            font-size: 13px;
        }

        input[type="text"],
        input[type="url"],
        input[type="password"],
        input[type="email"],
        input[type="number"],
        select {
            height: 34px;
            padding: 0 10px;
        }

        textarea {
            min-height: 120px;
            padding: 10px;
            line-height: 1.7;
            resize: vertical;
        }

        input[type="text"]:focus,
        input[type="url"]:focus,
        input[type="password"]:focus,
        input[type="email"]:focus,
        input[type="number"]:focus,
        select:focus,
        textarea:focus {
            border-color: rgba(0, 0, 0, 0.25);
            box-shadow: var(--v3a-focus);
        }

        select {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            background-image:
                linear-gradient(45deg, transparent 50%, rgba(0, 0, 0, 0.55) 50%),
                linear-gradient(135deg, rgba(0, 0, 0, 0.55) 50%, transparent 50%);
            background-position: calc(100% - 16px) calc(50% - 3px),
                calc(100% - 11px) calc(50% - 3px);
            background-size: 5px 5px, 5px 5px;
            background-repeat: no-repeat;
            padding-right: 28px;
        }

        input[type="radio"], input[type="checkbox"] { margin-right: 6px; }

        button,
        .btn,
        input[type="button"],
        input[type="submit"] {
            height: 34px;
            padding: 0 12px;
            border: 1px solid var(--sidebar-border);
            border-radius: var(--radius-md);
            background: #fff;
            color: var(--v3a-text);
            cursor: pointer;
            font-size: 13px;
            line-height: 1;
        }

        button:hover,
        .btn:hover,
        input[type="button"]:hover,
        input[type="submit"]:hover {
            background: rgba(0, 0, 0, 0.04);
        }

        button:active,
        .btn:active,
        input[type="button"]:active,
        input[type="submit"]:active {
            background: rgba(0, 0, 0, 0.06);
        }

        .primary {
            border-color: var(--color-primary);
            background: var(--color-primary);
            color: #fff;
        }

        .primary:hover {
            border-color: var(--color-primary-shallow);
            background: var(--color-primary-shallow);
        }

        .btn-warn {
            border-color: var(--v3a-danger);
            background: var(--v3a-danger);
            color: #fff;
        }

        .btn-warn:hover {
            border-color: #b72844;
            background: #b72844;
        }

        .typecho-option.typecho-option-submit {
            border: 0;
            background: transparent;
            box-shadow: none;
        }

        .typecho-option.typecho-option-submit > li {
            padding: 0;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .message {
            padding: 10px 12px;
            border-radius: var(--radius-lg);
            border: 1px solid var(--sidebar-border);
            background: rgba(255, 255, 255, 0.92);
            box-shadow: var(--v3a-shadow);
        }

        .message ul { margin: 0; padding-left: 18px; }

        .message.error {
            border-color: rgba(208, 48, 80, 0.25);
            background: rgba(208, 48, 80, 0.08);
            color: #8a1f11;
        }

        .message.notice {
            border-color: rgba(240, 160, 32, 0.25);
            background: rgba(240, 160, 32, 0.08);
            color: #8a6d3b;
        }

        .message.success {
            border-color: rgba(24, 160, 88, 0.25);
            background: rgba(24, 160, 88, 0.08);
            color: #264409;
        }

        /* Keep Typecho width utility classes working after overrides */
        .w-10 { width: 10%; }
        .w-20 { width: 20%; }
        .w-30 { width: 30%; }
        .w-40 { width: 40%; }
        .w-50 { width: 50%; }
        .w-60 { width: 60%; }
        .w-70 { width: 70%; }
        .w-80 { width: 80%; }
        .w-90 { width: 90%; }
        .w-100 { width: 100%; }
    </style>
</head>
<body>
    <main class="main">
        <div class="body container">
            <div class="row typecho-page-main" role="form">
                <div class="col-mb-12" role="form">
                    <?php
                    try {
                        if ($plugin === '') {
                            echo '<div class="message notice"><ul><li>缺少插件参数。</li></ul></div>';
                        } else {
                            \Widget\Plugins\Config::alloc()->config()->render();
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
    </main>

    <?php
    try {
        include __TYPECHO_ROOT_DIR__ . '/admin/common-js.php';
        include __TYPECHO_ROOT_DIR__ . '/admin/form-js.php';
    } catch (\Throwable $e) {
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
