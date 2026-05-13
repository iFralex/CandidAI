<?php
$key_file = __DIR__ . '/.api_key';
$expected = file_exists($key_file) ? trim(file_get_contents($key_file)) : '';

if ($expected === '') return; // no key file = auth disabled

$provided = $_GET['key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($provided !== $expected) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}
