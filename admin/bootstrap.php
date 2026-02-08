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

/**
 * 兼容 Typecho 1.2.1：修复被错误写成 JSON 的核心序列化选项。
 * 这些选项必须是 serialize() 格式，否则会在 Widget\Init 阶段触发 TypeError。
 */
if (!function_exists('v3a_repair_serialized_option')) {
    function v3a_repair_serialized_option(string $name): void
    {
        try {
            $db = \Typecho\Db::get();
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
                \Typecho\Db::WRITE
            );
        } catch (\Throwable $e) {
        }
    }
}

v3a_repair_serialized_option('plugins');
v3a_repair_serialized_option('routingTable');

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
