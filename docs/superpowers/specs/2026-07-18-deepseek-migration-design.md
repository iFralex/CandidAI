# DeepSeek V4 Flash Migration — Design

**Date:** 2026-07-18
**Status:** approved (design)
**Scope:** migrate all AI inference from OpenRouter (free models) + Gemini to
DeepSeek V4 Flash, in a single phase, as non-destructively as possible.

## 1. Goal & motivation

Move the two AI backends the product uses onto **DeepSeek V4 Flash**
(`deepseek-v4-flash`, DeepSeek direct API):

- **Python pipeline** — every call funnels through one function, `ai_chat()` in
  `server/emails_generation/blog_posts.py` (~20 call sites: keyword extraction,
  link scoring, blog/category detection, next-page prediction, article
  extraction, recruiter selection, and the actual email generation in
  `email_generator.py` + the video advisor).
- **Site (TS)** — a single Gemini call, `enrichProfileAI()` in
  `site/src/actions/pdl.ts` (`gemini-3.1-flash-lite-preview`), which merges the
  CV text with PDL data into a structured `ProfileSummary` JSON.

Motivation is **reliability and quality**, not cost. The current setup runs on
OpenRouter `:free` models with elaborate key/model rotation + proxy fallback
(evidence of rate-limit pain) and Gemini's free tier.

### Cost (measured, not estimated)

Projected from the real production log `logs/ai/ai_log.json` on the VPS (100
recorded `ai_chat` calls: 719,553 prompt tokens, 654,771 completion tokens) at
DeepSeek V4 Flash pricing ($0.14/1M input miss, $0.0028/1M input hit, $0.28/1M
output):

| Scenario | 100 calls | per call |
|---|---|---|
| no caching | $0.28 | $0.0028 |
| 60% input cache-hit | $0.22 | $0.0022 |

Cost is **negligible** and **output-dominated** (output $0.18 vs input $0.10),
so prefix caching helps but isn't the main lever. Fractions of a cent per call.

## 2. Decisions (settled)

| Decision | Choice |
|---|---|
| Provider | **DeepSeek direct API** (`https://api.deepseek.com`, OpenAI-compatible) |
| Model | `deepseek-v4-flash` (NOT `deepseek-chat`/`reasoner` — deprecated 2026-07-24) |
| Strategy | **DeepSeek primary + existing OpenRouter chain as fallback** (keep working code) |
| Rollback | env `AI_PROVIDER=deepseek\|openrouter` toggle |
| Scope | Python `ai_chat` **and** Gemini `enrichProfileAI`, **one phase** |
| Secrets | new `DEEPSEEK_API_KEY` on both the VPS `.env.local` and Vercel |

## 3. Architecture

### 3.1 Python — `ai_chat()` refactor

Keep the public signature and behaviour identical
(`ai_chat(prompt, format="str", model=..., site_url=..., site_name=...)` →
`str | dict | None`, same `parse_json` post-processing). The ~20 call sites do
not change.

Internally, split into:

- `_call_deepseek(prompt, want_json) -> str` — POST to
  `https://api.deepseek.com/chat/completions` with `DEEPSEEK_API_KEY`, model
  `deepseek-v4-flash`, `timeout`, and (when `want_json`) `response_format =
  {"type": "json_object"}`. A couple of internal retries on 429/5xx/timeout.
- `_call_openrouter(...)` — the **current** implementation, moved verbatim (the
  key/model rotation + proxy fallback logic is preserved, not deleted).
- `ai_chat(...)` — dispatcher:
  - if `AI_PROVIDER == "openrouter"` → use OpenRouter only (rollback path);
  - else try `_call_deepseek`; on exception/empty → **fall back** to
    `_call_openrouter`; then apply the existing JSON parsing based on `format`.

`format` handling is unchanged: `"json"` / truthy → parse JSON via the existing
`parse_json`; otherwise return the raw string.

### 3.2 Site — `enrichProfileAI()` switch

Replace the `@google/generative-ai` client with a DeepSeek call (OpenAI-compatible
`fetch` to `https://api.deepseek.com/chat/completions`, `DEEPSEEK_API_KEY`,
`deepseek-v4-flash`, `response_format: json_object`). The existing prompt already
demands "Return ONLY valid JSON matching this interface", so it transfers as-is;
keep the current `JSON.parse` + fallback-to-`profileSummary` error handling. No
OpenRouter fallback here (Gemini had none either); on failure it degrades to the
existing behaviour (return the un-merged `profileSummary`).

## 4. Testing / cost evaluation (before flipping)

Non-destructive, data-driven, run offline against real data:

1. **Cost dry-run** — already done (§1). Re-runnable from `logs/ai/ai_log.json`.
2. **Golden-set replay** — a standalone script reads `logs/ai/ai_log.json` on the
   VPS (each entry has the real `input` prompt and the free-model `output`),
   replays each `input` through `_call_deepseek`, and reports a per-entry
   comparison. Grading by call-site shape:
   - numeric/index answers (e.g. "respond with a single number") → exact match;
   - JSON answers → parses + key/shape diff;
   - free-form (emails) → length + manual spot check on a small sample.
   No production impact (reads a copy, writes nothing).
3. **End-to-end smoke** — run the pipeline on 1–2 companies with
   `AI_PROVIDER=deepseek` and eyeball the generated emails/articles.

Gate to flip the default to DeepSeek: replay shows parity on the deterministic
call-sites and acceptable quality on emails.

## 5. Rollout & rollback

1. Add `DEEPSEEK_API_KEY` to VPS `.env.local` and Vercel env.
2. Deploy code with default still `AI_PROVIDER=openrouter` (no behaviour change).
3. Run replay + smoke (§4).
4. Flip `AI_PROVIDER=deepseek` (VPS) — DeepSeek primary, OpenRouter auto-fallback.
5. Rollback = set `AI_PROVIDER=openrouter` and restart `candidai.service`.

## 6. Out of scope / non-goals

- Removing the OpenRouter plumbing (kept as the safety net).
- Prompt re-engineering per call-site (transfer prompts unchanged; tune later
  only if the replay shows regressions).
- Any change to the ~20 `ai_chat` call sites.
- Streaming, tool-calling, or reasoning-mode features.

## 7. Risks

- **JSON strictness**: DeepSeek `json_object` mode is stricter than the free
  models; the existing `parse_json` is defensive (strips code fences etc.), so
  keep it. Mitigated by the golden-set replay on JSON call-sites.
- **Two secrets to set** (VPS + Vercel); missing key → DeepSeek attempt fails →
  auto-fallback to OpenRouter (safe, but silently masks a misconfig — log it).
- **Deprecation trap**: must use `deepseek-v4-flash`, never `deepseek-chat`.
