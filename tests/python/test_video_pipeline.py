import pytest
import os
import tempfile
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../'))

from server.video_pipeline.db import Database

@pytest.fixture
def db():
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    d = Database(db_path)
    yield d
    os.unlink(db_path)

def test_create_clip(db):
    clip_id = db.create_clip(
        source_url="https://youtube.com/watch?v=abc",
        file_path="/clips/abc_001.mp4",
        duration=12.5,
        category="cooking"
    )
    assert clip_id is not None
    clip = db.get_clip(clip_id)
    assert clip['category'] == 'cooking'
    assert clip['used_count'] == 0

def test_create_processed_video(db):
    clip_id = db.create_clip("https://yt.com/x", "/clips/x.mp4", 10.0, "gaming")
    vid_id = db.create_processed_video(
        source_video_path="/marketing/vertical.mp4",
        clip_id=clip_id,
        layout="marketing_top",
        subtitle_style="bold_yellow",
        file_path="/processed/v1.mp4"
    )
    assert vid_id is not None
    vid = db.get_processed_video(vid_id)
    assert vid['status'] == 'pending'

def test_approve_video(db):
    clip_id = db.create_clip("https://yt.com/y", "/clips/y.mp4", 8.0, "painting")
    vid_id = db.create_processed_video("/marketing/h.mp4", clip_id, "marketing_bottom", "minimal_white", "/processed/v2.mp4")
    db.approve_video(vid_id)
    vid = db.get_processed_video(vid_id)
    assert vid['status'] == 'approved'

def test_list_approved_videos(db):
    clip_id = db.create_clip("https://yt.com/z", "/clips/z.mp4", 9.0, "cooking")
    vid_id = db.create_processed_video("/marketing/h.mp4", clip_id, "marketing_top", "dark_band", "/processed/v3.mp4")
    db.approve_video(vid_id)
    approved = db.list_approved_videos()
    assert any(v['id'] == vid_id for v in approved)

def test_mark_published(db):
    clip_id = db.create_clip("https://yt.com/w", "/clips/w.mp4", 7.0, "gaming")
    vid_id = db.create_processed_video("/marketing/h.mp4", clip_id, "marketing_top", "word_pop", "/processed/v4.mp4")
    db.approve_video(vid_id)
    db.mark_published(vid_id, buffer_post_id="bp_123", scheduled_for="2026-05-13T13:30:00Z", platform="tiktok")
    vid = db.get_processed_video(vid_id)
    assert vid['status'] == 'published'
    assert vid['buffer_post_id'] == 'bp_123'

def test_save_and_list_stats(db):
    db.save_buffer_stats(
        buffer_post_id="bp_456",
        processed_video_id=None,
        platform="instagram",
        impressions=1200,
        likes=80,
        comments=5,
        shares=12,
        clicks=30,
        engagement_rate=7.5
    )
    stats = db.list_stats()
    assert len(stats) >= 1
    assert stats[0]['impressions'] == 1200
