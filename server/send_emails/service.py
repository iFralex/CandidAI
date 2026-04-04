import logging
from flask import jsonify
from server.send_emails import session as session_module
from server.send_emails.session import VALID_PROVIDERS
from server.send_emails import campaign as campaign_module
from server.worker import enqueue

logger = logging.getLogger(__name__)


def save_session(data: dict):
    for field in ("user_id", "provider", "cookies", "fingerprint"):
        if field not in data:
            return jsonify({"error": f"{field} mancante"}), 400

    provider = str(data["provider"])
    if provider not in VALID_PROVIDERS:
        return jsonify({"error": "Provider non valido"}), 400

    session_module.save(
        user_id=str(data["user_id"]),
        provider=provider,
        cookies=data["cookies"],
        fingerprint=data["fingerprint"],
    )
    return jsonify({"status": "saved"}), 200


def send_emails(data: dict):
    for field in ("user_id", "provider", "emails"):
        if field not in data:
            return jsonify({"error": f"{field} mancante"}), 400

    user_id = str(data["user_id"])
    provider = str(data["provider"])
    emails = data["emails"]

    if provider not in VALID_PROVIDERS:
        return jsonify({"error": "Provider non valido"}), 400

    if not isinstance(emails, list) or not emails:
        return jsonify({"error": "Lista email non valida"}), 400

    if not session_module.exists(user_id, provider):
        return jsonify({"error": "Sessione non trovata, riconnetti il provider"}), 404

    campaign_module.cancelled_campaigns.discard(user_id)

    try:
        enqueue(campaign_module.run, args=(user_id, provider, emails))
    except Exception as e:
        logger.error(f"Errore enqueue send_emails: {e}")
        return jsonify({"error": "Errore interno del server"}), 500

    return jsonify({"status": "queued", "message": f"Campagna di {len(emails)} email accodata"}), 200


def stop_campaign(data: dict):
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id mancante"}), 400

    campaign_module.cancelled_campaigns.add(str(user_id))
    logger.info(f"Campagna segnata per cancellazione: user {user_id}")
    return jsonify({"status": "stopping"}), 200
