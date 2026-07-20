"""Realtime first-candidacy pipeline built from the production primitives."""

from __future__ import annotations

import logging
from typing import Any

from firebase_admin import firestore

from server.emails_generation import db
from server.emails_generation.database import (
    get_account_data,
    get_changed_companies,
    get_results_row,
    save_companies_to_results,
)
from server.emails_generation.email_generator import generate_email
from server.emails_generation.recruiter import (
    find_recruiters_for_user,
    get_companies_info,
)

logger = logging.getLogger(__name__)

PREVIEW_DOCUMENT = "onboarding_preview"


def _preview_ref(user_id: str):
    return (
        db.collection("users")
        .document(user_id)
        .collection("data")
        .document(PREVIEW_DOCUMENT)
    )


def update_preview(user_id: str, **fields: Any) -> None:
    fields["updatedAt"] = firestore.SERVER_TIMESTAMP
    _preview_ref(user_id).set(fields, merge=True)


def _fail(user_id: str, stage: str, exc: Exception) -> None:
    logger.exception("Realtime onboarding failed for %s at %s", user_id, stage)
    update_preview(
        user_id,
        status="failed",
        stage=stage,
        error={
            "code": f"{stage}_failed",
            "message": str(exc)[:300],
            "recoverable": True,
        },
    )


def _load_context(user_id: str) -> tuple[dict, dict, str]:
    account = get_account_data(user_id) or {}
    companies = account.get("companies") or []
    if len(companies) != 1:
        raise ValueError("The realtime preview requires exactly one target company")
    if not account.get("profileSummary"):
        raise ValueError("A completed profile is required")

    company = companies[0]
    saved, ids, new_companies = save_companies_to_results(
        user_id, companies, get_changed_companies(user_id)
    )
    company = saved[0] if saved else company
    result_id = ids[f'{company["name"]}-{user_id}']
    if new_companies:
        get_companies_info(user_id, ids, new_companies)
    return account, company, result_id


def find_recruiter(user_id: str, job_id: str) -> None:
    """Find and persist the recruiter, then wait for explicit user confirmation."""
    try:
        update_preview(
            user_id,
            jobId=job_id,
            status="running",
            stage="recruiter_search",
            startedAt=firestore.SERVER_TIMESTAMP,
            error=firestore.DELETE_FIELD,
        )
        account, company, result_id = _load_context(user_id)
        update_preview(
            user_id,
            company=company,
            resultId=result_id,
            searchContext={
                "targetRole": account.get("customizations", {}).get("position_description", ""),
                "queryCount": len(account.get("queries") or []),
            },
        )

        def recruiter_found(_company, recruiter, query):
            update_preview(
                user_id,
                status="waiting_confirmation",
                stage="recruiter_found",
                recruiter={
                    "name": recruiter.get("full_name", ""),
                    "jobTitle": recruiter.get("job_title", ""),
                    "linkedinUrl": recruiter.get("linkedin_url", ""),
                },
                matchedQuery=query or {},
                recruiterFoundAt=firestore.SERVER_TIMESTAMP,
            )

        results, _ = find_recruiters_for_user(
            user_id,
            {f'{company["name"]}-{user_id}': result_id},
            [company],
            account.get("queries") or [],
            priority="realtime",
            progress_callback=recruiter_found,
        )
        recruiter = (results.get(company["name"]) or ({}, None))[0]
        if not recruiter:
            raise RuntimeError("No suitable recruiter was found")
    except Exception as exc:  # noqa: BLE001
        _fail(user_id, "recruiter_search", exc)


def create_email(user_id: str, job_id: str) -> None:
    """Generate the email after recruiter confirmation, without browser research."""
    try:
        preview = _preview_ref(user_id).get().to_dict() or {}
        if preview.get("jobId") != job_id:
            raise ValueError("Preview job does not match")
        if preview.get("stage") not in {"recruiter_found", "email_generation"}:
            raise ValueError("A recruiter must be confirmed before email generation")

        update_preview(user_id, status="running", stage="email_generation")
        account, company, result_id = _load_context(user_id)
        row = get_results_row(user_id, result_id)
        recruiter = row.get("recruiter") or {}
        if not recruiter:
            raise RuntimeError("The confirmed recruiter is no longer available")

        email_result = generate_email(
            user_id,
            {f'{company["name"]}-{user_id}': result_id},
            [company],
            account["profileSummary"],
            account.get("cvUrl"),
            {company["name"]: []},  # Browser/blog research is intentionally excluded.
            {company["name"]: [recruiter, row.get("query")]},
            {company["name"]: row.get("company_info") or {}},
            account.get("customizations", {}).get("instructions", ""),
            priority="realtime",
        )
        email = (email_result or {}).get(company["name"])
        if not email:
            raise RuntimeError("Email generation returned no result")

        batch = db.batch()
        batch.set(
            _preview_ref(user_id),
            {
                "status": "completed",
                "stage": "preview_ready",
                "email": {
                    "subject": email.get("subject", ""),
                    "body": email.get("body", ""),
                    "keyPoints": email.get("key_points", []),
                },
                "completedAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        batch.update(
            db.collection("users").document(user_id),
            {
                "onboardingStage": "preview_ready",
                "freePreviewConsumedAt": firestore.SERVER_TIMESTAMP,
            },
        )
        batch.commit()
    except Exception as exc:  # noqa: BLE001
        _fail(user_id, "email_generation", exc)

