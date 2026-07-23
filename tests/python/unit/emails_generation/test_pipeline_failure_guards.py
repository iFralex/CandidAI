from unittest.mock import patch

from server.emails_generation import database, main


class _SetOnlyFirestore:
    def __init__(self):
        self.writes = []

    def collection(self, _name):
        return self

    def document(self, _name):
        return self

    def set(self, data, merge=False):
        self.writes.append((data, merge))


def test_recruiter_save_creates_missing_details_document():
    fake_db = _SetOnlyFirestore()
    recruiter = {
        "full_name": "Ada Recruiter",
        "job_title": "Technical Recruiter",
        "experience": [],
        "education": [],
    }

    with patch.object(database, "db", fake_db):
        database.save_recruiter_and_query(
            "user-1",
            "result-1",
            recruiter,
            {"name": "Best match"},
            "https://linkedin.com/company/acme",
        )

    assert any(
        payload.get("recruiter_summary", {}).get("name") == "Ada Recruiter" and merge
        for payload, merge in fake_db.writes
    )


def test_email_is_skipped_and_failure_persisted_without_recruiter():
    account = {
        "companies": [{"name": "Acme", "domain": "acme.com"}],
        "profileSummary": {"name": "Candidate"},
        "cvUrl": "https://example.com/cv.pdf",
        "queries": [],
        "customizations": {"position_description": "AI engineering"},
    }
    completed_prerequisites = {
        "result-1": {"blog_articles": {}, "recruiter": {}},
    }

    with patch.object(main, "valid_account", return_value=True), \
         patch.object(main, "get_account_data", return_value=account), \
         patch.object(main, "get_changed_companies", return_value={}), \
         patch.object(main, "save_companies_to_results", return_value=(account["companies"], {"Acme-user-1": "result-1"}, [])), \
         patch.object(main, "get_user_data", return_value={"plan": "base"}), \
         patch.object(main, "get_results_status", return_value=completed_prerequisites), \
         patch.object(main, "get_results_row", return_value={}), \
         patch.object(main, "save_generation_failure") as save_failure, \
         patch.object(main, "generate_email") as generate_email, \
         patch.object(main, "track"):
        main.main("user-1")

    generate_email.assert_not_called()
    save_failure.assert_called_once_with(
        "user-1",
        "result-1",
        "email",
        "Email generation skipped: no valid recruiter is available",
    )
