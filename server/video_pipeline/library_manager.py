import os
import re
import glob
import json
import hashlib
import logging
import subprocess
from typing import Optional
from server.video_pipeline.db import Database

logger = logging.getLogger(__name__)


class LibraryManager:
    def __init__(self, db_path: str, storage_path: str):
        self.storage_path = storage_path
        self.db = Database(db_path)
        os.makedirs(os.path.join(storage_path, "raw"), exist_ok=True)
        os.makedirs(os.path.join(storage_path, "clips"), exist_ok=True)

    def download_and_split(self, url: str, category: str) -> list[str]:
        """Download a YouTube video, split by scenes, register clips in DB. Returns clip IDs."""
        video_id = self._extract_video_id(url)
        raw_dir = os.path.join(self.storage_path, "raw")
        clips_dir = os.path.join(self.storage_path, "clips")

        video_path = self._download(url, raw_dir, video_id)
        clip_paths = self._split_into_clips(video_path, clips_dir, video_id)

        clip_ids = []
        for clip_path in clip_paths:
            duration = self._get_duration(clip_path)
            clip_id = self.db.create_clip(
                source_url=url,
                file_path=clip_path,
                duration=duration,
                category=category,
            )
            clip_ids.append(clip_id)

        logger.info(f"download_and_split: {len(clip_ids)} clips from {url} (category={category})")
        return clip_ids

    def get_least_used_clip(self, category: str) -> Optional[dict]:
        """Return the clip with the lowest used_count for the given category."""
        clips = self.db.list_clips_by_category(category)
        return clips[0] if clips else None

    def _download(self, url: str, raw_dir: str, video_id: str) -> str:
        for ext in ("mp4", "webm", "mkv"):
            existing = os.path.join(raw_dir, f"{video_id}.{ext}")
            if os.path.exists(existing):
                logger.info(f"Already downloaded: {existing}")
                return existing

        import yt_dlp  # lazy — heavy dep, only needed at runtime on VPS
        output_tmpl = os.path.join(raw_dir, f"{video_id}.%(ext)s")
        ydl_opts = {
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "outtmpl": output_tmpl,
            "quiet": True,
            "no_warnings": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        for ext in ("mp4", "webm", "mkv"):
            path = os.path.join(raw_dir, f"{video_id}.{ext}")
            if os.path.exists(path):
                return path
        raise RuntimeError(f"Download finished but output file not found for video_id={video_id}")

    def _split_into_clips(self, video_path: str, clips_dir: str, video_id: str) -> list[str]:
        existing = sorted(glob.glob(os.path.join(clips_dir, f"{video_id}_*.mp4")))
        if existing:
            logger.info(f"Clips already exist for {video_id}: {len(existing)} files")
            return existing

        # lazy — heavy deps, only needed at runtime on VPS
        from scenedetect import open_video, SceneManager, ContentDetector
        from scenedetect.video_splitter import split_video_ffmpeg

        video = open_video(video_path)
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=27.0))
        scene_manager.detect_scenes(video)
        scene_list = scene_manager.get_scene_list()

        if not scene_list:
            clip_path = os.path.join(clips_dir, f"{video_id}_001.mp4")
            subprocess.run(
                ["ffmpeg", "-y", "-i", video_path, "-c", "copy", clip_path],
                capture_output=True,
                check=True,
            )
            return [clip_path]

        output_tmpl = os.path.join(clips_dir, f"{video_id}_$SCENE_NUMBER.mp4")
        split_video_ffmpeg(
            video_path, scene_list,
            output_file_template=output_tmpl,
            show_progress=False,
        )
        return sorted(glob.glob(os.path.join(clips_dir, f"{video_id}_*.mp4")))

    def _extract_video_id(self, url: str) -> str:
        patterns = [
            r"(?:v=|/v/|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})",
            r"^([A-Za-z0-9_-]{11})$",
        ]
        for pattern in patterns:
            m = re.search(pattern, url)
            if m:
                return m.group(1)
        return hashlib.md5(url.encode()).hexdigest()[:11]

    def _get_duration(self, file_path: str) -> float:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", file_path],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            return 0.0
        data = json.loads(result.stdout)
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                return float(stream.get("duration", 0))
        return 0.0
