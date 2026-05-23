"""
Video pipeline scheduler — run as standalone process on VPS:
    python -m server.video_pipeline.scheduler
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

try:
    from zoneinfo import ZoneInfo
    _ET = ZoneInfo("America/New_York")
except Exception:
    _ET = timezone(timedelta(hours=-5))  # EST fallback

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
_FLASK_PORT = os.environ.get("PORT", "5000")
_VIDEO_SERVER_PORT = os.environ.get("VIDEO_SERVER_PORT", "8000")


def _get_public_ip() -> str:
    """Return the machine's public IPv4 address, trying multiple lookup services."""
    import urllib.request
    for url in (
        "https://api4.my-ip.io/ip",
        "https://ipv4.icanhazip.com",
        "https://api.ipify.org",
    ):
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                ip = resp.read().decode().strip()
                if ip:
                    return ip
        except Exception:
            continue
    raise RuntimeError("Could not determine public IPv4 address")


def _build_base_url() -> str:
    ip = _get_public_ip()
    url = f"http://{ip}:{_VIDEO_SERVER_PORT}"
    logger.info(f"Video base URL: {url}")
    return url
VIDEO_STORAGE_PATH = os.environ.get(
    "VIDEO_STORAGE_PATH",
    os.path.join(os.path.dirname(__file__), '..', '..', 'video_library')
)
DB_PATH = os.path.join(VIDEO_STORAGE_PATH, "pipeline.db")

QUEUE_MAX = 10
# 9 AM, 12 PM, 7 PM Eastern Time (handles DST automatically via zoneinfo)
POST_TIMES_ET = ["09:00", "12:00", "19:00"]

_FALLBACK_CAPTION = "Link in bio 👆\n\n#JobSearch #AI #CareerTips #CandidAI #GetHired"


def _get_next_slots(count: int, taken: set[str] = None) -> list[str]:
    """Return the next `count` free publish slots at 09:00, 12:00, 19:00 ET.

    Starts from the next future slot (today included if still in the future)
    and skips any slot whose YYYY-MM-DDTHH:MM prefix appears in `taken`.
    """
    taken = taken or set()
    slots = []
    now = datetime.now(_ET)
    day = now.date()
    while len(slots) < count:
        for time_str in POST_TIMES_ET:
            h, m = map(int, time_str.split(":"))
            dt = datetime(day.year, day.month, day.day, h, m, 0, tzinfo=_ET)
            if dt <= now:
                continue
            key = dt.isoformat()[:16]
            if key in taken:
                continue
            slots.append(dt.isoformat())
            taken.add(key)  # mark as claimed so duplicates within the same run are avoided
            if len(slots) >= count:
                break
        day += timedelta(days=1)
    return slots


def fill_buffer_queue():
    """Daily job: publish each approved video to ALL configured platforms at the same slot."""
    from .buffer_client import BufferClient
    from .db import Database

    logger.info("fill_buffer_queue: starting")
    db = Database(DB_PATH)
    buffer = BufferClient(BUFFER_API_KEY)

    # Probe each platform: skip unconfigured or unreachable ones
    active = []
    taken_slots: set[str] = set()
    for platform, channel_id in [("tiktok", BUFFER_TIKTOK_CHANNEL_ID),
                                  ("instagram", BUFFER_INSTAGRAM_CHANNEL_ID)]:
        if not channel_id:
            logger.warning(f"fill_buffer_queue: no channel ID for {platform}, skipping")
            continue
        try:
            count = buffer.get_scheduled_count(channel_id)
            free = max(0, QUEUE_MAX - count)
            logger.info(f"fill_buffer_queue: {platform} {count}/{QUEUE_MAX} scheduled, {free} free")
            if free > 0:
                active.append((platform, channel_id, free))
                taken_slots |= buffer.get_scheduled_slots(channel_id)
        except Exception as e:
            logger.error(f"fill_buffer_queue: could not fetch {platform} queue: {e}")

    if not active:
        logger.info("fill_buffer_queue: all queues full or unavailable")
        return

    # Publish as many videos as the most-constrained platform allows
    slots_available = min(free for _, _, free in active)
    approved = db.list_approved_videos()
    if not approved:
        logger.info("fill_buffer_queue: no approved videos")
        return

    videos_to_add = approved[:slots_available]
    base_url = _build_base_url()
    slots = _get_next_slots(len(videos_to_add), taken=taken_slots)

    for video, slot in zip(videos_to_add, slots):
        video_url = f"{base_url}/videos/{video['id']}"
        cap = db.get_next_caption()
        caption = cap['text'] if cap else _FALLBACK_CAPTION
        if cap:
            db.mark_caption_used(cap['id'])

        published = []
        primary_post_id = None
        for platform, channel_id, _ in active:
            try:
                post_id = buffer.create_post(channel_id, video_url, caption, slot, service=platform)
                published.append(platform)
                if primary_post_id is None:
                    primary_post_id = post_id
                logger.info(f"fill_buffer_queue: scheduled {video['id']} on {platform} at {slot}")
            except Exception as e:
                logger.error(f"fill_buffer_queue: failed {video['id']} on {platform}: {e}")

        if published:
            db.mark_published(
                video['id'],
                buffer_post_id=primary_post_id,
                scheduled_for=slot,
                platform="+".join(published),
            )

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


def start_background_scheduler() -> BackgroundScheduler:
    """Start the scheduler as a non-blocking background thread (for embedding in Flask/gunicorn)."""
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(fill_buffer_queue, 'cron', hour=8, minute=0,
                      id='fill_queue', replace_existing=True)
    scheduler.add_job(collect_buffer_stats, 'interval', days=30,
                      id='collect_stats', replace_existing=True)
    scheduler.start()
    logger.info("Video pipeline scheduler started (background). Daily fill at 08:00 UTC, stats every 30 days.")
    return scheduler


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
