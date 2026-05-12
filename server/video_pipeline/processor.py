import os
import logging
from server.video_pipeline.db import Database
from server.video_pipeline.subtitles import SUBTITLE_STYLES

logger = logging.getLogger(__name__)

LAYOUTS = {
    "marketing_top": {
        "description": "Marketing video occupies top half, clip on bottom",
        "marketing_crop": {"x": 0, "y": 0, "w": 1080, "h": 960},
        "clip_crop": {"x": 0, "y": 960, "w": 1080, "h": 960},
    },
    "marketing_bottom": {
        "description": "Marketing video occupies bottom half, clip on top",
        "marketing_crop": {"x": 0, "y": 960, "w": 1080, "h": 960},
        "clip_crop": {"x": 0, "y": 0, "w": 1080, "h": 960},
    },
}

SUBTITLE_STYLE_NAMES = list(SUBTITLE_STYLES.keys())


class VideoProcessor:
    def __init__(self, storage_path: str, db_path: str):
        self.storage_path = storage_path
        self.db = Database(db_path)
        os.makedirs(os.path.join(storage_path, "processed"), exist_ok=True)
