from candidai_script.recruiter import find_recruiters_for_user
from candidai_script.blog_posts import get_blog_posts
from candidai_script.email_generator import generate_email
from candidai_script.database import (
    get_account_data,
    save_companies_to_results,
    get_results_status,
    get_results_row,
)
import logging
import time


def main(mode="auto", manual_tasks=None, target_companies=None):
    """
    Esegue i task per generare blog, recruiter ed email in modalità automatica o manuale.

    Args:
        mode (str): "auto" o "manual".
        manual_tasks (list): task da rieseguire manualmente, es. ["blog", "recruiters", "email"]
        target_companies (list): aziende specifiche da includere, es. ["Google", "Meta"]
    """
    user_id = "8TGSaFuS3ObRNnbZ3BxMa4KOmlG3"#"ubcXUkixqchJEBoQ895M2jDy93H2"
    account = get_account_data(user_id)

    if not account:
        print("❌ Account non trovato.")
        return

    companies = account.get("companies", [])
    companies = [companies[3]]
    profile_summary = account["profileSummary"]
    cv_url = account["cvUrl"]

    # Crea o recupera ID univoci per ogni azienda
    ids = save_companies_to_results(user_id, companies)

    # Configura logging
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s - %(message)s",
        datefmt="%H:%M:%S",
    )

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

            if "blog" in company_tasks:
                start = time.time()
                result_blog = get_blog_posts(user_id, single_id, single_company_list, profile_summary)
                logging.info(f"✅ Blog completato per {name} ({time.time() - start:.2f}s)")

            if "recruiters" in company_tasks:
                start = time.time()
                result_recruiters = find_recruiters_for_user(
                    user_id, single_id, single_company_list, account.get("queries", [])
                )
                logging.info(f"✅ Recruiter completato per {name} ({time.time() - start:.2f}s)")
            
            if "email" in company_tasks:
                start = time.time()
                if not result_blog or not result_recruiters:
                    row = get_results_row(user_id, ids[company_key])

                    if not result_blog:
                        result_blog = {name: row.get("blog_articles", {}).get("content", None)}
                    if not result_recruiters:
                        result_recruiters = {name: [row.get("recruiter", None), row.get("query", None)]}

                generate_email(
                    user_id,
                    single_id,
                    single_company_list,
                    profile_summary,
                    cv_url,
                    result_blog,
                    result_recruiters,
                )
                logging.info(f"✅ Email generata per {name} ({time.time() - start:.2f}s)")

        except Exception as e:
            logging.error(f"❌ Errore nell'elaborazione di {name}: {e}", exc_info=True)

    logging.info("\n🎉 Tutti i processi terminati.")


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

    for company in companies:
        name = company["name"]
        company_key = f"{name}-{user_id}"
        data = current_status.get(ids[company_key], {})
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
            if not data.get("email_generated", False):
                company_tasks.append("email")

        if company_tasks:
            tasks_per_company[name] = company_tasks

    return tasks_per_company


if __name__ == "__main__":
    # 🔹 Esempi d’uso:

    # 1️⃣ Modalità automatica → esegue solo ciò che manca
    # main(mode="auto")

    # 2️⃣ Modalità manuale → forza solo recruiter ed email per tutte le aziende
    # main(mode="manual", manual_tasks=["recruiters", "email"])

    # 3️⃣ Modalità manuale → forza solo blog per alcune aziende
    # main(mode="manual", manual_tasks=["blog"], target_companies=["Google", "Meta"])

    main(mode="auto")
