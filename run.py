import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
from collections import deque
import json
import time
import requests
from typing import List, Dict, Optional

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
            continue  # Dopo l'attesa, passa alla prossima iterazione per rivalutare la coda

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
    
    return {
        "query": {
            "bool": {
                "must": must_clauses
            }
        }
    }

load_dotenv("./.env.local")

# 🔐 2. Prepara le credenziali dal dizionario
cred = credentials.Certificate({
    "type": "service_account",
    "project_id": os.environ.get("FIREBASE_ADMIN_PROJECT_ID"),
    "private_key_id": os.environ.get("FIREBASE_ADMIN_PRIVATE_KEY_ID"),
    "private_key": os.environ.get("FIREBASE_ADMIN_PRIVATE_KEY").replace("\\n", "\n"),
    "client_email": os.environ.get("FIREBASE_ADMIN_CLIENT_EMAIL"),
    "client_id": os.environ.get("FIREBASE_ADMIN_CLIENT_ID"),
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": os.environ.get("FIREBASE_ADMIN_CLIENT_X509_CERT_URL"),
})

# 🚀 3. Inizializza Firebase (solo una volta)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

# 📡 4. Ottieni Firestore client
db = firestore.client()

# 📌 6. Inserisci l'userId che vuoi leggere
def find_recruiters_for_user(user_id: str):
    # 📑 7. Ottieni i dati dal documento Firestore
    doc_ref = db.collection("users").document(user_id).collection("data").document("account")
    doc = doc_ref.get()

    if not doc.exists:
        print(f"❌ Documento users/{user_id}/data/account non trovato.")
    else:
        account_data = doc.to_dict()
        
        # 🧠 8. Usa i dati come argomento per la funzione
        result, query = find_company_recruiters(account_data.get("companies", ["", ""])[1], account_data.get("queries", []))
        company = account_data.get("companies", ["", ""])[1]
        for i in range(50):
            # Modifica dinamicamente il nome della company
            company_modificata = {
                **company,
                "name": f"{company['name']}_{i}"   # es: "Google_0", "Google_1", ...
            }

            save_recruiter_and_query(
                user_id,
                company_modificata,
                result[0] if result else {},
                query
            )
            time.sleep(2)
        # 📤 9. Stampa o gestisci il risultato
        print("📢 Risultato della funzione find_company_recruiters:")
        print(result)

def save_recruiter_and_query(user_id: str, company: dict, recruiter: dict, query: dict):
    """
    Genera un ID univoco e salva recruiter e query in:
      - users/{user_id}/data/results/{unique_id}
    Aggiorna il documento results con la chiave unique_id.

    Args:
        user_id (str): ID utente
        company_name (str): Nome della company
        company_domain (str): Dominio della company
        recruiter (dict): Oggetto recruiter
        query (dict): Oggetto query
    """

    def parse(record):
        # Experience
        experience = []
        for exp in record.get("experience", []):
            new_exp = exp.copy()
            experience.append(new_exp)

        # Education
        education = []
        for edu in record.get("education", []):
            new_edu = edu.copy()
            education.append(new_edu)

        # Costruzione dell'oggetto finale
        parsed = {
            "name": record.get("full_name", ""),
            "title": record.get("job_title", ""),
            "experience": experience,
            "skills": record.get("skills", []),
            "education": education,
            "location": {
                "country": record.get("location_country"),
                "continent": record.get("location_continent")
            },
        }

        return parsed

    # 1️⃣ Genera un ID univoco pushando nella collezione results
    unique_id = db.collection("users").document(user_id)\
                  .collection("data").document("results")\
                  .collection("generated_ids").document().id

    # 2️⃣ Percorso 1: Aggiorna l'oggetto results con key = unique_id
    company_doc_ref = db.collection("users").document(user_id)\
                        .collection("data").document("results")

    company_doc_ref.set({
        unique_id: {
            "company": {
                "name": company["name"],
                "domain": company["domain"]
            },
            "recruiter": {
                "name": recruiter.get("full_name"),
                "job_title": recruiter.get("job_title")
            },
            "start_date": firestore.SERVER_TIMESTAMP,
        }
    }, merge=True)

    # 3️⃣ Percorso 2: Salva recruiter + query nella collezione con unique_id
    details_ref = db.collection("users").document(user_id)\
                    .collection("data").document("results")\
                    .collection(unique_id).document("details")

    summaryProfile = parse(recruiter) if recruiter else {}

    details_ref.set({
        "company": {
            "name": company["name"],
            "domain": company["domain"]
        },
        "recruiter_summary": summaryProfile,
        "query": query
    })

    row_ref = db.collection("users").document(user_id)\
                    .collection("data").document("results")\
                    .collection(unique_id).document("row")

    row_ref.set({
        "recruiter": recruiter,
    })

    print(f"✅ Dati salvati per utente {user_id} con ID {unique_id}")

if __name__ == "__main__":
    find_recruiters_for_user("WWQLqljHlWTg8NbCmE00seHglXu1")