import logging
import os
from flask import Flask, request, jsonify
from server.emails_generation import service as emails_generation_service
from server.send_emails import service as send_emails_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    filename="./logs/server/candidai.log",
)

app = Flask(__name__)


def _api_key_valid() -> bool:
    expected = os.environ.get("SESSION_API_KEY", "")
    return request.headers.get("X-API-Key", "") == expected


@app.route("/start_emails_generation", methods=["POST"])
def start_emails_generation():
    data = request.json or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id mancante o vuoto"}), 400
    return emails_generation_service.start(str(user_id))


@app.route("/save_session", methods=["POST"])
def save_session():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    return send_emails_service.save_session(data)


@app.route("/send_emails", methods=["POST"])
def send_emails():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    return send_emails_service.send_emails(data)


@app.route("/save_resend_config", methods=["POST"])
def save_resend_config():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    return send_emails_service.save_resend_config(data)


@app.route("/stop_campaign", methods=["POST"])
def stop_campaign():
    if not _api_key_valid():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    return send_emails_service.stop_campaign(data)
