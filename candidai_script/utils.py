import requests
import io
import json
import pdfplumber
from pathlib import Path
from datetime import datetime, timezone

PDL_LOG_PATH = "./logs/pdl/pdl_log.json"
ROCKETREACH_LOG_PATH = "./logs/rocketreach/rocketreach_log.json"


def _append_log(file_path: str, entry: dict):
    log_file = Path(file_path)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    data = []
    if log_file.exists():
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = []
    data.append(entry)
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def log_pdl_call(api_type: str, params: dict, status_code: int, result, error: str = None):
    """
    Registra una chiamata a People Data Labs nel log JSON.

    api_type: "company_enrich" | "person_search" | "person_enrich"
    result:   dict (company/person) o list (person_search)
    """
    safe_params = {k: v for k, v in params.items() if k not in ("x-api-key", "api_key")}

    if api_type == "company_enrich":
        result_summary = {
            "name": result.get("name"),
            "domain": result.get("website"),
            "industry": result.get("industry"),
            "size": result.get("employee_count"),
            "linkedin_url": result.get("linkedin_url"),
            "location": result.get("location", {}).get("country") if isinstance(result.get("location"), dict) else None,
        } if result else {}
        result_count = 1 if result else 0

    elif api_type == "person_enrich":
        result_summary = {
            "id": result.get("id"),
            "full_name": result.get("full_name"),
            "job_title": result.get("job_title"),
            "job_company_name": result.get("job_company_name"),
            "linkedin_url": result.get("linkedin_url"),
            "emails": [e.get("address") for e in (result.get("emails") or []) if isinstance(e, dict) and e.get("address")][:2],
        } if result else {}
        result_count = 1 if result else 0

    else:  # person_search
        profiles = result if isinstance(result, list) else []
        result_summary = [
            {
                "id": p.get("id"),
                "full_name": p.get("full_name"),
                "job_title": p.get("job_title"),
                "job_company_name": p.get("job_company_name"),
                "linkedin_url": p.get("linkedin_url"),
            }
            for p in profiles[:5]
        ]
        result_count = len(profiles)

    entry = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        "api_type": api_type,
        "params": safe_params,
        "status_code": status_code,
        "result_count": result_count,
        "result_summary": result_summary,
        "error": error,
    }
    _append_log(PDL_LOG_PATH, entry)


def log_rocketreach_call(api_type: str, query_info: dict, result, error: str = None):
    """
    Registra una chiamata a RocketReach nel log JSON.

    api_type:   "person_lookup" | "person_search"
    query_info: per lookup → {"name": ..., "company": ...}
                per search → {"query": {...}}
    result:     dict (lookup) o list (search)
    """
    if api_type == "person_lookup":
        data = result if isinstance(result, dict) else {}
        result_summary = {
            "id": data.get("id"),
            "name": data.get("name"),
            "title": data.get("current_title"),
            "employer": data.get("current_employer"),
            "email": data.get("recommended_professional_email") or data.get("recommended_personal_email"),
        } if data else {}
        result_count = 1 if data else 0
    else:  # person_search
        profiles = result if isinstance(result, list) else []
        result_summary = [
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "title": p.get("current_title"),
                "employer": p.get("current_employer"),
                "linkedin_url": p.get("linkedin_url"),
            }
            for p in profiles[:5]
        ]
        result_count = len(profiles)

    entry = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        "api_type": api_type,
        "query_info": query_info,
        "result_count": result_count,
        "result_summary": result_summary,
        "error": error,
    }
    _append_log(ROCKETREACH_LOG_PATH, entry)

def extract_cv_text(url: str) -> str:
    """
    Scarica un PDF da un URL Firebase Storage e ne estrae il testo.

    Args:
        url (str): URL completo del file PDF su Firebase Storage.

    Returns:
        str: Testo estratto dal PDF, con spazi e righe preservate.
    """
    try:
        # 1️⃣ Scarica il file PDF dalla rete
        response = requests.get(url)
        response.raise_for_status()  # solleva errore se la richiesta fallisce

        # 2️⃣ Crea un buffer in memoria
        pdf_bytes = io.BytesIO(response.content)

        # 3️⃣ Estrai il testo in modo accurato
        testo_completo = []
        with pdfplumber.open(pdf_bytes) as pdf:
            for pagina in pdf.pages:
                testo = pagina.extract_text()
                if testo:
                    testo_completo.append(testo.strip())

        # 4️⃣ Unisci tutto e normalizza un po’ gli spazi
        return "\n\n".join(testo_completo).strip()

    except Exception as e:
        print(f"Errore durante l'elaborazione del PDF: {e}")
        return ""
