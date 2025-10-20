from candidai_script.recruiter import find_recruiters_for_user
from candidai_script.blog_posts import get_blog_posts
from candidai_script.database import get_account_data, save_companies_to_results
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

def main():
    user_id = "qJTjvx46caUSRMPPygNnmhNNsrL2"#"ubcXUkixqchJEBoQ895M2jDy93H2"#"WWQLqljHlWTg8NbCmE00seHglXu1"
    account = get_account_data(user_id)
    if not account:
        return
    
    companies = account.get("companies", [])

    ids = save_companies_to_results(user_id, account["companies"])

    # Configura il logging una volta (magari all'inizio del tuo script)
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )

    # Funzioni da eseguire in parallelo
    tasks = [
        ("get_blog_posts", get_blog_posts, (user_id, ids, companies, account["profileSummary"])),
        ("find_recruiters_for_user", find_recruiters_for_user, (user_id, ids, companies, account.get("queries", []))),
    ]

    results = {}

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {executor.submit(func, *args): name for name, func, args in tasks}

        for future in as_completed(futures):
            task_name = futures[future]
            try:
                result = future.result()
                results[task_name] = result
                logging.info(f"✅ Task '{task_name}' completato con successo.")
            except Exception as e:
                logging.error(f"❌ Errore nel task '{task_name}': {e}", exc_info=True)
                results[task_name] = None

    # Puoi accedere ai risultati se le funzioni restituiscono qualcosa
    result_blog = results["get_blog_posts"]
    result_recruiters = results["find_recruiters_for_user"]

if __name__ == "__main__":
    main()