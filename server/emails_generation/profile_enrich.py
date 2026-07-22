"""Enrichment of a candidate profile summary from PDL data + CV text.

The prompt below is MOVED (not duplicated) from the TypeScript
``enrichProfileAI`` in ``site/src/actions/pdl.ts`` (that TS implementation is
deleted in a later task of this feature). It is split into three plain
(non f-string) triple-quoted constants around the two interpolation points
because the prompt body contains a literal TypeScript interface block full of
braces that would break an f-string or ``str.format()`` call. The final
prompt is assembled by straight concatenation.
"""

import json
from typing import Optional

from server.emails_generation.ai_client import ai_chat


PROMPT_A = """You are a professional profile enrichment assistant.

You are given:
1. EXISTING PROFILE DATA from LinkedIn/PDL (authoritative source for names and metadata):
"""

PROMPT_B = """

2. CV TEXT (primary source for additional entries, projects, certifications, and dates):
"""

PROMPT_C = """

RULES — follow strictly:
- CANONICAL NAMES: When a company or institution appears in both sources, ALWAYS use the exact name from the PDL data, even if the CV uses an abbreviation or different language (e.g. if PDL has "Politecnico di Milano" and CV has "Polimi" or "Polytechnic of Milan", always output "Politecnico di Milano"). Apply this canonical name to ALL entries that refer to that institution, including new entries found only in the CV.
- CANONICAL WEBSITES: When an institution has a "website" in the PDL data, copy that website into ALL entries for that same institution, including new entries found only in the CV.
- MERGE ENTRIES: Merge two entries into one ONLY when they clearly represent the exact same experience or degree — i.e. same job role/title at the same company in the same period, or same degree level at the same institution in the same period. Enrich the merged entry with details from both sources.
- KEEP SEPARATE ENTRIES: A person can have multiple distinct entries at the same institution or company. Keep them as separate entries in all these cases:
  - Education: different degree levels at the same university (e.g. Bachelor's + Master's at Politecnico di Milano) → 2 entries.
  - Education: same degree level but different time periods at the same university → 2 entries.
  - Experience: different job titles at the same company, even if consecutive → 2 entries.
  Never collapse distinct entries into one just because they share the same institution or company name.
- DOUBLE DEGREE: A double degree / double diploma is a single postgraduate programme delivered jointly by two universities. It MUST produce EXACTLY TWO separate education entries in the output — one per university — with identical degree, majors, start_date, end_date, and description. Apply canonical names and websites from PDL to each university independently.
  EXAMPLE — if the CV says "MSc Double Degree, Computer Science, 2022–2024, Politecnico di Milano & KTH Royal Institute of Technology", output these two entries (plus any Bachelor entry that already existed):
  { "school": { "name": "Politecnico di Milano" }, "degree": "Master of Science", "majors": ["Computer Science"], "start_date": "2022", "end_date": "2024", "description": "Double degree programme in partnership with KTH Royal Institute of Technology." }
  { "school": { "name": "KTH Royal Institute of Technology" }, "degree": "Master of Science", "majors": ["Computer Science"], "start_date": "2022", "end_date": "2024", "description": "Double degree programme in partnership with Politecnico di Milano." }
  Do NOT merge these two entries. Do NOT attach the Master's entry to any existing Bachelor's entry at Politecnico di Milano.
- NEW ENTRIES: Add entries found in the CV that have no equivalent in PDL (applying canonical names and websites where the institution or company is already known from PDL).
- SKILLS: Combine from both sources, deduplicate, translate all to English.
- OUTPUT LANGUAGE: Write every generated textual field in English, including descriptions and all onboardingInsights values. Preserve proper nouns in their official form.
- PROJECTS & CERTIFICATIONS: Extract from CV text.
- LOCATION: Prefer PDL location.
- NAME & TITLE: Prefer PDL values when available.

Return ONLY a valid JSON object matching EXACTLY this TypeScript interface — no markdown, no explanation:

interface Experience {
  title?: { name: string };
  company?: { name: string; website?: string; location?: { name: string } };
  start_date?: string;
  end_date?: string;
  description?: string; // brief summary of responsibilities and achievements
}
interface Education {
  school?: { name: string; website?: string };
  degree: string;
  majors?: string[];
  start_date?: string;
  end_date?: string;
  description?: string; // notable activities, thesis, honours, or context
}
interface Project {
  name: string;
  description: string;
  technologies: string[];
  start_date?: string;
  end_date?: string;
}
interface Certification {
  name: string;
  autority: string;
  issue_date: string;
  expired: boolean;
}
interface ProfileSummary {
  name: string;
  title: string;
  location?: { country: string; continent: string };
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  certifications: Certification[];
  onboardingInsights: {
    searchNarrative: string; // one personalized sentence explaining who we will prioritize and why
    targetRoleSuggestions: string[]; // maximum 3 concise roles
    strengths: string[]; // maximum 5 candidate differentiators
    emailAngles: string[]; // maximum 4 evidence-based hooks for outreach
  };
}"""


def _build_prompt(existing_data: str, cv_text: str) -> str:
    return PROMPT_A + existing_data + PROMPT_B + cv_text + PROMPT_C


def enrich_profile_summary(pdl_profile: Optional[dict], cv_text: str) -> dict:
    """Merge PDL profile data with CV text into a profileSummary dict via DeepSeek.

    Raises RuntimeError if the AI call does not return a usable dict.
    """
    existing_data = (
        json.dumps(pdl_profile, indent=2, ensure_ascii=False)
        if pdl_profile
        else "No existing data available."
    )
    prompt = _build_prompt(existing_data, cv_text or "No CV was provided.")
    merged = ai_chat(prompt, "json")
    if not isinstance(merged, dict):
        raise RuntimeError("AI enrichment returned no usable profile")
    merged["experience"] = merged["experience"] if isinstance(merged.get("experience"), list) else []
    merged["education"] = merged["education"] if isinstance(merged.get("education"), list) else []
    return merged
