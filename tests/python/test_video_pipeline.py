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

from server.video_pipeline.subtitles import SubtitleGenerator, SUBTITLE_STYLES

def test_subtitle_styles_defined():
    expected = {'bold_yellow', 'minimal_white', 'dark_band', 'outlined_color', 'word_pop'}
    assert set(SUBTITLE_STYLES.keys()) == expected

def test_srt_from_whisper_result():
    gen = SubtitleGenerator(storage_path="/tmp")
    whisper_result = {
        "segments": [
            {"start": 0.0, "end": 2.5, "text": "Hello world"},
            {"start": 2.5, "end": 5.0, "text": "This is a test"},
        ]
    }
    srt = gen._result_to_srt(whisper_result)
    assert "00:00:00,000 --> 00:00:02,500" in srt
    assert "Hello world" in srt
    assert "00:00:02,500 --> 00:00:05,000" in srt

def test_ass_header_generated():
    gen = SubtitleGenerator(storage_path="/tmp")
    header = gen._make_ass_header("bold_yellow")
    assert "[Script Info]" in header
    assert "[V4+ Styles]" in header

from server.video_pipeline.library_manager import LibraryManager
import os

def test_library_manager_init(tmp_path):
    db_path = str(tmp_path / "test.db")
    storage_path = str(tmp_path / "storage")
    lm = LibraryManager(db_path=db_path, storage_path=storage_path)
    assert os.path.isdir(storage_path + "/raw")
    assert os.path.isdir(storage_path + "/clips")

def test_get_least_used_clip(tmp_path):
    db_path = str(tmp_path / "test.db")
    storage_path = str(tmp_path / "storage")
    lm = LibraryManager(db_path=db_path, storage_path=storage_path)
    lm.db.create_clip("https://yt.com/a", "/clips/a.mp4", 10.0, "cooking")
    id2 = lm.db.create_clip("https://yt.com/b", "/clips/b.mp4", 12.0, "cooking")
    lm.db.increment_clip_used(id2)
    clip = lm.get_least_used_clip("cooking")
    assert clip is not None
    assert clip['id'] != id2

from server.video_pipeline.processor import VideoProcessor, LAYOUTS, SUBTITLE_STYLE_NAMES

def test_layouts_defined():
    assert 'marketing_top' in LAYOUTS
    assert 'marketing_bottom' in LAYOUTS

def test_subtitle_style_names():
    expected = {'bold_yellow', 'minimal_white', 'dark_band', 'outlined_color', 'word_pop'}
    assert set(SUBTITLE_STYLE_NAMES) == expected

def test_processor_init(tmp_path):
    proc = VideoProcessor(
        storage_path=str(tmp_path),
        db_path=str(tmp_path / "test.db")
    )
    assert os.path.isdir(str(tmp_path / "processed"))
