from server.emails_generation.recruiter import find_recruiters_for_user, get_companies_info, get_pdl_data
from server.emails_generation.blog_posts import get_blog_posts, extract_articles_content
from server.emails_generation.email_generator import generate_email
from server.emails_generation.database import (
    get_account_data,
    get_changed_companies,
    save_companies_to_results,
    get_results_status,
    get_results_row,
    get_custom_queries,
    get_user_settings,
    get_user_data,
    valid_account,
    update_pending_articles_content,
)
import logging
import os
import time
import requests

def main(user_id, mode="auto", manual_tasks=None, target_companies=None):
    """
    Esegue i task per generare blog, recruiter ed email in modalità automatica o manuale.

    Args:
        mode (str): "auto" o "manual".
        manual_tasks (list): task da rieseguire manualmente, es. ["blog", "recruiters", "email"]
        target_companies (list): aziende specifiche da includere, es. ["Google", "Meta"]
    """
    if not valid_account(user_id):
        print("❌ Account non valido. Completa il profilo prima di eseguire lo script.")
        return
       
    account = get_account_data(user_id)
    changed_companies = get_changed_companies(user_id)

    if not account:
        print("❌ Account non trovato.")
        return

    companies = account.get("companies", [])
    profile_summary = account["profileSummary"]
    cv_url = account["cvUrl"]
    position_description = account.get("customizations", {}).get("position_description", "")
    user_instructions = account.get("customizations", {}).get("instructions", "")
    
    # Crea o recupera ID univoci per ogni azienda
    companies, ids, new_companies = save_companies_to_results(user_id, companies, changed_companies)
    logging.info(f"🏢 Nuove aziende aggiunte: {[c['name'] for c in new_companies]}"  )
    if len(new_companies) > 0:
        get_companies_info(user_id, ids, new_companies)
    logging.info(f"🏢 Aziende da processare: {[c['name'] for c in companies]}"  )

    companies = [c for c in companies if c not in new_companies]

    # Recupera lo stato attuale
    current_status = get_results_status(user_id)

    # Determina i task da eseguire per ciascuna azienda
    tasks_per_company = decide_tasks_per_company(
        mode, manual_tasks, current_status, companies, user_id, ids, target_companies
    )

    if not tasks_per_company:
        print("✅ Tutte le aziende sono già complete.")
        return

    logging.info(f"🚀 Avvio processi in modalità '{mode.upper()}'")

    generated_email_data = []

    # Esegui per ogni azienda
    for company in companies:
        name = company["name"]
        if name not in tasks_per_company:
            continue

        company_tasks = tasks_per_company[name]
        company_key = f"{name}-{user_id}"
        single_id = {company_key: ids[company_key]}
        single_company_list = [company]

        logging.info(f"\n🏢 {name}: eseguo {company_tasks}")

        try:
            # Esegui task in ordine logico
            result_blog = None
            result_recruiters = None
            custom_user_inscructions = {}

            if "blog" in company_tasks:
                start = time.time()
                result_blog = get_blog_posts(user_id, single_id, single_company_list, profile_summary, position_description)
                logging.info(f"✅ Blog completato per {name} ({time.time() - start:.2f}s)")

            if "recruiters" in company_tasks:
                start = time.time()
                result_recruiters, custom_user_inscructions = find_recruiters_for_user(
                    user_id, single_id, single_company_list, account.get("queries", [])
                )
                logging.info(f"✅ Recruiter completato per {name} ({time.time() - start:.2f}s)")
            
            if "email" in company_tasks:
                start = time.time()
                row = get_results_row(user_id, ids[company_key])

                articles = row.get("blog_articles", {}).get("content") or []
                pending = [a for a in articles if a.get("pending_content")]
                if pending:
                    logging.info(f"📥 Recupero contenuto per {len(pending)} articoli pending di {name}")
                    fetched = extract_articles_content(
                        [{"href": a["url"], "title": a.get("title", "")} for a in pending]
                    )
                    fetched_by_url = {a["url"]: f for a, f in zip(pending, fetched)}
                    articles = [
                        {
                            "url": a["url"],
                            "title": fetched_by_url[a["url"]].get("title") or a.get("title", ""),
                            "markdown": fetched_by_url[a["url"]].get("markdown", ""),
                        }
                        if a.get("pending_content") else a
                        for a in articles
                    ]
                    update_pending_articles_content(user_id, ids[company_key], articles)

                result_blog = {name: articles}
                result_recruiters = {name: [row.get("recruiter", None), row.get("query", None)]}
                result_company_info = {name: row.get("company_info", None)}
                if not ids[company_key] in custom_user_inscructions:
                    queries, custom_user_inscructions[ids[company_key]], _ = get_custom_queries(user_id, ids[f'{company["name"]}-{user_id}'])

                email_result = generate_email(
                    user_id,
                    single_id,
                    single_company_list,
                    profile_summary,
                    cv_url,
                    result_blog,
                    result_recruiters,
                    result_company_info,
                    custom_user_inscructions[ids[company_key]] or user_instructions
                )
                logging.info(f"✅ Email generata per {name} ({time.time() - start:.2f}s)")

                if email_result and name in email_result:
                    recruiter_data = row.get("recruiter") or {}
                    generated_email_data.append({
                        "company": {"name": name, "domain": company.get("domain", "")},
                        "recruiter": {
                            "name": recruiter_data.get("full_name", ""),
                            "jobTitle": recruiter_data.get("job_title", ""),
                        },
                        "articles": [
                            {"title": a.get("title", ""), "link": a.get("link", a.get("url", ""))}
                            for a in articles[:3] if isinstance(a, dict)
                        ],
                        "preview": (email_result[name].get("body") or ""),
                    })

        except Exception as e:
            logging.error(f"❌ Errore nell'elaborazione di {name}: {e}", exc_info=True)

    logging.info("\n🎉 Tutti i processi terminati.")

    if generated_email_data:
        _send_notification_email(user_id, generated_email_data)


def decide_tasks_per_company(mode, manual_tasks, current_status, companies, user_id, ids, target_companies=None):
    """
    Restituisce un dizionario dei task da eseguire per ciascuna azienda:
    {
        "Google": ["recruiters", "email"],
        "Meta": ["blog", "recruiters", "email"]
    }
    """
    tasks_per_company = {}
    target_companies = [c for c in target_companies] if target_companies else None

    if not isinstance(current_status, dict):
        current_status = {}

    for company in companies:
        name = company["name"]
        company_key = f"{name}-{user_id}"
        raw = current_status.get(ids.get(company_key), {})
        data = raw if isinstance(raw, dict) else {}
        company_tasks = []

        # Se specificate aziende target, ignora le altre
        if target_companies and name not in target_companies:
            continue

        if mode == "manual":
            # Forza riesecuzione solo dei task specificati
            company_tasks = manual_tasks or []
        else:
            # Modalità automatica → controlla cosa manca nel DB
            if "blog_articles" not in data:
                company_tasks.append("blog")
            if "recruiter" not in data:
                company_tasks.append("recruiters")
            if not "email_sent" in data:
                company_tasks.append("email")

        if company_tasks:
            tasks_per_company[name] = company_tasks

    return tasks_per_company

def _send_notification_email(user_id, generated_email_data):
    """Invia una mail riepilogativa tramite l'endpoint Next.js /api/send-email."""
    domain = os.environ.get("NEXT_PUBLIC_DOMAIN", "").rstrip("/")
    if not domain:
        logging.warning("⚠️ NEXT_PUBLIC_DOMAIN non impostato, notifica email saltata")
        return

    # Caso speciale: free trial con prima email generata
    user_data = get_user_data(user_id) or {}
    plan = user_data.get("plan", "free_trial")
    if plan == "free_trial" and len(generated_email_data) >= 1:
        try:
            resp = requests.post(
                f"{domain}/api/send-email",
                json={
                    "userId": user_id,
                    "type": "first_email_generated",
                    "data": {"newData": generated_email_data},
                },
                timeout=30,
            )
            if resp.ok:
                logging.info("📧 Notifica prima email (free trial) inviata")
            else:
                logging.warning(f"⚠️ Notifica prima email fallita: {resp.status_code} {resp.text}")
        except Exception as e:
            logging.error(f"❌ Errore invio notifica prima email: {e}")
        return

    settings = get_user_settings(user_id)
    threshold = settings.get("emailNotificationThreshold", 10)

    if threshold == 0:
        return  # Notifiche disabilitate

    if len(generated_email_data) < threshold:
        return

    try:
        resp = requests.post(
            f"{domain}/api/send-email",
            json={
                "userId": user_id,
                "type": "new_emails_generated",
                "data": {"newData": generated_email_data},
            },
            timeout=30,
        )
        if resp.ok:
            logging.info(f"📧 Notifica inviata per {len(generated_email_data)} email generate")
        else:
            logging.warning(f"⚠️ Notifica email fallita: {resp.status_code} {resp.text}")
    except Exception as e:
        logging.error(f"❌ Errore invio notifica email: {e}")


def run(user_id):
    return main(user_id=user_id, mode="auto")