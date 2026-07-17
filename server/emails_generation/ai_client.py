import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-v4-flash"


def parse_json(response: str) -> Any:
    """Extract and parse the first JSON object/array in `response`."""
    if not isinstance(response, str):
        raise TypeError("response deve essere una stringa")
    response = (response
                .replace("\u201c", '"').replace("\u201d", '"')
                .replace("\u2018", "'").replace("\u2019", "'"))
    response = re.sub(r"```[^\n]*\n?", "", response)
    response = response.replace("```", "").replace("`", "")
    response = re.sub(r"[​-‍﻿]", "", response)
    match = re.search(r"(\{.*?\}|\[.*?\])", response, re.DOTALL)
    if not match:
        raise ValueError("Nessun oggetto JSON trovato nella stringa")
    fragment = match.group(0).strip()
    try:
        return json.loads(fragment)
    except json.JSONDecodeError as e:
        raise ValueError(f"Parsing JSON fallito per il frammento: {fragment!r}. Errore: {e}") from e


def _call_deepseek(prompt: str, want_json: bool, timeout: int = 60) -> str:
    """POST to DeepSeek and return message content string.

    Raises RuntimeError if API key is missing, request fails after retries, or content is empty.
    """
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY not set")
    body: Dict[str, Any] = {
        "model": DEEPSEEK_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }
    if want_json:
        body["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    last_err: Optional[Exception] = None
    for attempt in range(3):
        try:
            resp = requests.post(DEEPSEEK_URL, headers=headers, json=body, timeout=timeout)
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                if not content:
                    raise RuntimeError("deepseek returned empty content")
                return content
            if resp.status_code in (429, 500, 502, 503):
                last_err = RuntimeError(f"deepseek transient {resp.status_code}")
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"deepseek {resp.status_code}: {resp.text[:200]}")
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 ** attempt)
    raise last_err or RuntimeError("deepseek failed")
