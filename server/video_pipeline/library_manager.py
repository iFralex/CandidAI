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

    @staticmethod
    def _compute_gaps(existing: list[tuple], req_start: float, req_end) -> list[tuple]:
        """
        Return sub-intervals of [req_start, req_end] not covered by existing.
        req_end=None means "to end of video". Returns list of (start, end) tuples.
        """
        INF = float('inf')
        req_end_n = INF if req_end is None else req_end

        if not existing:
            return [(req_start, req_end)]

        normalized = sorted((s, INF if e is None else e) for s, e in existing)

        # Merge overlapping intervals
        merged = [list(normalized[0])]
        for s, e in normalized[1:]:
            if s <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], e)
            else:
                merged.append([s, e])

        # Find gaps within [req_start, req_end_n]
        gaps = []
        cursor = req_start
        for s, e in merged:
            if e <= cursor:
                continue
            if s >= req_end_n:
                break
            if s > cursor:
                gap_end = min(s, req_end_n)
                gaps.append((cursor, None if gap_end == INF else gap_end))
            cursor = max(cursor, min(e, req_end_n))
        if cursor < req_end_n:
            gaps.append((cursor, req_end))

        return gaps

    def download_and_split(self, url: str, category: str,
                           start_time: float = None, end_time: float = None) -> list[str]:
        """Download a YouTube video, split by scenes, register clips in DB. Returns clip IDs."""
        video_id = self._extract_video_id(url)
        raw_dir = os.path.join(self.storage_path, "raw")
        clips_dir = os.path.join(self.storage_path, "clips")

        req_start = float(start_time) if start_time is not None else 0.0
        req_end   = float(end_time)   if end_time   is not None else None

        existing = self.db.get_ingested_intervals(video_id)
        gaps = self._compute_gaps(existing, req_start, req_end)

        if not gaps:
            logger.info(f"All requested intervals already ingested for {video_id}")
            return []

        video_path = self._download(url, raw_dir, video_id)

        all_clip_ids = []
        for gap_start, gap_end in gaps:
            e_tag = "end" if gap_end is None else int(gap_end)
            segment_id = f"{video_id}_s{int(gap_start)}e{e_tag}"

            clip_paths = self._split_into_clips(video_path, clips_dir, segment_id,
                                                gap_start, gap_end)
            for clip_path in clip_paths:
                duration = self._get_duration(clip_path)
                clip_id = self.db.create_clip(
                    source_url=url,
                    file_path=clip_path,
                    duration=duration,
                    category=category,
                )
                all_clip_ids.append(clip_id)

            self.db.add_ingested_interval(video_id, gap_start, gap_end)
            logger.info(f"Ingested [{gap_start}s, {gap_end}s] for {video_id}")

        logger.info(f"download_and_split: {len(all_clip_ids)} new clips from {url} (category={category})")
        return all_clip_ids

    def merge_clips_for_duration(self, clip_ids: list[str], min_duration: float,
                                  category: str) -> list[str]:
        """
        Group consecutive clips so each group totals >= min_duration.
        Groups with >1 clip are merged via ffmpeg concat; constituent clips are marked used.
        Returns a list of clip IDs ready for compositing.
        """
        clips_data = [(cid, self.db.get_clip(cid)) for cid in clip_ids]
        clips_data = [(cid, c) for cid, c in clips_data if c]

        result_ids = []
        i = 0
        while i < len(clips_data):
            group_ids = [clips_data[i][0]]
            group_clips = [clips_data[i][1]]
            total = clips_data[i][1]['duration']

            while total < min_duration and i + len(group_ids) < len(clips_data):
                next_idx = i + len(group_ids)
                group_ids.append(clips_data[next_idx][0])
                group_clips.append(clips_data[next_idx][1])
                total += clips_data[next_idx][1]['duration']

            if len(group_ids) == 1:
                result_ids.append(group_ids[0])
            else:
                merged_path = self._concat_clips([c['file_path'] for c in group_clips])
                duration = self._get_duration(merged_path)
                merged_id = self.db.create_clip(
                    source_url=group_clips[0]['source_url'],
                    file_path=merged_path,
                    duration=duration,
                    category=category,
                )
                for cid in group_ids:
                    self.db.increment_clip_used(cid)
                logger.info(
                    f"Merged {len(group_ids)} clips ({total:.1f}s >= {min_duration:.1f}s) → {merged_id}"
                )
                result_ids.append(merged_id)

            i += len(group_ids)

        return result_ids

    def _concat_clips(self, paths: list[str]) -> str:
        """Concatenate video files using ffmpeg concat demuxer. Returns merged file path."""
        merged_dir = os.path.join(self.storage_path, "clips")
        name_hash = hashlib.md5("|".join(paths).encode()).hexdigest()[:12]
        output_path = os.path.join(merged_dir, f"merged_{name_hash}.mp4")
        if os.path.exists(output_path):
            return output_path
        list_path = output_path + ".txt"
        with open(list_path, "w") as f:
            for p in paths:
                f.write(f"file '{p}'\n")
        result = subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
             "-i", list_path, "-c", "copy", output_path],
            capture_output=True, text=True,
        )
        os.remove(list_path)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg concat failed: {result.stderr[-300:]}")
        logger.info(f"Concatenated {len(paths)} clips → {output_path}")
        return output_path

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

        out_dir = os.path.dirname(output_path)
        video_id = os.path.basename(output_path).replace(".mp4", "")
        tmp_video = video_stream.download(output_path=out_dir, filename=f"{video_id}_v.tmp")
        if audio_stream:
            tmp_audio = audio_stream.download(output_path=out_dir, filename=f"{video_id}_a.tmp")
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_video, "-i", tmp_audio,
                 "-c:v", "copy", "-c:a", "aac", "-strict", "experimental", output_path],
                capture_output=True,
            )
            os.remove(tmp_video)
            os.remove(tmp_audio)
            if result.returncode != 0:
                logger.error(f"ffmpeg merge failed: {result.stderr.decode(errors='replace')}")
                raise RuntimeError(f"ffmpeg exited with code {result.returncode}")
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

    def _split_into_clips(self, video_path: str, clips_dir: str, video_id: str,
                           start_time: float = None, end_time: float = None) -> list[str]:
        existing = sorted(glob.glob(os.path.join(clips_dir, f"{video_id}_*.mp4")))
        if existing:
            logger.info(f"Clips already exist for {video_id}: {len(existing)} files")
            return existing

        # lazy — heavy deps, only needed at runtime on VPS
        from scenedetect import open_video, SceneManager, ContentDetector
        from scenedetect.video_splitter import split_video_ffmpeg

        max_clip_sec = int(os.environ.get("MAX_CLIP_DURATION", "30"))

        video = open_video(video_path)
        fps = video.frame_rate
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=15.0))
        scene_manager.detect_scenes(video, start_time=start_time, end_time=end_time)
        scene_list = scene_manager.get_scene_list()
        logger.info(f"scenedetect found {len(scene_list)} scenes in {video_path}")

        # Split scenes exceeding max_clip_sec into fixed-length sub-clips
        final_scenes = []
        for start, end in scene_list:
            dur = (end - start).get_seconds()
            if dur <= max_clip_sec:
                final_scenes.append((start, end))
            else:
                from scenedetect import FrameTimecode
                cur = start
                while cur < end:
                    next_tc = FrameTimecode(int(cur.get_frames() + fps * max_clip_sec), fps)
                    final_scenes.append((cur, min(next_tc, end)))
                    cur = min(next_tc, end)

        if not final_scenes:
            # No scenes detected — split by max_clip_sec within the requested range
            total = self._get_duration(video_path)
            range_start = int(start_time or 0)
            range_end = int(end_time or total)
            clips = []
            for i, offset in enumerate(range(range_start, range_end, max_clip_sec), start=1):
                clip_path = os.path.join(clips_dir, f"{video_id}_{i:03d}.mp4")
                subprocess.run(
                    ["ffmpeg", "-y", "-ss", str(offset), "-i", video_path,
                     "-t", str(max_clip_sec), "-c", "copy", clip_path],
                    capture_output=True, check=True,
                )
                clips.append(clip_path)
            logger.info(f"No scenes found, split by time into {len(clips)} clips")
            return clips

        output_tmpl = os.path.join(clips_dir, f"{video_id}_$SCENE_NUMBER.mp4")
        split_video_ffmpeg(
            video_path, final_scenes,
            output_file_template=output_tmpl,
            show_progress=False,
        )
        clips = sorted(glob.glob(os.path.join(clips_dir, f"{video_id}_*.mp4")))
        logger.info(f"Split into {len(clips)} clips (max {max_clip_sec}s each)")
        return clips

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
