from candidai_script import db
from firebase_admin import firestore
from typing import Dict
from candidai_script import db

def get_account_data(user_id):
    """
    Recupera i dati dell'account per un determinato utente.
    
    Args:
        db: Istanza del database Firestore.
        user_id (str): ID dell'utente.
    
    Returns:
        dict | None: I dati dell'account se trovati, altrimenti None.
    """
    doc_ref = db.collection("users").document(user_id).collection("data").document("account")
    doc = doc_ref.get()

    if not doc.exists:
        print(f"❌ Documento users/{user_id}/data/account non trovato.")
        return None
    else:
        return doc.to_dict()

def get_changed_companies(user_id):
    """
    Recupera i dati dell'account per un determinato utente.
    
    Args:
        db: Istanza del database Firestore.
        user_id (str): ID dell'utente.
    
    Returns:
        dict | None: I dati dell'account se trovati, altrimenti None.
    """
    doc_ref = db.collection("users").document(user_id).collection("data").document("changed_companies")
    doc = doc_ref.get()

    if not doc.exists:
        print(f"❌ Documento users/{user_id}/data/account non trovato.")
        return None
    else:
        return doc.to_dict()

def generate_unique_id():
    return db.collection("generated_ids").document().id

def save_companies_to_results(user_id, companies, changed_companies):
    """
    Salva le aziende nei risultati dell'utente. Se un'azienda esiste già,
    usa l'ID esistente. Se esiste ed è in 'changed_companies', l'azienda
    viene aggiornata e risalvata.

    :param user_id: L'ID dell'utente.
    :param companies: Lista delle nuove aziende da salvare.
    :param changed_companies: Dizionario di aziende modificate, mappate per l'ID esistente.
    :return: Una tupla contenente (companies, ids, new_companies).
    """
    results = db.collection("users").document(user_id).collection("data").document("results").get()

    if not results.exists:
        print(f"❌ Documento users/{user_id}/data/account non trovato.")
        results = None
        companies_to_confirm = []
    else:
        results = results.to_dict()
        companies_to_confirm = results.get("companies_to_confirm", [])


    ids = {}
    new_companies = []  # Aziende che sono state create o aggiornate in questa esecuzione
    right_companies = []  # Aziende che sono state create o aggiornate in questa esecuzione

    for company in companies:
        company_key = f'{company["name"]}-{user_id}'
        id_ref = db.collection("ids").document(company_key)
        existing_id_doc = id_ref.get()

        existing_id = None
        is_changed = False
        company_to_save = company

        if existing_id_doc.exists:
            # 1. Se l'ID esiste già
            existing_id = existing_id_doc.to_dict().get("id")
            
            # Controlla se l'ID esistente è presente in changed_companies
            if changed_companies and existing_id in changed_companies:
                # 1a. L'ID esiste ed è in changed_companies: AGGIORNA
                is_changed = True
                # L'azienda da salvare è quella modificata
                company_to_save = changed_companies[existing_id]
                print(f"L'azienda '{company['name']}' con ID {existing_id} è stata modificata e verrà aggiornata.")
                company_key = f'{company_to_save["name"]}-{user_id}'

                changed_ref = db.collection("users").document(user_id)\
                    .collection("data").document("changed_companies")

                # Rimuove solo il campo con chiave existing_id
                changed_ref.update({
                    existing_id: firestore.DELETE_FIELD
                })
            else:
                # 1b. L'ID esiste ma NON è in changed_companies: SALTA (comportamento attuale)
                company_to_save = results[existing_id].get("company", company)
                print(f"L'azienda '{company_to_save['name']}' è già stata salvata con ID {existing_id}. Nessun aggiornamento.")
                ids[f'{company_to_save["name"]}-{user_id}'] = existing_id
                right_companies.append(company_to_save)
                continue  # passa alla prossima azienda
        else:
            # 2. Se l'ID non esiste: CREA NUOVO ID
            new_id = generate_unique_id()
            existing_id = new_id
            print(f"L'azienda '{company['name']}' non è ancora salvata. Nuovo ID: {new_id}.")

        right_companies.append(company_to_save)
        # A questo punto, si ha un 'existing_id' (nuovo o esistente) e una 'company_to_save'
        current_id = existing_id
        ids[company_key] = current_id
        new_companies.append(company_to_save)
        
        # --- Operazioni di Salvataggio/Aggiornamento ---

        # 1. Aggiorna o crea il documento 'results'
        company_doc_ref = db.collection("users").document(user_id)\
            .collection("data").document("results")

        # Se l'azienda è stata modificata (is_changed) o se è nuova,
        # aggiorna il campo 'company' e, se è nuova, anche 'start_date'.
        update_data = {
            current_id: {
                "company": company_to_save,
            }
        }
        
        # Aggiunge start_date solo se l'ID è appena stato creato (non esisteva prima)
        if not existing_id_doc.exists:
             update_data[current_id]["start_date"] = firestore.SERVER_TIMESTAMP

        company_doc_ref.set(update_data)

        # 2. Aggiorna o crea il documento 'details'
        details_ref = db.collection("users").document(user_id)\
            .collection("data").document("results")\
            .collection(current_id).document("details")

        details_ref.set({
            "company": company_to_save,
        })

        # 3. Salva l'associazione company_key -> ID solo se era un nuovo ID
        if not existing_id_doc.exists:
            id_ref.set({
                "id": current_id,
            }, merge=True)

    filtered_companies = [
        c for c in right_companies
        if ids.get(f'{c["name"]}-{user_id}') not in companies_to_confirm
    ]

    return filtered_companies, ids, new_companies

def save_recruiter_and_query(user_id: str, unique_id, recruiter: dict, query: dict, linkedin_url: str):
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
        for exp in record.get("experience", []) or []:
            new_exp = exp.copy()

            # Rimuove chiavi di primo livello non necessarie
            for key in ["is_primary", "location_names"]:
                new_exp.pop(key, None)

            # Gestione company (può essere None)
            company = new_exp.get("company")
            if isinstance(company, dict):
                for key in [
                    "twitter_url", "linkedin_id", "id", "facebook_url",
                    "founded", "industry", "size", "is_primary", "location_names"
                ]:
                    company.pop(key, None)

                # Gestione location della company
                location = company.get("location")
                if isinstance(location, dict):
                    for key in [
                        "locality", "region", "address_line_2",
                        "geo", "metro", "postal_code", "street_address"
                    ]:
                        location.pop(key, None)

            # Gestione title (può essere None)
            title = new_exp.get("title")
            if isinstance(title, dict):
                for key in ["class", "levels", "role", "sub_role"]:
                    title.pop(key, None)

            experience.append(new_exp)

        # Education
        education = []
        for edu in record.get("education", []) or []:
            new_edu = edu.copy()

            # Gestione school (può essere None)
            school = new_edu.get("school")
            if isinstance(school, dict):
                for key in ["twitter_url", "linkedin_id", "id", "facebook_url"]:
                    school.pop(key, None)

                # Gestione location della scuola
                location = school.get("location")
                if isinstance(location, dict):
                    for key in ["locality", "region"]:
                        location.pop(key, None)

            education.append(new_edu)

        # Costruzione oggetto finale
        parsed = {
            "name": record.get("full_name", "") or "",
            "title": record.get("job_title", "") or "",
            "experience": experience,
            "skills": record.get("skills", []) or [],
            "education": education,
            "location": {
                "country": record.get("location_country"),
                "continent": record.get("location_continent")
            },
            "linkedin_url": record.get("linkedin_url"),
            "email": record.get("work_email"),
        }

        return parsed

    # 2️⃣ Percorso 1: Aggiorna l'oggetto results con key = unique_id
    company_doc_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")

    company_doc_ref.set({
        unique_id: {
            "recruiter": {
                "name": recruiter.get("full_name"),
                "job_title": recruiter.get("job_title")
            },
        }
    }, merge=True)

    # 3️⃣ Percorso 2: Salva recruiter + query nella collezione con unique_id
    details_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("details")

    summaryProfile = parse(recruiter) if recruiter else {}

    details_ref.set({
        "company": {
            "linkedin_url": linkedin_url
        },
        "recruiter_summary": summaryProfile,
        "query": query
    }, merge=True)

    row_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("row")

    row_ref.set({
        "recruiter": recruiter,
        "query": query
    }, merge=True)

    print(f"✅ Dati salvati per utente {user_id} con ID {unique_id}")

def save_articles(user_id: str, unique_id: str, articles_content: list, articles_list: list, n_blogs):
    """
    Salva articoli di blog in Firestore:
      - row: oggetto blog_articles con content completo e lista articoli
      - details: oggetto blog_articles con content troncato e numero articoli trovati
      - results: riferimento rapido con chiave unique_id

    Args:
        user_id (str): ID utente
        unique_id (str): ID univoco per il set di risultati
        articles_content (list): Lista di oggetti dei migliori articoli (con contenuto completo)
        articles_list (list): Lista di tutti gli articoli trovati (oggetti con title e href)
    """

    def truncate_markdown(content: str, max_length: int = 300) -> str:
        """Tronca il testo markdown mantenendo il senso della frase."""
        if not content:
            return ""
        if len(content) <= max_length:
            return content
        return content[:max_length].rsplit(' ', 1)[0] + "..."

    total_articles = len(articles_list)

    # Crea versione troncata di articles_content per details
    truncated_content = []
    for article in articles_content:
        art_copy = article.copy()
        if "markdown" in art_copy:
            art_copy["markdown"] = truncate_markdown(art_copy["markdown"])
        truncated_content.append(art_copy)

    # 1️⃣ Aggiorna il documento results con chiave unique_id
    results_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")

    results_ref.set({
        unique_id: {
            "blog_articles": total_articles
        }
    }, merge=True)

    # 2️⃣ Salva in details
    details_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("details")

    details_ref.set({
        "blog_articles": {
            "content": truncated_content,
            "articles_found": total_articles,
            "blogs_analized": n_blogs
        }
    }, merge=True)

    # 3️⃣ Salva in row
    row_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("row")

    row_ref.set({
        "blog_articles": {
            "content": articles_content,
            "list": articles_list
        }
    }, merge=True)

    print(f"✅ Articoli salvati per utente {user_id} con ID {unique_id}")

def save_email(user_id: str, unique_id: str, email, prompt, email_address, cv_url):
    """
    Salva articoli di blog in Firestore:
      - row: oggetto blog_articles con content completo e lista articoli
      - details: oggetto blog_articles con content troncato e numero articoli trovati
      - results: riferimento rapido con chiave unique_id

    Args:
        user_id (str): ID utente
        unique_id (str): ID univoco per il set di risultati
        articles_content (list): Lista di oggetti dei migliori articoli (con contenuto completo)
        articles_list (list): Lista di tutti gli articoli trovati (oggetti con title e href)
    """

    if not email:
        return
    
    # 1️⃣ Aggiorna il documento results con chiave unique_id
    results_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")

    results_ref.set({
        unique_id: {
            "email_sent": False
        }
    }, merge=True)

    emails_ref = db.collection("users").document(user_id)\
        .collection("data").document("emails")

    email["cv_url"] = cv_url
    if email_address:
        email["email_address"] = email_address
    emails_ref.set({
        unique_id: email,
    }, merge=True)

    # 2️⃣ Salva in details
    details_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("details")

    email["prompt"] = prompt
    details_ref.set({
        "email": email,
    }, merge=True)

    # 3️⃣ Salva in row
    row_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("row")

    row_ref.set({
        "email": email
    }, merge=True)

def get_results_status(user_id):
    """
    Recupera lo stato dei risultati per ogni azienda dell'utente.
    Restituisce un dict:
    {
        unique_id: {
            "blog_articles": {...},
            "recruiter": {...},
            "email_sent": True/False
        },
        ...
    }
    """
    results_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")

    doc = results_ref.get()
    
    if not doc.exists:
        return {}

    return doc.to_dict() or {}

def get_results_row(user_id, id):
    """
    Recupera lo stato dei risultati per ogni azienda dell'utente.
    Restituisce un dict:
    {
        unique_id: {
            "blog_articles": {...},
            "recruiter": {...},
            "email_sent": True/False
        },
        ...
    }
    """
    row_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(id).document("row")

    doc = row_ref.get()
    
    if not doc.exists:
        return {}

    return doc.to_dict() or {}

def save_company_info(user_id: str, unique_id: str, company_info: dict):
    """
    Salva le informazioni arricchite dell'azienda in Firestore.
      - results/{unique_id}/details -> company_info
      - results -> companies_to_confirm (array)

    Args:
        user_id (str): ID utente
        unique_id (str): ID univoco per il set di risultati
        company_info (dict): Oggetto arricchito da People Data Labs
    """

    def parse(record):
        def filter_by_cumulative_coverage(
            counts: Dict[str, float],
            coverage: float = 0.80,
            min_country_share: float = 0.0
        ) -> Dict[str, float]:
            """
            Mantiene i paesi fino a raggiungere `coverage` (0-1) della somma totale.
            Se min_country_share > 0, un paese viene mantenuto anche se non necessario
            se la sua quota >= min_country_share.
            Ritorna un nuovo dict con i paesi mantenuti e una chiave 'Other' se necessario.
            """
            if not counts:
                return {}
            # totale
            total = sum(counts.values())
            if total == 0:
                return counts.copy()

            # ordina paesi per valore decrescente
            items = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
            cum = 0.0
            kept = {}
            other_sum = 0.0

            for country, value in items:
                share = value / total
                # mantieni se ci serve per coverage o se supera la soglia minima assoluta
                if cum < coverage or (min_country_share > 0 and share >= min_country_share):
                    kept[country] = value
                    cum += value / total
                else:
                    other_sum += value

            if other_sum > 0:
                kept["Other"] = other_sum
            return kept
        
        for key in ["status", "name", "sic", "linkedin_id", "linkedin_slug", "facebook_url", "twitter_url", "profiles", "mic_exchange", "affiliated_profiles", "latest_funding_stage", "last_funding_date", "number_funding_rounds", "funding_stages", "dataset_version", "id"]:
            record.pop(key, None)
        if isinstance(record.get("location"), dict):
            for key in ["locality", "region", "address_line_2", "geo", "metro", "postal_code", "street_address"]:
                record["location"].pop(key, None)
        if isinstance(record.get("employee_count_by_country"), dict):
            record["employee_count_by_country"] = filter_by_cumulative_coverage(record["employee_count_by_country"])
        
        naics = []
        naics_raw = record.get("naics") or []
        if isinstance(naics_raw, list):
            for n in naics_raw:
                if isinstance(n, dict):
                    new_n = n.copy()
                    new_n.pop("national_industry", None)
                    naics.append(new_n)
        record["naics"] = naics
        
        return record

    row_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("row")

    row_ref.set({
        "company_info": company_info
    }, merge=True)

    # Salva company_info nei dettagli
    details_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("details")

    details_ref.set({
        "company_info": parse(company_info)
    }, merge=True)

    # Aggiorna il documento principale dei risultati con l'array companies_to_confirm
    results_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")

    results_ref.set({
        "companies_to_confirm": firestore.ArrayUnion([unique_id])
    }, merge=True)

    print(f"🏢 Company info salvata per ID {unique_id}")

def get_custom_queries(user_id, id):
    doc_ref = db.collection("users").document(user_id).collection("data").document("results").collection(id).document("customizations")
    doc = doc_ref.get()

    if not doc.exists:
        return None, ""
    else:
        print("Custom strategy for {user_id} - {id}")
        return doc.to_dict().get("queries", []), doc.to_dict().get("instructions", "")
