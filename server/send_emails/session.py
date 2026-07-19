import base64
import hashlib
import json
import logging
import os
import shutil
import time
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

SESSIONS_DIR = "sessions"
VALID_PROVIDERS = ("gmail", "outlook", "yahoo", "resend")
SESSION_RETENTION_SECONDS = 90 * 24 * 60 * 60

# ── Secrets at rest ──────────────────────────────────────────────────────────
# These files hold provider session cookies (full access to the user's mailbox)
# and Resend API keys. Two layers of protection:
#   1. Permissions: dirs 0700, files 0600 — always applied, no dependency.
#   2. Encryption: SESSIONS_SECRET and `cryptography` are mandatory. We fail
#      closed rather than ever writing provider credentials in plaintext.


def _fernet():
    secret = os.environ.get("SESSIONS_SECRET")
    if not secret:
        raise RuntimeError("SESSIONS_SECRET is required to store email-provider credentials")
    try:
        from cryptography.fernet import Fernet
    except Exception as exc:
        raise RuntimeError("cryptography is required to store email-provider credentials") from exc
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def _write_secure(path: str, obj: dict) -> None:
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    try:
        os.chmod(directory, 0o700)
    except OSError:
        pass

    f = _fernet()
    payload = {"__enc__": f.encrypt(json.dumps(obj).encode()).decode()}

    # Atomic write with restrictive permissions from the start.
    tmp = f"{path}.tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(payload, fh)
    except Exception:
        try:
            os.unlink(tmp)
        finally:
            raise
    os.replace(tmp, path)


def _read_secure(path: str) -> dict:
    with open(path) as fh:
        raw = json.load(fh)
    if isinstance(raw, dict) and "__enc__" in raw:
        f = _fernet()
        return json.loads(f.decrypt(raw["__enc__"].encode()).decode())
    # Transparently migrate legacy session files the first time they are read.
    _write_secure(path, raw)
    return raw


def session_path(user_id: str, provider: str) -> str:
    return os.path.join(SESSIONS_DIR, user_id, provider, "session.json")


def save(user_id: str, provider: str, cookies: list, fingerprint: dict) -> None:
    _write_secure(session_path(user_id, provider), {
        "cookies": cookies,
        "fingerprint": fingerprint,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    })
    logger.info(f"Sessione salvata: user={user_id} provider={provider}")


def load(user_id: str, provider: str) -> dict:
    return _read_secure(session_path(user_id, provider))


def exists(user_id: str, provider: str) -> bool:
    path = session_path(user_id, provider)
    if _is_expired(path):
        delete(user_id, provider)
        return False
    return os.path.exists(path)


def _is_expired(path: str, now: Optional[float] = None) -> bool:
    if not os.path.exists(path):
        return False
    return (now or time.time()) - os.path.getmtime(path) >= SESSION_RETENTION_SECONDS


def delete(user_id: str, provider: str) -> None:
    if provider not in VALID_PROVIDERS:
        return
    provider_dir = os.path.join(SESSIONS_DIR, user_id, provider)
    if os.path.isdir(provider_dir):
        shutil.rmtree(provider_dir)


def delete_all(user_id: str) -> None:
    user_dir = os.path.join(SESSIONS_DIR, user_id)
    if os.path.isdir(user_dir):
        shutil.rmtree(user_dir)


def purge_expired(now: Optional[float] = None) -> int:
    """Delete provider credentials that have been stored for at least 90 days."""
    if not os.path.isdir(SESSIONS_DIR):
        return 0
    current_time = now or time.time()
    deleted = 0
    for user_id in os.listdir(SESSIONS_DIR):
        user_dir = os.path.join(SESSIONS_DIR, user_id)
        if not os.path.isdir(user_dir):
            continue
        for provider in VALID_PROVIDERS:
            credential_path = (
                _resend_config_path(user_id)
                if provider == "resend"
                else session_path(user_id, provider)
            )
            if _is_expired(credential_path, current_time):
                delete(user_id, provider)
                deleted += 1
        try:
            if not os.listdir(user_dir):
                os.rmdir(user_dir)
        except OSError:
            pass
    if deleted:
        logger.info("Deleted %s expired email-provider sessions", deleted)
    return deleted


# ── Resend config (api_key + from_email + sender_name, no browser session) ──

def _resend_config_path(user_id: str) -> str:
    return os.path.join(SESSIONS_DIR, user_id, "resend", "config.json")


def save_resend(user_id: str, api_key: str, from_email: str, sender_name: str) -> None:
    _write_secure(_resend_config_path(user_id), {
        "api_key": api_key,
        "from_email": from_email,
        "sender_name": sender_name,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    })
    logger.info(f"Resend config salvata: user={user_id}")


def load_resend(user_id: str) -> dict:
    return _read_secure(_resend_config_path(user_id))


def resend_exists(user_id: str) -> bool:
    path = _resend_config_path(user_id)
    if _is_expired(path):
        delete(user_id, "resend")
        return False
    return os.path.exists(path)


def delete_resend(user_id: str) -> None:
    delete(user_id, "resend")
