import pytest
from unittest.mock import patch, Mock
from server.emails_generation.ai_client import parse_json
from server.emails_generation import ai_client


def test_parse_json_plain_object():
    assert parse_json('{"a": 1}') == {"a": 1}

def test_parse_json_strips_code_fence():
    assert parse_json('```json\n{"x": [1,2]}\n```') == {"x": [1, 2]}

def test_parse_json_curly_quotes_and_array():
    assert parse_json('prefix [\u201ca\u201d, \u201cb\u201d] suffix') == ["a", "b"]

def test_parse_json_raises_when_absent():
    with pytest.raises(ValueError):
        parse_json("no json here")


def _resp(status=200, content='{"ok": true}'):
    m = Mock()
    m.status_code = status
    m.text = content
    m.json.return_value = {"choices": [{"message": {"content": content}}]}
    return m

def test_call_deepseek_returns_content(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    with patch.object(ai_client.requests, "post", return_value=_resp(content="hello")) as p:
        out = ai_client._call_deepseek("hi", want_json=False)
    assert out == "hello"
    args, kwargs = p.call_args
    assert args[0] == ai_client.DEEPSEEK_URL
    assert kwargs["json"]["model"] == "deepseek-v4-flash"
    assert "response_format" not in kwargs["json"]

def test_call_deepseek_sets_json_mode(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    with patch.object(ai_client.requests, "post", return_value=_resp()) as p:
        ai_client._call_deepseek("give json", want_json=True)
    assert p.call_args.kwargs["json"]["response_format"] == {"type": "json_object"}

def test_call_deepseek_raises_without_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        ai_client._call_deepseek("hi", want_json=False)


# --- ai_chat dispatcher (Task 3) ---

def test_ai_chat_deepseek_primary(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    with patch.object(ai_client, "_call_deepseek", return_value="hi") as ds, \
         patch.object(ai_client, "_call_openrouter", return_value="SHOULD-NOT-RUN") as orr:
        assert ai_client.ai_chat("q") == "hi"
    ds.assert_called_once()
    orr.assert_not_called()

def test_ai_chat_falls_back_to_openrouter(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    with patch.object(ai_client, "_call_deepseek", side_effect=RuntimeError("down")), \
         patch.object(ai_client, "_call_openrouter", return_value="from-or") as orr:
        assert ai_client.ai_chat("q") == "from-or"
    orr.assert_called_once()

def test_ai_chat_provider_openrouter_skips_deepseek(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    with patch.object(ai_client, "_call_deepseek", return_value="NOPE") as ds, \
         patch.object(ai_client, "_call_openrouter", return_value="or") as orr:
        assert ai_client.ai_chat("q") == "or"
    ds.assert_not_called()

def test_ai_chat_parses_json_when_format_json(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    with patch.object(ai_client, "_call_deepseek", return_value='{"a": 1}'):
        assert ai_client.ai_chat("q", format="json") == {"a": 1}

def test_ai_chat_parses_json_when_format_true(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    with patch.object(ai_client, "_call_deepseek", return_value='[1, 2]'):
        assert ai_client.ai_chat("q", True) == [1, 2]


# --- blog_posts re-export (Task 4) ---

def test_blog_posts_reexports_ai_chat():
    # conftest.py mocks selenium/undetected_chromedriver/etc., so blog_posts imports.
    from server.emails_generation.blog_posts import ai_chat as bp_ai_chat
    from server.emails_generation.ai_client import ai_chat as client_ai_chat
    assert bp_ai_chat is client_ai_chat

def test_email_generator_uses_same_ai_chat():
    from server.emails_generation import blog_posts, ai_client
    assert blog_posts.ai_chat is ai_client.ai_chat
