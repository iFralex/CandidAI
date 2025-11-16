from flask import Flask, request, jsonify
import threading
import time

# Import del tuo modulo
import candidai_script.main as main_module  # Assicurati che main.py abbia una funzione run(user_id)

app = Flask(__name__)

# --- Dizionario di lock per utente ---
user_locks = {}
user_locks_lock = threading.Lock()  # protezione del dizionario globale

def run_candidai_script(user_id):
    """
    Funzione wrapper per eseguire il modulo CandidAI con user_id.
    Deve restituire il risultato.
    """
    # Esempio: chiama la funzione run nel modulo
    print(user_id)
    result = main_module.run(user_id)
    return result

@app.route("/run_module", methods=["POST"])
def run_module():
    print("a")
    data = request.json
    print(data)
    return jsonify({"result": data})
    if not data or "user_id" not in data:
        return jsonify({"error": "user_id mancante"}), 400

    user_id = str(data["user_id"])

    # Ottieni il lock dell'utente, creandolo se necessario
    with user_locks_lock:
        if user_id not in user_locks:
            user_locks[user_id] = threading.Lock()
        user_lock = user_locks[user_id]

    # Acquisisce il lock dell'utente: se già in uso, aspetta finché l'altro modulo finisce
    with user_lock:
        try:
            result = run_candidai_script(user_id)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"result": result})