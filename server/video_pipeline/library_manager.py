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

        output_path = os.path.join(raw_dir, f"{video_id}.mp4")

        # 1. pytubefix with OAuth (primary — works from VPS IPs)
        try:
            self._download_via_pytubefix(url, output_path)
            logger.info(f"Downloaded via pytubefix: {output_path}")
            return output_path
        except Exception as e:
            logger.warning(f"pytubefix failed ({e}), trying Invidious")

        # 2. Invidious (no auth needed, depends on public instances)
        try:
            self._download_via_invidious(url, output_path)
            logger.info(f"Downloaded via Invidious: {output_path}")
            return output_path
        except Exception as e:
            logger.warning(f"Invidious failed ({e}), falling back to yt-dlp")

        # 3. yt-dlp (last resort)
        import yt_dlp
        output_tmpl = os.path.join(raw_dir, f"{video_id}.%(ext)s")
        ydl_opts = {
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "outtmpl": output_tmpl,
            "quiet": True,
            "no_warnings": True,
        }
        cookies_file = os.environ.get("YTDLP_COOKIES_FILE", "")
        if cookies_file and os.path.exists(cookies_file):
            ydl_opts["cookiefile"] = cookies_file
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        for ext in ("mp4", "webm", "mkv"):
            path = os.path.join(raw_dir, f"{video_id}.{ext}")
            if os.path.exists(path):
                return path
        raise RuntimeError(f"Download failed for video_id={video_id}")

    def _download_via_pytubefix(self, url: str, output_path: str) -> None:
        from pytubefix import YouTube
        from pytubefix.cli import on_progress

        yt = YouTube(url, use_oauth=True, allow_oauth_cache=True, on_progress_callback=on_progress)

        # Download best video-only and audio-only streams, merge with ffmpeg
        video_stream = (
            yt.streams.filter(adaptive=True, file_extension="mp4", only_video=True)
            .order_by("resolution").last()
        )
        audio_stream = (
            yt.streams.filter(adaptive=True, file_extension="mp4", only_audio=True)
            .order_by("abr").last()
        )
        if not video_stream:
            raise RuntimeError("pytubefix: no video stream found")

        tmp_video = output_path + ".vtmp"
        tmp_audio = output_path + ".atmp"
        video_stream.download(filename=tmp_video)
        if audio_stream:
            audio_stream.download(filename=tmp_audio)
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_video, "-i", tmp_audio, "-c", "copy", output_path],
                capture_output=True, check=True,
            )
            os.remove(tmp_video)
            os.remove(tmp_audio)
        else:
            os.rename(tmp_video, output_path)

    _INVIDIOUS_FALLBACK = [
        "https://yewtu.be",
        "https://invidious.kavin.rocks",
        "https://inv.tux.pizza",
        "https://yt.artemislena.eu",
        "https://invidious.flokinet.to",
    ]

    @staticmethod
    def _get_invidious_instances() -> list[str]:
        import requests as _req
        try:
            r = _req.get("https://api.invidious.io/instances.json", timeout=10)
            r.raise_for_status()
            instances = [
                f"https://{item[0]}"
                for item in r.json()
                if item[1].get("api") and item[1].get("type") == "https"
                and item[1].get("monitor", {}).get("uptime", 0) > 80
            ]
            return instances[:8] if instances else []
        except Exception:
            return []

    def _download_via_invidious(self, url: str, output_path: str) -> None:
        import requests as _req
        video_id = self._extract_video_id(url)
        instances = self._get_invidious_instances() or self._INVIDIOUS_FALLBACK
        last_err = None
        for instance in instances:
            try:
                r = _req.get(f"{instance}/api/v1/videos/{video_id}", timeout=15)
                r.raise_for_status()
                data = r.json()

                adaptive = data.get("adaptiveFormats", [])
                videos = sorted(
                    [f for f in adaptive if "video/mp4" in f.get("type", "")],
                    key=lambda x: x.get("bitrate", 0), reverse=True,
                )
                audios = sorted(
                    [f for f in adaptive if "audio/mp4" in f.get("type", "")],
                    key=lambda x: x.get("bitrate", 0), reverse=True,
                )
                if not videos:
                    raise RuntimeError("no mp4 video streams found")

                tmp_video = output_path + ".vtmp"
                tmp_audio = output_path + ".atmp"
                self._stream_to_file(videos[0]["url"], tmp_video)
                if audios:
                    self._stream_to_file(audios[0]["url"], tmp_audio)
                    subprocess.run(
                        ["ffmpeg", "-y", "-i", tmp_video, "-i", tmp_audio, "-c", "copy", output_path],
                        capture_output=True, check=True,
                    )
                    os.remove(tmp_video)
                    os.remove(tmp_audio)
                else:
                    os.rename(tmp_video, output_path)
                return
            except Exception as e:
                last_err = e
                logger.warning(f"Invidious instance {instance} failed: {e}")
        raise RuntimeError(f"All Invidious instances failed: {last_err}")

    @staticmethod
    def _stream_to_file(url: str, path: str) -> None:
        import requests as _req
        with _req.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            with open(path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    f.write(chunk)

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
