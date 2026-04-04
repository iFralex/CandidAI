import logging
import tempfile
import urllib.request as urlreq

logger = logging.getLogger(__name__)

PROVIDER_URLS = {
    "gmail": "https://mail.google.com",
    "outlook": "https://outlook.live.com/mail/",
    "yahoo": "https://mail.yahoo.com",
}


async def download_cv(url: str) -> str:
    """Scarica un CV da URL in un file temporaneo, restituisce il path locale."""
    ext = url.split("?")[0].rsplit(".", 1)[-1]
    if ext not in ("pdf", "doc", "docx"):
        ext = "pdf"
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
        tmp_path = f.name
    urlreq.urlretrieve(url, tmp_path)
    return tmp_path


async def send_gmail(page, email: dict) -> None:
    await page.keyboard.press("c")
    await page.wait_for_selector('[name="to"]', timeout=10000)
    await page.type('[name="to"]', email["to"], delay=30)
    await page.keyboard.press("Tab")
    await page.wait_for_selector('[name="subjectbox"]', timeout=5000)
    await page.type('[name="subjectbox"]', email["subject"], delay=30)
    await page.wait_for_selector('div[aria-label="Message Body"]', timeout=5000)
    await page.click('div[aria-label="Message Body"]')
    await page.type('div[aria-label="Message Body"]', email["body"], delay=30)
    if email.get("cvUrl"):
        try:
            tmp = await download_cv(email["cvUrl"])
            await page.locator('input[type="file"]').set_input_files(tmp)
            await page.wait_for_timeout(2000)
        except Exception as e:
            logger.warning(f"[gmail] CV allegato fallito: {e}")
    await page.wait_for_selector('[aria-label="Send"]', timeout=5000)
    await page.click('[aria-label="Send"]')
    await page.wait_for_timeout(1000)


async def send_outlook(page, email: dict) -> None:
    await page.wait_for_selector('[aria-label="New message"], [aria-label="New Mail"]', timeout=15000)
    await page.click('[aria-label="New message"], [aria-label="New Mail"]')
    await page.wait_for_selector('input[aria-label="To"]', timeout=10000)
    await page.type('input[aria-label="To"]', email["to"], delay=30)
    await page.keyboard.press("Tab")
    await page.wait_for_selector('input[aria-label="Subject"]', timeout=5000)
    await page.type('input[aria-label="Subject"]', email["subject"], delay=30)
    await page.wait_for_selector('div[aria-label="Message body"]', timeout=5000)
    await page.click('div[aria-label="Message body"]')
    await page.type('div[aria-label="Message body"]', email["body"], delay=30)
    await page.wait_for_selector('[aria-label="Send"]', timeout=5000)
    await page.click('[aria-label="Send"]')
    await page.wait_for_timeout(1000)


async def send_yahoo(page, email: dict) -> None:
    await page.wait_for_selector('[data-test-id="compose-button"]', timeout=15000)
    await page.click('[data-test-id="compose-button"]')
    await page.wait_for_selector('input[aria-label="To"]', timeout=10000)
    await page.type('input[aria-label="To"]', email["to"], delay=30)
    await page.keyboard.press("Tab")
    await page.wait_for_selector('input[aria-label="Subject"]', timeout=5000)
    await page.type('input[aria-label="Subject"]', email["subject"], delay=30)
    await page.wait_for_selector('div[aria-label="Message body"]', timeout=5000)
    await page.click('div[aria-label="Message body"]')
    await page.type('div[aria-label="Message body"]', email["body"], delay=30)
    await page.wait_for_selector('[data-test-id="send-button"]', timeout=5000)
    await page.click('[data-test-id="send-button"]')
    await page.wait_for_timeout(1000)


SEND_FUNCS = {
    "gmail": send_gmail,
    "outlook": send_outlook,
    "yahoo": send_yahoo,
}
