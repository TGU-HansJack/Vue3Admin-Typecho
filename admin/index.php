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

$assetCssVer = @filemtime(__DIR__ . '/assets/app.css');
if ($assetCssVer === false) {
    $assetCssVer = '1.0.0';
}

$assetJsVer = @filemtime(__DIR__ . '/assets/app.js');
if ($assetJsVer === false) {
    $assetJsVer = '1.0.0';
}
?>
<!doctype html>
<html lang="zh-CN" style="--color-primary: <?php echo htmlspecialchars($primaryColor, ENT_QUOTES); ?>; --color-primary-shallow: <?php echo htmlspecialchars($primaryShallow, ENT_QUOTES); ?>; --color-primary-deep: <?php echo htmlspecialchars($primaryDeep, ENT_QUOTES); ?>;">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Vue3Admin - <?php echo htmlspecialchars($options->title ?? 'Typecho', ENT_QUOTES); ?></title>
    <link rel="stylesheet" href="<?php echo $options->adminUrl('assets/app.css'); ?>?v=<?php echo htmlspecialchars((string) $assetCssVer, ENT_QUOTES); ?>" />
    <script>
        window.V3A = {
            version: "1.0.0",
            adminUrl: <?php echo json_encode($options->adminUrl, JSON_UNESCAPED_SLASHES); ?>,
            apiUrl: <?php echo json_encode($options->adminUrl('api.php', true), JSON_UNESCAPED_SLASHES); ?>,
            csrfParam: "_",
            csrfToken: <?php echo json_encode($security->getToken($request->getRequestUrl()), JSON_UNESCAPED_SLASHES); ?>,
            uploadUrl: <?php echo json_encode($security->getIndex('/action/upload'), JSON_UNESCAPED_SLASHES); ?>,
            siteUrl: <?php echo json_encode($options->siteUrl, JSON_UNESCAPED_SLASHES); ?>,
            logoutUrl: <?php echo json_encode($options->logoutUrl, JSON_UNESCAPED_SLASHES); ?>,
            canPublish: <?php echo $user->pass('editor', true) ? 'true' : 'false'; ?>,
            markdownEnabled: <?php echo !empty($options->markdown) ? 'true' : 'false'; ?>,
            user: {
                uid: <?php echo (int) ($user->uid ?? 0); ?>,
                name: <?php echo json_encode($user->screenName ?? ''); ?>
            }
        };
    </script>
</head>
<body class="v3a-body">
<div id="app"></div>

<script src="<?php echo htmlspecialchars($vueCdn, ENT_QUOTES); ?>"></script>
<script src="<?php echo htmlspecialchars($echartsCdn, ENT_QUOTES); ?>"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2/dist/echarts-wordcloud.min.js"></script>
<script src="<?php echo $options->adminUrl('assets/app.js'); ?>?v=<?php echo htmlspecialchars((string) $assetJsVer, ENT_QUOTES); ?>"></script>
</body>
</html>
