# Vue3Admin

基于现代化风格的 Typecho 后台面板插件（Vue3Admin）。

> 重要：只有当 **Release** 发布后才能使用。
>
> 当前仓库为**测试/开发版本**，功能与接口可能随时调整，请勿直接用于生产环境。

- QQ 群：`556339740`

## 功能概览

- 启用后接管 Typecho 后台路径：把后台切换到 `/<Vue3Admin>/`（默认：`/Vue3Admin/`）。
- 自动部署后台资源到站点根目录：`/Vue3Admin/`。
- 访问统计：前台访问会写入访问日志表（用于仪表盘统计数据）。

## 安装与启用

> 请使用 Release 页面提供的打包文件进行安装。

1. 将插件目录上传到：`usr/plugins/Vue3Admin/`。
2. 在 Typecho 后台插件管理中启用 **Vue3Admin**。

启用后插件会自动：

1. 复制插件内置的 `admin/` 到站点根目录：`/Vue3Admin/`。
2. 修改站点根目录 `config.inc.php` 内的 `__TYPECHO_ADMIN_DIR__` 为 `/Vue3Admin/`，从而“弃用”旧的 `/admin/`。

完成后请通过 `https://你的域名/Vue3Admin/` 访问新后台。

## 配置项

在插件设置中可配置：

- 主色（Primary Color）：用于面板主题色（CSS 变量）。
- Vue3 CDN：默认使用 `https://unpkg.com/`。
- ECharts CDN：默认使用 `https://cdn.jsdelivr.net/`。

如站点环境无法访问外网 CDN，请替换为自建静态资源地址。

## 数据库

插件会自动创建/升级数据表（表前缀统一使用 `v3a_`，实际表名会拼接 Typecho 表前缀，例如 `typecho_v3a_visit_log`）。

## 停用与恢复

在插件管理中停用 **Vue3Admin** 后：

- 会把 `__TYPECHO_ADMIN_DIR__` 改回 `/admin/`（恢复默认后台路径）。

可选操作（手动）：

- 删除站点根目录的 `/Vue3Admin/`。

## 注意事项（必读）

- 插件会改写 `config.inc.php`，并在首次改写时自动备份到 `config.inc.php.vue3admin.bak`。
- 请确保 PHP 进程对站点根目录与 `config.inc.php` 具备写权限，否则启用会失败。
- 如出现无法进入后台的情况，可手动把 `config.inc.php` 中的 `__TYPECHO_ADMIN_DIR__` 恢复为 `/admin/`，或用备份文件回滚。

## 交流与反馈

- QQ 群：`556339740`

