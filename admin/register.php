<?php

require_once __DIR__ . '/bootstrap.php';

if ($user->hasLogin()) {
    $response->redirect(\Typecho\Common::url('index.php', $options->adminUrl));
}

if (empty($options->allowRegister)) {
    $response->redirect($options->siteUrl);
}

$rememberName = htmlspecialchars(\Typecho\Cookie::get('__typecho_remember_name', ''), ENT_QUOTES);
$rememberMail = htmlspecialchars(\Typecho\Cookie::get('__typecho_remember_mail', ''), ENT_QUOTES);
\Typecho\Cookie::delete('__typecho_remember_name');
\Typecho\Cookie::delete('__typecho_remember_mail');

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

$assetCssVer = @filemtime(__DIR__ . '/assets/app.css');
if ($assetCssVer === false) {
    $assetCssVer = '1.0.0';
}
?>
<!doctype html>
<html lang="zh-CN" style="--color-primary: <?php echo htmlspecialchars($primaryColor, ENT_QUOTES); ?>; --color-primary-shallow: <?php echo htmlspecialchars($primaryShallow, ENT_QUOTES); ?>; --color-primary-deep: <?php echo htmlspecialchars($primaryDeep, ENT_QUOTES); ?>;">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>注册 - Vue3Admin</title>
    <link rel="stylesheet" href="<?php echo $options->adminUrl('assets/app.css'); ?>?v=<?php echo htmlspecialchars((string) $assetCssVer, ENT_QUOTES); ?>" />
</head>
<body class="v3a-login-body">
<div class="v3a-login-card">
    <div class="v3a-login-brand">
        <div class="v3a-login-logo">V3A</div>
        <div class="v3a-login-title">Vue3Admin</div>
        <div class="v3a-login-subtitle"><?php echo htmlspecialchars($options->title ?? 'Typecho', ENT_QUOTES); ?></div>
    </div>

    <form class="v3a-login-form" action="<?php echo $options->registerAction; ?>" method="post" name="register" role="form">
        <label class="v3a-field">
            <span>用户名</span>
            <input type="text" name="name" value="<?php echo $rememberName; ?>" placeholder="用户名" autofocus required />
        </label>
        <label class="v3a-field">
            <span>Email</span>
            <input type="email" name="mail" value="<?php echo $rememberMail; ?>" placeholder="Email" required />
        </label>
        <button class="v3a-login-btn" type="submit">注册</button>
    </form>

    <div class="v3a-login-footer">
        <a href="<?php echo $options->siteUrl; ?>">返回首页</a>
        &bull;
        <a href="<?php echo $options->loginUrl; ?>">用户登录</a>
    </div>
</div>
</body>
</html>
