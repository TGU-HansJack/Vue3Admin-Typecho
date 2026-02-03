<?php

if (!defined('__DIR__')) {
    define('__DIR__', dirname(__FILE__));
}

define('__TYPECHO_ADMIN__', true);

/** 加载配置文件 */
if (!defined('__TYPECHO_ROOT_DIR__') && !@include_once __DIR__ . '/../config.inc.php') {
    file_exists(__DIR__ . '/../install.php') ? header('Location: ../install.php') : print('Missing Config File');
    exit;
}

/** 初始化组件 */
\Widget\Init::alloc();

/** 兼容旧后台插件钩子 */
\Typecho\Plugin::factory('admin/common.php')->call('begin');

\Widget\Options::alloc()->to($options);
\Widget\User::alloc()->to($user);
\Widget\Security::alloc()->to($security);

// Default personal options (keep consistent with old admin UX).
// Markdown should be enabled by default unless the user explicitly disabled it.
try {
    if ($user->hasLogin()) {
        $uid = (int) ($user->uid ?? 0);
        if ($uid > 0) {
            $db = \Typecho\Db::get();
            $exists = (int) ($db->fetchObject(
                $db->select(['COUNT(*)' => 'num'])
                    ->from('table.options')
                    ->where('name = ? AND user = ?', 'markdown', $uid)
            )->num ?? 0);

            if ($exists <= 0) {
                $options->markdown = 1;
            }
        }
    }
} catch (\Throwable $e) {
}

/** 初始化上下文 */
$request = $options->request;
$response = $options->response;
