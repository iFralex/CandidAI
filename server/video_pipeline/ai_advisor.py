import json
import logging
import random
from dataclasses import dataclass
from .db import Database
from .processor import LAYOUTS, SUBTITLE_STYLE_NAMES

logger = logging.getLogger(__name__)


def _get_ai_chat():
    """Lazy import of ai_chat to avoid pulling in heavy blog_posts dependencies at import time."""
    from server.emails_generation.blog_posts import ai_chat  # noqa: PLC0415
    return ai_chat


@dataclass
class Decision:
    layout: str
    clip_category: str
    subtitle_style: str
    reasoning: str


class AIAdvisor:
    def __init__(self, db_path: str):
        self.db = Database(db_path)

    def decide(self, available_categories: list[str]) -> Decision:
        """Use OpenRouter (via ai_chat) to pick layout/clip/style from performance history."""
        if not available_categories:
            raise ValueError("No clip categories available in library")
        recent_published = self.db.list_recent_published(limit=10)
        stats = self.db.list_stats(limit=50)
        if not recent_published and not stats:
            logger.info("No history yet - using fallback decision")
            return self._fallback_decision(available_categories)
        prompt = self._build_prompt(recent_published, stats, available_categories)
        try:
            ai_chat = _get_ai_chat()
            data = ai_chat(prompt, format="json")
            if not isinstance(data, dict):
                raise ValueError(f"Expected dict, got {type(data)}")
            decision = self._validate_and_build(data, available_categories)
            logger.info(
                f"AI decision: {decision.layout} / {decision.clip_category} / "
                f"{decision.subtitle_style} - {decision.reasoning}"
            )
            return decision
        except Exception as e:
            logger.warning(f"AI advisor failed ({e}), using fallback")
            return self._fallback_decision(available_categories)

    def save_decision(self, decision: Decision) -> str:
        return self.db.save_ai_decision(
            layout=decision.layout,
            clip_category=decision.clip_category,
            subtitle_style=decision.subtitle_style,
            reasoning=decision.reasoning
        )

    def _validate_and_build(self, data: dict, available_categories: list[str]) -> Decision:
        layout = data.get("layout", "")
        clip_category = data.get("clip_category", "")
        subtitle_style = data.get("subtitle_style", "")
        if layout not in LAYOUTS:
            layout = random.choice(LAYOUTS)
        if clip_category not in available_categories:
            clip_category = random.choice(available_categories)
        if subtitle_style not in SUBTITLE_STYLE_NAMES:
            subtitle_style = random.choice(SUBTITLE_STYLE_NAMES)
        return Decision(
            layout=layout,
            clip_category=clip_category,
            subtitle_style=subtitle_style,
            reasoning=data.get("reasoning", "")
        )

    def _fallback_decision(self, available_categories: list[str]) -> Decision:
        return Decision(
            layout=random.choice(LAYOUTS),
            clip_category=random.choice(available_categories),
            subtitle_style=random.choice(SUBTITLE_STYLE_NAMES),
            reasoning="fallback: no history available"
        )

    def _build_prompt(self, recent: list[dict], stats: list[dict],
                       available_categories: list[str]) -> str:
        recent_summary = [
            {"layout": v["layout"], "subtitle_style": v["subtitle_style"],
             "platform": v.get("platform")}
            for v in recent
        ]
        perf_summary = [
            {"impressions": s["impressions"], "engagement_rate": s["engagement_rate"],
             "platform": s.get("platform")}
            for s in stats[:20]
        ]
        return (
            f"You are a social media content strategist for CandidAI, an AI job-application SaaS.\n"
            f"Analyze the recent video publishing history and performance stats below, "
            f"then choose the best parameters for the NEXT video to maximize engagement.\n\n"
            f"Recent published videos (last {len(recent_summary)}):\n"
            f"{json.dumps(recent_summary, indent=2)}\n\n"
            f"Performance stats:\n"
            f"{json.dumps(perf_summary, indent=2)}\n\n"
            f"Available clip categories: {available_categories}\n"
            f"Available layouts: {LAYOUTS}\n"
            f"Available subtitle styles: {SUBTITLE_STYLE_NAMES}\n\n"
            f"Rules:\n"
            f"- Avoid repeating the same layout/style as the last 3 videos\n"
            f"- Prefer the clip_category with the highest engagement_rate when data is available\n"
            f"- Vary subtitle styles to keep content fresh\n\n"
            f'Respond ONLY with a JSON object, no prose, no markdown fences:\n'
            f'{{"layout": "<one of {LAYOUTS}>", "clip_category": "<one of the available categories>", '
            f'"subtitle_style": "<one of {SUBTITLE_STYLE_NAMES}>", "reasoning": "<one sentence>"}}'
        )
