<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$logFile = __DIR__ . '/pdl_log.json';

if (!file_exists($logFile)) {
    echo json_encode(['entries' => [], 'total' => 0]);
    exit;
}

$mode = $_GET['mode'] ?? 'entries';
$n    = max(1, min(5000, (int)($_GET['n'] ?? 50)));
$unit = $_GET['unit'] ?? 'hours';
$from = $_GET['from'] ?? '';
$to   = $_GET['to']   ?? '';

$data  = json_decode(file_get_contents($logFile), true) ?: [];
$total = count($data);

if ($mode === 'entries') {
    $entries = array_slice($data, -$n);

} elseif ($mode === 'time') {
    $mult    = ['minutes' => 60, 'hours' => 3600, 'days' => 86400][$unit] ?? 3600;
    $cutoff  = time() - $n * $mult;
    $entries = array_values(array_filter($data, fn($e) =>
        !isset($e['timestamp']) || strtotime($e['timestamp']) >= $cutoff
    ));

} elseif ($mode === 'range') {
    $cutFrom = $from ? strtotime($from) : 0;
    $cutTo   = $to   ? strtotime($to)   : PHP_INT_MAX;
    $entries = array_values(array_filter($data, function ($e) use ($cutFrom, $cutTo) {
        if (!isset($e['timestamp'])) return true;
        $ts = strtotime($e['timestamp']);
        return $ts >= $cutFrom && $ts <= $cutTo;
    }));

} else {
    $entries = array_slice($data, -$n);
}

echo json_encode(
    ['entries' => $entries, 'total' => $total, 'count' => count($entries)],
    JSON_UNESCAPED_UNICODE
);
