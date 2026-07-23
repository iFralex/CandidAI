"""On-demand follow-up generation.

This module deliberately has no scheduler: a generation only happens after an
explicit user action from the product.
"""

from typing import Any, Dict, Optional

from server.emails_generation.ai_client import ai_chat


def generate_follow_up(context: Dict[str, Any], instructions: Optional[str] = None) -> Dict[str, Any]:
    company = context.get("company") or {}
    recruiter = context.get("recruiter") or {}
    original_email = context.get("original_email") or {}
    candidate = context.get("candidate") or {}

    prompt = f"""
You are writing one thoughtful follow-up to a recruiter after a candidate's
first outreach received no reply.

Return valid JSON with exactly these keys:
{{
  "subject": "string",
  "body": "string",
  "strategy": "one concise sentence explaining why this follow-up works",
  "key_points": ["string", "string", "string"]
}}

Rules:
- Write in English.
- This must feel like a natural continuation, never a repeated first email.
- Keep the body between 70 and 130 words.
- Be confident, warm and respectful; never needy, pushy or sales-like.
- Do not invent facts, dates, achievements, job openings or company news.
- Preserve useful specificity from the original message.
- Use a low-friction call to action.
- Do not include placeholders.
- Do not mention AI or CandidAI.

Candidate context:
{candidate}

Company:
{company}

Recruiter:
{recruiter}

Original email:
{original_email}

Additional direction for this new version:
{instructions or "No additional direction. Choose the strongest concise follow-up."}
"""

    result = ai_chat(prompt, "json", priority="high")
    if not isinstance(result, dict):
        raise RuntimeError("The AI did not return a valid follow-up")

    subject = str(result.get("subject") or "").strip()
    body = str(result.get("body") or "").strip()
    strategy = str(result.get("strategy") or "").strip()
    key_points = result.get("key_points")

    if not subject or not body:
        raise RuntimeError("The generated follow-up is incomplete")
    if not isinstance(key_points, list):
        key_points = []

    return {
        "subject": subject,
        "body": body,
        "strategy": strategy,
        "key_points": [str(item).strip() for item in key_points if str(item).strip()][:3],
    }
