"""
Task 11.4: Backend Python - Firestore Emulator Integration - Result Updates

Tests for save_email in server/database.py.
Uses mock Firestore (no live emulator required) to verify that:

- update_email_sent: save_email correctly sets email_sent timestamp in
  results doc for the given unique_id.
- Batch update of 10 companies: calling save_email for 10 unique IDs
  results in 10 results set() calls, one per company.
- Partial update (only some companies): only the specified unique IDs have
  their results updated; other IDs already present are left untouched.
"""

import sys
import os
import pytest
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".py-packages"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# ---------------------------------------------------------------------------
# Mock DB helpers
# ---------------------------------------------------------------------------

class _MockDB:
    """
    Lightweight mock of the Firestore client supporting the access patterns
    used by save_email:

        db.collection("users").document(uid).collection("data").document("results")
            .set({unique_id: {"email_sent": ...}}, merge=True)
        db.collection("users").document(uid).collection("data").document("emails")
            .set({unique_id: email}, merge=True)
        db.collection("users").document(uid).collection("data").document("results")
            .collection(unique_id).document("details")
            .set({"email": email}, merge=True)
        db.collection("users").document(uid).collection("data").document("results")
            .collection(unique_id).document("row")
            .set({"email": email}, merge=True)
    """

    def __init__(self):
        # Record all set() calls for assertions
        self.results_set_calls = []   # (data, kwargs) for results doc
        self.emails_set_calls = []    # (data, kwargs) for emails doc
        self.details_set_calls = []   # (unique_id, data, kwargs) for details
        self.row_set_calls = []       # (unique_id, data, kwargs) for row

        self.db = self._build()

    def _build(self):
        db = MagicMock()

        results_set_calls = self.results_set_calls
        emails_set_calls = self.emails_set_calls
        details_set_calls = self.details_set_calls
        row_set_calls = self.row_set_calls

        def _results_collection_factory(unique_id):
            sub_coll = MagicMock()

            def _sub_document(doc_name):
                doc = MagicMock()
                if doc_name == "details":
                    doc.set.side_effect = lambda data, **kw: details_set_calls.append(
                        (unique_id, doc_name, data)
                    )
                elif doc_name == "row":
                    doc.set.side_effect = lambda data, **kw: row_set_calls.append(
                        (unique_id, doc_name, data)
                    )
                return doc

            sub_coll.document.side_effect = _sub_document
            return sub_coll

        def _build_results_ref():
            results_ref = MagicMock()
            results_ref.set.side_effect = lambda data, **kw: results_set_calls.append(
                (data, kw)
            )
            results_ref.collection.side_effect = _results_collection_factory
            return results_ref

        def _build_emails_ref():
            emails_ref = MagicMock()
            emails_ref.set.side_effect = lambda data, **kw: emails_set_calls.append(
                (data, kw)
            )
            return emails_ref

        def _data_document(doc_name):
            if doc_name == "results":
                return _build_results_ref()
            elif doc_name == "emails":
                return _build_emails_ref()
            return MagicMock()

        data_coll = MagicMock()
        data_coll.document.side_effect = _data_document

        def _user_document(uid):
            user_doc = MagicMock()
            user_doc.collection.return_value = data_coll
            return user_doc

        users_coll = MagicMock()
        users_coll.document.side_effect = _user_document

        def _collection(name):
            if name == "users":
                return users_coll
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


@pytest.fixture(scope="module")
def db_mod():
    """Load server.database with all external dependencies mocked."""
    mock_candidai = MagicMock()
    mock_candidai.db = None  # replaced per-test via patch.object

    with patch.dict("sys.modules", {**_MOCK_MODULES, "server": mock_candidai}):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "_db_result_updates",
            os.path.join(
                os.path.dirname(__file__), "..", "..", "..",
                "server", "database.py"
            ),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        yield mod


def _run_save_email(db_mod, mock_db, user_id, unique_id, email, prompt="Test prompt",
                    email_address="recruiter@example.com", cv_url="https://cv.example.com/cv.pdf"):
    """Call save_email with a temporarily injected mock db."""
    with patch.object(db_mod, "db", mock_db):
        return db_mod.save_email(user_id, unique_id, email, prompt, email_address, cv_url)


# ---------------------------------------------------------------------------
# Test 1: update_email_sent - correctly updates timestamp in Firestore
# ---------------------------------------------------------------------------


class TestUpdateEmailSent:
    """save_email sets email_sent correctly in the results document."""

    def test_email_sent_field_written_to_results(self, db_mod):
        """
        Calling save_email with a non-empty email must write a results set()
        call containing the email_sent key for the given unique_id.
        """
        mdb = _MockDB()
        email = {"subject": "Hello", "body": "Dear recruiter..."}

        _run_save_email(db_mod, mdb.db, "user_001", "uid_abc", email)

        assert len(mdb.results_set_calls) >= 1, (
            "Expected at least one set() on results doc"
        )
        # Find the call that sets email_sent
        email_sent_calls = [
            (d, kw) for d, kw in mdb.results_set_calls
            if "uid_abc" in d and "email_sent" in d.get("uid_abc", {})
        ]
        assert len(email_sent_calls) == 1, (
            "Expected exactly one results set() call containing email_sent for uid_abc"
        )

    def test_email_sent_value_is_epoch_datetime(self, db_mod):
        """
        The email_sent value stored in results must be
        datetime(1970, 1, 1, tzinfo=timezone.utc) as defined in save_email.
        """
        mdb = _MockDB()
        email = {"subject": "Test", "body": "Body"}

        _run_save_email(db_mod, mdb.db, "user_002", "uid_epoch", email)

        email_sent_calls = [
            (d, kw) for d, kw in mdb.results_set_calls
            if "uid_epoch" in d and "email_sent" in d.get("uid_epoch", {})
        ]
        assert len(email_sent_calls) == 1
        stored_ts = email_sent_calls[0][0]["uid_epoch"]["email_sent"]
        expected = datetime(1970, 1, 1, tzinfo=timezone.utc)
        assert stored_ts == expected, (
            f"email_sent should be epoch datetime, got {stored_ts!r}"
        )

    def test_results_set_called_with_merge_true(self, db_mod):
        """
        save_email must call results.set(..., merge=True) so that existing
        fields (e.g. recruiter, blog_articles) are not overwritten.
        """
        mdb = _MockDB()
        email = {"subject": "Merge check", "body": "..."}

        _run_save_email(db_mod, mdb.db, "user_003", "uid_merge", email)

        email_sent_calls = [
            (d, kw) for d, kw in mdb.results_set_calls
            if "uid_merge" in d and "email_sent" in d.get("uid_merge", {})
        ]
        assert len(email_sent_calls) == 1
        _, kwargs = email_sent_calls[0]
        assert kwargs.get("merge") is True, (
            "results.set() for email_sent must use merge=True"
        )

    def test_empty_email_does_not_update_results(self, db_mod):
        """
        When email is falsy (None, empty dict), save_email returns early
        and no set() is called on the results doc.
        """
        mdb = _MockDB()

        _run_save_email(db_mod, mdb.db, "user_004", "uid_empty", None)

        assert len(mdb.results_set_calls) == 0, (
            "No results set() should be called when email is None/empty"
        )

    def test_empty_dict_email_does_not_update_results(self, db_mod):
        """save_email with an empty dict email also returns early."""
        mdb = _MockDB()

        _run_save_email(db_mod, mdb.db, "user_005", "uid_empty_dict", {})

        assert len(mdb.results_set_calls) == 0, (
            "No results set() should be called when email is empty dict"
        )

    def test_email_also_written_to_emails_collection(self, db_mod):
        """
        save_email must also write to the emails collection (merge=True)
        with the unique_id as the key.
        """
        mdb = _MockDB()
        email = {"subject": "Test email", "body": "Hi"}

        _run_save_email(db_mod, mdb.db, "user_006", "uid_emails_coll", email,
                        email_address="rec@company.com", cv_url="https://cv.example.com/cv.pdf")

        emails_calls = [
            (d, kw) for d, kw in mdb.emails_set_calls
            if "uid_emails_coll" in d
        ]
        assert len(emails_calls) == 1, (
            "Expected one set() call on the emails collection"
        )

    def test_details_written_with_email_and_prompt(self, db_mod):
        """
        save_email must write the email (with prompt added) to the details
        subcollection document.
        """
        mdb = _MockDB()
        email = {"subject": "Details check", "body": "Check"}
        prompt = "Custom prompt text"

        _run_save_email(db_mod, mdb.db, "user_007", "uid_details", email, prompt=prompt)

        details_calls = [
            (uid, doc, data)
            for uid, doc, data in mdb.details_set_calls
            if uid == "uid_details" and doc == "details"
        ]
        assert len(details_calls) == 1
        saved_email = details_calls[0][2].get("email", {})
        assert saved_email.get("prompt") == prompt, (
            "The prompt must be added to the email and saved in details"
        )


# ---------------------------------------------------------------------------
# Test 2: Batch update of 10 companies
# ---------------------------------------------------------------------------


class TestBatchUpdate:
    """Calling save_email for 10 unique IDs updates all 10 in results."""

    def test_batch_10_companies_all_get_email_sent(self, db_mod):
        """
        Calling save_email 10 times (one per company) must result in exactly
        10 results set() calls containing email_sent, one for each unique_id.
        """
        user_id = "user_batch"
        unique_ids = [f"uid_batch_{i:02d}" for i in range(10)]
        email_template = {"subject": "Batch email", "body": "Batch body"}

        mdb = _MockDB()
        for uid in unique_ids:
            email = dict(email_template)
            _run_save_email(db_mod, mdb.db, user_id, uid, email)

        # Count results set() calls containing email_sent for each unique_id
        for uid in unique_ids:
            matching = [
                (d, kw) for d, kw in mdb.results_set_calls
                if uid in d and "email_sent" in d.get(uid, {})
            ]
            assert len(matching) == 1, (
                f"Expected exactly one email_sent set() for {uid}, "
                f"got {len(matching)}"
            )

    def test_batch_10_companies_total_calls_count(self, db_mod):
        """
        Batch save_email for 10 companies produces exactly 10 results
        set() calls that contain email_sent.
        """
        user_id = "user_batch_count"
        unique_ids = [f"uid_cnt_{i:02d}" for i in range(10)]

        mdb = _MockDB()
        for uid in unique_ids:
            email = {"subject": f"Email for {uid}", "body": "Body"}
            _run_save_email(db_mod, mdb.db, user_id, uid, email)

        email_sent_calls = [
            (d, kw) for d, kw in mdb.results_set_calls
            if any(
                uid in d and "email_sent" in d.get(uid, {})
                for uid in unique_ids
            )
        ]
        assert len(email_sent_calls) == 10, (
            f"Expected 10 email_sent set() calls, got {len(email_sent_calls)}"
        )

    def test_batch_10_companies_all_use_epoch_timestamp(self, db_mod):
        """
        All 10 email_sent values must equal datetime(1970, 1, 1, tzinfo=timezone.utc).
        """
        user_id = "user_batch_ts"
        unique_ids = [f"uid_ts_{i:02d}" for i in range(10)]
        expected_ts = datetime(1970, 1, 1, tzinfo=timezone.utc)

        mdb = _MockDB()
        for uid in unique_ids:
            email = {"subject": "TS check", "body": "Body"}
            _run_save_email(db_mod, mdb.db, user_id, uid, email)

        for uid in unique_ids:
            matching = [
                d[uid]["email_sent"]
                for d, kw in mdb.results_set_calls
                if uid in d and "email_sent" in d.get(uid, {})
            ]
            assert len(matching) == 1
            assert matching[0] == expected_ts, (
                f"email_sent for {uid} should be epoch datetime, got {matching[0]!r}"
            )

    def test_batch_10_companies_emails_collection_updated(self, db_mod):
        """
        Calling save_email for 10 companies also writes 10 entries to the
        emails collection (one per unique_id).
        """
        user_id = "user_batch_emails"
        unique_ids = [f"uid_em_{i:02d}" for i in range(10)]

        mdb = _MockDB()
        for uid in unique_ids:
            email = {"subject": "Email coll check", "body": "Body"}
            _run_save_email(db_mod, mdb.db, user_id, uid, email)

        for uid in unique_ids:
            emails_calls = [
                (d, kw) for d, kw in mdb.emails_set_calls
                if uid in d
            ]
            assert len(emails_calls) == 1, (
                f"Expected one emails set() for {uid}"
            )


# ---------------------------------------------------------------------------
# Test 3: Partial update - only some companies updated, others untouched
# ---------------------------------------------------------------------------


class TestPartialUpdate:
    """Only the specified unique IDs are updated; others remain untouched."""

    def test_only_specified_ids_have_email_sent_set(self, db_mod):
        """
        When save_email is called for a subset of companies (2 out of 5),
        only those 2 should have email_sent set in results.
        The other 3 IDs should not appear in any results set() call.
        """
        user_id = "user_partial"
        all_ids = [f"uid_part_{i}" for i in range(5)]
        updated_ids = all_ids[:2]   # only first 2
        untouched_ids = all_ids[2:]  # last 3 left alone

        mdb = _MockDB()
        for uid in updated_ids:
            email = {"subject": "Partial update", "body": "Body"}
            _run_save_email(db_mod, mdb.db, user_id, uid, email)

        # Updated IDs should have email_sent
        for uid in updated_ids:
            matching = [
                (d, kw) for d, kw in mdb.results_set_calls
                if uid in d and "email_sent" in d.get(uid, {})
            ]
            assert len(matching) == 1, (
                f"Expected email_sent set() for updated {uid}"
            )

        # Untouched IDs must not appear in any results set() call
        for uid in untouched_ids:
            matching = [
                (d, kw) for d, kw in mdb.results_set_calls
                if uid in d
            ]
            assert len(matching) == 0, (
                f"Untouched company {uid} must not appear in any results set() call"
            )

    def test_partial_update_does_not_affect_emails_collection_for_untouched(self, db_mod):
        """
        Untouched companies (not passed to save_email) must not have any
        entry written to the emails collection either.
        """
        user_id = "user_partial_emails"
        updated_ids = ["uid_upd_01", "uid_upd_02"]
        untouched_ids = ["uid_untouched_01", "uid_untouched_02", "uid_untouched_03"]

        mdb = _MockDB()
        for uid in updated_ids:
            email = {"subject": "Update", "body": "Body"}
            _run_save_email(db_mod, mdb.db, user_id, uid, email)

        for uid in untouched_ids:
            emails_calls = [
                (d, kw) for d, kw in mdb.emails_set_calls
                if uid in d
            ]
            assert len(emails_calls) == 0, (
                f"Untouched company {uid} must not have emails collection entry"
            )

    def test_partial_update_correct_count_of_results_calls(self, db_mod):
        """
        Calling save_email for 3 out of 10 companies results in exactly 3
        email_sent set() calls.
        """
        user_id = "user_partial_count"
        all_ids = [f"uid_pc_{i:02d}" for i in range(10)]
        updated_ids = all_ids[:3]

        mdb = _MockDB()
        for uid in updated_ids:
            email = {"subject": "Count check", "body": "Body"}
            _run_save_email(db_mod, mdb.db, user_id, uid, email)

        email_sent_calls = [
            (d, kw) for d, kw in mdb.results_set_calls
            if any(
                uid in d and "email_sent" in d.get(uid, {})
                for uid in all_ids
            )
        ]
        assert len(email_sent_calls) == 3, (
            f"Expected 3 email_sent set() calls for 3 updated companies, "
            f"got {len(email_sent_calls)}"
        )

    def test_partial_update_untouched_companies_no_details_written(self, db_mod):
        """
        Untouched companies (not passed to save_email) must have no entries
        in the details subcollection.
        """
        user_id = "user_partial_details"
        updated_ids = ["uid_det_upd"]
        untouched_ids = ["uid_det_skip_01", "uid_det_skip_02"]

        mdb = _MockDB()
        email = {"subject": "Details partial", "body": "Body"}
        _run_save_email(db_mod, mdb.db, user_id, updated_ids[0], email)

        for uid in untouched_ids:
            details_calls = [
                (u, d, data)
                for u, d, data in mdb.details_set_calls
                if u == uid
            ]
            assert len(details_calls) == 0, (
                f"Untouched company {uid} must have no details written"
            )
