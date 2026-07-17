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
