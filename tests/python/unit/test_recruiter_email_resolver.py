import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from server.emails_generation import recruiter


def test_resolver_reuses_existing_work_email(monkeypatch):
    monkeypatch.setattr(
        recruiter,
        "get_work_email_from_rocketreach",
        lambda *_args: (_ for _ in ()).throw(AssertionError("lookup should not run")),
    )
    assert recruiter.resolve_recruiter_work_email(
        {"full_name": "Alex Doe", "work_email": "alex@example.com"},
        {"name": "Example", "domain": "example.com"},
    ) == "alex@example.com"


def test_resolver_uses_one_direct_lookup_when_missing(monkeypatch):
    calls = []

    def lookup(name, company):
        calls.append((name, company))
        return "alex@example.com"

    monkeypatch.setattr(recruiter, "get_work_email_from_rocketreach", lookup)
    assert recruiter.resolve_recruiter_work_email(
        {"full_name": "Alex Doe"},
        {"name": "Example", "domain": "example.com"},
    ) == "alex@example.com"
    assert calls == [("Alex Doe", "example.com")]


def test_resolver_never_falls_back_to_personal_email(monkeypatch):
    monkeypatch.setattr(recruiter, "get_work_email_from_rocketreach", lambda *_args: None)
    assert recruiter.resolve_recruiter_work_email(
        {
            "full_name": "Alex Doe",
            "emails": [{"type": "personal", "address": "private@example.net"}],
        },
        {"name": "Example", "domain": "example.com"},
    ) is None
