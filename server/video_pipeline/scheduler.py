"""
Video pipeline scheduler — run as standalone process on VPS:
    python -m server.video_pipeline.scheduler
"""
import os
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.blocking import BlockingScheduler
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
    url = f"http://{ip}:{_FLASK_PORT}"
    logger.info(f"Public base URL: {url}")
    return url
VIDEO_STORAGE_PATH = os.environ.get(
    "VIDEO_STORAGE_PATH",
    os.path.join(os.path.dirname(__file__), '..', '..', 'video_library')
)
DB_PATH = os.path.join(VIDEO_STORAGE_PATH, "pipeline.db")

QUEUE_MAX = 10
# 9 AM, 12 PM, 7 PM Eastern Time (handles DST automatically via zoneinfo)
POST_TIMES_ET = ["09:00", "12:00", "19:00"]

# Fallback captions used if AI generation fails
_FALLBACK_CAPTIONS = {
    "tiktok": [
        "Stop writing cover letters from scratch. CandidAI does it for you in seconds.\n\nLink in bio 👆\n\n#JobSearch #AI #CareerTips #JobHunting",
        "Your application is why you're not getting callbacks. CandidAI fixes that.\n\nLink in bio 👆\n\n#JobHunting #AI #CareerAdvice #GetHired",
        "What if applying to 10 jobs took less time than writing one cover letter?\n\nLink in bio 👆\n\n#JobSearch #AI #Productivity #CareerTips",
    ],
    "instagram": [
        "Job hunting shouldn't feel like a second job. CandidAI writes personalized applications for every role you apply to — instantly.\n\nLink in bio 👆\n\n#JobSearch #AI #CareerTips #CoverLetter #GetHired",
        "The average cover letter takes 3 hours to write. With CandidAI, it takes seconds. Tailored to every job, every time.\n\nLink in bio 👆\n\n#JobHunting #AITools #CareerAdvice #Productivity",
        "Generic applications get ignored. CandidAI makes sure yours stands out — personalized, AI-written, every time.\n\nLink in bio 👆\n\n#JobSearch #AI #CoverLetter #CareerGrowth",
    ],
}


def _get_next_slots(count: int) -> list[str]:
    """Return the next `count` publish slots at 09:00, 12:00, 19:00 ET, starting tomorrow."""
    slots = []
    day = datetime.now(_ET).date() + timedelta(days=1)
    while len(slots) < count:
        for time_str in POST_TIMES_ET:
            h, m = map(int, time_str.split(":"))
            dt = datetime(day.year, day.month, day.day, h, m, 0, tzinfo=_ET)
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
    for platform, channel_id in channels:
        if not channel_id:
            logger.warning(f"fill_buffer_queue: no channel ID set for {platform}, skipping")
            continue
        # Re-fetch each iteration so videos published for the previous platform
        # are excluded (their status is now 'published', not 'approved')
        approved = db.list_approved_videos()
        if not approved:
            logger.info(f"fill_buffer_queue: no approved videos remaining, stopping")
            break

        try:
            current_count = buffer.get_scheduled_count(channel_id)
        except Exception as e:
            logger.error(f"fill_buffer_queue: could not fetch Buffer queue for {platform}: {e}")
            continue

        slots_needed = max(0, QUEUE_MAX - current_count)
        if slots_needed == 0:
            logger.info(f"fill_buffer_queue: {platform} queue full ({QUEUE_MAX}), skipping")
            continue

        videos_to_add = approved[:slots_needed]

        if not videos_to_add:
            logger.info(f"fill_buffer_queue: no videos available for {platform}")
            continue

        base_url = _build_base_url()
        slots = _get_next_slots(len(videos_to_add))
        for video, slot in zip(videos_to_add, slots):
            video_url = f"{base_url}/videos/{video['id']}"
            caption = _build_caption(platform, video['id'])
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


def _build_caption(platform: str, video_id: str = "") -> str:
    """Generate a unique AI-written caption for the post. Falls back to a hardcoded pool."""
    char_guide = (
        "max 150 characters of main text" if platform == "tiktok"
        else "2-3 short punchy sentences"
    )
    prompt = (
        f"Write a {platform} caption for a short-form video promoting CandidAI.\n\n"
        f"CandidAI is an AI tool that writes personalized job applications "
        f"(cover letters and emails) for job seekers in seconds. "
        f"The link is in the bio (candidai.tech) — do NOT put the URL in the caption.\n\n"
        f"Requirements:\n"
        f"- Main text: {char_guide}\n"
        f"- End with 5-7 relevant hashtags on a new line\n"
        f"- Include a 'link in bio 👆' call to action\n"
        f"- Focus on: time-saving, AI, standing out to recruiters, job search pain\n"
        f"- Tone: authentic and human, not corporate\n"
        f"- Use a completely different angle and opening line every time\n\n"
        f"Return ONLY the caption text, no explanation."
    )
    try:
        from server.emails_generation.blog_posts import ai_chat
        result = ai_chat(prompt, format="str")
        if result and isinstance(result, str) and len(result) > 20:
            logger.info(f"AI caption generated for {platform} ({video_id[:8]})")
            return result
    except Exception as e:
        logger.warning(f"AI caption generation failed ({e}), using fallback")
    # Deterministic fallback: different caption per video_id
    pool = _FALLBACK_CAPTIONS.get(platform, _FALLBACK_CAPTIONS["instagram"])
    idx = int(hashlib.md5(video_id.encode()).hexdigest(), 16) % len(pool)
    return pool[idx]


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
