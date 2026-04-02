"""
Task 10.2: Backend Python - API Routes Test - Auth and Security

Tests documenting the authentication and security behavior of POST /run_module.

Current server.py implementation has no authentication mechanism and no IP
whitelist/firewall. These tests document the CURRENT behavior:

- Requests without an Authorization header succeed (no auth required)
- Requests with an invalid Authorization header are not rejected (no token check)
- Requests from any IP can access the endpoint (no IP whitelist)

If authentication or IP filtering is added in the future, these tests will
need to be updated to reflect the new requirements.
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
# ---------------------------------------------------------------------------

_SERVER_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "server.py")
)


@pytest.fixture(scope="module")
def server_mod():
    """
    Load server.py with heavy dependencies stubbed out.
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
        spec = importlib.util.spec_from_file_location("_test_server_auth", _SERVER_PATH)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.app.config["TESTING"] = True
        yield mod


@pytest.fixture
def client(server_mod):
    with server_mod.app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# Tests: No auth header required (current behavior)
# ---------------------------------------------------------------------------


class TestNoAuthRequired:
    """
    Current server has no authentication. Requests without an Authorization
    header with a valid body are accepted (200) and processed normally.

    Plan note: 'Request without auth header (if required): status 401 or 403'
    Since auth is NOT currently required, valid requests without auth succeed.
    """

    def test_no_auth_header_valid_body_returns_200(self, client, server_mod):
        """
        Valid body without Authorization header returns 200.
        Auth is not required in the current implementation.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_no_auth"}),
                content_type="application/json",
            )
        assert response.status_code == 200

    def test_no_auth_header_returns_queued_status(self, client, server_mod):
        """
        Valid body without Authorization header returns {'status': 'queued'}.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_no_auth"}),
                content_type="application/json",
            )
        body = response.get_json()
        assert body is not None
        assert body.get("status") == "queued"

    def test_no_auth_header_missing_user_id_still_returns_400(self, client):
        """
        Even without an auth header, missing user_id still returns 400.
        Validation errors are independent of authentication.
        """
        response = client.post(
            "/run_module",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Tests: Invalid Authorization header (current behavior)
# ---------------------------------------------------------------------------


class TestInvalidAuthorizationHeader:
    """
    Current server has no token validation. An invalid Authorization header
    does not cause a 401 - the server ignores extra headers and processes the
    request based on the body only.

    Plan note: 'Invalid Authorization header: status 401'
    Since no auth check is implemented, invalid tokens are not rejected.
    """

    def test_invalid_bearer_token_valid_body_returns_200(self, client, server_mod):
        """
        Request with 'Authorization: Bearer invalid_token' and valid body.
        Current server ignores the Authorization header and returns 200.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_bad_token"}),
                content_type="application/json",
                headers={"Authorization": "Bearer invalid_token_xyz"},
            )
        assert response.status_code == 200

    def test_malformed_auth_header_valid_body_returns_200(self, client, server_mod):
        """
        Request with a malformed Authorization header (no 'Bearer' prefix).
        Current server ignores it and returns 200 for valid body.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_bad_header"}),
                content_type="application/json",
                headers={"Authorization": "not-bearer-format"},
            )
        assert response.status_code == 200

    def test_empty_auth_header_valid_body_returns_200(self, client, server_mod):
        """
        Request with an empty Authorization header value.
        Current server ignores it and returns 200 for valid body.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_empty_auth"}),
                content_type="application/json",
                headers={"Authorization": ""},
            )
        assert response.status_code == 200

    def test_invalid_auth_header_missing_user_id_still_returns_400(self, client):
        """
        Invalid auth header with missing user_id: body validation still applies.
        """
        response = client.post(
            "/run_module",
            data=json.dumps({}),
            content_type="application/json",
            headers={"Authorization": "Bearer bad_token"},
        )
        assert response.status_code == 400

    def test_random_token_does_not_crash_server(self, client, server_mod):
        """
        Ensure that a garbage Authorization header does not cause a 500 error.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_garbage"}),
                content_type="application/json",
                headers={"Authorization": "!@#$%^&*()_+"},
            )
        assert response.status_code in (200, 400, 401, 403)
        # Must not be a server error
        assert response.status_code != 500


# ---------------------------------------------------------------------------
# Tests: IP whitelist (current behavior - no firewall)
# ---------------------------------------------------------------------------


class TestIPWhitelist:
    """
    Current server has no IP whitelist or firewall. Requests from any
    REMOTE_ADDR are accepted (Flask test client uses '127.0.0.1' by default).

    Plan note: 'IP not in whitelist (if firewall present): request denied'
    Since no IP whitelist is implemented, this documents the current behavior.
    """

    def test_loopback_ip_request_succeeds(self, client, server_mod):
        """
        Request from 127.0.0.1 (loopback) with valid body returns 200.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_loopback"}),
                content_type="application/json",
                environ_base={"REMOTE_ADDR": "127.0.0.1"},
            )
        assert response.status_code == 200

    def test_external_ip_request_succeeds_no_whitelist(self, client, server_mod):
        """
        Request from an external IP address with valid body returns 200.
        No IP whitelist is enforced in the current implementation.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_external"}),
                content_type="application/json",
                environ_base={"REMOTE_ADDR": "203.0.113.42"},
            )
        assert response.status_code == 200

    def test_private_network_ip_request_succeeds(self, client, server_mod):
        """
        Request from a private network IP (10.x.x.x) with valid body.
        No IP filtering is applied in the current implementation.
        """
        with patch.object(server_mod, "enqueue_job"):
            response = client.post(
                "/run_module",
                data=json.dumps({"user_id": "user_private_net"}),
                content_type="application/json",
                environ_base={"REMOTE_ADDR": "10.0.0.5"},
            )
        assert response.status_code == 200
