import os
import sys

# Add the workspace py-packages directory to path
sys.path.insert(0, "/workspace/.py-packages")

from dotenv import load_dotenv

# Load test environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.test"))

import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture(scope="session", autouse=True)
def setup_firebase_emulators():
    """Patch firebase_admin credentials and connect to emulators."""
    with patch("firebase_admin.credentials.Certificate") as mock_cert:
        mock_cert.return_value = MagicMock()
        yield


@pytest.fixture(scope="session")
def flask_app():
    """Create Flask test app."""
    import importlib.util

    server_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
    spec = importlib.util.spec_from_file_location("server", server_path)
    if spec is None or spec.loader is None:
        pytest.skip("server.py not found")

    server_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(server_module)

    app = getattr(server_module, "app", None)
    if app is None:
        pytest.skip("Flask app not found in server.py")

    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(flask_app):
    """Return Flask test client."""
    return flask_app.test_client()


@pytest.fixture
def firestore_client():
    """Return a Firestore client connected to the emulator."""
    os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {"projectId": "demo-candidai"})
        return firestore.client()
    except Exception:
        return None
