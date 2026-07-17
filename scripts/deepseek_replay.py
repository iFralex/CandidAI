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
