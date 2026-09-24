<?php
// Приём заявок с квиза «Подобрать материалы». Заявки хранятся в MySQL на reg.ru (Россия) —
// раньше уходили в Google Sheets, что нарушало требование локализации ПДн (ч. 5 ст. 18 152-ФЗ).
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');
date_default_timezone_set('Asia/Krasnoyarsk'); // Кызыл, UTC+7

// Сайт открыт и на reg.ru, и на GitHub Pages — оба отправляют заявки сюда
$allowed = ['https://kyzyl.vnashdom.ru', 'https://www.kyzyl.vnashdom.ru', 'https://k-sined.github.io'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Api-Token');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
function ok(array $data = []): void {
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) fail('Сервер не настроен', 500);
$config = require $configPath;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Только POST', 405);
$body = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($body)) fail('Некорректный запрос');
$action = (string)($body['action'] ?? 'submit');

try {
    $pdo = new PDO(
        "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
        $config['db_user'], $config['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (Throwable $e) {
    fail('Не удалось подключиться к базе данных', 500);
}

// Срок хранения по политике — 12 месяцев, старые заявки удаляются автоматически
$pdo->exec('DELETE FROM site_leads WHERE created_at < DATE_SUB(NOW(), INTERVAL 12 MONTH)');

$clip = fn($v, int $n) => mb_substr(trim((string)$v), 0, $n);

try {
    if ($action === 'submit') {
        if (!empty($body['website'])) ok(); // поле-ловушка для ботов
        $name = $clip($body['name'] ?? '', 100);
        $phone = $clip($body['phone'] ?? '', 30);
        $digits = preg_replace('/\D+/', '', $phone);
        if ($name === '' || strlen($digits) < 10) fail('Укажите имя и телефон полностью');
        if (empty($body['consent_pd'])) fail('Нужно согласие на обработку персональных данных');

        $ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $config['admin_token']);
        $st = $pdo->prepare('SELECT COUNT(*) FROM site_leads WHERE ip_hash = ? AND created_at > ?');
        $st->execute([$ipHash, date('Y-m-d H:i:s', time() - 3600)]);
        if ((int)$st->fetchColumn() >= 10) fail('Слишком много заявок. Позвоните нам: +7 (993) 033-44-34', 429);

        $row = [
            $name, $phone,
            $clip($body['room'] ?? '', 100), $clip($body['materials'] ?? '', 300),
            $clip($body['timing'] ?? '', 100), $clip($body['needCalc'] ?? '', 100),
            $clip($body['source'] ?? '', 100), 1, $ipHash, date('Y-m-d H:i:s'),
        ];
        $pdo->prepare('INSERT INTO site_leads (name,phone,room,materials,timing,need_calc,source,consent_pd,ip_hash,created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?)')->execute($row);

        // Уведомление на почту магазина (почтовый сервер в России)
        if (!empty($config['notify_email'])) {
            $text = "Новая заявка с квиза сайта\n\nИмя: $name\nТелефон: $phone\nПомещение: {$row[2]}\nМатериалы: {$row[3]}\n"
                  . "Когда: {$row[4]}\nРасчёт количества: {$row[5]}\n\nСкидка 3% действует 2 дня.\nВсе заявки: https://kyzyl.vnashdom.ru/api/zayavki.html";
            @mail(
                (string)$config['notify_email'],
                '=?UTF-8?B?' . base64_encode('Заявка с квиза: ' . $name) . '?=',
                $text,
                "From: noreply@kyzyl.vnashdom.ru\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit"
            );
        }
        ok();
    }

    // ---------- Просмотр заявок (код администратора) ----------
    $token = $_SERVER['HTTP_X_API_TOKEN'] ?? '';
    if ($token === '' || !hash_equals((string)$config['admin_token'], $token)) fail('Неверный код доступа', 401);

    if ($action === 'list') {
        $rows = $pdo->query('SELECT id, name, phone, room, materials, timing, need_calc, created_at FROM site_leads ORDER BY id DESC LIMIT 1000')->fetchAll();
        ok(['rows' => $rows]);
    }
    if ($action === 'delete') { // по запросу клиента (отзыв согласия)
        $st = $pdo->prepare('DELETE FROM site_leads WHERE id = ?');
        $st->execute([(int)($body['id'] ?? 0)]);
        ok(['deleted' => $st->rowCount()]);
    }
    fail('Неизвестное действие');
} catch (Throwable $e) {
    fail('Ошибка сервера', 500);
}
