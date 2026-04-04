import asyncio
import json
import logging
import os
import random
from typing import Set

from server.send_emails import session as session_module
from server.send_emails.providers import PROVIDER_URLS, SEND_FUNCS

logger = logging.getLogger(__name__)

# user_id delle campagne da interrompere al prossimo ciclo
cancelled_campaigns: Set[str] = set()


def run(user_id: str, provider: str, emails: list) -> None:
    """Entry point sincrono per il worker thread."""
    asyncio.run(_run_async(user_id, provider, emails))


async def _run_async(user_id: str, provider: str, emails: list) -> None:
    from patchright.async_api import async_playwright

    session_data = session_module.load(user_id, provider)
    cookies = session_data["cookies"]
    fp = session_data["fingerprint"]

    proxy_config = None
    proxy_url = os.environ.get("PROXY_URL")
    if proxy_url:
        proxy_config = {"server": proxy_url}

    results_ref = _get_results_ref(user_id)

    canvas_hash_js = json.dumps(fp.get("canvasHash", ""))
    platform_js = json.dumps(fp.get("platform", ""))
    hw_concurrency = int(fp.get("hardwareConcurrency", 4))

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
            proxy=proxy_config,
        )
        context = await browser.new_context(
            user_agent=fp.get("userAgent", ""),
            locale=fp.get("language", "en-US"),
            timezone_id=fp.get("timezone", "UTC"),
            viewport={
                "width": fp.get("screen", {}).get("w", 1280),
                "height": fp.get("screen", {}).get("h", 800),
            },
            extra_http_headers={"Accept-Language": fp.get("language", "en-US")},
        )
        await context.add_init_script(f"""
            Object.defineProperty(navigator, 'platform', {{ get: () => {platform_js} }});
            Object.defineProperty(navigator, 'hardwareConcurrency', {{ get: () => {hw_concurrency} }});
            const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(...a) {{
                if (this.width < 50) return {canvas_hash_js};
                return _toDataURL.apply(this, a);
            }};
        """)
        await context.add_cookies(cookies)

        page = await context.new_page()
        await page.goto(PROVIDER_URLS[provider], wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        send = SEND_FUNCS[provider]

        for i, email in enumerate(emails):
            if user_id in cancelled_campaigns:
                logger.info(f"Campagna cancellata per user {user_id}")
                cancelled_campaigns.discard(user_id)
                break

            try:
                await send(page, email)
                _mark_sent(results_ref, email["id"])
                logger.info(f"Inviata {i + 1}/{len(emails)} → {email.get('to', '?')}")
            except Exception as e:
                logger.error(f"Errore invio a {email.get('to', '?')}: {e}")
                break

            if i < len(emails) - 1:
                wait_s = random.randint(30, 60)
                logger.info(f"Attesa {wait_s}s prima del prossimo invio...")
                await page.wait_for_timeout(wait_s * 1000)

        await browser.close()
        logger.info(f"Campagna completata per user {user_id}")


def _get_results_ref(user_id: str):
    try:
        from firebase_admin import firestore as fb_firestore
        db = fb_firestore.client()
        return db.document(f"users/{user_id}/data/results")
    except Exception as e:
        logger.warning(f"Firebase non disponibile: {e}")
        return None


def _mark_sent(results_ref, email_id: str) -> None:
    if not results_ref:
        return
    try:
        from firebase_admin import firestore as fb_firestore
        results_ref.set(
            {email_id: {"email_sent": fb_firestore.SERVER_TIMESTAMP}},
            merge=True,
        )
    except Exception as e:
        logger.error(f"Errore aggiornamento Firestore per email {email_id}: {e}")
