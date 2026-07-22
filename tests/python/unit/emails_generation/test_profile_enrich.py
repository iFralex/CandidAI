from unittest.mock import patch
from server.emails_generation import profile_enrich


def test_enrich_returns_guarded_lists():
    fake = {"name": "Ada", "title": "Eng", "skills": ["Python"]}  # missing experience/education
    with patch.object(profile_enrich, "ai_chat", return_value=fake) as m:
        out = profile_enrich.enrich_profile_summary({"name": "Ada"}, "cv text")
    assert out["name"] == "Ada"
    assert out["experience"] == [] and out["education"] == []
    # prompt must include both sources
    prompt = m.call_args.args[0]
    assert "cv text" in prompt and "Ada" in prompt


def test_enrich_raises_without_any_source_result():
    with patch.object(profile_enrich, "ai_chat", return_value=None):
        try:
            profile_enrich.enrich_profile_summary(None, "No CV was provided.")
            assert False, "expected RuntimeError"
        except RuntimeError:
            pass
