"""
Task 9.4: Backend Python - Unit Test Logic - Credit Calculation and Limits

Tests for PDL API credit management in recruiter.py:
- Credit deduction per task type (only recruiter/company-enrich tasks use PDL credits)
- Insufficient credits: get_pdl_data returns {} without making HTTP requests
- PDL daily request limit: credits_remaining=0 means the key is unavailable
"""

import sys
import os
import json
import copy
import pytest
from unittest.mock import MagicMock, patch, mock_open, call
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".py-packages"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# ---------------------------------------------------------------------------
# Module-level setup: mock all heavy dependencies before importing recruiter
# ---------------------------------------------------------------------------

MOCK_MODULES = {
    "firebase_admin": MagicMock(),
    "firebase_admin.credentials": MagicMock(),
    "firebase_admin.firestore": MagicMock(),
    "requests": MagicMock(),
    "pytz": MagicMock(),
    "openai": MagicMock(),
    "anthropic": MagicMock(),
    "dateutil": MagicMock(),
    "dateutil.parser": MagicMock(),
    "server.database": MagicMock(),
    "server.blog_posts": MagicMock(),
    "server.email_generator": MagicMock(),
}

# Configure pytz mock to use real UTC so datetime.now(pytz.UTC) works
MOCK_MODULES["pytz"].UTC = timezone.utc
MOCK_MODULES["pytz"].timezone = lambda x: timezone.utc

# Configure dateutil.parser mock to raise TypeError (caught by check_and_reset_credits)
# This means reset logic is skipped; only credits_remaining matters in tests
MOCK_MODULES["dateutil.parser"].parse = MagicMock(
    side_effect=TypeError("mocked dateutil parse")
)

with patch.dict("sys.modules", MOCK_MODULES):
    from server.recruiter import get_pdl_data, get_companies_info

# Reference to the mocked requests module used inside recruiter.py
_mock_requests = MOCK_MODULES["requests"]
_mock_requests.exceptions.ConnectionError = ConnectionError
_mock_requests.exceptions.RequestException = Exception


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

API_KEY = "TESTKEY_ABCDE"
STORE_FILE_PATH = "store_pdl.json"


def make_store(credits_remaining=100, reset_date=None, api_key=API_KEY):
    """Build a minimal store dict with one API key.

    No timezone, days_blocked, or hours constraints so the temporal
    availability checks in is_key_available are skipped.
    """
    return {
        "data": {
            api_key: {}  # No timezone/hours/days_blocked constraints
        },
        "usage": {
            api_key: {
                "credits_remaining": credits_remaining,
                "call_count": 0,
                "last_called": 0.0,
                "reset_date": reset_date,
            }
        },
    }


def make_mock_response(status_code=200, json_body=None, headers=None):
    """Build a mock HTTP response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_body or {}
    resp.headers = headers or {}
    return resp


# ---------------------------------------------------------------------------
# Tests: Credit Deduction Per Task Type
# ---------------------------------------------------------------------------


class TestCreditDeductionPerTaskType:
    """
    Verify that PDL credits are consumed when the PDL API is called and
    that only the recruiter/company-enrich path actually calls the API.
    """

    def setup_method(self):
        """Reset mocks before each test."""
        _mock_requests.get.reset_mock()

    def test_pdl_api_called_when_credits_available(self):
        """
        When credits_remaining > 0, get_pdl_data calls requests.get
        (i.e., a credit is consumed by making the HTTP request).
        """
        store = make_store(credits_remaining=50)
        response_body = {"name": "AcmeCorp", "website": "acme.com"}
        _mock_requests.get.return_value = make_mock_response(
            status_code=200, json_body=response_body
        )

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), patch("os.path.exists", return_value=True):
            result = get_pdl_data({"website": "acme.com", "name": "AcmeCorp"})

        assert result == response_body
        assert _mock_requests.get.call_count == 1, (
            "PDL HTTP request must be made when credits are available"
        )

    def test_credits_updated_from_api_response_headers(self):
        """
        After a successful API call, credits_remaining is updated from
        the x-totallimit-remaining header (PDL credit deduction mechanism).
        The updated value is persisted to the store via save_store.
        """
        store = make_store(credits_remaining=100)
        headers = {"x-totallimit-remaining": "49"}  # PDL reports 49 remaining
        _mock_requests.get.return_value = make_mock_response(
            status_code=200,
            json_body={"name": "Globex"},
            headers=headers,
        )

        saved_stores = []

        def capture_json_dump(data, f, **kwargs):
            saved_stores.append(copy.deepcopy(data))

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), \
             patch("os.path.exists", return_value=True), \
             patch("json.dump", side_effect=capture_json_dump):
            get_pdl_data({"name": "Globex"})

        # The store must have been saved with the updated credit count
        assert saved_stores, "Store must be saved after API call"
        final_store = saved_stores[-1]
        assert final_store["usage"][API_KEY]["credits_remaining"] == 49, (
            "credits_remaining must reflect the value from response header"
        )

    def test_blog_task_uses_local_pdl_not_imported_from_recruiter(self):
        """
        blog_posts.py manages PDL credits via its own local get_pdl_data inner
        function. It does NOT import get_pdl_data from recruiter.py, so its
        PDL credit budget is independent of the recruiter module's budget.
        """
        blog_src_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "server", "blog_posts.py"
        )
        with open(os.path.abspath(blog_src_path)) as f:
            source = f.read()

        # blog_posts must not import get_pdl_data from recruiter
        assert "from server.recruiter import get_pdl_data" not in source, (
            "blog_posts must not import get_pdl_data from recruiter"
        )
        # But it does define its own local get_pdl_data (confirming PDL is used locally)
        assert "def get_pdl_data" in source, (
            "blog_posts should define its own local get_pdl_data for company data"
        )

    def test_email_module_does_not_use_pdl(self):
        """
        email_generator.py does not call get_pdl_data at all.
        Email generation never consumes PDL credits.
        """
        email_src_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "server", "email_generator.py"
        )
        with open(os.path.abspath(email_src_path)) as f:
            source = f.read()

        assert "get_pdl_data" not in source, (
            "email_generator must not use get_pdl_data (no PDL credits consumed)"
        )


# ---------------------------------------------------------------------------
# Tests: Insufficient Credits → Task Not Executed
# ---------------------------------------------------------------------------


class TestInsufficientCredits:
    """
    When PDL credits are exhausted (credits_remaining=0), get_pdl_data
    must return {} immediately without making any HTTP request.
    """

    def setup_method(self):
        _mock_requests.get.reset_mock()

    def test_zero_credits_returns_empty_dict(self):
        """
        credits_remaining=0 with no reset_date → key unavailable.
        get_pdl_data returns {} and makes no HTTP request.
        """
        store = make_store(credits_remaining=0, reset_date=None)

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), patch("os.path.exists", return_value=True):
            result = get_pdl_data({"website": "example.com"})

        assert result == {}, "Must return {} when no credits available"
        assert not _mock_requests.get.called, (
            "No HTTP request must be made when credits are exhausted"
        )

    def test_negative_credits_returns_empty_dict(self):
        """
        Negative credits_remaining also means the key is unavailable.
        Ensures robustness against unexpected negative values.
        """
        store = make_store(credits_remaining=-5, reset_date=None)

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), patch("os.path.exists", return_value=True):
            result = get_pdl_data({"website": "example.com"})

        assert result == {}
        assert not _mock_requests.get.called

    def test_all_keys_exhausted_returns_empty_dict(self):
        """
        Multiple API keys all with credits_remaining=0.
        No valid key can be selected → returns {} without HTTP request.
        """
        store = {
            "data": {
                "KEY_ALPHA": {},
                "KEY_BETA": {},
                "KEY_GAMMA": {},
            },
            "usage": {
                "KEY_ALPHA": {"credits_remaining": 0},
                "KEY_BETA": {"credits_remaining": 0},
                "KEY_GAMMA": {"credits_remaining": 0},
            },
        }

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), patch("os.path.exists", return_value=True):
            result = get_pdl_data({"name": "SomeCo"})

        assert result == {}, "All keys exhausted → must return {}"
        assert not _mock_requests.get.called

    def test_insufficient_credits_no_save_company_info(self):
        """
        When get_pdl_data returns {} (no credits), get_companies_info does NOT
        call save_company_info (task is not executed).
        """
        store = make_store(credits_remaining=0)

        mock_save = MOCK_MODULES["server.database"].save_company_info
        mock_save.reset_mock()

        companies = [{"name": "NoCreditCo", "domain": "nocredit.com"}]
        ids = {"NoCreditCo-user_1": "uid_001"}

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), patch("os.path.exists", return_value=True):
            get_companies_info("user_1", ids, companies)

        assert not mock_save.called, (
            "save_company_info must not be called when get_pdl_data returns {}"
        )


# ---------------------------------------------------------------------------
# Tests: PDL Daily Request Limit
# ---------------------------------------------------------------------------


class TestPDLDailyRequestLimit:
    """
    PDL enforces a daily credit limit. When credits_remaining reaches 0,
    the key must be treated as unavailable for subsequent requests.
    """

    def setup_method(self):
        _mock_requests.get.reset_mock()

    def test_key_unavailable_when_credits_zero(self):
        """
        A key with credits_remaining=0 is excluded from valid_keys.
        No HTTP request is made, confirming the daily limit is respected.
        """
        store = make_store(credits_remaining=0)

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), patch("os.path.exists", return_value=True):
            result = get_pdl_data({"name": "LimitedCo"})

        assert result == {}
        assert not _mock_requests.get.called, (
            "Daily limit: key with 0 credits must not be used"
        )

    def test_429_response_forces_credits_to_zero(self):
        """
        A 429 Too Many Requests response forces credits_remaining to 0
        to prevent further requests until the key resets.
        The store is saved with the updated (zeroed) credit count.
        """
        store = make_store(credits_remaining=10)
        _mock_requests.get.return_value = make_mock_response(status_code=429)

        saved_stores = []

        def capture_json_dump(data, f, **kwargs):
            saved_stores.append(copy.deepcopy(data))

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), \
             patch("os.path.exists", return_value=True), \
             patch("json.dump", side_effect=capture_json_dump):
            result = get_pdl_data({"name": "RateLimitedCo"})

        assert result == {}, "429 response must result in {} return"

        # The store must have been saved with credits zeroed out
        assert saved_stores, "Store must be saved after 429 response"
        final_store = saved_stores[-1]
        assert final_store["usage"][API_KEY]["credits_remaining"] == 0, (
            "credits_remaining must be forced to 0 after 429 response"
        )

    def test_key_available_when_credits_positive(self):
        """
        A key with credits_remaining > 0 IS available and will be used.
        Confirms that the limit check allows requests when credits remain.
        """
        store = make_store(credits_remaining=1)
        _mock_requests.get.return_value = make_mock_response(
            status_code=200, json_body={"name": "Springfield Corp"}
        )

        m = mock_open(read_data=json.dumps(store))
        with patch("builtins.open", m), patch("os.path.exists", return_value=True):
            result = get_pdl_data({"name": "Springfield Corp"})

        assert result == {"name": "Springfield Corp"}
        assert _mock_requests.get.call_count == 1, (
            "Key with credits_remaining=1 must be used"
        )

    def test_store_not_found_uses_default_cap(self):
        """
        When store_pdl.json does not exist, load_store returns a clean
        default store with no keys → no valid keys → returns {}.
        This ensures robust handling when the store file is missing.
        """
        with patch("os.path.exists", return_value=False), \
             patch("builtins.open", mock_open(read_data="{}")):
            result = get_pdl_data({"name": "MissingStoreCo"})

        # No keys in store → no valid keys → empty result
        assert result == {}, (
            "Missing store file must result in {} (no keys available)"
        )
        assert not _mock_requests.get.called
