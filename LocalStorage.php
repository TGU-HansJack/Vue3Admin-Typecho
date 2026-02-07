<?php

namespace TypechoPlugin\Vue3Admin;

use Typecho\Db;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

final class LocalStorage
{
    private const DIR = __DIR__ . '/cache';
    private const DB_FILE = self::DIR . '/v3a_data.sqlite';
    private const EXPORT_DIR = self::DIR . '/exports';
    private const TMP_DIR = self::DIR . '/tmp';

    /** @var \PDO|null */
    private static $pdo = null;

    /** @var string */
    private static $pdoPath = '';

    public static function isAvailable(): bool
    {
        return extension_loaded('pdo_sqlite') && class_exists('\\PDO');
    }

    public static function dbPath(): string
    {
        return self::DB_FILE;
    }

    public static function exportDir(): string
    {
        return self::EXPORT_DIR;
    }

    private static function ensureDir(string $dir): void
    {
        if (is_dir($dir)) {
            return;
        }
        @mkdir($dir, 0755, true);
    }

    private static function ensureDirs(): void
    {
        self::ensureDir(self::DIR);
        self::ensureDir(self::EXPORT_DIR);
        self::ensureDir(self::TMP_DIR);
    }

    /**
     * @return \PDO|null
     */
    public static function pdo(): ?\PDO
    {
        if (!self::isAvailable()) {
            return null;
        }

        $path = self::DB_FILE;
        if (self::$pdo instanceof \PDO && self::$pdoPath === $path) {
            return self::$pdo;
        }

        try {
            self::ensureDirs();
            $pdo = self::openPdo($path);
            self::$pdo = $pdo;
            self::$pdoPath = $path;
            return $pdo;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function pdoOrFail(): \PDO
    {
        $pdo = self::pdo();
        if (!$pdo) {
            throw new \RuntimeException('Local storage unavailable: please enable PHP extension pdo_sqlite.');
        }
        return $pdo;
    }

    private static function openPdo(string $path): \PDO
    {
        $pdo = new \PDO('sqlite:' . $path);
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);

        try {
            $pdo->exec('PRAGMA journal_mode = WAL;');
        } catch (\Throwable $e) {
        }
        try {
            $pdo->exec('PRAGMA synchronous = NORMAL;');
        } catch (\Throwable $e) {
        }
        try {
            $pdo->exec('PRAGMA temp_store = MEMORY;');
        } catch (\Throwable $e) {
        }

        self::initSchema($pdo);
        return $pdo;
    }

    private static function initSchema(\PDO $pdo): void
    {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS v3a_visit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT NOT NULL DEFAULT '',
                uri TEXT NOT NULL DEFAULT '',
                cid INTEGER NULL,
                ctype TEXT NOT NULL DEFAULT '',
                referer TEXT NULL,
                ua TEXT NULL,
                created INTEGER NOT NULL DEFAULT 0
            );"
        );
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_visit_created ON v3a_visit_log(created);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_visit_ip ON v3a_visit_log(ip);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_visit_cid ON v3a_visit_log(cid);");

        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS v3a_api_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT NOT NULL DEFAULT '',
                method TEXT NOT NULL DEFAULT 'GET',
                path TEXT NOT NULL DEFAULT '',
                query TEXT NULL,
                created INTEGER NOT NULL DEFAULT 0
            );"
        );
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_api_created ON v3a_api_log(created);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_api_ip ON v3a_api_log(ip);");

        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS v3a_friend_link (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT '',
                url TEXT NOT NULL DEFAULT '',
                avatar TEXT NULL,
                description TEXT NULL,
                type TEXT NOT NULL DEFAULT 'friend',
                email TEXT NOT NULL DEFAULT '',
                status INTEGER NOT NULL DEFAULT 0,
                created INTEGER NOT NULL DEFAULT 0
            );"
        );
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_friend_status ON v3a_friend_link(status);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_friend_created ON v3a_friend_link(created);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_friend_url ON v3a_friend_link(url);");

        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS v3a_friend_link_apply (
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
            );"
        );
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_apply_status ON v3a_friend_link_apply(status);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_apply_created ON v3a_friend_link_apply(created);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_apply_url ON v3a_friend_link_apply(url);");

        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS v3a_subscribe (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL DEFAULT '',
                status INTEGER NOT NULL DEFAULT 1,
                created INTEGER NOT NULL DEFAULT 0
            );"
        );
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_subscribe_status ON v3a_subscribe(status);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_subscribe_created ON v3a_subscribe(created);");

        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS v3a_like (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL DEFAULT 'site',
                cid INTEGER NULL,
                ip TEXT NOT NULL DEFAULT '',
                created INTEGER NOT NULL DEFAULT 0
            );"
        );
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_like_type ON v3a_like(type);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_like_cid ON v3a_like(cid);");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_v3a_like_created ON v3a_like(created);");
    }

    private static function truncate(string $value, int $max = 255): string
    {
        $s = trim($value);
        if ($s === '') {
            return '';
        }

        if (function_exists('mb_substr')) {
            return (string) mb_substr($s, 0, $max);
        }

        return substr($s, 0, $max);
    }

    public static function logVisit(
        string $ip,
        string $uri,
        ?int $cid = null,
        string $ctype = '',
        string $referer = '',
        string $ua = '',
        int $created = 0
    ): bool {
        $pdo = self::pdo();
        if (!$pdo) {
            return false;
        }

        $ip = trim($ip);
        if ($ip === '' || $ip === 'unknown') {
            return false;
        }

        $uri = self::truncate($uri, 255);
        if ($uri === '') {
            return false;
        }

        $created = $created > 0 ? $created : time();
        $since = $created - 10;

        try {
            $stmt = $pdo->prepare(
                'SELECT COUNT(id) AS num FROM v3a_visit_log WHERE ip = :ip AND uri = :uri AND created >= :since'
            );
            $stmt->execute([
                ':ip' => $ip,
                ':uri' => $uri,
                ':since' => $since,
            ]);
            $dup = (int) ($stmt->fetchColumn() ?: 0);
            if ($dup > 0) {
                return false;
            }
        } catch (\Throwable $e) {
        }

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO v3a_visit_log (ip, uri, cid, ctype, referer, ua, created) VALUES (:ip,:uri,:cid,:ctype,:referer,:ua,:created)'
            );
            $stmt->execute([
                ':ip' => $ip,
                ':uri' => $uri,
                ':cid' => $cid,
                ':ctype' => self::truncate(strtolower(trim($ctype)), 20),
                ':referer' => $referer === '' ? null : self::truncate($referer, 255),
                ':ua' => $ua === '' ? null : self::truncate($ua, 255),
                ':created' => $created,
            ]);
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    private static function safeBasename(string $file): string
    {
        $base = basename($file);
        $base = preg_replace('/[^0-9A-Za-z._-]+/', '_', (string) $base);
        return (string) $base;
    }

    /**
     * @return array{file:string,size:int,time:int}
     */
    public static function exportZip(string $siteUrl = ''): array
    {
        self::pdoOrFail();

        if (!class_exists('\\ZipArchive')) {
            throw new \RuntimeException('ZipArchive is required.');
        }

        self::ensureDirs();

        $host = '';
        try {
            $host = (string) parse_url($siteUrl, PHP_URL_HOST);
        } catch (\Throwable $e) {
        }
        $host = strtolower(trim($host));
        $host = $host !== '' ? preg_replace('/[^0-9a-z._-]+/i', '_', $host) : 'site';

        $suffix = '';
        try {
            $suffix = bin2hex(random_bytes(4));
        } catch (\Throwable $e) {
            $suffix = uniqid();
        }

        $file = 'v3a_data_' . date('Ymd_His') . '_' . $host . '_' . $suffix . '.zip';
        $path = rtrim(self::EXPORT_DIR, "/\\") . DIRECTORY_SEPARATOR . $file;

        $zip = new \ZipArchive();
        $opened = $zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        if ($opened !== true) {
            throw new \RuntimeException('Cannot create zip file.');
        }

        $dbPath = self::DB_FILE;
        if (!is_file($dbPath)) {
            // Ensure the db file exists
            self::pdo();
        }
        if (is_file($dbPath)) {
            $zip->addFile($dbPath, 'v3a_data.sqlite');
        }

        $meta = [
            'version' => 1,
            'exportedAt' => time(),
            'db' => 'v3a_data.sqlite',
        ];
        $zip->addFromString(
            'meta.json',
            json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        $zip->close();

        return [
            'file' => $file,
            'size' => (int) (@filesize($path) ?: 0),
            'time' => (int) (@filemtime($path) ?: time()),
        ];
    }

    public static function exportFilePath(string $file): string
    {
        $name = self::safeBasename($file);
        return rtrim(self::EXPORT_DIR, "/\\") . DIRECTORY_SEPARATOR . $name;
    }

    /**
     * @return array{imported:int,backup:string}
     */
    public static function importZip(string $zipPath): array
    {
        self::pdoOrFail();

        if (!class_exists('\\ZipArchive')) {
            throw new \RuntimeException('ZipArchive is required.');
        }

        if ($zipPath === '' || !is_file($zipPath)) {
            throw new \RuntimeException('Invalid zip file.');
        }

        self::ensureDirs();

        $zip = new \ZipArchive();
        $opened = $zip->open($zipPath);
        if ($opened !== true) {
            throw new \RuntimeException('Invalid zip file.');
        }

        $entry = null;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string) $zip->getNameIndex($i);
            $base = basename($name);
            if ($base === 'v3a_data.sqlite') {
                $entry = $name;
                break;
            }
        }

        if ($entry === null) {
            $zip->close();
            throw new \RuntimeException('Missing v3a_data.sqlite in zip.');
        }

        $tmp = @tempnam(self::TMP_DIR, 'v3a_');
        if (!is_string($tmp) || $tmp === '') {
            $zip->close();
            throw new \RuntimeException('Cannot create tmp file.');
        }

        $in = $zip->getStream($entry);
        if (!$in) {
            $zip->close();
            @unlink($tmp);
            throw new \RuntimeException('Cannot read zip entry.');
        }

        $out = @fopen($tmp, 'wb');
        if (!$out) {
            $zip->close();
            @unlink($tmp);
            throw new \RuntimeException('Cannot write tmp file.');
        }

        stream_copy_to_stream($in, $out);
        fclose($out);
        fclose($in);
        $zip->close();

        $backup = '';
        $dbPath = self::DB_FILE;
        if (is_file($dbPath)) {
            $backup = 'v3a_data.sqlite.bak_' . date('Ymd_His');
            @rename($dbPath, rtrim(self::DIR, "/\\") . DIRECTORY_SEPARATOR . $backup);
        }

        if (!@rename($tmp, $dbPath)) {
            @unlink($tmp);
            throw new \RuntimeException('Cannot replace db file.');
        }

        // Reset cached pdo instance, then re-open to ensure schema.
        self::$pdo = null;
        self::$pdoPath = '';
        self::pdo();

        return [
            'imported' => 1,
            'backup' => $backup,
        ];
    }

    /**
     * Legacy maintenance: migrate old SQL tables into local sqlite file and optionally drop old tables.
     *
     * @return array<string,mixed>
     */
    public static function migrateLegacy(Db $db, bool $dropLegacy = true): array
    {
        $pdo = self::pdoOrFail();
        self::ensureDirs();

        @set_time_limit(0);

        $counts = [
            'visit' => 0,
            'api' => 0,
            'friend' => 0,
            'apply' => 0,
            'subscribe' => 0,
            'like' => 0,
        ];

        $allSuffixes = [
            'v3a_visit_log',
            'v3a_api_log',
            'v3a_friend_link',
            'v3a_friend_link_apply',
            'v3a_subscribe',
            'v3a_like',
        ];

        $legacyTables = [];
        foreach ($allSuffixes as $suffix) {
            if (self::legacyTableExists($db, $suffix)) {
                $legacyTables[] = $suffix;
            }
        }

        if (empty($legacyTables)) {
            return [
                'migrated' => 0,
                'reason' => 'no_legacy_tables',
                'legacyTables' => [],
                'counts' => $counts,
                'backup' => '',
                'dropped' => [],
            ];
        }

        // Backup current local db file (best-effort).
        $backup = '';
        if (is_file(self::DB_FILE)) {
            $backupName = 'v3a_data.sqlite.bak_' . date('Ymd_His');
            $backupPath = rtrim(self::DIR, "/\\") . DIRECTORY_SEPARATOR . $backupName;
            if (@copy(self::DB_FILE, $backupPath)) {
                $backup = $backupName;
            }
        }

        $pdo->beginTransaction();
        try {
            if (in_array('v3a_visit_log', $legacyTables, true)) {
                $counts['visit'] = self::migrateLegacyTable($db, $pdo, 'v3a_visit_log', self::maxLocalId($pdo, 'v3a_visit_log'));
            }
            if (in_array('v3a_api_log', $legacyTables, true)) {
                $counts['api'] = self::migrateLegacyTable($db, $pdo, 'v3a_api_log', self::maxLocalId($pdo, 'v3a_api_log'));
            }
            if (in_array('v3a_friend_link', $legacyTables, true)) {
                $counts['friend'] = self::migrateLegacyTable($db, $pdo, 'v3a_friend_link', self::maxLocalId($pdo, 'v3a_friend_link'));
            }
            if (in_array('v3a_friend_link_apply', $legacyTables, true)) {
                $counts['apply'] = self::migrateLegacyTable($db, $pdo, 'v3a_friend_link_apply', self::maxLocalId($pdo, 'v3a_friend_link_apply'));
            }
            if (in_array('v3a_subscribe', $legacyTables, true)) {
                $counts['subscribe'] = self::migrateLegacyTable($db, $pdo, 'v3a_subscribe', self::maxLocalId($pdo, 'v3a_subscribe'));
            }
            if (in_array('v3a_like', $legacyTables, true)) {
                $counts['like'] = self::migrateLegacyTable($db, $pdo, 'v3a_like', self::maxLocalId($pdo, 'v3a_like'));
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            try {
                $pdo->rollBack();
            } catch (\Throwable $e2) {
            }
            throw $e;
        }

        $dropped = [];
        if ($dropLegacy) {
            $dropped = self::dropLegacyTables($db, $legacyTables);
        }

        return [
            'migrated' => 1,
            'legacyTables' => $legacyTables,
            'counts' => $counts,
            'backup' => $backup,
            'dropped' => $dropped,
        ];
    }

    private static function legacyTableExists(Db $db, string $suffix): bool
    {
        $tableKey = 'table.' . $suffix;
        try {
            $db->fetchAll($db->select('id')->from($tableKey)->limit(1));
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    private static function maxLocalId(\PDO $pdo, string $table): int
    {
        $table = preg_replace('/[^0-9a-zA-Z_]+/', '', $table);
        if ($table === '') {
            return 0;
        }
        try {
            $v = $pdo->query('SELECT MAX(id) FROM ' . $table)->fetchColumn();
            return (int) ($v ?: 0);
        } catch (\Throwable $e) {
            return 0;
        }
    }

    private static function migrateLegacyTable(Db $db, \PDO $pdo, string $suffix, int $idOffset = 0): int
    {
        $tableKey = 'table.' . $suffix;
        $lastId = 0;
        $total = 0;
        $batch = 1000;
        $idOffset = max(0, (int) $idOffset);

        // Use INSERT with explicit id to preserve identity.
        $insertSql = '';
        if ($suffix === 'v3a_visit_log') {
            $insertSql = 'INSERT INTO v3a_visit_log (id, ip, uri, cid, ctype, referer, ua, created) VALUES (:id,:ip,:uri,:cid,:ctype,:referer,:ua,:created)';
        } elseif ($suffix === 'v3a_api_log') {
            $insertSql = 'INSERT INTO v3a_api_log (id, ip, method, path, query, created) VALUES (:id,:ip,:method,:path,:query,:created)';
        } elseif ($suffix === 'v3a_friend_link') {
            $insertSql = 'INSERT INTO v3a_friend_link (id, name, url, avatar, description, type, email, status, created) VALUES (:id,:name,:url,:avatar,:description,:type,:email,:status,:created)';
        } elseif ($suffix === 'v3a_friend_link_apply') {
            $insertSql = 'INSERT INTO v3a_friend_link_apply (id, name, url, avatar, description, type, email, message, status, created) VALUES (:id,:name,:url,:avatar,:description,:type,:email,:message,:status,:created)';
        } elseif ($suffix === 'v3a_subscribe') {
            $insertSql = 'INSERT INTO v3a_subscribe (id, email, status, created) VALUES (:id,:email,:status,:created)';
        } elseif ($suffix === 'v3a_like') {
            $insertSql = 'INSERT INTO v3a_like (id, type, cid, ip, created) VALUES (:id,:type,:cid,:ip,:created)';
        } else {
            return 0;
        }

        $stmtInsert = $pdo->prepare($insertSql);

        while (true) {
            $rows = (array) $db->fetchAll(
                $db->select()
                    ->from($tableKey)
                    ->where('id > ?', $lastId)
                    ->order('id', Db::SORT_ASC)
                    ->limit($batch)
            );

            if (empty($rows)) {
                break;
            }

            $ctypeByCid = [];
            if ($suffix === 'v3a_visit_log') {
                $cids = [];
                foreach ($rows as $rr) {
                    if (!is_array($rr)) {
                        continue;
                    }
                    $cid = isset($rr['cid']) && $rr['cid'] !== null ? (int) ($rr['cid'] ?? 0) : 0;
                    if ($cid > 0) {
                        $cids[] = $cid;
                    }
                }
                $cids = array_values(array_unique($cids));
                if (!empty($cids)) {
                    try {
                        $contentRows = $db->fetchAll(
                            $db->select('cid', 'type')
                                ->from('table.contents')
                                ->where('cid IN ?', $cids)
                        );
                        foreach ((array) $contentRows as $cr) {
                            if (!is_array($cr)) {
                                continue;
                            }
                            $cid = (int) ($cr['cid'] ?? 0);
                            if ($cid > 0) {
                                $ctypeByCid[$cid] = (string) ($cr['type'] ?? '');
                            }
                        }
                    } catch (\Throwable $e) {
                    }
                }
            }

            foreach ((array) $rows as $r) {
                if (!is_array($r)) {
                    continue;
                }

                $id = (int) ($r['id'] ?? 0);
                if ($id <= 0) {
                    continue;
                }

                if ($suffix === 'v3a_visit_log') {
                    $cid = isset($r['cid']) ? (int) ($r['cid'] ?? 0) : 0;
                    $stmtInsert->execute([
                        ':id' => $id + $idOffset,
                        ':ip' => (string) ($r['ip'] ?? ''),
                        ':uri' => (string) ($r['uri'] ?? ''),
                        ':cid' => isset($r['cid']) ? (int) ($r['cid'] ?? 0) ?: null : null,
                        ':ctype' => $cid > 0 && isset($ctypeByCid[$cid]) ? (string) $ctypeByCid[$cid] : '',
                        ':referer' => isset($r['referer']) ? (string) ($r['referer'] ?? '') : null,
                        ':ua' => isset($r['ua']) ? (string) ($r['ua'] ?? '') : null,
                        ':created' => (int) ($r['created'] ?? 0),
                    ]);
                } elseif ($suffix === 'v3a_api_log') {
                    $stmtInsert->execute([
                        ':id' => $id + $idOffset,
                        ':ip' => (string) ($r['ip'] ?? ''),
                        ':method' => (string) ($r['method'] ?? 'GET'),
                        ':path' => (string) ($r['path'] ?? ''),
                        ':query' => isset($r['query']) ? (string) ($r['query'] ?? '') : null,
                        ':created' => (int) ($r['created'] ?? 0),
                    ]);
                } elseif ($suffix === 'v3a_friend_link') {
                    $stmtInsert->execute([
                        ':id' => $id + $idOffset,
                        ':name' => (string) ($r['name'] ?? ''),
                        ':url' => (string) ($r['url'] ?? ''),
                        ':avatar' => isset($r['avatar']) ? (string) ($r['avatar'] ?? '') : null,
                        ':description' => isset($r['description']) ? (string) ($r['description'] ?? '') : null,
                        ':type' => (string) ($r['type'] ?? 'friend'),
                        ':email' => (string) ($r['email'] ?? ''),
                        ':status' => (int) ($r['status'] ?? 0),
                        ':created' => (int) ($r['created'] ?? 0),
                    ]);
                } elseif ($suffix === 'v3a_friend_link_apply') {
                    $stmtInsert->execute([
                        ':id' => $id + $idOffset,
                        ':name' => (string) ($r['name'] ?? ''),
                        ':url' => (string) ($r['url'] ?? ''),
                        ':avatar' => isset($r['avatar']) ? (string) ($r['avatar'] ?? '') : null,
                        ':description' => isset($r['description']) ? (string) ($r['description'] ?? '') : null,
                        ':type' => (string) ($r['type'] ?? 'friend'),
                        ':email' => (string) ($r['email'] ?? ''),
                        ':message' => isset($r['message']) ? (string) ($r['message'] ?? '') : null,
                        ':status' => (int) ($r['status'] ?? 0),
                        ':created' => (int) ($r['created'] ?? 0),
                    ]);
                } elseif ($suffix === 'v3a_subscribe') {
                    $stmtInsert->execute([
                        ':id' => $id + $idOffset,
                        ':email' => (string) ($r['email'] ?? ''),
                        ':status' => (int) ($r['status'] ?? 1),
                        ':created' => (int) ($r['created'] ?? 0),
                    ]);
                } elseif ($suffix === 'v3a_like') {
                    $stmtInsert->execute([
                        ':id' => $id + $idOffset,
                        ':type' => (string) ($r['type'] ?? 'site'),
                        ':cid' => isset($r['cid']) ? (int) ($r['cid'] ?? 0) ?: null : null,
                        ':ip' => (string) ($r['ip'] ?? ''),
                        ':created' => (int) ($r['created'] ?? 0),
                    ]);
                }

                $total++;
                $lastId = max($lastId, $id);
            }
        }

        return $total;
    }

    /**
     * @return string[]
     */
    private static function dropLegacyTables(Db $db, array $suffixes = []): array
    {
        $driver = '';
        try {
            $driver = strtolower((string) $db->getAdapter()->getDriver());
        } catch (\Throwable $e) {
        }

        $prefix = '';
        try {
            $prefix = (string) $db->getPrefix();
        } catch (\Throwable $e) {
        }

        if (empty($suffixes)) {
            $suffixes = [
                'v3a_visit_log',
                'v3a_api_log',
                'v3a_friend_link',
                'v3a_friend_link_apply',
                'v3a_subscribe',
                'v3a_like',
            ];
        }

        $dropped = [];
        foreach ($suffixes as $suffix) {
            $table = $prefix . $suffix;
            $sql = '';
            if ($driver === 'mysql') {
                $sql = 'DROP TABLE IF EXISTS `' . str_replace('`', '', $table) . '`';
            } else {
                $sql = 'DROP TABLE IF EXISTS ' . preg_replace('/[^0-9a-zA-Z_]+/', '', $table);
            }

            try {
                $db->query($sql, Db::WRITE);
                $dropped[] = $suffix;
            } catch (\Throwable $e) {
            }
        }

        return $dropped;
    }
}
