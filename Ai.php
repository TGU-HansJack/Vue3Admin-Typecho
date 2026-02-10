<?php

namespace TypechoPlugin\Vue3Admin;

use Typecho\Db;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

final class Ai
{
    private const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
    private const DEFAULT_MODEL = 'gpt-4o-mini';

    private static function normalizeCtype(string $ctype): string
    {
        $t = strtolower(trim($ctype));
        return $t === 'page' ? 'page' : 'post';
    }

    private static function normalizeLang(string $lang): string
    {
        $s = strtolower(trim($lang));
        $s = preg_replace('/[^0-9a-z-]+/i', '', $s);
        $s = is_string($s) ? $s : '';
        if ($s === '') {
            return '';
        }
        if (strlen($s) > 16) {
            $s = substr($s, 0, 16);
        }
        return $s;
    }

    /**
     * @return string[]
     */
    public static function parseLanguages(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [];
        }

        $parts = preg_split('/[\\s,]+/u', $raw);
        $out = [];
        foreach ((array) $parts as $p) {
            $p = self::normalizeLang((string) $p);
            if ($p === '') {
                continue;
            }
            if (!in_array($p, $out, true)) {
                $out[] = $p;
            }
        }
        return $out;
    }

    private static function normalizeBaseUrl(string $raw): string
    {
        $u = trim($raw);
        if ($u === '') {
            return self::DEFAULT_BASE_URL;
        }

        if (!preg_match('~^https?://~i', $u)) {
            $u = 'https://' . ltrim($u, '/');
        }

        return rtrim($u, '/');
    }

    /**
     * @return array{enabled:int,baseUrl:string,model:string,temperature:float,timeout:int,languages:string[],features:array<string,int>,hasApiKey:int}
     */
    public static function getConfig($options): array
    {
        $apiKey = '';
        try {
            $apiKey = (string) ($options->v3a_ai_api_key ?? '');
        } catch (\Throwable $e) {
        }

        $langs = [];
        try {
            $langs = self::parseLanguages((string) ($options->v3a_ai_languages ?? ''));
        } catch (\Throwable $e) {
        }

        $baseUrl = '';
        try {
            $baseUrl = (string) ($options->v3a_ai_base_url ?? '');
        } catch (\Throwable $e) {
        }

        $model = '';
        try {
            $model = (string) ($options->v3a_ai_model ?? '');
        } catch (\Throwable $e) {
        }

        $temperature = 0.2;
        try {
            $temperature = (float) ($options->v3a_ai_temperature ?? 0.2);
        } catch (\Throwable $e) {
        }

        $timeout = 60;
        try {
            $timeout = (int) ($options->v3a_ai_timeout ?? 60);
        } catch (\Throwable $e) {
        }

        $features = [
            'translate' => 0,
            'summary' => 0,
            'comment' => 0,
            'polish' => 0,
            'slug' => 0,
        ];
        try {
            $features['translate'] = (int) ($options->v3a_ai_translate_enabled ?? 0);
            $features['summary'] = (int) ($options->v3a_ai_summary_enabled ?? 0);
            $features['comment'] = (int) ($options->v3a_ai_comment_enabled ?? 0);
            $features['polish'] = (int) ($options->v3a_ai_polish_enabled ?? 0);
            $features['slug'] = (int) ($options->v3a_ai_slug_enabled ?? 0);
        } catch (\Throwable $e) {
        }

        $enabled = 0;
        try {
            $enabled = (int) ($options->v3a_ai_enabled ?? 0);
        } catch (\Throwable $e) {
        }

        return [
            'enabled' => $enabled ? 1 : 0,
            'baseUrl' => self::normalizeBaseUrl($baseUrl),
            'model' => trim($model) !== '' ? trim($model) : self::DEFAULT_MODEL,
            'temperature' => max(0.0, min(2.0, (float) $temperature)),
            'timeout' => max(10, min(300, (int) $timeout)),
            'languages' => $langs,
            'features' => $features,
            'hasApiKey' => trim($apiKey) !== '' ? 1 : 0,
        ];
    }

    /**
     * @return array{enabled:int,baseUrl:string,apiKey:string,model:string,temperature:float,timeout:int,languages:string[],features:array<string,int>,hasApiKey:int}
     */
    public static function getRuntimeConfig($options): array
    {
        $cfg = self::getConfig($options);
        $apiKey = '';
        try {
            $apiKey = (string) ($options->v3a_ai_api_key ?? '');
        } catch (\Throwable $e) {
        }
        $cfg['apiKey'] = (string) $apiKey;
        return $cfg;
    }

    private static function upsertOption(Db $db, string $name, $value): void
    {
        $exists = 0;
        try {
            $exists = (int) ($db->fetchObject(
                $db->select(['COUNT(*)' => 'num'])->from('table.options')->where('name = ? AND user = ?', $name, 0)
            )->num ?? 0);
        } catch (\Throwable $e) {
            $exists = 0;
        }

        if ($exists > 0) {
            $db->query(
                $db->update('table.options')->rows(['value' => $value])->where('name = ? AND user = ?', $name, 0),
                Db::WRITE
            );
            return;
        }

        $db->query(
            $db->insert('table.options')->rows(['name' => $name, 'value' => $value, 'user' => 0]),
            Db::WRITE
        );
    }

    /**
     * @return array{ai:array<string,mixed>}
     */
    public static function saveConfig(Db $db, array $payload): array
    {
        $enabled = !empty($payload['enabled']) ? 1 : 0;
        $baseUrl = self::normalizeBaseUrl((string) ($payload['baseUrl'] ?? ''));
        $model = trim((string) ($payload['model'] ?? ''));
        $temperatureRaw = (float) ($payload['temperature'] ?? 0.2);
        $temperature = max(0.0, min(2.0, $temperatureRaw));
        $timeoutRaw = (int) ($payload['timeout'] ?? 60);
        $timeout = max(10, min(300, $timeoutRaw));

        $langs = $payload['languages'] ?? $payload['langs'] ?? '';
        if (is_array($langs)) {
            $langs = implode(',', array_map('strval', $langs));
        }
        $languages = self::parseLanguages((string) $langs);
        $languagesValue = implode(',', $languages);

        $featureTranslate = !empty($payload['translateEnabled']) ? 1 : 0;
        $featureSummary = !empty($payload['summaryEnabled']) ? 1 : 0;
        $featureComment = !empty($payload['commentEnabled']) ? 1 : 0;
        $featurePolish = !empty($payload['polishEnabled']) ? 1 : 0;
        $featureSlug = !empty($payload['slugEnabled']) ? 1 : 0;

        self::upsertOption($db, 'v3a_ai_enabled', $enabled);
        self::upsertOption($db, 'v3a_ai_base_url', $baseUrl);
        self::upsertOption($db, 'v3a_ai_model', $model !== '' ? $model : self::DEFAULT_MODEL);
        self::upsertOption($db, 'v3a_ai_temperature', (string) $temperature);
        self::upsertOption($db, 'v3a_ai_timeout', (string) $timeout);
        self::upsertOption($db, 'v3a_ai_languages', $languagesValue);

        self::upsertOption($db, 'v3a_ai_translate_enabled', $featureTranslate);
        self::upsertOption($db, 'v3a_ai_summary_enabled', $featureSummary);
        self::upsertOption($db, 'v3a_ai_comment_enabled', $featureComment);
        self::upsertOption($db, 'v3a_ai_polish_enabled', $featurePolish);
        self::upsertOption($db, 'v3a_ai_slug_enabled', $featureSlug);

        $apiKey = trim((string) ($payload['apiKey'] ?? ''));
        if ($apiKey !== '') {
            self::upsertOption($db, 'v3a_ai_api_key', $apiKey);
        }

        try {
            $options = \Widget\Options::alloc();
        } catch (\Throwable $e) {
            return ['ai' => []];
        }

        return ['ai' => self::getConfig($options)];
    }

    private static function localPdo(): ?\PDO
    {
        try {
            return LocalStorage::pdo();
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * @return array{cid:int,ctype:string,lang:string,title:string,text:string,model:string,updated:int}|null
     */
    public static function getTranslation(int $cid, string $ctype, string $lang): ?array
    {
        $cid = (int) $cid;
        if ($cid <= 0) {
            return null;
        }

        $ctype = self::normalizeCtype($ctype);
        $lang = self::normalizeLang($lang);
        if ($lang === '') {
            return null;
        }

        $pdo = self::localPdo();
        if (!$pdo) {
            return null;
        }

        try {
            $stmt = $pdo->prepare(
                'SELECT cid, ctype, lang, title, text, model, updated FROM v3a_ai_translation WHERE cid = :cid AND ctype = :ctype AND lang = :lang LIMIT 1'
            );
            $stmt->execute([
                ':cid' => $cid,
                ':ctype' => $ctype,
                ':lang' => $lang,
            ]);
            $row = $stmt->fetch();
            if (!$row) {
                return null;
            }
            return [
                'cid' => (int) ($row['cid'] ?? 0),
                'ctype' => (string) ($row['ctype'] ?? $ctype),
                'lang' => (string) ($row['lang'] ?? $lang),
                'title' => (string) ($row['title'] ?? ''),
                'text' => (string) ($row['text'] ?? ''),
                'model' => (string) ($row['model'] ?? ''),
                'updated' => (int) ($row['updated'] ?? 0),
            ];
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * @return array{cid:int,ctype:string,lang:string,title:string,text:string,model:string,updated:int}|null
     */
    public static function saveTranslation(int $cid, string $ctype, string $lang, string $title, string $text, string $model = ''): ?array
    {
        $cid = (int) $cid;
        if ($cid <= 0) {
            return null;
        }

        $ctype = self::normalizeCtype($ctype);
        $lang = self::normalizeLang($lang);
        if ($lang === '') {
            return null;
        }

        $pdo = self::localPdo();
        if (!$pdo) {
            return null;
        }

        $now = time();

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO v3a_ai_translation (cid, ctype, lang, title, text, model, created, updated)
                 VALUES (:cid,:ctype,:lang,:title,:text,:model,:created,:updated)
                 ON CONFLICT(cid, ctype, lang) DO UPDATE SET title = excluded.title, text = excluded.text, model = excluded.model, updated = excluded.updated'
            );
            $stmt->execute([
                ':cid' => $cid,
                ':ctype' => $ctype,
                ':lang' => $lang,
                ':title' => $title,
                ':text' => $text,
                ':model' => $model,
                ':created' => $now,
                ':updated' => $now,
            ]);
            return self::getTranslation($cid, $ctype, $lang);
        } catch (\Throwable $e) {
        }

        try {
            $stmt = $pdo->prepare(
                'SELECT id FROM v3a_ai_translation WHERE cid = :cid AND ctype = :ctype AND lang = :lang LIMIT 1'
            );
            $stmt->execute([
                ':cid' => $cid,
                ':ctype' => $ctype,
                ':lang' => $lang,
            ]);
            $id = (int) ($stmt->fetchColumn() ?: 0);
            if ($id > 0) {
                $stmt = $pdo->prepare(
                    'UPDATE v3a_ai_translation SET title = :title, text = :text, model = :model, updated = :updated WHERE id = :id'
                );
                $stmt->execute([
                    ':title' => $title,
                    ':text' => $text,
                    ':model' => $model,
                    ':updated' => $now,
                    ':id' => $id,
                ]);
            } else {
                $stmt = $pdo->prepare(
                    'INSERT INTO v3a_ai_translation (cid, ctype, lang, title, text, model, created, updated) VALUES (:cid,:ctype,:lang,:title,:text,:model,:created,:updated)'
                );
                $stmt->execute([
                    ':cid' => $cid,
                    ':ctype' => $ctype,
                    ':lang' => $lang,
                    ':title' => $title,
                    ':text' => $text,
                    ':model' => $model,
                    ':created' => $now,
                    ':updated' => $now,
                ]);
            }
        } catch (\Throwable $e) {
            return null;
        }

        return self::getTranslation($cid, $ctype, $lang);
    }

    /**
     * @return array{cid:int,ctype:string,lang:string,summary:string,model:string,updated:int}|null
     */
    public static function getSummary(int $cid, string $ctype, string $lang): ?array
    {
        $cid = (int) $cid;
        if ($cid <= 0) {
            return null;
        }

        $ctype = self::normalizeCtype($ctype);
        $lang = self::normalizeLang($lang);
        if ($lang === '') {
            return null;
        }

        $pdo = self::localPdo();
        if (!$pdo) {
            return null;
        }

        try {
            $stmt = $pdo->prepare(
                'SELECT cid, ctype, lang, summary, model, updated FROM v3a_ai_summary WHERE cid = :cid AND ctype = :ctype AND lang = :lang LIMIT 1'
            );
            $stmt->execute([
                ':cid' => $cid,
                ':ctype' => $ctype,
                ':lang' => $lang,
            ]);
            $row = $stmt->fetch();
            if (!$row) {
                return null;
            }
            return [
                'cid' => (int) ($row['cid'] ?? 0),
                'ctype' => (string) ($row['ctype'] ?? $ctype),
                'lang' => (string) ($row['lang'] ?? $lang),
                'summary' => (string) ($row['summary'] ?? ''),
                'model' => (string) ($row['model'] ?? ''),
                'updated' => (int) ($row['updated'] ?? 0),
            ];
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * @return array{cid:int,ctype:string,lang:string,summary:string,model:string,updated:int}|null
     */
    public static function saveSummary(int $cid, string $ctype, string $lang, string $summary, string $model = ''): ?array
    {
        $cid = (int) $cid;
        if ($cid <= 0) {
            return null;
        }

        $ctype = self::normalizeCtype($ctype);
        $lang = self::normalizeLang($lang);
        if ($lang === '') {
            return null;
        }

        $pdo = self::localPdo();
        if (!$pdo) {
            return null;
        }

        $now = time();

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO v3a_ai_summary (cid, ctype, lang, summary, model, created, updated)
                 VALUES (:cid,:ctype,:lang,:summary,:model,:created,:updated)
                 ON CONFLICT(cid, ctype, lang) DO UPDATE SET summary = excluded.summary, model = excluded.model, updated = excluded.updated'
            );
            $stmt->execute([
                ':cid' => $cid,
                ':ctype' => $ctype,
                ':lang' => $lang,
                ':summary' => $summary,
                ':model' => $model,
                ':created' => $now,
                ':updated' => $now,
            ]);
            return self::getSummary($cid, $ctype, $lang);
        } catch (\Throwable $e) {
        }

        try {
            $stmt = $pdo->prepare(
                'SELECT id FROM v3a_ai_summary WHERE cid = :cid AND ctype = :ctype AND lang = :lang LIMIT 1'
            );
            $stmt->execute([
                ':cid' => $cid,
                ':ctype' => $ctype,
                ':lang' => $lang,
            ]);
            $id = (int) ($stmt->fetchColumn() ?: 0);
            if ($id > 0) {
                $stmt = $pdo->prepare(
                    'UPDATE v3a_ai_summary SET summary = :summary, model = :model, updated = :updated WHERE id = :id'
                );
                $stmt->execute([
                    ':summary' => $summary,
                    ':model' => $model,
                    ':updated' => $now,
                    ':id' => $id,
                ]);
            } else {
                $stmt = $pdo->prepare(
                    'INSERT INTO v3a_ai_summary (cid, ctype, lang, summary, model, created, updated) VALUES (:cid,:ctype,:lang,:summary,:model,:created,:updated)'
                );
                $stmt->execute([
                    ':cid' => $cid,
                    ':ctype' => $ctype,
                    ':lang' => $lang,
                    ':summary' => $summary,
                    ':model' => $model,
                    ':created' => $now,
                    ':updated' => $now,
                ]);
            }
        } catch (\Throwable $e) {
            return null;
        }

        return self::getSummary($cid, $ctype, $lang);
    }

    private static function httpPostJson(string $url, array $payload, array $headers, int $timeout): array
    {
        $timeout = max(1, $timeout);
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($body)) {
            throw new \RuntimeException('Failed to encode request body.');
        }

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            // Enable gzip/br if available (reduces payload size for large posts)
            curl_setopt($ch, CURLOPT_ENCODING, '');
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            // Faster fail for unreachable endpoints
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, min(5, $timeout));
            curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);

            $resp = curl_exec($ch);
            $err = curl_error($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if (!is_string($resp)) {
                throw new \RuntimeException($err !== '' ? $err : 'AI request failed.');
            }

            $decoded = json_decode($resp, true);
            if (!is_array($decoded)) {
                $snippet = trim(substr(trim($resp), 0, 300));
                throw new \RuntimeException('AI returned non-JSON response (HTTP ' . $code . '): ' . ($snippet !== '' ? $snippet : '[empty]'));
            }

            if ($code >= 400) {
                $msg = '';
                try {
                    $msg = (string) (($decoded['error']['message'] ?? $decoded['message'] ?? '') ?: '');
                } catch (\Throwable $e) {
                }
                $msg = trim($msg);
                throw new \RuntimeException($msg !== '' ? $msg : ('AI request failed (HTTP ' . $code . ').'));
            }

            return $decoded;
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $body,
                'timeout' => $timeout,
                'ignore_errors' => true,
            ],
        ]);

        $resp = @file_get_contents($url, false, $context);
        if (!is_string($resp)) {
            throw new \RuntimeException('AI request failed.');
        }

        $decoded = json_decode($resp, true);
        if (!is_array($decoded)) {
            $snippet = trim(substr(trim($resp), 0, 300));
            throw new \RuntimeException('AI returned non-JSON response: ' . ($snippet !== '' ? $snippet : '[empty]'));
        }

        return $decoded;
    }

    private static function chatCompletionsUrl(string $baseUrl): string
    {
        $base = rtrim($baseUrl, '/');
        if (preg_match('~/v\\d+$~i', $base)) {
            return $base . '/chat/completions';
        }
        if (preg_match('~/v\\d+/chat/completions$~i', $base)) {
            return $base;
        }
        return $base . '/v1/chat/completions';
    }

    /**
     * @return array{content:string,model:string}
     */
    public static function chat(array $cfg, array $messages, array $extra = []): array
    {
        $enabled = !empty($cfg['enabled']);
        $apiKey = trim((string) ($cfg['apiKey'] ?? ''));
        if (!$enabled || $apiKey === '') {
            throw new \RuntimeException('AI 未配置或未启用。');
        }

        $baseUrl = self::normalizeBaseUrl((string) ($cfg['baseUrl'] ?? ''));
        $url = self::chatCompletionsUrl($baseUrl);

        $model = trim((string) ($cfg['model'] ?? self::DEFAULT_MODEL));
        if ($model === '') {
            $model = self::DEFAULT_MODEL;
        }

        $temperature = (float) ($cfg['temperature'] ?? 0.2);
        $timeout = (int) ($cfg['timeout'] ?? 60);

        $payload = [
            'model' => $model,
            'messages' => $messages,
            'temperature' => max(0.0, min(2.0, $temperature)),
        ];
        foreach ($extra as $k => $v) {
            $payload[$k] = $v;
        }

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Bearer ' . $apiKey,
            // Disable "Expect: 100-continue" to reduce latency on large payloads.
            'Expect:',
        ];

        $json = self::httpPostJson($url, $payload, $headers, max(1, $timeout));
        $content = '';
        try {
            $content = (string) ($json['choices'][0]['message']['content'] ?? '');
        } catch (\Throwable $e) {
        }

        return [
            'content' => $content,
            'model' => $model,
        ];
    }

    private static function clipText(string $text, int $headChars, int $tailChars = 0, string $sep = "\n\n[...内容过长已截断...]\n\n"): string
    {
        $s = (string) $text;
        if ($headChars <= 0) {
            return $s;
        }

        $tailChars = max(0, (int) $tailChars);
        if ($tailChars > $headChars) {
            $tailChars = 0;
        }

        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            $len = (int) mb_strlen($s, 'UTF-8');
            if ($len <= $headChars) {
                return $s;
            }
            if ($tailChars <= 0) {
                return (string) mb_substr($s, 0, $headChars, 'UTF-8') . $sep;
            }
            $head = (string) mb_substr($s, 0, $headChars - $tailChars, 'UTF-8');
            $tail = (string) mb_substr($s, $len - $tailChars, $tailChars, 'UTF-8');
            return $head . $sep . $tail;
        }

        if (strlen($s) <= $headChars) {
            return $s;
        }
        if ($tailChars <= 0) {
            return substr($s, 0, $headChars) . $sep;
        }
        $head = substr($s, 0, $headChars - $tailChars);
        $tail = substr($s, -$tailChars);
        return $head . $sep . $tail;
    }

    /**
     * @return array<string,mixed>|null
     */
    private static function parseJsonFromText(string $raw): ?array
    {
        $s = trim($raw);
        if ($s === '') {
            return null;
        }

        if (strpos($s, '```') !== false) {
            if (preg_match('/```(?:json)?\\s*(\\{.*\\})\\s*```/s', $s, $m)) {
                $s = trim((string) ($m[1] ?? ''));
            }
        }

        if ($s !== '' && $s[0] !== '{') {
            $p0 = strpos($s, '{');
            $p1 = strrpos($s, '}');
            if ($p0 !== false && $p1 !== false && $p1 > $p0) {
                $s = substr($s, $p0, $p1 - $p0 + 1);
            }
        }

        $decoded = json_decode($s, true);
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * Convert a decoded JSON value into plain text without PHP warnings.
     *
     * @param mixed $value
     */
    private static function jsonText($value, string $join = "\n"): string
    {
        if (is_string($value) || is_numeric($value)) {
            return (string) $value;
        }
        if (is_array($value)) {
            $parts = [];
            foreach ($value as $v) {
                $s = trim(self::jsonText($v, $join));
                if ($s !== '') {
                    $parts[] = $s;
                }
            }
            return implode($join, $parts);
        }
        if (is_object($value)) {
            $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            return is_string($json) ? $json : '';
        }
        return '';
    }

    /**
     * @return array{title:string,text:string,model:string}
     */
    public static function translate(array $cfg, string $title, string $text, string $targetLang, bool $markdown): array
    {
        $lang = self::normalizeLang($targetLang);
        if ($lang === '') {
            throw new \RuntimeException('Invalid language.');
        }

        $formatHint = $markdown ? 'markdown' : 'plain text';

        $system = "You are a precise translation engine for blog content.\n"
            . "Translate the given title and content into {$lang}.\n"
            . "Output ONLY a JSON object with keys: title, text.\n"
            . "Keep the output format as {$formatHint}.";

        if ($markdown) {
            $system .= "\nPreserve markdown structure, links, and code blocks. Do not translate code blocks.";
        } else {
            $system .= "\nDo not use markdown syntax. Use natural paragraphs.";
        }

        $user = "TITLE:\n{$title}\n\nCONTENT:\n{$text}";

        $res = self::chat($cfg, [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ], ['temperature' => 0.2]);

        $obj = self::parseJsonFromText((string) ($res['content'] ?? '')) ?? [];
        $outTitle = trim(self::jsonText($obj['title'] ?? ''));
        $outText = trim(self::jsonText($obj['text'] ?? ''));
        if ($outText === '' && trim((string) ($res['content'] ?? '')) !== '') {
            $outText = trim((string) ($res['content'] ?? ''));
        }

        return [
            'title' => $outTitle !== '' ? $outTitle : $title,
            'text' => $outText,
            'model' => (string) ($res['model'] ?? ''),
        ];
    }

    /**
     * @return array{summary:string,model:string}
     */
    public static function summarize(array $cfg, string $title, string $text, string $targetLang): array
    {
        $lang = self::normalizeLang($targetLang);
        if ($lang === '') {
            throw new \RuntimeException('Invalid language.');
        }

        // Summaries do not need the full post body; limiting input reduces latency/cost and avoids timeouts.
        $text = self::clipText($text, 16000, 4000);

        $system = "You are a concise summarizer for blog posts.\n"
            . "Write a clear summary in {$lang}.\n"
            . "Output ONLY a JSON object with key: summary.\n"
            . "Keep it within 3-6 bullet points OR 2 short paragraphs.";

        $user = "TITLE:\n{$title}\n\nCONTENT:\n{$text}";

        $res = self::chat($cfg, [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ], ['temperature' => 0.2, 'max_tokens' => 600]);

        $obj = self::parseJsonFromText((string) ($res['content'] ?? '')) ?? [];
        $summary = trim(self::jsonText($obj['summary'] ?? ''));
        if ($summary === '' && trim((string) ($res['content'] ?? '')) !== '') {
            $summary = trim((string) ($res['content'] ?? ''));
        }

        return [
            'summary' => $summary,
            'model' => (string) ($res['model'] ?? ''),
        ];
    }

    /**
     * @return array{text:string,model:string}
     */
    public static function polish(array $cfg, string $text): array
    {
        $system = "You are a writing editor.\n"
            . "Improve clarity and fluency while preserving meaning.\n"
            . "Output ONLY a JSON object with key: text.\n"
            . "Keep markdown structure if present.";

        $res = self::chat($cfg, [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $text],
        ], ['temperature' => 0.4]);

        $obj = self::parseJsonFromText((string) ($res['content'] ?? '')) ?? [];
        $out = trim(self::jsonText($obj['text'] ?? ''));
        if ($out === '' && trim((string) ($res['content'] ?? '')) !== '') {
            $out = trim((string) ($res['content'] ?? ''));
        }

        return [
            'text' => $out,
            'model' => (string) ($res['model'] ?? ''),
        ];
    }

    /**
     * @return array{slug:string,model:string}
     */
    public static function makeSlug(array $cfg, string $title): array
    {
        $system = "You generate SEO-friendly English URL slugs.\n"
            . "Output ONLY a JSON object with key: slug.\n"
            . "Rules: lowercase, use hyphens, 2-8 words, letters/numbers only.";

        $res = self::chat($cfg, [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $title],
        ], ['temperature' => 0.2, 'max_tokens' => 80]);

        $obj = self::parseJsonFromText((string) ($res['content'] ?? '')) ?? [];
        $slug = self::jsonText($obj['slug'] ?? '');
        $slug = strtolower(trim($slug));
        $slug = preg_replace('/[^0-9a-z\\-]+/i', '-', $slug);
        $slug = preg_replace('/-+/', '-', (string) $slug);
        $slug = trim((string) $slug, '-');
        if (strlen($slug) > 80) {
            $slug = substr($slug, 0, 80);
            $slug = trim($slug, '-');
        }

        return [
            'slug' => $slug,
            'model' => (string) ($res['model'] ?? ''),
        ];
    }

    private static function hasPromoKeywords(string $text, string $author = ''): bool
    {
        $spamWords = [
            'casino', 'viagra', 'porn', 'sex', 'loan', 'credit',
            '博彩', '赌场', '棋牌', '彩票', '贷款', '借贷', '投资', '理财', '返利', '赚钱', '代刷', '刷单', '推广',
            'telegram', 'whatsapp', 'line', 'skype',
        ];

        foreach ($spamWords as $w) {
            if ($w === '') {
                continue;
            }
            if (stripos($text, $w) !== false || ($author !== '' && stripos($author, $w) !== false)) {
                return true;
            }
        }

        return false;
    }

    private static function hasAbuseKeywords(string $text, string $author = ''): bool
    {
        $s = trim(($author !== '' ? ($author . "\n") : '') . $text);
        if ($s === '') {
            return false;
        }

        $sLower = strtolower($s);

        $direct = [
            '傻逼', '煞笔', '傻比', '煞比', '傻叉',
            '操你妈', '草你妈', '艹你妈', '日你妈', '去死', '死全家', '死妈', '死爹',
            '滚蛋', '滚开',
            '你妈', '尼玛', '他妈', '妈的',
            'stfu', 'fuck you', 'asshole', 'bitch', 'cunt', 'dick', 'motherfucker',
            'kys', 'kill yourself',
        ];

        foreach ($direct as $w) {
            if ($w === '') {
                continue;
            }
            if (strpos($sLower, strtolower($w)) !== false) {
                return true;
            }
        }

        $patterns = [
            '/傻\\s*[逼比bｂＢ]/iu',
            '/煞\\s*[逼比bｂＢ]/iu',
            '/傻\\s*[x叉X]/u',
            '/滚\\s*(蛋|开)/u',
            '/(^|[\\s\\p{P}])滚(吧|啊|出去|远点)?($|[\\s\\p{P}])/u',
            '/(操|草|艹|日)\\s*你(\\s*(妈|媽))?/u',
            '/(你|尼|他)\\s*妈/u',
            '/死\\s*(妈|媽|爹|全家)/u',
            // Targeted insults (avoid matching neutral topics like "垃圾分类")
            '/(你|你们|他|她|作者|博主|楼主|管理员|版主|站长|你这|你个|你这个)[^\\n]{0,8}(白\\s*痴|智\\s*障|蠢\\s*(货|蛋)|脑\\s*残|废\\s*物|畜\\s*生|垃\\s*圾|恶\\s*心|狗\\s*东西|贱\\s*人|不\\s*要\\s*脸|无\\s*耻|有\\s*病|神\\s*经\\s*病)/u',
            '/\\bfuck\\s+you\\b/i',
            '/\\bf\\*+k\\b/i',
            '/\\bfuck\\b/i',
            '/\\b(stfu|asshole|bitch|cunt|dick|motherfucker|idiot|stupid|moron)\\b/i',
            '/\\b(kys|kill\\s+yourself)\\b/i',
            // spaced abbreviations (avoid matching inside words like "usb")
            '/(^|[^a-z0-9])s\\s*[-_]?\\s*b([^a-z0-9]|$)/i',
            '/(^|[^a-z0-9])c\\s*n\\s*m([^a-z0-9]|$)/i',
            '/(^|[^a-z0-9])n\\s*m\\s*s\\s*l([^a-z0-9]|$)/i',
        ];

        foreach ($patterns as $p) {
            try {
                if (preg_match($p, $s)) {
                    return true;
                }
            } catch (\Throwable $e) {
            }
        }

        return false;
    }

    private static function reasonSuggestsAbuse(string $reason): bool
    {
        $r = strtolower(trim($reason));
        if ($r === '') {
            return false;
        }

        $keys = [
            '辱骂', '侮辱', '人身攻击', '骂人', '脏话', '仇恨', '歧视', '威胁', '攻击',
            'abuse', 'abusive', 'harass', 'harassment', 'hate', 'hateful', 'insult', 'profanity', 'threat',
        ];
        foreach ($keys as $k) {
            if ($k !== '' && strpos($r, strtolower($k)) !== false) {
                return true;
            }
        }
        return false;
    }

    /**
     * A fast risk check used to avoid blocking front-end comment submission.
     *
     * - Only "risky" comments are sent to AI.
     * - Safe comments keep Typecho's default moderation flow.
     */
    public static function isCommentRisky(array $comment): bool
    {
        $author = trim((string) ($comment['author'] ?? ''));
        $url = trim((string) ($comment['url'] ?? ''));
        $text = trim((string) ($comment['text'] ?? ''));

        $textLinkCount = 0;
        try {
            $textLinkCount = (int) preg_match_all('~https?://|www\\.~i', $text);
        } catch (\Throwable $e) {
            $textLinkCount = 0;
        }

        $hasPromoWord = self::hasPromoKeywords($text, $author);
        $hasAbuseWord = self::hasAbuseKeywords($text, $author);

        if ($textLinkCount >= 1) {
            return true;
        }
        if ($hasPromoWord || $hasAbuseWord) {
            return true;
        }

        $len = 0;
        try {
            if (function_exists('mb_strlen')) {
                $len = (int) mb_strlen($text, 'UTF-8');
            } else {
                $len = (int) strlen($text);
            }
        } catch (\Throwable $e) {
            $len = (int) strlen($text);
        }
        if ($len > 300) {
            return true;
        }

        if ($url !== '' && $len <= 40) {
            return true;
        }

        return false;
    }

    /**
     * @return array{action:string,reason:string,model:string}
     */
    public static function moderateComment(array $cfg, array $comment, string $siteUrl = '', array $context = []): array
    {
        $author = trim((string) ($comment['author'] ?? ''));
        $mail = trim((string) ($comment['mail'] ?? ''));
        $url = trim((string) ($comment['url'] ?? ''));
        $ip = trim((string) ($comment['ip'] ?? ''));
        $ua = trim((string) ($comment['agent'] ?? ''));
        $text = trim((string) ($comment['text'] ?? ''));

        $textLinkCount = 0;
        try {
            $textLinkCount = (int) preg_match_all('~https?://|www\\.~i', $text);
        } catch (\Throwable $e) {
            $textLinkCount = 0;
        }
        $hasWebsite = $url !== '';

        $hasPromoWord = self::hasPromoKeywords($text, $author);
        $hasAbuseWord = self::hasAbuseKeywords($text, $author);

        // Fast-path rules: avoid slow AI calls for obvious spam.
        if ($hasAbuseWord) {
            return ['action' => 'spam', 'reason' => 'abusive language', 'model' => 'rule'];
        }
        if ($textLinkCount >= 2) {
            return ['action' => 'spam', 'reason' => 'multiple links in text', 'model' => 'rule'];
        }
        if ($textLinkCount >= 1 && strlen($text) <= 40) {
            return ['action' => 'spam', 'reason' => 'short comment with link in text', 'model' => 'rule'];
        }
        if ($hasPromoWord && ($textLinkCount >= 1 || $hasWebsite)) {
            return ['action' => 'spam', 'reason' => 'spam keyword with link', 'model' => 'rule'];
        }
        if ($hasWebsite && $textLinkCount === 0 && strlen($text) <= 40) {
            return ['action' => 'waiting', 'reason' => 'short comment with website', 'model' => 'rule'];
        }

        // Reduce blocking time for front-end comment submission.
        $cfgFast = $cfg;
        $t = (int) ($cfgFast['timeout'] ?? 60);
        $cfgFast['timeout'] = max(3, min($t > 0 ? $t : 60, 8));

        $system = "You are a strict blog comment moderation system.\n"
            . "Return ONLY a JSON object: {\"action\":\"approve|waiting|spam\",\"reason\":\"...\"}.\n"
            . "Guidelines:\n"
            . "- Prefer \"waiting\" if unsure.\n"
            . "- Mark as \"spam\" for ads, scams, phishing, crypto/investment promotion, irrelevant SEO, mass-produced text.\n"
            . "- Mark as \"spam\" for insults/abuse, harassment, hate speech, threats, or profanities (辱骂/人身攻击/仇恨/威胁/脏话).\n"
            . "- Any comment with suspicious links should be at least \"waiting\".\n"
            . "- Approve only normal human comments that are not promotional.";

        $payload = [
            'author' => $author,
            'mail' => $mail,
            'url' => $url,
            'ip' => $ip,
            'userAgent' => $ua,
            'text' => $text,
            'site' => $siteUrl,
        ];
        if (!empty($context)) {
            $payload['context'] = $context;
        }
        $user = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($user)) {
            $user = $text;
        }

        $res = self::chat($cfgFast, [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ], ['temperature' => 0.0, 'max_tokens' => 220]);

        $obj = self::parseJsonFromText((string) ($res['content'] ?? '')) ?? [];
        $action = strtolower(trim(self::jsonText($obj['action'] ?? 'waiting')));
        if (!in_array($action, ['approve', 'waiting', 'spam'], true)) {
            $action = 'waiting';
        }
        $reason = trim(self::jsonText($obj['reason'] ?? ''));
        if (strlen($reason) > 200) {
            $reason = substr($reason, 0, 200);
        }

        // Safety overrides (reduce false positives/negatives)
        if ($action === 'approve' && $textLinkCount >= 1) {
            $action = 'waiting';
        } elseif ($action === 'spam' && $textLinkCount === 0 && !$hasPromoWord && !$hasAbuseWord) {
            if (!self::reasonSuggestsAbuse($reason)) {
                $action = 'waiting';
            }
        }

        return [
            'action' => $action,
            'reason' => $reason,
            'model' => (string) ($res['model'] ?? ''),
        ];
    }
}
