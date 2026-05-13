<?php
$env_file = __DIR__ . '/../.env.local';
$expected = '';
if (file_exists($env_file)) {
    foreach (file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with($line, 'SESSION_API_KEY='))
            $expected = trim(substr($line, strlen('SESSION_API_KEY=')), " \t\"'");
    }
}

if ($expected === '') return; // SESSION_API_KEY not set = auth disabled

$provided = $_GET['key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($provided !== $expected) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}
