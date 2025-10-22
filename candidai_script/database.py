from candidai_script import db
from firebase_admin import firestore

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

def generate_unique_id():
    return db.collection("generated_ids").document().id

def save_companies_to_results(user_id, companies):
    ids = {}

    for company in companies:
        company_key = f'{company["name"]}-{user_id}'
        id_ref = db.collection("ids").document(company_key)
        existing_id_doc = id_ref.get()

        if existing_id_doc.exists:
            # Se l'ID esiste già, usalo e non salvare duplicati
            existing_id = existing_id_doc.to_dict().get("id")
            print(f"L'azienda '{company['name']}' è già stata salvata con ID {existing_id}.")
            ids[company_key] = existing_id
            continue  # passa alla prossima azienda

        # Se l'azienda non esiste ancora, genera un nuovo ID e salva
        new_id = generate_unique_id()
        ids[company_key] = new_id

        company_doc_ref = db.collection("users").document(user_id)\
            .collection("data").document("results")

        company_doc_ref.set({
            new_id: {
                "company": {
                    "name": company["name"],
                    "domain": company["domain"]
                },
                "start_date": firestore.SERVER_TIMESTAMP,
            }
        }, merge=True)

        details_ref = db.collection("users").document(user_id)\
            .collection("data").document("results")\
            .collection(new_id).document("details")

        details_ref.set({
            "company": company,
        }, merge=True)

        id_ref.set({
            "id": new_id,
        }, merge=True)

    return ids

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
        for exp in record.get("experience", []):
            new_exp = exp.copy()
            for key in ["is_primary", "location_names"]:
                new_exp.pop(key, None)
            for key in ["twitter_url", "linkedin_id", "id", "facebook_url", "founded", "industry", "size", "is_primary", "location_names"]:
                new_exp["company"].pop(key, None)
            if isinstance(new_exp.get("company", {}).get("location"), dict):
                for key in ["locality", "region", "address_line_2", "geo", "metro", "postal_code", "street_address"]:
                    new_exp["company"]["location"].pop(key, None)
            for key in ["class", "levels", "role", "sub_role"]:
                new_exp["title"].pop(key, None)
            experience.append(new_exp)

        # Education
        education = []
        for edu in record.get("education", []):
            new_edu = edu.copy()
            for key in ["twitter_url", "linkedin_id", "id", "facebook_url"]:
                new_edu["school"].pop(key, None)
            if isinstance(new_edu.get("school", {}).get("location"), dict):
                for key in ["locality", "region"]:
                    new_edu["school"]["location"].pop(key, None)
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
    })

    print(f"✅ Dati salvati per utente {user_id} con ID {unique_id}")

def save_articles(user_id: str, unique_id: str, articles_content: list, articles_list: list):
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
            "blog_articles": {
                "total_found": total_articles
            }
        }
    }, merge=True)

    # 2️⃣ Salva in details
    details_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("details")

    details_ref.set({
        "blog_articles": {
            "content": truncated_content,
            "articles_found": total_articles
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

def save_email(user_id: str, unique_id: str, email):
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

    
    # 1️⃣ Aggiorna il documento results con chiave unique_id
    results_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")

    results_ref.set({
        unique_id: {
            "email_generated": True
        }
    }, merge=True)

    # 2️⃣ Salva in details
    details_ref = db.collection("users").document(user_id)\
        .collection("data").document("results")\
        .collection(unique_id).document("details")

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
            "email_generated": True/False
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
            "email_generated": True/False
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
