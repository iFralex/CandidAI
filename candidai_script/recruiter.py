import os
from collections import deque
import json
import time
import requests
from typing import List, Dict, Optional, Any
from candidai_script import db
from candidai_script.database import get_account_data, save_recruiter_and_query, save_company_info, get_custom_queries

def get_pdl_data(params):
    # --- CONFIGURAZIONE FLOPPYDATA ---
    STORE_FILE="store_pdl.json"
    PROXY_USER = "o9EmEnfT9h3fCMAH"
    PROXY_PASS = os.environ.get("PROXY_PASS")
    PROXY_HOST = "geo.g-w.info"
    PROXY_PORT = "10443"
    
    STORE_FILE = "store_pdl.json"
    SIGMA = 0.25
    TIME_WEIGHT = 0.5
    DEFAULT_CAP = 100  # Quota iniziale se non definita
    PDL_URL = "https://api.peopledatalabs.com/v5/company/enrich"
    
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

    def build_floppy_proxy(api_key_config, session_id):
        """Costruisce l'URL del proxy parametrico FloppyData."""
        country = api_key_config.get("country", "US") # Default US se manca
        city = api_key_config.get("city")
        
        # Base params
        proxy_params = f"user-{PROXY_USER}-country-{country}-type-residential-session-{session_id}-rotation-0"
        
        # Aggiungi city se presente (sostituisce spazi con underscore come da guida)
        if city:
            safe_city = city.replace(" ", "_")
            proxy_params += f"-city-{safe_city}"
            
        return f"http://{proxy_params}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}"

    def check_and_reset_credits(usage_entry):
        """
        Controlla se è arrivata la data di rinnovo. 
        Se sì, ripristina i crediti al CAP iniziale.
        Restituisce True se ci sono crediti disponibili, False altrimenti.
        """
        now_utc = datetime.now(timezone.utc)
        
        reset_date_str = usage_entry.get("reset_date")
        credits_remaining = usage_entry.get("credits_remaining", DEFAULT_CAP)
        
        # Logica di Reset basata sulla data salvata dagli header precedenti
        if reset_date_str:
            try:
                reset_dt = date_parser.parse(reset_date_str)
                # Assicuriamoci che reset_dt sia timezone-aware per il confronto
                if reset_dt.tzinfo is None:
                    reset_dt = reset_dt.replace(tzinfo=timezone.utc)
                
                # Se abbiamo superato la data di reset, ripristina a 100 (o al cap definito)
                if now_utc > reset_dt:
                    usage_entry["credits_remaining"] = DEFAULT_CAP
                    usage_entry["reset_date"] = None # Pulisci, verrà aggiornato alla prossima chiamata
                    return True
            except (ValueError, TypeError):
                pass # Se la data è corrotta, ignoriamo il reset automatico e ci fidiamo dei crediti attuali
        
        # Se crediti <= 0 e non è ancora ora di reset, chiave non disponibile
        if credits_remaining <= 0:
            return False
            
        return True

    def choose(items, usage):
        # Logica di selezione pesata originale mantenuta
        now = time.time()
        times = [now - usage.get(i, {}).get("last_called", 0) for i in items]
        calls = [usage.get(i, {}).get("call_count", 0) for i in items]
        
        if not times: return items[0] # Fallback

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

    def is_key_available(api_key, data, usage):
        """Controlla orari, giorni bloccati e, soprattutto, i crediti residui."""
        entry = data[api_key]
        usage_entry = usage.setdefault(api_key, {})
        
        # 1. Controllo Crediti e Rinnovo
        if not check_and_reset_credits(usage_entry):
            return False

        # 2. Controlli Temporali (Timezone, Giorni, Ore)
        tzname = entry.get("timezone")
        tz = pytz.timezone(tzname) if tzname else pytz.UTC
        now = datetime.now(tz)

        if "days_blocked" in entry and entry["days_blocked"]:
            if now.isoweekday() in entry["days_blocked"]:
                return False

        if "hours" in entry and entry["hours"]:
            start, end = entry["hours"]
            if not (start <= now.hour <= end):
                return False

        return True

    # --- FLUSSO PRINCIPALE ---
    
    store = load_store()
    data, usage = store["data"], store["usage"]
    
    # Filtra le chiavi disponibili
    valid_keys = [k for k in data if is_key_available(k, data, usage)]
    
    if not valid_keys:
        # Salviamo lo store nel caso check_and_reset_credits abbia resettato qualcosa
        save_store(store)
        print("Nessuna API key disponibile (crediti esauriti o fuori orario).")
        return {}

    # Sceglie la chiave migliore
    selected_api_key = choose(valid_keys, usage)
    api_config = data[selected_api_key]
    usage_entry = usage[selected_api_key]

    # Gestione Sessione Sticky per FloppyData
    # Se non esiste una sessione per questa chiave, creane una univoca e salvala
    if "proxy_session_id" not in usage_entry:
        usage_entry["proxy_session_id"] = str(uuid.uuid4())[:8] # Short UUID

    session_id = usage_entry["proxy_session_id"]
    
    # Costruzione URL Proxy Parametrico
    proxy_url = build_floppy_proxy(api_config, session_id)
    
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": selected_api_key,
    }
    proxies = {"http": proxy_url, "https": proxy_url}

    print(f"Usando API Key: ...{selected_api_key[-5:]} con Sessione Proxy: {session_id}")

    # Tentativi di richiesta
    for attempt in range(3):
        try:
            # Aggiorna timestamp chiamata
            usage_entry["last_called"] = time.time()
            usage_entry["call_count"] = usage_entry.get("call_count", 0) + 1
            save_store(store) # Salva pre-chiamata

            resp = requests.get(
                PDL_URL,
                params=params,
                headers=headers,
                proxies=proxies,
                timeout=30,
                verify=False # A volte necessario con certi proxy, valuta se rimuoverlo
            )
            
            # --- PARSING HEADERS PDL PER AGGIORNAMENTO CREDITI ---
            # Esempio header: x-ratelimit-reset: 2025-11-19 07:18:54
            pdl_remaining = resp.headers.get("x-totallimit-remaining") or resp.headers.get("x-ratelimit-remaining-minute")
            pdl_reset_date = resp.headers.get("x-ratelimit-reset")

            # Aggiorna i dati nello store se presenti negli headers
            if pdl_remaining is not None:
                try:
                    usage_entry["credits_remaining"] = int(pdl_remaining)
                except ValueError:
                    pass
            
            if pdl_reset_date:
                usage_entry["reset_date"] = pdl_reset_date

            # Salva immediatamente lo stato aggiornato dei crediti
            save_store(store)

            # Gestione Risposta
            try:
                json_response = resp.json()
            except ValueError:
                print(f"Tentativo {attempt + 1} - Risposta non valida (JSON errato)")
                continue

            if resp.status_code == 200:
                return json_response
            elif resp.status_code == 404:
                 # Profilo non trovato, ma chiamata valida (crediti spesi)
                print("Profilo non trovato su PDL.")
                return {}
            elif resp.status_code == 429:
                print("Rate limit superato (anche se il check locale diceva ok).")
                # Forziamo crediti a 0 per evitare loop immediato
                usage_entry["credits_remaining"] = 0
                save_store(store)
                break # O continue se vuoi provare un'altra chiave (richiederebbe refactoring loop esterno)
            else:
                print(f"Errore API {resp.status_code}: {json_response.get('message', 'Unknown')}")

        except Exception as e:
            print(f"Tentativo {attempt + 1} fallito: {str(e)}")
            time.sleep(1)

    return {}

def find_company_recruiters(company: Dict, queries: Optional[List[Dict]] = None, n_profiles: int = 1) -> List[Dict]:
    """
    Trova n_profiles recruiters per un'azienda specifica eseguendo queries progressive.
    Se non trova recruiters, cerca owner/founder, poi senior, poi qualsiasi persona.
    
    Args:
        company: Dizionario con 'domain' e 'name' dell'azienda
        queries: Lista di query ordinate per priorità (dalla più specifica alla più generica)
        n_profiles: Numero di profili da trovare
    
    Returns:
        Lista di profili trovati
    """
    API_KEY = os.environ.get("PEOPLE_DATA_API_KEY")
    PDL_URL = "https://api.peopledatalabs.com/v5/person/search"
    HEADERS = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }
    
    # Profili già trovati
    found_profiles = []
    found_ids = set()  # Per evitare duplicati
    
    # Se non ci sono query, usa una query base
    if not queries:
        queries = [{"id": 1, "name": "Base Query", "criteria": []}]
    
    # Crea query aggiuntive per owner/founder con gli stessi criteri
    owner_queries = []
    for query in queries:
        owner_query = {
            "id": f"{query['id']}_owner",
            "name": f"{query['name']} (Owner/Founder)",
            "criteria": query["criteria"],
            "search_type": "owner"
        }
        owner_queries.append(owner_query)
    
    # Query per senior roles
    senior_queries = []
    for query in queries:
        senior_query = {
            "id": f"{query['id']}_senior",
            "name": f"{query['name']} (Senior)",
            "criteria": query["criteria"],
            "search_type": "senior"
        }
        senior_queries.append(senior_query)
    
    # Query generica per qualsiasi persona in azienda
    general_query = {
        "id": "general",
        "name": "General Employee",
        "criteria": queries[0]["criteria"] if queries else [],
        "search_type": "general"
    }
    
    # Combina tutte le query: prima recruiters, poi owner/founder, poi senior, poi generale
    all_queries = queries + owner_queries + senior_queries + [general_query]
    
    # Esegui le query in ordine finché non raggiungi n_profiles
    request_timestamps = deque()
    MAX_REQUESTS = 10
    WINDOW_SECONDS = 65  # 1 minuto
    final_query = None

    for query in all_queries:
        if len(found_profiles) >= n_profiles:
            break

        # Rate limiting: controlla quante richieste sono state fatte nell'ultimo minuto
        now = time.time()

        # Rimuove i timestamp più vecchi di 60 secondi
        while request_timestamps and now - request_timestamps[0] >= WINDOW_SECONDS:
            request_timestamps.popleft()

        # Se abbiamo già raggiunto il limite di 10 richieste, aspetta fino al reset
        if len(request_timestamps) >= MAX_REQUESTS:
            wait_time = WINDOW_SECONDS - (now - request_timestamps[0])
            print(f"🕒 Limite di {MAX_REQUESTS} richieste al minuto raggiunto. Attendo {wait_time:.2f} secondi...")
            time.sleep(wait_time)
            # Dopo l'attesa, aggiorna il timestamp e ricalcola il tempo
            now = time.time()
            while request_timestamps and now - request_timestamps[0] >= WINDOW_SECONDS:
                request_timestamps.popleft()

        # Calcola quanti profili mancano
        remaining = n_profiles - len(found_profiles)

        # Costruisci la query Elasticsearch
        search_type = query.get("search_type", "recruiter")
        es_query = build_elasticsearch_query(company, query["criteria"], search_type)

        # Parametri per la richiesta
        params = {
            "size": str(remaining),
            "query": json.dumps(es_query),
            "titlecase": True
        }

        try:
            # Registra il timestamp della richiesta
            request_timestamps.append(time.time())

            # Esegui la richiesta
            response = requests.get(PDL_URL, headers=HEADERS, params=params).json()

            if response.get("status") == 200:
                data = response.get('data', [])

                # Aggiungi solo profili nuovi (evita duplicati)
                for record in data:
                    profile_id = record.get('id')
                    if profile_id and profile_id not in found_ids:
                        found_profiles.append(record)
                        found_ids.add(profile_id)

                        # Se abbiamo raggiunto il target, fermati
                        if len(found_profiles) >= n_profiles:
                            break
                
                if data:  # Salva solo se ha trovato risultati
                    final_query = query
                    
                print(f"Query '{query['name']}' (ID: {query['id']}): trovati {len(data)} profili, totale accumulato: {len(found_profiles)}/{n_profiles}")
            else:
                print(f"❌ '{query['id']}': {response}")

        except Exception as e:
            print(f"⚠️ Eccezione durante la query '{query['name']}': {str(e)}")
            continue
    
    print(f"\nTotale profili trovati per {company['name']}: {len(found_profiles)}/{n_profiles}")
    return found_profiles[:n_profiles], final_query


def build_elasticsearch_query(company: Dict, criteria: List[Dict], search_type: str = "recruiter") -> Dict:
    """
    Costruisce una query Elasticsearch basata sui criteri forniti.
    
    Args:
        company: Dizionario con informazioni sull'azienda ('domain' e 'name')
        criteria: Lista di criteri da applicare
        search_type: Tipo di ricerca ("recruiter", "owner", "senior", "general")
    
    Returns:
        Query Elasticsearch formattata
    """
    must_clauses = []
    must_not_clauses = []

    # Clausola per il tipo di ruolo cercato
    if search_type == "recruiter":
        must_clauses.append({
            "bool": {
                "should": [
                    {"wildcard": {"job_title": "*recruiter*"}},
                    {"wildcard": {"job_title": "*talent acquisition*"}},
                    {"wildcard": {"job_title": "*technical recruiter*"}},
                    {"wildcard": {"job_title": "*hr*"}},
                    {"wildcard": {"job_title": "*human resources*"}},
                    {"term": {"job_title_sub_role": "recruiting"}},
                    {"term": {"job_title_role": "human_resources"}}
                ]
            }
        })
    elif search_type == "owner":
        must_clauses.append({
            "bool": {
                "should": [
                    {"wildcard": {"job_title": "*owner*"}},
                    {"wildcard": {"job_title": "*founder*"}},
                    {"wildcard": {"job_title": "*co-founder*"}},
                    {"wildcard": {"job_title": "*ceo*"}},
                    {"wildcard": {"job_title": "*chief executive*"}},
                    {"term": {"job_title_role": "owner"}},
                    {"term": {"job_title_sub_role": "founder"}}
                ]
            }
        })
    elif search_type == "senior":
        must_clauses.append({
            "bool": {
                "should": [
                    {"terms": {"job_title_levels": ["senior", "director", "vp", "c_suite", "owner", "partner"]}},
                    {"wildcard": {"job_title": "*senior*"}},
                    {"wildcard": {"job_title": "*director*"}},
                    {"wildcard": {"job_title": "*vp*"}},
                    {"wildcard": {"job_title": "*vice president*"}},
                    {"wildcard": {"job_title": "*head of*"}},
                    {"wildcard": {"job_title": "*chief*"}},
                    {"wildcard": {"job_title": "*c-level*"}},
                    {"wildcard": {"job_title": "*manager*"}}
                ]
            }
        })
    # Per "general" non aggiungiamo nessun filtro sul job title
    
    # Clausola per l'azienda corrente (job_company_name)
    must_clauses.append({
        "match": {"job_company_name": company["name"]}
    })

    if "linkedin_url" in company:
        must_clauses.append({
            "match": {"job_company_linkedin_url": company["linkedin_url"]}
        })

    if "domain" in company:
        must_clauses.append({
            "match": {"job_company_website": company["domain"]}
        })
    
    must_clauses.append({
        "bool": {
            "must_not": [
                {"term": {"work_email": False}},
                {"bool": {"must_not": {"exists": {"field": "work_email"}}}}
            ]
        }
    })

    # Mappa i criteri ai campi Elasticsearch appropriati
    for criterion in criteria:
        key = criterion["key"]
        values = criterion["value"]
        
        if not values:  # Salta criteri vuoti
            continue
        
        if key == "job_title_levels":
            must_clauses.append({
                "terms": {"job_title_levels": values}
            })
        
        elif key == "location_country":
            must_clauses.append({
                "terms": {"location_country": values}
            })
        
        elif key == "location_continent":
            must_clauses.append({
                "terms": {"location_continent": values}
            })
        
        elif key == "skills":
            # Skills possono essere in skills o interests
            must_clauses.append({
                "bool": {
                    "should": [
                        {"terms": {"skills": values}},
                        {"terms": {"interests": values}}
                    ]
                }
            })
        
        elif key == "job_title":
            # Job title può essere una wildcard o match esatto
            if len(values) == 1:
                must_clauses.append({
                    "wildcard": {"job_title": f"*{values[0]}*"}
                })
            else:
                must_clauses.append({
                    "bool": {
                        "should": [{"wildcard": {"job_title": f"*{v}*"}} for v in values]
                    }
                })
        
        elif key == "company_name":
            # Esperienza lavorativa in aziende specifiche
            must_clauses.append({
                "terms": {"experience.company.name": values}
            })
        
        elif key == "company_location_country":
            must_clauses.append({
                "terms": {"experience.company.location.country": values}
            })
        
        elif key == "company_location_continent":
            must_clauses.append({
                "terms": {"experience.company.location.continent": values}
            })
        
        elif key == "company_linkedin_url":
            must_clauses.append({
                "terms": {"experience.company.linkedin_url": values}
            })
        
        elif key == "company_domain":
            must_clauses.append({
                "terms": {"experience.company.website": values}
            })
        
        elif key == "school_name":
            must_clauses.append({
                "terms": {"education.school.name": values}
            })
        
        elif key == "school_location_country":
            must_clauses.append({
                "terms": {"education.school.location.country": values}
            })
        
        elif key == "school_location_continent":
            must_clauses.append({
                "terms": {"education.school.location.continent": values}
            })
        
        elif key == "school_linkedin_url":
            must_clauses.append({
                "terms": {"education.school.linkedin_url": values}
            })
        
        elif key == "school_domain":
            must_clauses.append({
                "terms": {"education.school.website": values}
            })
        
        elif key == "school_majors":
            must_clauses.append({
                "terms": {"education.majors": values}
            })
        
        elif key == "school_degrees":
            must_clauses.append({
                "terms": {"education.degrees": values}
            })
    
    # Gestione criteri di esclusione
    for criterion in criteria:
        key = criterion["key"]
        values = criterion["value"]
        
        if not values:
            continue
        
        if key == "exclude_names":
            must_not_clauses.append({
                "bool": {
                    "should": [{"match_phrase": {"full_name": name}} for name in values]
                }
            })
        
        elif key == "exclude_linkedin_urls":
            must_not_clauses.append({
                "bool": {
                    "should": [{"match_phrase": {"linkedin_url": url}} for url in values]
                }
            })

    return {
        "query": {
            "bool": {
                "must": must_clauses,
                "must_not": must_not_clauses
            }
        }
    }

def get_work_email_from_rocketreach(name: str, company_domain: str) -> str:
    """
    Cerca su RocketReach un profilo per nome e dominio aziendale
    e restituisce la mail lavorativa se trovata.

    Args:
        name (str): Nome completo della persona da cercare (es. "Mario Rossi")
        company_domain (str): Dominio o nome dell'azienda (es. "unica.it" o "Unica")

    Returns:
        str: Email lavorativa trovata, oppure None se non disponibile
    """
    # Chiave API RocketReach (puoi anche impostarla come variabile d’ambiente)
    API_KEY = os.environ.get("ROCKETREACH_API_KEY", "INSERISCI_LA_TUA_API_KEY")

    url = f"https://api.rocketreach.co/api/v2/person/lookup"
    params = {
        "name": name,
        "current_employer": company_domain
    }

    headers = {
        "accept": "application/json",
        "Api-Key": API_KEY
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()  # solleva errore HTTP se la risposta non è 200
        data = response.json()

        # RocketReach restituisce un oggetto con 'emails' o 'email' (dipende dal piano)
        if not data:
            return None
        
        # 'emails' è solitamente una lista di dizionari con tipi (work, personal, ecc.)
        if "recommended_personal_email" in data:
            return data["recommended_personal_email"]

        # In alternativa, alcuni piani restituiscono direttamente 'email'
        if "recommended_professional_email" in data:
            return data["recommended_professional_email"]

        return None  # nessuna email lavorativa trovata

    except requests.RequestException as e:
        print(f"⚠️ Errore nella richiesta RocketReach: {e}")
        return None
    
def find_recruiters_for_user(user_id, ids, companies, defaultQueries):
    results = {}
    user_instructions = {}
    for company in companies:
        _queries, user_instruction = get_custom_queries(user_id, ids[f'{company["name"]}-{user_id}'])
        queries = _queries or defaultQueries
        user_instructions[ids[f'{company["name"]}-{user_id}']] = user_instruction
        result, query = find_company_recruiters(company, queries)
        result = result[0] if result else {}
        company["linkedin_url"] = result.get("job_company_linkedin_url", None)
                                        
        save_recruiter_and_query(
            user_id,
            ids[f'{company["name"]}-{user_id}'],
            result,
            query,
            result.get("job_company_linkedin_url", None),
        )
        results[company["name"]] = result, query
        time.sleep(2)
    
    return results, user_instructions

import os
import time
import requests
from typing import Dict, List, Any

def get_companies_info(user_id: str, ids: Dict[str, str], new_companies: List[Dict[str, Any]]):
    """
    Per ogni azienda in new_companies, cerca di arricchire i dati usando People Data Labs
    Company Enrich API con una strategia di fallback:
    1. Prova con una combinazione di 'website', 'name' e 'profile'.
    2. Se fallisce, prova solo con 'profile' (linkedin_url).
    3. Se fallisce, prova solo con 'website' (domain).
    4. Se fallisce, prova solo con 'name'.

    In caso di ConnectionError, la richiesta viene ritentata fino a 10 volte
    con una pausa di 10 secondi tra i tentativi.
    """

    if not API_KEY:
        print("🛑 Errore: Variabile d'ambiente PEOPLE_DATA_API_KEY non trovata.")
        return

    for company in new_companies:
        name = company.get("name")
        domain = company.get("domain")
        linkedin_url = company.get("linkedin_url")
        unique_id = ids.get(f"{name}-{user_id}")
        company_found = False

        if not unique_id:
            print(f"⚠️ Nessun ID univoco trovato per {name}, salto l'arricchimento.")
            continue

        # Strategie di ricerca in ordine di priorità
        search_strategies = [
            {"website": domain, "name": name, "profile": linkedin_url},
            {"profile": linkedin_url} if linkedin_url else None,
            {"website": domain} if domain else None,
            {"name": name},
        ]

        search_strategies = [
            {**s, "titlecase": True, "size": 1}
            for s in search_strategies if s
        ]

        print(f"🔎 Inizio arricchimento per: {name}")

        for strategy in search_strategies:
            if not strategy:
                continue

            params = {k: v for k, v in strategy.items() if v}
            if not params:
                continue

            # 🔁 Tentativi con retry per ConnectionError
            for attempt in range(1, 11):  # massimo 10 tentativi
                try:
                    data = get_pdl_data(params)

                    if data and data.get("name"):
                        company_info = data
                        save_company_info(user_id, unique_id, company_info)
                        print(f"✅ Info azienda {name} salvate con successo usando: {list(params.keys())}")
                        company_found = True
                        break

                    break  # esce dal ciclo retry se risposta valida anche se vuota

                except requests.exceptions.ConnectionError as conn_e:
                    print(f"⚠️ Tentativo {attempt}/10 fallito per {name}: errore di connessione ({conn_e}).")
                    if attempt < 10:
                        print("⏳ Riprovo tra 10 secondi...")
                        time.sleep(10)
                    else:
                        print(f"❌ Connessione fallita definitivamente per {name} dopo 10 tentativi.")

                except requests.exceptions.RequestException as req_e:
                    print(f"❌ Errore di Rete/API per {name} con {params}: {str(req_e)}")
                    break  # non ritentare per altri tipi di errore

                except Exception as e:
                    print(f"⚠️ Eccezione inattesa per {name} con {params}: {str(e)}")
                    break  # errore non di rete → interrompe

            if company_found:
                break  # passa all’azienda successiva se già salvata

        if not company_found:
            print(f"❌ Arricchimento fallito per {name} dopo tutti i tentativi.")
