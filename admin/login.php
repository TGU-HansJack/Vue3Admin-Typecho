<?php

require_once __DIR__ . '/bootstrap.php';

if ($user->hasLogin()) {
    $response->redirect(\Typecho\Common::url('index.php', $options->adminUrl));
}

$rememberName = htmlspecialchars(\Typecho\Cookie::get('__typecho_remember_name', ''), ENT_QUOTES);
\Typecho\Cookie::delete('__typecho_remember_name');

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
    $assetCssVer = '1.2.4';
}

$faviconUrl = \Typecho\Common::url('favicon.ico', (string) ($options->siteUrl ?? ''));
$loginStyle = strtolower(trim((string) ($options->v3a_login_style ?? '')));
$allowedLoginStyles = ['vercel', 'github', 'apple'];
if (!in_array($loginStyle, $allowedLoginStyles, true)) {
    $loginStyle = '';
}
$loginStyleAttr = $loginStyle !== ''
    ? ' data-auth-style="' . htmlspecialchars($loginStyle, ENT_QUOTES) . '"'
    : '';
$loginBackground = trim((string) ($options->v3a_login_bg ?? ''));
if (
    $loginBackground !== ''
    && !preg_match('/^(https?:)?\/\//i', $loginBackground)
    && strpos($loginBackground, 'data:') !== 0
) {
    $loginBackground = \Typecho\Common::url(ltrim($loginBackground, '/'), (string) ($options->siteUrl ?? ''));
}
$hasLoginBackground = $loginBackground !== '';
$loginBackgroundCssUrl = json_encode($loginBackground, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
?>
<!doctype html>
<html lang="zh-CN"<?php echo $loginStyleAttr; ?> style="--color-primary: <?php echo htmlspecialchars($primaryColor, ENT_QUOTES); ?>; --color-primary-shallow: <?php echo htmlspecialchars($primaryShallow, ENT_QUOTES); ?>; --color-primary-deep: <?php echo htmlspecialchars($primaryDeep, ENT_QUOTES); ?>;">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>登录 - Vue3Admin</title>
    <link rel="icon" href="<?php echo htmlspecialchars($faviconUrl, ENT_QUOTES); ?>" />
    <link rel="stylesheet" href="<?php echo $options->adminUrl('assets/app.css'); ?>?v=<?php echo htmlspecialchars((string) $assetCssVer, ENT_QUOTES); ?>" />
    <?php if ($hasLoginBackground): ?>
        <style>
            .v3a-login-body.has-custom-bg {
                background:
                    linear-gradient(
                        var(--v3a-login-bg-overlay-from, rgba(23, 23, 23, 0.36)),
                        var(--v3a-login-bg-overlay-to, rgba(23, 23, 23, 0.2))
                    ),
                    url(<?php echo $loginBackgroundCssUrl; ?>) center / cover no-repeat fixed;
            }
        </style>
    <?php endif; ?>
</head>
<body class="v3a-login-body<?php echo $hasLoginBackground ? ' has-custom-bg' : ''; ?>">
<div class="v3a-login-card">
    <div class="v3a-login-brand">
        <div class="v3a-login-logo">
            <img src="<?php echo htmlspecialchars($faviconUrl, ENT_QUOTES); ?>" alt="<?php echo htmlspecialchars($options->title ?? 'Typecho', ENT_QUOTES); ?>" />
        </div>
        <div class="v3a-login-title"><?php echo htmlspecialchars($options->title ?? 'Typecho', ENT_QUOTES); ?></div>
        <div class="v3a-login-subtitle">Vue3Admin</div>
    </div>

    <form class="v3a-login-form" action="<?php echo $options->loginAction; ?>" method="post" name="login" role="form">
        <label class="v3a-field">
            <span>用户名或邮箱</span>
            <input type="text" name="name" value="<?php echo $rememberName; ?>" placeholder="用户名或邮箱" autofocus />
        </label>
        <label class="v3a-field">
            <span>密码</span>
            <input type="password" name="password" placeholder="密码" required />
        </label>
        <label class="v3a-remember">
            <input type="checkbox" name="remember" value="1" />
            <span>下次自动登录</span>
        </label>
        <input type="hidden" name="referer" value="<?php echo $request->filter('html')->get('referer'); ?>" />
        <div class="v3a-login-actions">
            <button class="v3a-login-btn" type="submit">登录</button>
            <?php if (!empty($options->allowRegister)): ?>
                <a class="v3a-login-btn secondary" href="<?php echo $options->registerUrl; ?>">注册</a>
            <?php endif; ?>
        </div>
    </form>

    <div class="v3a-login-footer">
        <a href="<?php echo $options->siteUrl; ?>">返回首页</a>
        <?php if (!empty($options->allowRegister)): ?>
            &bull;
            <a href="<?php echo $options->registerUrl; ?>">用户注册</a>
        <?php endif; ?>
    </div>
</div>
</body>
</html>
