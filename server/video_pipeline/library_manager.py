import os
import logging
from typing import Optional
from server.video_pipeline.db import Database

logger = logging.getLogger(__name__)


class LibraryManager:
    def __init__(self, db_path: str, storage_path: str):
        self.storage_path = storage_path
        self.db = Database(db_path)
        os.makedirs(os.path.join(storage_path, "raw"), exist_ok=True)
        os.makedirs(os.path.join(storage_path, "clips"), exist_ok=True)

    def get_least_used_clip(self, category: str) -> Optional[dict]:
        """Return the clip with the lowest used_count for the given category."""
        clips = self.db.list_clips_by_category(category)
        return clips[0] if clips else None
