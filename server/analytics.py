"""
Server-side analytics helper.

Posts events to the Next.js /api/internal/track endpoint in a background
thread, so the calling pipeline is never blocked by network I/O or by an
unreachable site. All errors are swallowed (analytics must never break
production work).

Usage:
    from server.analytics import track
    track("server_pipeline_started", {"user_id": uid, "companies": ["X", "Y"]}, user_id=uid)
"""
from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests

_log = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 5


def _post(event: str, params: Dict[str, Any], user_id: Optional[str], occurred_at: str) -> None:
    domain = os.environ.get("NEXT_PUBLIC_DOMAIN")
    key = os.environ.get("SESSION_API_KEY")
    if not domain or not key:
        return  # silent no-op when not configured (e.g. local dev without site)

    url = f"{domain.rstrip('/')}/api/internal/track"
    try:
        requests.post(
            url,
            json={
                "event": event,
                "params": params,
                "user_id": user_id,
                "occurred_at": occurred_at,
            },
            headers={"X-Internal-Key": key, "Content-Type": "application/json"},
            timeout=_TIMEOUT_SECONDS,
        )
    except Exception as e:  # noqa: BLE001 — analytics must never raise
        _log.debug(f"track({event!r}) failed silently: {e}")


def track(event: str, params: Optional[Dict[str, Any]] = None, user_id: Optional[str] = None) -> None:
    """Fire-and-forget: dispatch the event in a daemon thread and return immediately."""
    occurred_at = datetime.now(timezone.utc).isoformat()
    threading.Thread(
        target=_post,
        args=(event, params or {}, user_id, occurred_at),
        daemon=True,
    ).start()
