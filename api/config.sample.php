<?php
// Скопируйте в config.php (в этой же папке api/) и заполните. config.php не коммитить в git и никому не пересылать.
return [
    // База — ISPmanager → «Базы данных». Можно ту же, что у розыгрыша.
    'db_host' => 'localhost',
    'db_name' => 'uXXXXXXX_rozygrysh',
    'db_user' => 'uXXXXXXX_rozygrysh',
    'db_pass' => 'ЗАМЕНИТЕ_НА_ПАРОЛЬ_БАЗЫ',

    // Код для просмотра заявок на странице api/zayavki.html
    'admin_token' => 'ЗАМЕНИТЕ_НА_КОД',

    // Куда присылать письмо о новой заявке (пусто — не присылать)
    'notify_email' => 'tuva1@vnashdom.ru',
];
