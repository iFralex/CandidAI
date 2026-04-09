"""
Shared browser utilities for server modules.

Provides:
- run_sync(coro)          – submit an async coroutine to the shared background event
                            loop and block until it returns.  Lets sync code call
                            Patchright without creating a new event loop per call.
- get_browser_executable() – resolve the Chrome binary from the project's browsers/
                              directory for the current platform.
- xvfb_display(...)       – context manager that allocates a unique Xvfb display
                              number, starts the server, and cleans up on exit.
"""

import asyncio
import contextlib
import os
import platform
import subprocess
import threading
import time
from pathlib import Path

# ── Background event loop ──────────────────────────────────────────────────────

_loop: asyncio.AbstractEventLoop | None = None
_loop_lock = threading.Lock()


def _get_loop() -> asyncio.AbstractEventLoop:
    global _loop
    with _loop_lock:
        if _loop is None or not _loop.is_running():
            _loop = asyncio.new_event_loop()
            t = threading.Thread(target=_loop.run_forever, daemon=True)
            t.start()
    return _loop


def run_sync(coro):
    """Submit *coro* to the shared background event loop and block until done."""
    return asyncio.run_coroutine_threadsafe(coro, _get_loop()).result()


# ── Chrome executable path ─────────────────────────────────────────────────────

def get_browser_executable() -> str | None:
    """
    Return the absolute path to the Chrome binary inside the project's
    browsers/ directory, or None if it cannot be found.
    """
    root = Path(__file__).parent.parent / "browsers"
    system = platform.system()
    machine = platform.machine()

    if system == "Linux":
        candidate = root / "linux" / "chrome-linux64" / "chrome"
    elif system == "Darwin":
        arch = "arm64" if machine == "arm64" else "x64"
        candidate = (
            root / f"mac-{arch}" / f"chrome-mac-{arch}"
            / "Google Chrome for Testing.app"
            / "Contents" / "MacOS" / "Google Chrome for Testing"
        )
    elif system == "Windows":
        candidate = root / "win" / "chrome-win64" / "chrome.exe"
    else:
        return None

    if not candidate.exists():
        _download_browsers(root.parent)
    return str(candidate) if candidate.exists() else None


def _download_browsers(repo_root: Path) -> None:
    script = repo_root / ".githooks" / "download_browsers.sh"
    if not script.exists():
        raise FileNotFoundError(f"Script non trovato: {script}")
    print("[browser_pool] browsers/ non trovata, scarico...")
    subprocess.run(["bash", str(script)], check=True)


# ── Xvfb display pool ──────────────────────────────────────────────────────────

_display_lock = threading.Lock()
_next_display = 100


@contextlib.contextmanager
def xvfb_display(width: int = 1280, height: int = 800, depth: int = 24):
    """
    Allocate a unique Xvfb display number in the range :100–:200, start the
    virtual framebuffer, yield the DISPLAY string (e.g. ':101'), and kill the
    process on exit.
    """
    global _next_display
    with _display_lock:
        display_num = _next_display
        _next_display = (_next_display + 1) if _next_display < 200 else 100

    display = f":{display_num}"
    os.system(f"Xvfb {display} -ac -screen 0 {width}x{height}x{depth} &")
    time.sleep(0.3)
    try:
        yield display
    finally:
        os.system(f"pkill -f 'Xvfb {display}' 2>/dev/null")
