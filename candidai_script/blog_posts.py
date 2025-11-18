import re
from bs4 import BeautifulSoup
from bs4 import Tag
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException
import time
from urllib.parse import urljoin
from typing import Optional, List, Tuple, Union, Dict
import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains

import undetected_chromedriver as uc
import json
import time
from selenium.webdriver.common.by import By
from selenium.common.exceptions import WebDriverException
import urllib3

def loginLinkedin(email: str, password: str, cookies_file: str = 'cookies.json'):
    # Avvio browser
    driver = uc.Chrome()
    driver.get('https://www.linkedin.com/login')
    time.sleep(2)  # attesa per caricamento pagina
    
    # Inserimento credenziali
    driver.find_element(By.ID, "username").send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    
    # Clic sul pulsante submit
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    time.sleep(5)  # attesa login completato (da aumentare se serve)
    
    # Salvataggio cookie
    cookies = driver.get_cookies()
    with open(cookies_file, 'w') as file:
        json.dump(cookies, file)
    
    # Chiusura browser
    driver.quit()

driver = None  # istanza globale

def init_driver(force_new=False):
    global driver

    # Se serve forzare un nuovo driver
    if force_new:
        driver_quit_safely()

    # Se non esiste, crealo
    if driver is None:
        logging.info("🟢 Creating new driver")
        options = uc.ChromeOptions()
        options.headless = False
        options.add_argument("--no-sandbox")
        options.add_argument("--use-gl=swiftshader")
        options.add_argument("--disable-dev-shm-usage")

        driver = uc.Chrome(options=options)
        return driver

    # Controllo se il driver è ancora vivo
    try:
        _ = driver.title  # comando leggero
        logging.info("driver fun")
        return driver      # driver funzionante
    except (WebDriverException, urllib3.exceptions.NewConnectionError):
        logging.info("🔴 Driver crashato! Ricreazione...")
        return init_driver(force_new=True)


def driver_quit_safely():
    global driver
    if driver is not None:
        try:
            driver.quit()
        except:
            pass
    driver = None

def get_html(
    url: str, 
    wait_time: int = 1, 
    scroll_pause_time: float = 1.0, 
    max_scrolls: int = 50
) -> str:
    driver = init_driver()  # recupera il driver esistente

    # Se siamo già sulla stessa pagina, restituisci l'HTML corrente
    try:
        current_url = driver.current_url
        if current_url == url:
            logging.info(f"URL già caricato: '{url}', restituisco HTML corrente senza ricaricare.")
            return driver.page_source
    except Exception:
        # Se il driver non ha ancora una current_url valida, continuiamo normalmente
        pass

    logging.info(f"Navigating to URL: '{url}'")
    driver.get(url)
    time.sleep(wait_time)

    # Scroll dinamico
    last_height = driver.execute_script("return document.body.scrollHeight")
    scrolls = 0

    while scrolls < max_scrolls:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(scroll_pause_time)

        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break

        last_height = new_height
        scrolls += 1

    # Torna all'inizio della pagina
    driver.execute_script("window.scrollTo(0, 0);")

    return driver.page_source

def close_driver():
    global driver
    if driver:
        driver.quit()
        driver = None


from pathlib import Path
import json
import os

# Variabile globale per tracciare se un nuovo oggetto è già stato creato in questa sessione
SESSION_OBJECT_CREATED = False

def log_ai_interaction(file_path: str, prompt: str, response: dict):
    """
    Salva in un file JSON il prompt, il messaggio di output e i token usati.
    Aggiunge un nuovo oggetto solo all'inizio di una nuova sessione del programma,
    poi aggiorna quell'oggetto durante la sessione corrente.
    Traccia separatamente i token di input e output con prezzi OpenRouter.
    """
    global SESSION_OBJECT_CREATED
    file = Path(file_path)

    # Carica i dati esistenti o crea una lista vuota
    if file.exists():
        with open(file, "r", encoding="utf-8") as f:
            data_list = json.load(f)
    else:
        data_list = []
    
    # Estrai contenuti e token dalla risposta
    output_text = response["choices"][0]["message"]["content"]
    
    # OpenRouter usage structure
    usage = response.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)
    
    # Prezzi generici OpenRouter (variano per modello)
    # Questi sono prezzi di esempio - dovresti adattarli al modello specifico
    input_cost_per_1m = 0.5    # $0.5 per 1M input tokens (esempio)
    output_cost_per_1m = 1.5   # $1.5 per 1M output tokens (esempio)
    
    # Calcola il costo
    cost = (prompt_tokens / 1000000 * input_cost_per_1m) + (completion_tokens / 1000000 * output_cost_per_1m)
    
    # Se è la prima chiamata in questa sessione, crea un nuovo oggetto
    if not SESSION_OBJECT_CREATED:
        new_data = {
            "input": [prompt],
            "output": [output_text],
            "prompt-tokens": prompt_tokens,
            "completion-tokens": completion_tokens,
            "total-tokens": total_tokens,
            "cost": cost
        }
        data_list.append(new_data)
        SESSION_OBJECT_CREATED = True
    else:
        # Altrimenti, aggiorna l'ultimo oggetto
        current_session = data_list[-1]
        current_session["input"].append(prompt)
        current_session["output"].append(output_text)
        current_session["prompt-tokens"] += prompt_tokens
        current_session["completion-tokens"] += completion_tokens
        current_session["total-tokens"] += total_tokens
        
        # Ricalcola il costo totale con i valori cumulativi
        current_session["cost"] = (current_session["prompt-tokens"] / 1000000 * input_cost_per_1m) + (current_session["completion-tokens"] / 1000000 * output_cost_per_1m)
    
    # Salva la lista aggiornata
    with open(file, "w", encoding="utf-8") as f:
        json.dump(data_list, f, ensure_ascii=False, indent=2)

def ai_chat(
    prompt: str, 
    format: str = "str", 
    model: str = "microsoft/mai-ds-r1:free", 
    site_url: Optional[str] = None, 
    site_name: Optional[str] = None
) -> Optional[Union[str, Dict]]:
    """
    Invia un prompt a OpenRouter API con gestione avanzata degli errori multi-step.
    
    Strategie di resilienza modulari:
    - 429 (Rate Limit): attesa → rotazione API key → cambio modello
    - 401 (Auth): rotazione API key → attesa → cambio modello
    - 502 (Bad Gateway): cambio modello → attesa → proxy
    - 503 (Unavailable): attesa breve → proxy → cambio modello
    - Timeout: retry → proxy → cambio modello
    - Connection Error: proxy → attesa → cambio modello
    """
    
    def parse_json(response: str) -> Any:
        """
        Estrae e fa il parse del primo oggetto JSON ({} o []) trovato nella stringa `response`.
        Restituisce il valore Python corrispondente (dict o list).
        Solleva ValueError se non trova un JSON o se il parsing fallisce.
        """

        if not isinstance(response, str):
            raise TypeError("response deve essere una stringa")

        # normalizza virgolette "curly" in normali
        response = (response
                    .replace("\u201c", '"').replace("\u201d", '"')
                    .replace("\u2018", "'").replace("\u2019", "'"))

        # rimuove eventuali blocchi di codice come ```json\n ... ``` o ```\n ... ```
        response = re.sub(r"```[^\n]*\n?", "", response)
        response = response.replace("```", "")
        # rimuove backtick singoli
        response = response.replace("`", "")

        # rimuove caratteri zero-width/BOM che possono interferire
        response = re.sub(r"[\u200B-\u200D\uFEFF]", "", response)

        # trova il primo {...} o [...] (non-greedy)
        match = re.search(r"(\{.*?\}|\[.*?\])", response, re.DOTALL)
        if not match:
            raise ValueError("Nessun oggetto JSON trovato nella stringa")

        fragment = match.group(0).strip()

        try:
            return json.loads(fragment)
        except json.JSONDecodeError as e:
            # messaggio più informativo per debug
            raise ValueError(f"Parsing JSON fallito per il frammento: {fragment!r}. Errore: {e}") from e

    
    # Pool di API keys
    API_KEYS = os.getenv("OPENROUTER_API_KEYS", "").split(",")
    API_KEYS = [key.strip() for key in API_KEYS if key.strip()]
    
    # Modelli fallback
    FALLBACK_MODELS = [
        "microsoft/mai-ds-r1:free",
        "deepseek/deepseek-r1-0528:free",
        "tngtech/deepseek-r1t2-chimera:free",
        "tngtech/deepseek-r1t-chimera:free",
        "deepseek/deepseek-r1-0528-qwen3-8b:free"
    ]
    
    # Configurazione proxy
    PROXY = {
        "http": "http://6XMm4ayErrcUhUfi:hoSabxA8QKzkEWUi@geo.g-w.info:10443",
        "https": "https://6XMm4ayErrcUhUfi:hoSabxA8QKzkEWUi@geo.g-w.info:10443"
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
        429: 0,  # Rate limit
        401: 0,  # Unauthorized
        502: 0,  # Bad Gateway
        503: 0,  # Service Unavailable
        408: 0,  # Timeout
        'timeout': 0,
        'connection': 0,
        'proxy_error': 0
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
                log_ai_interaction("./candidai_script/ai_log.json", prompt, result)
                output = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                
                logging.info(f"✅ Richiesta completata con successo!")
                logging.info(f"   API Key: {current_api_key_idx}, Modello: {FALLBACK_MODELS[current_model_idx]}, Proxy: {use_proxy}")
                
                if format == "json":
                    return parse_json(output)
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

# 1. Estrai tutti i link dal sorgente HTML
def extract_links(html):
    soup = BeautifulSoup(html, "html.parser")
    links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('http') or href.startswith('/'):
            links.add(href)
    return list(links)

import spacy
nlp = spacy.load("en_core_web_sm")

def find_blog_link(html):
    soup = BeautifulSoup(html, "html.parser")
    candidate_links = []

    blog_keywords = ["blog", "news", "articles", "stories", "insights", "updates"]

    for a in soup.find_all('a', href=True):
        text = (a.text or "").strip()
        href = a['href']
        if not text:
            continue

        doc = nlp(text.lower())
        for token in doc:
            if token.lemma_ in blog_keywords:
                candidate_links.append(href)
                break

    if candidate_links:
        # Restituisce il primo che sembra valido
        return candidate_links[0]

    return None

import requests

def search_on_google(query, exclude_url="", num_results=3):
    """
    Esegue una ricerca su Google Custom Search e restituisce i primi risultati utili.
    """
    api_key = "AIzaSyC4Nn_YIeAPpH3ZTngej9KWR7MJZzYfZSY"
    cx = "a1c899d7f0d0446fd"
    url = (
        f"https://www.googleapis.com/customsearch/v1"
        f"?key={api_key}&cx={cx}&q={query}&num={num_results}"
        f"&hl=en&gl=IE&siteSearch={exclude_url}&siteSearchFilter=e"
    )

    try:
        response = requests.get(url)
        data = response.json()
        return data.get("items", [])[:num_results]
    except Exception as e:
        logging.info(f"Errore nella ricerca Google: {e}")
        return []

import json

def get_blog_links_ranked(company, target_position_description, exclude_link = ""):
    """
    Usa i risultati della ricerca Google e AI per individuare e classificare le homepage 
    dei blog aziendali più rilevanti rispetto alla posizione target dell'utente.
    
    Args:
        company: Nome dell'azienda
        target_position_description: Descrizione della posizione desiderata dall'utente
        exclude_link: Link da escludere dai risultati
        
    Returns:
        Lista di dizionari ordinati per rilevanza, ogni elemento contiene:
        {
            "link": str,
            "title": str,
            "snippet": str,
            "score": int
        }
    """
    
    # --- 1️⃣ Estrai keywords chiave ---
    keywords_prompt = f"""
    Extract 2-5 key topic keywords from this job position description that would be relevant for finding a company blog.
    Focus on the main domain/field (e.g., "engineering", "marketing", "data science", "product design").
    Respond ONLY with a valid JSON array of strings, no explanation.
    
    Example:
    ["engineering", "innovation", "AI research"]
    
    Position description:
    {target_position_description}
    """
    
    try:
        keywords_response = ai_chat(keywords_prompt).strip()
        keywords = json.loads(keywords_response)
        if not isinstance(keywords, list) or not all(isinstance(k, str) for k in keywords):
            raise ValueError("Formato non valido per le keywords.")
    except Exception as e:
        logging.info(f"Errore estrazione keywords: {e}")
        keywords = ["blog"]

    results = []
    found_links = set()

    # --- 🔍 Funzione di ricerca con esclusioni dinamiche ---
    def search_with_exclusions(query, exclude_link, exclude_urls):
        exclude_str = " ".join([f'-{url}' for url in exclude_urls]) if exclude_urls else ""
        full_query = f"{query} {exclude_str} -{exclude_link}".strip()
        return search_on_google(full_query, exclude_link)

    # --- 2️⃣ Ricerca principale combinando tutte le keywords ---
    combined_query = f"{' '.join(keywords)} blog {company}"
    results_raw = search_with_exclusions(combined_query, exclude_link, found_links)

    if results_raw:
        for item in results_raw:
            link = item.get("link", "")
            if link and link not in found_links:
                found_links.add(link)
                results.append({
                    "title": item.get("title", ""),
                    "link": link,
                    "snippet": item.get("snippet", "")
                })
    else:
        logging.info("Nessun risultato trovato per la query principale.")

    # --- 3️⃣ Ricerche per ogni keyword individuale ---
    for word in keywords:
        query = f"{word} blog {company}"
        results_raw = search_with_exclusions(query, exclude_link, found_links)
        if not results_raw:
            continue
        for item in results_raw:
            link = item.get("link", "")
            if link and link not in found_links:
                found_links.add(link)
                results.append({
                    "title": item.get("title", ""),
                    "link": link,
                    "snippet": item.get("snippet", "")
                })

    # --- 4️⃣ Rimuovi duplicati ---
    unique_results = []
    seen_links = set()
    for item in results:
        if item["link"] not in seen_links and item["link"] != exclude_link:
            seen_links.add(item["link"])
            unique_results.append(item)

    if not unique_results:
        logging.info("Nessun risultato complessivo trovato.")
        return []

    results = unique_results

    # --- 5️⃣ Prompt per valutare e classificare tutti i blog ---
    prompt = f"""# Company Blog Homepage Scoring Task

Score each search result based on how likely it is to be the official company blog HOMEPAGE for '{company}'
and how RELEVANT it is to this target position.

**Target Position Description:**
{target_position_description}

## CRITICAL REQUIREMENTS
- ONLY score blog HOMEPAGES (main blog index pages like /blog, /insights, /stories)
- DO NOT score individual blog articles or internal blog posts
- Look for URLs that end with /blog, /insights, /news, or similar homepage patterns
- Avoid URLs with dates, article titles, or specific post paths (e.g., /blog/article-name, /blog/2024/01/post)

## Scoring Criteria (0-100 points)
- **Is it a HOMEPAGE?** (0-40 points)
- **Relevance to Position** (0-40 points)
- **Official Company Blog** (0-20 points)

## Instructions
- Evaluate each result and assign a score from 0 to 100
- Respond ONLY with a valid JSON array with ONLY the scores in order
- Example format: [85, 72, 40, 0]

## Search Results
"""

    for idx, r in enumerate(results, 1):
        prompt += f"\n{idx}. {r['title']}\n   URL: {r['link']}\n   Snippet: {r['snippet']}\n"


    # --- 6️⃣ Chiamata all'AI per ottenere gli score ---
    try:
        scores = ai_chat(prompt, "json")
        
        if not isinstance(scores, list):
            raise ValueError("La risposta non è una lista valida")
            
        # Verifica che tutti siano numeri
        if not all(isinstance(s, (int, float)) for s in scores):
            raise ValueError("La lista deve contenere solo numeri")

    except Exception as e:
        logging.info(f"Errore chiamata AI o parsing JSON: {e}")
        return []

    # --- 7️⃣ Aggiungi gli score ai risultati ---
    scored_results = []
    for i, score in enumerate(scores):
        try:
            if 0 <= i < len(results):
                result = results[i].copy()
                result["score"] = score
                scored_results.append(result)
        except Exception as e:
            logging.info(f"Errore processing score item: {e}")
            continue


    # --- 8️⃣ Ordina per score decrescente ---
    scored_results.sort(key=lambda x: x["score"], reverse=True)

    # --- 9️⃣ Filtra solo i risultati con score > 0 ---
    return [r for r in scored_results if r["score"] > 0]

import requests
from bs4 import BeautifulSoup
import json

def find_relevant_category_link_with_ai(url, target_position_description):
    """
    Usa AI per analizzare l'HTML e trovare il link della categoria più rilevante
    rispetto alla posizione target dell'utente.
    
    Args:
        url (str): L'URL della pagina da analizzare
        target_position_description (str): Descrizione della posizione desiderata dall'utente
        
    Returns:
        str: L'URL della categoria rilevante se trovato, altrimenti None
    """

    def create_prompt(links_json, position_desc):
        formatted_links = "\n".join(f"- text: {item['text']} | href: {item['href']}" for item in links_json)
        return f"""Carefully analyze the links provided below in relation to this target position:

**Target Position Description:**
{position_desc}

**Available Links:**
{formatted_links}

Your task:
Identify with maximum precision the link that leads to the main page or section most relevant to the target position's domain/field.

Instructions:
- Only select the link that points to a **listing page** of multiple posts/articles relevant to the position's field.
- DO NOT select:
  - Single articles.
  - The site's homepage or generic sections.
  - Pages unrelated to the position's domain.
  - Documentation or reference pages.

Hints:
- Consider the position's main domain/field (e.g., marketing, engineering, design, data, product, sales, HR, etc.)
- Look for category names, section titles, or URL patterns that match the position's focus area
- You can infer patterns from the links to make a better choice

Examples of acceptable link texts (depending on the position):
- For Tech roles: "Engineering Blog", "Technology Posts", "Developer Articles"
- For Marketing roles: "Marketing Insights", "Content & Strategy", "Marketing Blog"
- For Design roles: "Design Blog", "UX/UI Articles", "Product Design"
- For Data roles: "Data Science", "Analytics Blog", "Data Insights"
- For Product roles: "Product Blog", "Product Management", "Product Updates"

Response rules:
- Return **only** the correct URL exactly as it appears in the given data.
- If you are unsure or no appropriate link is found, return exactly **"None"** (without quotes).
- Do NOT add explanations, comments, or any extra text.
- The response must be strictly either:
  - A URL in the format "https://example.com/..." if is an absolute url or "/..." if is a relative one.  
  - OR the string "None".

Answer strictly according to these instructions.
"""

    def check_category(link, position_desc):
        link = urljoin(url, link) if link.startswith("/") else link
        logging.info("Checking category link:", link)
        html = get_html(link)
        logging.info("Fetched HTML length:", len(html) if html else "None")
        if html is None:
            return False

        soup = BeautifulSoup(html, 'html.parser')

        # Prendi titolo della pagina
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        description = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
        description = description["content"].strip() if description and "content" in description.attrs else "Missing"

        # Prendi primi 5 H1 e H2
        headings = []
        for tag in soup.find_all(['h1', 'h2']):
            if tag.text.strip():
                headings.append(tag.text.strip())
            if len(headings) >= 5:
                break

        # Prepara i testi da inviare al modello
        texts = "\n".join([h[:50] + "..." if len(h) > 70 else h for h in headings])

        # Prompt per AI
        ai_prompt = f"""
Analyze the following texts extracted from a web page in relation to this target position:

**Target Position Description:**
{position_desc}

**Page Content:**
Title: {title}
Description: {description}
First headings:
{texts}

Your task:
Determine whether this page is a blog section/category page relevant to the target position's domain/field.

Do NOT evaluate individual articles. Focus only on whether the entire page appears to be a general category or section related to the position's area.

Rate the likelihood that this page is a blog category focused on topics relevant to the target position, on a scale from 1 to 10:
- 1 = Definitely not a relevant blog category page
- 10 = Definitely a blog section highly relevant to the position's domain

Consider:
- Does the page content align with the position's field/domain?
- Is it a listing/archive page (not a single article)?
- Are the topics covered relevant to what someone in this position would care about?

IMPORTANT:
- Respond ONLY with a single integer from 1 to 10.
- Do NOT add explanations or any additional text.
"""

        try:
            result = ai_chat(ai_prompt)
            score = int(result.strip())
            logging.info(link, score, texts)
            return score >= 6
        except Exception:
            return False


    if check_category(url, target_position_description):
        return None
        
    html = get_html(url)

    # Estrai tutti i link con il loro testo
    soup = BeautifulSoup(html, "html.parser")
    links = []
    
    for tag_name in ['script', 'noscript', 'head', 'footer']:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    for a in soup.find_all('a', href=True):
        text = (a.text or "").strip()
        href = a['href']
        if text and href and not href.startswith("#"):
            links.append({"text": text, "href": href})

    if not links:
        return None
    
    # Prepara il contesto per AI
    links_json = json.dumps(links, ensure_ascii=False)

    # Invia la richiesta
    try:
        prompt = create_prompt(links_json, target_position_description)
        link = ai_chat(prompt)
        logging.info(len(links), link)
        if not link or link == "None":
            return None
        
        while not check_category(link, target_position_description):
            # Rimuovi il link corrente dalla lista dei link
            links = [l for l in links if l["href"] != link]
            
            # Aggiorna il prompt basandoti sulla nuova lista di link
            prompt = create_prompt(json.dumps(links, ensure_ascii=False), target_position_description)
            
            link = ai_chat(prompt)
            logging.info("no checked", len(links), link)
            if not link or link == "None":
                return None

        return urljoin(url, link) if link.startswith("/") else link
    except Exception as e:
        logging.info(f"Errore durante la chiamata API: {e}")
        return None
    
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

def get_all_blog_pages(start_url, articles_num):
    """
    Recupera tutti gli URL delle pagine di un blog partendo dalla prima pagina
    e verifica la loro validità estraendo gli articoli da ciascuna pagina.
    
    Args:
        start_url (str): URL della prima pagina del blog
    
    Returns:
        list: Lista di tutti gli URL delle pagine valide del blog
    """
    # Lista per memorizzare tutti gli URL validi delle pagine
    valid_pages = [start_url]
    # Lista per memorizzare tutti gli articoli estratti
    all_articles = []
    
    # Estrai articoli dalla prima pagina
    first_page_articles = extract_articles_with_deepseek(start_url, articles_num)
    all_articles.extend(first_page_articles)
    logging.info("first_page_articles", len(first_page_articles), first_page_articles)

    # Se la prima pagina non ha articoli, restituisci solo l'URL iniziale
    if not first_page_articles:
        return []
    
    # Cerca la seconda pagina
    second_page_url = find_next_page(start_url)
    logging.info("second_page_url", second_page_url)

    # Se non è stata trovata una seconda pagina, restituisci solo l'URL iniziale
    if not second_page_url:
        return all_articles
    
    # Verifica la validità della seconda pagina estraendo articoli
    second_page_articles = extract_articles_with_deepseek(second_page_url, len(all_articles) + articles_num)
    logging.info("second_page_articles", len(second_page_articles), second_page_articles)

    # Controlla se la seconda pagina è valida
    if (not second_page_articles or 
        second_page_url == start_url or 
        is_404_error(second_page_url)):
        logging.info(second_page_url == start_url, is_404_error(second_page_url))
        return all_articles
    
    # La seconda pagina è valida, aggiungi alla lista
    valid_pages.append(second_page_url)
    all_articles.extend(second_page_articles)
    
    # Imposta la pagina corrente come la seconda pagina
    current_page_url = second_page_url
    
    # Continua a cercare le pagine successive basandosi sul pattern identificato
    while len(all_articles) < MAX_ARTICLES - articles_num:
        # Usa deepseek per indovinare la prossima pagina basandosi sul pattern tra prima e seconda pagina
        next_page_url = predict_next_page_with_deepseek(start_url, second_page_url, current_page_url)
        logging.info("next_page_url", next_page_url)

        # Se non è stata trovata una pagina successiva, interrompi
        if not next_page_url or next_page_url == current_page_url:
            break
        
        # Verifica la validità della pagina successiva estraendo articoli
        next_page_articles = extract_articles_with_deepseek(next_page_url, len(all_articles) + articles_num)
        logging.info("next_page_articles", len(next_page_articles), next_page_articles)

        # Controlla se la pagina successiva è valida
        if (not next_page_articles or 
            next_page_url == current_page_url or 
            is_404_error(next_page_url)):
            break
        
        # La pagina successiva è valida, aggiungi alla lista
        valid_pages.append(next_page_url)
        all_articles.extend(next_page_articles)
        
        # Aggiorna la pagina corrente
        current_page_url = next_page_url
        
        # Se abbiamo superato il limite di articoli, interrompi
        if len(all_articles) >= 35:
            break
    
    return all_articles

def find_next_page(url):
    """
    Cerca l'URL della pagina successiva a partire dalla pagina corrente.
    
    Args:
        url (str): URL della pagina corrente
    
    Returns:
        str or None: URL della pagina successiva o None se non trovata
    """
    # Ottieni l'HTML della pagina
    html = get_html(url)
    if not html:
        return None
    
    # Analisi con BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    
    next_page_selectors = [
        "a.next", "a.nextpostslink", "a[rel='next']",
        ".pagination a.next", ".nav-links a.next",
        ".pagination-next a", "a.page-numbers.next",
        ".pager-next a", ".next a", "a:contains('Next')",
        "a:contains('Successiva')", "a:contains('Siguiente')",
        "a:contains('Suivant')", "a:contains('Nächste')"
    ]

    for selector in next_page_selectors:
        try:
            next_link = soup.select_one(selector)
            if next_link and next_link.get('href'):
                href = urljoin(url, next_link.get('href'))
                text = next_link.get_text(strip=True)

                prompt = (
                    "You are analyzing a blog structure. I found a hyperlink with the following text and URL:\n\n"
                    f"Text: \"{text}\"\n"
                    f"URL: {href}\n\n"
                    "Does this link most likely point to the next page of blog posts, rather than to a single article or unrelated content? "
                    "Reply only with 'yes' or 'no'."
                )

                response = ai_chat(prompt).strip().lower()
                if response == "yes":
                    return href
        except:
            continue
    
    # Elabora la frase di riferimento "page 2"
    reference_doc = nlp("page 2")

    # Lista per memorizzare i link che soddisfano i criteri
    all_links = []

    # Cerca tutti i link nella pagina
    for link in soup.find_all('a', href=True):
        href = link.get('href')
        text = link.get_text(strip=True)
        
        # Se il testo è più corto di 15 caratteri, aggiungi direttamente
        if href and len(text) < 15 and len(text) > 0:
            all_links.append({
                "href": href,
                "text": text[:50] if text else ""
            })
        
        # Per i link con testo vuoto, analizza l'href per vedere se contiene riferimenti a paginazione
        elif href and text == "":
            # Estrai solo la parte finale dell'URL (dopo l'ultimo /)
            url_parts = href.split('/')
            url_end = url_parts[-1] if url_parts else ""
            
            # Controlla anche i parametri dell'URL
            if '?' in href:
                query_part = href.split('?')[1]
                # Sostituisci i '&' con spazi per poter analizzare i parametri separatamente
                query_part = query_part.replace('&', ' ').replace('=', ' ')
                url_end = url_end + " " + query_part
                
            # Pulisci l'URL end per l'analisi
            url_end = url_end.replace('-', ' ').replace('_', ' ').replace('.html', '').replace('.php', '')
            
            # Se l'URL end è vuoto o troppo breve, salta questo link
            if len(url_end) < 2:
                continue
                
            # Elabora l'URL con spaCy
            url_doc = nlp(url_end)
            
            # Calcola la similarità con "page 2"
            similarity = url_doc.similarity(reference_doc)
            
            # Se la similarità è > 0.4, includi il link
            if similarity > 0.4:
                all_links.append({
                    "href": href,
                    "text": "",
                })
                
    # Tentativo finale con AI + click su link javascript (se presente)
    if all_links:
        links_representation = "\n".join([
            f"{i+1}): '{link['href'].replace('https://', '').replace('http://', '').replace('www.', '')}' -> '{link['text']}'"
            for i, link in enumerate(all_links)
        ])

        ai_response = ai_chat(
            f"""Find the ONE most likely "next page" link from this blog at {url}.
TASK:
Identify the single link that would take a user to the next page of blog posts.
COMMON INDICATORS:
- Link text: 'Next', 'Next Page', '→', 'Older Posts', or sequential numbers (1, 2, etc.)
- URL patterns: '/page/2', '?page=2', '/paged/2', etc.
- JavaScript functions: If the link is a JavaScript function, include it as well
LINKS TO ANALYZE:
{links_representation}
RESPONSE FORMAT:
Return ONLY the INDEX NUMBER of the link (e.g., 1, 2, 3, etc.) without any explanation.
If no "next page" link is found, return '0'.
"""
        ).strip()

        logging.info(ai_response, links_representation)

        if ai_response and ai_response != "0":
            try:
                # Converti la risposta in un intero e sottrai 1 per ottenere l'indice corretto
                # (poiché gli indici nel prompt iniziano da 1, ma in Python iniziano da 0)
                index = int(ai_response) - 1
                if 0 <= index < len(all_links):
                    href = all_links[index]['href']
                else:
                    # Gestisci il caso in cui l'indice sia fuori range
                    href = None
            except ValueError:
                # Gestisci il caso in cui la risposta non sia un numero valido
                href = None
            
            if not href:
                return
            
            if href.startswith("javascript:"):
                # Simula click sul link JavaScript per rilevare la nuova URL
                options = uc.ChromeOptions()
                options.headless = False  # Puoi mettere True per non vedere il browser

                driver = init_driver()
                try:
                    logging.info(f"Navigating to URL: '{url}'")
                    driver.get(url)
                    time.sleep(2)
                    # Trova il link specifico da cliccare
                    link_to_click = driver.find_elements(By.XPATH, f"//a[@href=\"{href}\"]")
                    if link_to_click:
                        prev_url = driver.current_url
                        # Estrai la funzione JS da href
                        href_value = link_to_click[0].get_attribute("href")
                        if href_value.startswith("javascript:"):
                            js_code = href_value[len("javascript:"):].strip()
                            driver.execute_script(js_code)

                        time.sleep(2)
                        new_url = driver.current_url
                        if new_url != prev_url:
                            return new_url
                finally:
                    logging.info("Closing the browser...")
            else:
                # Se è un link normale, risolvi normalmente
                return urljoin(url, href)

    # Se ancora non trova, prova con pattern comuni di URL
    #page_number = extract_page_number(url)
    #if page_number:
    #    next_page_number = page_number + 1
    #    return construct_paginated_url(url, next_page_number)
    
    # Prova ad aggiungere '/page/2' o '?page=2' all'URL base
    #if '?' in url:
    #    return f"{url}&page=2"
    #else:
    #    # Controlla se terminare con / o no
    #    if url.endswith('/'):
    #        return f"{url}page/2/"
    #    else:
    #        return f"{url}/page/2/"

def predict_next_page_with_deepseek(first_url, second_url, current_url):
    """
    Usa deepseek_chat per prevedere l'URL della prossima pagina basandosi sul pattern.
    
    Args:
        first_url (str): URL della prima pagina
        second_url (str): URL della seconda pagina
        current_url (str): URL della pagina corrente
    
    Returns:
        str or None: URL della prossima pagina o None se non rilevato
    """
    # Identifica il pattern tra prima e seconda pagina
    ai_response = ai_chat(
        f"""Predict the next page URL based on this pattern:

Task: Analyze the pattern between these URLs and predict the next page URL that follows this pattern.
Common pagination patterns include:
- Incrementing numbers in the URL path: /page/1 → /page/2 → /page/3
- Incrementing query parameters: ?page=1 → ?page=2 → ?page=3
- Changing date patterns: /2023/01 → /2023/02 → /2023/03

Return ONLY the complete URL of the next page. No explanations.

Links:
First page URL: {first_url}
Second page URL: {second_url}
Current page URL: {current_url}"""
    )
    
    # Pulisci la risposta e restituisci l'URL
    if ai_response and ai_response.strip():
        return ai_response.strip()
    
    return None

def is_404_error(url):
    """
    Verifica in modo robusto se un URL restituisce un errore 404.
    Utilizza metodi multipli per ridurre i falsi positivi.
    
    Args:
        url (str): URL da verificare
    
    Returns:
        bool: True se è un errore 404, False altrimenti
    """
    try:
        html = get_html(url)
        
        # Se non riesce a ottenere l'HTML, considera un 404
        if not html:
            return True
        
        # Analisi con BeautifulSoup per estrarre solo il testo visibile
        soup = BeautifulSoup(html, 'html.parser')
        
        # 1. Controlla il titolo della pagina
        if soup.title:
            title_text = soup.title.get_text().lower()
            title_404_indicators = [
                "404", "not found", "page not found", "error", 
                "non trovata", "no se encontró", "não encontrada", 
                "nicht gefunden", "pagina non trovata", "error 404"
            ]
            if any(indicator in title_text for indicator in title_404_indicators):
                return True
        
        # 2. Controlla meta tag per indicazioni di errore
        for meta in soup.find_all('meta'):
            if meta.get('name') == 'description' or meta.get('name') == 'keywords':
                meta_content = meta.get('content', '').lower()
                if "404" in meta_content or "not found" in meta_content:
                    return True
        
        # 3. Estrai solo il testo visibile principale e cerca indicatori di 404
        main_text = ' '.join([
            p.get_text().lower() for p in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'div'])
        ])
        
        # Frasi comuni che indicano pagina 404 (in varie lingue)
        error_phrases = [
            "page not found", "404 error", "page doesn't exist", 
            "page no longer exists", "couldn't be found", "cannot be found",
            "we can't find", "pagina non trovata", "página no encontrada",
            "seite nicht gefunden", "page non trouvée", "pagina non esiste",
            "couldn't find the page", "page you're looking for doesn't exist",
            "error 404", "404 not found", "la pagina richiesta non esiste",
            "la pagina che stai cercando non esiste", "oops! that page can't be found"
        ]
        
        for phrase in error_phrases:
            if phrase in main_text:
                return True
        
        # 4. Cerca elementi HTML con classi o id che indicano errore 404
        error_classes_ids = [
            "error-404", "error404", "e404", "404", "not-found", "notfound",
            "page-not-found", "page-404", "error-page", "page-error"
        ]
        
        for indicator in error_classes_ids:
            if (soup.find(id=indicator) or 
                soup.find(class_=indicator) or
                soup.find(id=lambda x: x and indicator in x) or 
                soup.find(class_=lambda x: x and indicator in x)):
                # Verifica che sia in un elemento di contenuto principale,
                # non in footer, header o nav per evitare falsi positivi
                container = soup.find(id=indicator) or soup.find(class_=indicator)
                if container and not container.find_parent(['header', 'footer', 'nav']):
                    return True
        
        # 5. Verifica se la pagina ha contenuti sostanziali
        # Se la pagina ha pochissimo testo, potrebbe essere una pagina di errore minimalista
        article_content = soup.find_all(['article', 'main', '.content', '.post', '.entry'])
        if not article_content:
            # Cerca elementi comuni di contenuto blog
            blog_elements = soup.find_all(['h1', 'h2', 'article', '.post', '.entry'])
            if len(blog_elements) < 2:
                # Nessun contenuto significativo trovato, verifica ulteriormente
                # con la lunghezza del testo visibile
                visible_text = ' '.join([
                    p.get_text() for p in soup.find_all('p')
                ])
                if len(visible_text.strip()) < 100:  # Meno di 100 caratteri di testo
                    # Potrebbe essere una pagina di errore minimalista
                    return True
        
        # Se ha superato tutti i controlli, probabilmente non è una pagina 404
        return False
    
    except Exception as e:
        # In caso di errore nel processo, prudentemente supponi che sia un 404
        return True
    
def find_pagination_links(soup, current_url, base_url):
    """
    Cerca i link di paginazione in una pagina HTML.
    
    Args:
        soup (BeautifulSoup): Oggetto BeautifulSoup della pagina
        current_url (str): URL corrente
        base_url (str): URL base del sito
    
    Returns:
        list: Lista di URL delle pagine di paginazione
    """
    pagination_links = []
    
    # Approccio 1: Cerca elementi con classi comuni di paginazione
    pagination_selectors = [
        ".pagination a", "nav.pagination a", ".pager a", ".page-numbers",
        "a.page-link", ".nextpostslink", ".previouspostslink", "a.next", 
        "a.prev", "a[rel='next']", "a[rel='prev']", ".wp-pagenavi a",
        ".paginate a", ".navigation a", ".post-nav a", ".blog-pagination a",
        "a.page", ".pager-older a", ".pager-newer a", ".pages a",
        ".nav-links a", ".pagination-next", ".pagination-prev"
    ]
    
    for selector in pagination_selectors:
        try:
            elements = soup.select(selector)
            for element in elements:
                href = element.get('href')
                if href:
                    # Converti URL relativi in assoluti
                    absolute_url = urljoin(current_url, href)
                    if is_valid_pagination_url(absolute_url, current_url):
                        pagination_links.append(absolute_url)
        except:
            continue
    
    # Approccio 2: Cerca pattern numerici di paginazione
    current_page_number = extract_page_number(current_url)
    if current_page_number:
        # Cerca link con numeri di pagina vicini
        for i in range(current_page_number - 5, current_page_number + 6):
            if i > 0 and i != current_page_number:
                potential_url = construct_paginated_url(current_url, i)
                if potential_url and potential_url not in pagination_links:
                    pagination_links.append(potential_url)
    
    # Approccio 3: Cerca parole chiave come "page", "paged", "p=" nei link
    all_links = soup.find_all('a', href=True)
    for link in all_links:
        href = link.get('href')
        if href and any(pattern in href for pattern in ['/page/', '?page=', '&page=', 'paged=', '/p/', '?p=']):
            absolute_url = urljoin(current_url, href)
            if is_valid_pagination_url(absolute_url, current_url):
                pagination_links.append(absolute_url)
    
    return pagination_links

def is_valid_pagination_url(url, current_url):
    """
    Verifica se un URL è un valido link di paginazione.
    
    Args:
        url (str): URL da verificare
        current_url (str): URL corrente
    
    Returns:
        bool: True se l'URL è valido, False altrimenti
    """
    # Controlli di base
    if not url or url == current_url or url.endswith(('.jpg', '.jpeg', '.png', '.gif', '.pdf')):
        return False
    
    # Verifica che l'URL sia dello stesso dominio
    current_domain = urlparse(current_url).netloc
    url_domain = urlparse(url).netloc
    if current_domain != url_domain:
        return False
    
    # Evita URL di tag, categorie o archivi se possibile
    low_priority_patterns = ['/tag/', '/category/', '/author/', '/search/', '/feed/', '/comment-']
    if any(pattern in url for pattern in low_priority_patterns):
        return False
    
    return True

def extract_page_number(url):
    """
    Estrae il numero di pagina da un URL.
    
    Args:
        url (str): URL da cui estrarre il numero di pagina
    
    Returns:
        int or None: Numero di pagina o None se non trovato
    """
    # Pattern comuni per i numeri di pagina negli URL
    patterns = [
        r'/page/(\d+)', r'page=(\d+)', r'paged=(\d+)', 
        r'/p/(\d+)', r'p=(\d+)', r'/page-(\d+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            try:
                return int(match.group(1))
            except:
                pass
    
    return None

def construct_paginated_url(url, page_number):
    """
    Costruisce un URL di paginazione per un dato numero di pagina.
    
    Args:
        url (str): URL di base
        page_number (int): Numero di pagina
    
    Returns:
        str or None: URL costruito o None se non possibile
    """
    # Cerca pattern di paginazione
    patterns = [
        (r'/page/\d+', f'/page/{page_number}'),
        (r'page=\d+', f'page={page_number}'),
        (r'paged=\d+', f'paged={page_number}'),
        (r'/p/\d+', f'/p/{page_number}'),
        (r'p=\d+', f'p={page_number}'),
        (r'/page-\d+', f'/page-{page_number}')
    ]
    
    for pattern, replacement in patterns:
        if re.search(pattern, url):
            return re.sub(pattern, replacement, url)
    
    # Se non trova pattern, cerca di aggiungere il parametro alla querystring
    if '?' in url:
        return f"{url}&page={page_number}"
    else:
        # Controlla se terminare con / o no
        if url.endswith('/'):
            return f"{url}page/{page_number}/"
        else:
            return f"{url}/page/{page_number}/"
        
# 4. Estrai link agli articoli analizzando semanticamente
import requests
from bs4 import BeautifulSoup
import json
import time
from urllib.parse import urljoin

# Variabile globale per tenere traccia dei link già visti
SEEN_LINKS = set()

def extract_articles_with_deepseek(base_url, articles_num, html=None, batch_size=7):
    """
    Estrae articoli (link e titoli) da una pagina blog utilizzando DeepSeek per la classificazione.
    
    Args:
        base_url: URL base per convertire link relativi in assoluti
        batch_size: Numero di link da valutare per richiesta
        
    Returns:
        lista di dict {"href": url, "title": title} degli articoli identificati
    """

    # Analizza l'HTML
    soup = BeautifulSoup(get_html(base_url) if not html else html, "html.parser")

    # Isola solo il contenuto del <body>
    body = soup.body
    if body:
        soup = BeautifulSoup(str(body), "html.parser")

    # Rimuovi tag indesiderati
    for tag in soup(["script", "noscript", "style", "header", "footer", "nav", "aside", "form"]):
        tag.decompose()

    # Trova tutti i tag article
    articles = soup.find_all('article')
    
    # Verifica se ci sono almeno 3 article
    if len(articles) >= 3:
        logging.info(f"Trovati {len(articles)} tag article nella pagina")
        
        article_links = []
        
        # Per ciascun article, estrai il link e il titolo dell'articolo
        for i, article in enumerate(articles):
            link_info = None
            
            # Cerca un heading all'interno dell'article per il titolo
            title = None
            for tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                h_tag = article.find(tag)
                if h_tag:
                    title = h_tag.text.strip()
                    break
            
            # Se non trova un heading, usa il primo testo significativo nell'article
            if not title or not title.strip():
                # Prova a trovare un testo significativo nell'articolo
                paragraphs = article.find_all('p')
                if paragraphs:
                    title = paragraphs[0].text.strip()
                else:
                    # Se non ci sono paragrafi, prendi il testo diretto dell'articolo
                    title = article.text.strip()
            
            # Limita il titolo a una lunghezza ragionevole
            title = title[:100].strip() + ("..." if len(title) > 100 else "") if title else "Titolo non trovato"
            
            # Verifica se l'article è figlio di un link
            parent_link = article.find_parent('a')
            if parent_link and parent_link.has_attr('href'):
                # L'article è contenuto all'interno di un link
                link_info = {
                    'href': parent_link['href'],
                    'title': title,
                }
            else:
                # L'article non è figlio di un link, cerca link all'interno
                links = article.find_all('a', href=True)
                
                if links:
                    # Prendi il primo link significativo 
                    # (generalmente il primo link è quello che punta all'articolo completo)
                    link = links[0]
                    
                    link_info = {
                        'href': urljoin(base_url, link['href']) if link['href'].startswith("/") else link['href'],
                        'title': title,
                    }
            
            # Aggiunge l'informazione del link alla lista, se trovato
            if link_info:
                article_links.append(link_info)
        
        # Stampa i risultati
        for link_info in article_links:
            logging.info(f"Article {link_info['title']} -> {link_info['href']}")
        
        if len(article_links) > len(articles) / 2:
            return article_links
    
    # Estrai tutti i link con testo
    link_candidates = []
    for a in soup.find_all('a', href=True):
        heading_text = None
        
        # Cerca i tag heading in ordine di importanza
        for tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            heading = a.find(tag)
            if heading:
                heading_text = heading.text.strip()
                break
        
        # Se non è stato trovato alcun heading, usa il testo del link
        raw_text = heading_text if heading_text else (a.text or "").strip()
        
        # Limita a 100 caratteri escludendo gli spazi
        chars_count = 0
        limited_text = ""
        
        for char in raw_text:
            if char != ' ':
                chars_count += 1
            
            limited_text += char
            
            if chars_count == 75:
                limited_text = limited_text.strip() + "..."
                break
        
        text = limited_text.strip()
        href = a['href']
        
        if text and len(text) > 15:
            # Conta il numero di parole nel testo
            word_count = len(text.split())
            
            # Includi solo i link con almeno 3 parole nel testo
            if word_count >= 3:
                # Converti link relativi in assoluti
                full_url = urljoin(base_url, href)
                link_candidates.append({"title": text, "href": full_url})
    
    # Rimuovi duplicati (stessa URL)
    seen_in_page = set()
    unique_links = []
    for link in link_candidates:
        if link["href"] not in seen_in_page:
            seen_in_page.add(link["href"])
            unique_links.append(link)
    
    # Filtra i link già analizzati in passato
    new_links = [link for link in unique_links if link["href"] not in SEEN_LINKS]

    if not new_links:
        return []

    # Dividi i link in batch
    batches = [new_links[i:i+batch_size] for i in range(0, len(new_links), batch_size)]
    
    # Array per salvare gli articoli
    articles = []

    # Elabora ogni batch
    for batch in batches:
        if len(articles) + articles_num > MAX_ARTICLES:
            break
        # Costruisci il prompt
        batch_json = json.dumps(batch, ensure_ascii=False)
        
        # Invia la richiesta
        try:
            formatted_string = "[\n" + ",\n".join([
                f"{item['href'].replace('https://', '').replace('http://', '').replace('wwww.', '')} | {item['title']}"
                for item in batch
            ]) + "\n]"
            response_text = ai_chat(f"""Rate these links as potential blog articles from 1-10:
For each link, rate on a scale of 1-10:
- 1-4: Not an article (navigation, category page, author page)
- 5-7: Possibly an article
- 8-10: Definitely an article

Consider both the title text and URL structure.
Respond ONLY with a JSON array of integers. Example: [9, 2, 7, 3, 10, 8, 7]
Remember: the task is to evaluate blog article links, not blog homepage links or specific sections of the blog or other sections.

Data:
{formatted_string}
""")
            # Pulisci la risposta per assicurarsi che sia un array JSON valido
            if not response_text.startswith('['):
                start_idx = response_text.find('[')
                if start_idx != -1:
                    response_text = response_text[start_idx:]
            
            if not response_text.endswith(']'):
                end_idx = response_text.rfind(']')
                if end_idx != -1:
                    response_text = response_text[:end_idx+1]
            
            # Converti la risposta in array di punteggi
            scores = json.loads(response_text)
            
            # Verifica che l'array abbia la stessa lunghezza del batch
            if len(scores) == len(batch):
                # Aggiungi all'elenco degli articoli quelli con punteggio > 5
                for i, score in enumerate(scores):
                    if score >= 6:
                        logging.info("score", score, batch[i]["title"])
                        articles.append({
                            "href": batch[i]["href"],
                            "title": batch[i]["title"]
                        })
            else:
                logging.info(f"Lunghezza risposta non corrisponde al batch: {len(scores)} vs {len(batch)}")
        except json.JSONDecodeError:
            logging.info(f"Errore nella decodifica della risposta JSON: {response_text}")
    
        # Pausa tra richieste per evitare limiti di rate
        time.sleep(0.5)
    
    # Aggiungi tutti i nuovi link visti alla variabile globale
    for link in new_links:
        SEEN_LINKS.add(link["href"])
    
    return articles

import os
import json

def save_articles_to_file(articles, filename="articles.json", folder="output"):
    """
    Salva gli articoli in un file JSON formattato in una sottocartella.
    
    Args:
        articles: Lista di dizionari con href e title
        folder: Nome della sottocartella
        filename: Nome del file da salvare
    """
    try:
        # Verifica se esiste già un file con lo stesso nome della cartella
        if os.path.isfile(folder):
            logging.info(f"ERRORE: '{folder}' esiste già come file. Specificare un altro nome per la cartella.")
            return False
        
        # Crea la sottocartella se non esiste
        try:
            os.makedirs(folder, exist_ok=True)
        except FileExistsError:
            logging.info(f"AVVISO: Non è possibile creare la cartella '{folder}' perché esiste già un file con lo stesso nome.")
            # Usa un nome alternativo aggiungendo un numero
            i = 1
            while os.path.exists(f"{folder}_{i}"):
                i += 1
            folder = f"{folder}_{i}"
            logging.info(f"Utilizzo della cartella alternativa: '{folder}'")
            os.makedirs(folder, exist_ok=True)
        
        # Costruisci il percorso completo
        file_path = os.path.join(folder, filename)
        
        # Salva il file
        with open(file_path, 'w', encoding='utf-8') as f:
            # Utilizzo indent=2 e sort_keys=True per una formattazione leggibile
            json.dump(articles, f, ensure_ascii=False, indent=2, sort_keys=True)
        
        logging.info(f"File salvato correttamente in: {file_path}")
        return True
    except Exception as e:
        logging.info(f"Errore durante il salvataggio del file: {e}")
        return False
import time
import undetected_chromedriver as uc
from bs4 import BeautifulSoup
from urllib.parse import urljoin

def get_articles_with_load_more(start_url, articles_num, max_clicks=5):
    """
    Recupera articoli da pagine con caricamento dinamico tramite pulsanti "Load More".
    Clicca sul pulsante fino a quando non ci sono più articoli o fino a raggiungere il limite.
    
    Args:
        start_url (str): URL della pagina iniziale
        max_clicks (int): Numero massimo di clic sul pulsante (default 5)
    
    Returns:
        list: Lista di tutti gli articoli recuperati
        list: Lista degli URL visitati
    """
    
    all_articles = []
    visited_urls = [start_url]
    current_url = start_url
    
    try:
        # Inizializza il driver
        driver = init_driver()
        
        # Carica la pagina iniziale
        driver.get(start_url)
        time.sleep(1)  # Aspetta il caricamento iniziale
        logging.info("started")

        # Trova e premi il pulsante "Load More" fino a raggiungere il limite
        clicks = 0
        first = True

        while clicks < max_clicks and len(all_articles) + articles_num < MAX_ARTICLES:
            # Estrai articoli dalla pagina corrente, escludendo quelli già trovati
            page_source = driver.page_source
            new_articles = extract_articles_with_deepseek(current_url, len(all_articles) + articles_num, page_source)
            logging.info("new_articles", len(new_articles), new_articles)

            # Se non ci sono nuovi articoli, interrompi
            if not new_articles and not first:
                break
            first = False

            # Aggiungi i nuovi articoli alla lista
            all_articles.extend(new_articles)
            
            # Se abbiamo raggiunto il limite di articoli, interrompi
            if len(all_articles) + articles_num >= MAX_ARTICLES:
                break
            
            # Cerca pulsante "Load More" 
            load_more_button = find_load_more_button(driver)
            logging.info("load_more_button", load_more_button)
            
            # Se non trova un pulsante, interrompi
            if not load_more_button:
                break
            
            # Clicca sul pulsante e attendi il caricamento di nuovi contenuti
            try:                
                try_close_overlays(driver)
                load_more_button = find_load_more_button(driver)
                try:
                    logging.info("b", load_more_button.tag_name, load_more_button.text)

                    # Scrolla fino al pulsante per assicurarsi che sia visibile
                    driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", load_more_button)
                    time.sleep(1)
                    
                    # Clicca sul pulsante
                    load_more_button.click()
                except StaleElementReferenceException:
                    load_more_button = find_load_more_button(driver)
                    logging.info("b", load_more_button.tag_name, load_more_button.text)

                    # Scrolla fino al pulsante per assicurarsi che sia visibile
                    driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", load_more_button)
                    time.sleep(1)
                    
                    # Clicca sul pulsante
                    load_more_button.click()
                
                # Attendi che nuovi contenuti vengano caricati
                time.sleep(3)
                
                # Aggiorna il contatore dei clic
                clicks += 1
                
                # Memorizza l'URL corrente se è cambiato
                if driver.current_url != current_url:
                    current_url = driver.current_url
                    visited_urls.append(current_url)
                
            except Exception as e:
                logging.info(f"Errore nel cliccare il pulsante: {e}")
                # Prova un approccio alternativo con JavaScript
                try:
                    driver.execute_script("arguments[0].click();", load_more_button)
                    time.sleep(3)
                    clicks += 1
                except:
                    # Se entrambi i tentativi falliscono, interrompi
                    break
        
        # Recupera gli ultimi articoli dopo aver terminato i clic
        final_articles = extract_articles_with_deepseek(driver.current_url, len(all_articles) + articles_num)
        all_articles.extend(final_articles)
                
        return all_articles
        
    except Exception as e:
        logging.info(f"Errore durante il recupero degli articoli: {e}")
        return all_articles
        
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, ElementNotInteractableException

def try_close_overlays(driver, similarity_threshold=0.40):
    """
    Rileva e chiude overlay/popup usando sentence embeddings.
    Identifica semanticamente i pulsanti per chiudere o accettare.
    """

    close_keywords = [
        "accept", "agree", "ok", "got it", "close", "dismiss", "allow",
        "chiudi", "accetta", "va bene", "continua", "consenti"
    ]

    # Pre-calcolo embedding keyword
    kw_embeds = embedder.encode(close_keywords, convert_to_tensor=True)

    overlay_xpaths = [
        '//div[@role="dialog" or contains(@class, "cookie") or contains(@class, "consent") or contains(@class, "overlay") or contains(@class, "modal")]'
    ]

    for xpath in overlay_xpaths:
        overlays = driver.find_elements(By.XPATH, xpath)

        for overlay in overlays:
            logging.info("Found overlay:", overlay)
            if not overlay.is_displayed():
                continue

            size = overlay.size
            if size["width"] < 100 or size["height"] < 50:
                continue

            try:
                # Prima i button, poi gli <a>
                elements = overlay.find_elements(By.XPATH, ".//button") + \
                           overlay.find_elements(By.XPATH, ".//a")
                logging.info(elements)
                for el in elements:
                    if not el.is_displayed() or not el.is_enabled():
                        continue

                    text = el.text.strip().lower()
                    logging.info("Overlay button text:", text)
                    if not text or len(text) > 60:
                        continue

                    # Embedding pulsante
                    el_embed = embedder.encode(text, convert_to_tensor=True)

                    # Similarità con tutte le keyword
                    sims = util.cos_sim(el_embed, kw_embeds)[0].cpu().tolist()
                    logging.info(sims)
                    best_sim = max(sims)

                    # Debug (se vuoi)
                    # logging.info(f"[DEBUG] '{text}' sim={best_sim:.3f}")

                    if best_sim >= similarity_threshold:
                        try:
                            el.click()
                            time.sleep(2)
                            return True
                        except:
                            continue

            except Exception:
                continue

    return False

from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from sentence_transformers import SentenceTransformer, util
from sklearn.metrics.pairwise import cosine_similarity

# Inizializza il modello di embedding
embedder = SentenceTransformer("all-MiniLM-L6-v2")

def find_load_more_button(driver: WebDriver) -> Optional[WebElement]:
    """
    Trova il pulsante "Load More" in una pagina web.

    Args:
        driver: Istanza del driver Selenium.

    Returns:
        WebElement or None: Il pulsante "Load More" o None se non trovato.
    """

    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")

    # Trova tutti i bottoni e link
    from collections import defaultdict
    elements = driver.find_elements("xpath", "//button|//a")

    elements_info: List[Tuple[WebElement, str, float]] = []

    # Frase target da confrontare semanticamente
    target_text = "load more"
    target_embedding = embedder.encode([target_text])[0]

    texts = []
    corresponding_elements = []

    # Dizionario per tenere traccia di quali elementi contengono quali testi
    text_elements_map = defaultdict(list)
    element_parents = {}

    # Prima passata: raccogli tutti gli elementi con il loro testo
    for el in elements:
        try:
            text = el.text.strip()
            if not text:
                continue
            
            # Memorizza l'elemento associato a questo testo
            text_elements_map[text].append(el)
            
            # Per ogni elemento, raccogliamo anche il suo elemento padre se disponibile
            try:
                parent = driver.execute_script("return arguments[0].parentNode;", el)
                element_parents[el] = parent
            except:
                element_parents[el] = None
                
        except Exception:
            continue

    # Risultati finali
    texts = []
    corresponding_elements = []

    # Seconda passata: filtra gli elementi duplicati in base alla relazione padre-figlio
    for text, elements_with_text in text_elements_map.items():
        if len(elements_with_text) > 1:
            # Abbiamo elementi multipli con lo stesso testo
            # Verifichiamo se alcuni sono genitori di altri
            children_to_keep = []
            
            for el in elements_with_text:
                is_parent_of_another = False
                
                # Controlla se questo elemento è genitore di un altro nella lista
                for other_el in elements_with_text:
                    if el != other_el:
                        # Verifica se el è un antenato di other_el
                        current = other_el
                        while current in element_parents and element_parents[current]:
                            if element_parents[current] == el:
                                is_parent_of_another = True
                                break
                            current = element_parents[current]
                        
                        if is_parent_of_another:
                            break
                
                # Se non è genitore di nessun altro, lo teniamo
                if not is_parent_of_another:
                    children_to_keep.append(el)
            
            # Aggiungi solo gli elementi figli
            if children_to_keep:
                for el in children_to_keep:
                    texts.append(text)
                    corresponding_elements.append(el)
        else:
            # Se c'è solo un elemento con questo testo, lo aggiungiamo direttamente
            texts.append(text)
            corresponding_elements.append(elements_with_text[0])

    if not texts:
        return None

    # Calcola tutti gli embedding in batch
    embeddings = embedder.encode(texts)
    similarities = cosine_similarity([target_embedding], embeddings)[0]
    
    # Seleziona candidati sopra una soglia
    threshold = 0.4
    candidates = [
        (corresponding_elements[i], texts[i], similarities[i])
        for i in range(len(texts)) if similarities[i] > threshold
    ]
    for element, text, similarity in candidates:
        tag_name = element.tag_name  # Ottiene il nome del tag per WebElement
        logging.info(f"Tag: {tag_name}, Testo: {text}, Similarità: {similarity}")
    
    if len(candidates) != 1:
        # Ordina per similarità decrescente
        candidates.sort(key=lambda x: -x[2])
        if not candidates:
            return None
        
        # Crea la lista numerata per l'AI
        candidate_list = "\n".join([f"{i+1}. {text}" for i, (_, text, _) in enumerate(candidates)])
        
        # Prompt per DeepSeek
        prompt = (
            "Context:\n"
            "I am analyzing the structure of a blog page. My goal is to identify the button or link "
            "most likely responsible for loading additional blog posts (e.g., 'Load more', 'View more', etc).\n\n"
            "Task:\n"
            "Below is a numbered list of button or link texts extracted from the page:\n"
            + candidate_list
            + "\n\n"
            "Question:\n"
            "Based on their meaning, which of these texts most likely corresponds to a button or link that loads or displays more blog articles?\n"
            "Please reply ONLY with the NUMBER of the most relevant item (e.g. 1, 2, 3, etc.)."
        )
        
        chosen_index_str = ai_chat(prompt).strip()
        
        # Converte la risposta in un indice (gestendo eventuali errori)
        try:
            chosen_index = int(chosen_index_str) - 1  # Converti in indice base-0
            if 0 <= chosen_index < len(candidates):
                return candidates[chosen_index][0]  # Restituisci l'elemento all'indice scelto
            else:
                # Se l'indice è fuori range, prendi il primo candidato
                return candidates[0][0]
        except ValueError:
            # Se la risposta non è un numero valido, prendi il primo candidato
            return candidates[0][0]
    else:
        return candidates[0][0]

    return None


def is_valid_interactive_element(driver, element):
    """
    Verifica se un elemento è valido e interattivo (visibile, abilitato e cliccabile).
    
    Args:
        driver: Istanza del driver Selenium
        element: WebElement da verificare
        
    Returns:
        bool: True se l'elemento è valido e interattivo, False altrimenti
    """
    try:
        # Verifica se l'elemento è ancora presente nel DOM
        WebDriverWait(driver, 0.5).until(
            EC.staleness_of(element)
        )
        return False  # Elemento non più presente
    except TimeoutException:
        # L'elemento è ancora nel DOM, continua con i controlli
        pass
    
    try:
        # Verifica che sia visibile e abilitato
        if not (element.is_displayed() and element.is_enabled()):
            return False
        
        # Verifica le dimensioni (evita elementi troppo piccoli)
        size = element.size
        if size['width'] < 5 or size['height'] < 5:
            return False
        
        # Verifica che sia nel viewport o non troppo lontano
        viewport_check = driver.execute_script("""
            var elem = arguments[0];
            var rect = elem.getBoundingClientRect();
            var windowHeight = window.innerHeight || document.documentElement.clientHeight;
            var windowWidth = window.innerWidth || document.documentElement.clientWidth;
            
            // Elemento è nel viewport o poco sotto
            return (
                rect.top <= windowHeight * 2 &&
                rect.left >= 0 &&
                rect.left <= windowWidth
            );
        """, element)
        
        if not viewport_check:
            return False
        
        # Controlla se ha stile cursor:pointer o attributi di interazione
        is_interactive = driver.execute_script("""
            var elem = arguments[0];
            var style = window.getComputedStyle(elem);
            
            // Controllo se ha aspetto di elemento interattivo
            return (
                style.cursor === 'pointer' || 
                elem.tagName === 'BUTTON' || 
                elem.tagName === 'A' || 
                elem.hasAttribute('onclick') ||
                elem.hasAttribute('href') ||
                elem.getAttribute('role') === 'button'
            );
        """, element)
        
        return is_interactive
        
    except (StaleElementReferenceException, Exception) as e:
        logging.debug(f"Errore nella validazione dell'elemento: {str(e)}")
        return False

def find_with_ai(driver):
    """
    Utilizza un approccio euristico avanzato per trovare pulsanti di caricamento.
    Da utilizzare come fallback quando le altre strategie falliscono.
    
    Args:
        driver: Istanza del driver Selenium
        
    Returns:
        WebElement or None: Il pulsante trovato o None
    """
    # Raccolta elemento candidati
    html_elements_info = []
    candidates = []
    
    try:
        # Seleziona elementi potenzialmente cliccabili
        xpath = "//button | //a | //div[@role='button' or @tabindex='0'] | //span[@role='button' or @tabindex='0']"
        elements = driver.find_elements(By.XPATH, xpath)
        
        for i, el in enumerate(elements):
            try:
                if not el.is_displayed():
                    continue
                    
                text = el.text.strip()
                tag = el.tag_name
                class_attr = el.get_attribute("class") or ""
                id_attr = el.get_attribute("id") or ""
                
                # Raccogli attributi rilevanti
                attrs = driver.execute_script("""
                    const el = arguments[0];
                    const attrs = {};
                    for (let attr of el.attributes) {
                        attrs[attr.name] = attr.value;
                    }
                    return attrs;
                """, el)
                
                # Posizione dell'elemento (importante per pulsanti di caricamento)
                position = driver.execute_script("""
                    const el = arguments[0];
                    const rect = el.getBoundingClientRect();
                    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
                    return {
                        x: rect.left,
                        y: rect.top,
                        bottom_ratio: (rect.top + rect.height) / windowHeight
                    };
                """, el)
                
                # Ignora elementi nella parte superiore della pagina
                if position['bottom_ratio'] < 0.5 and len(elements) > 10:
                    continue
                
                # Calcola uno score euristico per l'elemento
                score = 0
                
                # Punteggio basato sul testo
                load_more_patterns = [
                    r'load\s*more', r'view\s*more', r'show\s*more', 
                    r'more\s*posts', r'see\s*more', r'read\s*more',
                    r'next', r'altri', r'altro', r'carica', r'mostra'
                ]
                
                lower_text = text.lower()
                
                for pattern in load_more_patterns:
                    if re.search(pattern, lower_text):
                        score += 10
                
                # Punteggio basato sulla classe/id
                lower_class = class_attr.lower()
                lower_id = id_attr.lower()
                
                load_more_class_patterns = ['load', 'more', 'next', 'pag', 'button']
                for pattern in load_more_class_patterns:
                    if pattern in lower_class or pattern in lower_id:
                        score += 5
                
                # Punteggio basato sulla posizione (favorisce elementi in basso)
                score += min(position['bottom_ratio'] * 8, 8)
                
                # Penalizza elementi troppo piccoli
                size = el.size
                if size['width'] < 30 or size['height'] < 20:
                    score -= 5
                
                html_elements_info.append({
                    "index": i,
                    "tag": tag,
                    "text": text,
                    "attributes": attrs,
                    "position": position,
                    "score": score
                })
                
                candidates.append(el)
                
                if len(html_elements_info) >= 50:  # Limita la raccolta
                    break
                    
            except StaleElementReferenceException:
                continue
            except Exception as e:
                logging.debug(f"Errore durante analisi elemento {i}: {str(e)}")
                continue
                
        # Ordina per score e seleziona il migliore
        if html_elements_info:
            html_elements_info.sort(key=lambda x: x["score"], reverse=True)
            best_candidate = html_elements_info[0]
            
            if best_candidate["score"] >= 10:  # Soglia minima di confidenza
                return candidates[html_elements_info.index(best_candidate)]
            
    except Exception as e:
        logging.error(f"Errore nell'analisi euristica: {str(e)}")
    
    return None

import json
import ast


def select_relevant_articles(articles_list, user_info, target_position_description, company):
    """
    Seleziona gli articoli più rilevanti per il profilo del candidato
    chiedendo ad un modello AI di identificare quelli più pertinenti
    basandosi su competenze, esperienza, interessi e la posizione target.
    """
    article_list_str = "\n".join([
        f"{i}) {articles_list[i]['title']} | {articles_list[i]['href'].replace('https://', '').replace('http://', '').replace('www.', '')}"
        for i in range(len(articles_list))
    ])
    
    prompt = f"""
**Target Position Description:**
{target_position_description}

**Candidate Profile (JSON):**
{json.dumps(user_info, indent=2)}

You are an expert career advisor helping a candidate tailor their job application for maximum impact for the specific position described above.

Your task is to strategically evaluate company blog articles that would be most effective when referenced in the candidate's application for {company} to demonstrate genuine interest, relevance, and alignment with the target role.

Instructions:
0. If the article is not relevant for {company}, assign it a score of 1.

1. **Understand the target position first**: Identify the key requirements, skills, domain expertise, and responsibilities of the target role.

2. **Analyze the candidate's profile** in relation to the target position: 
   - How does their experience align with the role?
   - Which of their skills are most relevant?
   - What gaps might they need to address?
   - What unique value do they bring?

3. **Evaluate each article's strategic value** for this specific application using these criteria:
   - **Relevance to target position requirements** (0-4 points): Does the article discuss topics, technologies, or challenges central to the role?
   - **Alignment with candidate's strengths** (0-2 points): Can the candidate demonstrate expertise by referencing this article?
   - **Opportunity to bridge gaps** (0-2 points): Does the article help address any mismatches between candidate profile and position requirements?
   - **Recency and timeliness** (0-1 point): Is the article recent and relevant to current industry trends?
   - **Company culture and values fit** (0-1 point): Does it showcase understanding of company's approach and values?

4. **Return ONLY an array with scores (1-10)** for each article, with the exact same length as the articles list.

5. **Format your response strictly** as a valid array with this structure:
   [score1, score2, score3, …, lastScoreOfList]

Example output: [8, 3, 5, 7, 9, 1, 2, ...]

**Available Articles:**
{article_list_str}"""

    # Call the AI with the prompt
    ai_response = ai_chat(prompt, True)
    
    try:
        scores = ast.literal_eval(ai_response)
        if not isinstance(scores, list):
            raise ValueError("AI response non è una lista valida.")

        # Allinea le lunghezze, nel caso in cui l'AI restituisca meno punteggi
        min_len = min(len(scores), len(articles_list))
        scores = scores[:min_len]
        articles_list = articles_list[:min_len]

        # Ordina per punteggio in modo decrescente
        sorted_articles = [x for _, x in sorted(zip(scores, articles_list), key=lambda x: x[0], reverse=True)]
        return sorted_articles[:3]

    except Exception as e:
        logging.info(f"AI response parsing error: {e}. Falling back to first 2 articles.")
        return articles_list[:3]

from typing import List, Dict, Any, Callable
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import concurrent.futures
import logging
import time
import requests

# Configurazione del logger
logger = logging.getLogger(__name__)

def extract_articles_content(articles: List[Dict[str, str]], 
                           timeout: int = 10, 
                           max_retries: int = 3,
                           retry_delay: int = 2,
                           user_agent: str = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                           max_workers: int = 1,
                           parallel: bool = True) -> List[Dict[str, Any]]:
    """
    Funzione che prende una lista di articoli (ciascuno con titolo e URL),
    ne recupera l'HTML e ne estrae il contenuto testuale rilevante in formato Markdown.
    
    Args:
        articles: Lista di dizionari, ciascuno con chiavi 'title' e 'href'
        timeout: Timeout in secondi per le richieste HTTP
        max_retries: Numero massimo di tentativi per ogni richiesta
        retry_delay: Ritardo in secondi tra i tentativi
        user_agent: User agent da utilizzare nelle richieste
        max_workers: Numero massimo di worker per elaborazione parallela
        parallel: Se True, elabora gli articoli in parallelo
        
    Returns:
        Lista di dizionari contenenti il contenuto estratto per ogni articolo
    """
    headers = {'User-Agent': user_agent}
    results = []
    
    # Dizionario di domini noti per personalizzare l'estrazione
    domain_specific_handlers = {
        'medium.com': _extract_medium_content,
        'wordpress.com': _extract_wordpress_content,
        'blogger.com': _extract_blogger_content,
        'news.ycombinator.com': _extract_hacker_news_content
    }
    
    # Funzione per elaborare un singolo articolo (per uso sia seriale che parallelo)
    def process_article(article):
        if not isinstance(article, dict) or 'href' not in article:
            return {
                'original': article,
                'title': article.get('title', 'Titolo sconosciuto') if isinstance(article, dict) else None,
                'markdown': '',
                'error': 'Formato articolo non valido: richiesti campi "title" e "href"'
            }
            
        url = article['href']
        original_title = article.get('title', '')
        
        try:
            # Ottieni l'HTML
            html = get_html(url)
            
            if not html:
                return {
                    'title': original_title,
                    'url': url,
                    'markdown': '',
                    'error': 'Impossibile recuperare l\'HTML della pagina'
                }
                
            # Estrai il contenuto
            content_data = extract_content(html, url, domain_specific_handlers)
            
            # Aggiungi le informazioni originali
            #content_data['original'] = article
            
            # Se non c'è un titolo estratto ma c'è un titolo nell'articolo originale
            if (not content_data.get('title') or content_data.get('title') == 'None') and original_title:
                content_data['title'] = original_title
                
            return content_data
            
        except Exception as e:
            logger.error(f"Errore durante l'elaborazione di {url}: {str(e)}")
            return {
                'title': original_title,
                'url': url,
                'markdown': '',
                'error': f'Errore durante l\'elaborazione: {str(e)}'
            }
    
    # Elaborazione parallela o seriale in base al parametro
    if parallel and len(articles) > 1:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(process_article, articles))
    else:
        results = [process_article(article) for article in articles]
    
    return results

def extract_content(html: str, url: str, domain_handlers: Dict[str, Callable]) -> Dict[str, Any]:
    """
    Estrae il contenuto testuale dall'HTML di un articolo e lo converte in Markdown.
    
    Args:
        html: HTML dell'articolo
        url: URL dell'articolo per identificare strategie specifiche
        domain_handlers: Dizionario di gestori specifici per dominio
        
    Returns:
        Dizionario con il contenuto estratto in formato Markdown
    """
    if not html:
        return {
            'title': None,
            'markdown': '',
            'url': url,
            'error': 'HTML vuoto o non valido'
        }
        
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Rimuovi elementi non necessari
        _clean_soup(soup)
        
        # Estrazione del dominio per gestire casi specifici
        domain = urlparse(url).netloc
        
        # Verifica se esiste un gestore specifico per il dominio
        for known_domain, handler_func in domain_handlers.items():
            if known_domain in domain:
                return handler_func(soup, url)
        
        # Estrazione standard se non ci sono gestori specifici
        return _extract_standard_content(soup, url)
        
    except Exception as e:
        logger.error(f"Errore durante l'estrazione del contenuto da {url}: {str(e)}")
        return {
            'title': None,
            'markdown': '',
            'url': url,
            'error': f'Errore durante l\'estrazione: {str(e)}'
        }

def _clean_soup(soup: BeautifulSoup) -> None:
    """
    Rimuove elementi non necessari dall'albero HTML.
    
    Args:
        soup: Oggetto BeautifulSoup
    """
    # Rimuovi script, stili, commenti e iframe
    for element in soup(['script', 'style', 'iframe', 'noscript', 'header', 'footer', 'nav']):
        element.decompose()
        
    # Rimuovi i commenti HTML
    for comment in soup.find_all(string=lambda text: isinstance(text, str) and text.strip().startswith('<!--')):
        comment.extract()

def _extract_standard_content(soup: BeautifulSoup, url: str) -> Dict[str, Any]:
    """
    Estrazione standard per siti web generici. Mantiene l'ordine originale degli elementi e li converte in Markdown.
    
    Args:
        soup: Oggetto BeautifulSoup
        url: URL dell'articolo
        
    Returns:
        Dizionario con titolo e contenuto markdown
    """
    logging.info("standard")
    markdown_content = ""
    
    # Estrai il titolo
    title = None
    title_candidates = [
        soup.find('meta', property='og:title'),
        soup.find('meta', property='twitter:title'),
        soup.find('h1'),
        soup.find('title')
    ]
    
    for candidate in title_candidates:
        if candidate:
            if candidate.name == 'meta':
                title = candidate.get('content')
            else:
                # Estrai correttamente il testo anche con tag annidati
                title = candidate.get_text(strip=True)
            if title:
                break
    
    # Trova il contenitore principale dell'articolo
    main_container = None
    containers = [
        soup.find('article'),
        soup.find('div', class_=lambda c: c and ('article' in c.lower() or 'content' in c.lower() or 'post' in c.lower())),
        soup.find('main'),
        soup.find('div', id=lambda i: i and ('article' in i.lower() or 'content' in i.lower() or 'post' in i.lower()))
    ]
    
    for container in containers:
        if container and len(container.get_text(strip=True)) > 400:
            main_container = container
            break

    # Se non troviamo un contenitore specifico, usa il body
    if not main_container:
        main_container = soup.body
    
    if main_container:
        # Raccogli tutti gli elementi rilevanti in ordine
        elements = []
        for elem in main_container.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'blockquote', 'pre', 'table']):
            # Filtra gli elementi vuoti o troppo corti
            text = elem.get_text(strip=True)

            # Per paragrafi, filtra quelli troppo corti
            if elem.name == 'p' and (not text or len(text) <= 15):
                continue
                
            # Per heading, non duplicare il titolo principale
            if elem.name in ['h1', 'h2'] and text == title:
                continue
            
            elements.append(elem)

        # Converti ogni elemento in markdown
        for elem in elements:
            if elem.name.startswith('h') and elem.name[1].isdigit():
                heading_level = int(elem.name[1])
                text = elem.get_text(strip=True)
                if text:
                    markdown_content += '#' * heading_level + ' ' + text + '\n\n'
            
            elif elem.name == 'p':
                text = elem.get_text(strip=True)
                if text:
                    markdown_content += text + '\n\n'
            
            elif elem.name in ['ul', 'ol']:
                list_items = []
                for li in elem.find_all('li', recursive=False):
                    li_text = li.get_text(strip=True)
                    if li_text:
                        prefix = '* ' if elem.name == 'ul' else '1. '
                        list_items.append(prefix + li_text)
                
                if list_items:
                    markdown_content += '\n'.join(list_items) + '\n\n'
            
            elif elem.name == 'blockquote':
                text = elem.get_text(strip=True)
                if text:
                    markdown_content += '> ' + text.replace('\n', '\n> ') + '\n\n'
            
            elif elem.name == 'pre':
                code = elem.get_text(strip=True)
                if code:
                    markdown_content += '```\n' + code + '\n```\n\n'
            
            elif elem.name == 'table':
                # Gestione semplice delle tabelle
                markdown_table = ""
                
                # Intestazioni
                headers = []
                for th in elem.find_all('th'):
                    headers.append(th.get_text(strip=True) or ' ')
                
                if headers:
                    markdown_table += '| ' + ' | '.join(headers) + ' |\n'
                    markdown_table += '| ' + ' | '.join(['---'] * len(headers)) + ' |\n'
                
                # Righe
                for tr in elem.find_all('tr'):
                    row = []
                    for td in tr.find_all('td'):
                        row.append(td.get_text(strip=True) or ' ')
                    
                    if row and not (len(row) == 1 and not row[0].strip()):
                        markdown_table += '| ' + ' | '.join(row) + ' |\n'
                
                if markdown_table:
                    markdown_content += markdown_table + '\n'
    
    # Se non abbiamo trovato contenuto, prova un approccio alternativo
    if not markdown_content.strip() or len(markdown_content.strip()) < 400:
        # Cerca tutti i paragrafi significativi nel documento
        for p in soup.find_all('p'):
            text = p.get_text(strip=True)
            if text and len(text) > 15:
                markdown_content += text + '\n\n'
    
    return {
        'title': title,
        'markdown': markdown_content.strip(),
        'url': url
    }

def _extract_medium_content(soup: BeautifulSoup, url: str) -> Dict[str, Any]:
    """
    Estrattore specifico per articoli di Medium. Mantiene l'ordine originale e produce Markdown.
    
    Args:
        soup: Oggetto BeautifulSoup
        url: URL dell'articolo
        
    Returns:
        Dizionario con titolo e contenuto markdown
    """
    logging.info("medium")
    # In Medium, il titolo è spesso in un h1 con un tag section genitore
    title_elem = soup.find('h1')
    title = title_elem.get_text(strip=True) if title_elem else None
    
    # In Medium, il contenuto principale è spesso in una section con articolo
    article_section = soup.find('article')
    
    if article_section:
        # Raccogli elementi in ordine
        elements = []
        for elem in article_section.find_all(['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'blockquote', 'figure', 'pre']):
            # Non duplicare il titolo
            if elem.name == 'h1' and elem.get_text(strip=True) == title:
                continue
            
            # Filtra elementi vuoti o troppo corti
            if elem.name == 'p':
                text = elem.get_text(strip=True)
                if not text or len(text) <= 10:
                    continue
            
            elements.append(elem)
        
        # Genera markdown
        markdown_content = _convert_elements_to_markdown(elements, title)
        
        if markdown_content:
            return {
                'title': title,
                'markdown': markdown_content,
                'url': url
            }
    
    # Se non abbiamo trovato contenuto, ricadi sull'estrattore standard
    return _extract_standard_content(soup, url)

def _extract_wordpress_content(soup: BeautifulSoup, url: str) -> Dict[str, Any]:
    """
    Estrattore specifico per siti WordPress. Mantiene l'ordine originale e produce Markdown.
    
    Args:
        soup: Oggetto BeautifulSoup
        url: URL dell'articolo
        
    Returns:
        Dizionario con titolo e contenuto markdown
    """
    logging.info("wordp")
    # In WordPress, il titolo è spesso in un elemento h1.entry-title
    title_elem = soup.find('h1', class_='entry-title')
    if not title_elem:
        title_elem = soup.find('h1')
    title = title_elem.get_text(strip=True) if title_elem else None
    
    # In WordPress, il contenuto principale è spesso in div.entry-content
    article_content = soup.find('div', class_='entry-content')
    if not article_content:
        article_content = soup.find('article')
    
    if article_content:
        # Raccogli elementi nell'ordine originale
        elements = []
        for elem in article_content.find_all(['h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'blockquote', 'pre', 'table', 'img', 'figure']):
            # Filtra elementi non significativi
            if elem.name == 'p':
                text = elem.get_text(strip=True)
                if not text or len(text) <= 10:
                    continue
            
            elements.append(elem)
        
        # Genera markdown
        markdown_content = _convert_elements_to_markdown(elements, title)
        
        if markdown_content:
            return {
                'title': title,
                'markdown': markdown_content,
                'url': url
            }
    
    # Se non abbiamo trovato contenuto, ricadi sull'estrattore standard
    return _extract_standard_content(soup, url)

def _extract_blogger_content(soup: BeautifulSoup, url: str) -> Dict[str, Any]:
    """
    Estrattore specifico per siti Blogger. Mantiene l'ordine originale e produce Markdown.
    
    Args:
        soup: Oggetto BeautifulSoup
        url: URL dell'articolo
        
    Returns:
        Dizionario con titolo e contenuto markdown
    """
    logging.info("blog")
    # In Blogger, il titolo è spesso in h3.post-title
    title_elem = soup.find('h3', class_='post-title')
    if not title_elem:
        title_elem = soup.find('h1')
    title = title_elem.get_text(strip=True) if title_elem else None
    
    # In Blogger, il contenuto principale è spesso in div.post-body
    article_content = soup.find('div', class_='post-body')
    if not article_content:
        article_content = soup.find('div', class_='entry-content')
    
    if article_content:
        # Raccogli elementi nell'ordine originale
        elements = []
        for elem in article_content.find_all(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'blockquote', 'pre', 'img']):
            # Non duplicare il titolo
            if elem.name in ['h2', 'h3'] and elem.get_text(strip=True) == title:
                continue
                
            # Filtra elementi non significativi
            if elem.name == 'p':
                text = elem.get_text(strip=True)
                if not text or len(text) <= 10:
                    continue
            
            elements.append(elem)
        
        # Genera markdown
        markdown_content = _convert_elements_to_markdown(elements, title)
        
        if markdown_content:
            return {
                'title': title,
                'markdown': markdown_content,
                'url': url
            }
    
    # Se non abbiamo trovato contenuto, ricadi sull'estrattore standard
    return _extract_standard_content(soup, url)

def _extract_hacker_news_content(soup: BeautifulSoup, url: str) -> Dict[str, Any]:
    """
    Estrattore specifico per Hacker News. Mantiene l'ordine originale e produce Markdown.
    
    Args:
        soup: Oggetto BeautifulSoup
        url: URL dell'articolo
        
    Returns:
        Dizionario con titolo e contenuto markdown
    """
    logging.info("news")
    # Per Hacker News, se è una discussione cerchiamo il commento principale
    title = None
    title_elem = soup.find('span', class_='titleline')
    if title_elem and title_elem.find('a'):
        title = title_elem.find('a').get_text(strip=True)
    
    # Cerchiamo il testo principale dell'articolo se presente
    main_text = soup.find('div', class_='toptext')
    
    if main_text:
        markdown_content = main_text.get_text(strip=True)
        
        # Formatta in paragrafi
        markdown_content = '\n\n'.join([p.strip() for p in markdown_content.split('\n') if p.strip()])
        
        return {
            'title': title,
            'markdown': markdown_content,
            'url': url
        }
    
    # HN è spesso solo un link, in tal caso restituiamo solo il titolo
    if title:
        return {
            'title': title,
            'markdown': '',  # Non c'è contenuto testuale
            'url': url
        }
    
    # Se non troviamo nulla di specifico per HN, usiamo l'estrazione standard
    return _extract_standard_content(soup, url)

def _convert_elements_to_markdown(elements, title=None) -> str:
    """
    Converte una lista di elementi HTML in formato Markdown mantenendo l'ordine.
    
    Args:
        elements: Lista di elementi BeautifulSoup
        title: Titolo dell'articolo per evitare duplicati
        
    Returns:
        Contenuto in formato Markdown
    """
    # Helper function per ottenere il testo completo, anche con tag annidati
    def get_full_text(element):
        if not element:
            return ""
        return element.get_text(strip=True)
        
    markdown_content = ""
    
    for elem in elements:
        if elem.name.startswith('h') and elem.name[1].isdigit():
            heading_level = int(elem.name[1])
            # Ottiene il testo completo, includendo eventuali elementi annidati
            text = elem.get_text(strip=True)
            if text and text != title:
                markdown_content += '#' * heading_level + ' ' + text + '\n\n'
        
        elif elem.name == 'p':
            text = elem.get_text(strip=True)
            if text:
                markdown_content += text + '\n\n'
        
        elif elem.name in ['ul', 'ol']:
            list_items = []
            for li in elem.find_all('li', recursive=False):
                li_text = li.get_text(strip=True)
                if li_text:
                    prefix = '* ' if elem.name == 'ul' else '1. '
                    list_items.append(prefix + li_text)
            
            if list_items:
                markdown_content += '\n'.join(list_items) + '\n\n'
        
        elif elem.name == 'blockquote':
            text = elem.get_text(strip=True)
            if text:
                markdown_content += '> ' + text.replace('\n', '\n> ') + '\n\n'
        
        elif elem.name == 'pre':
            code = elem.get_text(strip=True)
            if code:
                markdown_content += '```\n' + code + '\n```\n\n'
        
        elif elem.name == 'img':
            alt = elem.get('alt', '')
            src = elem.get('src', '')
            if src:
                markdown_content += f'![{alt}]({src})\n\n'
        
        elif elem.name == 'figure':
            img = elem.find('img')
            figcaption = elem.find('figcaption')
            
            if img and 'src' in img.attrs:
                alt = img.get('alt', '')
                src = img.get('src', '')
                caption = figcaption.get_text(strip=True) if figcaption else alt
                
                markdown_content += f'![{alt}]({src})\n'
                if caption and caption != alt:
                    markdown_content += f'*{caption}*\n'
                markdown_content += '\n'
        
        elif elem.name == 'table':
            # Gestione semplice delle tabelle
            markdown_table = ""
            
            # Intestazioni
            headers = []
            for th in elem.find_all('th'):
                headers.append(th.get_text(strip=True) or ' ')
            
            if headers:
                markdown_table += '| ' + ' | '.join(headers) + ' |\n'
                markdown_table += '| ' + ' | '.join(['---'] * len(headers)) + ' |\n'
            
            # Righe
            for tr in elem.find_all('tr'):
                row = []
                for td in tr.find_all('td'):
                    row.append(td.get_text(strip=True) or ' ')
                
                if row and not (len(row) == 1 and not row[0].strip()):
                    markdown_table += '| ' + ' | '.join(row) + ' |\n'
            
            if markdown_table:
                markdown_content += markdown_table + '\n'
    
    return markdown_content.strip()

def _extract_about_page_content(soup: BeautifulSoup, url: str) -> Dict[str, Any]:
    """
    Estrazione specializzata per pagine 'About', 'Chi siamo', 'La nostra storia' e simili.
    Ottimizzata per gestire i contenuti tipici di queste pagine come team, missione, valori, ecc.
    
    Args:
        soup: Oggetto BeautifulSoup
        url: URL della pagina
        
    Returns:
        Dizionario con titolo e contenuto markdown
    """
    logging.info("about page")
    markdown_content = ""
    
    # Estrai il titolo
    title = None
    title_candidates = [
        soup.find('meta', property='og:title'),
        soup.find('meta', property='twitter:title'),
        soup.find('h1'),
        soup.find('title')
    ]
    
    for candidate in title_candidates:
        if candidate:
            if candidate.name == 'meta':
                title = candidate.get('content')
            else:
                title = candidate.get_text(strip=True)
            if title:
                break
    
    # Cerca contenitori specifici per pagine about
    about_containers = [
        soup.find('div', class_=lambda c: c and any(x in c.lower() for x in ['about', 'chi-siamo', 'team', 'storia', 'mission'])),
        soup.find('section', class_=lambda c: c and any(x in c.lower() for x in ['about', 'chi-siamo', 'team', 'storia', 'mission'])),
        soup.find('div', id=lambda i: i and any(x in i.lower() for x in ['about', 'chi-siamo', 'team', 'storia', 'mission'])),
        soup.find('section', id=lambda i: i and any(x in i.lower() for x in ['about', 'chi-siamo', 'team', 'storia', 'mission'])),
        soup.find('article'),
        soup.find('main'),
    ]
    
    main_container = None
    for container in about_containers:
        if container and len(container.get_text(strip=True)) > 200:
            main_container = container
            break
    
    # Se non troviamo un contenitore specifico, usa il body
    if not main_container:
        main_container = soup.body
    
    if main_container:
        # Estrai sezioni speciali tipiche delle pagine About
        sections = {}
        
        # 1. Cerca mission/vision/valori
        mission_keywords = ['mission', 'missione', 'vision', 'visione', 'valori', 'values', 'objectives', 'obiettivi']
        mission_section = None
        
        for keyword in mission_keywords:
            # Cerca heading con keyword
            mission_heading = main_container.find(['h1', 'h2', 'h3', 'h4'], string=lambda s: s and keyword.lower() in s.lower())
            if mission_heading:
                # Prendi il contenuto successivo fino al prossimo heading
                mission_content = []
                for sibling in mission_heading.find_next_siblings():
                    if sibling.name in ['h1', 'h2', 'h3', 'h4']:
                        break
                    if sibling.name == 'p' and sibling.get_text(strip=True):
                        mission_content.append(sibling.get_text(strip=True))
                
                if mission_content:
                    heading_text = mission_heading.get_text(strip=True)
                    sections[heading_text] = mission_content
        
        # 2. Cerca sezioni del team
        team_keywords = ['team', 'staff', 'people', 'persone', 'chi siamo', 'our team', 'il nostro team']
        team_section = None
        
        for keyword in team_keywords:
            team_heading = main_container.find(['h1', 'h2', 'h3', 'h4'], string=lambda s: s and keyword.lower() in s.lower())
            if team_heading:
                # Cerca membri del team - spesso in grid/cards
                team_members = []
                
                # Cerca container di team members
                team_container = None
                for sibling in team_heading.find_next_siblings():
                    if sibling.name in ['h1', 'h2', 'h3', 'h4']:
                        break
                    if sibling.name in ['div', 'ul', 'section'] and len(sibling.find_all(['div', 'li'])) > 1:
                        team_container = sibling
                        break
                
                if team_container:
                    # Cerca card o elementi lista che rappresentano membri
                    member_elements = team_container.find_all(['div', 'li'], class_=lambda c: c and any(x in str(c).lower() for x in ['card', 'member', 'person', 'team', 'staff']))
                    
                    # Se non trova niente con classi specifiche, prova a individuare pattern ripetitivi
                    if not member_elements:
                        # Cerca div o li con struttura simile (es. img + h3/h4 + p)
                        member_elements = [el for el in team_container.find_all(['div', 'li']) 
                                          if (el.find('img') and el.find(['h3', 'h4', 'strong', 'b']) and el.find('p'))]
                    
                    # Estrai informazioni dai membri
                    for member in member_elements:
                        member_info = {}
                        
                        # Nome (di solito in un heading)
                        name_elem = member.find(['h3', 'h4', 'h5', 'strong', 'b'])
                        if name_elem:
                            member_info['name'] = name_elem.get_text(strip=True)
                        
                        # Ruolo (di solito in un paragrafo o span)
                        role_elem = member.find(['p', 'span', 'div'], class_=lambda c: c and any(x in str(c).lower() for x in ['role', 'title', 'position', 'ruolo']))
                        if not role_elem:
                            # Prova a trovare il primo p dopo il nome
                            if name_elem:
                                role_elem = name_elem.find_next('p')
                        
                        if role_elem:
                            member_info['role'] = role_elem.get_text(strip=True)
                        
                        # Bio (potrebbe essere in altri paragrafi)
                        bio_paragraphs = []
                        for p in member.find_all('p'):
                            if p != role_elem and len(p.get_text(strip=True)) > 20:  # Probabilmente è una bio
                                bio_paragraphs.append(p.get_text(strip=True))
                        
                        if bio_paragraphs:
                            member_info['bio'] = ' '.join(bio_paragraphs)
                        
                        if member_info.get('name'):  # Aggiungi solo se abbiamo almeno il nome
                            team_members.append(member_info)
                
                # Salva la sezione team
                if team_members:
                    heading_text = team_heading.get_text(strip=True)
                    sections[heading_text] = team_members
        
        # 3. Cerca sezione storia/about
        history_keywords = ['storia', 'history', 'about us', 'chi siamo', 'about', 'la nostra storia']
        history_section = None
        
        for keyword in history_keywords:
            history_heading = main_container.find(['h1', 'h2', 'h3'], string=lambda s: s and keyword.lower() in s.lower())
            if history_heading:
                # Estrai paragrafi successivi fino al prossimo heading principale
                history_content = []
                for sibling in history_heading.find_next_siblings():
                    if sibling.name in ['h1', 'h2', 'h3']:
                        break
                    if sibling.name == 'p' and sibling.get_text(strip=True):
                        history_content.append(sibling.get_text(strip=True))
                
                if history_content:
                    heading_text = history_heading.get_text(strip=True)
                    sections[heading_text] = history_content
        
        # 4. Cerca sezione contatti se presente
        contact_keywords = ['contatti', 'contact', 'contactos', 'reach us', 'find us']
        contact_section = None
        
        for keyword in contact_keywords:
            contact_heading = main_container.find(['h1', 'h2', 'h3', 'h4'], string=lambda s: s and keyword.lower() in s.lower())
            if contact_heading:
                # Estrai informazioni di contatto
                contact_info = {}
                contact_container = None
                
                # Cerca container successivo
                for sibling in contact_heading.find_next_siblings():
                    if sibling.name in ['h1', 'h2', 'h3']:
                        break
                    if sibling.name in ['div', 'section', 'address']:
                        contact_container = sibling
                        break
                
                if not contact_container:
                    contact_container = contact_heading.parent
                
                if contact_container:
                    # Email
                    email_elem = contact_container.find('a', href=lambda h: h and 'mailto:' in h)
                    if email_elem:
                        contact_info['email'] = email_elem.get_text(strip=True) or email_elem['href'].replace('mailto:', '')
                    
                    # Telefono
                    phone_elem = contact_container.find('a', href=lambda h: h and 'tel:' in h)
                    if phone_elem:
                        contact_info['phone'] = phone_elem.get_text(strip=True) or phone_elem['href'].replace('tel:', '')
                    
                    # Indirizzo
                    address_elem = contact_container.find('address')
                    if address_elem:
                        contact_info['address'] = address_elem.get_text(strip=True)
                    
                    # Social media
                    social_links = []
                    social_patterns = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube']
                    for pattern in social_patterns:
                        social_elem = contact_container.find('a', href=lambda h: h and pattern in h.lower())
                        if social_elem:
                            social_links.append({
                                'platform': pattern,
                                'url': social_elem['href']
                            })
                    
                    if social_links:
                        contact_info['social'] = social_links
                
                if contact_info:
                    heading_text = contact_heading.get_text(strip=True)
                    sections[heading_text] = contact_info
        
        # Ora convertiamo le sezioni in markdown
        for heading, content in sections.items():
            # Aggiungi titolo sezione
            markdown_content += f"## {heading}\n\n"
            
            if isinstance(content, list):
                # Contenuto normale (paragrafi)
                if all(isinstance(item, str) for item in content):
                    for paragraph in content:
                        markdown_content += f"{paragraph}\n\n"
                
                # Team members
                elif all(isinstance(item, dict) for item in content) and 'name' in content[0]:
                    for member in content:
                        markdown_content += f"### {member['name']}\n\n"
                        if 'role' in member:
                            markdown_content += f"**{member['role']}**\n\n"
                        if 'bio' in member:
                            markdown_content += f"{member['bio']}\n\n"
            
            # Contatti
            elif isinstance(content, dict):
                for key, value in content.items():
                    if key == 'social':
                        markdown_content += "**Social Media:**\n\n"
                        for social in value:
                            markdown_content += f"- {social['platform'].title()}: {social['url']}\n"
                        markdown_content += "\n"
                    else:
                        markdown_content += f"**{key.title()}**: {value}\n\n"
        
        # Se non abbiamo trovato sezioni strutturate, raccogliamo tutto il contenuto rilevante
        if not markdown_content.strip():
            # Estrai tutti gli elementi significativi in ordine
            for elem in main_container.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol']):
                if elem.name.startswith('h') and elem.name[1].isdigit():
                    heading_level = int(elem.name[1])
                    text = elem.get_text(strip=True)
                    if text and text != title:
                        markdown_content += '#' * heading_level + ' ' + text + '\n\n'
                
                elif elem.name == 'p':
                    text = elem.get_text(strip=True)
                    if text and len(text) > 15:
                        markdown_content += text + '\n\n'
                
                elif elem.name in ['ul', 'ol']:
                    list_items = []
                    for li in elem.find_all('li', recursive=False):
                        li_text = li.get_text(strip=True)
                        if li_text:
                            prefix = '* ' if elem.name == 'ul' else '1. '
                            list_items.append(prefix + li_text)
                    
                    if list_items:
                        markdown_content += '\n'.join(list_items) + '\n\n'
    
    # Se non abbiamo ancora trovato contenuto significativo, prova un approccio più semplice
    if not markdown_content.strip() or len(markdown_content.strip()) < 300:
        # 1. Prima cerca tutti i div con classi comuni per about
        about_divs = soup.find_all('div', class_=lambda c: c and any(x in str(c).lower() for x in ['about', 'chi-siamo', 'team', 'storia', 'mission', 'content']))
        
        for div in about_divs:
            # Estrai paragrafi significativi
            for p in div.find_all('p'):
                text = p.get_text(strip=True)
                if text and len(text) > 15:
                    markdown_content += text + '\n\n'
        
        # 2. Se ancora niente, estrai tutti i paragrafi significativi della pagina
        if not markdown_content.strip() or len(markdown_content.strip()) < 300:
            for p in soup.find_all('p'):
                text = p.get_text(strip=True)
                if text and len(text) > 15:
                    markdown_content += text + '\n\n'
    
    # Estrai metadati che potrebbero essere utili per pagine About
    metadata = {}
    
    # Cerca anno di fondazione
    foundation_patterns = [
        r'(?:fondato|fondata|established|founded)(?:\s+\w+){0,3}\s+in\s+(\d{4})',
        r'(?:fondato|fondata|established|founded)(?:\s+\w+){0,3}\s+nel\s+(\d{4})',
        r'since\s+(\d{4})',
        r'dal\s+(\d{4})',
        r'(\d{4})(?:\s+\w+){0,2}\s+(?:fondazione|foundation)'
    ]
    
    for pattern in foundation_patterns:
        for text_block in soup.stripped_strings:
            if len(text_block) > 10 and len(text_block) < 300:  # Per evitare blocchi troppo lunghi
                match = re.search(pattern, text_block, re.IGNORECASE)
                if match:
                    metadata['foundation_year'] = match.group(1)
                    break
        if 'foundation_year' in metadata:
            break
    
    return markdown_content.strip()

def generate_personalized_email(user_info, articles_content):
    """
    Genera un'email personalizzata che collega il profilo del candidato
    con i contenuti degli articoli dell'azienda
    """
    # Prepara il prompt per generare l'email
    prompt = f"""
    Devi creare una email di presentazione personalizzata per un candidato da inviare a un recruiter.
    L'email deve stabilire parallelismi tra l'esperienza del candidato e i contenuti degli articoli 
    del blog aziendale, dimostrando un genuino interesse per l'azienda e una naturale compatibilità.
    
    Profilo del candidato:
    {json.dumps(user_info, indent=2)}
    
    Articoli rilevanti del blog aziendale:
    {json.dumps(articles_content, indent=2)}
    
    Requisiti per l'email:
    1. Inizia con un'introduzione del candidato e il motivo del suo interesse per l'azienda
    2. Evidenzia 2-3 parallelismi specifici tra le esperienze/competenze del candidato e i temi/tecnologie menzionati negli articoli
    3. Cita brevemente contenuti specifici dagli articoli che dimostrano la sintonia con i valori o approcci tecnici dell'azienda
    4. Mostra come il background del candidato lo renda particolarmente adatto per contribuire ai progetti/tecnologie discussi
    5. Chiudi con una richiesta di colloquio e ringraziamenti
    6. L'email deve essere professionale ma conversazionale, lunga circa 250-350 parole
    7. Non essere troppo adulatorio, mantieni un tono autentico e credibile
    
    Crea l'email completa, pronta per essere inviata dopo una revisione da parte del candidato.
    """
    
    # Genera l'email personalizzata
    email = ai_chat(prompt)
    return email

import requests
import re
from bs4 import BeautifulSoup

def get_linkedin_description(company):
    # 1. Cerca la pagina LinkedIn aziendale con Google
    search_results = search_on_google(f"{company} LinkedIn site:linkedin.com/company", exclude_url="")

    linkedin_links = []
    for item in search_results:
        link = item.get("link", "")
        if link.startswith("https://www.linkedin.com/company/"):
            description = (
                item.get("pagemap", {})
                    .get("metatags", [{}])[0]
                    .get("og:description", "")
            )
            # Estrai il numero di follower
            match = re.search(r"([\d,]+)\s+followers", description)
            if match:
                followers_str = match.group(1).replace(",", "")
                try:
                    followers = int(followers_str)
                except ValueError:
                    followers = 0
            else:
                followers = 0
            linkedin_links.append((link, followers))

    if not linkedin_links:
        return "Nessuna pagina LinkedIn trovata."

    # 2. Scegli il link con più follower
    best_link = max(linkedin_links, key=lambda x: x[1])[0]

    # 3. Pulisci il link per ottenere solo /company/{stringa}/about/
    match = re.match(r"https://www.linkedin.com/company/([^/]+)/?", best_link)
    if not match:
        return "Formato link LinkedIn non valido."

    base_link = f"https://www.linkedin.com/company/{match.group(1)}/about/"

    # 4. Ottieni l'HTML della pagina about
    html = get_html(base_link)
    if not html:
        return "Errore nel recupero HTML dalla pagina LinkedIn."

    soup = BeautifulSoup(html, "html.parser")

    # 5. Trova la sezione descrizione e le info
    section = soup.find("section", class_="artdeco-card org-page-details-module__card-spacing artdeco-card org-about-module__margin-bottom")
    if not section:
        return "Sezione informazioni non trovata."

    markdown = ""

    # Descrizione principale
    p_tag = section.find("p")
    if p_tag:
        logging.info(p_tag.get_text(strip=True))
        markdown += f"**Descrizione aziendale**:\n\n{p_tag.get_text(strip=True)}\n\n"

    # Dettagli (dt = titolo, dd = contenuto)
    dl = section.find("dl")
    dl = section.find("dl")
    if dl:
        markdown += "**Informazioni aziendali**:\n\n"
        
        current_title = None
        current_values = []

        for child in dl.children:
            if child.name == "dt":
                # Se abbiamo accumulato un titolo precedente, scrivilo nel markdown
                if current_title is not None:
                    joined_values = " ".join(current_values).strip()
                    markdown += f"- **{current_title}**: {joined_values}\n"

                # Inizia una nuova sezione
                current_title = child.get_text(strip=True)
                current_values = []
            elif child.name == "dd" and current_title is not None:
                current_values.append(child.get_text(strip=True))

        # Aggiungi l'ultima coppia dt-dd
        if current_title is not None and current_values:
            joined_values = " ".join(current_values).strip()
            markdown += f"- **{current_title}**: {joined_values}\n"
    
    return markdown

def get_about_page_link_with_google(company):
    """
    Uses Google search results and DeepSeek to identify the official About page of a company.
    
    Args:
        company (str): The company name to search for
        
    Returns:
        str or None: URL of the company's About page, or None if not found
    """
    # Search for the company's about page
    results_raw = search_on_google(f"{company} about us")
    
    if not results_raw:
        logging.info("Nessun risultato trovato.")
        return None
    
    # Format the results
    results = [
        {
            "title": item.get("title", ""),
            "link": item.get("link", ""),
            "snippet": item.get("snippet", "")
        }
        for item in results_raw
    ]

    # Create prompt for DeepSeek to evaluate
    prompt = f"""
    # Company About Page Identification Task
    I need to identify which search result is most likely the official About page for '{company}'.
    
    ## Instructions
    - Evaluate each search result carefully
    - Respond with ONLY a single number (1, 2, 3, or 0)
    - Do not provide any explanation or additional text
    
    ## Priority Ranking (from highest to lowest)
    1. Official company About/About Us/Our Company/Who We Are page
    2. Official company Team/Leadership/Our Story page
    3. Official company main homepage (if it contains substantial about information)
    
    ## Response Required
    Respond with:
    - 1, 2, 3, or 4 if that result matches any of the priority criteria
    - 0 if none meets these criteria, or if the result is a news article, blog post, or other unrelated page.
    -*-
    
    ## Search Results
    """
    
    for idx, r in enumerate(results, 1):
        prompt += f"\n{idx}. {r['title']}\n URL: {r['link']}\n Snippet: {r['snippet']}\n"
    
    try:
        deepseek_response = ai_chat(prompt).strip()
        selected_index = int(deepseek_response)
    except Exception as e:
        logging.info(f"Errore chiamata DeepSeek o conversione numero: {e}")
        return None
    
    if 1 <= selected_index <= len(results):
        return results[selected_index - 1]["link"]
    else:
        return None

def get_about_description(company):
    url = get_about_page_link_with_google(company)

    if not url:
        return

    html = get_html(url)
    soup = BeautifulSoup(html, "html.parser")
    _clean_soup(soup)
    result = _extract_about_page_content(soup, url)

    return result

def get_all_articles(company, target_position_description):
    article_links = []
    seen_hrefs = set()  # 🔹 Traccia href già visti
    blogs_analyzed = 0
    times = 0

    blog_links = get_blog_links_ranked(company, target_position_description)

    while len(article_links) < MAX_ARTICLES and times < 2:
        blog_link = blog_links[times]["link"] if times < len(blog_links) else None
        logging.info("blog_link", blog_link)
        
        if blog_link:
            blogs_analyzed += 1  # 🔹 Conta ogni blog trovato

            category_link = find_relevant_category_link_with_ai(blog_link, target_position_description)
            logging.info("Link categoria Ingegneria:", category_link)
            
            if category_link:
                blog_link = category_link

            new_articles = get_all_blog_pages(blog_link, len(article_links))

            if len(article_links) + len(new_articles) < MAX_ARTICLES:
                new_articles.extend(get_articles_with_load_more(blog_link, len(article_links) + len(new_articles)))

            # Filtra i duplicati in base all'href
            unique_new_articles = []
            for article in new_articles:
                href = article.get("href")  # assuming each article is a dict with 'href'
                if href and href not in seen_hrefs:
                    seen_hrefs.add(href)
                    unique_new_articles.append(article)

            article_links.extend(unique_new_articles)

            logging.info(f"Articoli trovati per {company}: {len(article_links)} (blogs analizzati: {blogs_analyzed})")
        else:
            logging.info("Nessun blog trovato.")
            break
        
        save_articles_to_file(article_links, f"articles-{company}.json")
        times += 1
    
    return article_links, blogs_analyzed

from bs4 import BeautifulSoup
import re

def parse_text(element):
    """Estrae testo pulito con gestione dei <br>."""
    if element is None:
        return ""
    for br in element.find_all("br"):
        br.replace_with("\n")
    return element.get_text(separator=" ", strip=True)

from datetime import datetime
from dateutil.relativedelta import relativedelta

def compact_linkedin_data(data):
    # Month map in English
    MONTH_MAP = {
        1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
        7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
    }

    def parse_date(date_str):
        """Convert 'YYYY-MM' to datetime"""
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, "%Y-%m")
        except:
            return None

    def format_period(start, end):
        """Return period string in 'MMM YYYY - MMM YYYY' format"""
        if not start:
            return "", 0, 0  # period, total_months, total_years
        start_dt = parse_date(start)
        end_dt = parse_date(end) if end else datetime.now()
        if not start_dt:
            return "", 0, 0
        delta = relativedelta(end_dt, start_dt)
        total_months = delta.years * 12 + delta.months
        period_str = f"{MONTH_MAP[start_dt.month]} {start_dt.year} - {'Present' if not end else MONTH_MAP[end_dt.month] + ' ' + str(end_dt.year)}"
        return period_str, total_months, delta.years, delta.months

    def safe_strip(value):
        return str(value or "").strip()
    
    compact = {
        "name": safe_strip(data.get("full_name") or data.get("name")),
        "subtitle": safe_strip(data.get("job_title")),
        "industry": safe_strip(data.get("industry")),
        "skills": ", ".join([safe_strip(s) for s in data.get("skills", []) or []]),
        "education": [],
        "experience": []
    }

    # Education
    for edu in data.get("education", []) or []:
        degree = safe_strip(edu.get("degree_name"))
        university = safe_strip(edu.get("university_name"))
        if degree or university:
            compact["education"].append(f"{degree} — {university}".strip(" —"))

    # Group experiences by company
    company_map = {}
    for exp in data.get("experience", []) or []:
        company = exp.get("company", {})
        company_name = safe_strip(company.get("name"))
        if not company_name:
            continue

        title = exp.get("title", {})
        position = safe_strip(title.get("name"))
        role = safe_strip(title.get("role"))
        sub_role = safe_strip(title.get("sub_role"))
        levels = ", ".join(title.get("levels", [])) if title.get("levels") else ""

        location = ", ".join([safe_strip(loc) for loc in exp.get("location_names", []) if loc])
        start = safe_strip(exp.get("start_date"))
        end = safe_strip(exp.get("end_date"))

        period_str, total_months, years, months = format_period(start, end)
        duration_str = ""
        if years > 0:
            duration_str += f"{years} year{'s' if years>1 else ''}"
        if months > 0:
            if duration_str:
                duration_str += " "
            duration_str += f"{months} month{'s' if months>1 else ''}"

        role_str = " — ".join(filter(None, [position, location, f"{period_str} · {duration_str}" if duration_str else period_str, role, sub_role, levels]))

        if company_name not in company_map:
            company_map[company_name] = {
                "company": company_name,
                "roles": [],
                "total_months": 0  # internal, to sum durations
            }
        company_map[company_name]["roles"].append(role_str)
        company_map[company_name]["total_months"] += total_months

    # Convert total months to readable string and prepare final experience list
    experience_list = []
    for comp in company_map.values():
        total_years = comp["total_months"] // 12
        total_months = comp["total_months"] % 12
        total_str = ""
        if total_years > 0:
            total_str += f"{total_years} year{'s' if total_years>1 else ''}"
        if total_months > 0:
            if total_str:
                total_str += " "
            total_str += f"{total_months} month{'s' if total_months>1 else ''}"
        experience_list.append({
            "company": comp["company"],
            "roles": comp["roles"],
            "total": total_str
        })

    compact["experience"] = experience_list
    return compact

from collections import defaultdict
import os
import json
import time
import math
import random
from datetime import datetime, timezone
import pytz

def get_linkedin_profile_data(profile_url):
    """
    Estrae dati da un profilo LinkedIn:
    - Nome completo
    - Descrizione lunga
    - Esperienze lavorative dettagliate
    
    Args:
        profile_url (str): URL del profilo LinkedIn
    
    Returns:
        dict: Dati estratti
    """

    def get_pdl_data():
        
        def load_store():
            if os.path.exists(STORE_FILE):
                with open(STORE_FILE) as f:
                    try:
                        return json.load(f)
                    except Exception:
                        pass
            return {"data": {}, "usage": {}}

        def save_store(store):
            with open(STORE_FILE, "w") as f:
                json.dump(store, f, indent=2)

        def reset_if_needed(usage):
            """Reset robusto: se è il 15 o successivo, e non ho già resettato questo mese, azzero."""
            today = datetime.now(timezone.utc)

            y, m, d = today.year, today.month, today.day
            last_reset = usage.get("_last_reset", {})

            if d >= 15 and (last_reset.get("year") != y or last_reset.get("month") != m):
                # reset counters
                for k in usage:
                    if k != "_last_reset":
                        usage[k]["call_count"] = 0
                usage["_last_reset"] = {"year": y, "month": m}

        def choose(items, usage):
            now = time.time()

            times = [now - usage.get(i, {}).get("last_called", 0) for i in items]
            calls = [usage.get(i, {}).get("call_count", 0) for i in items]

            tn = [(t - min(times)) / (max(times) - min(times) + 1e-9) for t in times]
            cn = [(c - min(calls)) / (max(calls) - min(calls) + 1e-9) for c in calls]

            ms = [TIME_WEIGHT * t + (1 - TIME_WEIGHT) * (1 - c) for t, c in zip(tn, cn)]
            weights = [math.exp(-((1 - m) ** 2) / (2 * SIGMA ** 2)) for m in ms]

            r, s = random.random() * sum(weights), 0
            for i, w in zip(items, weights):
                s += w
                if r <= s:
                    return i
            return items[-1]

        def is_key_available(api_key, data):
            """Controlla se una api_key è chiamabile in base a orario e giorno (entrambi opzionali)."""
            entry = data[api_key]
            tzname = entry.get("timezone")
            tz = pytz.timezone(tzname) if tzname else pytz.UTC
            now = datetime.now(tz)

            # Se days_blocked è presente, controllo i giorni
            if "days_blocked" in entry and entry["days_blocked"]:
                if now.isoweekday() in entry["days_blocked"]:
                    return False

            # Se hours è presente, controllo l'intervallo orario
            if "hours" in entry and entry["hours"]:
                start, end = entry["hours"]
                if not (start <= now.hour <= end):
                    return False

            return True

        def request_with_selected(url, params=None):
            
            def estimate_traffic_from_response(response):
                """
                Stima il traffico totale (byte inviati + ricevuti + overhead) 
                a partire da una response di requests.
                """
                # Byte della richiesta
                req_body = response.request.body or b""
                req_headers = sum(len(k.encode()) + len(v.encode()) for k, v in response.request.headers.items())
                bytes_sent = len(req_body) + req_headers

                # Byte della risposta
                resp_body = response.content
                resp_headers = sum(len(k.encode()) + len(v.encode()) for k, v in response.headers.items())
                bytes_received = len(resp_body) + resp_headers

                # Stima overhead TCP/IP + HTTPS (~60 byte per pacchetto, pacchetti da 1500 byte)
                packets_sent = max(1, bytes_sent // 1500 + 1)
                packets_received = max(1, bytes_received // 1500 + 1)
                overhead = (packets_sent + packets_received) * 60

                total_traffic = bytes_sent + bytes_received + overhead

                logging.info(f"Traffico totale stimato: {total_traffic} byte")

                return total_traffic

            store = load_store()
            data, usage = store["data"], store["usage"]

            reset_if_needed(usage)

            # Filtra API key con CAP e regole di tempo/giorno
            keys = [
                k for k in data
                if usage.get(k, {}).get("call_count", 0) < CAP
                and is_key_available(k, data)
            ]
            if not keys:
                raise RuntimeError("Nessuna API key disponibile in questo momento")

            api = choose(keys, usage)
            proxy = choose(data[api]["proxies"], usage)

            # aggiorna usage
            for k in (api, proxy):
                usage.setdefault(k, {"call_count": 0, "last_called": 0})
                usage[k]["call_count"] += 1
                usage[k]["last_called"] = time.time()

            save_store({"data": data, "usage": usage})

            headers = {
                "accept": "application/json",
                "content-type": "application/json",
                "x-api-key": api,
            }
            proxies = {"http": proxy, "https": proxy}

            resp = requests.get(
                url,
                params=params or {},
                headers=headers,
                proxies=proxies,
                timeout=30,
            )

            return resp
        
        STORE_FILE = "store_pdl.json"
        SIGMA = 0.25
        TIME_WEIGHT = 0.5
        CAP = 100
        PDL_URL = "https://api.peopledatalabs.com/v5/person/enrich"
        PARAMS = {
            "profile": profile_url,
        }

        for attempt in range(3):
            resp = request_with_selected(PDL_URL, PARAMS)
            
            try:
                json_response = resp.json()  # <-- qui converti in dict
            except ValueError:
                logging.info(f"Tentativo {attempt + 1} - Risposta non valida")
                continue  # passa al prossimo tentativo

            # Check for successful response
            if json_response.get("status") == 200:
                record = json_response['data']
                return record

            logging.info(f"Tentativo {attempt + 1} - Errore PDL:", json_response.get("message", "Unknown error"))

        # Se dopo 3 tentativi non va a buon fine
        return {}

    return compact_linkedin_data(get_pdl_data())

    # 1. Recupero HTML principale
    html = get_html(profile_url)
    soup = BeautifulSoup(html, "html.parser").find("main")

    # --- Nome completo ---
    name_tag = soup.find("h1")
    full_name = name_tag.get_text(strip=True) if name_tag else ""
    
    subtitle_tag = soup.find("div", class_="text-body-medium break-words")
    subtitle = subtitle_tag.get_text(strip=True) if subtitle_tag else ""

    img_tag = soup.find("img", alt=full_name)
    img_url = img_tag.get("src", "") if img_tag else ""

    # --- Descrizione lunga ---
    description_container = soup.find("div", class_="display-flex ph5 pv3")
    description_span = description_container.find("span", attrs={"aria-hidden": "true"}) if description_container else None
    long_description = parse_text(description_span)
    
    # 2. Recupero esperienze
    def parse_experiences(html):
        """
        Parsa le esperienze lavorative da un profilo LinkedIn HTML.
        
        Args:
            html (str): HTML del profilo LinkedIn
            
        Returns:
            list: Lista di dizionari con le esperienze lavorative
        """


        def parse_single_experience(li):
            """
            Parsa una singola esperienza lavorativa da un elemento <li>.
            
            Args:
                li: Elemento BeautifulSoup <li>
                
            Returns:
                dict: Dizionario con i dati dell'esperienza
            """
            # Trova il logo dell'azienda
            img_tag = li.find('img')
            company_logo = img_tag.get('src') if img_tag else None

            # Trova tutti i tag <a> con la classe specifica
            a_tags = li.find_all('a', class_='optional-action-target-wrapper display-flex flex-column full-width')

            if not a_tags:
                return None
            
            # Controlla se esiste uno span senza testo con padre un div senza attributi:
            multiple_roles_indicator = li.find(
                lambda t: t.name == "span"
                and t.get("class") and len(t["class"]) == 1
                and (t.string is None or t.string.strip() == "")
                and t.parent and t.parent.name == "div"
                and not t.parent.has_attr("class")
            )
            has_multiple_roles = multiple_roles_indicator is not None
            
            if has_multiple_roles:
                return parse_multiple_roles_experience(li, a_tags, company_logo)
            else:
                return parse_single_role_experience(li, a_tags[0], company_logo)

        def parse_single_role_experience(li, a_tag, company_logo):
            """
            Parsa un'esperienza con un solo ruolo.
            
            Args:
                li: Elemento <li> dell'esperienza
                a_tag: Tag <a> principale
                company_logo: URL del logo aziendale
                
            Returns:
                dict: Dizionario con i dati dell'esperienza
            """
            # Ottieni i figli diretti del tag <a> che sono effettivamente tag HTML
            a_children = [child for child in a_tag.children if isinstance(child, Tag)]
            
            if len(a_children) < 3:
                return None
            
            # Titolo della posizione - primo <span> nel primo figlio
            position_title = None
            first_child = a_children[0]
            if first_child:
                first_span = first_child.find('span')
                if first_span:
                    position_title = first_span.get_text(strip=True)
            
            # Nome azienda - primo <span aria-hidden="true"> nel secondo figlio
            company_name = None
            second_child = a_children[1]
            if second_child:
                company_span = second_child.find('span', {'aria-hidden': 'true'})
                if company_span:
                    company_name = company_span.get_text(strip=True)
            
            # Periodo totale - primo <span aria-hidden="true"> nel terzo figlio
            total_duration = None
            third_child = a_children[2]
            if third_child:
                duration_span = third_child.find('span', {'aria-hidden': 'true'})
                if duration_span:
                    total_duration = duration_span.get_text(strip=True)
            
            # Luogo - primo <span aria-hidden="true"> nel quarto figlio
            location = None
            if len(a_children) > 3:
                fourth_child = a_children[3]
                if fourth_child:
                    location_span = fourth_child.find('span', {'aria-hidden': 'true'})
                    if location_span:
                        location = location_span.get_text(strip=True)
                
            # Descrizione - secondo fratello del padre del tag <a>
            description = None
            a_parent = a_tag.parent
            if a_parent:
                siblings = [child for child in a_parent.parent.children if isinstance(child, Tag)]
                # Trova l'indice del padre del tag <a>
                a_parent_index = None
                for i, sibling in enumerate(siblings):
                    if a_tag in sibling.find_all('a'):
                        a_parent_index = i
                        break
                
                if a_parent_index is not None and a_parent_index + 1 < len(siblings):
                    description_div = siblings[a_parent_index + 1]
                    if description_div and description_div.name == 'div':
                        desc_span = description_div.find('span')
                        if desc_span:
                            description = desc_span.get_text(strip=True)
            
            # Costruisci il ruolo
            role = {
                'position_title': position_title,
                'description': description,
                'duration': total_duration,
                'location': location
            }
            
            return {
                'company_name': company_name,
                'total_duration': total_duration,
                'company_logo': company_logo,
                'roles': [role]
            }

        def parse_multiple_roles_experience(li, a_tags, company_logo):
            """
            Parsa un'esperienza con più ruoli.
            
            Args:
                li: Elemento <li> dell'esperienza
                a_tags: Lista di tag <a>
                company_logo: URL del logo aziendale
                
            Returns:
                dict: Dizionario con i dati dell'esperienza
            """
            if not a_tags:
                return None
            
            # Primo tag <a> contiene info azienda e durata totale
            first_a = a_tags[0]
            first_a_children = [child for child in first_a.children if isinstance(child, Tag)]
            
            # Nome azienda - primo <span> nel primo figlio
            company_name = None
            if len(first_a_children) > 0:
                first_span = first_a_children[0].find('span')
    
                if first_span:
                    company_name = first_span.get_text(strip=True)
            
            # Durata totale - primo <span aria-hidden="true"> nel secondo figlio
            total_duration = None
            if len(first_a_children) > 1:
                duration_span = first_a_children[1].find('span', {'aria-hidden': 'true'})
                if duration_span:
                    total_duration = duration_span.get_text(strip=True)
            
            sameLocation = None
            if len(first_a_children) > 2:
                location_span = first_a_children[2].find('span', {'aria-hidden': 'true'})
                if location_span:
                    sameLocation = location_span.get_text(strip=True)
            
            # Parsa i ruoli dai tag <a> successivi
            roles = []
            for a_tag in a_tags[1:]:  # Salta il primo che contiene info azienda
                role = parse_role_from_a_tag(a_tag, sameLocation)
                if role:
                    roles.append(role)
            
            return {
                'company_name': company_name,
                'total_duration': total_duration,
                'company_logo': company_logo,
                'roles': roles
            }

        def parse_role_from_a_tag(a_tag, sameLocation = None):
            """
            Parsa un singolo ruolo da un tag <a>.
            
            Args:
                a_tag: Tag <a> del ruolo
                
            Returns:
                dict: Dizionario con i dati del ruolo
            """
            # Titolo posizione - primo <span> nel tag <a>
            position_title = None
            first_span = a_tag.find('span')
            if first_span:
                position_title = first_span.get_text(strip=True)
            
            # Ottieni i figli diretti del tag <a> che sono effettivamente tag HTML
            a_children = [child for child in a_tag.children if isinstance(child, Tag)]

            # Durata ruolo - primo <span aria-hidden="true"> nel secondo figlio
            role_duration = None
            if len(a_children) > 1:
                duration_span = a_children[1].find('span', {'aria-hidden': 'true'})
                if not (duration_span and '-' in duration_span.get_text() and '·' in duration_span.get_text()):
                    del a_children[1]
                    if a_children:
                        duration_span = a_children[1].find('span', {'aria-hidden': 'true'})
                    else:
                        duration_span = None  # Non ci sono più figli
                    
                if duration_span:
                    role_duration = duration_span.get_text(strip=True)
            
            # Luogo - primo <span aria-hidden="true"> nel terzo figlio
            location = None
            if sameLocation:
                location = sameLocation
            elif len(a_children) > 2:
                    location_span = a_children[2].find('span', {'aria-hidden': 'true'})
                    if location_span:
                        location = location_span.get_text(strip=True)
                    
            # Descrizione - secondo fratello del padre del tag <a>
            description = None
            a_parent = a_tag.parent
            if a_parent:
                siblings = [child for child in a_parent.parent.children if isinstance(child, Tag)]
                # Trova l'indice del padre del tag <a>
                a_parent_index = None
                for i, sibling in enumerate(siblings):
                    if a_tag in sibling.find_all('a'):
                        a_parent_index = i
                        break
                
                if a_parent_index is not None and a_parent_index + 1 < len(siblings):
                    description_div = siblings[a_parent_index + 1]
                    if description_div and description_div.name == 'div':
                        desc_span = description_div.find('span')
                        if desc_span:
                            description = desc_span.get_text(strip=True)
            
            return {
                'position_title': position_title,
                'description': description,
                'duration': role_duration,
                'location': location
            }
        

        soup = BeautifulSoup(html, 'html.parser')
        
        # Trova il tag main
        main_tag = soup.find('main')
        if not main_tag:
            return []
        
        # Trova il primo <ul> nel main
        ul_tag = main_tag.find('ul')
        if not ul_tag:
            return []
        
        # Trova tutti gli elementi <li> figli diretti
        experience_items = ul_tag.find_all('li', recursive=False)
        
        experiences = []
        
        for li in experience_items:
            experience = parse_single_experience(li)
            if experience:
                experiences.append(experience)
        
        return experiences

    experience_url = profile_url.rstrip("/") + "/details/experience/"
    experiences = parse_experiences(get_html(experience_url))

    # 3. Recupero formazione
    def parse_educations(html):
        """
        Parsa le esperienze lavorative da un profilo LinkedIn HTML.
        
        Args:
            html (str): HTML del profilo LinkedIn
            
        Returns:
            list: Lista di dizionari con le esperienze lavorative
        """


        def parse_single_education(li):
            """
            Parsa una singola formazione da un elemento <li>.
            
            Args:
                li: Elemento BeautifulSoup <li>
                
            Returns:
                dict: Dizionario con i dati della formazione
            """

            # Trova tutti i tag <a> con la classe specifica
            a_tags = li.find_all('a', class_='optional-action-target-wrapper display-flex flex-column full-width')
            
            if not a_tags:
                return None
            
            a_tag = a_tags[0]
            # Ottieni i figli diretti del tag <a> che sono effettivamente tag HTML
            a_children = [child for child in a_tag.children if isinstance(child, Tag)]
            
            if len(a_children) < 1:
                return None
            
            # Nome università
            university_name = None
            first_child = a_children[0]
            if first_child:
                first_span = first_child.find('span')
                if first_span:
                    university_name = first_span.get_text(strip=True)
            
            # Corso di studi
            degree_name = None
            if len(a_children) > 1:
                second_child = a_children[1]
                if second_child and set(second_child.get('class', [])) == {"t-14", "t-normal"}:
                    degree_span = second_child.find('span', {'aria-hidden': 'true'})
                    if degree_span:
                        degree_name = degree_span.get_text(strip=True)
                
            return {
                'university_name': university_name,
                'degree_name': degree_name
            }

        soup = BeautifulSoup(html, 'html.parser')
        
        # Trova il tag main
        main_tag = soup.find('main')
        if not main_tag:
            return []
        
        # Trova il primo <ul> nel main
        ul_tag = main_tag.find('ul')
        if not ul_tag:
            return []
        
        # Trova tutti gli elementi <li> figli diretti
        education_items = ul_tag.find_all('li', recursive=False)
        
        educations = []
        
        for li in education_items:
            education = parse_single_education(li)
            if education:
                educations.append(education)
        
        return educations

    education_url = profile_url.rstrip("/") + "/details/education/"
    educations = parse_educations(get_html(education_url))

    return {
        "name": full_name,
        "subtitle": subtitle,
        "profile_img": img_url,
        "description": long_description,
        "experiences": experiences,
        "educations": educations
    }

def get_tech_recruiter_emails(company_name: str):
    """
    Recupera le email associate a recruiter tech da un dominio usando Hunter.io.

    Args:
        domain (str): Il dominio aziendale, es. "microsoft.com"

    Returns:
        list of dict: Lista di email con nome, ruolo e score.
    """
    def get_company_domain(company):
        """
        Uses Google search results and DeepSeek to identify the official About page of a company.
        
        Args:
            company (str): The company name to search for
            
        Returns:
            str or None: URL of the company's About page, or None if not found
        """
        # Search for the company's about page
        results_raw = search_on_google(company, "", 10)
        
        if not results_raw:
            logging.info("Nessun risultato trovato.")
            return None
        
        # Mantieni solo il primo risultato per ogni dominio (ordine originale)
        seen = set()
        domains = []
        for item in results_raw:
            if "link" not in item or "title" not in item:
                continue
            domain = urlparse(item["link"]).netloc.replace("www.", "")
            if domain not in seen:
                seen.add(domain)
                domains.append({"domain": domain, "title": item["title"]})

        # Ritorna il dominio se cè un solo risultato
        if len(domains) == 1:
            return domains[0]["domain"]

        # Scelte numeriche (es. "1, 2, 3")
        choices_str = ", ".join(str(i) for i in range(1, len(domains) + 1))
        
        # Prompt migliorato
        prompt = f"""
        # Task: Identify the Most Likely Corporate Email Domain
        You need to determine which of the following domains is most likely used for employee email addresses at '{company}' 
        (e.g., for common staff such as HR, administration, etc.).

        ## Instructions:
        - Respond with ONLY a single number: {choices_str}
        - Do NOT include explanations or additional text.
        - Prefer the **main corporate domain** (e.g., 'company.com') over support, regional, or campaign-specific domains.
        - Choose the domain that is most likely used by regular employees for work email addresses.

        ## Domains:
        """

        for idx, r in enumerate(domains, 1):
            prompt += f"{idx}. {r['domain']} — {r['title']}\n"

        try:
            deepseek_response = ai_chat(prompt).strip()
            selected_index = int(deepseek_response)
        except Exception as e:
            logging.info(f"Errore chiamata DeepSeek o conversione numero: {e}")
            return None
        
        if 1 <= selected_index <= len(domains):
            return domains[selected_index - 1]["domain"]
        else:
            return None

    domain = get_company_domain(company_name)
    
    api_key = "6f3491ede7cbfb100ba45cd947266dce3511b58c"
    url = "https://api.hunter.io/v2/domain-search"
    params = {
        "domain": domain,
        "api_key": api_key,
        "department": "hr"
    }

    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise Exception(f"Errore {response.status_code}: {response.text}")

    data = response.json()
    #logging.info("Hunter.io response:", data)
    emails = data.get("data", {}).get("emails", [])

    entries = []
    for e in emails:
        full_name = f"{e.get('first_name', '')} {e.get('last_name', '')}".strip()
        position = e.get("position", "N/A")
        entries.append(f"{full_name} - {position}")

    # Filtra per recruiter / hr / talent in ambito tech
    keywords = ["recruiter", "talent", "hr", "human resources", "tech", "technology"]
    filtered_emails = [
        {
            "email": email["value"],
            "name": email.get("first_name", "") + " " + email.get("last_name", ""),
            "position": email.get("position"),
            "score": email.get("confidence")
        }
        for email in emails
        if email.get("position") and any(kw in email["position"].lower() for kw in keywords)
    ]
    logging.info("Filtered emails:", filtered_emails)
    return filtered_emails

import math

def find_company_recruiters_old(azienda, parametri=None, n_profiles=10, superficial_recruiter_target="", user_profile=""):
    """
    Search for recruiters associated with a specific company using AI-powered ranking and cascade evaluation.
    
    The function uses a cascading approach:
    1. Execute a single query and rank results
    2. Perform deep evaluation in smaller batches (2-3 profiles at a time)
    3. If excellent profiles (score >= 7) are found, immediately add them to results
    4. If n_profiles excellent profiles are reached, return immediately
    5. Otherwise, proceed to next less restrictive query
    6. Fallback: return best n_profiles from all evaluated profiles
    
    Args:
        azienda (str): Company name or LinkedIn company URL
        parametri (list): Ordered list (most to least important) of parameter objects 
                         with format {'campo': str, 'valori': list}
        n_profiles (int): Target number of excellent profiles to find (default: 10)
        
    Returns:
        list: List of recruiter profiles with AI scores, ordered by quality
    """

    def execute_single_search(mandatory_params, optional_params, search_type=""):
        """Execute a single search with given parameters"""
        query = build_query(mandatory_params, optional_params)
        if search_type:
            logging.info(f"Executing {search_type} search with {len(optional_params)} optional params")
        
        return execute_search(query)

    def execute_search(query):
        """Execute search with given query parameters using RocketReach API"""
        api_key = "1a67520k2f617e5e7b7938a033825dd341579c7f"
        url = "https://api.rocketreach.co/api/v2/person/search"
       
        payload = {
            "query": query,
            "page_size": 20  # Standard API limit
        }

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Api-Key": api_key
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()
            profiles = data.get("profiles", [])

            nonlocal evaluated_names
            evaluated_names |= {f"-{p['name']}" for p in profiles if p.get("name")}

            return profiles
            
        except requests.RequestException as e:
            logging.info(f"Error executing search: {e}")
            return []

    def build_query(mandatory, optional_params):
        """Build API query from mandatory and optional parameters"""
        query = mandatory.copy()
        query["name"] = list(evaluated_names)
        for param in optional_params:
            query[param['campo']] = param['valori']
        return query

    def calculate_initial_ranking(profile, position_in_results, query_precision_score, superficial_score):
        """
        Calculate initial ranking score for a profile.
        Combines AI superficial score, result relevance, and query precision.
        """
        # Result relevance (higher for profiles appearing first)
        # Score decreases from 10 to 1 based on position (max 25 results per query)
        relevance_score = max(1, 10 - (position_in_results * 9 / 24))
        
        # Combine scores (weights: AI=50%, relevance=25%, precision=25%)
        total_score = (
            superficial_score * 0.5 + 
            relevance_score * 0.25 + 
            query_precision_score * 0.25
        )
        
        return {
            'profile': profile,
            'initial_score': total_score,
            'superficial_ai_score': superficial_score,
            'relevance_score': relevance_score,
            'query_precision_score': query_precision_score,
            'deep_evaluated': False,
            'final_ai_score': None
        }

    def get_batch_superficial_ai_scores(profiles):
        """Get AI evaluation for multiple profiles in batch"""
        try:
            if not profiles:
                return {}
            
            # Build batch prompt with all profiles
            profiles_text = ""
            for i, profile in enumerate(profiles, 1):
                name = profile.get('name', 'Unknown')
                title = profile.get('current_title', 'No title')
                company = profile.get('current_employer', 'Unknown company')
                location = profile.get('location', profile.get('country', 'Location not specified'))
                
                profiles_text += f"""

    Profile {i}:
    - Name: {name}
    - Current Title: {title}
    - Company: {company}
    - Location: {location}
    """
            
            chat_prompt = f"""Evaluate these profiles on a scale of 1-10 as potential contacts for the company "{azienda}" based on the target recruiter profile.

    TARGET PROFILE: 
    {superficial_recruiter_target}

    PROFILES: 
    {profiles_text}

    EVALUATION CRITERIA:

    1. TARGET PROFILE ALIGNMENT (0-6 points)
    - Perfect match with target requirements: 5-6 points
    - Good alignment: 3-4 points
    - Partial alignment: 1-2 point
    - No alignment: 0 points

    2. ROLE RELEVANCE (0-4 points)
    - HR/Recruiting roles: 4 points
    - Leadership positions (C-level, Directors, VPs): 4 points
    - Management roles: 1-3 points
    - Other roles: 0-1 points

    SCORING: Sum all points

    STRICT RULES:
    - Output valid JSON only, no extra text.
    - Keys: profile number as string.
    - Values: integer 1–10 (round if out of range).

    Example:
    {{"1": 7, "2": 5, "3": 9}}

    ...

    If profile is from different company, automatically assign score 1.
            """
            
            response = ai_chat(chat_prompt)
            
            clean_response = re.sub(r'^```json\s*|```$', '', response, flags=re.DOTALL).strip()
            scores = {}
            
            try:
                parsed_scores = json.loads(clean_response)
            except json.JSONDecodeError:
                raise ValueError("Model response is not valid JSON.")

            for idx_str, score in parsed_scores.items():
                try:
                    profile_idx = int(idx_str) - 1  # 0-based index
                    score = max(1, min(10, int(score)))  # Clamp score to 1-10
                except (ValueError, TypeError):
                    continue  # Skip invalid entries

                if 0 <= profile_idx < len(profiles):
                    profile_id = profiles[profile_idx].get('id')
                    scores[profile_id] = score

            # Fill missing scores with default value
            for profile in profiles:
                profile_id = profile.get('id')
                if profile_id not in scores:
                    scores[profile_id] = 5
            
            return scores
            
        except Exception as e:
            logging.info(f"Error in batch superficial AI scoring: {e}")
            # Return default scores for all profiles
            return {profile.get('id'): 5 for profile in profiles}

    def remove_duplicates(new_results, existing_results):
        """Remove duplicates based on profile ID"""
        existing_ids = {result['profile'].get('id') for result in existing_results}
        return [result for result in new_results if result['profile'].get('id') not in existing_ids]

    
    def process_and_evaluate_batch(temp_profiles, query_precision_score, force_evaluation=False):
        """Process a batch of profiles with superficial and deep evaluation"""
        if not temp_profiles:
            return []
        
        # Reduced batch size threshold for faster processing
        if len(temp_profiles) < 3 and not force_evaluation:
            return []  # Wait for more profiles (reduced from 5 to 3)
        
        logging.info(f"Processing batch of {len(temp_profiles)} profiles...")
        
        # Step 1: Batch superficial evaluation
        batch_superficial_scores = get_batch_superficial_ai_scores([p['profile'] for p in temp_profiles])
        
        # Step 2: Apply superficial scores and filter
        qualified_profiles = []
        for temp_profile in temp_profiles:
            profile_id = temp_profile['profile'].get('id')
            superficial_score = batch_superficial_scores.get(profile_id, 5)
            
            # Update the temp profile with superficial score
            temp_profile['superficial_ai_score'] = superficial_score
            
            # Recalculate initial ranking with actual superficial score
            relevance_score = max(1, 10 - (temp_profile['position'] * 9 / 9))
            temp_profile['relevance_score'] = relevance_score
            temp_profile['query_precision_score'] = query_precision_score
            temp_profile['initial_score'] = (
                superficial_score * 0.7 + 
                relevance_score * 0.1 + 
                query_precision_score * 0.2
            )
            
            # Filter: only profiles with superficial score >= 5
            if superficial_score >= 5:
                qualified_profiles.append(temp_profile)
            else:
                logging.info(f"  Filtered out profile (superficial score: {superficial_score} < 5)")
        
        logging.info(f"  {len(qualified_profiles)}/{len(temp_profiles)} profiles passed superficial filter (score >= 5)")
        
        if not qualified_profiles:
            return []
        
        # Step 3: Sort by initial ranking
        qualified_profiles.sort(key=lambda x: x['initial_score'], reverse=True)
        
        # Step 4: Deep evaluation in smaller batches (2-3 profiles at a time)
        logging.info(f"  Performing deep evaluation on {len(qualified_profiles)} qualified profiles in small batches...")
        evaluated_profiles = get_batch_deep_evaluations_optimized(qualified_profiles, azienda)
        
        return evaluated_profiles
    
    def get_batch_deep_evaluations_optimized(ranked_profiles, azienda):
        """Perform deep evaluation for multiple profiles in smaller batches with early termination"""
        nonlocal excellent_profiles, n_profiles  # Access parent scope variables
        
        def search_and_get_linkedin_profile(profile_name):
            """
            Cerca il profilo LinkedIn tramite Google e restituisce i dati del profilo.
            Fallback function per quando get_linkedin_profile_data fallisce.
            """
            try:
                # Cerca profili LinkedIn su Google
                search_results = search_on_google(f'"{profile_name}" {azienda} LinkedIn site:linkedin.com/in', exclude_url="")
                
                if not search_results:
                    return None
                
                # Filtra solo i link di profili LinkedIn validi
                linkedin_links = []
                seen_urls = set()
                
                for item in search_results:
                    link = item.get("link", "")
                    title = item.get("title", "")
                    snippet = item.get("snippet", "")
                    
                    if (link.startswith("https://www.linkedin.com/in/") or 
                        link.startswith("https://linkedin.com/in/")) and link not in seen_urls:
                        seen_urls.add(link)
                        linkedin_links.append({"url": link, "title": title, "snippet": snippet})
                
                if not linkedin_links:
                    return None
                
                # Se c'è un solo risultato, usalo direttamente
                if len(linkedin_links) == 1:
                    selected_url = linkedin_links[0]["url"]
                else:
                    # Usa AI per scegliere il profilo più pertinente
                    selected_url = select_best_linkedin_profile(profile_name, linkedin_links)
                    if not selected_url:
                        # Se AI fallisce, usa il primo risultato
                        selected_url = linkedin_links[0]["url"]
                
                # Prova a ottenere i dati del profilo selezionato
                linkedin_data = get_linkedin_profile_data(selected_url)
                
                # Verifica se i dati sembrano corretti usando AI
                if linkedin_data:
                    return linkedin_data
                else:
                    # Se il profilo non sembra corretto, prova con altri risultati
                    for link_data in linkedin_links[1:]:  # Salta il primo già provato
                        try:
                            alternative_data = get_linkedin_profile_data(link_data["url"])
                            if alternative_data:
                                return alternative_data
                        except:
                            continue
                
                return None
                
            except Exception as e:
                logging.info(f"Error in search_and_get_linkedin_profile for {profile_name}: {e}")
                return None

        def select_best_linkedin_profile(profile_name, linkedin_links):
            """
            Usa AI per selezionare il profilo LinkedIn più pertinente dalla lista.
            """
            try:
                if len(linkedin_links) <= 1:
                    return linkedin_links[0]["url"] if linkedin_links else None
                
                # Scelte numeriche
                choices_str = ", ".join(str(i) for i in range(1, len(linkedin_links) + 1))
                
                prompt = f"""
    **Task:** Identify the most relevant LinkedIn profile.  
    Select which of the following profiles is most likely to be **"{profile_name}"** at **"{azienda}"**, probably in **HR**, as **founder**, or in a **senior/executive role**.

    **Instructions:**
    - Reply **ONLY** with the number: {choices_str}  
    - No explanations or extra text  
    - Match priority:  
    1. Name similarity (**"{profile_name}"**)  
    2. Company match (**"{azienda}"**)  
    3. Role relevance (HR, founder, senior/executive)

    **Profiles:**

        """
                
                for idx, link_data in enumerate(linkedin_links, 1):
                    prompt += f"{idx}. {link_data['url']} — {link_data['title']} | {link_data['snippet']}\n"
                
                deepseek_response = ai_chat(prompt).strip()
                selected_index = int(deepseek_response)
                
                if 1 <= selected_index <= len(linkedin_links):
                    return linkedin_links[selected_index - 1]["url"]
                else:
                    return None
                    
            except Exception as e:
                logging.info(f"Error in select_best_linkedin_profile: {e}")
                return None

        def is_currently_working_at_company(linkedin_data, target_company):
            """
            Verifica se il profilo lavora attualmente nell'azienda target.
            """
            target_lower = target_company.lower()
            for exp in linkedin_data.get("experience", []):
                company_name = exp.get("company", "").lower()
                if target_lower in company_name:
                    # Controlla se 'Present' appare nel totale o in qualche ruolo
                    if "Present" in exp.get("total", ""):
                        return True
                    for role_str in exp.get("roles", []):
                        if "Present" in role_str:
                            return True
            return False

        try:
            if not ranked_profiles:
                return []
            
            profiles_with_linkedin = []
            profiles_without_linkedin = []
            
            for ranked_profile in ranked_profiles:
                profile = ranked_profile['profile']
                if profile.get('linkedin_url'):
                    profiles_with_linkedin.append(ranked_profile)
                else:
                    ranked_profile['final_ai_score'] = ranked_profile['superficial_ai_score']
                    ranked_profile['deep_evaluated'] = True
                    profiles_without_linkedin.append(ranked_profile)
            
            if not profiles_with_linkedin:
                return profiles_without_linkedin
            
            SMALL_BATCH_SIZE = 5
            num_profiles = len(profiles_with_linkedin)
            all_evaluated = profiles_without_linkedin.copy()
            
            # --- NUOVA LOGICA: BATCH DINAMICO ---
            # Usiamo un indice per scorrere tutti i profili con LinkedIn disponibili.
            current_profile_index = 0
            
            # Continuiamo finché non abbiamo processato tutti i profili o raggiunto il target.
            while current_profile_index < num_profiles and len(excellent_profiles) < n_profiles:
                
                logging.info(f"\nBuilding new deep evaluation batch (Target size: {SMALL_BATCH_SIZE})...")
                
                # Questo batch conterrà solo profili con dati LinkedIn validi.
                valid_batch_profiles = []
                
                # Cicliamo per trovare abbastanza profili VALIDI per riempire il batch.
                while len(valid_batch_profiles) < SMALL_BATCH_SIZE and current_profile_index < num_profiles:
                    
                    # Prendiamo il prossimo profilo dalla lista e avanziamo subito l'indice.
                    ranked_profile = profiles_with_linkedin[current_profile_index]
                    current_profile_index += 1

                    profile = ranked_profile['profile']
                    linkedin_url = profile.get('linkedin_url')
                    linkedin_data = None
                    
                    logging.info(f"  Checking profile {current_profile_index}/{num_profiles}: {profile.get('name', 'Unknown')}")
                    
                    try:
                        linkedin_data = get_linkedin_profile_data(linkedin_url)
                    except Exception as e:
                        logging.info(f"    - Error getting LinkedIn data, attempting search fallback...")
                        try:
                            profile_name = profile.get('name', '')
                            if profile_name:
                                linkedin_data = search_and_get_linkedin_profile(profile_name)
                        except Exception as search_e:
                            logging.info(f"    - LinkedIn search fallback failed: {search_e}")
                    
                    # Se abbiamo dati LinkedIn E il profilo lavora attualmente nell'azienda...
                    if linkedin_data and is_currently_working_at_company(linkedin_data, azienda):
                        logging.info(f"    ✓ Valid profile. Adding to batch ({len(valid_batch_profiles) + 1}/{SMALL_BATCH_SIZE}).")
                        valid_batch_profiles.append({
                            'original_ranked_profile': ranked_profile,
                            'linkedin_data': linkedin_data
                        })
                    else:
                        # Profilo non valido (non lavora più lì o dati non trovati).
                        logging.info(f"    ✗ Invalid profile or not current employee. Using superficial score.")
                        ranked_profile['final_ai_score'] = ranked_profile['superficial_ai_score']
                        ranked_profile['deep_evaluated'] = True
                        all_evaluated.append(ranked_profile)
                
                # Se, dopo aver cercato, non abbiamo trovato nessun profilo valido per il batch, continuiamo.
                if not valid_batch_profiles:
                    logging.info("Could not form a valid batch from remaining profiles.")
                    continue

                # Ora che abbiamo un batch pieno (o con tutti i profili validi rimasti), lo processiamo.
                logging.info(f"Processing batch of {len(valid_batch_profiles)} valid profiles...")
                
                # Costruisci il prompt per il batch corrente
                profiles_data = []
                for j, profile_eval in enumerate(valid_batch_profiles):
                    profiles_data.append(f"Profile {j+1}:\n{profile_eval['linkedin_data']}\n")
                
                profiles_text = "".join(profiles_data)
                
                # ... (il codice per costruire 'chat_prompt' e chiamare 'ai_chat(chat_prompt)' rimane invariato) ...
                chat_prompt = f"""# CONTEXT
Your objective is to evaluate each recruiter's suitability for recruiting the candidate described in the USER PROFILE for a position at the company "{azienda}". The score must reflect how objectively the recruiter matches this specific candidate, based exclusively on the following rules.

# USER PROFILE: 
{user_profile}

---

# RECRUITER PROFILES: 
{profiles_text}

---

# ALGORITHMIC EVALUATION PROCESS:

### STEP 1: DETAILED EVALUATION (Total: 10 points)
For each recruiter, calculate their score by summing the points from each of the following categories.

#### 1. WORK EXPERIENCE (0-3 points)
This criterion measures the alignment between the recruiter's experience and the candidate's background. Apply the following rules in order:
- **3 points (Same company history):** Award 3 points ONLY IF the recruiter's work history includes one or more of the same companies listed in the **candidate's work history**. Their role at that company does not matter for this rule.
- **2 points (Same industry + similar skills focus):** If the 3-point rule is not met, award 2 points ONLY IF **both** of the following conditions are true:
    a) The recruiter works in the candidate's primary industry.
    b) Their profile explicitly states they hire for roles similar to the candidate's OR they support relevant departments (e.g., "Engineering", "R&D", "Product").
- **1 point (Same industry only):** If the 2-point rule is not met, award 1 point if the recruiter works in the candidate's primary industry but supports non-relevant departments (e.g., "Corporate Functions", "Marketing", "Sales") or if their supported department is not specified.
- **0 points (No overlap):** If none of the conditions above are met.

#### 2. EDUCATION (0-2 points)
- **2 points:** Same university as the candidate.
- **1 point:** Same field of study as the candidate.
- **0 points:** No similarity.

#### 3. GEOGRAPHIC ALIGNMENT (0-2 points)
- **2 points:** Same nationality as the candidate AND their profile indicates a focus on the candidate's geographic area.
- **1 point:** Same nationality as the candidate OR their profile indicates coverage of the candidate's geographic area.
- **0 points:** No geographic alignment.

#### 4. RECRUITING EXPERIENCE (0-2 points)
- To score any points in this category, the recruiter's profile (in the summary or job descriptions) MUST contain at least one of the following keywords: **"recruiting", "sourcing", "talent acquisition", "staffing", "hiring", "headhunting"**.
    - **2 points:** If one of the keywords is present AND the role is senior-level with 2+ years of experience.
    - **1 point:** If one of the keywords is present AND the role is junior-level with less than 2 years of experience.
    - **0 points:** If none of the keywords are present, regardless of the job title (this includes HR Business Partner roles).

#### 5. PROFILE QUALITY (0-1 point)
- **1 point:** The profile has a summary and detailed experience descriptions.
- **0 points:** The profile is incomplete.

---

# OUTPUT REQUIREMENTS:
- **Format**: Valid JSON only, with no additional text.
- **Keys**: Profile number as a string (e.g., "1", "2", "3", ...).
- **Values**: Integer score from 0 to 10.

# EXAMPLE OUTPUT:
{{"1": 2,"2": 4,"3": 8,"4": 3, "5": 2}}
"""
                
                scores = ai_chat(chat_prompt, format="json")

                # Processa i punteggi come prima
                for idx_str, score in scores.items():
                    try:
                        response_idx = int(idx_str) - 1
                        score = max(1, min(10, int(score)))
                        
                        if 0 <= response_idx < len(valid_batch_profiles):
                            ranked_profile = valid_batch_profiles[response_idx]['original_ranked_profile']
                            ranked_profile['final_ai_score'] = score
                            ranked_profile['deep_evaluated'] = True
                            all_evaluated.append(ranked_profile)
                            
                            if score >= 7:
                                excellent_profiles.append(ranked_profile)
                                logging.info(f"  ✓ EXCELLENT profile found (score: {score}) - Total: {len(excellent_profiles)}/{n_profiles}")
                    except (ValueError, TypeError):
                        continue
                
                # Il controllo di terminazione anticipata è implicito nel loop 'while' principale.

            # Se usciamo dal loop perché abbiamo esaurito i profili, ma ne restano alcuni non processati
            # nella lista originale, li marchiamo come valutati superficialmente.
            if current_profile_index < num_profiles:
                logging.info("🎯 TARGET REACHED! Stopping deep evaluation.")
                for i in range(current_profile_index, num_profiles):
                    remaining_profile = profiles_with_linkedin[i]
                    remaining_profile['final_ai_score'] = remaining_profile['superficial_ai_score']
                    remaining_profile['deep_evaluated'] = True
                    all_evaluated.append(remaining_profile)
            
            return all_evaluated
            
        except Exception as e:
            logging.info(f"Error in batch deep evaluation: {e}")
            for ranked_profile in ranked_profiles:
                if ranked_profile['final_ai_score'] is None:
                    ranked_profile['final_ai_score'] = ranked_profile['superficial_ai_score']
                    ranked_profile['deep_evaluated'] = True
            return ranked_profiles            
                
    # Main execution variables
    all_deep_evaluated = []  # All profiles that received deep evaluation
    excellent_profiles = []  # Profiles with final score >= 7 (moved to function scope)
    all_found_ids = set()  # Track IDs to avoid duplicates across queries
    temp_profiles_batch = []  # Temporary batch for processing
    parametri_opzionali = parametri.copy() if parametri else []
    evaluated_names = set()

    logging.info(f"=== CASCADING BATCH SEARCH FOR {n_profiles} EXCELLENT RECRUITERS ===")
    logging.info(f"Target: Profiles with AI score >= 7")
    logging.info("Using optimized batch evaluation with 3-profile threshold and 2-profile LinkedIn batches")
    
    # Prepare query parameters
    # Replaced: base_mandatory_params logic
    base_mandatory_params = {}
    
    # Determine company parameter type
    if azienda.startswith('https://linkedin.com/company/') or azienda.startswith('https://www.linkedin.com/company/'):
        base_mandatory_params['company_linkedin_url'] = [azienda]
    else:
        base_mandatory_params['company_name'] = [azienda]
    
    # Department-based mandatory parameters
    dept_mandatory_params = base_mandatory_params.copy()
    dept_mandatory_params['department'] = ['Recruiting', 'Talent Management']
    
    # Title-based alternative parameters
    title_based_params = base_mandatory_params.copy()
    title_based_params['current_title'] = [
        'recruiter', 'recruiting', 'talent management', 'talent manager', 
        'hr', 'human resources', 'talent acquisition', 'hiring manager',
        'people operations', 'talent partner', 'staffing', 'headhunter',
        'talent sourcer', 'recruitment specialist', 'hr business partner'
    ]
    
    # Replaced: execute_single_search
    # Replaced: build_query  
    # Replaced: execute_search
    # Replaced: calculate_initial_ranking
    
    # Cascading search process
    current_optional = parametri_opzionali.copy()
    query_level = 0
    queries_exhausted = False
    
    while len(excellent_profiles) < n_profiles and not queries_exhausted:
        query_level += 1
        current_restriction_level = len(current_optional)
        query_precision_score = min(10, (len(current_optional) + 1) * 2)
        
        logging.info(f"\n=== QUERY LEVEL {query_level} ===")
        logging.info(f"Restriction level: {current_restriction_level} optional parameters (precision: {query_precision_score})")
        logging.info(f"Current excellent profiles: {len(excellent_profiles)}/{n_profiles}")
        logging.info(f"Temp batch size: {len(temp_profiles_batch)}")
        
        # Execute department-based search
        dept_results = execute_single_search(dept_mandatory_params, current_optional, "department-based")
        new_dept_profiles = 0
        
        # Process department results
        for i, profile in enumerate(dept_results):
            profile_id = profile.get('id')
            if profile_id not in all_found_ids:
                all_found_ids.add(profile_id)
                temp_profile = {
                    'profile': profile,
                    'position': i,
                    'deep_evaluated': False,
                    'final_ai_score': None
                }
                temp_profiles_batch.append(temp_profile)
                new_dept_profiles += 1
        
        logging.info(f"Department search: {new_dept_profiles} new profiles")
        
        # Process department batch if threshold reached (reduced to 3)
        if len(temp_profiles_batch) >= 3 or (len(temp_profiles_batch) > 0 and len(excellent_profiles) + len(temp_profiles_batch) >= n_profiles):
            logging.info(f"\n🔄 Processing department batch (size: {len(temp_profiles_batch)})...")
            evaluated_profiles = process_and_evaluate_batch(temp_profiles_batch, query_precision_score)
            
            # Add to main list (excellent profiles already added in get_batch_deep_evaluations_optimized)
            all_deep_evaluated.extend(evaluated_profiles)
            
            # Clear temp batch
            temp_profiles_batch = []
            
            # Check if target reached after department processing
            if len(excellent_profiles) >= n_profiles:
                logging.info(f"\n🎯 TARGET REACHED after department search! Found {len(excellent_profiles)} excellent profiles")
                break
        
        # Execute title-based search only if we still need more profiles
        if len(excellent_profiles) < n_profiles:
            title_results = execute_single_search(title_based_params, current_optional, "title-based")
            new_title_profiles = 0
            
            # Process title results
            for i, profile in enumerate(title_results):
                profile_id = profile.get('id')
                if profile_id not in all_found_ids:
                    all_found_ids.add(profile_id)
                    temp_profile = {
                        'profile': profile,
                        'position': i,
                        'deep_evaluated': False,
                        'final_ai_score': None
                    }
                    temp_profiles_batch.append(temp_profile)
                    new_title_profiles += 1
            
            logging.info(f"Title search: {new_title_profiles} new profiles")
            logging.info(f"Total temp batch size: {len(temp_profiles_batch)}")
            
            # Process title batch if threshold reached (reduced to 3)
            if len(temp_profiles_batch) >= 3 or (len(temp_profiles_batch) > 0 and len(excellent_profiles) + len(temp_profiles_batch) >= n_profiles):
                logging.info(f"\n🔄 Processing title batch (size: {len(temp_profiles_batch)})...")
                evaluated_profiles = process_and_evaluate_batch(temp_profiles_batch, query_precision_score)
                
                # Add to main list (excellent profiles already added in get_batch_deep_evaluations_optimized)
                all_deep_evaluated.extend(evaluated_profiles)
                
                # Clear temp batch
                temp_profiles_batch = []
                
                # Check if target reached
                if len(excellent_profiles) >= n_profiles:
                    logging.info(f"\n🎯 TARGET REACHED after title search! Found {len(excellent_profiles)} excellent profiles")
                    break
        
        # Check if no new profiles found in this query level
        total_new_profiles = new_dept_profiles + (new_title_profiles if 'new_title_profiles' in locals() else 0)
        
        if total_new_profiles == 0:
            if current_optional:
                # Remove least important parameter
                removed_param = current_optional.pop()
                logging.info(f"No new profiles found. Removing parameter: {removed_param}")
                continue
            else:
                # Try management levels fallback
                logging.info("No optional parameters left. Trying management levels fallback...")
                fallback_params = base_mandatory_params.copy()
                fallback_params['management_levels'] = ['Founder/Owner', 'C-Level', 'Vice President', 'Head']
                
                fallback_results = execute_search(fallback_params)
                new_fallback_profiles = 0
                
                for i, profile in enumerate(fallback_results):
                    profile_id = profile.get('id')
                    if profile_id not in all_found_ids:
                        all_found_ids.add(profile_id)
                        temp_profile = {
                            'profile': profile,
                            'position': i,
                            'deep_evaluated': False,
                            'final_ai_score': None
                        }
                        temp_profiles_batch.append(temp_profile)
                        new_fallback_profiles += 1
                
                logging.info(f"Management fallback: {new_fallback_profiles} new profiles")
                
                if new_fallback_profiles == 0:
                    queries_exhausted = True
                    logging.info("All query possibilities exhausted.")
                    break
        else:
            # Move to next restriction level if current_optional is not empty
            if current_optional:
                removed_param = current_optional.pop()
                logging.info(f"\nMoving to next restriction level. Removing parameter: {removed_param}")
            else:
                queries_exhausted = True
                
    # Process any remaining profiles in temp batch
    if temp_profiles_batch and len(excellent_profiles) < n_profiles:
        logging.info(f"\n🔄 Processing final batch of {len(temp_profiles_batch)} profiles...")
        evaluated_profiles = process_and_evaluate_batch(temp_profiles_batch, query_precision_score, force_evaluation=True)
        
        # Add to main list (excellent profiles already added in get_batch_deep_evaluations_optimized)
        all_deep_evaluated.extend(evaluated_profiles)
    
    # Final results determination
    logging.info(f"\n=== FINAL RESULTS ===")
    
    if len(excellent_profiles) >= n_profiles:
        # Success scenario: return excellent profiles
        logging.info(f"🎯 SUCCESS: Found {len(excellent_profiles)} excellent profiles (score >= 7)")
        final_results = excellent_profiles[:n_profiles]
    else:
        # Fallback scenario: return best evaluated profiles
        logging.info(f"⚠️  FALLBACK: Only {len(excellent_profiles)} excellent profiles found")
        logging.info(f"Returning top {n_profiles} from {len(all_deep_evaluated)} evaluated profiles")
        
        # Sort all deep evaluated profiles by final score
        all_deep_evaluated.sort(key=lambda x: x['final_ai_score'], reverse=True)
        final_results = all_deep_evaluated[:n_profiles]
    
    # Prepare final output with scores
    output_results = []
    for ranked_profile in final_results:
        profile_data = ranked_profile['profile'].copy()
        profile_data['ai_scores'] = {
            'initial_ranking_score': ranked_profile['initial_score'],
            'superficial_ai_score': ranked_profile['superficial_ai_score'],
            'final_ai_score': ranked_profile['final_ai_score'],
            'is_excellent': ranked_profile['final_ai_score'] >= 7
        }
        output_results.append(profile_data)
    
    logging.info(f"Returning {len(output_results)} profiles with AI scoring")
    logging.info(f"Total profiles evaluated: {len(all_deep_evaluated)}")
    return output_results

def generate_recruitment_email(articles_content, about_md, linkedin_md, user_info, recruiter_info):
    """
    Genera un'email personalizzata da inviare a un recruiter utilizzando le informazioni fornite.
    
    Args:
        articles_content (list): Lista di dizionari contenenti informazioni sugli articoli del blog
        about_md (str): Contenuto markdown della pagina 'About Us' dell'azienda
        linkedin_md (str): Contenuto markdown della pagina LinkedIn dell'azienda
        user_info (dict): Informazioni dell'utente/candidato
        recruiter_info (dict): Informazioni del recruiter
    
    Returns:
        str: L'email personalizzata pronta per essere inviata
    """
    
    # Preparazione dei dati per il prompt
    articles_text = ""
    for i, article in enumerate(articles_content, 1):
        articles_text += f"Articolo {i}:\nTitolo: {article['title']}\nURL: {article['url']}\n\nContenuto:\n{article['markdown']}\n\n"
    
    # Estrazione delle informazioni chiave dell'utente
    user_name = user_info.get("name", "")
    user_role = user_info.get("currentRole", "")
    user_skills = ", ".join(user_info.get("skills", []))
    user_experience = user_info.get("experience", "")
    
    # Estrazione delle informazioni chiave del recruiter
    recruiter_name = recruiter_info.get("name", "")
    recruiter_role = recruiter_info.get("role", "")
    company_name = recruiter_info.get("company", "")
    
    # Creazione del prompt dettagliato per l'AI
    prompt = f"""
    Sei un esperto di comunicazione professionale e sviluppo di carriera in ambito tech/IT. Il tuo compito è creare un'email di candidatura altamente personalizzata e persuasiva da inviare a un recruiter.
    
    # CONTESTO
    
    ## Informazioni sul candidato
    ```json
    {user_info}
    ```
    
    ## Informazioni sul recruiter
    ```json
    {recruiter_info}
    ```
    
    ## Informazioni sull'azienda dalla pagina "About Us"
    ```markdown
    {about_md}
    ```
    
    ## Informazioni aziendali da LinkedIn
    ```markdown
    {linkedin_md}
    ```
    
    ## Articoli recenti del blog aziendale
    {articles_text}
    
    # ISTRUZIONI
    
    Crea un'email di candidatura personalizzata che:
    
    1. Si rivolga direttamente al recruiter per nome e con un tono professionale ma non eccessivamente formale
    
    2. Abbia un oggetto incisivo e persuasivo che catturi l'attenzione
    
    3. Inizi con un'introduzione personale concisa che presenti il candidato e specifichi immediatamente l'interesse verso una posizione nell'azienda
    
    4. Faccia riferimento specifico e strategico ad almeno uno degli articoli del blog forniti, dimostrando una comprensione approfondita dei contenuti e collegandoli alle competenze o all'esperienza del candidato
    
    5. Evidenzi 2-3 realizzazioni chiave o competenze del candidato particolarmente rilevanti per l'azienda, basandosi sui valori e le tecnologie menzionate nelle informazioni aziendali
    
    6. Mostri un chiaro allineamento tra i valori/obiettivi del candidato e la cultura/missione dell'azienda
    
    7. Includa una call-to-action che richieda un colloquio o una conversazione, suggerendo anche disponibilità flessibile
    
    8. Si concluda in modo cortese e professionale
    
    9. Mantenga una lunghezza totale massima di 400 parole
    
    10. Sia strutturata in paragrafi brevi e leggibili
    
    # FORMATO OUTPUT
    
    Oggetto: [Oggetto dell'email]
    
    [Corpo dell'email]
    
    [Firma]
    
    La firma deve includere il nome completo del candidato, il suo ruolo attuale, eventuale link a portfolio/GitHub/LinkedIn e altre informazioni di contatto rilevanti.
    
    # NOTE IMPORTANTI
    
    - L'email deve essere autentica, non generica o eccessivamente commerciale.
    - Evita frasi fatte e luoghi comuni del settore recruitment.
    - Non esagerare con le lodi all'azienda; l'entusiasmo deve essere credibile.
    - I riferimenti agli articoli devono essere precisi e mostrare vera comprensione del contenuto.
    - Sii specifico riguardo a come il profilo del candidato si allinea con le esigenze dell'azienda.
    """
    
    # Invio del prompt all'API del modello AI
    generated_email = ai_chat(prompt)
    
    return generated_email

# Esempio di utilizzo:
articles_list = [
  {
    "href": "https://developers.redhat.com/articles/2025/05/02/red-hat-build-quarkus-3-20-release-highlights",
    "title": "Red Hat build of Quarkus 3.20: Release highlights for developers"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/05/01/how-external-secrets-operator-manages-quay-credentials",
    "title": "How the External Secrets Operator manages Quay credentials"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/05/01/native-network-segmentation-virtualization-workloads",
    "title": "Native network segmentation for virtualization workloads"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/30/how-run-performance-and-scale-validation-openshift-ai",
    "title": "How to run performance and scale validation for OpenShift AI"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/30/retrieval-augmented-generation-llama-stack-and-nodejs",
    "title": "Retrieval-augmented generation with Llama Stack and Node.js"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/29/accelerate-model-training-openshift-ai-nvidia-gpudirect-rdma",
    "title": "Accelerate model training on OpenShift AI with NVIDIA GPUDirect RDMA"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/29/how-reinforcement-learning-improves-deepseek-performance",
    "title": "How reinforcement learning improves DeepSeek performance"
  },
  {
    "href": "https://developers.redhat.com/blog/2025/04/28/red-hat-build-nodejs-essentials",
    "title": "Red Hat Build of Node.js Essentials"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/28/performance-boosts-vllm-081-switching-v1-engine",
    "title": "Performance boosts in vLLM 0.8.1: Switching to the V1 engine"
  },
  {
    "href": "https://www.redhat.com/en/about/our-culture/diversity-equity-inclusion",
    "title": "Inclusion at Red Hat"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/28/announcing-right-sizing-openshift-virtualization",
    "title": "Announcing right-sizing for OpenShift Virtualization"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/28/boost-openshift-database-vm-density-memory-overcommit",
    "title": "Boost OpenShift database VM density with memory overcommit"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/28/jboss-eap-8-1-beta-modernizing-enterprise-java",
    "title": "JBoss EAP 8.1 Beta: Modernizing enterprise Java applications"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/24/new-c-features-gcc-15",
    "title": "New C++ features in GCC 15"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/24/evaluating-memory-overcommitment-openshift-virtualization",
    "title": "Evaluating memory overcommitment in OpenShift Virtualization"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/22/how-neural-networks-might-actually-think",
    "title": "Cracking the code: How neural networks might actually “think”"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/23/how-use-content-templates-red-hat-insights",
    "title": "How to use content templates in Red Hat Insights"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/22/access-quay-openshift-short-lived-credentials",
    "title": "Access Quay on OpenShift with short-lived credentials"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/22/fine-tune-llms-kubeflow-trainer-openshift-ai",
    "title": "Fine-tune LLMs with Kubeflow Trainer on OpenShift AI"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/21/how-register-idm-deployment-rhel-domain-join",
    "title": "How to register IdM deployment with RHEL domain join"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/21/instance-enrollment-workflow-domain-join-rhel",
    "title": "Instance enrollment workflow for domain join in RHEL"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/17/how-short-lived-credentials-quay-improve-security",
    "title": "How short-lived credentials in Quay improve security"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/17/jlink-integration-openshift-tech-preview-release",
    "title": "Jlink integration with OpenShift tech preview release"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/16/gcc-and-gcc-toolset-versions-rhel-explainer",
    "title": "GCC and gcc-toolset versions in RHEL: An explainer"
  },
  {
    "href": "https://developers.redhat.com/blog/2025/04/15/camel-integration-quarterly-digest-q1-2025",
    "title": "Camel integration quarterly digest: Q1 2025"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/15/incident-detection-openshift-tech-preview-here",
    "title": "Incident detection for OpenShift tech preview is here"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/14/how-developer-hub-and-openshift-ai-work-openshift",
    "title": "How Developer Hub and OpenShift AI work with OpenShift"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/11/my-advice-selinux-container-labeling",
    "title": "My advice on SELinux container labeling"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/10/6-usability-improvements-gcc-15",
    "title": "6 usability improvements in GCC 15"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/10/how-building-workbenches-accelerates-aiml-development",
    "title": "How building workbenches accelerates AI/ML development"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/10/road-ai-guide-understanding-aiml-models",
    "title": "The road to AI: A guide to understanding AI/ML models"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/09/best-practices-migration-jaeger-tempo",
    "title": "Best practices for migration from Jaeger to Tempo"
  },
  {
    "href": "https://developers.redhat.com/blog/2025/04/08/essential-nodejs-observability-resources",
    "title": "Essential Node.js Observability Resources"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/07/how-build-ai-ready-applications-quarkus",
    "title": "How to build AI-ready applications with Quarkus"
  },
  {
    "href": "https://developers.redhat.com/articles/2025/04/05/llama-4-herd-here-day-zero-inference-support-vllm",
    "title": "Llama 4 herd is here with Day 0 inference support in vLLM"
  }
]

MAX_ARTICLES = 35

from candidai_script.database import save_articles

def get_blog_posts(user_id, ids, companies, user_info, target_position_description):
    results = {}
    start_time_total = time.time()
    company_durations = {}

    for company in companies:
        company = company["name"]
        start_time_company = time.time()
        
        articles, n_blogs = get_all_articles(company, target_position_description)
        relevant_articles = select_relevant_articles(articles, user_info, target_position_description, company)
        articles_content = extract_articles_content(relevant_articles)

        save_articles(user_id, ids[f'{company}-{user_id}'], articles_content, articles, n_blogs)
        results[company] = articles_content, n_blogs

        end_time_company = time.time()
        company_durations[company] = end_time_company - start_time_company
        logging.info(f"Tempo per {company}: {company_durations[company]:.2f} secondi")

    end_time_total = time.time()
    total_duration = end_time_total - start_time_total
    logging.info(f"\nTempo totale: {total_duration:.2f} secondi")
    close_driver()

    return results