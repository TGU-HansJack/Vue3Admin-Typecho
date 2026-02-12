<?php

namespace TypechoPlugin\Vue3Admin;

use Typecho\Db;
use Typecho\Cookie;
use Typecho\Plugin\Exception as PluginException;
use Typecho\Plugin\PluginInterface;
use Typecho\Widget\Helper\Form;
use Typecho\Widget\Helper\Form\Element\Text;
use Utils\PasswordHash;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

require_once __DIR__ . '/LocalStorage.php';
require_once __DIR__ . '/Ai.php';

/**
 * Vue3Admin
 *
 * @package Vue3Admin
 * @author HansJack
 * @version 1.2.4
 * @link https://www.hansjack.com
 */
class Plugin implements PluginInterface
{
    private const ADMIN_DIR = 'Vue3Admin';
    private const VERSION = '1.2.4';
    private const DEPLOY_MARKER = '.v3a_deploy_version';

    /** @var string */
    private static $aiLang = '';

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
        self::repairSerializedCoreOptions();
        self::deployAdminDirectory();
        self::ensureLocalStorage();
        self::ensureDefaultRegisterGroupOption();
        self::ensureAclConfigOption();
        self::switchAdminDir('/' . self::ADMIN_DIR . '/');

        // 运行时自愈：当后台目录被误删/覆盖/升级后缺文件时自动重新部署
        \Typecho\Plugin::factory('admin/common.php')->begin = __CLASS__ . '::ensureAdminDirectory';
        \Typecho\Plugin::factory('index.php')->begin = __CLASS__ . '::ensureAdminDirectory';

        // Register: allow choosing default group for new users (exclude administrator).
        \Typecho\Plugin::factory('Widget_Register')->register = __CLASS__ . '::filterRegisterGroup';
        \Typecho\Plugin::factory('Widget_Register')->finishRegister = __CLASS__ . '::finishRegister';

        // ACL: enforce per-group upload restrictions for /action/upload
        \Typecho\Plugin::factory('Widget_Upload')->uploadHandle = __CLASS__ . '::uploadHandle';

        // 访问统计（前台）：用于仪表盘“访问量/今日 IP”等数据
        \Typecho\Plugin::factory('Widget_Archive')->afterRender = __CLASS__ . '::trackVisit';

        // 评论邮件提醒（新评论提交 & 后台回复评论）
        \Typecho\Plugin::factory('Widget_Feedback')->finishComment = __CLASS__ . '::notifyComment';
        self::ensureCommentMailHooks();

        // AI：评论审核（新评论提交前）
        \Typecho\Plugin::factory('Widget_Feedback')->comment = __CLASS__ . '::aiModerateComment';

        // AI：前台 /{lang}/ 前缀翻译输出（替换 title/text）
        \Typecho\Plugin::factory('Widget_Abstract_Contents')->filter = __CLASS__ . '::aiTranslateContentsFilter';

        return _t('Vue3Admin 已启用：后台路径已切换到 /%s/', self::ADMIN_DIR);
    }

    public static function deactivate()
    {
        self::repairSerializedCoreOptions();
        self::switchAdminDir('/admin/');
        return _t('Vue3Admin 已停用：后台路径已恢复为 /admin/');
    }

    private static function repairSerializedCoreOptions(): void
    {
        self::repairSerializedOption('plugins');
        self::repairSerializedOption('routingTable');
    }

    private static function repairSerializedOption(string $name): void
    {
        try {
            $db = Db::get();
            $row = $db->fetchObject(
                $db->select('value')
                    ->from('table.options')
                    ->where('name = ? AND user = ?', $name, 0)
                    ->limit(1)
            );

            $raw = trim((string) ($row->value ?? ''));
            if ($raw === '') {
                return;
            }

            $unserialized = @unserialize($raw);
            if (is_array($unserialized)) {
                return;
            }

            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                return;
            }

            $db->query(
                $db->update('table.options')
                    ->rows(['value' => serialize($decoded)])
                    ->where('name = ? AND user = ?', $name, 0),
                Db::WRITE
            );
        } catch (\Throwable $e) {
        }
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

        // Typecho 1.3 register action always generates random password.
        // If user submitted one, override stored hash so custom password works.
        try {
            $request = \Widget\Options::alloc()->request;
            $plainPassword = (string) $request->get('password');
            if ($plainPassword !== '') {
                $hasher = new PasswordHash(8, true);
                $dataStruct['password'] = $hasher->hashPassword($plainPassword);
            }
        } catch (\Throwable $e) {
        }

        $dataStruct['group'] = $group;
        return $dataStruct;
    }

    public static function finishRegister($widget): void
    {
        try {
            $request = null;
            if (is_object($widget) && isset($widget->request)) {
                $request = $widget->request;
            }
            if (!$request) {
                $request = \Widget\Options::alloc()->request;
            }

            $name = trim((string) $request->get('name'));
            $mail = trim((string) $request->get('mail'));
            $password = (string) $request->get('password');
            if ($name === '' || $password === '') {
                return;
            }

            // Ensure current session keeps logged in with user-defined password.
            try {
                \Widget\User::alloc()->login($name, $password, false);
            } catch (\Throwable $e) {
            }

            $payload = json_encode([
                'name' => $name,
                'mail' => $mail,
                'password' => $password,
                'time' => time(),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            if (is_string($payload) && $payload !== '') {
                // short-lived cookie; consumed once on first admin entry.
                Cookie::set('__v3a_register_flash', $payload, 600);
            }
        } catch (\Throwable $e) {
        }
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

        $ctype = '';
        try {
            if (isset($archive->type)) {
                $ctype = (string) $archive->type;
            }
        } catch (\Throwable $e) {
        }

        LocalStorage::logVisit($ip, $uri, $cid, $ctype, $referer, $ua, time());
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
     * @param array{host:string,port:int,user:string,pass:string,from:string,secure:int} $smtp
     * @param array<int,array{mail:string,name:string}> $recipients
     */
    private static function sendMailBySmtp(
        string $kind,
        array $smtp,
        string $fromName,
        array $recipients,
        string $subject,
        string $bodyHtml,
        string $successMessage
    ): void {
        try {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mail->CharSet = 'UTF-8';
            $mail->isSMTP();
            $mail->Host = $smtp['host'];
            $mail->SMTPAuth = true;
            $mail->Username = $smtp['user'];
            $mail->Password = $smtp['pass'];
            $mail->Port = (int) $smtp['port'];

            if (!empty($smtp['secure'])) {
                $mail->SMTPSecure = ((int) $smtp['port'] === 465) ? 'ssl' : 'tls';
            }

            $mail->setFrom($smtp['from'], $fromName);
            foreach ($recipients as $to) {
                $mail->addAddress((string) $to['mail'], (string) $to['name']);
            }

            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $bodyHtml;
            $mail->AltBody = strip_tags(
                str_replace(["<br />", "<br/>", "<br>"], "\n", $bodyHtml)
            );

            $mail->send();

            self::recordMailSuccess($kind, $successMessage);
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
            self::recordMailError($kind, $msg);
        }
    }

    /**
     * 评论邮件提醒
     * - 管理员：新评论 / 待审核评论
     * - 访客：评论回复提醒（回复其评论）
     *
     * 触发时机：
     * - 新评论提交（Widget_Feedback::finishComment）
     * - 后台回复评论（Widget\Comments\Edit::finishComment）
     */
    public static function notifyComment($feedback, bool $includeAdmins = true): void
    {
        try {
            $options = \Utils\Helper::options();

            if (!((int) ($options->v3a_mail_enabled ?? 0))) {
                return;
            }

            $commentReplyNotifyEnabled = (int) ($options->v3a_mail_comment_reply_enabled ?? 0);

            $commentNotifyEnabled = (int) ($options->v3a_mail_comment_enabled ?? 0);

            // backward-compatible: if option not set yet, follow commentNotifyEnabled
            $waitingEnabledRaw = $includeAdmins ? ($options->v3a_mail_comment_waiting_enabled ?? null) : null;
            $commentWaitingNotifyEnabled = $includeAdmins
                ? (int) ($waitingEnabledRaw === null ? $commentNotifyEnabled : $waitingEnabledRaw)
                : 0;

            if (!$commentNotifyEnabled && !$commentWaitingNotifyEnabled && !$commentReplyNotifyEnabled) {
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

            $smtpKind = $commentNotifyEnabled ? 'comment' : ($commentWaitingNotifyEnabled ? 'comment_waiting' : 'comment_reply');
            if ($smtpHost === '' || $smtpPort <= 0 || $smtpUser === '' || $smtpPass === '' || $smtpFrom === '') {
                self::recordMailError($smtpKind, 'SMTP 配置不完整或未保存密码，请在「设定 → 邮件通知设置」完善后重试。');
                return;
            }

            $status = '';
            $commentAuthor = '';
            $commentMail = '';
            $commentText = '';
            $commentTime = '';
            $postTitle = '';
            $postUrl = '';
            $parentId = 0;
            $cid = 0;
            $ownerId = 0;
            $authorId = 0;

            try {
                $status = (string) ($feedback->status ?? '');
                $commentAuthor = (string) ($feedback->author ?? '');
                $commentMail = trim((string) ($feedback->mail ?? ''));
                $commentText = (string) ($feedback->text ?? '');
                $parentId = (int) ($feedback->parent ?? 0);
                $cid = (int) ($feedback->cid ?? 0);
                $ownerId = (int) ($feedback->ownerId ?? 0);
                $authorId = (int) ($feedback->authorId ?? 0);

                $created = (int) ($feedback->created ?? 0);
                if ($created > 0) {
                    $commentTime = date('Y-m-d H:i:s', $created);
                }

                // 优先使用 Typecho 生成好的跳转地址（通常包含评论锚点）
                $postUrl = (string) ($feedback->permalink ?? '');

                // Widget_Feedback exposes $feedback->content as Archive object, while Widget\Base\Comments
                // uses magic property "content" as rendered comment HTML string.
                // Type-check to avoid "Attempt to read property on string" warnings.
                try {
                    $maybeContent = $feedback->content ?? null;
                    if (is_object($maybeContent)) {
                        $postTitle = (string) ($maybeContent->title ?? $postTitle);
                        if ($postUrl === '') {
                            $postUrl = (string) ($maybeContent->permalink ?? $postUrl);
                        }
                    }
                } catch (\Throwable $e2) {
                }

                // Widget\Base\Comments provides joined content fields via magic properties.
                if ($postTitle === '') {
                    try {
                        $t = trim((string) ($feedback->title ?? ''));
                        if ($t !== '') {
                            $postTitle = $t;
                        }
                    } catch (\Throwable $e2) {
                    }
                }

                // Fallback: fetch content by cid (reliable for both front/back hooks).
                if ($postTitle === '' && $cid > 0) {
                    try {
                        $content = \Utils\Helper::widgetById('Contents', $cid);
                        if ($content) {
                            $postTitle = (string) ($content->title ?? $postTitle);
                            if ($postUrl === '') {
                                $postUrl = (string) ($content->permalink ?? $postUrl);
                            }
                        }
                    } catch (\Throwable $e2) {
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
            $statusLabel = $status;
            if ($status === 'approved') {
                $statusLabel = '通过';
            } elseif ($status === 'waiting') {
                $statusLabel = '待审';
            } elseif ($status === 'spam') {
                $statusLabel = '垃圾';
            }

            $siteTitle = (string) ($options->title ?? 'Typecho');
            $siteUrl = rtrim((string) ($options->siteUrl ?? ''), "/");
            $reviewUrl = $siteUrl !== '' ? ($siteUrl . '/' . self::ADMIN_DIR . '/#/comments') : '';

            if (!self::loadPHPMailer()) {
                self::recordMailError($smtpKind, '未找到 PHPMailer，无法发送邮件（请检查 Vue3Admin 插件目录 lib/PHPMailer 是否完整）。');
                return;
            }

            $smtp = [
                'host' => $smtpHost,
                'port' => $smtpPort,
                'user' => $smtpUser,
                'pass' => $smtpPass,
                'from' => $smtpFrom,
                'secure' => $smtpSecure,
            ];

            $adminRecipients = self::parseMailRecipients((string) ($options->v3a_mail_admin_to ?? ''), $siteTitle);
            $adminToMails = [];
            foreach ((array) $adminRecipients as $r) {
                $m = strtolower(trim((string) ($r['mail'] ?? '')));
                if ($m !== '') {
                    $adminToMails[$m] = 1;
                }
            }
            $db = null;

            // 1) 文章作者：新评论提醒（approved）
            if ($status === 'approved' && $commentNotifyEnabled) {
                $recipients = [];
                $ownerMail = '';
                $ownerName = '';
                if ($ownerId > 0) {
                    if (!$db) {
                        try {
                            $db = Db::get();
                        } catch (\Throwable $e) {
                            $db = null;
                        }
                    }

                    if ($db) {
                        try {
                            $u = (array) $db->fetchRow(
                                $db->select('mail', 'screenName', 'name')
                                    ->from('table.users')
                                    ->where('uid = ?', $ownerId)
                                    ->limit(1)
                            );
                            $ownerMail = trim((string) ($u['mail'] ?? ''));
                            $ownerName = (string) ($u['screenName'] ?? $u['name'] ?? '');
                        } catch (\Throwable $e) {
                            $ownerMail = '';
                            $ownerName = '';
                        }
                    }
                }

                // CommentNotifier: 不需要发信给自己（作者自己评论自己的文章）
                $skip = false;
                if ($authorId > 0 && $ownerId > 0 && $authorId === $ownerId) {
                    $skip = true;
                }
                if (!$skip && $ownerMail !== '' && filter_var($ownerMail, FILTER_VALIDATE_EMAIL) !== false) {
                    if ($commentMail !== '' && strcasecmp($commentMail, $ownerMail) === 0) {
                        $skip = true;
                    }
                }

                if (!$skip && $ownerMail !== '' && filter_var($ownerMail, FILTER_VALIDATE_EMAIL) !== false) {
                    $recipients = [[
                        'mail' => $ownerMail,
                        'name' => $ownerName !== '' ? $ownerName : $ownerMail,
                    ]];
                }

                // 文章作者邮箱为空时：发送至站长收件邮箱（如未配置则降级为管理员邮箱，且仅在 includeAdmins=true 时启用）
                if (!$skip && empty($recipients)) {
                    if (empty($adminRecipients) && $includeAdmins) {
                        if (!$db) {
                            try {
                                $db = Db::get();
                            } catch (\Throwable $e) {
                                $db = null;
                            }
                        }
                        if ($db) {
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
                                        $adminRecipients[] = ['mail' => $mail, 'name' => $name];
                                    }
                                }
                            } catch (\Throwable $e) {
                            }
                        }
                    }
                    $recipients = $adminRecipients;
                }

                if (!$skip && empty($recipients)) {
                    self::recordMailError('comment', '未找到有效的文章作者邮箱地址，且未配置站长收件邮箱/管理员邮箱。');
                } elseif (!$skip) {
                    $template = trim((string) ($options->v3a_mail_comment_template ?? ''));
                    if ($template === '') {
                        $template = self::defaultCommentMailTemplate();
                    }

                    $vars = [
                        'siteTitle' => htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8'),
                        'siteUrl' => htmlspecialchars($siteUrl, ENT_QUOTES, 'UTF-8'),
                        'postTitle' => htmlspecialchars($postTitle !== '' ? $postTitle : '（未知文章）', ENT_QUOTES, 'UTF-8'),
                        'postUrl' => htmlspecialchars($postUrl !== '' ? $postUrl : (string) ($options->siteUrl ?? ''), ENT_QUOTES, 'UTF-8'),
                        'commentAuthor' => htmlspecialchars($commentAuthor !== '' ? $commentAuthor : '（匿名）', ENT_QUOTES, 'UTF-8'),
                        'commentMail' => htmlspecialchars($commentMail !== '' ? $commentMail : '（未填写）', ENT_QUOTES, 'UTF-8'),
                        'commentStatus' => htmlspecialchars($statusLabel, ENT_QUOTES, 'UTF-8'),
                        'commentTime' => htmlspecialchars($commentTime, ENT_QUOTES, 'UTF-8'),
                        'commentText' => nl2br(htmlspecialchars($commentText, ENT_QUOTES, 'UTF-8')),
                    ];

                    $bodyHtml = self::renderMailTemplate($template, $vars);
                    $subject = '你的《' . ($postTitle !== '' ? $postTitle : $siteTitle) . '》文章有了新的评论';

                    self::sendMailBySmtp(
                        'comment',
                        $smtp,
                        $siteTitle,
                        $recipients,
                        $subject,
                        $bodyHtml,
                        '已发送至 ' . count($recipients) . ' 位收件人。'
                    );
                }
            }

            // 2) 管理员：待审核评论提醒（waiting/unknown/…）
            if ($includeAdmins && $status !== 'approved' && $commentWaitingNotifyEnabled) {
                $recipients = $adminRecipients;
                if (empty($recipients)) {
                    if (!$db) {
                        try {
                            $db = Db::get();
                        } catch (\Throwable $e) {
                            $db = null;
                        }
                    }

                    if ($db) {
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
                                    $recipients[] = ['mail' => $mail, 'name' => $name];
                                }
                            }
                        } catch (\Throwable $e) {
                        }
                    }
                }

                if (empty($recipients)) {
                    self::recordMailError('comment_waiting', '未找到有效的管理员邮箱地址（请在用户资料中设置邮箱，或配置站长收件邮箱）。');
                } else {
                    // NOTE: typecho_options.name is often VARCHAR(32); keep option keys <= 32 chars.
                    $template = trim((string) (
                        $options->v3a_mail_comment_wait_tpl
                        ?? ($options->v3a_mail_comment_waiting_template ?? '')
                    ));
                    if ($template === '') {
                        $template = self::defaultCommentWaitingMailTemplate();
                    }

                    $vars = [
                        'siteTitle' => htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8'),
                        'siteUrl' => htmlspecialchars($siteUrl, ENT_QUOTES, 'UTF-8'),
                        'postTitle' => htmlspecialchars($postTitle !== '' ? $postTitle : '（未知文章）', ENT_QUOTES, 'UTF-8'),
                        'postUrl' => htmlspecialchars($postUrl !== '' ? $postUrl : (string) ($options->siteUrl ?? ''), ENT_QUOTES, 'UTF-8'),
                        'commentAuthor' => htmlspecialchars($commentAuthor !== '' ? $commentAuthor : '（匿名）', ENT_QUOTES, 'UTF-8'),
                        'commentMail' => htmlspecialchars($commentMail !== '' ? $commentMail : '（未填写）', ENT_QUOTES, 'UTF-8'),
                        'commentStatus' => htmlspecialchars($statusLabel, ENT_QUOTES, 'UTF-8'),
                        'commentTime' => htmlspecialchars($commentTime, ENT_QUOTES, 'UTF-8'),
                        'commentText' => nl2br(htmlspecialchars($commentText, ENT_QUOTES, 'UTF-8')),
                        'reviewUrl' => htmlspecialchars($reviewUrl, ENT_QUOTES, 'UTF-8'),
                    ];

                    $bodyHtml = self::renderMailTemplate($template, $vars);
                    $subject = '文章《' . ($postTitle !== '' ? $postTitle : $siteTitle) . '》有条待审评论';

                    self::sendMailBySmtp(
                        'comment_waiting',
                        $smtp,
                        $siteTitle,
                        $recipients,
                        $subject,
                        $bodyHtml,
                        '已发送至 ' . count($recipients) . ' 位收件人。'
                    );
                }
            }

            // 3) 访客：评论回复提醒（parent）
            if (
                $status === 'approved'
                && $commentReplyNotifyEnabled
                && $parentId > 0
            ) {
                try {
                    $db = Db::get();
                } catch (\Throwable $e) {
                    $db = null;
                }
                if (!$db) {
                    return;
                }

                $parent = [];
                try {
                    $parent = (array) $db->fetchRow(
                        $db->select('author', 'mail', 'text', 'created')
                            ->from('table.comments')
                            ->where('coid = ?', $parentId)
                            ->limit(1)
                    );
                } catch (\Throwable $e) {
                    $parent = [];
                }

                $parentMail = trim((string) ($parent['mail'] ?? ''));
                if ($parentMail === '' || filter_var($parentMail, FILTER_VALIDATE_EMAIL) === false) {
                    return;
                }

                // 避免自己回复自己 / 回复到发件邮箱
                if ($commentMail !== '' && strcasecmp($parentMail, $commentMail) === 0) {
                    return;
                }
                if ($smtpFrom !== '' && strcasecmp($parentMail, $smtpFrom) === 0) {
                    return;
                }
                // 避免发送给站长收件邮箱（CommentNotifier 行为）
                if (!empty($adminToMails) && isset($adminToMails[strtolower($parentMail)])) {
                    return;
                }

                $parentAuthor = (string) ($parent['author'] ?? '');
                $parentText = (string) ($parent['text'] ?? '');
                $parentCreated = (int) ($parent['created'] ?? 0);
                $parentTime = $parentCreated > 0 ? date('Y-m-d H:i:s', $parentCreated) : '';
                if ($parentTime === '') {
                    $parentTime = $commentTime;
                }

                $template = trim((string) ($options->v3a_mail_comment_reply_template ?? ''));
                if ($template === '') {
                    $template = self::defaultCommentReplyMailTemplate();
                }

                $vars = [
                    'siteTitle' => htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8'),
                    'siteUrl' => htmlspecialchars($siteUrl, ENT_QUOTES, 'UTF-8'),
                    'postTitle' => htmlspecialchars($postTitle !== '' ? $postTitle : '（未知文章）', ENT_QUOTES, 'UTF-8'),
                    'postUrl' => htmlspecialchars($postUrl !== '' ? $postUrl : (string) ($options->siteUrl ?? ''), ENT_QUOTES, 'UTF-8'),
                    'parentAuthor' => htmlspecialchars($parentAuthor !== '' ? $parentAuthor : '（匿名）', ENT_QUOTES, 'UTF-8'),
                    'parentTime' => htmlspecialchars($parentTime, ENT_QUOTES, 'UTF-8'),
                    'parentText' => nl2br(htmlspecialchars($parentText, ENT_QUOTES, 'UTF-8')),
                    'replyAuthor' => htmlspecialchars($commentAuthor !== '' ? $commentAuthor : '（匿名）', ENT_QUOTES, 'UTF-8'),
                    'replyTime' => htmlspecialchars($commentTime, ENT_QUOTES, 'UTF-8'),
                    'replyText' => nl2br(htmlspecialchars($commentText, ENT_QUOTES, 'UTF-8')),
                ];

                $bodyHtml = self::renderMailTemplate($template, $vars);
                $subject = '你在[' . ($postTitle !== '' ? $postTitle : $siteTitle) . ']的评论有了新的回复';

                self::sendMailBySmtp(
                    'comment_reply',
                    $smtp,
                    $siteTitle,
                    [['mail' => $parentMail, 'name' => $parentAuthor]],
                    $subject,
                    $bodyHtml,
                    '已发送至：' . $parentMail
                );
            }
        } catch (\Throwable $e) {
        }
    }

    /**
     * 评论后台标记（审核通过）时触发：用于“需要审核”场景下的通知补发（文章作者 / 被回复者）。
     *
     * @param mixed $comment
     * @param mixed $edit
     * @param mixed $status
     */
    public static function notifyCommentMark($comment, $edit, $status): void
    {
        try {
            $s = strtolower(trim((string) $status));
            if ($s !== 'approved') {
                return;
            }

            // Only send when status actually changes to approved.
            try {
                $prev = '';
                if (is_array($comment)) {
                    $prev = (string) ($comment['status'] ?? '');
                } elseif (is_object($comment)) {
                    $prev = (string) ($comment->status ?? '');
                }
                if (strtolower(trim($prev)) === 'approved') {
                    return;
                }
            } catch (\Throwable $e) {
            }

            // Ensure status is visible to notifyComment.
            if (is_object($edit)) {
                try {
                    $edit->status = 'approved';
                } catch (\Throwable $e) {
                }
            }

            // Mark 场景下发送“文章作者/回复提醒”，并避免管理员重复提醒。
            self::notifyComment($edit, false);
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

            $siteTitle = (string) ($options->title ?? 'Typecho');
            $siteUrl = rtrim((string) ($options->siteUrl ?? ''), "/");
            $reviewUrl = $siteUrl !== '' ? ($siteUrl . '/' . self::ADMIN_DIR . '/#/friends?state=1') : '';

            $admins = self::parseMailRecipients((string) ($options->v3a_mail_admin_to ?? ''), $siteTitle);

            // 收件人：所有管理员（当未配置“站长收件邮箱”时）
            if (empty($admins)) {
                try {
                    $db = Db::get();
                } catch (\Throwable $e) {
                    return;
                }

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

            $vars = [
                'siteTitle' => htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8'),
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
     * 友链审核结果通知（发送给申请者邮箱）
     *
     * @param array<string,mixed> $apply
     * @param string $action pass|reject
     */
    public static function notifyFriendLinkAudit(array $apply, string $action): void
    {
        try {
            $options = \Utils\Helper::options();

            if (!((int) ($options->v3a_mail_enabled ?? 0))) {
                return;
            }
            if (!((int) ($options->v3a_mail_friendlink_audit_en ?? 0))) {
                return;
            }

            $action = strtolower(trim($action));
            if (!in_array($action, ['pass', 'reject'], true)) {
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

            $kind = $action === 'pass' ? 'friendlink_audit_pass' : 'friendlink_audit_reject';
            if ($smtpHost === '' || $smtpPort <= 0 || $smtpUser === '' || $smtpPass === '' || $smtpFrom === '') {
                self::recordMailError($kind, 'SMTP 配置不完整或未保存密码，请在「设定 → 邮件通知设置」完善后重试。');
                return;
            }

            $toMail = trim((string) ($apply['email'] ?? ''));
            if ($toMail === '' || filter_var($toMail, FILTER_VALIDATE_EMAIL) === false) {
                return;
            }

            $siteTitle = (string) ($options->title ?? 'Typecho');
            $siteUrl = rtrim((string) ($options->siteUrl ?? ''), "/");

            $linkName = trim((string) ($apply['name'] ?? ''));
            $linkUrl = trim((string) ($apply['url'] ?? ''));
            $linkAvatar = trim((string) ($apply['avatar'] ?? ''));
            $linkDescription = trim((string) ($apply['description'] ?? ''));
            $linkType = strtolower(trim((string) ($apply['type'] ?? 'friend')));
            $linkMessage = trim((string) ($apply['message'] ?? ''));
            $created = (int) ($apply['created'] ?? 0);

            $applyTime = $created > 0 ? date('Y-m-d H:i:s', $created) : date('Y-m-d H:i:s');
            $auditTime = date('Y-m-d H:i:s');

            $typeLabel = $linkType === 'collection' ? '收藏' : '朋友';
            $resultLabel = $action === 'pass' ? '通过' : '拒绝';

            if (!self::loadPHPMailer()) {
                self::recordMailError($kind, '未找到 PHPMailer，无法发送邮件（请检查 Vue3Admin 插件目录 lib/PHPMailer 是否完整）。');
                return;
            }

            $template = '';
            if ($action === 'pass') {
                $template = trim((string) ($options->v3a_mail_friendlink_audit_pass ?? ''));
                if ($template === '') {
                    $template = self::defaultFriendLinkAuditPassMailTemplate();
                }
            } else {
                $template = trim((string) ($options->v3a_mail_friendlink_audit_reject ?? ''));
                if ($template === '') {
                    $template = self::defaultFriendLinkAuditRejectMailTemplate();
                }
            }

            $vars = [
                'siteTitle' => htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8'),
                'siteUrl' => htmlspecialchars($siteUrl, ENT_QUOTES, 'UTF-8'),
                'auditResult' => htmlspecialchars($resultLabel, ENT_QUOTES, 'UTF-8'),
                'auditTime' => htmlspecialchars($auditTime, ENT_QUOTES, 'UTF-8'),
                'linkName' => htmlspecialchars($linkName !== '' ? $linkName : '（未填写）', ENT_QUOTES, 'UTF-8'),
                'linkUrl' => htmlspecialchars($linkUrl !== '' ? $linkUrl : ($siteUrl !== '' ? $siteUrl : ''), ENT_QUOTES, 'UTF-8'),
                'linkType' => htmlspecialchars($typeLabel, ENT_QUOTES, 'UTF-8'),
                'linkEmail' => htmlspecialchars($toMail, ENT_QUOTES, 'UTF-8'),
                'linkAvatar' => htmlspecialchars($linkAvatar, ENT_QUOTES, 'UTF-8'),
                'linkDescription' => htmlspecialchars($linkDescription !== '' ? $linkDescription : '（未填写）', ENT_QUOTES, 'UTF-8'),
                'linkMessage' => nl2br(htmlspecialchars($linkMessage !== '' ? $linkMessage : '（未填写）', ENT_QUOTES, 'UTF-8')),
                'applyTime' => htmlspecialchars($applyTime, ENT_QUOTES, 'UTF-8'),
            ];

            $bodyHtml = self::renderMailTemplate($template, $vars);
            $subject = ($action === 'pass' ? '友链申请已通过：' : '友链申请未通过：') . ($linkName !== '' ? $linkName : $siteTitle);

            $smtp = [
                'host' => $smtpHost,
                'port' => $smtpPort,
                'user' => $smtpUser,
                'pass' => $smtpPass,
                'from' => $smtpFrom,
                'secure' => $smtpSecure,
            ];

            self::sendMailBySmtp(
                $kind,
                $smtp,
                $siteTitle,
                [['mail' => $toMail, 'name' => $linkName !== '' ? $linkName : $toMail]],
                $subject,
                $bodyHtml,
                '已发送至：' . $toMail
            );
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

    /**
     * Parse "a@x.com,b@y.com" / "a@x.com b@y.com" to recipients.
     *
     * @return array<int,array{mail:string,name:string}>
     */
    private static function parseMailRecipients(string $raw, string $defaultName): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [];
        }

        $parts = preg_split('/[\\s,;]+/', $raw, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($parts) || empty($parts)) {
            return [];
        }

        $seen = [];
        $out = [];
        foreach ($parts as $p) {
            $mail = trim((string) $p);
            if ($mail === '') {
                continue;
            }

            $key = strtolower($mail);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            if (!filter_var($mail, FILTER_VALIDATE_EMAIL)) {
                continue;
            }

            $out[] = ['mail' => $mail, 'name' => $defaultName];
        }

        return $out;
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

    private static function defaultCommentWaitingMailTemplate(): string
    {
        $tpl = <<<'HTML'
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">收到一条待审核评论</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>文章：</strong><a href="{{postUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{postTitle}}</a></div>
      <div style="margin-bottom: 8px;"><strong>作者：</strong>{{commentAuthor}}</div>
      <div style="margin-bottom: 8px;"><strong>状态：</strong>{{commentStatus}}</div>
      <div style="margin-bottom: 12px;"><strong>时间：</strong>{{commentTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{commentText}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      <a href="{{reviewUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">前往审核</a>
    </div>
  </div>
</div>
HTML;

        return trim($tpl);
    }

    private static function defaultCommentReplyMailTemplate(): string
    {
        $tpl = <<<'HTML'
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">你的评论有了新的回复</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>文章：</strong><a href="{{postUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{postTitle}}</a></div>
      <div style="margin-bottom: 12px; font-size: 12px; color: #666;">
        <div><strong>你的昵称：</strong>{{parentAuthor}}</div>
        <div><strong>你的评论时间：</strong>{{parentTime}}</div>
        <div><strong>回复时间：</strong>{{replyTime}}</div>
      </div>
      <div style="margin-bottom: 8px;"><strong>你的评论：</strong></div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px; margin-bottom: 12px;">{{parentText}}</div>
      <div style="margin-bottom: 8px;"><strong>{{replyAuthor}}</strong> 回复说：</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{replyText}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      <a href="{{postUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">查看完整内容</a>
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

    private static function defaultFriendLinkAuditPassMailTemplate(): string
    {
        $tpl = <<<'HTML'
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">你的友链申请已通过</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>结果：</strong>{{auditResult}}</div>
      <div style="margin-bottom: 12px;"><strong>审核时间：</strong>{{auditTime}}</div>
      <div style="margin-bottom: 8px;"><strong>名称：</strong>{{linkName}}</div>
      <div style="margin-bottom: 8px;"><strong>网址：</strong><a href="{{linkUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{linkUrl}}</a></div>
      <div style="margin-bottom: 8px;"><strong>类型：</strong>{{linkType}}</div>
      <div style="margin-bottom: 8px;"><strong>邮箱：</strong>{{linkEmail}}</div>
      <div style="margin-bottom: 8px;"><strong>头像：</strong>{{linkAvatar}}</div>
      <div style="margin-bottom: 8px;"><strong>描述：</strong>{{linkDescription}}</div>
      <div style="margin-bottom: 12px;"><strong>申请时间：</strong>{{applyTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{linkMessage}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      感谢你的申请！
    </div>
  </div>
</div>
HTML;

        return trim($tpl);
    }

    private static function defaultFriendLinkAuditRejectMailTemplate(): string
    {
        $tpl = <<<'HTML'
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">你的友链申请未通过</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>结果：</strong>{{auditResult}}</div>
      <div style="margin-bottom: 12px;"><strong>审核时间：</strong>{{auditTime}}</div>
      <div style="margin-bottom: 8px;"><strong>名称：</strong>{{linkName}}</div>
      <div style="margin-bottom: 8px;"><strong>网址：</strong><a href="{{linkUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{linkUrl}}</a></div>
      <div style="margin-bottom: 8px;"><strong>类型：</strong>{{linkType}}</div>
      <div style="margin-bottom: 8px;"><strong>邮箱：</strong>{{linkEmail}}</div>
      <div style="margin-bottom: 8px;"><strong>头像：</strong>{{linkAvatar}}</div>
      <div style="margin-bottom: 8px;"><strong>描述：</strong>{{linkDescription}}</div>
      <div style="margin-bottom: 12px;"><strong>申请时间：</strong>{{applyTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{linkMessage}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      如需修改信息后重新申请，请回复本邮件或通过网站提交。
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
            self::redirectLegacyAdminRequest();

            static $runtimeInit = false;
            if (!$runtimeInit) {
                $runtimeInit = true;
                self::ensureLocalStorage();
                self::ensureDefaultRegisterGroupOption();
                self::ensureAclConfigOption();
                self::ensureCommentMailHooks();
                \Typecho\Plugin::factory('Widget_Register')->register = __CLASS__ . '::filterRegisterGroup';
                \Typecho\Plugin::factory('Widget_Register')->finishRegister = __CLASS__ . '::finishRegister';
                \Typecho\Plugin::factory('Widget_Upload')->uploadHandle = __CLASS__ . '::uploadHandle';
                \Typecho\Plugin::factory('Widget_Feedback')->comment = __CLASS__ . '::aiModerateComment';
                \Typecho\Plugin::factory('Widget_Abstract_Contents')->filter = __CLASS__ . '::aiTranslateContentsFilter';
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

    /**
     * 前台语言前缀：/en/... /zh/... /ja/...（仅在启用 AI 翻译后生效）。
     * - 将语言写入 self::$aiLang
     * - 剥离 URL 前缀以匹配 Typecho 路由
     * - 修改 options->index 以便生成带语言前缀的链接（不影响静态资源地址）
     */
    private static function initAiFrontendLangPrefix(): void
    {
        self::$aiLang = '';

        if (defined('__TYPECHO_ADMIN__')) {
            return;
        }

        try {
            $options = \Widget\Options::alloc();
        } catch (\Throwable $e) {
            return;
        }

        $cfg = [];
        try {
            $cfg = Ai::getConfig($options);
        } catch (\Throwable $e) {
            $cfg = [];
        }

        if (empty($cfg['enabled']) || empty($cfg['features']['translate'])) {
            return;
        }

        $langs = (array) ($cfg['languages'] ?? []);
        if (empty($langs)) {
            return;
        }

        $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '');
        if (trim($requestUri) === '') {
            return;
        }

        $path = (string) (parse_url($requestUri, PHP_URL_PATH) ?? '');
        $query = (string) (parse_url($requestUri, PHP_URL_QUERY) ?? '');
        if ($path === '') {
            return;
        }

        // Handle site installed in subdirectory.
        $rootPath = '';
        try {
            $rootUrl = (string) ($options->rootUrl ?? '');
            $rootPath = (string) (parse_url($rootUrl, PHP_URL_PATH) ?? '');
        } catch (\Throwable $e) {
            $rootPath = '';
        }
        $rootPath = '/' . trim($rootPath, '/');
        if ($rootPath === '/') {
            $rootPath = '';
        }

        $relPath = $path;
        if ($rootPath !== '' && 0 === strpos($path, $rootPath)) {
            $relPath = substr($path, strlen($rootPath));
            if ($relPath === '') {
                $relPath = '/';
            }
        }

        $rel = ltrim((string) $relPath, '/');
        if ($rel === '') {
            return;
        }

        $seg = strtok($rel, '/');
        $seg = strtolower(trim((string) $seg));
        if ($seg === '') {
            return;
        }

        if (!in_array($seg, $langs, true)) {
            return;
        }

        self::$aiLang = $seg;

        // Strip language prefix for routing.
        $rest = substr($rel, strlen($seg));
        $rest = ltrim((string) $rest, '/');
        $newRelPath = $rest !== '' ? '/' . $rest : '/';
        $newPath = ($rootPath !== '' ? $rootPath : '') . $newRelPath;
        if ($newPath === '') {
            $newPath = '/';
        }

        $newRequestUri = $newPath . ($query !== '' ? '?' . $query : '');
        $_SERVER['REQUEST_URI'] = $newRequestUri;

        // Update Request singleton cache if it was already initialized.
        try {
            $req = \Typecho\Request::getInstance();
            $ref = new \ReflectionObject($req);
            foreach (['requestUri' => $newRequestUri, 'pathInfo' => null] as $k => $v) {
                if (!$ref->hasProperty($k)) {
                    continue;
                }
                $prop = $ref->getProperty($k);
                $prop->setAccessible(true);
                $prop->setValue($req, $v);
            }
        } catch (\Throwable $e) {
        }

        // Make generated URLs keep the language prefix.
        try {
            $index = (string) ($options->index ?? '');
            $index = rtrim($index, '/');
            $options->index = $index . '/' . self::$aiLang;
        } catch (\Throwable $e) {
        }
    }

    /**
     * AI 评论审核：approve / waiting / spam
     *
     * @param array $comment
     * @param mixed $content
     * @return array
     */
    public static function aiModerateComment(array $comment, $content): array
    {
        try {
            $options = \Widget\Options::alloc();
        } catch (\Throwable $e) {
            return $comment;
        }

        try {
            $cfg = Ai::getRuntimeConfig($options);
        } catch (\Throwable $e) {
            return $comment;
        }

        if (empty($cfg['enabled']) || empty($cfg['features']['comment']) || empty($cfg['apiKey'])) {
            return $comment;
        }

        // Speed: only send "risky" comments to AI to avoid blocking submission.
        try {
            if (!Ai::isCommentRisky($comment)) {
                return $comment;
            }
        } catch (\Throwable $e) {
        }

        $siteUrl = '';
        try {
            $siteUrl = (string) ($options->siteUrl ?? '');
        } catch (\Throwable $e) {
            $siteUrl = '';
        }

        $context = [];
        try {
            $postTitle = '';
            $postUrl = '';
            $postCid = 0;
            $postType = '';
            if (is_object($content)) {
                $postTitle = (string) ($content->title ?? '');
                $postUrl = (string) ($content->permalink ?? '');
                $postCid = (int) ($content->cid ?? 0);
                $postType = (string) ($content->type ?? '');
            } elseif (is_array($content)) {
                $postTitle = (string) ($content['title'] ?? '');
                $postUrl = (string) ($content['permalink'] ?? '');
                $postCid = (int) ($content['cid'] ?? 0);
                $postType = (string) ($content['type'] ?? '');
            }

            if ($postTitle !== '') {
                $context['postTitle'] = $postTitle;
            }
            if ($postUrl !== '') {
                $context['postUrl'] = $postUrl;
            }
            if ($postCid > 0) {
                $context['cid'] = $postCid;
            }
            if ($postType !== '') {
                $context['type'] = $postType;
            }
        } catch (\Throwable $e) {
            $context = [];
        }

        try {
            $res = Ai::moderateComment($cfg, $comment, $siteUrl, $context);
            $action = strtolower(trim((string) ($res['action'] ?? 'waiting')));
            if ($action === 'approve') {
                $comment['status'] = 'approved';
            } elseif ($action === 'spam') {
                $comment['status'] = 'spam';
            } else {
                $comment['status'] = 'waiting';
            }
        } catch (\Throwable $e) {
            // AI 审核失败时不影响正常评论流程，沿用原状态。
        }

        return $comment;
    }

    /**
     * 前台翻译输出：根据 self::$aiLang 从本地数据中读取翻译并替换 title/text。
     *
     * @param array $row
     * @param mixed $contents
     * @return array
     */
    public static function aiTranslateContentsFilter(array $row, $contents): array
    {
        if (defined('__TYPECHO_ADMIN__')) {
            return $row;
        }

        $lang = (string) self::$aiLang;
        if ($lang === '') {
            return $row;
        }

        $cid = (int) ($row['cid'] ?? 0);
        if ($cid <= 0) {
            return $row;
        }

        $type = strtolower(trim((string) ($row['type'] ?? '')));
        if ($type === '') {
            return $row;
        }

        $ctype = '';
        if ($type === 'page' || $type === 'page_draft') {
            $ctype = 'page';
        } elseif ($type === 'post' || $type === 'post_draft') {
            $ctype = 'post';
        } else {
            return $row;
        }

        try {
            $tr = Ai::getTranslation($cid, $ctype, $lang);
        } catch (\Throwable $e) {
            $tr = null;
        }

        if (!$tr || !is_array($tr)) {
            return $row;
        }

        $title = trim((string) ($tr['title'] ?? ''));
        $text = (string) ($tr['text'] ?? '');
        $isMarkdown = 0 === strpos((string) ($row['text'] ?? ''), '<!--markdown-->');

        if ($title !== '') {
            $row['title'] = $title;
        }
        if (trim($text) !== '') {
            if ($isMarkdown && 0 !== strpos($text, '<!--markdown-->')) {
                $row['text'] = '<!--markdown-->' . $text;
            } else {
                $row['text'] = $text;
            }
        }

        return $row;
    }

    private static function redirectLegacyAdminRequest(): void
    {
        if (!defined('__TYPECHO_ADMIN__') || !defined('__TYPECHO_ADMIN_DIR__')) {
            return;
        }

        $adminDir = '/' . trim((string) __TYPECHO_ADMIN_DIR__, '/') . '/';
        if ('/admin/' === strtolower($adminDir)) {
            return;
        }

        $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
        if ('' === $scriptName) {
            return;
        }

        $scriptDir = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
        if ('admin' !== strtolower((string) basename($scriptDir))) {
            return;
        }

        $basePath = (string) substr($scriptDir, 0, -strlen('/admin'));
        $target = rtrim($basePath, '/') . $adminDir;
        if ('' === $target) {
            $target = $adminDir;
        }

        $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '');
        $requestPath = (string) (parse_url($requestUri, PHP_URL_PATH) ?? '');
        if ('' !== $requestPath && 0 === strpos($requestPath, rtrim($target, '/'))) {
            return;
        }

        if (!headers_sent()) {
            header('Location: ' . \Typecho\Common::safeUrl($target), true, 302);
            exit;
        }
    }

    private static function ensureLocalStorage(): void
    {
        try {
            LocalStorage::pdo();
        } catch (\Throwable $e) {
        }
    }

    private static function ensureCommentMailHooks(): void
    {
        $callbackFinish = __CLASS__ . '::notifyComment';
        $callbackMark = __CLASS__ . '::notifyCommentMark';

        try {
            $plugins = \Typecho\Plugin::export();
        } catch (\Throwable $e) {
            $plugins = [];
        }

        $handles = [];
        try {
            $handles = (array) ($plugins['handles'] ?? []);
        } catch (\Throwable $e) {
            $handles = [];
        }

        $handleName = \Typecho\Common::nativeClassName('Widget\\Comments\\Edit');
        $keyFinish = $handleName . ':finishComment';
        $keyMark = $handleName . ':mark';

        $hasCallback = static function (array $callbacks, string $needle): bool {
            foreach ($callbacks as $cb) {
                if ($cb === $needle) {
                    return true;
                }
                if (is_string($cb) && ltrim($cb, '\\') === ltrim($needle, '\\')) {
                    return true;
                }
                if (is_array($cb) && count($cb) === 2) {
                    $a0 = is_string($cb[0] ?? null) ? (string) $cb[0] : '';
                    $a1 = is_string($cb[1] ?? null) ? (string) $cb[1] : '';
                    if ($a0 !== '' && $a1 !== '' && (ltrim($a0, '\\') . '::' . $a1) === ltrim($needle, '\\')) {
                        return true;
                    }
                }
            }
            return false;
        };

        try {
            $existing = isset($handles[$keyFinish]) && is_array($handles[$keyFinish]) ? $handles[$keyFinish] : [];
            if (!$hasCallback($existing, $callbackFinish)) {
                \Widget\Comments\Edit::pluginHandle()->finishComment = $callbackFinish;
            }
        } catch (\Throwable $e) {
        }

        try {
            $existing = isset($handles[$keyMark]) && is_array($handles[$keyMark]) ? $handles[$keyMark] : [];
            if (!$hasCallback($existing, $callbackMark)) {
                \Widget\Comments\Edit::pluginHandle()->mark = $callbackMark;
            }
        } catch (\Throwable $e) {
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

}
