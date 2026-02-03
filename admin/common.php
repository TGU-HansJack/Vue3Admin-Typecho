<?php

require_once __DIR__ . '/bootstrap.php';

if (!$user->hasLogin()) {
    $isAjax = strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'xmlhttprequest';
    $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
    if ($isAjax || strpos($accept, 'application/json') !== false) {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(
            ['code' => 401, 'message' => 'Unauthorized', 'data' => null],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        exit;
    }

    $referer = $request->getRequestUri();
    $response->redirect(
        \Typecho\Common::url('login.php', $options->adminUrl) . '?referer=' . urlencode((string) $referer)
    );
    exit;
}

// Console access: subscriber+ (visitor cannot enter admin like old Typecho)
try {
    if (!$user->pass('subscriber', true)) {
        $isAjax = strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'xmlhttprequest';
        $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
        if ($isAjax || strpos($accept, 'application/json') !== false) {
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode(
                ['code' => 403, 'message' => 'Forbidden', 'data' => null],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
            exit;
        }

        if (isset($response) && method_exists($response, 'setStatus')) {
            $response->setStatus(403);
        } else {
            http_response_code(403);
        }

        echo 'Forbidden';
        exit;
    }
} catch (\Throwable $e) {
}

// 权限控制由前端路由与 API 细分处理（参考 Typecho 旧后台菜单权限）。
