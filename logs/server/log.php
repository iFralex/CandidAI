<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$logFile = __DIR__ . '/candidai.log';

if (!file_exists($logFile)) {
    echo json_encode(['lines' => [], 'count' => 0]);
    exit;
}

$mode = $_GET['mode'] ?? 'lines';
$n    = max(1, min(50000, (int)($_GET['n'] ?? 300)));
$unit = $_GET['unit'] ?? 'minutes';
$from = $_GET['from'] ?? '';
$to   = $_GET['to']   ?? '';

// Estrae il timestamp unix da una riga di log (formato: "YYYY-MM-DD HH:MM:SS,mmm [LEVEL] msg")
function lineTs(string $line): ?int {
    if (preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/', $line, $m))
        return strtotime($m[1]);
    return null;
}

// Legge le ultime $max righe complete usando fseek (non carica l'intero file)
function tailLines(string $file, int $max): array {
    $fh  = fopen($file, 'rb');
    fseek($fh, 0, SEEK_END);
    $buf   = '';
    $lines = [];
    $pos   = ftell($fh);

    while ($pos > 0 && count($lines) < $max + 1) {
        $read = min(8192, $pos);
        $pos -= $read;
        fseek($fh, $pos);
        $buf   = fread($fh, $read) . $buf;
        $parts = explode("\n", $buf);
        $buf   = array_shift($parts);   // prima parte potenzialmente incompleta
        $lines = array_merge($parts, $lines);
    }
    if ($buf !== '') array_unshift($lines, $buf);
    fclose($fh);

    return array_values(array_filter($lines, fn($l) => trim($l) !== ''));
}

// Legge dalla fine finché non trova righe più vecchie di $cutoff (efficiente per log recenti)
function tailSince(string $file, int $cutoff): array {
    $fh   = fopen($file, 'rb');
    fseek($fh, 0, SEEK_END);
    $buf   = '';
    $lines = [];
    $pos   = ftell($fh);
    $stop  = false;

    while ($pos > 0 && !$stop) {
        $read = min(16384, $pos);
        $pos -= $read;
        fseek($fh, $pos);
        $buf   = fread($fh, $read) . $buf;
        $parts = explode("\n", $buf);
        $buf   = array_shift($parts);
        $lines = array_merge($parts, $lines);

        foreach ($lines as $l) {
            $ts = lineTs($l);
            if ($ts !== null && $ts < $cutoff) { $stop = true; break; }
        }
    }
    if ($buf !== '') array_unshift($lines, $buf);
    fclose($fh);

    $result = [];
    foreach ($lines as $l) {
        if (trim($l) === '') continue;
        $ts = lineTs($l);
        if ($ts === null || $ts >= $cutoff) $result[] = $l;
    }
    return $result;
}

// ── Dispatch ────────────────────────────────────────────────────
if ($mode === 'lines') {
    $all   = tailLines($logFile, $n);
    $lines = array_slice($all, -$n);

} elseif ($mode === 'time') {
    $mult  = ['minutes' => 60, 'hours' => 3600, 'days' => 86400][$unit] ?? 60;
    $lines = tailSince($logFile, time() - $n * $mult);

} elseif ($mode === 'range') {
    $cutFrom = $from ? strtotime($from) : 0;
    $cutTo   = $to   ? strtotime($to)   : PHP_INT_MAX;
    $all     = $cutFrom > 0 ? tailSince($logFile, $cutFrom) : tailLines($logFile, 100000);
    $lines   = [];
    foreach ($all as $l) {
        $ts = lineTs($l);
        if ($ts === null || ($ts >= $cutFrom && $ts <= $cutTo)) $lines[] = $l;
    }
} else {
    $lines = [];
}

echo json_encode(
    ['lines' => array_values($lines), 'count' => count($lines)],
    JSON_UNESCAPED_UNICODE
);
