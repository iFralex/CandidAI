import pytest
from server.emails_generation.ai_client import parse_json

def test_parse_json_plain_object():
    assert parse_json('{"a": 1}') == {"a": 1}

def test_parse_json_strips_code_fence():
    assert parse_json('```json\n{"x": [1,2]}\n```') == {"x": [1, 2]}

def test_parse_json_curly_quotes_and_array():
    assert parse_json('prefix [\u201ca\u201d, \u201cb\u201d] suffix') == ["a", "b"]

def test_parse_json_raises_when_absent():
    with pytest.raises(ValueError):
        parse_json("no json here")
