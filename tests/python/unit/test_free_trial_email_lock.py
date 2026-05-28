"""
Unit tests for free-trial email masking in find_recruiters_for_user.

free_trial accounts must:
  - use the dedicated PEOPLE_DATA_API_KEY_FREE key for person search
  - have the found recruiter's work_email replaced with the sentinel True
Paid plans keep the standard key and the real email.

NOTE: correct module path after the server/emails_generation restructure.
"""

import os
from unittest.mock import patch

from server.emails_generation.recruiter import find_recruiters_for_user


def _run(plan, env, record):
    company = {"name": "Acme", "domain": "acme.com"}
    ids = {"Acme-u1": "uid-acme"}
    with patch.dict(os.environ, env, clear=False), \
         patch("server.emails_generation.recruiter.get_user_data", return_value={"plan": plan}), \
         patch("server.emails_generation.recruiter.get_custom_queries", return_value=(None, "", [])), \
         patch("server.emails_generation.recruiter.find_company_recruiters", return_value=([record], {"id": 1})) as mock_find, \
         patch("server.emails_generation.recruiter.save_recruiter_and_query") as mock_save, \
         patch("server.emails_generation.recruiter.time.sleep"):
        results, _ = find_recruiters_for_user("u1", ids, [company], [])
    return results, mock_find, mock_save


def test_free_trial_masks_work_email_and_uses_free_key():
    record = {"full_name": "Alice", "work_email": "alice@acme.com",
              "job_company_linkedin_url": "linkedin.com/company/acme"}
    results, mock_find, mock_save = _run(
        "free_trial",
        {"PEOPLE_DATA_API_KEY": "STD", "PEOPLE_DATA_API_KEY_FREE": "FREE"},
        record,
    )
    assert results["Acme"][0]["work_email"] is True
    assert mock_find.call_args.kwargs.get("api_key") == "FREE"
    # the record handed to save is the masked one
    assert mock_save.call_args[0][2]["work_email"] is True


def test_paid_plan_keeps_real_email_and_uses_standard_key():
    record = {"full_name": "Alice", "work_email": "alice@acme.com",
              "job_company_linkedin_url": "linkedin.com/company/acme"}
    results, mock_find, _ = _run(
        "pro",
        {"PEOPLE_DATA_API_KEY": "STD", "PEOPLE_DATA_API_KEY_FREE": "FREE"},
        record,
    )
    assert results["Acme"][0]["work_email"] == "alice@acme.com"
    assert mock_find.call_args.kwargs.get("api_key") == "STD"


def test_free_trial_falls_back_to_standard_key_when_free_unset():
    record = {"full_name": "Alice", "work_email": "alice@acme.com",
              "job_company_linkedin_url": "linkedin.com/company/acme"}
    env = {"PEOPLE_DATA_API_KEY": "STD"}
    with patch.dict(os.environ, env, clear=False):
        os.environ.pop("PEOPLE_DATA_API_KEY_FREE", None)
        with patch("server.emails_generation.recruiter.get_user_data", return_value={"plan": "free_trial"}), \
             patch("server.emails_generation.recruiter.get_custom_queries", return_value=(None, "", [])), \
             patch("server.emails_generation.recruiter.find_company_recruiters", return_value=([record], {"id": 1})) as mock_find, \
             patch("server.emails_generation.recruiter.save_recruiter_and_query"), \
             patch("server.emails_generation.recruiter.time.sleep"):
            results, _ = find_recruiters_for_user("u1", {"Acme-u1": "uid-acme"}, [{"name": "Acme", "domain": "acme.com"}], [])
    assert results["Acme"][0]["work_email"] is True
    assert mock_find.call_args.kwargs.get("api_key") == "STD"
