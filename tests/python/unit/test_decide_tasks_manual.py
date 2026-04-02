"""
Task 9.2: Backend Python - Unit Test Logic - decide_tasks_per_company - Manual mode (override)

Tests for the decide_tasks_per_company function in manual mode, covering:
- force_tasks=["generate_email"]: only email task, ignores current state
- force_tasks=["find_recruiter"]: only recruiters task
- force_tasks=[]: no tasks (explicit override to zero)
"""

import sys
import os
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

USER_ID = "test_user_456"
COMPANY_NAME = "TechCorp"
COMPANY_KEY = f"{COMPANY_NAME}-{USER_ID}"
COMPANY_ID = "unique_id_xyz"

COMPANY = {"name": COMPANY_NAME}
IDS = {COMPANY_KEY: COMPANY_ID}

# A fully-processed company status (all fields set) to confirm manual mode ignores state
FULLY_PROCESSED_STATUS = {
    COMPANY_ID: {
        "recruiter": {"name": "Alice Smith", "job_title": "Talent Acquisition"},
        "blog_articles": 5,
        "email_sent": "2024-01-01T00:00:00Z",
    }
}

# A completely unprocessed company status (nothing done yet)
EMPTY_STATUS = {COMPANY_ID: {}}


def run_manual(manual_tasks, current_status=None):
    """Run decide_tasks_per_company in manual mode for a single company."""
    if current_status is None:
        current_status = FULLY_PROCESSED_STATUS
    return decide_tasks_per_company(
        mode="manual",
        manual_tasks=manual_tasks,
        current_status=current_status,
        companies=[COMPANY],
        user_id=USER_ID,
        ids=IDS,
        target_companies=None,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestDecideTasksManualMode:
    def test_force_only_email_task_ignores_current_state(self):
        """
        force_tasks=["generate_email"] → only email task queued.
        The company is fully processed (recruiter + blog + email all done),
        but manual mode should ignore the current state and force the email task.
        Corresponds to plan: force_tasks=["generate_email"]
        Code task name: "email"
        """
        result = run_manual(manual_tasks=["email"], current_status=FULLY_PROCESSED_STATUS)

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert tasks == ["email"]
        assert "blog" not in tasks
        assert "recruiters" not in tasks

    def test_force_only_email_ignores_empty_state_too(self):
        """
        force_tasks=["generate_email"] also works when company has no data at all.
        Manual mode should not auto-detect missing tasks; only the forced task is returned.
        """
        result = run_manual(manual_tasks=["email"], current_status=EMPTY_STATUS)

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert tasks == ["email"]
        assert len(tasks) == 1

    def test_force_only_recruiters_task(self):
        """
        force_tasks=["find_recruiter"] → only recruiters task queued.
        Ignores the fact that the company already has all fields set.
        Corresponds to plan: force_tasks=["find_recruiter"]
        Code task name: "recruiters"
        """
        result = run_manual(manual_tasks=["recruiters"], current_status=FULLY_PROCESSED_STATUS)

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert tasks == ["recruiters"]
        assert "blog" not in tasks
        assert "email" not in tasks

    def test_force_recruiters_ignores_empty_state_too(self):
        """
        force_tasks=["find_recruiter"] also works on a blank-slate company.
        No auto-detection side effects.
        """
        result = run_manual(manual_tasks=["recruiters"], current_status=EMPTY_STATUS)

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert tasks == ["recruiters"]
        assert len(tasks) == 1

    def test_force_empty_list_produces_no_tasks(self):
        """
        force_tasks=[] → explicit override to zero tasks.
        Company should NOT appear in the result dict because there are no tasks to run.
        This verifies that an empty force_tasks means 'do nothing' not 'do everything'.
        """
        result = run_manual(manual_tasks=[], current_status=EMPTY_STATUS)

        assert COMPANY_NAME not in result
        assert result == {}

    def test_force_empty_list_on_processed_company_still_no_tasks(self):
        """
        force_tasks=[] on a fully-processed company.
        Same result: company is absent from the output.
        """
        result = run_manual(manual_tasks=[], current_status=FULLY_PROCESSED_STATUS)

        assert COMPANY_NAME not in result
        assert result == {}
