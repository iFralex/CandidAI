"""
Task 11.3: Backend Python - Firestore Emulator Integration - get_account_data

Tests for get_account_data in server/database.py.
Uses mock Firestore (no live emulator required) to verify behavior:

Signature:  get_account_data(user_id) -> dict | None
Firestore path: users/{user_id}/data/account

Scenarios:
- Complete document: returns all fields from the document
- Partial document: returns available fields (no KeyError for missing ones)
- Document absent: returns None (no KeyError or exception raised)
- Expired or invalid cvUrl: returned as-is without raising an error
"""

import sys
import os
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".py-packages"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _snap(exists=True, data=None):
    """Return a mock DocumentSnapshot."""
    s = MagicMock()
    s.exists = exists
    s.to_dict.return_value = dict(data) if data is not None else {}
    return s


def _build_db(snap):
    """
    Build a minimal mock Firestore client that returns `snap` for:
        db.collection("users")
          .document(user_id)
          .collection("data")
          .document("account")
          .get()
    """
    db = MagicMock()
    (
        db.collection.return_value
        .document.return_value
        .collection.return_value
        .document.return_value
        .get.return_value
    ) = snap
    return db


# ---------------------------------------------------------------------------
# Module fixture
# ---------------------------------------------------------------------------

_MOCK_MODULES = {
    "firebase_admin": MagicMock(),
    "firebase_admin.credentials": MagicMock(),
    "firebase_admin.firestore": MagicMock(),
    "dotenv": MagicMock(),
    "requests": MagicMock(),
    "pytz": MagicMock(),
    "openai": MagicMock(),
    "anthropic": MagicMock(),
    "dateutil": MagicMock(),
    "dateutil.parser": MagicMock(),
}


@pytest.fixture(scope="module")
def db_mod():
    """Load server.database with all external dependencies mocked."""
    mock_candidai = MagicMock()
    mock_candidai.db = None  # replaced per-test via patch.object

    with patch.dict("sys.modules", {**_MOCK_MODULES, "server": mock_candidai}):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "_db_get_account_data",
            os.path.join(
                os.path.dirname(__file__), "..", "..", "..",
                "server", "database.py"
            ),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        yield mod


def _run(db_mod, mock_db, user_id):
    """Call get_account_data with a temporarily injected mock db."""
    with patch.object(db_mod, "db", mock_db):
        return db_mod.get_account_data(user_id)


# ---------------------------------------------------------------------------
# Test 1: Complete document - returns all fields
# ---------------------------------------------------------------------------


class TestCompleteDocument:
    """Account document exists with all expected fields: all are returned."""

    def test_returns_all_fields_from_complete_document(self, db_mod):
        """
        When the account document contains all typical fields,
        get_account_data returns the full dict with all of them.
        """
        account_data = {
            "email": "user@example.com",
            "name": "Jane Doe",
            "plan": "pro",
            "credits": 100,
            "cvUrl": "https://storage.example.com/cv/user123.pdf",
            "createdAt": "2024-01-15T10:00:00Z",
        }
        snap = _snap(exists=True, data=account_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_complete")

        assert result == account_data

    def test_returns_dict_type(self, db_mod):
        """get_account_data returns a dict when document exists."""
        snap = _snap(exists=True, data={"email": "a@b.com", "plan": "free"})
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_type_check")

        assert isinstance(result, dict)

    def test_all_field_values_preserved(self, db_mod):
        """Every field value in the document is returned unchanged."""
        account_data = {
            "email": "test@domain.org",
            "credits": 42,
            "plan": "enterprise",
            "cvUrl": "https://cdn.example.com/files/cv.pdf",
        }
        snap = _snap(exists=True, data=account_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_values")

        assert result["email"] == "test@domain.org"
        assert result["credits"] == 42
        assert result["plan"] == "enterprise"
        assert result["cvUrl"] == "https://cdn.example.com/files/cv.pdf"

    def test_returns_all_expected_keys(self, db_mod):
        """All keys present in the document appear in the returned dict."""
        account_data = {
            "email": "k@k.com",
            "name": "Test User",
            "plan": "basic",
            "credits": 5,
            "cvUrl": "https://example.com/cv.pdf",
        }
        snap = _snap(exists=True, data=account_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_keys")

        for key in account_data:
            assert key in result, f"Expected key '{key}' to be present in result"


# ---------------------------------------------------------------------------
# Test 2: Partial document - returns available fields, no errors
# ---------------------------------------------------------------------------


class TestPartialDocument:
    """Account document exists but some fields are missing: returns available fields."""

    def test_partial_doc_returns_available_fields(self, db_mod):
        """
        When only some fields are present, the returned dict contains
        exactly those fields — no KeyError for the missing ones.
        """
        partial_data = {"email": "partial@example.com", "plan": "free"}
        snap = _snap(exists=True, data=partial_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_partial")

        assert result["email"] == "partial@example.com"
        assert result["plan"] == "free"

    def test_partial_doc_does_not_raise(self, db_mod):
        """A document missing several typical fields must not raise any exception."""
        snap = _snap(exists=True, data={"email": "only@email.com"})
        mock_db = _build_db(snap)

        # Should complete without raising
        result = _run(db_mod, mock_db, "user_partial_no_raise")
        assert result is not None

    def test_partial_doc_missing_cvurl_does_not_raise(self, db_mod):
        """
        When cvUrl is absent from the document, no KeyError is raised.
        The function does not access cvUrl directly; it returns to_dict() as-is.
        """
        snap = _snap(exists=True, data={"email": "nocv@example.com", "plan": "pro"})
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_no_cv")

        assert "cvUrl" not in result

    def test_empty_document_returns_empty_dict(self, db_mod):
        """
        A document that exists but has no fields returns an empty dict,
        not None and not an exception.
        """
        snap = _snap(exists=True, data={})
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_empty_doc")

        assert result == {}

    def test_partial_doc_only_credits_field(self, db_mod):
        """A document with only 'credits' returns a dict with that single key."""
        snap = _snap(exists=True, data={"credits": 50})
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_credits_only")

        assert result == {"credits": 50}


# ---------------------------------------------------------------------------
# Test 3: Document absent - returns None (default structure, no KeyError)
# ---------------------------------------------------------------------------


class TestDocumentAbsent:
    """Account document does not exist: returns None without raising exceptions."""

    def test_absent_doc_returns_none(self, db_mod):
        """
        When the account document does not exist,
        get_account_data must return None.
        """
        snap = _snap(exists=False)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_absent")

        assert result is None

    def test_absent_doc_does_not_raise(self, db_mod):
        """A missing document must not raise any exception (no KeyError, etc.)."""
        snap = _snap(exists=False)
        mock_db = _build_db(snap)

        # Must complete without raising
        _run(db_mod, mock_db, "user_no_doc")

    def test_absent_doc_does_not_raise_key_error(self, db_mod):
        """
        Specifically, no KeyError should be raised when the document
        is absent and the caller would otherwise attempt to access fields.
        """
        snap = _snap(exists=False)
        mock_db = _build_db(snap)

        try:
            result = _run(db_mod, mock_db, "user_key_error_check")
            # Function returns None; accessing fields would be caller's responsibility
            assert result is None
        except KeyError as e:
            pytest.fail(f"KeyError raised when document is absent: {e}")

    def test_different_user_ids_absent_all_return_none(self, db_mod):
        """
        Any user_id for which the account doc is absent returns None.
        The behavior is consistent regardless of the user_id value.
        """
        snap = _snap(exists=False)

        for uid in ["user_001", "user_999", "admin_xyz", ""]:
            mock_db = _build_db(snap)
            result = _run(db_mod, mock_db, uid)
            assert result is None, f"Expected None for user_id={uid!r}, got {result!r}"


# ---------------------------------------------------------------------------
# Test 4: Expired or invalid cvUrl - handled gracefully
# ---------------------------------------------------------------------------


class TestInvalidCvUrl:
    """
    Documents containing expired or invalid cvUrl values are handled gracefully.
    get_account_data does not validate cvUrl; it returns the field as-is.
    """

    def test_expired_cv_url_returned_as_is(self, db_mod):
        """
        An expired cvUrl (e.g., a pre-signed URL that has timed out) is
        returned in the dict without raising an error.
        """
        account_data = {
            "email": "user@example.com",
            "plan": "pro",
            "cvUrl": "https://storage.googleapis.com/expired-bucket/cv.pdf?X-Goog-Expires=0",
        }
        snap = _snap(exists=True, data=account_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_expired_cv")

        assert result is not None
        assert "cvUrl" in result
        assert "expired" in result["cvUrl"]

    def test_invalid_cv_url_string_returned_as_is(self, db_mod):
        """
        A malformed or invalid cvUrl string is returned in the dict unchanged.
        """
        account_data = {
            "email": "user@example.com",
            "cvUrl": "not-a-valid-url",
        }
        snap = _snap(exists=True, data=account_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_invalid_cv")

        assert result["cvUrl"] == "not-a-valid-url"

    def test_none_cv_url_returned_as_is(self, db_mod):
        """
        A cvUrl field whose value is explicitly None is returned as-is
        without raising an error.
        """
        account_data = {
            "email": "user@example.com",
            "plan": "free",
            "cvUrl": None,
        }
        snap = _snap(exists=True, data=account_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_none_cv")

        assert "cvUrl" in result
        assert result["cvUrl"] is None

    def test_empty_string_cv_url_returned_as_is(self, db_mod):
        """
        An empty string cvUrl is returned as-is without raising an error.
        """
        account_data = {
            "email": "user@example.com",
            "cvUrl": "",
        }
        snap = _snap(exists=True, data=account_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_empty_cv")

        assert result["cvUrl"] == ""

    def test_cv_url_with_special_characters_returned_as_is(self, db_mod):
        """
        A cvUrl containing percent-encoded or special characters is returned
        without modification or error.
        """
        account_data = {
            "email": "user@example.com",
            "cvUrl": "https://storage.example.com/cv%20files/my%20resume%20(2024).pdf",
        }
        snap = _snap(exists=True, data=account_data)
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_special_cv")

        assert result["cvUrl"] == "https://storage.example.com/cv%20files/my%20resume%20(2024).pdf"
