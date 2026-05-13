<?php
require_once __DIR__ . '/../auth.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$log_file = __DIR__ . '/pipeline.log';

if (!file_exists($log_file)) {
    echo json_encode(['lines' => [], 'error' => 'Log file not found yet — start the scheduler to generate logs']);
    exit;
}

$mode      = $_GET['mode']  ?? 'lines';
$count     = max(1, intval($_GET['count'] ?? 300));
$unit      = $_GET['unit']  ?? 'minutes';
$date_from = $_GET['from']  ?? '';
$date_to   = $_GET['to']    ?? '';

function tail_file(string $path, int $n): array {
    $fp   = fopen($path, 'rb');
    $buf  = '';
    $lines = [];
    fseek($fp, 0, SEEK_END);
    $pos = ftell($fp);
    while ($pos > 0 && count($lines) < $n + 1) {
        $chunk = min(4096, $pos);
        $pos  -= $chunk;
        fseek($fp, $pos);
        $buf  = fread($fp, $chunk) . $buf;
        $lines = explode("\n", $buf);
    }
    fclose($fp);
    $lines = array_filter(array_slice($lines, -$n), fn($l) => trim($l) !== '');
    return array_values($lines);
}

function filter_by_time(array $lines, int $seconds_ago): array {
    $cutoff = time() - $seconds_ago;
    return array_values(array_filter($lines, function($line) use ($cutoff) {
        if (preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/', $line, $m))
            return strtotime($m[1]) >= $cutoff;
        return true;
    }));
}

function filter_by_range(array $lines, string $from, string $to): array {
    $ts_from = $from ? strtotime($from) : 0;
    $ts_to   = $to   ? strtotime($to)   : PHP_INT_MAX;
    return array_values(array_filter($lines, function($line) use ($ts_from, $ts_to) {
        if (preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/', $line, $m)) {
            $ts = strtotime($m[1]);
            return $ts >= $ts_from && $ts <= $ts_to;
        }
        return true;
    }));
}

$lines = tail_file($log_file, max($count, 2000));

if ($mode === 'time') {
    $multipliers = ['minutes' => 60, 'hours' => 3600, 'days' => 86400];
    $lines = filter_by_time($lines, $count * ($multipliers[$unit] ?? 60));
} elseif ($mode === 'range') {
    $lines = filter_by_range($lines, $date_from, $date_to);
} else {
    $lines = array_slice($lines, -$count);
}

echo json_encode(['lines' => array_values($lines)]);
