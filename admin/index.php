<?php

require_once __DIR__ . '/common.php';

$pluginOptions = null;
try {
    $pluginOptions = $options->plugin('Vue3Admin');
} catch (\Throwable $e) {
}

$primaryColor = $pluginOptions->primaryColor ?? '#171717';
$primaryShallow = $primaryColor;
$primaryDeep = $primaryColor;

if (is_string($primaryColor)) {
    $hex = trim($primaryColor);
    if (preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $hex)) {
        $hexValue = substr($hex, 1);
        if (strlen($hexValue) === 3) {
            $hexValue = $hexValue[0] . $hexValue[0] . $hexValue[1] . $hexValue[1] . $hexValue[2] . $hexValue[2];
        }

        $r = hexdec(substr($hexValue, 0, 2));
        $g = hexdec(substr($hexValue, 2, 2));
        $b = hexdec(substr($hexValue, 4, 2));

        $mixToWhite = function (int $v, float $t): int {
            $vv = (int) round($v + (255 - $v) * $t);
            return max(0, min(255, $vv));
        };

        // Match mx-admin default: shallow ~18%, deep ~25%
        $rs = $mixToWhite($r, 0.18);
        $gs = $mixToWhite($g, 0.18);
        $bs = $mixToWhite($b, 0.18);
        $rd = $mixToWhite($r, 0.25);
        $gd = $mixToWhite($g, 0.25);
        $bd = $mixToWhite($b, 0.25);

        $primaryShallow = sprintf('#%02x%02x%02x', $rs, $gs, $bs);
        $primaryDeep = sprintf('#%02x%02x%02x', $rd, $gd, $bd);
    }
}

$vueCdn = $pluginOptions->vueCdn ?? 'https://unpkg.com/vue@3/dist/vue.global.prod.js';
$echartsCdn = $pluginOptions->echartsCdn ?? 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
$vditorCdn = $pluginOptions->vditorCdn ?? 'https://cdn.jsdelivr.net/npm/vditor@3.11.2/dist/index.min.js';
$vditorCssCdn = $pluginOptions->vditorCssCdn ?? 'https://cdn.jsdelivr.net/npm/vditor@3.11.2/dist/index.css';
$vditorCdnBase = $pluginOptions->vditorCdnBase ?? 'https://cdn.jsdelivr.net/npm/vditor@3.11.2';

$assetCssVer = @filemtime(__DIR__ . '/assets/app.css');
if ($assetCssVer === false) {
    $assetCssVer = '1.2.1';
}

$assetJsVer = @filemtime(__DIR__ . '/assets/app.js');
if ($assetJsVer === false) {
    $assetJsVer = '1.2.1';
}

$routingTable = [];
try {
    $routingTable = (array) ($options->routingTable ?? []);
} catch (\Throwable $e) {
}

$postPermalinkRule = '';
try {
    $postPermalinkRule = (string) ($routingTable['post']['url'] ?? '');
} catch (\Throwable $e) {
}

$indexUrl = '';
try {
    $indexUrl = (string) ($options->index ?? '');
} catch (\Throwable $e) {
}

$acl = [];
try {
    $db = \Typecho\Db::get();
    $row = $db->fetchObject(
        $db->select('value')
            ->from('table.options')
            ->where('name = ? AND user = ?', 'v3a_acl_config', 0)
            ->limit(1)
    );
    $raw = trim((string) ($row->value ?? ''));
    if ($raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && isset($decoded['groups']) && is_array($decoded['groups'])) {
            $g = strtolower((string) ($user->group ?? 'subscriber'));
            if (isset($decoded['groups'][$g]) && is_array($decoded['groups'][$g])) {
                $acl = $decoded['groups'][$g];
            }
        }
    }
} catch (\Throwable $e) {
}

$extraPanels = [];
try {
    $panelTable = (array) ($options->panelTable ?? []);
    $children = (array) ($panelTable['child'] ?? []);
    $seen = [];

    foreach ($children as $index => $items) {
        if (!is_array($items)) {
            continue;
        }

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $url = trim((string) ($item[2] ?? ''));
            if ($url === '' || strpos($url, 'extending.php?panel=') !== 0) {
                continue;
            }

            $hidden = !empty($item[4] ?? false);
            if ($hidden) {
                continue;
            }

            $title = trim((string) ($item[0] ?? ''));
            $access = strtolower(trim((string) ($item[3] ?? 'administrator')));
            if ($access !== '' && !$user->pass($access, true)) {
                continue;
            }

            $panelEncoded = substr($url, strlen('extending.php?panel='));
            $panel = $panelEncoded !== '' ? urldecode($panelEncoded) : '';
            if ($panel === '' || strpos($panel, '..') !== false) {
                continue;
            }

            if (isset($seen[$panel])) {
                continue;
            }
            $seen[$panel] = true;

            $extraPanels[] = [
                'title' => $title !== '' ? $title : $panel,
                'panel' => $panel,
                'access' => $access !== '' ? $access : 'administrator',
            ];
        }
    }
} catch (\Throwable $e) {
}

$shouTuTaEnabled = false;
try {
    $plugins = \Typecho\Plugin::export();
    $activated = (array) ($plugins['activated'] ?? []);
    $shouTuTaEnabled = isset($activated['ShouTuTa']);
} catch (\Throwable $e) {
}
?>
<!doctype html>
<html lang="zh-CN" style="--color-primary: <?php echo htmlspecialchars($primaryColor, ENT_QUOTES); ?>; --color-primary-shallow: <?php echo htmlspecialchars($primaryShallow, ENT_QUOTES); ?>; --color-primary-deep: <?php echo htmlspecialchars($primaryDeep, ENT_QUOTES); ?>;">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Vue3Admin - <?php echo htmlspecialchars($options->title ?? 'Typecho', ENT_QUOTES); ?></title>
    <link rel="stylesheet" href="<?php echo htmlspecialchars($vditorCssCdn, ENT_QUOTES); ?>" />
    <link rel="stylesheet" href="<?php echo $options->adminUrl('assets/app.css'); ?>?v=<?php echo htmlspecialchars((string) $assetCssVer, ENT_QUOTES); ?>" />
    <script>
        window.V3A = {
            version: "1.2.1",
            adminUrl: <?php echo json_encode($options->adminUrl, JSON_UNESCAPED_SLASHES); ?>,
            apiUrl: <?php echo json_encode($options->adminUrl('api.php', true), JSON_UNESCAPED_SLASHES); ?>,
            csrfParam: "_",
            csrfToken: <?php echo json_encode($security->getToken($request->getRequestUrl()), JSON_UNESCAPED_SLASHES); ?>,
            csrfRef: <?php echo json_encode($request->getRequestUrl(), JSON_UNESCAPED_SLASHES); ?>,
            uploadUrl: <?php echo json_encode($security->getIndex('/action/upload'), JSON_UNESCAPED_SLASHES); ?>,
            siteUrl: <?php echo json_encode($options->siteUrl, JSON_UNESCAPED_SLASHES); ?>,
            timezone: <?php echo (int) ($options->timezone ?? 28800); ?>,
            indexUrl: <?php echo json_encode($indexUrl, JSON_UNESCAPED_SLASHES); ?>,
            permalink: {
                postUrl: <?php echo json_encode($postPermalinkRule, JSON_UNESCAPED_SLASHES); ?>
            },
            vditor: {
                cdn: <?php echo json_encode($vditorCdnBase, JSON_UNESCAPED_SLASHES); ?>
            },
            logoutUrl: <?php echo json_encode($options->logoutUrl, JSON_UNESCAPED_SLASHES); ?>,
            canPublish: <?php echo $user->pass('editor', true) ? 'true' : 'false'; ?>,
            markdownEnabled: <?php echo !empty($options->markdown) ? 'true' : 'false'; ?>,
            acl: <?php echo json_encode($acl, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>,
            extras: {
                panels: <?php echo json_encode($extraPanels, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>,
                shouTuTaEnabled: <?php echo $shouTuTaEnabled ? 'true' : 'false'; ?>
            },
            user: {
                uid: <?php echo (int) ($user->uid ?? 0); ?>,
                name: <?php echo json_encode($user->screenName ?? ''); ?>,
                group: <?php echo json_encode((string) ($user->group ?? ''), JSON_UNESCAPED_SLASHES); ?>
            }
        };
    </script>
</head>
<body class="v3a-body">
<div id="app"></div>

<script src="<?php echo htmlspecialchars($vueCdn, ENT_QUOTES); ?>"></script>
<script src="<?php echo htmlspecialchars($echartsCdn, ENT_QUOTES); ?>"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2/dist/echarts-wordcloud.min.js"></script>
<script src="<?php echo htmlspecialchars($vditorCdn, ENT_QUOTES); ?>"></script>
<script src="<?php echo $options->adminUrl('assets/app.js'); ?>?v=<?php echo htmlspecialchars((string) $assetJsVer, ENT_QUOTES); ?>"></script>
</body>
</html>
