import logging
from flask import jsonify
from server.worker import enqueue
import server.emails_generation.main as main_module

logger = logging.getLogger(__name__)


def _run(user_id: str) -> None:
    logger.info(f"Avvio generazione email per user {user_id}")
    result = main_module.run(user_id)
    logger.info(f"Generazione completata per user {user_id}: {result}")


def start(user_id: str):
    try:
        enqueue(_run, args=(user_id,))
    except Exception as e:
        logger.error(f"Errore enqueue start_emails_generation: {e}")
        return jsonify({"error": "Errore interno del server"}), 500

    return jsonify({"status": "queued", "message": f"Job per user {user_id} aggiunto in coda"}), 200
