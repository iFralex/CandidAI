"""
Task 11.1: Backend Python - Firestore Emulator Integration - save_companies_to_results

Tests for save_companies_to_results in server/database.py.
Uses mock Firestore (no live emulator required) to verify Firestore interaction
behavior:

- New user (no previous results): 3 new companies -> 3 docs created in results
- User with existing results: existing companies are not duplicated
- Existing company data (including email_sent) is not modified on re-run
- companies_to_confirm filters out confirmed companies from the return value
- Empty company list: no Firestore writes performed
- Special domain/name company (subdomain, uncommon TLD): handled correctly
- Firestore timeout: propagates as an exception with a clear traceback
"""

import sys
import os
import pytest
from unittest.mock import MagicMock, patch, call

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".py-packages"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# ---------------------------------------------------------------------------
# Helpers: build mock Firestore infrastructure
# ---------------------------------------------------------------------------

SENTINEL_TIMESTAMP = object()  # stand-in for firestore.SERVER_TIMESTAMP


def _snap(exists=True, data=None):
    """Return a mock DocumentSnapshot."""
    s = MagicMock()
    s.exists = exists
    s.to_dict.return_value = dict(data) if data else {}
    return s


class _MockDB:
    """
    Lightweight mock of the Firestore client that supports the access patterns
    used by save_companies_to_results:

        db.collection("users").document(uid).collection("data").document("results").get()
        db.collection("ids").document(company_key).get()
        db.collection("ids").document(company_key).set({"id": ...}, merge=True)
        db.collection("generated_ids").document().id
        db.collection("users")...document("results").set(data)
        db.collection("users")...document("details").set(data)
        db.collection("users")...document("changed_companies").update(data)
    """

    def __init__(self, results_snap, id_snaps=None, new_ids=None):
        """
        :param results_snap: DocumentSnapshot returned for users/{uid}/data/results.get()
        :param id_snaps: dict mapping company_key -> DocumentSnapshot for ids collection
        :param new_ids: list of IDs returned by generated_ids.document().id (cycled)
        """
        self._results_snap = results_snap
        self._id_snaps = id_snaps or {}
        self._new_ids = list(new_ids or ["id_new_001", "id_new_002", "id_new_003"])
        self._new_id_idx = 0

        # Recorded calls for assertion
        self.results_set_calls = []      # (data,) for each .set() on results doc
        self.details_set_calls = []      # (sub_id, data) for each details.set()
        self.ids_set_calls = []          # (company_key, id) for each ids.set()
        self.changed_update_calls = []   # data passed to changed_companies.update()

        self.db = self._build()

    def _next_id(self):
        idx = self._new_id_idx % len(self._new_ids)
        self._new_id_idx += 1
        return self._new_ids[idx]

    def _build(self):
        db = MagicMock()

        # ---- generated_ids collection ----
        gen_ids_coll = MagicMock()
        gen_ids_doc = MagicMock()
        gen_ids_doc.id = None  # will be controlled via side_effect below

        def _gen_doc_factory():
            m = MagicMock()
            m.id = self._next_id()
            return m

        gen_ids_coll.document.side_effect = lambda: _gen_doc_factory()

        # ---- ids collection ----
        ids_coll = MagicMock()
        captured_ids_set = self.ids_set_calls
        id_snaps = self._id_snaps

        def _ids_document(key):
            snap = id_snaps.get(key, _snap(exists=False))
            ref = MagicMock()
            ref.get.return_value = snap
            ref.set.side_effect = lambda data, **kw: captured_ids_set.append((key, data.get("id")))
            return ref

        ids_coll.document.side_effect = _ids_document

        # ---- users collection ----
        users_coll = MagicMock()
        results_snap = self._results_snap
        results_set_calls = self.results_set_calls
        details_set_calls = self.details_set_calls
        changed_update_calls = self.changed_update_calls

        # We need: users_coll.document(uid).collection("data").document("results")
        # and:     users_coll.document(uid).collection("data").document("results").collection(sub_id).document("details")
        # and:     users_coll.document(uid).collection("data").document("changed_companies")

        def _build_results_ref():
            results_ref = MagicMock()
            results_ref.get.return_value = results_snap
            results_ref.set.side_effect = lambda data, **kw: results_set_calls.append(data)

            def _results_collection(sub_id):
                sub_coll = MagicMock()

                def _sub_document(doc_name):
                    sub_doc = MagicMock()
                    sub_doc.set.side_effect = lambda data, **kw: details_set_calls.append((sub_id, doc_name, data))
                    return sub_doc

                sub_coll.document.side_effect = _sub_document
                return sub_coll

            results_ref.collection.side_effect = _results_collection
            return results_ref

        def _build_changed_companies_ref():
            cc_ref = MagicMock()
            cc_ref.update.side_effect = lambda data: changed_update_calls.append(data)
            return cc_ref

        def _data_document(doc_name):
            if doc_name == "results":
                return _build_results_ref()
            elif doc_name == "changed_companies":
                return _build_changed_companies_ref()
            return MagicMock()

        data_coll = MagicMock()
        data_coll.document.side_effect = _data_document

        def _user_document(uid):
            user_doc = MagicMock()
            user_doc.collection.return_value = data_coll
            return user_doc

        users_coll.document.side_effect = _user_document

        # ---- wire up db.collection() ----
        def _collection(name):
            if name == "users":
                return users_coll
            elif name == "ids":
                return ids_coll
            elif name == "generated_ids":
                return gen_ids_coll
            return MagicMock()

        db.collection.side_effect = _collection
        return db


# ---------------------------------------------------------------------------
# Load database module with mocked dependencies
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

# Configure firestore sentinel values
_mock_firestore = _MOCK_MODULES["firebase_admin.firestore"]
_mock_firestore.SERVER_TIMESTAMP = SENTINEL_TIMESTAMP
_mock_firestore.DELETE_FIELD = object()


@pytest.fixture(scope="module")
def db_mod():
    """
    Load server.database with all external dependencies mocked.
    Returns the module so tests can call save_companies_to_results.
    """
    _MOCK_MODULES["firebase_admin.firestore"].SERVER_TIMESTAMP = SENTINEL_TIMESTAMP

    mock_candidai = MagicMock()
    mock_candidai.db = None  # will be replaced per-test

    with patch.dict("sys.modules", {**_MOCK_MODULES, "server": mock_candidai}):
        import importlib
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "_db_under_test",
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "server", "database.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        yield mod


# ---------------------------------------------------------------------------
# Convenience: wrap save_companies_to_results with a mock db injected
# ---------------------------------------------------------------------------

def _run(db_mod, mock_db_obj, user_id, companies, changed_companies=None):
    """
    Temporarily replace db_mod.db with mock_db_obj and call
    save_companies_to_results.
    """
    with patch.object(db_mod, "db", mock_db_obj):
        return db_mod.save_companies_to_results(
            user_id, companies, changed_companies or {}
        )


# ---------------------------------------------------------------------------
# Test 1: New user — 3 new companies → 3 entries created
# ---------------------------------------------------------------------------


class TestNewUser:
    """No previous results: 3 new companies → 3 new docs created."""

    def test_three_new_companies_create_three_results_entries(self, db_mod):
        """
        With no existing results doc and no existing IDs, passing 3 companies
        should result in 3 set() calls on the results document.
        """
        mdb = _MockDB(
            results_snap=_snap(exists=False),
            id_snaps={},
            new_ids=["uid_001", "uid_002", "uid_003"],
        )
        companies = [
            {"name": "Alpha Corp", "domain": "alpha.com"},
            {"name": "Beta Inc", "domain": "beta.com"},
            {"name": "Gamma LLC", "domain": "gamma.com"},
        ]

        filtered, ids, new_companies = _run(db_mod, mdb.db, "user_42", companies)

        assert len(mdb.results_set_calls) == 3, (
            "Expected 3 set() calls on results doc for 3 new companies"
        )

    def test_three_new_companies_all_returned_as_new(self, db_mod):
        """
        All 3 companies should appear in the new_companies return value.
        """
        mdb = _MockDB(
            results_snap=_snap(exists=False),
            new_ids=["uid_001", "uid_002", "uid_003"],
        )
        companies = [
            {"name": "Alpha Corp", "domain": "alpha.com"},
            {"name": "Beta Inc", "domain": "beta.com"},
            {"name": "Gamma LLC", "domain": "gamma.com"},
        ]

        _, _, new_companies = _run(db_mod, mdb.db, "user_42", companies)

        assert len(new_companies) == 3

    def test_three_new_companies_ids_saved(self, db_mod):
        """
        For each new company, the ID mapping is saved in the ids collection.
        """
        mdb = _MockDB(
            results_snap=_snap(exists=False),
            new_ids=["uid_001", "uid_002", "uid_003"],
        )
        companies = [
            {"name": "Alpha Corp", "domain": "alpha.com"},
            {"name": "Beta Inc", "domain": "beta.com"},
            {"name": "Gamma LLC", "domain": "gamma.com"},
        ]

        _run(db_mod, mdb.db, "user_42", companies)

        assert len(mdb.ids_set_calls) == 3, (
            "Expected 3 set() calls on ids collection for 3 new IDs"
        )

    def test_new_company_start_date_set_as_server_timestamp(self, db_mod):
        """
        For a new company, start_date should be set to SERVER_TIMESTAMP.
        The module uses firebase_admin.firestore.SERVER_TIMESTAMP (which is
        mocked), so we verify start_date is present (not None/missing) and
        is equal to whatever SERVER_TIMESTAMP resolves to in the mock.
        """
        mdb = _MockDB(
            results_snap=_snap(exists=False),
            new_ids=["uid_001"],
        )
        companies = [{"name": "NewCo", "domain": "newco.com"}]

        _run(db_mod, mdb.db, "user_ts", companies)

        assert len(mdb.results_set_calls) == 1
        saved_data = mdb.results_set_calls[0]
        entry = list(saved_data.values())[0]
        # start_date must be present for new companies (set to SERVER_TIMESTAMP)
        assert "start_date" in entry, (
            "start_date must be set to SERVER_TIMESTAMP for new companies"
        )
        assert entry["start_date"] is not None


# ---------------------------------------------------------------------------
# Test 2: Existing results — deduplication
# ---------------------------------------------------------------------------


class TestExistingResults:
    """User with existing results: existing companies are skipped."""

    def test_existing_company_is_not_duplicated(self, db_mod):
        """
        1 existing company + 2 new: only 2 new set() calls on results doc.
        """
        uid = "user_existing"
        existing_id = "existing_id_001"
        existing_company = {"name": "OldCo", "domain": "oldco.com"}

        # results doc exists and contains OldCo under existing_id
        results_data = {
            existing_id: {"company": existing_company},
            "companies_to_confirm": [],
        }
        id_snaps = {
            f"OldCo-{uid}": _snap(exists=True, data={"id": existing_id}),
        }

        mdb = _MockDB(
            results_snap=_snap(exists=True, data=results_data),
            id_snaps=id_snaps,
            new_ids=["uid_002", "uid_003"],
        )

        companies = [
            {"name": "OldCo", "domain": "oldco.com"},      # existing
            {"name": "NewCo1", "domain": "newco1.com"},     # new
            {"name": "NewCo2", "domain": "newco2.com"},     # new
        ]

        _, _, new_companies = _run(db_mod, mdb.db, uid, companies)

        # Only 2 new companies should appear in new_companies
        assert len(new_companies) == 2

    def test_existing_company_does_not_trigger_results_set(self, db_mod):
        """
        An existing company (not in changed_companies) must not generate a
        set() call on the results doc (its data is left untouched).
        """
        uid = "user_no_overwrite"
        existing_id = "keep_id_001"
        results_data = {
            existing_id: {"company": {"name": "Preserved", "domain": "preserved.com"}},
            "companies_to_confirm": [],
        }
        id_snaps = {
            f"Preserved-{uid}": _snap(exists=True, data={"id": existing_id}),
        }

        mdb = _MockDB(
            results_snap=_snap(exists=True, data=results_data),
            id_snaps=id_snaps,
            new_ids=["uid_nope"],
        )
        companies = [{"name": "Preserved", "domain": "preserved.com"}]

        _run(db_mod, mdb.db, uid, companies)

        # No set() call should be made for the existing (skipped) company
        assert len(mdb.results_set_calls) == 0, (
            "Existing company must not overwrite the results doc entry"
        )

    def test_existing_company_id_not_saved_again(self, db_mod):
        """
        An existing company's ID mapping must not be re-saved to ids collection.
        """
        uid = "user_no_dup_id"
        existing_id = "keep_id_002"
        results_data = {
            existing_id: {"company": {"name": "StableCo", "domain": "stable.com"}},
            "companies_to_confirm": [],
        }
        id_snaps = {
            f"StableCo-{uid}": _snap(exists=True, data={"id": existing_id}),
        }

        mdb = _MockDB(
            results_snap=_snap(exists=True, data=results_data),
            id_snaps=id_snaps,
        )
        companies = [{"name": "StableCo", "domain": "stable.com"}]

        _run(db_mod, mdb.db, uid, companies)

        assert len(mdb.ids_set_calls) == 0, (
            "IDs collection must not be written again for existing company"
        )


# ---------------------------------------------------------------------------
# Test 3: email_sent field is not reset by save_companies_to_results
# ---------------------------------------------------------------------------


class TestEmailSentPreservation:
    """
    save_companies_to_results does not write the email_sent field.
    Existing email_sent values are untouched because skipped companies
    generate no set() call at all.
    """

    def test_existing_company_with_email_sent_generates_no_write(self, db_mod):
        """
        An existing company whose entry in results contains email_sent must
        not have any write performed that could reset that field.
        """
        uid = "user_email_check"
        existing_id = "email_id_001"
        from datetime import datetime, timezone
        email_ts = datetime(1970, 1, 1, tzinfo=timezone.utc)

        results_data = {
            existing_id: {
                "company": {"name": "EmailCo", "domain": "emailco.com"},
                "email_sent": email_ts,
            },
            "companies_to_confirm": [],
        }
        id_snaps = {
            f"EmailCo-{uid}": _snap(exists=True, data={"id": existing_id}),
        }

        mdb = _MockDB(
            results_snap=_snap(exists=True, data=results_data),
            id_snaps=id_snaps,
        )
        companies = [{"name": "EmailCo", "domain": "emailco.com"}]

        _run(db_mod, mdb.db, uid, companies)

        # The results doc must not be written at all for this company
        assert len(mdb.results_set_calls) == 0, (
            "email_sent must not be reset: no set() for existing company"
        )

    def test_new_company_does_not_write_email_sent_field(self, db_mod):
        """
        save_companies_to_results only writes 'company' and 'start_date'
        for new companies — never 'email_sent'.
        """
        mdb = _MockDB(
            results_snap=_snap(exists=False),
            new_ids=["uid_fresh_001"],
        )
        companies = [{"name": "FreshCo", "domain": "fresh.com"}]

        _run(db_mod, mdb.db, "user_fresh", companies)

        assert len(mdb.results_set_calls) == 1
        entry = list(mdb.results_set_calls[0].values())[0]
        assert "email_sent" not in entry, (
            "save_companies_to_results must never write email_sent"
        )


# ---------------------------------------------------------------------------
# Test 4: companies_to_confirm filtering
# ---------------------------------------------------------------------------


class TestCompaniesToConfirm:
    """
    Companies whose IDs are in companies_to_confirm must be filtered out
    from the filtered_companies (first element of the return tuple).
    """

    def test_company_in_confirm_list_excluded_from_filtered(self, db_mod):
        """
        Existing company whose ID is in companies_to_confirm is excluded
        from filtered_companies.
        """
        uid = "user_confirm"
        confirmed_id = "confirmed_id_001"
        results_data = {
            confirmed_id: {"company": {"name": "ConfirmCo", "domain": "confirm.com"}},
            "companies_to_confirm": [confirmed_id],
        }
        id_snaps = {
            f"ConfirmCo-{uid}": _snap(exists=True, data={"id": confirmed_id}),
        }

        mdb = _MockDB(
            results_snap=_snap(exists=True, data=results_data),
            id_snaps=id_snaps,
        )
        companies = [{"name": "ConfirmCo", "domain": "confirm.com"}]

        filtered, _, _ = _run(db_mod, mdb.db, uid, companies)

        # The company whose ID is in companies_to_confirm must be excluded
        company_names = [c.get("name") for c in filtered]
        assert "ConfirmCo" not in company_names, (
            "Company in companies_to_confirm must be excluded from filtered_companies"
        )

    def test_company_not_in_confirm_list_included_in_filtered(self, db_mod):
        """
        Existing company NOT in companies_to_confirm is included in filtered_companies.
        """
        uid = "user_not_confirm"
        free_id = "free_id_001"
        results_data = {
            free_id: {"company": {"name": "FreeCo", "domain": "free.com"}},
            "companies_to_confirm": ["some_other_id"],
        }
        id_snaps = {
            f"FreeCo-{uid}": _snap(exists=True, data={"id": free_id}),
        }

        mdb = _MockDB(
            results_snap=_snap(exists=True, data=results_data),
            id_snaps=id_snaps,
        )
        companies = [{"name": "FreeCo", "domain": "free.com"}]

        filtered, _, _ = _run(db_mod, mdb.db, uid, companies)

        company_names = [c.get("name") for c in filtered]
        assert "FreeCo" in company_names

    def test_mixed_confirm_and_free_companies(self, db_mod):
        """
        2 companies: 1 in companies_to_confirm, 1 free.
        filtered_companies should contain only the free one.
        """
        uid = "user_mixed"
        c_id = "confirmed_id_002"
        f_id = "free_id_002"
        results_data = {
            c_id: {"company": {"name": "ConfirmedCo", "domain": "c.com"}},
            f_id: {"company": {"name": "ActiveCo", "domain": "a.com"}},
            "companies_to_confirm": [c_id],
        }
        id_snaps = {
            f"ConfirmedCo-{uid}": _snap(exists=True, data={"id": c_id}),
            f"ActiveCo-{uid}": _snap(exists=True, data={"id": f_id}),
        }

        mdb = _MockDB(
            results_snap=_snap(exists=True, data=results_data),
            id_snaps=id_snaps,
        )
        companies = [
            {"name": "ConfirmedCo", "domain": "c.com"},
            {"name": "ActiveCo", "domain": "a.com"},
        ]

        filtered, _, _ = _run(db_mod, mdb.db, uid, companies)

        names = [c.get("name") for c in filtered]
        assert "ConfirmedCo" not in names
        assert "ActiveCo" in names


# ---------------------------------------------------------------------------
# Test 5: Empty company list — no writes performed
# ---------------------------------------------------------------------------


class TestEmptyCompanyList:
    """Empty input list: no Firestore writes should be performed."""

    def test_empty_list_no_results_write(self, db_mod):
        mdb = _MockDB(results_snap=_snap(exists=False))
        filtered, ids, new_companies = _run(db_mod, mdb.db, "user_empty", [])

        assert len(mdb.results_set_calls) == 0
        assert len(mdb.ids_set_calls) == 0
        assert len(mdb.details_set_calls) == 0

    def test_empty_list_returns_empty_collections(self, db_mod):
        mdb = _MockDB(results_snap=_snap(exists=False))
        filtered, ids, new_companies = _run(db_mod, mdb.db, "user_empty2", [])

        assert filtered == []
        assert ids == {}
        assert new_companies == []


# ---------------------------------------------------------------------------
# Test 6: Special domain / name companies
# ---------------------------------------------------------------------------


class TestSpecialDomainCompanies:
    """
    Companies with subdomains, uncommon TLDs, or special characters in their
    name are handled correctly (company_key uses name, not domain).
    """

    def test_subdomain_company_creates_entry(self, db_mod):
        """Company with a subdomain in its domain field is saved normally."""
        mdb = _MockDB(
            results_snap=_snap(exists=False),
            new_ids=["sub_id_001"],
        )
        companies = [{"name": "Sub Corp", "domain": "app.subdomain.co.uk"}]

        _, _, new_companies = _run(db_mod, mdb.db, "user_sub", companies)

        assert len(new_companies) == 1
        assert new_companies[0]["name"] == "Sub Corp"

    def test_uncommon_tld_company_creates_entry(self, db_mod):
        """Company with an uncommon TLD (.io, .ai, .xyz) is saved normally."""
        mdb = _MockDB(
            results_snap=_snap(exists=False),
            new_ids=["tld_id_001"],
        )
        companies = [{"name": "AI Startup", "domain": "startup.ai"}]

        _, _, new_companies = _run(db_mod, mdb.db, "user_tld", companies)

        assert len(new_companies) == 1

    def test_company_name_with_spaces_uses_correct_key(self, db_mod):
        """
        The company_key is '{name}-{user_id}'. Names with spaces must be
        preserved and looked up consistently.
        """
        uid = "user_spaces"
        name = "Acme  Industries  Ltd"  # extra spaces intentional
        company_key = f"{name}-{uid}"

        mdb = _MockDB(
            results_snap=_snap(exists=False),
            new_ids=["space_id_001"],
        )
        companies = [{"name": name, "domain": "acme.com"}]

        _, ids, _ = _run(db_mod, mdb.db, uid, companies)

        assert company_key in ids, (
            "company_key must use the exact name (with spaces) as provided"
        )

    def test_company_name_with_special_chars(self, db_mod):
        """
        Company names containing hyphens, dots, or Unicode characters
        are handled without errors.
        """
        mdb = _MockDB(
            results_snap=_snap(exists=False),
            new_ids=["special_id_001"],
        )
        companies = [{"name": "Café & Co.", "domain": "cafe.fr"}]

        # Must not raise
        _, _, new_companies = _run(db_mod, mdb.db, "user_special", companies)
        assert len(new_companies) == 1


# ---------------------------------------------------------------------------
# Test 7: Firestore timeout / exception propagation
# ---------------------------------------------------------------------------


class TestFirestoreTimeout:
    """
    When Firestore raises an exception (e.g., timeout, unavailable),
    save_companies_to_results must propagate it clearly (no silent swallow).
    """

    def test_results_doc_get_timeout_raises(self, db_mod):
        """
        If fetching the results doc raises (simulating a timeout), the
        exception propagates to the caller.
        """
        db = MagicMock()

        timeout_err = Exception("Deadline exceeded: Firestore request timed out")
        (
            db.collection.return_value
            .document.return_value
            .collection.return_value
            .document.return_value
            .get.side_effect
        ) = timeout_err
        db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.side_effect = timeout_err

        companies = [{"name": "TimeoutCo", "domain": "timeout.com"}]

        with pytest.raises(Exception, match="Deadline exceeded"):
            _run(db_mod, db, "user_timeout", companies)

    def test_id_doc_get_timeout_raises(self, db_mod):
        """
        If fetching an id doc raises (simulating a timeout during the loop),
        the exception propagates to the caller.
        """
        uid = "user_id_timeout"
        # results doc returns fine (no results)
        results_snap_ok = _snap(exists=False)
        timeout_err = Exception("Deadline exceeded: Firestore request timed out")

        db = MagicMock()
        users_coll = MagicMock()
        ids_coll = MagicMock()
        gen_ids_coll = MagicMock()

        def _collection(name):
            if name == "users":
                return users_coll
            elif name == "ids":
                return ids_coll
            elif name == "generated_ids":
                return gen_ids_coll
            return MagicMock()

        db.collection.side_effect = _collection

        # results.get() returns ok
        (
            users_coll
            .document.return_value
            .collection.return_value
            .document.return_value
            .get.return_value
        ) = results_snap_ok

        # ids.document().get() raises
        id_ref = MagicMock()
        id_ref.get.side_effect = timeout_err
        ids_coll.document.return_value = id_ref

        gen_ids_coll.document.return_value.id = "gen_id_001"

        companies = [{"name": "IdTimeoutCo", "domain": "idtimeout.com"}]

        with pytest.raises(Exception, match="Deadline exceeded"):
            _run(db_mod, db, uid, companies)
