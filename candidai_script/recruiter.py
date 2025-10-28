import os
from collections import deque
import json
import time
import requests
from typing import List, Dict, Optional, Any
from candidai_script import db
from candidai_script.database import get_account_data, save_recruiter_and_query, save_company_info, get_custom_queries

def find_company_recruiters(company: Dict, queries: Optional[List[Dict]] = None, n_profiles: int = 1) -> List[Dict]:
    """
    Trova n_profiles recruiters per un'azienda specifica eseguendo queries progressive.
    
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
    
    # Esegui le query in ordine finché non raggiungi n_profiles
    request_timestamps = deque()
    MAX_REQUESTS = 10
    WINDOW_SECONDS = 65  # 1 minuto

    for query in queries:
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
            # Dopo l’attesa, aggiorna il timestamp e ricalcola il tempo
            now = time.time()
            while request_timestamps and now - request_timestamps[0] >= WINDOW_SECONDS:
                request_timestamps.popleft()
            # E poi prosegui normalmente, SENZA continue

        # Calcola quanti profili mancano
        remaining = n_profiles - len(found_profiles)

        # Costruisci la query Elasticsearch
        es_query = build_elasticsearch_query(company, query["criteria"])

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
                final_query = query
                print(f"Query '{query['name']}' (ID: {query['id']}): trovati {len(data)} profili, totale accumulato: {len(found_profiles)}/{n_profiles}")
            else:
                print(f"❌ '{query['id']}': {response}")

        except Exception as e:
            print(f"⚠️ Eccezione durante la query '{query['name']}': {str(e)}")
            continue
    print(f"\nTotale profili trovati per {company['name']}: {len(found_profiles)}/{n_profiles}")
    return found_profiles[:n_profiles], final_query

def build_elasticsearch_query(company: Dict, criteria: List[Dict]) -> Dict:
    """
    Costruisce una query Elasticsearch basata sui criteri forniti.
    
    Args:
        company: Dizionario con informazioni sull'azienda ('domain' e 'name')
        criteria: Lista di criteri da applicare
    
    Returns:
        Query Elasticsearch formattata
    """
    must_clauses = []
    must_not_clauses = []

    # Clausola per i titoli di lavoro legati a recruiting/HR
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
        print(data)
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
    API_KEY = os.environ.get("PEOPLE_DATA_API_KEY")
    PDL_URL = "https://api.peopledatalabs.com/v5/company/enrich"
    HEADERS = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }

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
                    response = requests.get(PDL_URL, headers=HEADERS, params=params, timeout=15)
                    data = response.json()

                    if response.status_code == 200 and data.get("status") == 200 and data.get("name"):
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
