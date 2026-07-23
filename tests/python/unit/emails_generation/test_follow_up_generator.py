from unittest.mock import patch

import pytest

from server.emails_generation.follow_up_generator import generate_follow_up


def sample_context():
    return {
        "candidate": {"profile": {"name": "Alex", "skills": ["Product"]}},
        "company": {"name": "Acme"},
        "recruiter": {"name": "Sam", "job_title": "Talent Partner"},
        "original_email": {"subject": "Product at Acme", "body": "Original outreach"},
    }


def test_generates_one_valid_follow_up_only_when_called():
    response = {
        "subject": "Following up on Product at Acme",
        "body": "Hi Sam, I wanted to follow up on my earlier note about Acme.",
        "strategy": "Continues the existing conversation without repeating it.",
        "key_points": ["Concise", "Specific", "Low-friction"],
    }

    with patch(
        "server.emails_generation.follow_up_generator.ai_chat",
        return_value=response,
    ) as ai_chat:
        result = generate_follow_up(sample_context())

    assert result == response
    ai_chat.assert_called_once()
    assert ai_chat.call_args.kwargs["priority"] == "high"


def test_rejects_incomplete_ai_response():
    with patch(
        "server.emails_generation.follow_up_generator.ai_chat",
        return_value={"subject": "Missing body"},
    ):
        with pytest.raises(RuntimeError, match="incomplete"):
            generate_follow_up(sample_context())


def test_limits_explanation_points_to_three():
    with patch(
        "server.emails_generation.follow_up_generator.ai_chat",
        return_value={
            "subject": "Subject",
            "body": "Body",
            "strategy": "Strategy",
            "key_points": ["One", "Two", "Three", "Four"],
        },
    ):
        result = generate_follow_up(sample_context(), "Make it shorter")

    assert result["key_points"] == ["One", "Two", "Three"]
