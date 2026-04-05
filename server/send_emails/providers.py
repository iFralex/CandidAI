import base64
import logging
import os
import random
import tempfile
import time
import urllib.request as urlreq

logger = logging.getLogger(__name__)

PROVIDER_URLS = {
    "gmail": "https://mail.google.com",
    "outlook": "https://outlook.live.com/mail/",
    "yahoo": "https://mail.yahoo.com",
}

# Tasti vicini sulla tastiera QWERTY per simulare errori umani
_NEARBY_KEYS = {
    'a': 'sqwz', 'b': 'vghn', 'c': 'xdfv', 'd': 'srfce', 'e': 'wrsdf',
    'f': 'drtgv', 'g': 'ftyhb', 'h': 'gyujn', 'i': 'uojk', 'j': 'huikm',
    'k': 'jiol', 'l': 'kop', 'm': 'njk', 'n': 'bhjm', 'o': 'iklp',
    'p': 'ol', 'q': 'wa', 'r': 'etdf', 's': 'awedz', 't': 'ryfg',
    'u': 'yhij', 'v': 'cfgb', 'w': 'qase', 'x': 'zsdc', 'y': 'tghu',
    'z': 'asx',
}


def _nearby_key(char: str) -> str:
    neighbors = _NEARBY_KEYS.get(char.lower(), '')
    if not neighbors:
        return char
    result = random.choice(neighbors)
    return result.upper() if char.isupper() else result


def _char_delay(char: str) -> int:
    """Ritardo in ms dopo ogni carattere, simulando ritmo umano."""
    if char in (' ', '\n'):
        return random.randint(80, 220)
    if char in ('.', ',', '!', '?', ';', ':'):
        return random.randint(120, 300)
    return random.randint(40, 150)


async def human_type(page, text: str) -> None:
    """Digita testo carattere per carattere con ritmo casuale e occasionali errori."""
    i = 0
    while i < len(text):
        char = text[i]

        # 5% probabilità di errore di battitura su lettere
        if char.isalpha() and random.random() < 0.05:
            wrong = _nearby_key(char)
            await page.keyboard.type(wrong)
            await page.wait_for_timeout(random.randint(80, 200))
            # 30% probabilità di accorgersi subito, 70% di continuare e poi correggere
            if random.random() < 0.30:
                await page.keyboard.press("Backspace")
                await page.wait_for_timeout(random.randint(60, 180))
            else:
                # Digita qualche carattere in più prima di correggere
                extra = random.randint(1, 3)
                for j in range(extra):
                    if i + 1 + j < len(text):
                        await page.keyboard.type(text[i + 1 + j])
                        await page.wait_for_timeout(_char_delay(text[i + 1 + j]))
                # Cancella tutto e riscrivi
                for _ in range(extra + 1):
                    await page.keyboard.press("Backspace")
                    await page.wait_for_timeout(random.randint(50, 120))

        await page.keyboard.type(char)
        await page.wait_for_timeout(_char_delay(char))

        # Pausa di "riflessione" occasionale (2%)
        if random.random() < 0.02:
            await page.wait_for_timeout(random.randint(400, 1000))

        i += 1


async def human_click(page, selector: str, timeout: int = 10000) -> None:
    """Clicca un elemento in una posizione casuale (non al centro) con tempi umani."""
    locator = page.locator(selector).first
    await locator.wait_for(state="visible", timeout=timeout)
    box = await locator.bounding_box()
    await page.wait_for_timeout(random.randint(60, 250))
    if box and box["width"] > 10 and box["height"] > 10:
        x = box["x"] + random.uniform(box["width"] * 0.25, box["width"] * 0.75)
        y = box["y"] + random.uniform(box["height"] * 0.25, box["height"] * 0.75)
        await page.mouse.move(x, y, steps=random.randint(4, 10))
        await page.wait_for_timeout(random.randint(40, 120))
        await page.mouse.click(x, y)
    else:
        await locator.click()


async def paste_text(page, text: str) -> None:
    """Copia il testo nella clipboard del browser e incolla con Ctrl+V."""
    escaped = text.replace('\\', '\\\\').replace('`', '\\`')
    await page.evaluate(f"() => navigator.clipboard.writeText(`{escaped}`)")
    await page.wait_for_timeout(random.randint(80, 200))
    await page.keyboard.press("Control+v")
    await page.wait_for_timeout(random.randint(100, 250))


async def download_cv(url: str) -> str:
    """Scarica un CV da URL in un file temporaneo, restituisce il path locale."""
    ext = url.split("?")[0].rsplit(".", 1)[-1]
    if ext not in ("pdf", "doc", "docx"):
        ext = "pdf"
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
        tmp_path = f.name
    urlreq.urlretrieve(url, tmp_path)
    return tmp_path


async def send_gmail(page, email: dict, screenshot_dir: str | None = None) -> None:
    async def shot(step: str) -> None:
        if not screenshot_dir:
            return
        os.makedirs(screenshot_dir, exist_ok=True)
        path = os.path.join(screenshot_dir, f"{int(time.time() * 1000)}_{step}.png")
        await page.screenshot(path=path, full_page=False)
        logger.info(f"[screenshot] {path}")

    await shot("01_inbox")
    try:
        await human_click(page, '[gh="cm"]', timeout=20000)
    except Exception:
        logger.info("[gmail] Pulsante compose non trovato, navigo a compose=new")
        await page.goto("https://mail.google.com/mail/u/0/#inbox?compose=new", wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_selector('[name="to"]', timeout=15000)
    await shot("02_compose_open")
    await human_type(page, email["to"])
    await page.keyboard.press("Enter")
    await shot("03_to_filled")
    use_paste = random.random() < 0.70

    await human_click(page, '[name="subjectbox"]', timeout=5000)
    await human_type(page, email["subject"])
    await shot("04_subject_filled")
    await page.keyboard.press("Tab")
    if use_paste:
        await paste_text(page, email["body"])
    else:
        await human_type(page, email["body"])
    await shot("05_body_filled")
    if email.get("cvUrl"):
        try:
            tmp = await download_cv(email["cvUrl"])
            filename = "cv.pdf"
            mime = "application/pdf"
            with open(tmp, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            await page.evaluate(f"""() => {{
                const raw = atob('{b64}');
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                const file = new File([bytes], '{filename}', {{ type: '{mime}' }});
                const dt = new DataTransfer();
                dt.items.add(file);
                document.activeElement.dispatchEvent(
                    new ClipboardEvent('paste', {{ clipboardData: dt, bubbles: true }})
                );
            }}""")
            await page.wait_for_timeout(random.randint(1500, 2500))
            await shot("06_cv_attached")
        except Exception as e:
            logger.warning(f"[gmail] CV allegato fallito: {e}")
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(random.randint(100, 250))
    await page.keyboard.press("Enter")
    await page.wait_for_timeout(random.randint(800, 1500))
    await shot("07_after_send")


async def send_outlook(page, email: dict, **kwargs) -> None:
    await human_click(page, '[aria-label="New message"], [aria-label="New Mail"]', timeout=15000)
    await page.wait_for_selector('input[aria-label="To"]', timeout=10000)
    await human_type(page, email["to"])
    await page.keyboard.press("Tab")
    await page.wait_for_selector('input[aria-label="Subject"]', timeout=5000)
    await human_type(page, email["subject"])
    await page.keyboard.press("Tab")
    await human_type(page, email["body"])
    await human_click(page, '[aria-label="Send"]', timeout=5000)
    await page.wait_for_timeout(random.randint(800, 1500))


async def send_yahoo(page, email: dict, **kwargs) -> None:
    await human_click(page, '[data-test-id="compose-button"]', timeout=15000)
    await page.wait_for_selector('input[aria-label="To"]', timeout=10000)
    await human_type(page, email["to"])
    await page.keyboard.press("Tab")
    await page.wait_for_selector('input[aria-label="Subject"]', timeout=5000)
    await human_type(page, email["subject"])
    await page.keyboard.press("Tab")
    await human_type(page, email["body"])
    await human_click(page, '[data-test-id="send-button"]', timeout=5000)
    await page.wait_for_timeout(random.randint(800, 1500))


SEND_FUNCS = {
    "gmail": send_gmail,
    "outlook": send_outlook,
    "yahoo": send_yahoo,
}
