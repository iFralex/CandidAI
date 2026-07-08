import base64
import hashlib
import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

SESSIONS_DIR = "sessions"
VALID_PROVIDERS = ("gmail", "outlook", "yahoo", "resend")

# ── Secrets at rest ──────────────────────────────────────────────────────────
# These files hold provider session cookies (full access to the user's mailbox)
# and Resend API keys. Two layers of protection:
#   1. Permissions: dirs 0700, files 0600 — always applied, no dependency.
#   2. Encryption (opt-in): if SESSIONS_SECRET is set AND `cryptography` is
#      installed, payloads are Fernet-encrypted. Legacy plaintext files are read
#      transparently and re-encrypted on the next save (no reconnect needed).
# Without SESSIONS_SECRET the files stay plaintext (previous behaviour) but with
# tightened permissions.


def _fernet():
    secret = os.environ.get("SESSIONS_SECRET")
    if not secret:
        return None
    try:
        from cryptography.fernet import Fernet
    except Exception:
        logger.warning(
            "SESSIONS_SECRET is set but 'cryptography' is not installed — "
            "sessions will be stored in PLAINTEXT."
        )
        return None
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
    if f:
        payload = {"__enc__": f.encrypt(json.dumps(obj).encode()).decode()}
    else:
        payload = obj  # plaintext (legacy) — still written with 0600 perms

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
        if not f:
            raise RuntimeError(
                "Session file is encrypted but SESSIONS_SECRET/cryptography is unavailable."
            )
        return json.loads(f.decrypt(raw["__enc__"].encode()).decode())
    return raw  # legacy plaintext


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
    return os.path.exists(session_path(user_id, provider))


# ── Resend config (api_key + from_email + sender_name, no browser session) ──

def _resend_config_path(user_id: str) -> str:
    return os.path.join(SESSIONS_DIR, user_id, "resend", "config.json")


def save_resend(user_id: str, api_key: str, from_email: str, sender_name: str) -> None:
    _write_secure(_resend_config_path(user_id), {
        "api_key": api_key,
        "from_email": from_email,
        "sender_name": sender_name,
    })
    logger.info(f"Resend config salvata: user={user_id}")


def load_resend(user_id: str) -> dict:
    return _read_secure(_resend_config_path(user_id))


def resend_exists(user_id: str) -> bool:
    return os.path.exists(_resend_config_path(user_id))


def delete_resend(user_id: str) -> None:
    import shutil
    resend_dir = os.path.join(SESSIONS_DIR, user_id, "resend")
    if os.path.exists(resend_dir):
        shutil.rmtree(resend_dir)
