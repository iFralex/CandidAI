import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

SESSIONS_DIR = "sessions"
VALID_PROVIDERS = ("gmail", "outlook", "yahoo")


def session_path(user_id: str, provider: str) -> str:
    return os.path.join(SESSIONS_DIR, user_id, provider, "session.json")


def save(user_id: str, provider: str, cookies: list, fingerprint: dict) -> None:
    path = session_path(user_id, provider)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump({
            "cookies": cookies,
            "fingerprint": fingerprint,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }, f)
    logger.info(f"Sessione salvata: user={user_id} provider={provider}")


def load(user_id: str, provider: str) -> dict:
    path = session_path(user_id, provider)
    with open(path) as f:
        return json.load(f)


def exists(user_id: str, provider: str) -> bool:
    return os.path.exists(session_path(user_id, provider))
