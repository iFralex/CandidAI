"""Realtime first-candidacy pipeline built from the production primitives."""

from __future__ import annotations

import logging
import os
from typing import Any
import requests

from firebase_admin import firestore

from server.emails_generation import db
from server.emails_generation.database import (
    get_account_data,
    get_changed_companies,
    get_results_row,
    get_user_settings,
    save_companies_to_results,
)
from server.emails_generation.email_generator import generate_email
from server.emails_generation.recruiter import (
    find_recruiters_for_user,
    get_companies_info,
)
from server.analytics import track

logger = logging.getLogger(__name__)

PREVIEW_DOCUMENT = "onboarding_preview"


def public_recruiter_profile(recruiter: dict) -> dict:
    """Project PDL data to fields safe to reveal in the free preview."""
    location = recruiter.get("location_name") or recruiter.get("location") or ""
    if isinstance(location, dict):
        location = location.get("name") or location.get("locality") or ""

    # Country only, to mirror the candidate-profile card (name, role, country).
    country = recruiter.get("location_country") or ""
    if not country and isinstance(recruiter.get("location"), dict):
        country = recruiter["location"].get("country") or ""

    experience = []
    for item in (recruiter.get("experience") or [])[:4]:
        title = item.get("title") or {}
        company = item.get("company") or {}
        experience.append({
            "title": title.get("name", "") if isinstance(title, dict) else str(title),
            "company": company.get("name", "") if isinstance(company, dict) else str(company),
            "startDate": item.get("start_date", ""),
            "endDate": item.get("end_date", ""),
        })

    education = []
    for item in (recruiter.get("education") or [])[:3]:
        school = item.get("school") or {}
        education.append({
            "school": school.get("name", "") if isinstance(school, dict) else str(school),
            "degree": item.get("degree") or (item.get("degrees") or [""])[0],
        })

    return {
        "avatarUrl": str(recruiter.get("profile_pic_url") or recruiter.get("profile_picture_url") or ""),
        "location": str(location),
        "country": str(country).title(),
        "summary": str(recruiter.get("summary") or ""),
        "skills": [str(skill) for skill in (recruiter.get("skills") or [])[:8]],
        "experience": experience,
        "education": education,
    }


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
    track("onboarding_job_failed", {"stage": stage, "error": str(exc)[:300]}, user_id=user_id)


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
    """Find the recruiter and immediately turn the match into the first email."""
    try:
        update_preview(
            user_id,
            jobId=job_id,
            status="running",
            stage="recruiter_search",
            startedAt=firestore.SERVER_TIMESTAMP,
            error=firestore.DELETE_FIELD,
        )
        track("onboarding_job_started", {"stage": "recruiter_search", "job_id": job_id, "queue": "onboarding_realtime"}, user_id=user_id)
        account, company, result_id = _load_context(user_id)
        update_preview(
            user_id,
            company=company,
            resultId=result_id,
            searchContext={
                "targetRole": account.get("customizations", {}).get("position_description", "")
                or account.get("profileSummary", {}).get("onboardingInsights", {}).get("selectedTargetRole", ""),
                "queryCount": len(account.get("queries") or []),
                "narrative": account.get("profileSummary", {}).get("onboardingInsights", {}).get("searchNarrative", ""),
                "strengths": account.get("profileSummary", {}).get("onboardingInsights", {}).get("strengths", [])[:4],
            },
        )

        def recruiter_found(_company, recruiter, query):
            update_preview(
                user_id,
                status="running",
                stage="recruiter_found",
                recruiter={
                    "name": recruiter.get("full_name", ""),
                    "jobTitle": recruiter.get("job_title", ""),
                    "linkedinUrl": recruiter.get("linkedin_url", ""),
                },
                recruiterProfile=public_recruiter_profile(recruiter),
                matchedQuery=query or {},
                recruiterFoundAt=firestore.SERVER_TIMESTAMP,
            )
            db.collection("users").document(user_id).set({
                "onboardingStage": "recruiter_found",
                "onboardingStageEnteredAt": firestore.SERVER_TIMESTAMP,
                "lastOnboardingActivityAt": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            track("recruiter_search_completed", {
                "job_id": job_id,
                "company": company.get("name", ""),
                "matched_strategy": (query or {}).get("name", ""),
            }, user_id=user_id)
            track("onboarding_stage_entered", {"from_stage": "recruiter_search", "to_stage": "recruiter_found", "flow": "free_preview", "job_id": job_id}, user_id=user_id)

        def query_progress(query, attempt, total, found):
            update_preview(
                user_id,
                searchProgress={
                    "attempt": attempt,
                    "total": total,
                    "strategy": query.get("name", ""),
                    "found": found,
                },
            )

        results, _ = find_recruiters_for_user(
            user_id,
            {f'{company["name"]}-{user_id}': result_id},
            [company],
            account.get("queries") or [],
            priority="realtime",
            progress_callback=recruiter_found,
            query_progress_callback=query_progress,
        )
        recruiter = (results.get(company["name"]) or ({}, None))[0]
        if not recruiter:
            raise RuntimeError("No suitable recruiter was found")
        # The user cannot alter the match at this point. Starting in the same
        # priority job removes the extra browser round-trip and preserves order.
        create_email(user_id, job_id)
    except Exception as exc:  # noqa: BLE001
        _fail(user_id, "recruiter_search", exc)


def create_email(user_id: str, job_id: str) -> None:
    """Generate the email immediately after matching, without browser research."""
    try:
        preview = _preview_ref(user_id).get().to_dict() or {}
        if preview.get("jobId") != job_id:
            raise ValueError("Preview job does not match")
        if preview.get("stage") not in {"recruiter_found", "email_generation"}:
            raise ValueError("A recruiter must be available before email generation")

        update_preview(user_id, status="running", stage="email_generation")
        db.collection("users").document(user_id).set(
            {
                "onboardingStage": "email_generation",
                "onboardingStep": 5,
                "onboardingStageEnteredAt": firestore.SERVER_TIMESTAMP,
                "lastOnboardingActivityAt": firestore.SERVER_TIMESTAMP,
            }, merge=True
        )
        track("onboarding_job_started", {"stage": "email_generation", "job_id": job_id, "queue": "onboarding_realtime"}, user_id=user_id)
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
                "recruiterInsight": {
                    "reason": email.get("recruiter_match_reason", ""),
                    "points": email.get("recruiter_match_points", []),
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
                "onboardingStageEnteredAt": firestore.SERVER_TIMESTAMP,
                "lastOnboardingActivityAt": firestore.SERVER_TIMESTAMP,
            },
        )
        batch.commit()
        track("email_generation_completed", {"job_id": job_id, "company": company.get("name", ""), "flow": "free_preview"}, user_id=user_id)
        track("free_preview_completed", {"job_id": job_id, "company": company.get("name", "")}, user_id=user_id)
        track("onboarding_stage_entered", {"from_stage": "email_generation", "to_stage": "preview_ready", "flow": "free_preview", "job_id": job_id}, user_id=user_id)
        preferences = (_preview_ref(user_id).get().to_dict() or {}).get("notifications", {})
        if preferences.get("email") and get_user_settings(user_id).get("previewReady", True):
            try:
                requests.post(
                    f'{os.environ.get("NEXT_PUBLIC_DOMAIN", "").rstrip("/")}/api/send-email',
                    json={
                        "userId": user_id,
                        "type": "onboarding-recruiter-ready",
                        "dedupeKey": f"preview-ready:{job_id}",
                        "category": "operational",
                        "data": {"jobId": job_id, "company": company.get("name", ""), "recruiter": recruiter.get("full_name", "")},
                    },
                    headers={"X-Internal-Key": os.environ.get("SESSION_API_KEY", "")},
                    timeout=20,
                ).raise_for_status()
            except Exception:  # notification must never fail the pipeline
                logger.exception("Unable to send completed-preview notification for %s", user_id)
    except Exception as exc:  # noqa: BLE001
        _fail(user_id, "email_generation", exc)
