<?php
// Shared auth guard for the log viewers. FAILS CLOSED: if no key is configured
// the endpoints stay locked — a missing key must never disable authentication.
// Prefer the X-Api-Key header (keeps the secret out of access logs / browser
// history); the ?key= query param is still accepted for the existing viewer UIs.
$env_file = __DIR__ . '/../.env.local';
$expected = '';
if (file_exists($env_file)) {
    foreach (file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with($line, 'SESSION_API_KEY='))
            $expected = trim(substr($line, strlen('SESSION_API_KEY=')), " \t\"'");
    }
}

function _log_auth_deny() {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Fail closed: previously an empty key silently disabled auth (`return`),
// leaving every log viewer — AI prompts, screenshots, PDL/RocketReach PII —
// world-readable.
if ($expected === '') {
    _log_auth_deny();
}

$provided = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['key'] ?? '';
// hash_equals = constant-time compare (no key-length/prefix timing oracle).
if (!is_string($provided) || !hash_equals($expected, $provided)) {
    _log_auth_deny();
}
