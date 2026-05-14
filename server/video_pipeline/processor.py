import os
import logging
import subprocess
from typing import Optional
from .db import Database
from .subtitles import SubtitleGenerator, SUBTITLE_STYLES

logger = logging.getLogger(__name__)

LAYOUTS = ['marketing_top', 'marketing_bottom']
SUBTITLE_STYLE_NAMES = list(SUBTITLE_STYLES.keys())

TARGET_W = 1080
TARGET_H = 1920
HALF_H = TARGET_H // 2  # 960


class VideoProcessor:
    def __init__(self, storage_path: str, db_path: str):
        self.storage_path = storage_path
        self.processed_dir = os.path.join(storage_path, "processed")
        os.makedirs(self.processed_dir, exist_ok=True)
        self.db = Database(db_path)
        self.subtitle_gen = SubtitleGenerator(storage_path)

    def generate_variants(self, source_video_path: str, clip_id: str,
                           layouts: Optional[list] = None,
                           styles: Optional[list] = None,
                           ai_decision_id: Optional[str] = None) -> list[str]:
        """Generate layout x style combinations. Returns list of processed_video DB IDs."""
        clip = self.db.get_clip(clip_id)
        if not clip:
            raise ValueError(f"Clip {clip_id} not found")
        clip_path = clip['file_path']
        layouts = layouts or LAYOUTS
        styles = styles or SUBTITLE_STYLE_NAMES
        video_ids = []
        for layout in layouts:
            for style in styles:
                output_id = (
                    f"{os.path.splitext(os.path.basename(source_video_path))[0]}"
                    f"_{clip_id[:8]}_{layout}_{style}"
                )
                output_path = os.path.join(self.processed_dir, output_id + ".mp4")
                if not os.path.exists(output_path):
                    self._compose(source_video_path, clip_path, layout, style,
                                  output_path, output_id)
                vid_id = self.db.get_or_create_processed_video(
                    source_video_path=source_video_path,
                    clip_id=clip_id,
                    layout=layout,
                    subtitle_style=style,
                    file_path=output_path,
                    ai_decision_id=ai_decision_id
                )
                video_ids.append(vid_id)
        self.db.increment_clip_used(clip_id)
        logger.info(f"Generated {len(video_ids)} variants for {source_video_path}")
        return video_ids

    def _compose(self, marketing_path: str, clip_path: str, layout: str,
                  style: str, output_path: str, output_id: str):
        """Compose split-screen 1080x1920 video with subtitles burned in."""
        sub_file = self.subtitle_gen.generate_subtitle_file(
            marketing_path, style, output_id
        )
        marketing_filter = (
            f"scale={TARGET_W}:{HALF_H}:force_original_aspect_ratio=increase,"
            f"crop={TARGET_W}:{HALF_H}"
        )
        clip_filter = (
            f"scale={TARGET_W}:{HALF_H}:force_original_aspect_ratio=increase,"
            f"crop={TARGET_W}:{HALF_H}"
        )
        safe_sub = sub_file.replace("'", "'\\''")
        if layout == 'marketing_top':
            filter_complex = (
                f"[0:v]{marketing_filter}[top];"
                f"[1:v]{clip_filter}[bot];"
                f"[top][bot]vstack=inputs=2[stacked];"
                f"[stacked]subtitles='{safe_sub}'[v]"
            )
            inputs = [marketing_path, clip_path]
            audio_input_idx = 0  # marketing is inputs[0]
        else:
            filter_complex = (
                f"[0:v]{clip_filter}[top];"
                f"[1:v]{marketing_filter}[bot];"
                f"[top][bot]vstack=inputs=2[stacked];"
                f"[stacked]subtitles='{safe_sub}':force_style='MarginV=990'[v]"
            )
            inputs = [clip_path, marketing_path]
            audio_input_idx = 1  # marketing is inputs[1]

        preset = os.environ.get("FFMPEG_PRESET", "veryfast")
        crf = os.environ.get("FFMPEG_CRF", "26")
        cmd = [
            'ffmpeg', '-y',
            '-i', inputs[0],
            '-i', inputs[1],
            '-filter_complex', filter_complex,
            '-map', '[v]',
            '-map', f'{audio_input_idx}:a?',
            '-c:v', 'libx264',
            '-crf', crf,
            '-preset', preset,
            '-threads', '0',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            output_path
        ]
        timeout = int(os.environ.get("FFMPEG_TIMEOUT", "600"))
        logger.info(f"FFmpeg compositing: {layout} + {style} (timeout={timeout}s)")
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"FFmpeg timed out after {timeout}s for {output_path}")
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr[-1000:]}")
            raise RuntimeError(f"FFmpeg failed for {output_path}: {result.stderr[-300:]}")
        logger.info(f"Composed: {output_path}")
