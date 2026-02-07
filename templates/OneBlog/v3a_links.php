<?php
/**
 * 友情链接（v3a面板）
 *
 * @package custom
 */

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

$noticeType = '';
$noticeMessage = '';

$export = \Typecho\Plugin::export();
$v3aEnabled = isset($export['activated']['Vue3Admin']);

$request = $this->request;
$response = $this->response;
$security = \Helper::security();
$csrfRef = (string) $request->getRequestUrl();

/**
 * @param mixed $value
 */
function v3a_links_str($value, int $max = 255): string
{
    $s = trim((string) $value);
    if ($s === '') {
        return '';
    }

    if (function_exists('mb_substr')) {
        return (string) mb_substr($s, 0, $max);
    }

    return substr($s, 0, $max);
}

$applySettings = [
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

try {
    $raw = (string) ($this->options->v3a_friend_apply_settings ?? '');
    if (trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $applySettings['allowTypeSelect'] = !empty($decoded['allowTypeSelect']) ? 1 : 0;

            $allowed = is_array($decoded['allowedTypes'] ?? null) ? $decoded['allowedTypes'] : [];
            $applySettings['allowedTypes']['friend'] = !empty($allowed['friend']) ? 1 : 0;
            $applySettings['allowedTypes']['collection'] = !empty($allowed['collection']) ? 1 : 0;
            if (empty($applySettings['allowedTypes']['friend']) && empty($applySettings['allowedTypes']['collection'])) {
                $applySettings['allowedTypes']['friend'] = 1;
            }

            $dt = strtolower(trim((string) ($decoded['defaultType'] ?? 'friend')));
            if (!in_array($dt, ['friend', 'collection'], true)) {
                $dt = 'friend';
            }
            if (empty($applySettings['allowedTypes'][$dt])) {
                $dt = !empty($applySettings['allowedTypes']['friend']) ? 'friend' : 'collection';
            }
            $applySettings['defaultType'] = $dt;

            $req = is_array($decoded['required'] ?? null) ? $decoded['required'] : [];
            $applySettings['required']['email'] = !empty($req['email']) ? 1 : 0;
            $applySettings['required']['avatar'] = !empty($req['avatar']) ? 1 : 0;
            $applySettings['required']['description'] = !empty($req['description']) ? 1 : 0;
            $applySettings['required']['message'] = !empty($req['message']) ? 1 : 0;
        }
    }
} catch (\Throwable $e) {
}

$links = [];

try {
    if ($v3aEnabled) {
        $pdo = null;
        try {
            if (class_exists('\\TypechoPlugin\\Vue3Admin\\LocalStorage')) {
                $pdo = \TypechoPlugin\Vue3Admin\LocalStorage::pdo();
            }
        } catch (\Throwable $e) {
            $pdo = null;
        }

        if (!$pdo) {
            throw new \RuntimeException('Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }

        // Apply form
        if (
            isset($_SERVER['REQUEST_METHOD'])
            && strtoupper((string) $_SERVER['REQUEST_METHOD']) === 'POST'
            && (string) ($request->get('v3a_do') ?? '') === 'apply'
        ) {
            $token = (string) ($request->get('_') ?? '');
            $expected = (string) $security->getToken($csrfRef);
            if ($token === '' || !hash_equals($expected, $token)) {
                $noticeType = 'error';
                $noticeMessage = '请求已过期，请刷新页面后重试。';
            } elseif (trim((string) ($request->get('v3a_hp') ?? '')) !== '') {
                $noticeType = 'error';
                $noticeMessage = '提交失败。';
            } else {
                $name = v3a_links_str($request->get('name', ''), 100);
                $url = v3a_links_str($request->get('url', ''), 255);
                $avatar = v3a_links_str($request->get('avatar', ''), 500);
                $description = v3a_links_str($request->get('description', ''), 200);
                $email = v3a_links_str($request->get('email', ''), 190);
                $message = v3a_links_str($request->get('message', ''), 500);

                $type = (string) ($applySettings['defaultType'] ?? 'friend');
                if (!in_array($type, ['friend', 'collection'], true)) {
                    $type = 'friend';
                }

                if (!empty($applySettings['allowTypeSelect'])) {
                    $t = strtolower(v3a_links_str($request->get('type', ''), 20));
                    if (in_array($t, ['friend', 'collection'], true) && !empty($applySettings['allowedTypes'][$t])) {
                        $type = $t;
                    }
                }

                if (empty($applySettings['allowedTypes'][$type])) {
                    $type = !empty($applySettings['allowedTypes']['friend']) ? 'friend' : 'collection';
                }

                if ($name === '') {
                    $noticeType = 'error';
                    $noticeMessage = '请填写名称。';
                } elseif ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false) {
                    $noticeType = 'error';
                    $noticeMessage = '请填写正确的网址（需包含 http/https）。';
                } elseif (!empty($applySettings['required']['email']) && $email === '') {
                    $noticeType = 'error';
                    $noticeMessage = '请填写邮箱。';
                } elseif ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                    $noticeType = 'error';
                    $noticeMessage = '邮箱格式不正确。';
                } elseif (!empty($applySettings['required']['avatar']) && $avatar === '') {
                    $noticeType = 'error';
                    $noticeMessage = '请填写头像。';
                } elseif ($avatar !== '' && stripos($avatar, 'data:image/') !== 0 && filter_var($avatar, FILTER_VALIDATE_URL) === false) {
                    $noticeType = 'error';
                    $noticeMessage = '头像格式不正确（需填写图片地址或 data:image/...）。';
                } elseif (!empty($applySettings['required']['description']) && $description === '') {
                    $noticeType = 'error';
                    $noticeMessage = '请填写描述。';
                } elseif (!empty($applySettings['required']['message']) && $message === '') {
                    $noticeType = 'error';
                    $noticeMessage = '请填写留言。';
                } else {
                    $dup = 0;
                    try {
                        $stmt = $pdo->prepare('SELECT COUNT(id) FROM v3a_friend_link WHERE url = :url LIMIT 1');
                        $stmt->execute([':url' => $url]);
                        $dup = (int) ($stmt->fetchColumn() ?: 0);
                    } catch (\Throwable $e) {
                        $dup = 0;
                    }
                    if ($dup > 0) {
                        $noticeType = 'error';
                        $noticeMessage = '该网址已存在于友链列表中。';
                    } else {
                        $pending = 0;
                        try {
                            $stmt = $pdo->prepare(
                                'SELECT COUNT(id) FROM v3a_friend_link_apply WHERE url = :url AND status = :status LIMIT 1'
                            );
                            $stmt->execute([':url' => $url, ':status' => 0]);
                            $pending = (int) ($stmt->fetchColumn() ?: 0);
                        } catch (\Throwable $e) {
                            $pending = 0;
                        }

                        if ($pending > 0) {
                            $noticeType = 'error';
                            $noticeMessage = '该网址已提交过申请，请等待审核。';
                        } else {
                            $rows = [
                                'name' => $name,
                                'url' => $url,
                                'avatar' => $avatar,
                                'description' => $description,
                                'type' => $type,
                                'email' => $email,
                                'message' => $message,
                                'status' => 0,
                                'created' => time(),
                            ];

                            $cols = array_keys($rows);
                            $placeholders = array_map(function ($c) {
                                return ':' . $c;
                            }, $cols);
                            $stmt = $pdo->prepare(
                                'INSERT INTO v3a_friend_link_apply ('
                                    . implode(',', $cols)
                                    . ') VALUES ('
                                    . implode(',', $placeholders)
                                    . ')'
                            );
                            $params = [];
                            foreach ($rows as $k => $v) {
                                $params[':' . $k] = $v;
                            }
                            $stmt->execute($params);

                            try {
                                if (class_exists('\\TypechoPlugin\\Vue3Admin\\Plugin')) {
                                    \TypechoPlugin\Vue3Admin\Plugin::notifyFriendLinkApply($rows);
                                }
                            } catch (\Throwable $e) {
                            }

                            $noticeType = 'success';
                            $noticeMessage = '已提交申请，请等待审核。';
                        }
                    }
                }
            }
        }

        // Approved friend links (status=1)
        $stmt = $pdo->prepare('SELECT id,name,url,avatar,description,type FROM v3a_friend_link WHERE status = :status ORDER BY created DESC');
        $stmt->execute([':status' => 1]);
        $links = (array) $stmt->fetchAll();
    }
} catch (\Throwable $e) {
    $noticeType = 'error';
    $noticeMessage = $noticeMessage ?: '加载失败：' . $e->getMessage();
}

$this->need('header.php'); ?>

<div class="main">
<?php $this->need('module/head2.php'); ?>

<style>
.v3a-link-type {
    display: inline-flex;
    align-items: center;
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 1.4;
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.6);
}
.night .v3a-link-type {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.72);
}
</style>

<div class="page_thumb blur">
    <div class="post_bg lazy-load"
         data-src="<?php echo $this->fields->thumb ? $this->fields->thumb : Helper::options()->themeUrl . '/static/img/friend.jpg'; ?>">
    </div>

    <div class="pc">
        <i class="iconfont icon-nav menu-button"></i>
        <div class="page-head">
            <?php if ($this->options->logoStyle == 'text') : ?>
                <h1>
                    <a href="<?php $this->options->siteUrl(); ?>"><?php $this->options->title(); ?></a>
                    <span class="soul">生活录</span>
                </h1>
            <?php else : ?>
                <a class="logo" href="<?php $this->options->siteUrl(); ?>">
                    <img src="<?php echo $this->options->logoWhite ? $this->options->logoWhite : Helper::options()->themeUrl . '/static/img/logoWhite.svg'; ?>">
                </a>
            <?php endif; ?>
        </div>
    </div>
    <div class="m">
        <h1 class="page-head"><?php $this->archiveTitle(' &raquo; ', ''); ?><span>My online friends</span></h1>
    </div>
</div>

<div class="page-title animated fadeIn pc">
    <h1><?php $this->title(); ?></h1>
</div>

<?php if (!$v3aEnabled) : ?>
    <div class="nodata blur">
        <img src='<?php $this->options->themeUrl('static/img/nodata.svg'); ?>'></img>
        <span>未启用 Vue3Admin 插件，无法加载友链数据。</span>
    </div>
<?php else : ?>
    <?php if (!empty($links)) : ?>
        <div class="links padding blur">
            <ul>
                <?php foreach ((array) $links as $link) :
                    $name = htmlspecialchars((string) ($link['name'] ?? ''), ENT_QUOTES, 'UTF-8');
                    $url = htmlspecialchars((string) ($link['url'] ?? ''), ENT_QUOTES, 'UTF-8');
                    $desc = htmlspecialchars((string) ($link['description'] ?? ''), ENT_QUOTES, 'UTF-8');
                    $avatar = trim((string) ($link['avatar'] ?? ''));
                    $avatar = $avatar !== '' ? $avatar : (Helper::options()->themeUrl . '/static/img/logo.svg');
                    $avatar = htmlspecialchars($avatar, ENT_QUOTES, 'UTF-8');
                    $type = strtolower(trim((string) ($link['type'] ?? 'friend')));
                    $typeLabel = $type === 'collection' ? '收藏' : '朋友';
                    $typeLabel = htmlspecialchars($typeLabel, ENT_QUOTES, 'UTF-8');
                    ?>
                    <li class="link">
                        <a href="<?php echo $url; ?>" target="_blank" rel="noreferrer">
                            <img src="<?php echo $avatar; ?>" alt="<?php echo $name; ?>"/>
                            <div class="link-info">
                                <h3>
                                    <?php echo $name !== '' ? $name : '—'; ?>
                                    <span class="v3a-link-type"><?php echo $typeLabel; ?></span>
                                </h3>
                                <span class="lite-black" title="<?php echo $desc; ?>"><?php echo $desc !== '' ? $desc : '—'; ?></span>
                            </div>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php else : ?>
        <div class="nodata blur">
            <img src='<?php $this->options->themeUrl('static/img/nodata.svg'); ?>'></img>
            <span>暂无友链</span>
        </div>
    <?php endif; ?>
<?php endif; ?>

<div class="post_content padding animated fadeIn blur">
    <h4 class="link-request" id="v3a-apply">
        <span>#</span>
        申请友链
    </h4>

    <?php if ($noticeMessage !== '') : ?>
        <div class="<?php echo $noticeType === 'success' ? 'load' : 'nodata'; ?>" style="margin-bottom: 16px;">
            <span><?php echo htmlspecialchars($noticeMessage, ENT_QUOTES, 'UTF-8'); ?></span>
        </div>
    <?php endif; ?>

    <?php if ($v3aEnabled) : ?>
        <form method="post" action="<?php $this->permalink(); ?>#v3a-apply" class="respond" style="padding:0; background: transparent;">
            <input type="hidden" name="v3a_do" value="apply" />
            <input type="hidden" name="v3a_hp" value="" />
            <input type="hidden" name="_" value="<?php echo htmlspecialchars((string) $security->getToken($csrfRef), ENT_QUOTES, 'UTF-8'); ?>" />

            <div class="comment-author-info">
                <div class="comment-md-3">
                    <label>名称<span class="required">*</span></label>
                    <input type="text" class="text" name="name" required maxlength="100" placeholder="站点名称..." />
                </div>
                <div class="comment-md-3">
                    <label>网址<span class="required">*</span></label>
                    <input type="url" class="text" name="url" required maxlength="255" placeholder="https://example.com" />
                </div>
                <div class="comment-md-3">
                    <label>邮箱</label>
                    <input type="email" class="text" name="email" maxlength="190" placeholder="可留空..." <?php echo !empty($applySettings['required']['email']) ? 'required' : ''; ?> />
                </div>
            </div>

            <div class="comment-author-info">
                <div class="comment-md-3">
                    <label>头像</label>
                    <input type="url" class="text" name="avatar" maxlength="500" placeholder="https://...（可留空）" <?php echo !empty($applySettings['required']['avatar']) ? 'required' : ''; ?> />
                </div>
                <div class="comment-md-3">
                    <label>描述</label>
                    <input type="text" class="text" name="description" maxlength="200" placeholder="一句话介绍..." <?php echo !empty($applySettings['required']['description']) ? 'required' : ''; ?> />
                </div>
                <?php if (!empty($applySettings['allowTypeSelect'])) : ?>
                    <div class="comment-md-3">
                        <label>类型</label>
                        <select class="text" name="type">
                            <?php if (!empty($applySettings['allowedTypes']['friend'])) : ?>
                                <option value="friend" <?php echo ($applySettings['defaultType'] ?? 'friend') === 'friend' ? 'selected' : ''; ?>>朋友</option>
                            <?php endif; ?>
                            <?php if (!empty($applySettings['allowedTypes']['collection'])) : ?>
                                <option value="collection" <?php echo ($applySettings['defaultType'] ?? 'friend') === 'collection' ? 'selected' : ''; ?>>收藏</option>
                            <?php endif; ?>
                        </select>
                    </div>
                <?php else : ?>
                    <input type="hidden" name="type" value="<?php echo htmlspecialchars((string) ($applySettings['defaultType'] ?? 'friend'), ENT_QUOTES, 'UTF-8'); ?>" />
                <?php endif; ?>
            </div>

            <div style="margin-top: 12px;">
                <label>留言</label>
                <textarea class="textarea" name="message" rows="4" maxlength="500" placeholder="可留空..." <?php echo !empty($applySettings['required']['message']) ? 'required' : ''; ?>></textarea>
            </div>

            <div class="comment-submit" style="margin-top: 12px;">
                <button type="submit" class="submit">提交申请</button>
            </div>
        </form>
    <?php endif; ?>
</div>

<div class="post_content padding animated fadeIn blur">
    <h4 class="link-request">
        <span>#</span>
        友链要求
    </h4>
    <?php
    $content = $this->content;
    if (function_exists('AutoLightbox')) {
        echo AutoLightbox($content);
    } else {
        $this->content();
    }
    ?>
</div>

<?php $this->need('comments.php'); ?>
<a id="gototop" class="hidden"><i class="iconfont icon-up"></i></a>
</div>

<?php $this->need('footer.php'); ?>
