"""
Task 10.1: Backend Python - API Routes Test - POST /run_module

Tests for the Flask endpoint POST /run_module in server.py:
- Valid request with mocked enqueue_job: returns {"status": "queued"} with status 200
- Missing user_id in body: returns status 400 with error message
- Malformed JSON body: returns status 400
- Empty body: returns status 400
- Empty string user_id: returns status 400
- enqueue_job raises exception: returns status 500
"""

import os
import sys
import json
import importlib.util
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".py-packages"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# ---------------------------------------------------------------------------
# Module-scoped fixture: loads server.py inside a patch.dict context so that
# the sys.modules stubs are cleaned up after all tests in this file complete.
# This prevents the stubs from interfering with the unit test suite that runs
# afterward in the same pytest session.
# ---------------------------------------------------------------------------

_SERVER_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "server.py")
)


@pytest.fixture(scope="module")
def server_mod():
    """
    Load server.py with heavy dependencies stubbed out.

    Uses patch.dict so sys.modules is fully restored when the fixture tears
    down (after all tests in this module complete). The loaded Flask app and
    its function references remain valid throughout the test session.
    """
    stubs = {
        "firebase_admin": MagicMock(),
        "firebase_admin.credentials": MagicMock(),
        "firebase_admin.firestore": MagicMock(),
        "requests": MagicMock(),
        "pytz": MagicMock(),
        "openai": MagicMock(),
        "anthropic": MagicMock(),
        "dateutil": MagicMock(),
        "dateutil.parser": MagicMock(),
        "server": MagicMock(),
        "server.main": MagicMock(),
        "server.recruiter": MagicMock(),
        "server.database": MagicMock(),
        "server.blog_posts": MagicMock(),
        "server.email_generator": MagicMock(),
    }
    with patch.dict("sys.modules", stubs):
        spec = importlib.util.spec_from_file_location("_test_server", _SERVER_PATH)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.app.config["TESTING"] = True
        yield mod
    # patch.dict restores sys.modules here; server stubs are gone


@pytest.fixture
def client(server_mod):
    with server_mod.app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# Tests: POST /run_module - valid request
# ---------------------------------------------------------------------------


class TestRunModuleValidRequest:
    """Valid body with mocked enqueue_job returns 200 with status=queued."""

    def test_valid_user_id_returns_queued(self, client, server_mod):
        """
        Valid body {"user_id": "test123"} with enqueue_job mocked:
        returns {"status": "queued"} with HTTP 200.
        """
        with patch.object(server_mod, "enqueue_job") as mock_enqueue:
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "test123"}),
                content_type="application/json",
            )

        assert response.status_code == 200
        body = response.get_json()
        assert body["status"] == "queued"
        mock_enqueue.assert_called_once()

    def test_valid_user_id_enqueue_called_with_correct_func_and_args(self, client, server_mod):
        """enqueue_job is called with run_server and user_id as args."""
        with patch.object(server_mod, "enqueue_job") as mock_enqueue:
            client.post(
                "/run_module",
                data=json.dumps({"user_id": "test123"}),
                content_type="application/json",
            )

        call_args = mock_enqueue.call_args
        # First positional arg is the function
        func_arg = call_args[0][0]
        assert func_arg is server_mod.run_server
        # keyword 'args' contains the user_id tuple
        passed_args = call_args[1].get("args") or call_args[0][1]
        assert passed_args == ("test123",)


# ---------------------------------------------------------------------------
# Tests: POST /run_module - missing user_id
# ---------------------------------------------------------------------------


class TestRunModuleMissingUserId:
    """Missing user_id field returns 400 with an error message."""

    def test_missing_user_id_returns_400(self, client):
        """Body without user_id key returns HTTP 400."""
        response = client.post(
            "/run_module",
            data=json.dumps({"other_key": "value"}),
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_missing_user_id_returns_error_message(self, client):
        """Response body contains an error field."""
        response = client.post(
            "/run_module",
            data=json.dumps({"other_key": "value"}),
            content_type="application/json",
        )
        body = response.get_json()
        assert body is not None
        assert "error" in body


# ---------------------------------------------------------------------------
# Tests: POST /run_module - malformed JSON body
# ---------------------------------------------------------------------------


class TestRunModuleMalformedJSON:
    """Malformed JSON body returns 400."""

    def test_malformed_json_returns_400(self, client):
        """Sending invalid JSON with application/json content-type returns 400."""
        response = client.post(
            "/run_module",
            data=b"{this is not valid json",
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_partial_json_returns_400(self, client):
        """Truncated JSON object returns 400."""
        response = client.post(
            "/run_module",
            data=b'{"user_id":',
            content_type="application/json",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Tests: POST /run_module - empty body
# ---------------------------------------------------------------------------


class TestRunModuleEmptyBody:
    """Empty body returns 400."""

    def test_no_body_returns_400(self, client):
        """POST with no body (Content-Type: application/json) returns 400."""
        response = client.post("/run_module", content_type="application/json")
        assert response.status_code == 400

    def test_empty_json_object_missing_user_id_returns_400(self, client):
        """POST with {} (no user_id key) returns 400."""
        response = client.post(
            "/run_module",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Tests: POST /run_module - empty string user_id
# ---------------------------------------------------------------------------


class TestRunModuleEmptyStringUserId:
    """Empty string user_id returns 400."""

    def test_empty_string_user_id_returns_400(self, client):
        """user_id="" is not valid and must return HTTP 400."""
        response = client.post(
            "/run_module",
            data=json.dumps({"user_id": ""}),
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_empty_string_user_id_returns_error_message(self, client):
        """Response body contains an error field for empty string user_id."""
        response = client.post(
            "/run_module",
            data=json.dumps({"user_id": ""}),
            content_type="application/json",
        )
        body = response.get_json()
        assert body is not None
        assert "error" in body


# ---------------------------------------------------------------------------
# Tests: POST /run_module - enqueue_job exception
# ---------------------------------------------------------------------------


class TestRunModuleEnqueueException:
    """enqueue_job raising an exception returns 500."""

    def test_enqueue_exception_returns_500(self, client, server_mod):
        """If enqueue_job raises an exception, endpoint returns HTTP 500."""
        with patch.object(
            server_mod, "enqueue_job", side_effect=RuntimeError("queue full")
        ):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_error"}),
                content_type="application/json",
            )

        assert response.status_code == 500

    def test_enqueue_exception_returns_error_body(self, client, server_mod):
        """500 response contains an error field in JSON body."""
        with patch.object(
            server_mod, "enqueue_job", side_effect=Exception("unexpected error")
        ):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_error"}),
                content_type="application/json",
            )

        body = response.get_json()
        assert body is not None
        assert "error" in body
