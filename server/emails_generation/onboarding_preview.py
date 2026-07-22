"""Realtime first-candidacy pipeline built from the production primitives."""

from __future__ import annotations

import logging
import os
import time
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
from server.emails_generation.profile_enrich import enrich_profile_summary
from server.emails_generation.recruiter import (
    find_recruiter_by_linkedin_urls,
    find_recruiters_for_user,
    get_companies_info,
)
from server.emails_generation.utils import extract_cv_text
from server.analytics import track

logger = logging.getLogger(__name__)

PREVIEW_DOCUMENT = "onboarding_preview"


# ── THROWAWAY: onboarding mock replay (delete after testing) ──────────────────
# Gated to a single test account. For that user the realtime handlers skip the
# expensive PDL/DeepSeek work and replay a captured fixture (_onboarding_mock/
# fixture), so the whole flow can be re-tested for free. Inert for everyone else.
_MOCK_UID = "TSHVb2cw3caRHlIf7vyEGfNO0eO2"  # ifralex.business@gmail.com
_MOCK_FX = None


def _mock_fixture() -> dict:
    global _MOCK_FX
    if _MOCK_FX is None:
        try:
            _MOCK_FX = db.collection("_onboarding_mock").document("fixture").get().to_dict() or {}
        except Exception:
            _MOCK_FX = {}
    return _MOCK_FX


def _mock(user_id: str) -> bool:
    return user_id == _MOCK_UID and bool(_mock_fixture().get("profileSummary"))


def _mock_ms(key: str, default_ms: int) -> float:
    """Per-stage simulated duration, in seconds, from an env var (milliseconds)."""
    try:
        return max(0, int(os.environ.get(key, default_ms))) / 1000.0
    except Exception:
        return default_ms / 1000.0


def _mock_fail(stage: str) -> bool:
    """Force a stage to fail (to test error/retry UI). Env: MOCK_FAIL=profile,recruiter,email"""
    return stage in {s.strip() for s in os.environ.get("MOCK_FAIL", "").split(",") if s.strip()}
# ─────────────────────────────────────────────────────────────────────────────


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


def _account_ref(user_id: str):
    # Same path `get_account_data` reads from (server/emails_generation/database.py):
    # users/{user_id}/data/account — reusing it here avoids a second Firestore access path.
    return (
        db.collection("users")
        .document(user_id)
        .collection("data")
        .document("account")
    )


def update_preview(user_id: str, **fields: Any) -> None:
    fields["updatedAt"] = firestore.SERVER_TIMESTAMP
    _preview_ref(user_id).set(fields, merge=True)


def write_profile_summary(user_id: str, profile_summary: dict) -> None:
    _account_ref(user_id).set({"profileSummary": profile_summary}, merge=True)


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
        if _mock(user_id):  # THROWAWAY
            if _mock_fail("recruiter"):
                raise RuntimeError("mock: forced recruiter search failure")
            fx = _mock_fixture()
            acc = get_account_data(user_id) or {}
            mock_company = (acc.get("companies") or [{}])[0]
            insights = (acc.get("profileSummary", {}) or {}).get("onboardingInsights", {}) or {}
            time.sleep(_mock_ms("MOCK_RECRUITER_MS", 1500))
            update_preview(
                user_id, company=mock_company, status="running", stage="recruiter_found",
                recruiter=fx.get("recruiter") or {}, recruiterProfile=fx.get("recruiterProfile") or {},
                matchedQuery=fx.get("matchedQuery") or {}, recruiterFoundAt=firestore.SERVER_TIMESTAMP,
                searchContext={"targetRole": insights.get("selectedTargetRole", ""), "queryCount": 0,
                               "narrative": insights.get("searchNarrative", ""), "strengths": (insights.get("strengths", []) or [])[:4]},
            )
            db.collection("users").document(user_id).set({
                "onboardingStage": "recruiter_found", "onboardingStageEnteredAt": firestore.SERVER_TIMESTAMP,
                "lastOnboardingActivityAt": firestore.SERVER_TIMESTAMP}, merge=True)
            track("recruiter_search_completed", {"job_id": job_id, "company": mock_company.get("name", ""), "mock": True}, user_id=user_id)
            create_email(user_id, job_id)
            return
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
        if _mock(user_id):  # THROWAWAY — replay fixture email, do NOT consume the free preview so it can be re-tested
            if _mock_fail("email"):
                raise RuntimeError("mock: forced email generation failure")
            fx = _mock_fixture()
            time.sleep(_mock_ms("MOCK_EMAIL_MS", 1500))
            update_preview(user_id, status="completed", stage="preview_ready",
                           email=fx.get("email") or {}, recruiterInsight=fx.get("recruiterInsight") or {})
            db.collection("users").document(user_id).set({
                "onboardingStage": "preview_ready", "onboardingStageEnteredAt": firestore.SERVER_TIMESTAMP,
                "lastOnboardingActivityAt": firestore.SERVER_TIMESTAMP}, merge=True)
            track("free_preview_completed", {"job_id": job_id, "mock": True}, user_id=user_id)
            return
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


def _fail_profile(user_id: str, exc: Exception) -> None:
    logger.exception("Profile generation failed for %s", user_id)
    update_preview(user_id, profileStatus="failed", profileError={
        "code": "profile_generating_failed", "message": str(exc)[:300], "recoverable": True,
    })
    track("onboarding_job_failed", {"stage": "profile_generating", "error": str(exc)[:300]}, user_id=user_id)


def generate_profile(user_id: str, job_id: str) -> None:
    """Enrich the candidate profile from LinkedIn/PDL + CV and persist it."""
    t0 = time.monotonic()
    try:
        update_preview(user_id, profileStatus="running", profileProgress="Reading your CV")
        track("onboarding_job_started", {"stage": "profile_generating", "job_id": job_id, "queue": "onboarding_realtime"}, user_id=user_id)
        if _mock(user_id):  # THROWAWAY — the profile stage is 3 distinct calls: CV extraction, PDL, AI enrichment
            for label, call, ms_key, default in (
                ("Reading your CV", "cv", "MOCK_CV_MS", 1000),
                ("Cross-referencing LinkedIn", "pdl", "MOCK_PDL_MS", 1000),
                ("Writing your candidate story", "ai", "MOCK_AI_MS", 1500),
            ):
                update_preview(user_id, profileProgress=label)
                time.sleep(_mock_ms(ms_key, default))
                if _mock_fail(call):
                    raise RuntimeError(f"mock: forced {call} call failure")
            write_profile_summary(user_id, _mock_fixture()["profileSummary"])
            update_preview(user_id, profileStatus="completed", profileProgress="Done")
            track("profile_generation_completed", {"job_id": job_id, "mock": True}, user_id=user_id)
            return
        account = get_account_data(user_id) or {}
        linkedin_url = account.get("linkedinUrl")
        cv_url = account.get("cvUrl")
        if not linkedin_url and not cv_url:
            raise ValueError("No LinkedIn URL or CV to generate a profile")

        pdl_profile = None
        t_pdl = time.monotonic()
        if linkedin_url:
            update_preview(user_id, profileProgress="Cross-referencing LinkedIn")
            record = find_recruiter_by_linkedin_urls([linkedin_url]) or {}
            pdl_profile = record or None
        pdl_ms = int((time.monotonic() - t_pdl) * 1000)

        cv_text = extract_cv_text(cv_url) if cv_url else "No CV was provided."

        update_preview(user_id, profileProgress="Writing your candidate story")
        t_ai = time.monotonic()
        profile_summary = enrich_profile_summary(pdl_profile, cv_text)
        ai_ms = int((time.monotonic() - t_ai) * 1000)

        write_profile_summary(user_id, profile_summary)
        update_preview(user_id, profileStatus="completed", profileProgress="Done")
        track("profile_generation_completed", {
            "job_id": job_id, "pdl_ms": pdl_ms, "ai_ms": ai_ms,
            "total_ms": int((time.monotonic() - t0) * 1000),
            "pdl_ok": bool(pdl_profile), "had_cv": bool(cv_url),
            "had_linkedin": bool(linkedin_url), "success": True,
        }, user_id=user_id)
    except Exception as exc:  # noqa: BLE001
        _fail_profile(user_id, exc)
