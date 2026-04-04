<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$base = '/tmp/candidai_screenshots';

$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    // Restituisce la lista degli user_id (cartelle) con i relativi screenshot
    if (!is_dir($base)) {
        echo json_encode(['users' => []]);
        exit;
    }
    $users = [];
    foreach (scandir($base) as $uid) {
        if ($uid === '.' || $uid === '..') continue;
        $dir = "$base/$uid";
        if (!is_dir($dir)) continue;
        $files = [];
        foreach (scandir($dir) as $f) {
            if (!preg_match('/\.png$/i', $f)) continue;
            $files[] = [
                'name' => $f,
                'ts'   => filemtime("$dir/$f"),
            ];
        }
        usort($files, fn($a, $b) => $a['name'] <=> $b['name']);
        if ($files) $users[] = ['uid' => $uid, 'files' => $files];
    }
    usort($users, fn($a, $b) => $b['files'][0]['ts'] <=> $a['files'][0]['ts']);
    echo json_encode(['users' => $users], JSON_UNESCAPED_UNICODE);

} elseif ($action === 'img') {
    // Serve l'immagine come base64
    $uid  = basename($_GET['uid']  ?? '');
    $file = basename($_GET['file'] ?? '');
    $path = "$base/$uid/$file";
    if (!$uid || !$file || !file_exists($path)) {
        http_response_code(404);
        echo json_encode(['error' => 'not found']);
        exit;
    }
    header('Content-Type: application/json');
    echo json_encode(['data' => 'data:image/png;base64,' . base64_encode(file_get_contents($path))]);
} else {
    echo json_encode(['error' => 'unknown action']);
}
