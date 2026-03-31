<?php
// ── API mode ─────────────────────────────────────────────────────────────────
if (isset($_GET['api'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');

    $which = $_GET['api'] === 'error' ? 'error' : 'access';
    $logFile = __DIR__ . '/' . $which . '.log';

    if (!file_exists($logFile)) {
        echo json_encode(['lines' => [], 'count' => 0]);
        exit;
    }

    $mode = $_GET['mode'] ?? 'lines';
    $n    = max(1, min(50000, (int)($_GET['n'] ?? 300)));
    $unit = $_GET['unit'] ?? 'minutes';
    $from = $_GET['from'] ?? '';
    $to   = $_GET['to']   ?? '';

    // Timestamp extractor — supports both log formats
    function lineTs(string $line, string $which): ?int {
        if ($which === 'error') {
            // [2026-03-28 10:23:45 +0000] [pid] [LEVEL] msg
            if (preg_match('/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/', $line, $m))
                return strtotime($m[1]);
        } else {
            // 127.0.0.1 - - [28/Mar/2026:10:23:45 +0000] "GET ..." 200 123
            if (preg_match('/\[(\d{2})\/(\w+)\/(\d{4}):(\d{2}:\d{2}:\d{2})/', $line, $m)) {
                $ts = strtotime($m[1] . ' ' . $m[2] . ' ' . $m[3] . ' ' . $m[4]);
                return $ts !== false ? $ts : null;
            }
        }
        return null;
    }

    function tailLines(string $file, int $max): array {
        $fh  = fopen($file, 'rb');
        fseek($fh, 0, SEEK_END);
        $buf = ''; $lines = []; $pos = ftell($fh);
        while ($pos > 0 && count($lines) < $max + 1) {
            $read = min(8192, $pos); $pos -= $read;
            fseek($fh, $pos);
            $buf   = fread($fh, $read) . $buf;
            $parts = explode("\n", $buf);
            $buf   = array_shift($parts);
            $lines = array_merge($parts, $lines);
        }
        if ($buf !== '') array_unshift($lines, $buf);
        fclose($fh);
        return array_values(array_filter($lines, fn($l) => trim($l) !== ''));
    }

    function tailSince(string $file, int $cutoff, string $which): array {
        $fh   = fopen($file, 'rb');
        fseek($fh, 0, SEEK_END);
        $buf = ''; $lines = []; $pos = ftell($fh); $stop = false;
        while ($pos > 0 && !$stop) {
            $read = min(16384, $pos); $pos -= $read;
            fseek($fh, $pos);
            $buf   = fread($fh, $read) . $buf;
            $parts = explode("\n", $buf);
            $buf   = array_shift($parts);
            $lines = array_merge($parts, $lines);
            foreach ($lines as $l) {
                $ts = lineTs($l, $which);
                if ($ts !== null && $ts < $cutoff) { $stop = true; break; }
            }
        }
        if ($buf !== '') array_unshift($lines, $buf);
        fclose($fh);
        $result = [];
        foreach ($lines as $l) {
            if (trim($l) === '') continue;
            $ts = lineTs($l, $which);
            if ($ts === null || $ts >= $cutoff) $result[] = $l;
        }
        return $result;
    }

    if ($mode === 'lines') {
        $lines = array_slice(tailLines($logFile, $n), -$n);
    } elseif ($mode === 'time') {
        $mult  = ['minutes' => 60, 'hours' => 3600, 'days' => 86400][$unit] ?? 60;
        $lines = tailSince($logFile, time() - $n * $mult, $which);
    } elseif ($mode === 'range') {
        $cutFrom = $from ? strtotime($from) : 0;
        $cutTo   = $to   ? strtotime($to)   : PHP_INT_MAX;
        $all     = $cutFrom > 0 ? tailSince($logFile, $cutFrom, $which) : tailLines($logFile, 100000);
        $lines   = [];
        foreach ($all as $l) {
            $ts = lineTs($l, $which);
            if ($ts === null || ($ts >= $cutFrom && $ts <= $cutTo)) $lines[] = $l;
        }
    } else {
        $lines = [];
    }

    echo json_encode(['lines' => array_values($lines), 'count' => count($lines)], JSON_UNESCAPED_UNICODE);
    exit;
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CandidAI — Gunicorn Logs</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --purple: #667eea; --purple-dark: #764ba2;
            --bg: #0f0f1a; --surface: #1a1a2e; --surface2: #16213e;
            --border: #2a2a4a; --text: #e2e8f0; --text-dim: #94a3b8;
            --green: #4ade80; --red: #f87171; --yellow: #fbbf24;
            --blue: #60a5fa; --orange: #fb923c;
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }

        /* topbar */
        .topbar { background: linear-gradient(135deg, var(--purple) 0%, var(--purple-dark) 100%); padding: 13px 20px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.4); flex-shrink: 0; }
        .topbar a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; }
        .topbar a:hover { color: #fff; }
        .topbar .sep { color: rgba(255,255,255,0.35); }
        .topbar h1 { font-size: 17px; font-weight: 700; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3); flex-shrink: 0; }
        .dot.live { background: var(--green); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        #ts { font-size: 12px; color: rgba(255,255,255,0.6); margin-left: auto; }

        /* tabs */
        .tabs { display: flex; background: var(--surface2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .tab { padding: 10px 24px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text-dim); border-bottom: 2px solid transparent; transition: color .2s, border-color .2s; user-select: none; }
        .tab:hover { color: var(--text); }
        .tab.active { color: var(--purple); border-bottom-color: var(--purple); }

        /* filter bar */
        .filterbar { display: flex; align-items: center; gap: 10px; padding: 10px 20px; background: var(--surface2); border-bottom: 1px solid var(--border); flex-wrap: wrap; flex-shrink: 0; }
        select, input[type=number], input[type=datetime-local] {
            background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
            padding: 5px 10px; color: var(--text); font-size: 13px; outline: none;
        }
        select:focus, input:focus { border-color: var(--purple); }
        input[type=number] { width: 80px; }
        input[type=datetime-local] { width: 185px; color-scheme: dark; }
        .btn { background: var(--purple); color: #fff; border: none; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; transition: background .2s; white-space: nowrap; }
        .btn:hover { background: var(--purple-dark); }
        .btn.ghost { background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); }
        .btn.ghost:hover { color: var(--text); border-color: var(--purple); }
        .btn.on { background: var(--green); color: #000; }
        .sep-v { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; }
        .spacer { flex: 1; }
        #counter { font-size: 12px; color: var(--text-dim); white-space: nowrap; }

        /* search bar */
        .searchbar { display: flex; align-items: center; gap: 10px; padding: 8px 20px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .searchbar input[type=text] { flex: 1; max-width: 340px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; color: var(--text); font-size: 13px; }
        .searchbar input[type=text]:focus { outline: none; border-color: var(--purple); }

        /* log area */
        #log-wrap { flex: 1; overflow-y: auto; padding: 12px 20px; }
        #log-lines { font-family: 'SF Mono','Fira Code','Cascadia Code',monospace; font-size: 12px; line-height: 1.75; }

        /* shared row */
        .ll { display: flex; gap: 10px; padding: 2px 4px; border-radius: 3px; align-items: baseline; }
        .ll:hover { background: rgba(255,255,255,0.03); }
        .lts  { color: var(--text-dim); white-space: nowrap; flex-shrink: 0; font-size: 11px; }
        .llv  { font-weight: 700; white-space: nowrap; flex-shrink: 0; width: 58px; text-align: center; border-radius: 3px; padding: 1px 3px; font-size: 10px; align-self: flex-start; margin-top: 1px; }
        .lm   { color: var(--text); word-break: break-word; }
        .lraw { color: var(--text-dim); word-break: break-all; }
        .hl   { background: rgba(102,126,234,0.18) !important; }

        /* error log levels */
        .lv-INFO     { color: var(--green);  background: rgba(74,222,128,0.1); }
        .lv-ERROR    { color: var(--red);    background: rgba(248,113,113,0.15); }
        .lv-WARNING,
        .lv-WARN     { color: var(--yellow); background: rgba(251,191,36,0.1); }
        .lv-DEBUG    { color: var(--blue);   background: rgba(96,165,250,0.1); }
        .lv-CRITICAL { color: #f43f5e;       background: rgba(244,63,94,0.15); font-weight: 900; }

        /* pid badge */
        .lpid { color: #a78bfa; white-space: nowrap; flex-shrink: 0; font-size: 11px; }

        /* access log specifics */
        .lip    { color: #93c5fd; white-space: nowrap; flex-shrink: 0; width: 120px; overflow: hidden; text-overflow: ellipsis; }
        .lmethod { font-weight: 700; white-space: nowrap; flex-shrink: 0; width: 52px; text-align: center; border-radius: 3px; padding: 1px 3px; font-size: 10px; }
        .m-GET    { color: var(--green);  background: rgba(74,222,128,0.1); }
        .m-POST   { color: var(--blue);   background: rgba(96,165,250,0.1); }
        .m-PUT    { color: var(--yellow); background: rgba(251,191,36,0.1); }
        .m-PATCH  { color: var(--orange); background: rgba(251,146,60,0.1); }
        .m-DELETE { color: var(--red);    background: rgba(248,113,113,0.15); }
        .m-HEAD, .m-OPTIONS { color: var(--text-dim); background: rgba(148,163,184,0.1); }
        .lpath  { color: var(--text); word-break: break-all; flex: 1; }
        .lstatus { font-weight: 700; white-space: nowrap; flex-shrink: 0; width: 36px; text-align: center; border-radius: 3px; padding: 1px 3px; font-size: 11px; }
        .s-2 { color: var(--green);  background: rgba(74,222,128,0.1); }
        .s-3 { color: var(--blue);   background: rgba(96,165,250,0.1); }
        .s-4 { color: var(--yellow); background: rgba(251,191,36,0.1); }
        .s-5 { color: var(--red);    background: rgba(248,113,113,0.15); }
        .lsize { color: var(--text-dim); white-space: nowrap; flex-shrink: 0; font-size: 11px; min-width: 50px; text-align: right; }

        .empty { text-align: center; padding: 60px; color: var(--text-dim); font-size: 14px; }
        .err   { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 6px; padding: 10px 16px; color: var(--red); margin: 12px 20px; font-size: 13px; }

        /* stack trace */
        .lm-wrap { flex: 1; word-break: break-word; min-width: 0; }
        .trace-toggle { display: inline-block; margin-top: 4px; background: rgba(102,126,234,0.15); border: 1px solid rgba(102,126,234,0.35); border-radius: 3px; color: var(--purple); font-size: 11px; font-family: inherit; cursor: pointer; padding: 1px 7px; line-height: 1.6; }
        .trace-toggle:hover { background: rgba(102,126,234,0.3); }
        .trace-body { display: none; margin-top: 5px; padding: 6px 10px; background: rgba(0,0,0,0.35); border-left: 2px solid rgba(102,126,234,0.5); border-radius: 0 4px 4px 0; font-size: 11px; color: var(--text-dim); overflow-x: auto; white-space: pre; }
        .trace-body.open { display: block; }

        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: var(--bg); } ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; } ::-webkit-scrollbar-thumb:hover { background: var(--purple); }
    </style>
</head>
<body>

<div class="topbar">
    <a href="../">← Logs</a><span class="sep">/</span>
    <h1>Gunicorn</h1>
    <span class="dot" id="dot"></span>
    <span id="ts">—</span>
</div>

<div class="tabs">
    <div class="tab active" id="tab-access" onclick="switchTab('access')">📥 Access Log</div>
    <div class="tab" id="tab-error"  onclick="switchTab('error')">⚠️ Error Log</div>
</div>

<div class="filterbar">
    <select id="mode" onchange="onModeChange()">
        <option value="lines">Ultime N righe</option>
        <option value="time">Ultimi N …</option>
        <option value="range">Intervallo date</option>
    </select>

    <span id="g-n" style="display:flex;gap:8px;align-items:center">
        <input type="number" id="n" value="300" min="1" max="50000">
        <select id="unit" style="display:none">
            <option value="minutes">minuti</option>
            <option value="hours">ore</option>
            <option value="days">giorni</option>
        </select>
    </span>

    <span id="g-range" style="display:none;gap:8px;align-items:center">
        <label style="font-size:12px;color:var(--text-dim)">Da</label>
        <input type="datetime-local" id="from">
        <label style="font-size:12px;color:var(--text-dim)">A</label>
        <input type="datetime-local" id="to">
    </span>

    <button class="btn" onclick="load()">Applica</button>
    <span class="sep-v"></span>
    <span id="counter">—</span>
    <div class="spacer"></div>
    <button class="btn ghost" onclick="scrollTop()">↑</button>
    <button class="btn ghost" onclick="scrollBot()">↓</button>
    <button class="btn on" id="asBtn" onclick="toggleAS()">Auto-scroll</button>
    <button class="btn ghost" id="liveBtn" onclick="toggleLive()">⏸ Pausa</button>
</div>

<div class="searchbar">
    <input type="text" id="search" placeholder="Filtra righe visibili…" oninput="renderLines()">
    <button class="btn ghost" onclick="document.getElementById('search').value='';renderLines()">✕</button>
</div>

<div id="err-box" class="err" style="display:none"></div>
<div id="log-wrap">
    <div id="log-lines"><div class="empty">Caricamento…</div></div>
</div>

<script>
const ACCESS_RE = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\w+)\s+(\S+)\s+[^"]*"\s+(\d+)\s+(\d+|-)/;
const ERROR_RE  = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[^\]]*)\]\s+\[(\d+)\]\s+\[(\w+)\]\s+(.+)$/;

let rawLines = [], liveOn = true, autoScroll = true, currentTab = 'access';

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tab-access').className = 'tab' + (tab === 'access' ? ' active' : '');
    document.getElementById('tab-error').className  = 'tab' + (tab === 'error'  ? ' active' : '');
    rawLines = [];
    document.getElementById('log-lines').innerHTML = '<div class="empty">Caricamento…</div>';
    load();
}

function onModeChange() {
    const m = document.getElementById('mode').value;
    document.getElementById('g-n').style.display     = m !== 'range' ? 'flex' : 'none';
    document.getElementById('unit').style.display    = m === 'time'  ? ''     : 'none';
    document.getElementById('g-range').style.display = m === 'range' ? 'flex' : 'none';
}
function scrollTop() { document.getElementById('log-wrap').scrollTop = 0; }
function scrollBot() { const w = document.getElementById('log-wrap'); w.scrollTop = w.scrollHeight; }
function toggleAS() {
    autoScroll = !autoScroll;
    document.getElementById('asBtn').className = 'btn ' + (autoScroll ? 'on' : 'ghost');
    document.getElementById('asBtn').textContent = autoScroll ? 'Auto-scroll' : 'Auto-scroll off';
}
function toggleLive() {
    liveOn = !liveOn;
    document.getElementById('liveBtn').textContent = liveOn ? '⏸ Pausa' : '▶ Riprendi';
    document.getElementById('dot').className = 'dot' + (liveOn ? ' live' : '');
    if (liveOn) load();
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function formatSize(raw) {
    const n = parseInt(raw);
    if (isNaN(n) || raw === '-') return '-';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
    return (n/1048576).toFixed(1) + ' MB';
}

function renderAccessLine(line, hl) {
    const m = ACCESS_RE.exec(line);
    if (!m) return `<div class="ll${hl?' hl':''}"><span class="lraw">${esc(line)}</span></div>`;
    const [, ip, ts, method, path, status, size] = m;
    const sc = parseInt(status);
    const scClass = sc >= 500 ? 's-5' : sc >= 400 ? 's-4' : sc >= 300 ? 's-3' : 's-2';
    return `<div class="ll${hl?' hl':''}">` +
        `<span class="lts">${esc(ts)}</span>` +
        `<span class="lip">${esc(ip)}</span>` +
        `<span class="lmethod m-${esc(method)}">${esc(method)}</span>` +
        `<span class="lpath">${esc(path)}</span>` +
        `<span class="lstatus ${scClass}">${esc(status)}</span>` +
        `<span class="lsize">${formatSize(size)}</span>` +
        `</div>`;
}

let _traceIdx = 0;
function toggleTrace(id) {
    const body = document.getElementById(id);
    const btn  = body.previousElementSibling;
    const open = body.classList.toggle('open');
    btn.textContent = (open ? '▼ ' : '▶ ') + body.children.length + ' lines';
}

function groupErrorLines(lines) {
    const groups = [];
    let cur = null;
    for (const line of lines) {
        if (ERROR_RE.test(line)) {
            if (cur) groups.push(cur);
            cur = { main: line, trace: [] };
        } else {
            if (cur) cur.trace.push(line);
            else groups.push({ main: line, trace: [] });
        }
    }
    if (cur) groups.push(cur);
    return groups;
}

function renderErrorLine(entry, hl) {
    const line  = typeof entry === 'string' ? entry : entry.main;
    const trace = typeof entry === 'object' && entry.trace ? entry.trace : [];
    const m = ERROR_RE.exec(line);
    if (!m) return `<div class="ll${hl?' hl':''}"><span class="lraw">${esc(line)}</span></div>`;
    const [, ts, pid, level, msg] = m;
    let traceHtml = '';
    if (trace.length) {
        const id = 'tr' + (++_traceIdx);
        traceHtml = `<button class="trace-toggle" onclick="toggleTrace('${id}')">▶ ${trace.length} lines</button>` +
            `<div class="trace-body" id="${id}">${trace.map(l => `<span>${esc(l)}</span>`).join('\n')}</div>`;
    }
    return `<div class="ll${hl?' hl':''}">` +
        `<span class="lts">${esc(ts)}</span>` +
        `<span class="lpid">[${esc(pid)}]</span>` +
        `<span class="llv lv-${esc(level)}">${esc(level)}</span>` +
        `<div class="lm-wrap"><span class="lm">${esc(msg)}</span>${traceHtml}</div>` +
        `</div>`;
}

function renderLines() {
    const q = document.getElementById('search').value.trim().toLowerCase();
    let html;
    if (currentTab === 'access') {
        const filtered = q ? rawLines.filter(l => l.toLowerCase().includes(q)) : rawLines;
        html = filtered.map(l => renderAccessLine(l, !!q)).join('');
    } else {
        const groups = groupErrorLines(rawLines);
        const filtered = q
            ? groups.filter(g => g.main.toLowerCase().includes(q) || g.trace.some(t => t.toLowerCase().includes(q)))
            : groups;
        html = filtered.map(g => renderErrorLine(g, !!q)).join('');
    }
    document.getElementById('log-lines').innerHTML = html || '<div class="empty">Nessun risultato.</div>';
    if (autoScroll) scrollBot();
}

async function load() {
    if (!liveOn) return;
    const mode = document.getElementById('mode').value;
    const n    = document.getElementById('n').value;
    const unit = document.getElementById('unit').value;
    const from = document.getElementById('from').value;
    const to   = document.getElementById('to').value;

    const params = new URLSearchParams({api: currentTab, mode, n, unit});
    if (from) params.set('from', from.replace('T',' '));
    if (to)   params.set('to',   to.replace('T',' '));

    try {
        const r = await fetch('index.php?' + params + '&_=' + Date.now());
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        document.getElementById('err-box').style.display = 'none';
        rawLines = data.lines || [];
        document.getElementById('counter').textContent = rawLines.length + ' righe';
        document.getElementById('ts').textContent = new Date().toLocaleTimeString('it-IT');
        document.getElementById('dot').className = 'dot live';
        renderLines();
    } catch(e) {
        document.getElementById('dot').className = 'dot';
        const el = document.getElementById('err-box');
        el.style.display = 'block';
        el.textContent = 'Errore caricamento log: ' + e.message;
    }
}

onModeChange();
load();
setInterval(load, 5000);
</script>
</body>
</html>
