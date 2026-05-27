import logging
import os
from flask import Flask, request, jsonify
from server.emails_generation import service as emails_generation_service
from server.send_emails import service as send_emails_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    filename="./logs/server/candidai.log",
)

_vp_log_path = "./logs/video-pipeline/pipeline.log"
os.makedirs(os.path.dirname(_vp_log_path), exist_ok=True)
_vp_logger = logging.getLogger("server.video_pipeline")
_vp_handler = logging.FileHandler(_vp_log_path, encoding="utf-8")
_vp_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
_vp_logger.addHandler(_vp_handler)
_vp_logger.setLevel(logging.INFO)
_vp_logger.propagate = False

app = Flask(__name__)
from flask_cors import CORS
CORS(app)


def _api_key_valid() -> bool:
    expected = os.environ.get("SESSION_API_KEY", "")
    return request.headers.get("X-API-Key", "") == expected


@app.route("/start_emails_generation", methods=["POST"])
def start_emails_generation():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id mancante o vuoto"}), 400
    return emails_generation_service.start(str(user_id))


@app.route("/save_session", methods=["POST"])
def save_session():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    return send_emails_service.save_session(data)


@app.route("/send_emails", methods=["POST"])
def send_emails():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    return send_emails_service.send_emails(data)


@app.route("/save_resend_config", methods=["POST"])
def save_resend_config():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    return send_emails_service.save_resend_config(data)


@app.route("/stop_campaign", methods=["POST"])
def stop_campaign():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    return send_emails_service.stop_campaign(data)


# ── Video Pipeline Routes ────────────────────────────────────────────────────
import os as _os
import glob as _glob
import threading as _threading
import queue as _queue
from flask import send_file as _send_file, jsonify as _jsonify, request as _request, Response as _Response

# Single-worker queue: ffmpeg and faster-whisper are CPU-bound — running them
# concurrently on a VPS causes severe resource contention and 10-15x slowdowns.
_ingest_queue: _queue.Queue = _queue.Queue()

def _ingest_worker():
    while True:
        job = _ingest_queue.get()
        try:
            job()
        except Exception as e:
            logging.getLogger("server.video_pipeline").error(f"ingest worker error: {e}", exc_info=True)
        finally:
            _ingest_queue.task_done()

_threading.Thread(target=_ingest_worker, daemon=True, name="ingest-worker").start()


def _start_video_file_server(port: int = 8000):
    """Concurrent HTTP server on a dedicated port for Buffer video downloads.

    Runs independently of gunicorn so video downloads never block the API queue.
    """
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    class _VideoHandler(BaseHTTPRequestHandler):
        def _resolve(self):
            parts = self.path.strip('/').split('/')
            if len(parts) != 2 or parts[0] != 'videos':
                return None
            video_id = parts[1]
            try:
                video = _vp_db().get_processed_video(video_id)
            except Exception:
                return None
            if not video or not _os.path.exists(video['file_path']):
                return None
            return video

        def do_HEAD(self):
            video = self._resolve()
            if not video:
                self.send_response(404); self.end_headers(); return
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Length', str(_os.path.getsize(video['file_path'])))
            self.end_headers()

        def do_GET(self):
            video = self._resolve()
            if not video:
                self.send_response(404); self.end_headers(); return
            file_size = _os.path.getsize(video['file_path'])
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Length', str(file_size))
            self.end_headers()
            try:
                with open(video['file_path'], 'rb') as f:
                    while chunk := f.read(65536):
                        self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, *args):
            pass  # suppress per-request access logs

    server = ThreadingHTTPServer(('0.0.0.0', port), _VideoHandler)
    _threading.Thread(target=server.serve_forever, daemon=True, name="video-file-server").start()
    logging.getLogger(__name__).info(f"Video file server started on port {port}")


_start_video_file_server(port=int(_os.environ.get("VIDEO_SERVER_PORT", "8000")))

def _start_pipeline_scheduler():
    try:
        from server.video_pipeline.scheduler import start_background_scheduler
        start_background_scheduler()
    except Exception as e:
        logging.getLogger("server.video_pipeline").error(
            f"Could not start pipeline scheduler: {e}", exc_info=True)

_start_pipeline_scheduler()


def _vp_storage():
    return _os.environ.get("VIDEO_STORAGE_PATH",
                           _os.path.join(_os.path.dirname(__file__), "video_library"))


def _vp_db():
    from server.video_pipeline.db import Database
    storage = _vp_storage()
    _os.makedirs(storage, exist_ok=True)
    return Database(_os.path.join(storage, "pipeline.db"))


def _video_duration(path: str) -> float:
    import subprocess as _sp, json as _json
    r = _sp.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        return 0.0
    for stream in _json.loads(r.stdout).get("streams", []):
        if stream.get("codec_type") == "video":
            return float(stream.get("duration", 0))
    return 0.0


@app.route('/videos/<video_id>')
def serve_video(video_id: str):
    """Serve a processed video file (consumed by Buffer API to pull video URL)."""
    db = _vp_db()
    video = db.get_processed_video(video_id)
    if not video or not _os.path.exists(video['file_path']):
        return _jsonify({"error": "not found"}), 404

    def _stream():
        with open(video['file_path'], 'rb') as f:
            while chunk := f.read(65536):
                yield chunk

    file_size = _os.path.getsize(video['file_path'])
    return _Response(
        _stream(),
        mimetype='video/mp4',
        headers={'Content-Length': str(file_size)},
    )


@app.route('/api/videos/pending')
def api_videos_pending():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    return _jsonify(_vp_db().list_pending_videos())


@app.route('/api/videos/approved')
def api_videos_approved():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    return _jsonify(_vp_db().list_approved_videos())


@app.route('/api/videos/<video_id>/approve', methods=['POST'])
def api_approve_video(video_id: str):
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    db = _vp_db()
    if not db.get_processed_video(video_id):
        return _jsonify({"error": "not found"}), 404
    data = _request.get_json() or {}
    rating = data.get("rating")
    if rating is not None:
        rating = int(rating)
        if not 1 <= rating <= 5:
            return _jsonify({"error": "rating must be 1-5"}), 400
    db.approve_video(video_id, rating)
    return _jsonify({"ok": True})


@app.route('/api/videos/<video_id>/rate', methods=['POST'])
def api_rate_video(video_id: str):
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    db = _vp_db()
    if not db.get_processed_video(video_id):
        return _jsonify({"error": "not found"}), 404
    data = _request.get_json() or {}
    rating = data.get("rating")
    if rating is None:
        return _jsonify({"error": "rating required"}), 400
    rating = int(rating)
    if not 1 <= rating <= 5:
        return _jsonify({"error": "rating must be 1-5"}), 400
    db.rate_video(video_id, rating)
    return _jsonify({"ok": True})


@app.route('/api/videos/<video_id>/reject', methods=['POST'])
def api_reject_video(video_id: str):
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    db = _vp_db()
    if not db.get_processed_video(video_id):
        return _jsonify({"error": "not found"}), 404
    db.reject_video(video_id)
    return _jsonify({"ok": True})


@app.route('/api/videos/library')
def api_video_library():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    return _jsonify(_vp_db().list_all_clips())


@app.route('/api/videos/ingest', methods=['POST'])
def api_video_ingest():
    """Accept YouTube URL + category, trigger download+processing in background thread."""
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    data = _request.get_json() or {}
    url = data.get("url", "").strip()
    category = data.get("category", "general").strip()
    start_time = data.get("start_time")  # seconds, optional
    end_time = data.get("end_time")      # seconds, optional
    if not url:
        return _jsonify({"error": "url required"}), 400

    def _process():
        try:
            from server.video_pipeline.library_manager import LibraryManager
            from server.video_pipeline.processor import VideoProcessor, LAYOUTS
            from server.video_pipeline.subtitles import SUBTITLE_STYLES

            storage = _vp_storage()
            db_path = _os.path.join(storage, "pipeline.db")
            lm = LibraryManager(db_path=db_path, storage_path=storage)
            clip_ids = lm.download_and_split(url, category, start_time, end_time)

            # Recovery: include clips that were split in a previous run but never
            # had variants generated (e.g. ffmpeg was killed mid-job).
            unprocessed = lm.db.list_unprocessed_clips_by_url(url)
            recovered_ids = [c['id'] for c in unprocessed if c['id'] not in clip_ids]
            if recovered_ids:
                logging.getLogger("server.video_pipeline").info(
                    f"Recovering {len(recovered_ids)} previously-split clips without variants for {url}"
                )
            clip_ids = clip_ids + recovered_ids

            proc = VideoProcessor(storage_path=storage, db_path=db_path)

            marketing_dir = _os.path.join(
                _os.path.dirname(__file__), "marketing materials", "videos"
            )
            marketing_videos = [
                v for v in _glob.glob(_os.path.join(marketing_dir, "*.mp4"))
                if "subtitled" not in _os.path.basename(v).lower()
            ]
            if not marketing_videos:
                return

            fixed_layout = LAYOUTS[0]
            fixed_style = list(SUBTITLE_STYLES.keys())[0]
            for mkt_video in marketing_videos:
                mkt_dur = _video_duration(mkt_video)
                usable_ids = lm.merge_clips_for_duration(clip_ids, mkt_dur, category)
                for clip_id in usable_ids:
                    proc.generate_variants(
                        source_video_path=mkt_video,
                        clip_id=clip_id,
                        layouts=[fixed_layout],
                        styles=[fixed_style],
                    )
        except Exception as e:
            logging.getLogger("server.video_pipeline").error(f"ingest error: {e}", exc_info=True)

    _ingest_queue.put(_process)
    queue_pos = _ingest_queue.qsize()
    return _jsonify({"ok": True, "message": f"Aggiunto alla coda (posizione {queue_pos})", "queue_size": queue_pos})


@app.route('/api/videos/buffer-status')
def api_buffer_status():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    from server.video_pipeline.buffer_client import BufferClient
    api_key = _os.environ.get("BUFFER_API_KEY", "")
    if not api_key:
        return _jsonify({"channels": [], "warning": "BUFFER_API_KEY not set"})
    try:
        channels = BufferClient(api_key=api_key).get_channels()
        return _jsonify({"channels": channels})
    except Exception as e:
        return _jsonify({"error": str(e)}), 500


@app.route('/api/videos/stats')
def api_videos_stats():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    return _jsonify(_vp_db().list_stats(limit=200))


@app.route('/api/videos/sources')
def api_video_sources():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    import re as _re
    db = _vp_db()
    sources = db.list_sources()
    result = []
    for s in sources:
        url = s['source_url']
        m = _re.search(r'(?:v=|/v/|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})', url)
        video_id = m.group(1) if m else None
        intervals = db.list_intervals_by_video_id(video_id) if video_id else []
        result.append({**s, 'video_id': video_id, 'intervals': intervals})
    return _jsonify(result)


@app.route('/api/settings/<key>', methods=['GET'])
def api_get_setting(key: str):
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    return _jsonify({"value": _vp_db().get_setting(key)})


@app.route('/api/settings/<key>', methods=['POST'])
def api_set_setting(key: str):
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    data = _request.get_json() or {}
    _vp_db().set_setting(key, data.get("value", ""))
    return _jsonify({"ok": True})


@app.route('/api/videos/captions', methods=['GET'])
def api_list_captions():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    return _jsonify(_vp_db().list_captions())


@app.route('/api/videos/captions', methods=['POST'])
def api_add_captions():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    data = _request.get_json() or {}
    raw = data.get('text', '')
    texts = [t.strip() for t in raw.split('--') if t.strip()]
    if not texts:
        return _jsonify({"error": "text required"}), 400
    db = _vp_db()
    ids = [db.add_caption(t) for t in texts]
    return _jsonify({"ok": True, "added": len(ids), "ids": ids})


@app.route('/api/videos/captions/<caption_id>', methods=['DELETE'])
def api_delete_caption(caption_id: str):
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    _vp_db().delete_caption(caption_id)
    return _jsonify({"ok": True})


@app.route('/api/videos/fill-queue', methods=['POST'])
def api_fill_buffer_queue():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    import threading as _thr
    def _run():
        try:
            from server.video_pipeline.scheduler import fill_buffer_queue
            fill_buffer_queue()
        except Exception as e:
            logging.getLogger("server.video_pipeline").error(
                f"fill-queue error: {e}", exc_info=True)
    _thr.Thread(target=_run, daemon=True, name="fill-queue-trigger").start()
    return _jsonify({"ok": True, "message": "Controllo Buffer avviato"})


@app.route('/api/videos/sources/category', methods=['POST'])
def api_update_source_category():
    if not _api_key_valid():
        return _jsonify({"error": "Unauthorized"}), 401
    data = _request.get_json() or {}
    source_url = data.get('source_url', '').strip()
    category = data.get('category', '').strip()
    if not source_url or not category:
        return _jsonify({"error": "source_url and category required"}), 400
    _vp_db().update_clips_category(source_url, category)
    return _jsonify({"ok": True})
# ── End Video Pipeline Routes ────────────────────────────────────────────────
