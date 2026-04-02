"""
Task 11.2: Backend Python - Firestore Emulator Integration - get_custom_queries

Tests for get_custom_queries in server/database.py.
Uses mock Firestore (no live emulator required) to verify behavior:

Signature:  get_custom_queries(user_id, id) -> (queries, instructions)
Firestore path: users/{user_id}/data/results/{id}/customizations

Scenarios:
- customizations doc present with queries field: returns correct queries + instructions
- customizations doc absent: returns (None, "")
- customizations doc exists but queries field missing: returns ([], instructions)
- customizations doc exists with queries=None: returns (None, instructions)
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
          .document("results")
          .collection(result_id)
          .document("customizations")
          .get()
    """
    db = MagicMock()
    (
        db.collection.return_value
        .document.return_value
        .collection.return_value
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
            "_db_get_custom_queries",
            os.path.join(
                os.path.dirname(__file__), "..", "..", "..",
                "server", "database.py"
            ),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        yield mod


def _run(db_mod, mock_db, user_id, result_id):
    """Call get_custom_queries with a temporarily injected mock db."""
    with patch.object(db_mod, "db", mock_db):
        return db_mod.get_custom_queries(user_id, result_id)


# ---------------------------------------------------------------------------
# Test 1: customizations doc present with queries
# ---------------------------------------------------------------------------


class TestCustomizationsDocPresent:
    """customizations document exists with a queries field: correct values returned."""

    def test_returns_correct_queries_list(self, db_mod):
        """
        When the customizations document exists and has a 'queries' field,
        get_custom_queries returns that list as the first element.
        """
        queries = ["Python developer", "Remote senior engineer"]
        snap = _snap(exists=True, data={"queries": queries, "instructions": "Focus on startups"})
        mock_db = _build_db(snap)

        result_queries, _ = _run(db_mod, mock_db, "user_1", "result_abc")

        assert result_queries == queries

    def test_returns_correct_instructions(self, db_mod):
        """
        When the customizations document exists, the instructions string is
        returned as the second element of the tuple.
        """
        snap = _snap(exists=True, data={"queries": ["dev"], "instructions": "Prefer B2B companies"})
        mock_db = _build_db(snap)

        _, instructions = _run(db_mod, mock_db, "user_1", "result_abc")

        assert instructions == "Prefer B2B companies"

    def test_returns_tuple_of_two_elements(self, db_mod):
        """Return value is always a 2-tuple."""
        snap = _snap(exists=True, data={"queries": [], "instructions": ""})
        mock_db = _build_db(snap)

        result = _run(db_mod, mock_db, "user_2", "result_xyz")

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_empty_queries_list_returned_as_is(self, db_mod):
        """An explicitly empty queries list is returned unchanged."""
        snap = _snap(exists=True, data={"queries": [], "instructions": ""})
        mock_db = _build_db(snap)

        result_queries, _ = _run(db_mod, mock_db, "user_3", "result_001")

        assert result_queries == []


# ---------------------------------------------------------------------------
# Test 2: customizations doc absent
# ---------------------------------------------------------------------------


class TestCustomizationsDocAbsent:
    """customizations document does not exist: returns (None, "")."""

    def test_absent_doc_returns_none_for_queries(self, db_mod):
        """
        When the customizations document does not exist,
        the first element of the returned tuple is None.
        """
        snap = _snap(exists=False)
        mock_db = _build_db(snap)

        result_queries, _ = _run(db_mod, mock_db, "user_absent", "result_missing")

        assert result_queries is None

    def test_absent_doc_returns_empty_string_for_instructions(self, db_mod):
        """
        When the customizations document does not exist,
        the second element is an empty string.
        """
        snap = _snap(exists=False)
        mock_db = _build_db(snap)

        _, instructions = _run(db_mod, mock_db, "user_absent", "result_missing")

        assert instructions == ""

    def test_absent_doc_does_not_raise(self, db_mod):
        """A missing document must not raise any exception."""
        snap = _snap(exists=False)
        mock_db = _build_db(snap)

        # Should complete without raising
        _run(db_mod, mock_db, "user_no_doc", "result_no_doc")


# ---------------------------------------------------------------------------
# Test 3: queries field missing in document
# ---------------------------------------------------------------------------


class TestQueriesFieldMissing:
    """customizations doc exists but has no 'queries' key: returns default []."""

    def test_missing_queries_key_returns_default_empty_list(self, db_mod):
        """
        When the customizations document exists but lacks the 'queries' key,
        dict.get('queries', []) returns [] (the default).
        """
        snap = _snap(exists=True, data={"instructions": "Some instructions"})
        mock_db = _build_db(snap)

        result_queries, _ = _run(db_mod, mock_db, "user_nokey", "result_nokey")

        assert result_queries == []

    def test_missing_queries_key_still_returns_instructions(self, db_mod):
        """
        When 'queries' is absent, the 'instructions' value is still returned.
        """
        snap = _snap(exists=True, data={"instructions": "Look for ML roles"})
        mock_db = _build_db(snap)

        _, instructions = _run(db_mod, mock_db, "user_nokey2", "result_nokey2")

        assert instructions == "Look for ML roles"

    def test_completely_empty_doc_returns_default_list(self, db_mod):
        """An empty customizations document (no fields) returns ([], "")."""
        snap = _snap(exists=True, data={})
        mock_db = _build_db(snap)

        result_queries, instructions = _run(db_mod, mock_db, "user_empty_doc", "result_empty")

        assert result_queries == []
        assert instructions == ""


# ---------------------------------------------------------------------------
# Test 4: queries field is null
# ---------------------------------------------------------------------------


class TestQueriesFieldIsNull:
    """customizations doc exists with queries=null: get returns None (not the default [])."""

    def test_null_queries_returns_none(self, db_mod):
        """
        When the 'queries' field exists in the document but its value is None,
        dict.get('queries', []) returns None (key exists, default not used).
        """
        snap = _snap(exists=True, data={"queries": None, "instructions": ""})
        mock_db = _build_db(snap)

        result_queries, _ = _run(db_mod, mock_db, "user_null", "result_null")

        assert result_queries is None

    def test_null_queries_instructions_still_returned(self, db_mod):
        """
        Even when queries is null, instructions is still returned correctly.
        """
        snap = _snap(exists=True, data={"queries": None, "instructions": "Focus on fintech"})
        mock_db = _build_db(snap)

        _, instructions = _run(db_mod, mock_db, "user_null2", "result_null2")

        assert instructions == "Focus on fintech"
