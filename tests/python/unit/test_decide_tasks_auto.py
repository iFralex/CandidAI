"""
Task 9.1: Backend Python - Unit Test Logic - decide_tasks_per_company - Auto mode

Tests for the decide_tasks_per_company function in auto mode, covering:
- All tasks needed (nothing processed yet)
- Recruiter present, blog and email still needed
- Recruiter and blog present, only email needed
- Fully processed company (all tasks done)
- Company already in processing queue (treated as done)
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
    "candidai_script.recruiter": MagicMock(),
    "candidai_script.blog_posts": MagicMock(),
    "candidai_script.email_generator": MagicMock(),
    "candidai_script.database": MagicMock(),
}

with patch.dict("sys.modules", MOCK_MODULES):
    from candidai_script.main import decide_tasks_per_company


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

USER_ID = "test_user_123"
COMPANY_NAME = "AcmeCorp"
COMPANY_KEY = f"{COMPANY_NAME}-{USER_ID}"
COMPANY_ID = "unique_id_abc"

COMPANY = {"name": COMPANY_NAME}
IDS = {COMPANY_KEY: COMPANY_ID}


def run_auto(data_for_company):
    """Run decide_tasks_per_company in auto mode for a single company."""
    current_status = {COMPANY_ID: data_for_company}
    return decide_tasks_per_company(
        mode="auto",
        manual_tasks=None,
        current_status=current_status,
        companies=[COMPANY],
        user_id=USER_ID,
        ids=IDS,
        target_companies=None,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestDecideTasksAutoMode:
    def test_all_tasks_when_nothing_processed(self):
        """
        Company with blog_articles=0, recruiter=null, email_sent=null
        (i.e. no keys present in data dict yet) → all three tasks needed.
        Corresponds to plan: ["find_recruiter", "get_blog", "generate_email"]
        Code task names: ["blog", "recruiters", "email"]
        """
        result = run_auto({})

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert "blog" in tasks
        assert "recruiters" in tasks
        assert "email" in tasks
        assert len(tasks) == 3

    def test_blog_and_email_tasks_when_recruiter_present(self):
        """
        Company with recruiter present but blog_articles and email_sent missing.
        blog_articles=0 (key absent), email not yet generated → ["blog", "email"]
        Corresponds to plan: ["get_blog", "generate_email"]
        """
        result = run_auto({"recruiter": {"name": "Jane Doe", "job_title": "Recruiter"}})

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert "blog" in tasks
        assert "email" in tasks
        assert "recruiters" not in tasks
        assert len(tasks) == 2

    def test_only_email_when_recruiter_and_blog_present(self):
        """
        Company with recruiter and blog_articles > 0, email not yet generated.
        → only ["email"] task needed.
        Corresponds to plan: ["generate_email"]
        """
        result = run_auto({
            "recruiter": {"name": "Jane Doe", "job_title": "Recruiter"},
            "blog_articles": 3,
        })

        assert COMPANY_NAME in result
        tasks = result[COMPANY_NAME]
        assert "email" in tasks
        assert "blog" not in tasks
        assert "recruiters" not in tasks
        assert len(tasks) == 1

    def test_no_tasks_when_completely_processed(self):
        """
        Completely processed company: all three fields present.
        email_sent is set → tasks → [].
        """
        result = run_auto({
            "recruiter": {"name": "Jane Doe", "job_title": "Recruiter"},
            "blog_articles": 5,
            "email_sent": "1970-01-01T00:00:00Z",
        })

        assert COMPANY_NAME not in result

    def test_no_tasks_when_company_already_processing(self):
        """
        Company with current_status='processing' and all required fields present.
        A company actively being processed has all fields set → no new tasks queued.
        """
        result = run_auto({
            "recruiter": {"name": "Jane Doe", "job_title": "Recruiter"},
            "blog_articles": 5,
            "email_sent": "1970-01-01T00:00:00Z",
            "current_status": "processing",
        })

        assert COMPANY_NAME not in result
