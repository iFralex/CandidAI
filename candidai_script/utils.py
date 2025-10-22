import requests
import io
import pdfplumber

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
