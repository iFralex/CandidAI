import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional, Union

import requests

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-v4-flash"


def parse_json(response: str) -> Any:
    """Extract and parse the first JSON object/array in `response`."""
    if not isinstance(response, str):
        raise TypeError("response deve essere una stringa")
    response = (response
                .replace(""", '"').replace(""", '"')
                .replace("'", "'").replace("'", "'"))
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
