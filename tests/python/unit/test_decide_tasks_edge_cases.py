"""
Task 9.3: Backend Python - Unit Test Logic - decide_tasks_per_company - Edge cases

Tests for decide_tasks_per_company covering:
- Empty company list returns {} (no crash)
- Missing current_status field uses safe defaults
- current_status as null uses safe defaults
- Corrupted data (current_status not a dict) does not throw fatal exception
- 100 companies in batch have acceptable performance (< 1s)
"""

import sys
import os
import time
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".py-packages"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# ---------------------------------------------------------------------------
# Module-level setup: mock all heavy dependencies before importing main
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
    "server.recruiter": MagicMock(),
    "server.blog_posts": MagicMock(),
    "server.email_generator": MagicMock(),
    "server.database": MagicMock(),
}

with patch.dict("sys.modules", MOCK_MODULES):
    from server.main import decide_tasks_per_company


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

USER_ID = "test_user_edge"
COMPANY_NAME = "EdgeCorp"
COMPANY_KEY = f"{COMPANY_NAME}-{USER_ID}"
COMPANY_ID = "unique_id_edge"

COMPANY = {"name": COMPANY_NAME}
IDS = {COMPANY_KEY: COMPANY_ID}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestDecideTasksEdgeCases:
    def test_empty_company_list_returns_empty_dict(self):
        """
        Empty companies list → for-loop never runs → result is {}.
        Verifies no crash or KeyError when companies=[].
        """
        result = decide_tasks_per_company(
            mode="auto",
            manual_tasks=None,
            current_status={},
            companies=[],
            user_id=USER_ID,
            ids={},
            target_companies=None,
        )
        assert result == {}

    def test_missing_company_id_in_current_status_uses_safe_defaults(self):
        """
        Company's ID is absent from current_status dict.
        current_status.get(company_id, {}) must return {} (safe default)
        and auto mode should queue all three tasks.
        """
        current_status = {}  # Company ID not present at all

        result = decide_tasks_per_company(
            mode="auto",
            manual_tasks=None,
            current_status=current_status,
            companies=[COMPANY],
            user_id=USER_ID,
            ids=IDS,
            target_companies=None,
        )

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert "blog" in tasks
        assert "recruiters" in tasks
        assert "email" in tasks
        assert len(tasks) == 3

    def test_current_status_none_uses_safe_defaults(self):
        """
        current_status=None is treated as an empty dict.
        Auto mode must queue all tasks without raising AttributeError.
        """
        result = decide_tasks_per_company(
            mode="auto",
            manual_tasks=None,
            current_status=None,
            companies=[COMPANY],
            user_id=USER_ID,
            ids=IDS,
            target_companies=None,
        )

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert "blog" in tasks
        assert "recruiters" in tasks
        assert "email" in tasks
        assert len(tasks) == 3

    def test_corrupted_company_data_does_not_raise(self):
        """
        current_status value for a company is not a dict (e.g. a string).
        The function must not raise a fatal exception; it should treat
        the corrupted data as an empty dict and queue all tasks.
        """
        current_status = {COMPANY_ID: "corrupted_data"}  # Not a dict

        result = decide_tasks_per_company(
            mode="auto",
            manual_tasks=None,
            current_status=current_status,
            companies=[COMPANY],
            user_id=USER_ID,
            ids=IDS,
            target_companies=None,
        )

        # Must not raise; all tasks should be queued (data treated as empty)
        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert "blog" in tasks
        assert "recruiters" in tasks
        assert "email" in tasks

    def test_corrupted_company_data_numeric_does_not_raise(self):
        """
        current_status value is an integer (not iterable as dict).
        Must not raise TypeError; treated as empty dict.
        """
        current_status = {COMPANY_ID: 42}

        result = decide_tasks_per_company(
            mode="auto",
            manual_tasks=None,
            current_status=current_status,
            companies=[COMPANY],
            user_id=USER_ID,
            ids=IDS,
            target_companies=None,
        )

        assert COMPANY_NAME in result

    def test_100_companies_batch_performance(self):
        """
        100 companies processed in auto mode must complete in < 1 second.
        Validates that the function scales linearly and has no O(n^2) path.
        """
        n = 100
        companies = [{"name": f"Company{i}"} for i in range(n)]
        ids = {f"Company{i}-{USER_ID}": f"id_{i}" for i in range(n)}
        current_status = {f"id_{i}": {} for i in range(n)}

        start = time.time()
        result = decide_tasks_per_company(
            mode="auto",
            manual_tasks=None,
            current_status=current_status,
            companies=companies,
            user_id=USER_ID,
            ids=ids,
            target_companies=None,
        )
        elapsed = time.time() - start

        assert elapsed < 1.0, f"Batch of 100 companies took {elapsed:.3f}s (> 1s limit)"
        assert len(result) == n
        for i in range(n):
            company_name = f"Company{i}"
            assert company_name in result
            assert len(result[company_name]) == 3
