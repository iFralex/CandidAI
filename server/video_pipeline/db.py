import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_schema()

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_schema(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS clips (
                    id TEXT PRIMARY KEY,
                    source_url TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    duration REAL,
                    category TEXT,
                    created_at TEXT,
                    used_count INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS processed_videos (
                    id TEXT PRIMARY KEY,
                    source_video_path TEXT NOT NULL,
                    clip_id TEXT NOT NULL,
                    layout TEXT NOT NULL,
                    subtitle_style TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at TEXT,
                    approved_at TEXT,
                    buffer_post_id TEXT,
                    scheduled_for TEXT,
                    platform TEXT,
                    ai_decision_id TEXT,
                    FOREIGN KEY (clip_id) REFERENCES clips(id)
                );

                CREATE TABLE IF NOT EXISTS ai_decisions (
                    id TEXT PRIMARY KEY,
                    layout TEXT,
                    clip_category TEXT,
                    subtitle_style TEXT,
                    reasoning TEXT,
                    created_at TEXT
                );

                CREATE TABLE IF NOT EXISTS buffer_stats (
                    id TEXT PRIMARY KEY,
                    buffer_post_id TEXT NOT NULL,
                    processed_video_id TEXT,
                    platform TEXT,
                    collected_at TEXT,
                    impressions INTEGER DEFAULT 0,
                    likes INTEGER DEFAULT 0,
                    comments INTEGER DEFAULT 0,
                    shares INTEGER DEFAULT 0,
                    clicks INTEGER DEFAULT 0,
                    engagement_rate REAL DEFAULT 0.0
                );
            """)

    def create_clip(self, source_url: str, file_path: str, duration: float, category: str) -> str:
        clip_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO clips (id, source_url, file_path, duration, category, created_at) VALUES (?,?,?,?,?,?)",
                (clip_id, source_url, file_path, duration, category, _now())
            )
        return clip_id

    def get_clip(self, clip_id: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM clips WHERE id=?", (clip_id,)).fetchone()
            return dict(row) if row else None

    def list_clips_by_category(self, category: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM clips WHERE category=? ORDER BY used_count ASC",
                (category,)
            ).fetchall()
            return [dict(r) for r in rows]

    def list_all_clips(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM clips ORDER BY category, used_count ASC").fetchall()
            return [dict(r) for r in rows]

    def increment_clip_used(self, clip_id: str):
        with self._conn() as conn:
            conn.execute("UPDATE clips SET used_count = used_count + 1 WHERE id=?", (clip_id,))

    def create_processed_video(self, source_video_path: str, clip_id: str, layout: str,
                                subtitle_style: str, file_path: str,
                                ai_decision_id: str = None) -> str:
        vid_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO processed_videos
                   (id, source_video_path, clip_id, layout, subtitle_style, file_path,
                    status, created_at, ai_decision_id)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (vid_id, source_video_path, clip_id, layout, subtitle_style,
                 file_path, 'pending', _now(), ai_decision_id)
            )
        return vid_id

    def get_processed_video(self, vid_id: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM processed_videos WHERE id=?", (vid_id,)).fetchone()
            return dict(row) if row else None

    def list_pending_videos(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM processed_videos WHERE status='pending' ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def list_approved_videos(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM processed_videos WHERE status='approved' ORDER BY approved_at ASC"
            ).fetchall()
            return [dict(r) for r in rows]

    def list_recent_published(self, limit: int = 20) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM processed_videos WHERE status='published' ORDER BY scheduled_for DESC LIMIT ?",
                (limit,)
            ).fetchall()
            return [dict(r) for r in rows]

    def approve_video(self, vid_id: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE processed_videos SET status='approved', approved_at=? WHERE id=?",
                (_now(), vid_id)
            )

    def reject_video(self, vid_id: str):
        with self._conn() as conn:
            conn.execute("UPDATE processed_videos SET status='rejected' WHERE id=?", (vid_id,))

    def mark_published(self, vid_id: str, buffer_post_id: str, scheduled_for: str, platform: str):
        with self._conn() as conn:
            conn.execute(
                """UPDATE processed_videos
                   SET status='published', buffer_post_id=?, scheduled_for=?, platform=?
                   WHERE id=?""",
                (buffer_post_id, scheduled_for, platform, vid_id)
            )

    def save_ai_decision(self, layout: str, clip_category: str, subtitle_style: str, reasoning: str) -> str:
        dec_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO ai_decisions (id, layout, clip_category, subtitle_style, reasoning, created_at) VALUES (?,?,?,?,?,?)",
                (dec_id, layout, clip_category, subtitle_style, reasoning, _now())
            )
        return dec_id

    def save_buffer_stats(self, buffer_post_id: str, processed_video_id: Optional[str],
                          platform: str, impressions: int, likes: int, comments: int,
                          shares: int, clicks: int, engagement_rate: float):
        stat_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO buffer_stats
                   (id, buffer_post_id, processed_video_id, platform, collected_at,
                    impressions, likes, comments, shares, clicks, engagement_rate)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (stat_id, buffer_post_id, processed_video_id, platform, _now(),
                 impressions, likes, comments, shares, clicks, engagement_rate)
            )

    def list_stats(self, limit: int = 200) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM buffer_stats ORDER BY collected_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]
