import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

SESSIONS_DIR = "sessions"
VALID_PROVIDERS = ("gmail", "outlook", "yahoo", "resend")


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


# ── Resend config (api_key + from_email + sender_name, no browser session) ──

def _resend_config_path(user_id: str) -> str:
    return os.path.join(SESSIONS_DIR, user_id, "resend", "config.json")


def save_resend(user_id: str, api_key: str, from_email: str, sender_name: str) -> None:
    path = _resend_config_path(user_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump({"api_key": api_key, "from_email": from_email, "sender_name": sender_name}, f)
    logger.info(f"Resend config salvata: user={user_id}")


def load_resend(user_id: str) -> dict:
    with open(_resend_config_path(user_id)) as f:
        return json.load(f)


def resend_exists(user_id: str) -> bool:
    return os.path.exists(_resend_config_path(user_id))


def delete_resend(user_id: str) -> None:
    import shutil
    resend_dir = os.path.join(SESSIONS_DIR, user_id, "resend")
    if os.path.exists(resend_dir):
        shutil.rmtree(resend_dir)
