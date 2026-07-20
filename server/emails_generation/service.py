import logging
from flask import jsonify
from server.worker import enqueue
import server.emails_generation.main as main_module
import server.emails_generation.onboarding_preview as preview_module

logger = logging.getLogger(__name__)


def _run(user_id: str) -> None:
    logger.info(f"Avvio generazione email per user {user_id}")
    result = main_module.run(user_id)
    logger.info(f"Generazione completata per user {user_id}: {result}")


def start(user_id: str):
    try:
        enqueue(_run, args=(user_id,), queue="emails_generation")
    except Exception as e:
        logger.error(f"Errore enqueue start_emails_generation: {e}")
        return jsonify({"error": "Errore interno del server"}), 500

    return jsonify({"status": "queued", "message": f"Job per user {user_id} aggiunto in coda"}), 200


def start_onboarding_recruiter(user_id: str, job_id: str):
    try:
        enqueue(
            preview_module.find_recruiter,
            args=(user_id, job_id),
            queue="onboarding_realtime",
        )
    except Exception as e:
        logger.error(f"Errore enqueue recruiter realtime: {e}")
        return jsonify({"error": "Errore interno del server"}), 500
    return jsonify({"status": "queued", "job_id": job_id}), 202


def start_onboarding_email(user_id: str, job_id: str):
    try:
        enqueue(
            preview_module.create_email,
            args=(user_id, job_id),
            queue="onboarding_realtime",
        )
    except Exception as e:
        logger.error(f"Errore enqueue email realtime: {e}")
        return jsonify({"error": "Errore interno del server"}), 500
    return jsonify({"status": "queued", "job_id": job_id}), 202
