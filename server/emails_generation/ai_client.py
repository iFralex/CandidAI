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


def _call_openrouter(
    prompt: str,
    want_json: bool,
    model: Optional[str] = None,
    site_url: Optional[str] = None,
    site_name: Optional[str] = None,
) -> Optional[str]:
    """
    Invia un prompt a OpenRouter API con gestione avanzata degli errori multi-step.

    Strategie di resilienza modulari:
    - 429 (Rate Limit): attesa → rotazione API key → cambio modello
    - 401 (Auth): rotazione API key → attesa → cambio modello
    - 502 (Bad Gateway): cambio modello → attesa → proxy
    - 503 (Unavailable): attesa breve → proxy → cambio modello
    - Timeout: retry → proxy → cambio modello
    - Connection Error: proxy → attesa → cambio modello

    Restituisce il testo grezzo della risposta (nessun parsing JSON), oppure None
    se tutti i tentativi falliscono.
    """

    # Pool di API keys
    API_KEYS = os.getenv("OPENROUTER_API_KEYS", "").split(",")
    API_KEYS = [key.strip() for key in API_KEYS if key.strip()]

    # Modelli fallback
    FALLBACK_MODELS = [
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemma-3-27b-it:free",
        "z-ai/glm-4.5-air:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "openai/gpt-oss-120b:free"
    ]

    # Configurazione proxy
    PROXY = {
        "http": os.getenv("PROXY_HTTP_URL"),
        "https": os.getenv("PROXY_HTTPS_URL"),
    }

    API_URL = "https://openrouter.ai/api/v1/chat/completions"
    MAX_RETRIES = 12
    INITIAL_BACKOFF = 2

    # Stato della richiesta
    current_api_key_idx = 0
    current_model_idx = FALLBACK_MODELS.index(model) if model in FALLBACK_MODELS else 0
    use_proxy = False

    # Contatori per strategie multi-step
    error_counters = {
        404: 0,  # Model Not Found
        429: 0,  # Rate limit
        401: 0,  # Unauthorized
        502: 0,  # Bad Gateway
        503: 0,  # Service Unavailable
        408: 0,  # Timeout
        'timeout': 0,
        'connection': 0,
        'proxy_error': 0,
    }

    def handle_429_strategy(attempt: int) -> tuple[bool, int]:
        """
        Strategia multi-step per 429:
        Step 1-2: Attesa con backoff
        Step 3-4: Cambio API key + attesa
        Step 5+: Cambio modello + attesa
        """
        nonlocal current_api_key_idx, current_model_idx, error_counters

        error_counters[429] += 1
        count = error_counters[429]

        retry_after = INITIAL_BACKOFF * (2 ** min(attempt, 5))

        if count <= 2:
            # Step 1-2: Solo attesa
            logging.info(f"⏳ Rate limit (429) - Step 1: Attesa {retry_after}s... (Occorrenza {count})")
            time.sleep(retry_after)
            return True, retry_after

        elif count <= 4:
            # Step 3-4: Cambio API key
            old_idx = current_api_key_idx
            current_api_key_idx = (current_api_key_idx + 1) % len(API_KEYS)
            logging.info(f"⏳ Rate limit (429) - Step 2: Cambio API key [{old_idx}→{current_api_key_idx}] + attesa {retry_after}s...")
            time.sleep(retry_after)
            return True, retry_after

        else:
            # Step 5+: Cambio modello
            old_model = FALLBACK_MODELS[current_model_idx]
            current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
            new_model = FALLBACK_MODELS[current_model_idx]
            logging.info(f"⏳ Rate limit (429) - Step 3: Cambio modello [{old_model}→{new_model}] + attesa {retry_after}s...")
            time.sleep(retry_after)

            # Reset counter se abbiamo provato tutti i modelli
            if current_model_idx == 0:
                error_counters[429] = 0

            return True, retry_after

    def handle_401_strategy() -> bool:
        """
        Strategia multi-step per 401:
        Step 1: Cambio API key immediato
        Step 2-3: Cambio API key + attesa
        Step 4+: Cambio modello (potrebbe avere restrizioni diverse)
        """
        nonlocal current_api_key_idx, current_model_idx, error_counters

        error_counters[401] += 1
        count = error_counters[401]

        if count == 1:
            # Step 1: Cambio API key immediato
            old_idx = current_api_key_idx
            current_api_key_idx = (current_api_key_idx + 1) % len(API_KEYS)
            logging.info(f"🔑 Auth error (401) - Step 1: Cambio API key [{old_idx}→{current_api_key_idx}]")
            return True

        elif count <= 3:
            # Step 2-3: Cambio API key + attesa
            old_idx = current_api_key_idx
            current_api_key_idx = (current_api_key_idx + 1) % len(API_KEYS)
            logging.info(f"🔑 Auth error (401) - Step 2: Cambio API key [{old_idx}→{current_api_key_idx}] + attesa 2s...")
            time.sleep(2)
            return True

        else:
            # Step 4+: Cambio modello
            old_model = FALLBACK_MODELS[current_model_idx]
            current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
            new_model = FALLBACK_MODELS[current_model_idx]
            logging.info(f"🔑 Auth error (401) - Step 3: Cambio modello [{old_model}→{new_model}]")
            time.sleep(1)

            # Se abbiamo provato tutte le combinazioni, ferma
            if current_model_idx == 0 and count > len(API_KEYS) * len(FALLBACK_MODELS):
                logging.info("❌ Tutte le API key fallite su tutti i modelli")
                return False

            return True

    def handle_502_strategy() -> bool:
        """
        Strategia multi-step per 502:
        Step 1: Cambio modello immediato
        Step 2-3: Cambio modello + attesa
        Step 4+: Proxy + cambio modello
        """
        nonlocal current_model_idx, use_proxy, error_counters

        error_counters[502] += 1
        count = error_counters[502]

        if count == 1:
            # Step 1: Cambio modello immediato
            old_model = FALLBACK_MODELS[current_model_idx]
            current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
            new_model = FALLBACK_MODELS[current_model_idx]
            logging.info(f"🔧 Bad Gateway (502) - Step 1: Cambio modello [{old_model}→{new_model}]")
            return True

        elif count <= 3:
            # Step 2-3: Cambio modello + attesa
            old_model = FALLBACK_MODELS[current_model_idx]
            current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
            new_model = FALLBACK_MODELS[current_model_idx]
            wait_time = INITIAL_BACKOFF * count
            logging.info(f"🔧 Bad Gateway (502) - Step 2: Cambio modello [{old_model}→{new_model}] + attesa {wait_time}s...")
            time.sleep(wait_time)
            return True

        else:
            # Step 4+: Attiva proxy
            if not use_proxy:
                use_proxy = True
                logging.info(f"🔧 Bad Gateway (502) - Step 3: Attivazione proxy")
                time.sleep(2)
            else:
                # Continua a cambiare modello con proxy attivo
                old_model = FALLBACK_MODELS[current_model_idx]
                current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
                new_model = FALLBACK_MODELS[current_model_idx]
                logging.info(f"🔧 Bad Gateway (502) - Step 3: Cambio modello con proxy [{old_model}→{new_model}]")
                time.sleep(3)

            return True

    def handle_503_strategy() -> bool:
        """
        Strategia multi-step per 503:
        Step 1: Attesa breve
        Step 2: Attiva proxy
        Step 3+: Cambio modello + proxy
        """
        nonlocal use_proxy, current_model_idx, error_counters

        error_counters[503] += 1
        count = error_counters[503]

        if count == 1:
            # Step 1: Attesa breve
            logging.info(f"⏸️ Service Unavailable (503) - Step 1: Attesa 3s...")
            time.sleep(3)
            return True

        elif count == 2:
            # Step 2: Attiva proxy
            use_proxy = True
            logging.info(f"⏸️ Service Unavailable (503) - Step 2: Attivazione proxy + attesa 5s...")
            time.sleep(5)
            return True

        else:
            # Step 3+: Cambio modello con proxy
            old_model = FALLBACK_MODELS[current_model_idx]
            current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
            new_model = FALLBACK_MODELS[current_model_idx]
            logging.info(f"⏸️ Service Unavailable (503) - Step 3: Cambio modello con proxy [{old_model}→{new_model}]")
            time.sleep(4)
            return True

    def handle_timeout_strategy() -> bool:
        """
        Strategia multi-step per Timeout:
        Step 1: Retry immediato
        Step 2: Attiva proxy
        Step 3+: Cambio modello con proxy
        """
        nonlocal use_proxy, current_model_idx, error_counters

        error_counters['timeout'] += 1
        count = error_counters['timeout']

        if count == 1:
            # Step 1: Retry immediato
            logging.info(f"⏱️ Timeout - Step 1: Retry immediato")
            time.sleep(1)
            return True

        elif count == 2:
            # Step 2: Attiva proxy
            use_proxy = True
            logging.info(f"⏱️ Timeout - Step 2: Attivazione proxy")
            time.sleep(2)
            return True

        else:
            # Step 3+: Cambio modello
            old_model = FALLBACK_MODELS[current_model_idx]
            current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
            new_model = FALLBACK_MODELS[current_model_idx]
            logging.info(f"⏱️ Timeout - Step 3: Cambio modello con proxy [{old_model}→{new_model}]")
            time.sleep(2)
            return True

    def handle_connection_error_strategy() -> bool:
        """
        Strategia multi-step per Connection Error:
        Step 1: Attiva proxy immediato
        Step 2: Attesa + proxy
        Step 3+: Cambio modello + proxy
        """
        nonlocal use_proxy, current_model_idx, error_counters

        error_counters['connection'] += 1
        count = error_counters['connection']

        if count == 1:
            # Step 1: Attiva proxy
            use_proxy = True
            logging.info(f"🔌 Connection Error - Step 1: Attivazione proxy")
            time.sleep(2)
            return True

        elif count == 2:
            # Step 2: Attesa con proxy
            logging.info(f"🔌 Connection Error - Step 2: Attesa 5s con proxy...")
            time.sleep(5)
            return True

        else:
            # Step 3+: Cambio modello
            old_model = FALLBACK_MODELS[current_model_idx]
            current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
            new_model = FALLBACK_MODELS[current_model_idx]
            logging.info(f"🔌 Connection Error - Step 3: Cambio modello [{old_model}→{new_model}]")
            time.sleep(3)
            return True

    def handle_proxy_error_strategy() -> bool:
        """
        Strategia multi-step per Proxy Error:
        Step 1: Disabilita proxy
        Step 2: Attesa senza proxy
        Step 3+: Cambio modello senza proxy
        """
        nonlocal use_proxy, current_model_idx, error_counters

        error_counters['proxy_error'] += 1
        count = error_counters['proxy_error']

        if count == 1:
            # Step 1: Disabilita proxy
            use_proxy = False
            logging.info(f"🚫 Proxy Error - Step 1: Disabilitazione proxy")
            time.sleep(1)
            return True

        elif count == 2:
            # Step 2: Attesa
            logging.info(f"🚫 Proxy Error - Step 2: Attesa 3s senza proxy...")
            time.sleep(3)
            return True

        else:
            # Step 3+: Cambio modello
            old_model = FALLBACK_MODELS[current_model_idx]
            current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
            new_model = FALLBACK_MODELS[current_model_idx]
            logging.info(f"🚫 Proxy Error - Step 3: Cambio modello [{old_model}→{new_model}]")
            time.sleep(2)
            return True

    # Loop principale
    for attempt in range(MAX_RETRIES):
        try:
            # Prepara headers
            headers = {
                "Authorization": f"Bearer {API_KEYS[current_api_key_idx]}",
                "Content-Type": "application/json"
            }

            if site_url:
                headers["HTTP-Referer"] = site_url
            if site_name:
                headers["X-Title"] = site_name

            # Prepara payload
            data = {
                "model": FALLBACK_MODELS[current_model_idx],
                "messages": [{"role": "user", "content": prompt}]
            }

            # Esegui richiesta
            response = requests.post(
                API_URL,
                headers=headers,
                data=json.dumps(data),
                proxies=PROXY if use_proxy else None,
                timeout=60
            )

            # Successo!
            if response.status_code == 200:
                result = response.json()
                from server.emails_generation.blog_posts import log_ai_interaction
                log_ai_interaction("./logs/ai/ai_log.json", prompt, result)
                output = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

                logging.info(f"✅ Richiesta completata con successo!")
                logging.info(f"   API Key: {current_api_key_idx}, Modello: {FALLBACK_MODELS[current_model_idx]}, Proxy: {use_proxy}")

                return output

            # Gestione errori con strategie multi-step
            elif response.status_code == 400:
                logging.info(f"⚠️ Errore 400: Bad Request. Parametri non validi.")
                return None

            elif response.status_code == 401:
                if not handle_401_strategy():
                    return None
                continue

            elif response.status_code == 403:
                logging.info(f"⚠️ Errore 403: Input moderato. Impossibile procedere.")
                return None

            elif response.status_code == 404:
                old_model = FALLBACK_MODELS[current_model_idx]
                current_model_idx = (current_model_idx + 1) % len(FALLBACK_MODELS)
                new_model = FALLBACK_MODELS[current_model_idx]
                logging.info(f"⚠️ Modello non trovato (404): [{old_model}→{new_model}]")
                continue

            elif response.status_code == 408:
                error_counters[408] += 1
                wait_time = INITIAL_BACKOFF * (2 ** min(error_counters[408], 4))
                logging.info(f"⏱️ Timeout (408) - Attesa {wait_time}s... (Occorrenza {error_counters[408]})")
                time.sleep(wait_time)
                continue

            elif response.status_code == 429:
                handle_429_strategy(attempt)
                continue

            elif response.status_code == 502:
                handle_502_strategy()
                continue

            elif response.status_code == 503:
                handle_503_strategy()
                continue

            else:
                logging.info(f"⚠️ Errore HTTP {response.status_code}: {response.text[:200]}")
                time.sleep(INITIAL_BACKOFF)
                continue

        except requests.exceptions.Timeout:
            handle_timeout_strategy()
            continue

        except requests.exceptions.ProxyError:
            handle_proxy_error_strategy()
            continue

        except requests.exceptions.ConnectionError:
            handle_connection_error_strategy()
            continue

        except requests.exceptions.RequestException as e:
            logging.info(f"⚠️ Errore nella richiesta: {e}")
            time.sleep(INITIAL_BACKOFF)
            continue

        except json.JSONDecodeError as e:
            logging.info(f"⚠️ Errore parsing JSON: {e}")
            continue

        except Exception as e:
            logging.info(f"❌ Errore inaspettato: {e}")
            time.sleep(INITIAL_BACKOFF)
            continue

    logging.info(f"❌ Falliti tutti i {MAX_RETRIES} tentativi.")
    logging.info(f"   Configurazione finale: API Key {current_api_key_idx}, Modello {FALLBACK_MODELS[current_model_idx]}, Proxy {use_proxy}")
    logging.info(f"   Errori per tipo: {error_counters}")
    return None


def ai_chat(prompt: str, format: str = "str", model: str = DEEPSEEK_MODEL,
            site_url: Optional[str] = None, site_name: Optional[str] = None
            ) -> Optional[Union[str, Dict]]:
    want_json = (format is True) or (format == "json")
    provider = os.getenv("AI_PROVIDER", "deepseek").lower()

    text: Optional[str] = None
    if provider != "openrouter":
        try:
            text = _call_deepseek(prompt, want_json)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"DeepSeek failed, falling back to OpenRouter: {e}")
            text = None
    if text is None:
        text = _call_openrouter(prompt, want_json, model=None,
                                site_url=site_url, site_name=site_name)

    if text is None:
        return None
    return parse_json(text) if want_json else text
