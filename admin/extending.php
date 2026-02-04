<?php

/**
 * Legacy plugin panel bridge for Vue3Admin.
 *
 * Typecho plugins register panels via Helper::addPanel(), which points to
 * extending.php?panel=... under current adminUrl. When Vue3Admin replaces the
 * admin directory, we still need a compatible endpoint to load those panels.
 *
 * Note: Most legacy panels include 'header.php' / 'menu.php' using relative
 * paths, so we chdir() into the original /admin directory before requiring.
 */

$root = dirname(__FILE__);
$coreAdminDir = realpath($root . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'admin');

if (!$coreAdminDir || !is_dir($coreAdminDir)) {
    http_response_code(500);
    echo 'Missing admin directory';
    exit;
}

chdir($coreAdminDir);
require_once $coreAdminDir . DIRECTORY_SEPARATOR . 'common.php';

$panel = trim((string) $request->get('panel'));
$panelTable = (array) ($options->panelTable ?? []);

if ($panel === '') {
    throw new \Typecho\Plugin\Exception(_t('页面不存在'), 404);
}

if (!isset($panelTable['file']) || !is_array($panelTable['file']) || !in_array(urlencode($panel), $panelTable['file'])) {
    throw new \Typecho\Plugin\Exception(_t('页面不存在'), 404);
}

if (strpos(trim($panel, '/'), '/') === false) {
    throw new \Typecho\Plugin\Exception(_t('页面不存在'), 404);
}

[$pluginName, $file] = explode('/', trim($panel, '/'), 2);

require_once $options->pluginDir($pluginName) . '/' . $file;

