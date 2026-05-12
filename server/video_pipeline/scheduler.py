"""
Video pipeline scheduler — run as standalone process on VPS:
    python -m server.video_pipeline.scheduler
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

load_dotenv()

# Set up logging to both console and file (file path used by log viewer dashboard)
_LOG_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'logs', 'video-pipeline')
os.makedirs(_LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(_LOG_DIR, 'pipeline.log'), encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

BUFFER_API_KEY = os.environ.get("BUFFER_API_KEY", "")
BUFFER_TIKTOK_CHANNEL_ID = os.environ.get("BUFFER_TIKTOK_CHANNEL_ID", "")
BUFFER_INSTAGRAM_CHANNEL_ID = os.environ.get("BUFFER_INSTAGRAM_CHANNEL_ID", "")
VPS_PUBLIC_URL = os.environ.get("VPS_PUBLIC_URL", "http://localhost:5000").rstrip("/")
VIDEO_STORAGE_PATH = os.environ.get(
    "VIDEO_STORAGE_PATH",
    os.path.join(os.path.dirname(__file__), '..', '..', 'video_library')
)
DB_PATH = os.path.join(VIDEO_STORAGE_PATH, "pipeline.db")

QUEUE_MAX = 10
POST_TIMES = ["13:30", "18:00"]


def _get_next_slots(count: int) -> list[str]:
    """Return the next `count` publish slots at 13:30 and 18:00 UTC, starting tomorrow."""
    slots = []
    day = datetime.now(timezone.utc).date() + timedelta(days=1)
    while len(slots) < count:
        for time_str in POST_TIMES:
            h, m = map(int, time_str.split(":"))
            dt = datetime(day.year, day.month, day.day, h, m, 0, tzinfo=timezone.utc)
            slots.append(dt.isoformat())
            if len(slots) >= count:
                break
        day += timedelta(days=1)
    return slots


def fill_buffer_queue():
    """Daily job: top up Buffer queue to QUEUE_MAX with approved videos."""
    from .buffer_client import BufferClient
    from .db import Database

    logger.info("fill_buffer_queue: starting")
    db = Database(DB_PATH)
    buffer = BufferClient(BUFFER_API_KEY)
    channels = [
        ("tiktok", BUFFER_TIKTOK_CHANNEL_ID),
        ("instagram", BUFFER_INSTAGRAM_CHANNEL_ID),
    ]
    approved = db.list_approved_videos()
    if not approved:
        logger.info("fill_buffer_queue: no approved videos available")
        return

    for platform, channel_id in channels:
        if not channel_id:
            logger.warning(f"fill_buffer_queue: no channel ID set for {platform}, skipping")
            continue
        try:
            current_count = buffer.get_scheduled_count(channel_id)
        except Exception as e:
            logger.error(f"fill_buffer_queue: could not fetch Buffer queue for {platform}: {e}")
            continue

        slots_needed = max(0, QUEUE_MAX - current_count)
        if slots_needed == 0:
            logger.info(f"fill_buffer_queue: {platform} queue full ({QUEUE_MAX}), skipping")
            continue

        # Pick approved videos not yet scheduled for this platform
        videos_to_add = [
            v for v in approved
            if v.get("platform") != platform
        ][:slots_needed]

        if not videos_to_add:
            logger.info(f"fill_buffer_queue: no videos available for {platform}")
            continue

        slots = _get_next_slots(len(videos_to_add))
        for video, slot in zip(videos_to_add, slots):
            video_url = f"{VPS_PUBLIC_URL}/videos/{video['id']}"
            caption = _build_caption(platform)
            try:
                post_id = buffer.create_post(channel_id, video_url, caption, slot)
                db.mark_published(
                    video['id'],
                    buffer_post_id=post_id,
                    scheduled_for=slot,
                    platform=platform
                )
                logger.info(f"fill_buffer_queue: scheduled {video['id']} on {platform} at {slot}")
            except Exception as e:
                logger.error(f"fill_buffer_queue: failed to schedule {video['id']} on {platform}: {e}")

    logger.info("fill_buffer_queue: complete")


def collect_buffer_stats():
    """30-day job: pull Buffer post analytics and save to SQLite."""
    from .buffer_client import BufferClient
    from .db import Database

    logger.info("collect_buffer_stats: starting")
    db = Database(DB_PATH)
    buffer = BufferClient(BUFFER_API_KEY)
    channels = [
        ("tiktok", BUFFER_TIKTOK_CHANNEL_ID),
        ("instagram", BUFFER_INSTAGRAM_CHANNEL_ID),
    ]
    total_saved = 0
    published = db.list_recent_published(limit=500)

    for platform, channel_id in channels:
        if not channel_id:
            continue
        try:
            posts = buffer.get_published_posts(channel_id)
        except Exception as e:
            logger.error(f"collect_buffer_stats: could not fetch stats for {platform}: {e}")
            continue

        for post in posts:
            vid_id = next(
                (v["id"] for v in published if v.get("buffer_post_id") == post["id"]),
                None
            )
            db.save_buffer_stats(
                buffer_post_id=post["id"],
                processed_video_id=vid_id,
                platform=platform,
                impressions=post["impressions"],
                likes=post["likes"],
                comments=post["comments"],
                shares=post["shares"],
                clicks=post["clicks"],
                engagement_rate=post["engagement_rate"]
            )
            total_saved += 1

    logger.info(f"collect_buffer_stats: saved {total_saved} stat records")


def _build_caption(platform: str) -> str:
    tags = "#CandidAI #JobSearch #AITools #CareerTips #JobHunting"
    if platform == "tiktok":
        return f"Let AI write your job applications\n\n{tags}"
    return f"Stop wasting hours on job applications. Let CandidAI do it for you.\n\n{tags}"


def main():
    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(fill_buffer_queue, 'cron', hour=8, minute=0,
                       id='fill_queue', replace_existing=True)
    scheduler.add_job(collect_buffer_stats, 'interval', days=30,
                       id='collect_stats', replace_existing=True)
    logger.info("Video pipeline scheduler started. Daily fill at 08:00 UTC, stats every 30 days.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
