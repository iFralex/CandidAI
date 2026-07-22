from unittest.mock import patch, MagicMock
from server.emails_generation import onboarding_preview as op


def _acct(**kw):
    base = {"linkedinUrl": "https://linkedin.com/in/x", "cvUrl": "https://cv"}
    base.update(kw); return base


def test_generate_profile_success_writes_profile_and_completed():
    calls = {}
    with patch.object(op, "get_account_data", return_value=_acct()), \
         patch.object(op, "find_recruiter_by_linkedin_urls", return_value={"full_name": "Ada"}), \
         patch.object(op, "extract_cv_text", return_value="cv text"), \
         patch.object(op, "enrich_profile_summary", return_value={"name": "Ada", "experience": [], "education": []}), \
         patch.object(op, "write_profile_summary") as wps, \
         patch.object(op, "update_preview", side_effect=lambda uid, **f: calls.update(f)), \
         patch.object(op, "track"):
        op.generate_profile("u1", "job1")
    assert calls.get("profileStatus") == "completed"
    wps.assert_called_once()


def test_generate_profile_failure_sets_failed():
    calls = []
    with patch.object(op, "get_account_data", return_value=_acct()), \
         patch.object(op, "find_recruiter_by_linkedin_urls", return_value={}), \
         patch.object(op, "extract_cv_text", return_value="cv"), \
         patch.object(op, "enrich_profile_summary", side_effect=RuntimeError("boom")), \
         patch.object(op, "update_preview", side_effect=lambda uid, **f: calls.append(f)), \
         patch.object(op, "track"):
        op.generate_profile("u1", "job1")
    assert any(c.get("profileStatus") == "failed" for c in calls)
