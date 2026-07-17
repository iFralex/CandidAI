# DeepSeek V4 Flash Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all AI inference through DeepSeek V4 Flash (direct API) with the existing OpenRouter free-model chain kept as an automatic fallback, plus switch the one Gemini call, in a single phase.

**Architecture:** Extract the `ai_chat` chokepoint out of the 5,751-line `blog_posts.py` into a new lightweight `ai_client.py`. `ai_chat` becomes a dispatcher: try DeepSeek first, fall back to the (verbatim-moved) OpenRouter implementation, then apply the existing JSON parsing. An `AI_PROVIDER` env toggle forces OpenRouter for instant rollback. The Gemini `enrichProfileAI` call in `pdl.ts` switches to the OpenAI-compatible DeepSeek endpoint.

**Tech Stack:** Python 3 (`requests`, no new deps), Next.js/TypeScript (`fetch`, drop `@google/generative-ai`), DeepSeek API (`https://api.deepseek.com`, OpenAI-compatible).

## Global Constraints

- Model id is **`deepseek-v4-flash`** exactly — never `deepseek-chat`/`deepseek-reasoner` (deprecated 2026-07-24).
- DeepSeek base URL: `https://api.deepseek.com/chat/completions`.
- Secret name: **`DEEPSEEK_API_KEY`** (VPS `.env.local` + Vercel).
- Provider toggle: **`AI_PROVIDER`** ∈ {`deepseek` (default), `openrouter`}.
- `ai_chat` public signature and return contract are unchanged; the ~20 existing call sites must not be edited.
- No new Python dependency (use `requests`, already present).
- Python unit tests run with: `PYTHONPATH=/Users/alessioantonucci/progetti/CandidAI /Library/Frameworks/Python.framework/Versions/3.12/bin/pytest <path> -v`. `tests/python/conftest.py` already mocks `firebase_admin`, `requests`, `selenium`, etc.

---

## File Structure

- **Create** `server/emails_generation/ai_client.py` — `parse_json`, `_call_deepseek`, `_call_openrouter`, `ai_chat`. Imports only `os, json, re, time, logging, requests`.
- **Modify** `server/emails_generation/blog_posts.py` — delete the `ai_chat` definition (lines ~261–743, incl. nested `parse_json`); add `from server.emails_generation.ai_client import ai_chat` near the top imports.
- **Create** `tests/python/unit/test_ai_client.py` — unit tests for `parse_json`, `_call_deepseek`, `ai_chat` dispatcher.
- **Create** `scripts/deepseek_replay.py` — golden-set replay + cost report over `logs/ai/ai_log.json` (run on the VPS).
- **Modify** `site/src/actions/pdl.ts` — `enrichProfileAI` uses DeepSeek instead of Gemini.
- **Env (manual, not committed):** `DEEPSEEK_API_KEY` on VPS `.env.local` and Vercel; `AI_PROVIDER` default `deepseek`.

---

### Task 1: `parse_json` extracted to `ai_client.py`

**Files:**
- Create: `server/emails_generation/ai_client.py`
- Test: `tests/python/unit/test_ai_client.py`

**Interfaces:**
- Produces: `parse_json(response: str) -> Any` — extracts the first JSON object/array from a string, tolerating code fences, curly quotes, zero-width chars. Raises `ValueError` if none found.

- [ ] **Step 1: Write the failing test**

```python
# tests/python/unit/test_ai_client.py
import pytest
from server.emails_generation.ai_client import parse_json

def test_parse_json_plain_object():
    assert parse_json('{"a": 1}') == {"a": 1}

def test_parse_json_strips_code_fence():
    assert parse_json('```json\n{"x": [1,2]}\n```') == {"x": [1, 2]}

def test_parse_json_curly_quotes_and_array():
    assert parse_json('prefix [“a”, “b”] suffix') == ["a", "b"]

def test_parse_json_raises_when_absent():
    with pytest.raises(ValueError):
        parse_json("no json here")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=/Users/alessioantonucci/progetti/CandidAI /Library/Frameworks/Python.framework/Versions/3.12/bin/pytest tests/python/unit/test_ai_client.py -v`
Expected: FAIL — `ModuleNotFoundError: server.emails_generation.ai_client`

- [ ] **Step 3: Write minimal implementation**

```python
# server/emails_generation/ai_client.py
import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional, Union

import requests

logger = logging.getLogger(__name__)

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-v4-flash"


def parse_json(response: str) -> Any:
    """Extract and parse the first JSON object/array in `response`."""
    if not isinstance(response, str):
        raise TypeError("response deve essere una stringa")
    response = (response
                .replace("“", '"').replace("”", '"')
                .replace("‘", "'").replace("’", "'"))
    response = re.sub(r"```[^\n]*\n?", "", response)
    response = response.replace("```", "").replace("`", "")
    response = re.sub(r"[​-‍﻿]", "", response)
    match = re.search(r"(\{.*?\}|\[.*?\])", response, re.DOTALL)
    if not match:
        raise ValueError("Nessun oggetto JSON trovato nella stringa")
    fragment = match.group(0).strip()
    try:
        return json.loads(fragment)
    except json.JSONDecodeError as e:
        raise ValueError(f"Parsing JSON fallito per il frammento: {fragment!r}. Errore: {e}") from e
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=/Users/alessioantonucci/progetti/CandidAI /Library/Frameworks/Python.framework/Versions/3.12/bin/pytest tests/python/unit/test_ai_client.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add server/emails_generation/ai_client.py tests/python/unit/test_ai_client.py
git commit -m "feat(ai): extract parse_json into ai_client module"
```

---

### Task 2: `_call_deepseek`

**Files:**
- Modify: `server/emails_generation/ai_client.py`
- Test: `tests/python/unit/test_ai_client.py`

**Interfaces:**
- Consumes: module constants `DEEPSEEK_URL`, `DEEPSEEK_MODEL`.
- Produces: `_call_deepseek(prompt: str, want_json: bool, timeout: int = 60) -> str` — POSTs to DeepSeek, returns the message content string. Raises on missing key / non-200 after retries / empty content.

- [ ] **Step 1: Write the failing test**

```python
# append to tests/python/unit/test_ai_client.py
from unittest.mock import patch, Mock
from server.emails_generation import ai_client

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=/Users/alessioantonucci/progetti/CandidAI /Library/Frameworks/Python.framework/Versions/3.12/bin/pytest tests/python/unit/test_ai_client.py -v`
Expected: FAIL — `AttributeError: module ... has no attribute '_call_deepseek'`

- [ ] **Step 3: Write minimal implementation**

```python
# add to server/emails_generation/ai_client.py
def _call_deepseek(prompt: str, want_json: bool, timeout: int = 60) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY not set")
    body: Dict[str, Any] = {
        "model": DEEPSEEK_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }
    if want_json:
        body["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    last_err: Optional[Exception] = None
    for attempt in range(3):
        try:
            resp = requests.post(DEEPSEEK_URL, headers=headers, json=body, timeout=timeout)
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                if not content:
                    raise RuntimeError("deepseek returned empty content")
                return content
            if resp.status_code in (429, 500, 502, 503):
                last_err = RuntimeError(f"deepseek transient {resp.status_code}")
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"deepseek {resp.status_code}: {resp.text[:200]}")
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 ** attempt)
    raise last_err or RuntimeError("deepseek failed")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=/Users/alessioantonucci/progetti/CandidAI /Library/Frameworks/Python.framework/Versions/3.12/bin/pytest tests/python/unit/test_ai_client.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/emails_generation/ai_client.py tests/python/unit/test_ai_client.py
git commit -m "feat(ai): add DeepSeek client call"
```

---

### Task 3: Move OpenRouter body + add `ai_chat` dispatcher

**Files:**
- Modify: `server/emails_generation/ai_client.py`
- Modify: `server/emails_generation/blog_posts.py:261-743` (source of the moved code)
- Test: `tests/python/unit/test_ai_client.py`

**Interfaces:**
- Consumes: `_call_deepseek`, `parse_json`.
- Produces:
  - `_call_openrouter(prompt: str, want_json: bool, model: Optional[str] = None, site_url=None, site_name=None) -> Optional[str]` — the current OpenRouter rotation logic, returning **raw text** (no JSON parsing).
  - `ai_chat(prompt, format="str", model=DEEPSEEK_MODEL, site_url=None, site_name=None) -> Union[str, dict, None]` — dispatcher.

**Move instructions (do exactly this):**
Take the current body of `ai_chat` in `blog_posts.py` — everything **after** the nested `parse_json` definition (the `API_KEYS = ...` line through the final `return`) — and paste it into `_call_openrouter` in `ai_client.py`. Change only:
1. The `API_KEYS` still reads `os.getenv("OPENROUTER_API_KEYS", "")` — unchanged.
2. Where the old code chose the starting model via `FALLBACK_MODELS.index(model)`, guard it: `current_model_idx = FALLBACK_MODELS.index(model) if model in FALLBACK_MODELS else 0`.
3. The function must **return the raw response text** (the `content` string), NOT `parse_json(content)`. Delete any `parse_json(...)` call inside the moved body; JSON parsing now happens in `ai_chat`.
4. On total failure the moved body returns `None` (keep existing behaviour).

- [ ] **Step 1: Write the failing test (dispatcher behaviour)**

```python
# append to tests/python/unit/test_ai_client.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=/Users/alessioantonucci/progetti/CandidAI /Library/Frameworks/Python.framework/Versions/3.12/bin/pytest tests/python/unit/test_ai_client.py -k ai_chat -v`
Expected: FAIL — `_call_openrouter` / `ai_chat` not defined.

- [ ] **Step 3a: Move the OpenRouter body** into `_call_openrouter` per the "Move instructions" above.

- [ ] **Step 3b: Add the dispatcher**

```python
# add to server/emails_generation/ai_client.py
def ai_chat(prompt: str, format: str = "str", model: str = DEEPSEEK_MODEL,
            site_url: Optional[str] = None, site_name: Optional[str] = None
            ) -> Optional[Union[str, Dict]]:
    want_json = (format is True) or (format == "json")
    provider = os.getenv("AI_PROVIDER", "deepseek").lower()

    text: Optional[str] = None
    if provider != "openrouter":
        try:
            text = _call_deepseek(prompt, want_json)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"DeepSeek failed, falling back to OpenRouter: {e}")
            text = None
    if text is None:
        text = _call_openrouter(prompt, want_json, model=None,
                                site_url=site_url, site_name=site_name)

    if text is None:
        return None
    return parse_json(text) if want_json else text
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=/Users/alessioantonucci/progetti/CandidAI /Library/Frameworks/Python.framework/Versions/3.12/bin/pytest tests/python/unit/test_ai_client.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add server/emails_generation/ai_client.py tests/python/unit/test_ai_client.py
git commit -m "feat(ai): ai_chat dispatcher (DeepSeek primary + OpenRouter fallback)"
```

---

### Task 4: Rewire `blog_posts.py` to import `ai_chat`

**Files:**
- Modify: `server/emails_generation/blog_posts.py`

**Interfaces:**
- Consumes: `ai_client.ai_chat`.
- Produces: `blog_posts.ai_chat` re-exported (so `from server.emails_generation.blog_posts import ai_chat` in `email_generator.py` and `ai_advisor.py` keeps working, and the ~20 internal `ai_chat(...)` calls resolve).

- [ ] **Step 1: Delete the old definition**

Remove the entire `def ai_chat(...): ...` block from `blog_posts.py` (the one spanning the OpenRouter logic, ~lines 261–743). Do NOT touch any `ai_chat(...)` **call**.

- [ ] **Step 2: Add the import** near the other top-of-file imports (after line ~23, alongside `from server.emails_generation.utils import ...`):

```python
from server.emails_generation.ai_client import ai_chat
```

- [ ] **Step 3: Add a re-export test** (append to `tests/python/unit/test_ai_client.py`)

```python
def test_blog_posts_reexports_ai_chat():
    # conftest.py mocks selenium/undetected_chromedriver/etc., so blog_posts imports.
    from server.emails_generation.blog_posts import ai_chat as bp_ai_chat
    from server.emails_generation.ai_client import ai_chat as client_ai_chat
    assert bp_ai_chat is client_ai_chat

def test_email_generator_uses_same_ai_chat():
    from server.emails_generation import blog_posts, ai_client
    assert blog_posts.ai_chat is ai_client.ai_chat
```

- [ ] **Step 4: Run the re-export test + compile-check**

Run:
```bash
PYTHONPATH=/Users/alessioantonucci/progetti/CandidAI /Library/Frameworks/Python.framework/Versions/3.12/bin/pytest tests/python/unit/test_ai_client.py -k "reexport or same_ai_chat" -v
python3 -m py_compile server/emails_generation/blog_posts.py server/emails_generation/ai_client.py
```
Expected: tests PASS; `py_compile` prints nothing (success).

- [ ] **Step 5: Commit**

```bash
git add server/emails_generation/blog_posts.py
git commit -m "refactor(ai): route blog_posts through ai_client.ai_chat"
```

---

### Task 5: Golden-set replay + cost script

**Files:**
- Create: `scripts/deepseek_replay.py`

**Interfaces:**
- Consumes: `ai_client._call_deepseek`, `parse_json`; reads `logs/ai/ai_log.json`.
- Produces: a CLI that replays recorded prompts through DeepSeek and prints a per-entry comparison + a cost total. **Read-only** w.r.t. production data.

- [ ] **Step 1: Write the script**

```python
# scripts/deepseek_replay.py
"""Replay recorded ai_log.json prompts through DeepSeek and compare + cost.

Usage (on the VPS, DEEPSEEK_API_KEY set):
  ./venv/bin/python scripts/deepseek_replay.py logs/ai/ai_log.json --limit 20
Only prints token counts / match stats — never dumps prompt bodies (PII).
"""
import argparse, json, sys
sys.path.insert(0, ".")
from server.emails_generation.ai_client import _call_deepseek, parse_json

IN_MISS, OUT = 0.14, 0.28  # USD / 1M tokens

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("log")
    ap.add_argument("--limit", type=int, default=20)
    args = ap.parse_args()

    data = json.load(open(args.log))[: args.limit]
    exact, json_ok, other, errors = 0, 0, 0, 0
    for e in data:
        prompt = e["input"][0] if isinstance(e.get("input"), list) else e.get("input", "")
        old = (e.get("output") or "")
        try:
            new = _call_deepseek(str(prompt), want_json=False)
        except Exception as ex:  # noqa: BLE001
            errors += 1
            print(f"  [ERR] {type(ex).__name__}: {str(ex)[:80]}")
            continue
        old_s, new_s = str(old).strip(), new.strip()
        if old_s.isdigit() or new_s.isdigit():
            exact += int(old_s == new_s)
            print(f"  [num] old={old_s[:10]!r} new={new_s[:10]!r} match={old_s==new_s}")
        else:
            try:
                parse_json(new); json_ok += 1; tag = "json-ok"
            except Exception:
                other += 1; tag = "text"
            print(f"  [{tag}] old_len={len(old_s)} new_len={len(new_s)}")
    print(f"\nreplayed={len(data)} exact-num={exact} json-ok={json_ok} text={other} errors={errors}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add scripts/deepseek_replay.py
git commit -m "test(ai): DeepSeek golden-set replay script"
```

- [ ] **Step 3: Run on the VPS (manual gate — not a unit test)**

After `DEEPSEEK_API_KEY` is set on the VPS (Task 7), run:
```bash
ssh root@91.99.227.223 "cd /root/CandidAI && DEEPSEEK_API_KEY=\$DEEPSEEK_API_KEY ./venv/bin/python scripts/deepseek_replay.py logs/ai/ai_log.json --limit 20"
```
Expected: mostly `match=True` on `[num]` rows and `json-ok` on JSON rows; near-zero errors. This is the go/no-go signal before flipping the default.

---

### Task 6: Switch `enrichProfileAI` (Gemini → DeepSeek)

**Files:**
- Modify: `site/src/actions/pdl.ts:53-165`

**Interfaces:**
- Consumes: env `DEEPSEEK_API_KEY`.
- Produces: `enrichProfileAI` unchanged signature/return (`ProfileSummary`), now backed by DeepSeek.

- [ ] **Step 1: Replace the Gemini client + generation block**

Replace:
```ts
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
```
(leave the prompt construction in between untouched), and replace:
```ts
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
```
with:
```ts
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      stream: false,
    }),
  });
  if (!res.ok) {
    console.error("DeepSeek enrichProfileAI failed:", res.status, (await res.text()).slice(0, 200));
    return profileSummary ?? {
      name: "", title: "", skills: [], experience: [], education: [], projects: [], certifications: []
    };
  }
  const dsData = await res.json();
  const raw = String(dsData?.choices?.[0]?.message?.content ?? "").trim();
```
Keep the existing `const json = raw.replace(...)`, `JSON.parse(json)`, and the website re-attach logic exactly as-is.

- [ ] **Step 2: Typecheck the changed file**

The site's TS toolchain may not be installed locally. If it is, run
`cd site && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "actions/pdl"` and expect
**no lines** for `pdl.ts` (pre-existing errors elsewhere are known — see the
project test-harness memory). If the toolchain is absent, the gate is the Vercel
**Preview build** on push: it must compile. Additionally, read the diff and confirm
`const raw = ...` is still a `string` and is passed unchanged into the existing
`raw.replace(...)` → `JSON.parse(json)` block.

- [ ] **Step 3: Commit**

```bash
git add site/src/actions/pdl.ts
git commit -m "feat(ai): switch enrichProfileAI from Gemini to DeepSeek"
```

---

### Task 7: Config, rollout, rollback (manual/ops)

**Files:** none in git (env is not committed). This task is the deploy runbook.

- [ ] **Step 1: Set the secret**
  - VPS: add `DEEPSEEK_API_KEY=...` to `/root/CandidAI/.env.local` (server loads it via `load_dotenv`).
  - Vercel: add `DEEPSEEK_API_KEY` (Production + Preview) for `pdl.ts`.

- [ ] **Step 2: Deploy code with default still on OpenRouter**
  - Temporarily set `AI_PROVIDER=openrouter` on the VPS `.env.local` so the merge/deploy changes nothing behaviourally.
  - Merge the branch, `git pull` on the VPS, `systemctl restart candidai`; Vercel auto-deploys the site.

- [ ] **Step 3: Run the gate (Task 5, Step 3)** — replay + a 1–2 company end-to-end smoke with `AI_PROVIDER=deepseek` in a one-off shell.

- [ ] **Step 4: Flip the default**
  - Set `AI_PROVIDER=deepseek` (or remove the var — `deepseek` is the code default) in the VPS `.env.local`; `systemctl restart candidai`.

- [ ] **Step 5: Rollback (if needed)**
  - `AI_PROVIDER=openrouter` in `.env.local`; `systemctl restart candidai`. Site: no toggle — DeepSeek failure in `pdl.ts` already degrades to the un-merged profile.

---

## Notes for the implementer

- Do not reproduce or rewrite the OpenRouter rotation logic — it is a verbatim move (Task 3). Its only functional change is returning raw text instead of parsed JSON.
- `logs/ai/ai_log.json` on the VPS is the real golden set; the local copy is stale. Never print prompt bodies (they contain CV/PII) — only counts/lengths/match flags.
- After the migration, `GEMINI_API_KEY` and the `@google/generative-ai` dependency become unused; leaving them is harmless, removing them is a separate cleanup (out of scope).
