from flask import Flask, request, jsonify
import threading
import queue
import logging
import candidai_script.main as main_module

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    filename="./candidai.log",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- Coda globale dei job ---
job_queue = queue.Queue()

def worker():
    """
    Thread worker globale: esegue un job alla volta dalla coda.
    """
    while True:
        func, args = job_queue.get()
        try:
            logger.info(f"Esecuzione job per user {args[0]}")
            func(*args)
            logger.info(f"Job completato per user {args[0]}")
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione job: {e}")
        finally:
            job_queue.task_done()

# Avvio del thread worker globale
threading.Thread(target=worker, daemon=True).start()

def enqueue_job(func, args=()):
    """
    Inserisce un job nella coda globale.
    """
    job_queue.put((func, args))

def run_candidai_script(user_id):
    """
    Funzione wrapper per il modulo CandidAI.
    """
    logger.info(f"Start run_candidai_script for user {user_id}")
    result = main_module.run(user_id)
    logger.info(f"End run_candidai_script for user {user_id} with result: {result}")
    return result

@app.route("/run_module", methods=["POST"])
def run_module():
    data = request.json
    if not data or "user_id" not in data:
        return jsonify({"error": "user_id mancante"}), 400

    user_id = str(data["user_id"])

    # Inserisci il job nella coda globale
    enqueue_job(run_candidai_script, args=(user_id,))

    # Ritorna subito
    return jsonify({"status": "queued", "message": f"Job per user {user_id} aggiunto in coda"}), 200