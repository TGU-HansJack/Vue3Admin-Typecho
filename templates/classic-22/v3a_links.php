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

        $stmt = $pdo->prepare('SELECT id,name,url,avatar,description,type FROM v3a_friend_link WHERE status = :status ORDER BY created DESC');
        $stmt->execute([':status' => 1]);
        $links = (array) $stmt->fetchAll();
    }
} catch (\Throwable $e) {
    $noticeType = 'error';
    $noticeMessage = $noticeMessage ?: '加载失败：' . $e->getMessage();
}

$this->need('header.php'); ?>

<main class="container">
    <div class="container-thin">
        <article class="post" itemscope itemtype="http://schema.org/BlogPosting">
            <?php postMeta($this, 'page'); ?>

            <div class="entry-content fmt" itemprop="articleBody">
                <style>
                    .v3a-links { list-style: none; margin: 0; padding: 0; }
                    .v3a-link-item { display: flex; gap: 12px; margin: 0 0 14px; align-items: flex-start; }
                    .v3a-link-avatar { width: 40px; height: 40px; border-radius: 999px; overflow: hidden; background: var(--pico-muted-border-color); display: flex; align-items: center; justify-content: center; flex: 0 0 40px; color: var(--pico-muted-color); font-weight: 700; }
                    .v3a-link-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
                    .v3a-link-type { display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 8px; border-radius: 999px; font-size: 12px; line-height: 1.4; background: var(--pico-muted-border-color); color: var(--pico-muted-color); }
                    .v3a-link-desc { color: var(--pico-muted-color); font-size: 0.9em; margin-top: 3px; }
                    .v3a-links-apply { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--pico-muted-border-color); }
                    .v3a-links-notice { padding: 0.75rem 1rem; border: 1px solid var(--pico-muted-border-color); border-radius: var(--pico-border-radius); margin: 1rem 0; }
                    .v3a-links-notice.success { border-color: var(--pico-ins-color); color: var(--pico-ins-color); }
                    .v3a-links-notice.error { border-color: var(--pico-del-color); color: var(--pico-del-color); }
                </style>

                <?php if (!$v3aEnabled) : ?>
                    <p><?php _e('未启用 Vue3Admin 插件，无法加载友链数据。'); ?></p>
                <?php else : ?>
                    <?php if (!empty($links)) : ?>
                        <ul class="v3a-links">
                            <?php foreach ((array) $links as $link) :
                                $rawName = (string) ($link['name'] ?? '');
                                $name = htmlspecialchars($rawName, ENT_QUOTES, 'UTF-8');
                                $url = htmlspecialchars((string) ($link['url'] ?? ''), ENT_QUOTES, 'UTF-8');
                                $desc = htmlspecialchars((string) ($link['description'] ?? ''), ENT_QUOTES, 'UTF-8');

                                $avatar = trim((string) ($link['avatar'] ?? ''));
                                $avatar = $avatar !== '' ? htmlspecialchars($avatar, ENT_QUOTES, 'UTF-8') : '';

                                $type = strtolower(trim((string) ($link['type'] ?? 'friend')));
                                $typeLabel = $type === 'collection' ? '收藏' : '朋友';
                                $typeLabel = htmlspecialchars($typeLabel, ENT_QUOTES, 'UTF-8');

                                $initial = '—';
                                $trimName = trim($rawName);
                                if ($trimName !== '') {
                                    if (function_exists('mb_substr')) {
                                        $initial = (string) mb_substr($trimName, 0, 1);
                                    } else {
                                        $initial = substr($trimName, 0, 1);
                                    }
                                }
                                $initial = htmlspecialchars($initial, ENT_QUOTES, 'UTF-8');
                                ?>
                                <li class="v3a-link-item">
                                    <div class="v3a-link-avatar">
                                        <?php if ($avatar !== '') : ?>
                                            <img src="<?php echo $avatar; ?>" alt="" loading="lazy"/>
                                        <?php else : ?>
                                            <span><?php echo $initial; ?></span>
                                        <?php endif; ?>
                                    </div>
                                    <div>
                                        <a href="<?php echo $url; ?>" target="_blank" rel="noreferrer"><?php echo $name !== '' ? $name : '—'; ?></a>
                                        <span class="v3a-link-type"><?php echo $typeLabel; ?></span>
                                        <?php if ($desc !== '') : ?>
                                            <div class="v3a-link-desc"><?php echo $desc; ?></div>
                                        <?php endif; ?>
                                    </div>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php else : ?>
                        <p><?php _e('暂无友链'); ?></p>
                    <?php endif; ?>

                    <div class="v3a-links-apply">
                        <h3 id="v3a-apply"><?php _e('申请友链'); ?></h3>

                        <?php if ($noticeMessage !== '') : ?>
                            <div class="v3a-links-notice <?php echo $noticeType === 'success' ? 'success' : 'error'; ?>">
                                <?php echo htmlspecialchars($noticeMessage, ENT_QUOTES, 'UTF-8'); ?>
                            </div>
                        <?php endif; ?>

                        <form method="post" action="<?php $this->permalink(); ?>#v3a-apply">
                            <input type="hidden" name="v3a_do" value="apply" />
                            <input type="hidden" name="v3a_hp" value="" />
                            <input type="hidden" name="_" value="<?php echo htmlspecialchars((string) $security->getToken($csrfRef), ENT_QUOTES, 'UTF-8'); ?>" />

                            <div class="grid">
                                <label>
                                    <?php _e('名称'); ?>
                                    <input type="text" name="name" required maxlength="100" placeholder="<?php _e('站点名称'); ?>" />
                                </label>
                                <label>
                                    <?php _e('网址'); ?>
                                    <input type="url" name="url" required maxlength="255" placeholder="https://example.com" />
                                </label>
                                <label>
                                    <?php _e('邮箱'); ?>
                                    <input type="email" name="email" maxlength="190" placeholder="<?php _e('可留空'); ?>" <?php echo !empty($applySettings['required']['email']) ? 'required' : ''; ?> />
                                </label>
                            </div>

                            <div class="grid">
                                <label>
                                    <?php _e('头像'); ?>
                                    <input type="url" name="avatar" maxlength="500" placeholder="https://..." <?php echo !empty($applySettings['required']['avatar']) ? 'required' : ''; ?> />
                                </label>
                                <label>
                                    <?php _e('描述'); ?>
                                    <input type="text" name="description" maxlength="200" placeholder="<?php _e('一句话介绍'); ?>" <?php echo !empty($applySettings['required']['description']) ? 'required' : ''; ?> />
                                </label>
                                <?php if (!empty($applySettings['allowTypeSelect'])) : ?>
                                    <label>
                                        <?php _e('类型'); ?>
                                        <select name="type">
                                            <?php if (!empty($applySettings['allowedTypes']['friend'])) : ?>
                                                <option value="friend" <?php echo ($applySettings['defaultType'] ?? 'friend') === 'friend' ? 'selected' : ''; ?>><?php _e('朋友'); ?></option>
                                            <?php endif; ?>
                                            <?php if (!empty($applySettings['allowedTypes']['collection'])) : ?>
                                                <option value="collection" <?php echo ($applySettings['defaultType'] ?? 'friend') === 'collection' ? 'selected' : ''; ?>><?php _e('收藏'); ?></option>
                                            <?php endif; ?>
                                        </select>
                                    </label>
                                <?php else : ?>
                                    <input type="hidden" name="type" value="<?php echo htmlspecialchars((string) ($applySettings['defaultType'] ?? 'friend'), ENT_QUOTES, 'UTF-8'); ?>" />
                                <?php endif; ?>
                            </div>

                            <label>
                                <?php _e('留言'); ?>
                                <textarea rows="4" name="message" maxlength="500" placeholder="<?php _e('可留空'); ?>" <?php echo !empty($applySettings['required']['message']) ? 'required' : ''; ?>></textarea>
                            </label>

                            <button type="submit"><?php _e('提交申请'); ?></button>
                        </form>
                    </div>
                <?php endif; ?>

                <?php $this->content(); ?>
            </div>
        </article>

        <hr class="post-separator">

        <?php $this->need('comments.php'); ?>
    </div>
</main>

<?php $this->need('footer.php'); ?>
