<?php

namespace TypechoPlugin\Vue3Admin;

use Typecho\Db;
use Typecho\Plugin\Exception as PluginException;
use Typecho\Plugin\PluginInterface;
use Typecho\Widget\Helper\Form;
use Typecho\Widget\Helper\Form\Element\Text;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

/**
 * Vue3Admin
 *
 * @package Vue3Admin
 * @author HansJack
 * @version 1.1.0
 * @link https://www.hansjack.com
 */
class Plugin implements PluginInterface
{
    private const ADMIN_DIR = 'Vue3Admin';
    private const VERSION = '1.1.0';
    private const DEPLOY_MARKER = '.v3a_deploy_version';

    private static function getDeployVersion(): string
    {
        $paths = [
            __DIR__ . '/admin/index.php',
            __DIR__ . '/admin/login.php',
            __DIR__ . '/admin/register.php',
            __DIR__ . '/admin/api.php',
            __DIR__ . '/admin/track.php',
            __DIR__ . '/admin/extending.php',
            __DIR__ . '/admin/common.php',
            __DIR__ . '/admin/bootstrap.php',
            __DIR__ . '/admin/plugin-config.php',
            __DIR__ . '/admin/theme-config.php',
            __DIR__ . '/admin/options-plugin.php',
            __DIR__ . '/admin/options-theme.php',
            __DIR__ . '/admin/assets/app.js',
            __DIR__ . '/admin/assets/app.css',
        ];

        $build = 0;
        foreach ($paths as $path) {
            $mtime = @filemtime($path);
            if ($mtime !== false) {
                $build = max($build, (int) $mtime);
            }
        }

        return self::VERSION . '+' . $build;
    }

    public static function activate()
    {
        self::deployAdminDirectory();
        self::installOrUpgradeSchema();
        self::ensureDefaultRegisterGroupOption();
        self::ensureAclConfigOption();
        self::switchAdminDir('/' . self::ADMIN_DIR . '/');

        // 运行时自愈：当后台目录被误删/覆盖/升级后缺文件时自动重新部署
        \Typecho\Plugin::factory('admin/common.php')->begin = __CLASS__ . '::ensureAdminDirectory';
        \Typecho\Plugin::factory('index.php')->begin = __CLASS__ . '::ensureAdminDirectory';

        // Register: allow choosing default group for new users (exclude administrator).
        \Typecho\Plugin::factory('Widget_Register')->register = __CLASS__ . '::filterRegisterGroup';

        // ACL: enforce per-group upload restrictions for /action/upload
        \Typecho\Plugin::factory('Widget_Upload')->uploadHandle = __CLASS__ . '::uploadHandle';

        // 访问统计（前台）：用于仪表盘“访问量/今日 IP”等数据
        \Typecho\Plugin::factory('Widget_Archive')->afterRender = __CLASS__ . '::trackVisit';

        // 评论邮件提醒（仅用于新评论提交）
        \Typecho\Plugin::factory('Widget_Feedback')->finishComment = __CLASS__ . '::notifyComment';

        return _t('Vue3Admin 已启用：后台路径已切换到 /%s/', self::ADMIN_DIR);
    }

    public static function deactivate()
    {
        self::switchAdminDir('/admin/');
        return _t('Vue3Admin 已停用：后台路径已恢复为 /admin/');
    }

    private static function ensureDefaultRegisterGroupOption(): void
    {
        try {
            $db = Db::get();
            $exists = (int) ($db->fetchObject(
                $db->select(['COUNT(*)' => 'num'])
                    ->from('table.options')
                    ->where('name = ? AND user = ?', 'defaultRegisterGroup', 0)
            )->num ?? 0);

            if ($exists > 0) {
                return;
            }

            $db->query(
                $db->insert('table.options')->rows([
                    'name' => 'defaultRegisterGroup',
                    'value' => 'subscriber',
                    'user' => 0,
                ]),
                Db::WRITE
            );
        } catch (\Throwable $e) {
        }
    }

    private static function defaultAclConfig(): array
    {
        return [
            'version' => 1,
            'groups' => [
                'administrator' => [
                    'posts' => ['write' => 1, 'manage' => 1, 'taxonomy' => 1, 'scopeAll' => 1],
                    'comments' => ['manage' => 1, 'scopeAll' => 1],
                    'pages' => ['manage' => 1],
                    'files' => ['access' => 1, 'upload' => 1, 'scopeAll' => 1, 'maxSizeMb' => 0, 'types' => []],
                    'friends' => ['manage' => 1],
                    'data' => ['manage' => 1],
                    'subscribe' => ['manage' => 1],
                    'users' => ['manage' => 1],
                    'maintenance' => ['manage' => 1],
                ],
                'editor' => [
                    'posts' => ['write' => 1, 'manage' => 1, 'taxonomy' => 1, 'scopeAll' => 1],
                    'comments' => ['manage' => 1, 'scopeAll' => 1],
                    'pages' => ['manage' => 1],
                    'files' => ['access' => 1, 'upload' => 1, 'scopeAll' => 1, 'maxSizeMb' => 0, 'types' => []],
                    'friends' => ['manage' => 0],
                    'data' => ['manage' => 0],
                    'subscribe' => ['manage' => 0],
                    'users' => ['manage' => 0],
                    'maintenance' => ['manage' => 0],
                ],
                'contributor' => [
                    'posts' => ['write' => 1, 'manage' => 1, 'taxonomy' => 0, 'scopeAll' => 0],
                    'comments' => ['manage' => 0, 'scopeAll' => 0],
                    'pages' => ['manage' => 0],
                    'files' => ['access' => 1, 'upload' => 1, 'scopeAll' => 0, 'maxSizeMb' => 5, 'types' => []],
                    'friends' => ['manage' => 0],
                    'data' => ['manage' => 0],
                    'subscribe' => ['manage' => 0],
                    'users' => ['manage' => 0],
                    'maintenance' => ['manage' => 0],
                ],
                'subscriber' => [
                    'posts' => ['write' => 0, 'manage' => 0, 'taxonomy' => 0, 'scopeAll' => 0],
                    'comments' => ['manage' => 0, 'scopeAll' => 0],
                    'pages' => ['manage' => 0],
                    'files' => ['access' => 0, 'upload' => 0, 'scopeAll' => 0, 'maxSizeMb' => 0, 'types' => []],
                    'friends' => ['manage' => 0],
                    'data' => ['manage' => 0],
                    'subscribe' => ['manage' => 0],
                    'users' => ['manage' => 0],
                    'maintenance' => ['manage' => 0],
                ],
                'visitor' => [
                    'posts' => ['write' => 0, 'manage' => 0, 'taxonomy' => 0, 'scopeAll' => 0],
                    'comments' => ['manage' => 0, 'scopeAll' => 0],
                    'pages' => ['manage' => 0],
                    'files' => ['access' => 0, 'upload' => 0, 'scopeAll' => 0, 'maxSizeMb' => 0, 'types' => []],
                    'friends' => ['manage' => 0],
                    'data' => ['manage' => 0],
                    'subscribe' => ['manage' => 0],
                    'users' => ['manage' => 0],
                    'maintenance' => ['manage' => 0],
                ],
            ],
        ];
    }

    private static function ensureAclConfigOption(): void
    {
        try {
            $db = Db::get();
            $row = $db->fetchObject(
                $db->select(['value'])
                    ->from('table.options')
                    ->where('name = ? AND user = ?', 'v3a_acl_config', 0)
                    ->limit(1)
            );

            $default = self::defaultAclConfig();
            $raw = trim((string) ($row->value ?? ''));
            $decoded = $raw !== '' ? json_decode($raw, true) : null;
            $merged = is_array($decoded) ? array_replace_recursive($default, $decoded) : $default;

            $encoded = json_encode($merged, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (!is_string($encoded) || $encoded === '') {
                return;
            }

            if ($row) {
                if ($raw !== $encoded) {
                    $db->query(
                        $db->update('table.options')->rows(['value' => $encoded])->where('name = ? AND user = ?', 'v3a_acl_config', 0),
                        Db::WRITE
                    );
                }
                return;
            }

            $db->query(
                $db->insert('table.options')->rows([
                    'name' => 'v3a_acl_config',
                    'value' => $encoded,
                    'user' => 0,
                ]),
                Db::WRITE
            );
        } catch (\Throwable $e) {
        }
    }

    private static function getAclFilesRule(string $group): array
    {
        static $cached = null;
        if ($cached === null) {
            $cached = [];
            try {
                $db = Db::get();
                $row = $db->fetchObject(
                    $db->select('value')
                        ->from('table.options')
                        ->where('name = ? AND user = ?', 'v3a_acl_config', 0)
                        ->limit(1)
                );
                $raw = (string) ($row->value ?? '');
                $decoded = $raw !== '' ? json_decode($raw, true) : null;
                if (is_array($decoded)) {
                    $cached = $decoded;
                }
            } catch (\Throwable $e) {
            }
        }

        $g = strtolower(trim($group));
        $defaults = self::defaultAclConfig();
        $defaultFiles = [];
        try {
            $defaultFiles = (array) (($defaults['groups'][$g]['files'] ?? []) ?: []);
        } catch (\Throwable $e) {
        }

        $files = [];
        try {
            $files = (array) (($cached['groups'][$g]['files'] ?? []) ?: []);
        } catch (\Throwable $e) {
        }
        $files = array_replace($defaultFiles, $files);

        $types = [];
        if (!empty($files['types']) && is_array($files['types'])) {
            foreach ($files['types'] as $t) {
                $v = strtolower(trim((string) $t));
                $v = ltrim($v, '.');
                if ($v !== '') {
                    $types[$v] = true;
                }
            }
        }

        $files['types'] = array_values(array_keys($types));
        return $files;
    }

    private static function v3aUploadSafeName(string &$name): string
    {
        $name = str_replace(['"', '<', '>'], '', $name);
        $name = str_replace('\\', '/', $name);
        $name = false === strpos($name, '/') ? ('a' . $name) : str_replace('/', '/a', $name);
        $info = pathinfo($name);
        $name = substr((string) ($info['basename'] ?? ''), 1);

        return isset($info['extension']) ? strtolower((string) $info['extension']) : '';
    }

    private static function v3aMakeUploadDir(string $path): bool
    {
        $path = preg_replace('/\\\\+/', '/', $path);
        $path = rtrim((string) $path, '/');
        if ($path === '') {
            return false;
        }

        if (is_dir($path)) {
            return true;
        }

        @mkdir($path, 0755, true);
        return is_dir($path);
    }

    public static function uploadHandle(array $file)
    {
        try {
            $user = \Widget\User::alloc();
            $group = strtolower(trim((string) ($user->group ?? 'subscriber')));
            $rule = self::getAclFilesRule($group);

            if (isset($rule['upload']) && !(int) $rule['upload']) {
                return false;
            }

            $maxSizeMb = isset($rule['maxSizeMb']) ? (int) $rule['maxSizeMb'] : 0;
            if ($maxSizeMb > 0 && isset($file['size']) && (int) $file['size'] > $maxSizeMb * 1024 * 1024) {
                return false;
            }

            $name = (string) ($file['name'] ?? '');
            if ($name === '') {
                return false;
            }

            $ext = self::v3aUploadSafeName($name);
            if (!\Widget\Upload::checkFileType($ext)) {
                return false;
            }

            $allowed = isset($rule['types']) && is_array($rule['types']) ? $rule['types'] : [];
            if (!empty($allowed)) {
                $extLower = strtolower((string) $ext);
                $allowedMap = array_fill_keys(array_map('strtolower', $allowed), true);
                if (!isset($allowedMap[$extLower])) {
                    return false;
                }
            }

            $date = new \Typecho\Date();
            $dir = \Typecho\Common::url(
                defined('__TYPECHO_UPLOAD_DIR__') ? __TYPECHO_UPLOAD_DIR__ : \Widget\Upload::UPLOAD_DIR,
                defined('__TYPECHO_UPLOAD_ROOT_DIR__') ? __TYPECHO_UPLOAD_ROOT_DIR__ : __TYPECHO_ROOT_DIR__
            ) . '/' . $date->year . '/' . $date->month;

            if (!is_dir($dir)) {
                if (!self::v3aMakeUploadDir($dir)) {
                    return false;
                }
            }

            $fileName = sprintf('%u', crc32(uniqid())) . '.' . $ext;
            $fullPath = $dir . '/' . $fileName;

            if (isset($file['tmp_name'])) {
                if (!@move_uploaded_file($file['tmp_name'], $fullPath)) {
                    return false;
                }
            } elseif (isset($file['bytes'])) {
                if (!file_put_contents($fullPath, $file['bytes'])) {
                    return false;
                }
            } elseif (isset($file['bits'])) {
                if (!file_put_contents($fullPath, $file['bits'])) {
                    return false;
                }
            } else {
                return false;
            }

            if (!isset($file['size'])) {
                $file['size'] = filesize($fullPath);
            }

            return [
                'name' => $name,
                'path' => (defined('__TYPECHO_UPLOAD_DIR__') ? __TYPECHO_UPLOAD_DIR__ : \Widget\Upload::UPLOAD_DIR)
                    . '/' . $date->year . '/' . $date->month . '/' . $fileName,
                'size' => $file['size'],
                'type' => $ext,
                'mime' => \Typecho\Common::mimeContentType($fullPath),
            ];
        } catch (\Throwable $e) {
            return false;
        }
    }

    public static function filterRegisterGroup(array $dataStruct): array
    {
        $group = 'subscriber';
        try {
            $options = \Widget\Options::alloc();
            $group = strtolower(trim((string) ($options->defaultRegisterGroup ?? 'subscriber')));
        } catch (\Throwable $e) {
        }

        $allowed = ['visitor', 'subscriber', 'contributor', 'editor'];
        if (!in_array($group, $allowed, true)) {
            $group = 'subscriber';
        }

        $dataStruct['group'] = $group;
        return $dataStruct;
    }

    public static function config(Form $form)
    {
        $primaryColor = new Text(
            'primaryColor',
            null,
            '#171717',
            _t('主色（Primary Color）'),
            _t('用于面板主题色（CSS 变量）。默认：#171717')
        );
        $form->addInput($primaryColor);

        $vueCdn = new Text(
            'vueCdn',
            null,
            'https://unpkg.com/vue@3/dist/vue.global.prod.js',
            _t('Vue3 CDN'),
            _t('Vue 3 全局构建地址（可替换为自建静态资源）。')
        );
        $form->addInput($vueCdn);

        $echartsCdn = new Text(
            'echartsCdn',
            null,
            'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js',
            _t('ECharts CDN'),
            _t('ECharts 地址（可替换为自建静态资源）。')
        );
        $form->addInput($echartsCdn);

        $vditorCdn = new Text(
            'vditorCdn',
            null,
            'https://cdn.jsdelivr.net/npm/vditor@3.11.2/dist/index.min.js',
            _t('Vditor JS CDN'),
            _t('Vditor 编辑器 JS 地址（可替换为自建静态资源）。')
        );
        $form->addInput($vditorCdn);

        $vditorCssCdn = new Text(
            'vditorCssCdn',
            null,
            'https://cdn.jsdelivr.net/npm/vditor@3.11.2/dist/index.css',
            _t('Vditor CSS CDN'),
            _t('Vditor 编辑器 CSS 地址（可替换为自建静态资源）。')
        );
        $form->addInput($vditorCssCdn);

        $vditorCdnBase = new Text(
            'vditorCdnBase',
            null,
            'https://cdn.jsdelivr.net/npm/vditor@3.11.2',
            _t('Vditor CDN Base'),
            _t('Vditor cdn 基础路径，用于加载 Mermaid/KaTeX/Highlight.js 等内置资源。')
        );
        $form->addInput($vditorCdnBase);
    }

    public static function personalConfig(Form $form)
    {
    }

    /**
     * 访问统计：记录前台访问日志（用于仪表盘数据）。
     *
     * @param \Widget\Archive $archive
     */
    public static function trackVisit($archive): void
    {
        // 运行时自愈：即使用户没有重新启用插件，也能把缺失的后台目录补齐
        self::ensureAdminDirectory();

        // 不统计后台
        if (defined('__TYPECHO_ADMIN__') && __TYPECHO_ADMIN__) {
            return;
        }

        // Feed/预览等场景跳过
        if (isset($archive->parameter) && !empty($archive->parameter->isFeed)) {
            return;
        }

        try {
            $db = Db::get();
        } catch (\Throwable $e) {
            return;
        }

        $request = \Typecho\Request::getInstance();
        $ip = self::detectClientIp((string) $request->getIp());

        // 避免把 “unknown” 当作有效统计
        if ($ip === '' || $ip === 'unknown') {
            return;
        }

        $uri = (string) $request->getRequestUri();
        $referer = (string) ($request->getReferer() ?? '');
        $ua = (string) ($request->getAgent() ?? '');

        $cid = null;
        if (isset($archive->cid) && is_numeric($archive->cid)) {
            $cid = (int) $archive->cid;
        }

        $now = time();
        $uriTruncated = self::truncate($uri, 255);

        // Deduplicate: when both server-side hook and footer beacon run, they may double count.
        try {
            $since = $now - 10;
            $dup = (int) ($db->fetchObject(
                $db->select(['COUNT(id)' => 'num'])
                    ->from('table.v3a_visit_log')
                    ->where('ip = ?', $ip)
                    ->where('uri = ?', $uriTruncated)
                    ->where('created >= ?', $since)
            )->num ?? 0);

            if ($dup > 0) {
                return;
            }
        } catch (\Throwable $e) {
        }

        try {
            $db->query(
                $db->insert('table.v3a_visit_log')->rows([
                    'ip' => $ip,
                    'uri' => $uriTruncated,
                    'cid' => $cid,
                    'referer' => $referer === '' ? null : self::truncate($referer, 255),
                    'ua' => $ua === '' ? null : self::truncate($ua, 255),
                    'created' => $now,
                ]),
                Db::WRITE
            );
        } catch (\Throwable $e) {
            // 表不存在或写入失败时不影响前台渲染
        }
    }

    /**
     * 记录邮件发送状态（用于设置页诊断）。
     *
     * @param array<string,mixed> $payload
     */
    private static function recordMailStatus(string $optionName, array $payload): void
    {
        try {
            $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (!is_string($encoded) || $encoded === '') {
                return;
            }

            $db = Db::get();
            $exists = (int) ($db->fetchObject(
                $db->select(['COUNT(*)' => 'num'])
                    ->from('table.options')
                    ->where('name = ? AND user = ?', $optionName, 0)
                    ->limit(1)
            )->num ?? 0);

            if ($exists > 0) {
                $db->query(
                    $db->update('table.options')
                        ->rows(['value' => $encoded])
                        ->where('name = ? AND user = ?', $optionName, 0),
                    Db::WRITE
                );
                return;
            }

            $db->query(
                $db->insert('table.options')->rows([
                    'name' => $optionName,
                    'value' => $encoded,
                    'user' => 0,
                ]),
                Db::WRITE
            );
        } catch (\Throwable $e) {
        }
    }

    private static function recordMailError(string $kind, string $message): void
    {
        $msg = trim($message);
        if ($msg === '') {
            $msg = '未知错误';
        }

        self::recordMailStatus('v3a_mail_last_error', [
            'kind' => $kind,
            'time' => time(),
            'message' => self::truncate($msg, 500),
        ]);

        // 记录到 PHP 错误日志，便于排查（不包含密码等敏感信息）
        @error_log('[Vue3Admin][mail][' . $kind . '][error] ' . $msg);
    }

    private static function recordMailSuccess(string $kind, string $message = ''): void
    {
        $msg = trim($message);
        self::recordMailStatus('v3a_mail_last_success', [
            'kind' => $kind,
            'time' => time(),
            'message' => $msg === '' ? '' : self::truncate($msg, 500),
        ]);
    }

    /**
     * 评论邮件提醒（管理员收件）
     * 触发时机：新评论提交（Widget_Feedback::finishComment）
     */
    public static function notifyComment($feedback): void
    {
        try {
            $options = \Utils\Helper::options();

            if (!((int) ($options->v3a_mail_enabled ?? 0))) {
                return;
            }
            if (!((int) ($options->v3a_mail_comment_enabled ?? 0))) {
                return;
            }

            $smtpHost = trim((string) ($options->v3a_mail_smtp_host ?? ''));
            $smtpPort = (int) ($options->v3a_mail_smtp_port ?? 465);
            $smtpUser = trim((string) ($options->v3a_mail_smtp_user ?? ''));
            $smtpPass = (string) ($options->v3a_mail_smtp_pass ?? '');
            $smtpFrom = trim((string) ($options->v3a_mail_smtp_from ?? ''));
            $smtpSecure = (int) ($options->v3a_mail_smtp_secure ?? 1) ? 1 : 0;

            if ($smtpFrom === '') {
                $smtpFrom = $smtpUser;
            }

            if ($smtpHost === '' || $smtpPort <= 0 || $smtpUser === '' || $smtpPass === '' || $smtpFrom === '') {
                self::recordMailError('comment', 'SMTP 配置不完整或未保存密码，请在「设定 → 邮件通知设置」完善后重试。');
                return;
            }

            $status = '';
            $commentAuthor = '';
            $commentText = '';
            $commentTime = '';
            $postTitle = '';
            $postUrl = '';

            try {
                $status = (string) ($feedback->status ?? '');
                $commentAuthor = (string) ($feedback->author ?? '');
                $commentText = (string) ($feedback->text ?? '');
                $created = (int) ($feedback->created ?? 0);
                if ($created > 0) {
                    $commentTime = date('Y-m-d H:i:s', $created);
                }

                // 优先使用 Typecho 生成好的跳转地址（通常包含评论锚点）
                $postUrl = (string) ($feedback->permalink ?? '');

                if (isset($feedback->content)) {
                    $postTitle = (string) ($feedback->content->title ?? '');
                    if ($postUrl === '') {
                        $postUrl = (string) ($feedback->content->permalink ?? '');
                    }
                }
            } catch (\Throwable $e) {
            }

            if ($status === 'spam') {
                return;
            }
            if ($commentTime === '') {
                $commentTime = date('Y-m-d H:i:s');
            }
            if ($status === '') {
                $status = 'unknown';
            }

            // 收件人：所有管理员
            try {
                $db = Db::get();
            } catch (\Throwable $e) {
                return;
            }

            $admins = [];
            try {
                $rows = $db->fetchAll(
                    $db->select('mail', 'screenName', 'name')
                        ->from('table.users')
                        ->where('group = ?', 'administrator')
                );
                foreach ((array) $rows as $r) {
                    $mail = trim((string) ($r['mail'] ?? ''));
                    if ($mail !== '' && filter_var($mail, FILTER_VALIDATE_EMAIL)) {
                        $name = (string) ($r['screenName'] ?? $r['name'] ?? '');
                        $admins[] = ['mail' => $mail, 'name' => $name];
                    }
                }
            } catch (\Throwable $e) {
                return;
            }

            if (empty($admins)) {
                self::recordMailError('comment', '未找到有效的管理员邮箱地址（请在用户资料中设置邮箱）。');
                return;
            }

            if (!self::loadPHPMailer()) {
                self::recordMailError('comment', '未找到 PHPMailer，无法发送邮件（请检查 Vue3Admin 插件目录 lib/PHPMailer 是否完整）。');
                return;
            }

            $template = trim((string) ($options->v3a_mail_comment_template ?? ''));
            if ($template === '') {
                $template = self::defaultCommentMailTemplate();
            }

            $siteTitle = (string) ($options->title ?? 'Typecho');
            $vars = [
                'siteTitle' => $siteTitle,
                'postTitle' => $postTitle !== '' ? $postTitle : '（未知文章）',
                'postUrl' => $postUrl !== '' ? $postUrl : (string) ($options->siteUrl ?? ''),
                'commentAuthor' => $commentAuthor !== '' ? $commentAuthor : '（匿名）',
                'commentStatus' => $status,
                'commentTime' => $commentTime,
                'commentText' => nl2br(htmlspecialchars($commentText, ENT_QUOTES, 'UTF-8')),
            ];

            $bodyHtml = self::renderMailTemplate($template, $vars);
            $subject = '新评论提醒：' . ($postTitle !== '' ? $postTitle : $siteTitle);

            try {
                $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                $mail->CharSet = 'UTF-8';
                $mail->isSMTP();
                $mail->Host = $smtpHost;
                $mail->SMTPAuth = true;
                $mail->Username = $smtpUser;
                $mail->Password = $smtpPass;
                $mail->Port = $smtpPort;

                if ($smtpSecure) {
                    $mail->SMTPSecure = $smtpPort === 465 ? 'ssl' : 'tls';
                }

                $mail->setFrom($smtpFrom, $siteTitle);
                foreach ($admins as $to) {
                    $mail->addAddress((string) $to['mail'], (string) $to['name']);
                }

                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body = $bodyHtml;
                $mail->AltBody = strip_tags(
                    str_replace(["<br />", "<br/>", "<br>"], "\n", $bodyHtml)
                );

                $mail->send();

                self::recordMailSuccess('comment', '已发送至 ' . count($admins) . ' 位管理员邮箱。');
            } catch (\Throwable $e) {
                $extra = '';
                try {
                    if (isset($mail) && $mail instanceof \PHPMailer\PHPMailer\PHPMailer) {
                        $extra = trim((string) ($mail->ErrorInfo ?? ''));
                    }
                } catch (\Throwable $e2) {
                }

                $msg = trim((string) $e->getMessage());
                if ($extra !== '' && stripos($msg, $extra) === false) {
                    $msg = $msg !== '' ? ($msg . ' / ' . $extra) : $extra;
                }
                self::recordMailError('comment', $msg);
                // 不影响评论正常提交
            }
        } catch (\Throwable $e) {
        }
    }

    /**
     * 友链申请邮件提醒（管理员收件）
     * 触发时机：前台 v3a_links.php 提交申请
     *
     * @param array<string,mixed> $apply
     */
    public static function notifyFriendLinkApply(array $apply): void
    {
        try {
            $options = \Utils\Helper::options();

            if (!((int) ($options->v3a_mail_enabled ?? 0))) {
                return;
            }
            if (!((int) ($options->v3a_mail_friendlink_enabled ?? 0))) {
                return;
            }

            $smtpHost = trim((string) ($options->v3a_mail_smtp_host ?? ''));
            $smtpPort = (int) ($options->v3a_mail_smtp_port ?? 465);
            $smtpUser = trim((string) ($options->v3a_mail_smtp_user ?? ''));
            $smtpPass = (string) ($options->v3a_mail_smtp_pass ?? '');
            $smtpFrom = trim((string) ($options->v3a_mail_smtp_from ?? ''));
            $smtpSecure = (int) ($options->v3a_mail_smtp_secure ?? 1) ? 1 : 0;

            if ($smtpFrom === '') {
                $smtpFrom = $smtpUser;
            }

            if ($smtpHost === '' || $smtpPort <= 0 || $smtpUser === '' || $smtpPass === '' || $smtpFrom === '') {
                self::recordMailError('friendlink', 'SMTP 配置不完整或未保存密码，请在「设定 → 邮件通知设置」完善后重试。');
                return;
            }

            $linkName = trim((string) ($apply['name'] ?? ''));
            $linkUrl = trim((string) ($apply['url'] ?? ''));
            $linkAvatar = trim((string) ($apply['avatar'] ?? ''));
            $linkDescription = trim((string) ($apply['description'] ?? ''));
            $linkType = strtolower(trim((string) ($apply['type'] ?? 'friend')));
            $linkEmail = trim((string) ($apply['email'] ?? ''));
            $linkMessage = trim((string) ($apply['message'] ?? ''));
            $created = (int) ($apply['created'] ?? 0);

            $applyTime = $created > 0 ? date('Y-m-d H:i:s', $created) : date('Y-m-d H:i:s');

            $typeLabel = $linkType === 'collection' ? '收藏' : '朋友';

            // 收件人：所有管理员
            try {
                $db = Db::get();
            } catch (\Throwable $e) {
                return;
            }

            $admins = [];
            try {
                $rows = $db->fetchAll(
                    $db->select('mail', 'screenName', 'name')
                        ->from('table.users')
                        ->where('group = ?', 'administrator')
                );
                foreach ((array) $rows as $r) {
                    $mail = trim((string) ($r['mail'] ?? ''));
                    if ($mail !== '' && filter_var($mail, FILTER_VALIDATE_EMAIL)) {
                        $name = (string) ($r['screenName'] ?? $r['name'] ?? '');
                        $admins[] = ['mail' => $mail, 'name' => $name];
                    }
                }
            } catch (\Throwable $e) {
                return;
            }

            if (empty($admins)) {
                self::recordMailError('friendlink', '未找到有效的管理员邮箱地址（请在用户资料中设置邮箱）。');
                return;
            }

            if (!self::loadPHPMailer()) {
                self::recordMailError('friendlink', '未找到 PHPMailer，无法发送邮件（请检查 Vue3Admin 插件目录 lib/PHPMailer 是否完整）。');
                return;
            }

            $template = trim((string) ($options->v3a_mail_friendlink_template ?? ''));
            if ($template === '') {
                $template = self::defaultFriendLinkMailTemplate();
            }

            $siteTitle = (string) ($options->title ?? 'Typecho');
            $siteUrl = rtrim((string) ($options->siteUrl ?? ''), "/");
            $reviewUrl = $siteUrl !== '' ? ($siteUrl . '/' . self::ADMIN_DIR . '/#/friends?state=1') : '';

            $vars = [
                'siteTitle' => $siteTitle,
                'linkName' => htmlspecialchars($linkName !== '' ? $linkName : '（未填写）', ENT_QUOTES, 'UTF-8'),
                'linkUrl' => htmlspecialchars($linkUrl !== '' ? $linkUrl : ($siteUrl !== '' ? $siteUrl : ''), ENT_QUOTES, 'UTF-8'),
                'linkType' => htmlspecialchars($typeLabel, ENT_QUOTES, 'UTF-8'),
                'linkEmail' => htmlspecialchars($linkEmail !== '' ? $linkEmail : '（未填写）', ENT_QUOTES, 'UTF-8'),
                'linkAvatar' => htmlspecialchars($linkAvatar, ENT_QUOTES, 'UTF-8'),
                'linkDescription' => htmlspecialchars($linkDescription !== '' ? $linkDescription : '（未填写）', ENT_QUOTES, 'UTF-8'),
                'linkMessage' => nl2br(htmlspecialchars($linkMessage !== '' ? $linkMessage : '（未填写）', ENT_QUOTES, 'UTF-8')),
                'applyTime' => htmlspecialchars($applyTime, ENT_QUOTES, 'UTF-8'),
                'reviewUrl' => htmlspecialchars($reviewUrl, ENT_QUOTES, 'UTF-8'),
            ];

            $bodyHtml = self::renderMailTemplate($template, $vars);
            $subject = '新友链申请：' . ($linkName !== '' ? $linkName : $siteTitle);

            try {
                $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                $mail->CharSet = 'UTF-8';
                $mail->isSMTP();
                $mail->Host = $smtpHost;
                $mail->SMTPAuth = true;
                $mail->Username = $smtpUser;
                $mail->Password = $smtpPass;
                $mail->Port = $smtpPort;

                if ($smtpSecure) {
                    $mail->SMTPSecure = $smtpPort === 465 ? 'ssl' : 'tls';
                }

                $mail->setFrom($smtpFrom, $siteTitle);
                foreach ($admins as $to) {
                    $mail->addAddress((string) $to['mail'], (string) $to['name']);
                }

                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body = $bodyHtml;
                $mail->AltBody = strip_tags(
                    str_replace(["<br />", "<br/>", "<br>"], "\n", $bodyHtml)
                );

                $mail->send();

                self::recordMailSuccess('friendlink', '已发送至 ' . count($admins) . ' 位管理员邮箱。');
            } catch (\Throwable $e) {
                $extra = '';
                try {
                    if (isset($mail) && $mail instanceof \PHPMailer\PHPMailer\PHPMailer) {
                        $extra = trim((string) ($mail->ErrorInfo ?? ''));
                    }
                } catch (\Throwable $e2) {
                }

                $msg = trim((string) $e->getMessage());
                if ($extra !== '' && stripos($msg, $extra) === false) {
                    $msg = $msg !== '' ? ($msg . ' / ' . $extra) : $extra;
                }
                self::recordMailError('friendlink', $msg);
                // 不影响前台正常提交
            }
        } catch (\Throwable $e) {
        }
    }

    /**
     * 发送测试邮件（用于诊断 SMTP 配置）
     *
     * @return array{ok:int,to:string,message:string}
     */
    public static function sendTestMail(string $toMail, string $toName = ''): array
    {
        $toMail = trim($toMail);
        $toName = trim($toName);

        if ($toMail === '' || filter_var($toMail, FILTER_VALIDATE_EMAIL) === false) {
            self::recordMailError('test', '收件邮箱地址无效，请先在个人资料中设置邮箱。');
            return ['ok' => 0, 'to' => $toMail, 'message' => '收件邮箱地址无效'];
        }

        try {
            $options = \Utils\Helper::options();

            if (!((int) ($options->v3a_mail_enabled ?? 0))) {
                self::recordMailError('test', '尚未开启邮箱提醒，请先在「设定 → 邮件通知设置」开启。');
                return ['ok' => 0, 'to' => $toMail, 'message' => '尚未开启邮箱提醒'];
            }

            $smtpHost = trim((string) ($options->v3a_mail_smtp_host ?? ''));
            $smtpPort = (int) ($options->v3a_mail_smtp_port ?? 465);
            $smtpUser = trim((string) ($options->v3a_mail_smtp_user ?? ''));
            $smtpPass = (string) ($options->v3a_mail_smtp_pass ?? '');
            $smtpFrom = trim((string) ($options->v3a_mail_smtp_from ?? ''));
            $smtpSecure = (int) ($options->v3a_mail_smtp_secure ?? 1) ? 1 : 0;

            if ($smtpFrom === '') {
                $smtpFrom = $smtpUser;
            }

            if ($smtpHost === '' || $smtpPort <= 0 || $smtpUser === '' || $smtpPass === '' || $smtpFrom === '') {
                self::recordMailError('test', 'SMTP 配置不完整或未保存密码，请在「设定 → 邮件通知设置」完善后重试。');
                return ['ok' => 0, 'to' => $toMail, 'message' => 'SMTP 配置不完整'];
            }

            if (!self::loadPHPMailer()) {
                self::recordMailError('test', '未找到 PHPMailer，无法发送邮件（请检查 Vue3Admin 插件目录 lib/PHPMailer 是否完整）。');
                return ['ok' => 0, 'to' => $toMail, 'message' => '缺少 PHPMailer'];
            }

            $siteTitle = (string) ($options->title ?? 'Typecho');
            $siteUrl = rtrim((string) ($options->siteUrl ?? ''), "/");
            $adminUrl = $siteUrl !== '' ? ($siteUrl . '/' . self::ADMIN_DIR . '/') : '';
            $now = date('Y-m-d H:i:s');

            $subject = $siteTitle . ' · Vue3Admin 测试邮件';
            $bodyHtml = trim(self::renderMailTemplate(
                <<<'HTML'
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">Vue3Admin 测试邮件</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 10px;">如果你收到此邮件，说明 SMTP 配置可用。</div>
      <div style="font-size: 12px; color: #666;">
        <div><strong>时间：</strong>{{time}}</div>
        <div><strong>收件人：</strong>{{to}}</div>
        <div><strong>后台：</strong><a href="{{adminUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{adminUrl}}</a></div>
      </div>
    </div>
  </div>
</div>
HTML,
                [
                    'siteTitle' => htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8'),
                    'time' => htmlspecialchars($now, ENT_QUOTES, 'UTF-8'),
                    'to' => htmlspecialchars($toMail, ENT_QUOTES, 'UTF-8'),
                    'adminUrl' => htmlspecialchars($adminUrl, ENT_QUOTES, 'UTF-8'),
                ]
            ));

            try {
                $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                $mail->CharSet = 'UTF-8';
                $mail->isSMTP();
                $mail->Host = $smtpHost;
                $mail->SMTPAuth = true;
                $mail->Username = $smtpUser;
                $mail->Password = $smtpPass;
                $mail->Port = $smtpPort;

                if ($smtpSecure) {
                    $mail->SMTPSecure = $smtpPort === 465 ? 'ssl' : 'tls';
                }

                $mail->setFrom($smtpFrom, $siteTitle);
                $mail->addAddress($toMail, $toName);

                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body = $bodyHtml;
                $mail->AltBody = strip_tags(
                    str_replace(["<br />", "<br/>", "<br>"], "\n", $bodyHtml)
                );

                $mail->send();

                self::recordMailSuccess('test', '测试邮件已发送至：' . $toMail);
                return ['ok' => 1, 'to' => $toMail, 'message' => '测试邮件已发送至：' . $toMail];
            } catch (\Throwable $e) {
                $extra = '';
                try {
                    if (isset($mail) && $mail instanceof \PHPMailer\PHPMailer\PHPMailer) {
                        $extra = trim((string) ($mail->ErrorInfo ?? ''));
                    }
                } catch (\Throwable $e2) {
                }

                $msg = trim((string) $e->getMessage());
                if ($extra !== '' && stripos($msg, $extra) === false) {
                    $msg = $msg !== '' ? ($msg . ' / ' . $extra) : $extra;
                }

                self::recordMailError('test', $msg);
                return ['ok' => 0, 'to' => $toMail, 'message' => ($msg !== '' ? $msg : '发送失败')];
            }
        } catch (\Throwable $e) {
            self::recordMailError('test', (string) $e->getMessage());
            return ['ok' => 0, 'to' => $toMail, 'message' => '发送失败'];
        }
    }

    private static function loadPHPMailer(): bool
    {
        if (class_exists('\\PHPMailer\\PHPMailer\\PHPMailer')) {
            return true;
        }

        $root = defined('__TYPECHO_ROOT_DIR__')
            ? rtrim((string) __TYPECHO_ROOT_DIR__, "/\\")
            : rtrim((string) dirname(__DIR__), "/\\");

        $candidates = [
            __DIR__ . '/lib/PHPMailer/PHPMailer.php',
            $root . '/usr/plugins/Vue3Admin/lib/PHPMailer/PHPMailer.php',
            $root . '/usr/plugins/Subscribe/lib/PHPMailer/PHPMailer.php',
            $root . '/usr/plugins/SubMail/lib/PHPMailer/PHPMailer.php',
        ];

        foreach ($candidates as $main) {
            $dir = dirname($main);
            $ex = $dir . '/Exception.php';
            $oauthTokenProvider = $dir . '/OAuthTokenProvider.php';
            $phpMailer = $dir . '/PHPMailer.php';
            $smtp = $dir . '/SMTP.php';

            if (is_file($ex) && is_file($phpMailer) && is_file($smtp)) {
                require_once $ex;
                if (is_file($oauthTokenProvider)) {
                    require_once $oauthTokenProvider;
                }
                require_once $phpMailer;
                require_once $smtp;

                return class_exists('\\PHPMailer\\PHPMailer\\PHPMailer');
            }
        }

        return false;
    }

    private static function renderMailTemplate(string $template, array $vars): string
    {
        $html = $template;
        foreach ($vars as $k => $v) {
            $html = str_replace('{{' . $k . '}}', (string) $v, $html);
        }
        return $html;
    }

    private static function defaultCommentMailTemplate(): string
    {
        $tpl = <<<'HTML'
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">收到一条新的评论</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>文章：</strong><a href="{{postUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{postTitle}}</a></div>
      <div style="margin-bottom: 8px;"><strong>作者：</strong>{{commentAuthor}}</div>
      <div style="margin-bottom: 8px;"><strong>状态：</strong>{{commentStatus}}</div>
      <div style="margin-bottom: 12px;"><strong>时间：</strong>{{commentTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{commentText}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      请登录后台查看并处理。
    </div>
  </div>
</div>
HTML;

        return trim($tpl);
    }

    private static function defaultFriendLinkMailTemplate(): string
    {
        $tpl = <<<'HTML'
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">收到一条新的友链申请</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>名称：</strong>{{linkName}}</div>
      <div style="margin-bottom: 8px;"><strong>网址：</strong><a href="{{linkUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{linkUrl}}</a></div>
      <div style="margin-bottom: 8px;"><strong>类型：</strong>{{linkType}}</div>
      <div style="margin-bottom: 8px;"><strong>邮箱：</strong>{{linkEmail}}</div>
      <div style="margin-bottom: 8px;"><strong>头像：</strong>{{linkAvatar}}</div>
      <div style="margin-bottom: 8px;"><strong>描述：</strong>{{linkDescription}}</div>
      <div style="margin-bottom: 12px;"><strong>时间：</strong>{{applyTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{linkMessage}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      <a href="{{reviewUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">前往审核</a>
    </div>
  </div>
</div>
HTML;

        return trim($tpl);
    }

    private static function truncate(string $value, int $maxLength): string
    {
        if ($value === '') {
            return '';
        }

        if (function_exists('mb_substr')) {
            return (string) mb_substr($value, 0, $maxLength);
        }

        return substr($value, 0, $maxLength);
    }

    private static function detectClientIp(string $fallback = ''): string
    {
        $candidates = [];

        $cf = isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? trim((string) $_SERVER['HTTP_CF_CONNECTING_IP']) : '';
        if ($cf !== '') {
            $candidates[] = $cf;
        }

        $xri = isset($_SERVER['HTTP_X_REAL_IP']) ? trim((string) $_SERVER['HTTP_X_REAL_IP']) : '';
        if ($xri !== '') {
            $candidates[] = $xri;
        }

        $forwarded = isset($_SERVER['HTTP_FORWARDED']) ? trim((string) $_SERVER['HTTP_FORWARDED']) : '';
        if ($forwarded !== '') {
            $parts = explode(',', $forwarded);
            foreach ($parts as $p) {
                if (preg_match('/for=(\"?)(\\[?[0-9a-f:.]+\\]?)(\\1)/i', $p, $m)) {
                    $candidates[] = (string) $m[2];
                }
            }
        }

        $xff = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim((string) $_SERVER['HTTP_X_FORWARDED_FOR']) : '';
        if ($xff !== '') {
            foreach (explode(',', $xff) as $part) {
                $candidates[] = $part;
            }
        }

        $remote = isset($_SERVER['REMOTE_ADDR']) ? trim((string) $_SERVER['REMOTE_ADDR']) : '';
        if ($remote !== '') {
            $candidates[] = $remote;
        }

        if ($fallback !== '') {
            $candidates[] = $fallback;
        }

        $valid = [];
        foreach ($candidates as $raw) {
            $ip = trim((string) $raw);
            $ip = trim($ip, "\"' ");
            if ($ip === '') {
                continue;
            }

            if (preg_match('/^\\[([0-9a-f:]+)\\]:(\\d+)$/i', $ip, $m)) {
                $ip = (string) $m[1];
            } elseif (preg_match('/^(\\d{1,3}(?:\\.\\d{1,3}){3}):(\\d+)$/', $ip, $m)) {
                $ip = (string) $m[1];
            }

            if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
                continue;
            }
            $valid[] = $ip;
        }

        $dedup = [];
        foreach ($valid as $ip) {
            if (in_array($ip, $dedup, true)) {
                continue;
            }
            $dedup[] = $ip;
        }

        foreach ($dedup as $ip) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false) {
                return $ip;
            }
        }

        return $dedup[0] ?? '';
    }

    private static function deployAdminDirectory(): void
    {
        $source = __DIR__ . '/admin';
        $target = rtrim(__TYPECHO_ROOT_DIR__, '/\\') . DIRECTORY_SEPARATOR . self::ADMIN_DIR;

        if (!is_dir($source)) {
            throw new PluginException('Vue3Admin admin package not found: ' . $source);
        }

        self::copyDirectory($source, $target);

        // 写入部署标记：用于运行时判断是否需要重新部署
        $markerPath = $target . DIRECTORY_SEPARATOR . self::DEPLOY_MARKER;
        @file_put_contents($markerPath, self::getDeployVersion());
    }

    /**
     * 运行时自愈：确保 /Vue3Admin/ 目录存在且包含必要文件。
     * 该方法会挂载到前台与后台的 begin 钩子上，必须保证不影响正常访问。
     */
    public static function ensureAdminDirectory(): void
    {
        try {
            static $runtimeInit = false;
            if (!$runtimeInit) {
                $runtimeInit = true;
                self::installOrUpgradeSchema();
                self::ensureDefaultRegisterGroupOption();
                self::ensureAclConfigOption();
                \Typecho\Plugin::factory('Widget_Register')->register = __CLASS__ . '::filterRegisterGroup';
                \Typecho\Plugin::factory('Widget_Upload')->uploadHandle = __CLASS__ . '::uploadHandle';
            }

            $target = rtrim(__TYPECHO_ROOT_DIR__, '/\\') . DIRECTORY_SEPARATOR . self::ADMIN_DIR;
            $expectedMarker = self::getDeployVersion();

            // 必需文件缺失（或版本标记不一致）时，自动重新部署
            $markerPath = $target . DIRECTORY_SEPARATOR . self::DEPLOY_MARKER;
            $marker = is_file($markerPath) ? trim((string) @file_get_contents($markerPath)) : '';

            $required = [
                'index.php',
                'login.php',
                'register.php',
                'api.php',
                'track.php',
                'extending.php',
                'bootstrap.php',
                'common.php',
                'plugin-config.php',
                'theme-config.php',
                'options-plugin.php',
                'options-theme.php',
                'welcome.php',
                'index.html',
                'assets' . DIRECTORY_SEPARATOR . 'app.js',
                'assets' . DIRECTORY_SEPARATOR . 'app.css',
            ];

            $missing = false;
            foreach ($required as $rel) {
                $path = $target . DIRECTORY_SEPARATOR . $rel;
                if (!file_exists($path)) {
                    $missing = true;
                    break;
                }
            }

            if ($missing || $marker !== $expectedMarker) {
                self::deployAdminDirectory();
            }
        } catch (\Throwable $e) {
            // 自愈失败不影响前台/后台正常使用
        }
    }

    private static function copyDirectory(string $source, string $target): void
    {
        if (!is_dir($target) && !@mkdir($target, 0755, true) && !is_dir($target)) {
            throw new PluginException('Cannot create directory: ' . $target);
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            $subPath = $iterator->getSubPathName();
            $destPath = $target . DIRECTORY_SEPARATOR . $subPath;

            if ($item->isDir()) {
                if (!is_dir($destPath) && !@mkdir($destPath, 0755, true) && !is_dir($destPath)) {
                    throw new PluginException('Cannot create directory: ' . $destPath);
                }
                continue;
            }

            if (!@copy($item->getPathname(), $destPath)) {
                throw new PluginException('Cannot copy file: ' . $destPath);
            }
        }
    }

    private static function switchAdminDir(string $adminDir): void
    {
        $adminDir = '/' . trim($adminDir, '/') . '/';
        $configFilePath = rtrim(__TYPECHO_ROOT_DIR__, '/\\') . DIRECTORY_SEPARATOR . 'config.inc.php';

        if (!file_exists($configFilePath)) {
            throw new PluginException('Missing config.inc.php: ' . $configFilePath);
        }

        $config = file_get_contents($configFilePath);
        if ($config === false) {
            throw new PluginException('Cannot read config.inc.php: ' . $configFilePath);
        }

        // 自动备份（首次）
        $backupPath = $configFilePath . '.vue3admin.bak';
        if (!file_exists($backupPath)) {
            @file_put_contents($backupPath, $config);
        }

        $replacement = "define('__TYPECHO_ADMIN_DIR__', '{$adminDir}');";
        $patterns = [
            "/define\\(\\s*'__TYPECHO_ADMIN_DIR__'\\s*,\\s*'[^']*'\\s*\\)\\s*;/",
            '/define\\(\\s*"__TYPECHO_ADMIN_DIR__"\\s*,\\s*"[^"]*"\\s*\\)\\s*;/',
            "/define\\(\\s*'__TYPECHO_ADMIN_DIR__'\\s*,\\s*\"[^\"]*\"\\s*\\)\\s*;/",
            '/define\\(\\s*"__TYPECHO_ADMIN_DIR__"\\s*,\\s*\'[^\']*\'\\s*\\)\\s*;/',
        ];

        $updated = false;
        foreach ($patterns as $pattern) {
            $newConfig = preg_replace($pattern, $replacement, $config, 1, $count);
            if (!empty($count)) {
                $config = $newConfig;
                $updated = true;
                break;
            }
        }

        if (!$updated) {
            // config 中没有定义时，插入到文件开头（<?php 之后）
            if (preg_match('/^<\\?php\\s*/', $config)) {
                $config = preg_replace('/^<\\?php\\s*/', "<?php\n{$replacement}\n", $config, 1);
            } else {
                $config = "<?php\n{$replacement}\n" . $config;
            }
        }

        if (file_put_contents($configFilePath, $config) === false) {
            throw new PluginException('Cannot write config.inc.php: ' . $configFilePath);
        }
    }

    private static function installOrUpgradeSchema(): void
    {
        $db = Db::get();
        $prefix = $db->getPrefix();
        $driver = $db->getAdapter()->getDriver();

        foreach (self::getSchemaSql($driver, $prefix) as $sql) {
            $db->query($sql, Db::WRITE);
        }

        // Friend links: extend schema for mx-admin like fields.
        try {
            self::ensureFriendLinkSchema($db, $driver, $prefix);
        } catch (\Throwable $e) {
        }
    }

    /**
     * @return string[]
     */
    private static function ensureFriendLinkSchema($db, string $driver, string $prefix): void
    {
        $driver = strtolower($driver);

        $linkTable = $prefix . 'v3a_friend_link';
        $applyTable = $prefix . 'v3a_friend_link_apply';

        $linkColumns = self::getTableColumns($db, $driver, $linkTable);
        $applyColumns = self::getTableColumns($db, $driver, $applyTable);

        $linkMissing = [
            'avatar' => true,
            'description' => true,
            'type' => true,
            'email' => true,
        ];
        foreach ($linkColumns as $col) {
            unset($linkMissing[$col]);
        }

        $applyMissing = [
            'avatar' => true,
            'description' => true,
            'type' => true,
            'email' => true,
        ];
        foreach ($applyColumns as $col) {
            unset($applyMissing[$col]);
        }

        if (!empty($linkMissing)) {
            foreach (self::friendLinkAlterStatements($driver, $linkTable, $linkMissing) as $sql) {
                try {
                    $db->query($sql, Db::WRITE);
                } catch (\Throwable $e) {
                }
            }
        }

        if (!empty($applyMissing)) {
            foreach (self::friendLinkApplyAlterStatements($driver, $applyTable, $applyMissing) as $sql) {
                try {
                    $db->query($sql, Db::WRITE);
                } catch (\Throwable $e) {
                }
            }
        }
    }

    /**
     * @return string[]
     */
    private static function getTableColumns($db, string $driver, string $table): array
    {
        $driver = strtolower($driver);

        if ($driver === 'sqlite') {
            $rows = [];
            try {
                $rows = $db->fetchAll('PRAGMA table_info(' . $table . ')');
            } catch (\Throwable $e) {
            }
            $out = [];
            foreach ($rows as $r) {
                $name = isset($r['name']) ? (string) $r['name'] : '';
                if ($name !== '') {
                    $out[] = $name;
                }
            }
            return array_values(array_unique($out));
        }

        if ($driver === 'pgsql') {
            $table = strtolower(preg_replace('/[^a-z0-9_]/i', '', $table));
            $rows = [];
            try {
                $rows = $db->fetchAll(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '{$table}'"
                );
            } catch (\Throwable $e) {
            }
            $out = [];
            foreach ($rows as $r) {
                $name = isset($r['column_name']) ? (string) $r['column_name'] : '';
                if ($name !== '') {
                    $out[] = $name;
                }
            }
            return array_values(array_unique($out));
        }

        // MySQL
        $rows = [];
        try {
            $rows = $db->fetchAll('SHOW COLUMNS FROM `' . str_replace('`', '', $table) . '`');
        } catch (\Throwable $e) {
        }
        $out = [];
        foreach ($rows as $r) {
            $name = isset($r['Field']) ? (string) $r['Field'] : '';
            if ($name !== '') {
                $out[] = $name;
            }
        }
        return array_values(array_unique($out));
    }

    /**
     * @param array<string,bool> $missing
     * @return string[]
     */
    private static function friendLinkAlterStatements(string $driver, string $table, array $missing): array
    {
        if ($driver === 'sqlite') {
            $sql = [];
            if (isset($missing['avatar'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN avatar TEXT NULL";
            }
            if (isset($missing['description'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN description TEXT NULL";
            }
            if (isset($missing['type'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN type TEXT NOT NULL DEFAULT 'friend'";
            }
            if (isset($missing['email'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN email TEXT NOT NULL DEFAULT ''";
            }
            return $sql;
        }

        if ($driver === 'pgsql') {
            $sql = [];
            if (isset($missing['avatar'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN avatar TEXT NULL";
            }
            if (isset($missing['description'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN description TEXT NULL";
            }
            if (isset($missing['type'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'friend'";
            }
            if (isset($missing['email'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN email VARCHAR(190) NOT NULL DEFAULT ''";
            }
            return $sql;
        }

        $t = '`' . str_replace('`', '', $table) . '`';
        $sql = [];
        if (isset($missing['avatar'])) {
            $sql[] = "ALTER TABLE {$t} ADD COLUMN `avatar` TEXT NULL";
        }
        if (isset($missing['description'])) {
            $sql[] = "ALTER TABLE {$t} ADD COLUMN `description` TEXT NULL";
        }
        if (isset($missing['type'])) {
            $sql[] = "ALTER TABLE {$t} ADD COLUMN `type` VARCHAR(20) NOT NULL DEFAULT 'friend'";
        }
        if (isset($missing['email'])) {
            $sql[] = "ALTER TABLE {$t} ADD COLUMN `email` VARCHAR(190) NOT NULL DEFAULT ''";
        }
        return $sql;
    }

    /**
     * @param array<string,bool> $missing
     * @return string[]
     */
    private static function friendLinkApplyAlterStatements(string $driver, string $table, array $missing): array
    {
        if ($driver === 'sqlite') {
            $sql = [];
            if (isset($missing['avatar'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN avatar TEXT NULL";
            }
            if (isset($missing['description'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN description TEXT NULL";
            }
            if (isset($missing['type'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN type TEXT NOT NULL DEFAULT 'friend'";
            }
            if (isset($missing['email'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN email TEXT NOT NULL DEFAULT ''";
            }
            return $sql;
        }

        if ($driver === 'pgsql') {
            $sql = [];
            if (isset($missing['avatar'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN avatar TEXT NULL";
            }
            if (isset($missing['description'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN description TEXT NULL";
            }
            if (isset($missing['type'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'friend'";
            }
            if (isset($missing['email'])) {
                $sql[] = "ALTER TABLE {$table} ADD COLUMN email VARCHAR(190) NOT NULL DEFAULT ''";
            }
            return $sql;
        }

        $t = '`' . str_replace('`', '', $table) . '`';
        $sql = [];
        if (isset($missing['avatar'])) {
            $sql[] = "ALTER TABLE {$t} ADD COLUMN `avatar` TEXT NULL";
        }
        if (isset($missing['description'])) {
            $sql[] = "ALTER TABLE {$t} ADD COLUMN `description` TEXT NULL";
        }
        if (isset($missing['type'])) {
            $sql[] = "ALTER TABLE {$t} ADD COLUMN `type` VARCHAR(20) NOT NULL DEFAULT 'friend'";
        }
        if (isset($missing['email'])) {
            $sql[] = "ALTER TABLE {$t} ADD COLUMN `email` VARCHAR(190) NOT NULL DEFAULT ''";
        }
        return $sql;
    }

    private static function getSchemaSql(string $driver, string $prefix): array
    {
        $driver = strtolower($driver);

        if ($driver === 'sqlite') {
            return [
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_visit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip TEXT NOT NULL DEFAULT '',
                    uri TEXT NOT NULL DEFAULT '',
                    cid INTEGER NULL,
                    referer TEXT NULL,
                    ua TEXT NULL,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_api_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip TEXT NOT NULL DEFAULT '',
                    method TEXT NOT NULL DEFAULT 'GET',
                    path TEXT NOT NULL DEFAULT '',
                    query TEXT NULL,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_friend_link (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL DEFAULT '',
                    url TEXT NOT NULL DEFAULT '',
                    avatar TEXT NULL,
                    description TEXT NULL,
                    type TEXT NOT NULL DEFAULT 'friend',
                    email TEXT NOT NULL DEFAULT '',
                    status INTEGER NOT NULL DEFAULT 0,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_friend_link_apply (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL DEFAULT '',
                    url TEXT NOT NULL DEFAULT '',
                    avatar TEXT NULL,
                    description TEXT NULL,
                    type TEXT NOT NULL DEFAULT 'friend',
                    email TEXT NOT NULL DEFAULT '',
                    message TEXT NULL,
                    status INTEGER NOT NULL DEFAULT 0,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_subscribe (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL DEFAULT '',
                    status INTEGER NOT NULL DEFAULT 1,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_like (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL DEFAULT 'site',
                    cid INTEGER NULL,
                    ip TEXT NOT NULL DEFAULT '',
                    created INTEGER NOT NULL DEFAULT 0
                );",
            ];
        }

        if ($driver === 'pgsql') {
            return [
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_visit_log (
                    id BIGSERIAL PRIMARY KEY,
                    ip VARCHAR(45) NOT NULL DEFAULT '',
                    uri VARCHAR(255) NOT NULL DEFAULT '',
                    cid INTEGER NULL,
                    referer VARCHAR(255) NULL,
                    ua VARCHAR(255) NULL,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_api_log (
                    id BIGSERIAL PRIMARY KEY,
                    ip VARCHAR(45) NOT NULL DEFAULT '',
                    method VARCHAR(10) NOT NULL DEFAULT 'GET',
                    path VARCHAR(255) NOT NULL DEFAULT '',
                    query TEXT NULL,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_friend_link (
                    id BIGSERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL DEFAULT '',
                    url VARCHAR(255) NOT NULL DEFAULT '',
                    avatar TEXT NULL,
                    description TEXT NULL,
                    type VARCHAR(20) NOT NULL DEFAULT 'friend',
                    email VARCHAR(190) NOT NULL DEFAULT '',
                    status SMALLINT NOT NULL DEFAULT 0,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_friend_link_apply (
                    id BIGSERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL DEFAULT '',
                    url VARCHAR(255) NOT NULL DEFAULT '',
                    avatar TEXT NULL,
                    description TEXT NULL,
                    type VARCHAR(20) NOT NULL DEFAULT 'friend',
                    email VARCHAR(190) NOT NULL DEFAULT '',
                    message TEXT NULL,
                    status SMALLINT NOT NULL DEFAULT 0,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_subscribe (
                    id BIGSERIAL PRIMARY KEY,
                    email VARCHAR(190) NOT NULL DEFAULT '',
                    status SMALLINT NOT NULL DEFAULT 1,
                    created INTEGER NOT NULL DEFAULT 0
                );",
                "CREATE TABLE IF NOT EXISTS {$prefix}v3a_like (
                    id BIGSERIAL PRIMARY KEY,
                    type VARCHAR(20) NOT NULL DEFAULT 'site',
                    cid INTEGER NULL,
                    ip VARCHAR(45) NOT NULL DEFAULT '',
                    created INTEGER NOT NULL DEFAULT 0
                );",
            ];
        }

        // 默认按 MySQL 语法生成
        return [
            "CREATE TABLE IF NOT EXISTS `{$prefix}v3a_visit_log` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `ip` VARCHAR(45) NOT NULL DEFAULT '',
                `uri` VARCHAR(255) NOT NULL DEFAULT '',
                `cid` INT UNSIGNED NULL,
                `referer` VARCHAR(255) NULL,
                `ua` VARCHAR(255) NULL,
                `created` INT UNSIGNED NOT NULL DEFAULT 0,
                PRIMARY KEY (`id`),
                KEY `idx_created` (`created`),
                KEY `idx_ip` (`ip`),
                KEY `idx_cid` (`cid`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
            "CREATE TABLE IF NOT EXISTS `{$prefix}v3a_api_log` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `ip` VARCHAR(45) NOT NULL DEFAULT '',
                `method` VARCHAR(10) NOT NULL DEFAULT 'GET',
                `path` VARCHAR(255) NOT NULL DEFAULT '',
                `query` TEXT NULL,
                `created` INT UNSIGNED NOT NULL DEFAULT 0,
                PRIMARY KEY (`id`),
                KEY `idx_created` (`created`),
                KEY `idx_ip` (`ip`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
            "CREATE TABLE IF NOT EXISTS `{$prefix}v3a_friend_link` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `name` VARCHAR(100) NOT NULL DEFAULT '',
                `url` VARCHAR(255) NOT NULL DEFAULT '',
                `avatar` TEXT NULL,
                `description` TEXT NULL,
                `type` VARCHAR(20) NOT NULL DEFAULT 'friend',
                `email` VARCHAR(190) NOT NULL DEFAULT '',
                `status` TINYINT NOT NULL DEFAULT 0,
                `created` INT UNSIGNED NOT NULL DEFAULT 0,
                PRIMARY KEY (`id`),
                KEY `idx_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
            "CREATE TABLE IF NOT EXISTS `{$prefix}v3a_friend_link_apply` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `name` VARCHAR(100) NOT NULL DEFAULT '',
                `url` VARCHAR(255) NOT NULL DEFAULT '',
                `avatar` TEXT NULL,
                `description` TEXT NULL,
                `type` VARCHAR(20) NOT NULL DEFAULT 'friend',
                `email` VARCHAR(190) NOT NULL DEFAULT '',
                `message` TEXT NULL,
                `status` TINYINT NOT NULL DEFAULT 0,
                `created` INT UNSIGNED NOT NULL DEFAULT 0,
                PRIMARY KEY (`id`),
                KEY `idx_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
            "CREATE TABLE IF NOT EXISTS `{$prefix}v3a_subscribe` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `email` VARCHAR(190) NOT NULL DEFAULT '',
                `status` TINYINT NOT NULL DEFAULT 1,
                `created` INT UNSIGNED NOT NULL DEFAULT 0,
                PRIMARY KEY (`id`),
                KEY `idx_status` (`status`),
                UNIQUE KEY `uniq_email` (`email`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
            "CREATE TABLE IF NOT EXISTS `{$prefix}v3a_like` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `type` VARCHAR(20) NOT NULL DEFAULT 'site',
                `cid` INT UNSIGNED NULL,
                `ip` VARCHAR(45) NOT NULL DEFAULT '',
                `created` INT UNSIGNED NOT NULL DEFAULT 0,
                PRIMARY KEY (`id`),
                KEY `idx_type` (`type`),
                KEY `idx_cid` (`cid`),
                KEY `idx_created` (`created`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
        ];
    }
}
