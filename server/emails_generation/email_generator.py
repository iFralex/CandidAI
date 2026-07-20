from server.emails_generation.utils import extract_cv_text
from server.emails_generation.blog_posts import ai_chat
from server.emails_generation.database import save_email
from typing import Dict
import re


def strip_em_dashes(text):
    """Strip the em-dash / en-dash 'AI tell' from generated email prose.

    Number ranges (e.g. 2,000-9,000) keep a hyphen; a dash used as a sentence
    break becomes a comma (surrounding spaces collapsed). Belt-and-suspenders
    with the prompt instruction that already asks the model to avoid dashes.
    """
    if not isinstance(text, str):
        return text
    text = re.sub(r'(\d)\s*[—–]\s*(\d)', r'\1-\2', text)   # keep numeric ranges as hyphens
    text = re.sub(r'\s*[—–]\s*', ', ', text)              # dash-as-break -> comma
    text = re.sub(r'\s+,', ',', text)                              # tidy stray space-before-comma
    text = re.sub(r',\s*,', ',', text)                            # collapse accidental double commas
    return text

def generate_email(user_id, ids, companies, profile_summary, cv_url, result_blog, result_recruiters, result_company_info, user_instructions, priority="normal"):
    def parse_company_info(record):
        def filter_by_cumulative_coverage(
            counts: Dict[str, float],
            coverage: float = 0.80,
            min_country_share: float = 0.0
        ) -> Dict[str, float]:
            """
            Mantiene i paesi fino a raggiungere `coverage` (0-1) della somma totale.
            Se min_country_share > 0, un paese viene mantenuto anche se non necessario
            se la sua quota >= min_country_share.
            Ritorna un nuovo dict con i paesi mantenuti e una chiave 'Other' se necessario.
            """
            if not counts:
                return {}
            # totale
            total = sum(counts.values())
            if total == 0:
                return counts.copy()

            # ordina paesi per valore decrescente
            items = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
            cum = 0.0
            kept = {}
            other_sum = 0.0

            for country, value in items:
                share = value / total
                # mantieni se ci serve per coverage o se supera la soglia minima assoluta
                if cum < coverage or (min_country_share > 0 and share >= min_country_share):
                    kept[country] = value
                    cum += value / total
                else:
                    other_sum += value

            if other_sum > 0:
                kept["Other"] = other_sum
            return kept
        
        if not record:
            return None
        
        for key in ["status", "name", "sic", "linkedin_id", "linkedin_slug", "facebook_url", "twitter_url", "profiles", "mic_exchange", "affiliated_profiles", "latest_funding_stage", "last_funding_date", "number_funding_rounds", "funding_stages", "dataset_version", "alternative_domains", "id", "likelihood", "linkedin_url", ]:
            record.pop(key, None)
        if isinstance(record.get("location"), dict):
            record["location"] = record["location"]["name"]
        if isinstance(record.get("employee_count_by_country"), dict):
            record["employee_count_by_country"] = filter_by_cumulative_coverage(record["employee_count_by_country"])
        
        naics = []
        naics_raw = record.get("naics") or []
        if isinstance(naics_raw, list):
            for n in naics_raw:
                if isinstance(n, dict):
                    new_n = n.copy()
                    new_n.pop("national_industry", None)
                    naics.append(new_n)
        record["naics"] = naics
        
        return record

    def parse_recruiter(record):
        # Copia del record originale per sicurezza
        record = record.copy() if isinstance(record, dict) else {}

        # Rimozione chiavi indesiderate di alto livello
        keys_to_remove = [
            "birth_date", "birth_year", "dataset_version", "emails", "facebook_id",
            "facebook_username", "facebook_url", "github_url", "github_username",
            "id", "job_company_facebook_url", "job_company_founded", "job_company_id",
            "job_company_industry", "job_company_linkedin_id", "job_company_linkedin_url",
            "job_company_location_address_line_2", "job_company_location_continent",
            "job_company_location_country", "job_company_location_geo", "job_company_location_locality",
            "job_company_location_metro", "job_company_location_name", "job_company_location_postal_code",
            "job_company_location_region", "job_company_location_street_address", "job_company_size",
            "job_company_twitter_url", "job_company_website", "job_start_date", "job_title_class",
            "job_title_levels", "job_title_role", "job_title_sub_role", "last_initial", "linkedin_id",
            "linkedin_url", "linkedin_username", "location_address_line_2", "location_geo",
            "location_locality", "location_metro", "location_name", "location_names",
            "location_postal_code", "location_region", "location_street_address",
            "middle_initial", "middle_name", "mobile_phone", "personal_emails", "phone_numbers",
            "profiles", "recommended_personal_email", "regions", "street_addresses",
            "twitter_username", "twitter_url", "work_email"
        ]
        for key in keys_to_remove:
            record.pop(key, None)

        # EXPERIENCE
        experience = []
        for exp in record.get("experience", []) or []:
            new_exp = exp.copy() if isinstance(exp, dict) else {}

            company = new_exp.get("company")
            if isinstance(company, dict):
                for key in ["twitter_url", "linkedin_id", "id", "facebook_url", "linkedin_url"]:
                    company.pop(key, None)

                location = company.get("location")
                if isinstance(location, dict):
                    for key in [
                        "locality", "region", "address_line_2", "geo",
                        "metro", "postal_code", "street_address"
                    ]:
                        location.pop(key, None)

            title = new_exp.get("title")
            if isinstance(title, dict):
                for key in ["class", "levels", "role", "sub_role"]:
                    title.pop(key, None)

            experience.append(new_exp)

        # EDUCATION
        education = []
        for edu in record.get("education", []) or []:
            new_edu = edu.copy() if isinstance(edu, dict) else {}

            school = new_edu.get("school")
            if isinstance(school, dict):
                for key in ["twitter_url", "linkedin_id", "id", "facebook_url"]:
                    school.pop(key, None)

                location = school.get("location")
                if isinstance(location, dict):
                    for key in ["locality", "region"]:
                        location.pop(key, None)

            education.append(new_edu)

        # Costruzione oggetto finale
        record["experience"] = experience
        record["education"] = education

        return record

    cv = extract_cv_text(cv_url)
    emails = {}
    
    for company in companies:
        articles_contents = result_blog[company["name"]]
        recruiter_summary, query = result_recruiters[company["name"]]
        email_address = recruiter_summary.get("work_email")
        recruiter_summary = parse_recruiter(recruiter_summary)
        company_info = parse_company_info(result_company_info[company["name"]])
        profile_summary = parse_recruiter(profile_summary)
        
        company_info_block = f"\nCOMPANY INFO:\n{company_info}\n" if company_info else ""
        user_instructions_block = (
            f"\nUSER'S SPECIAL INSTRUCTIONS:\n"
            f"**Critically important: You must integrate the following user-specific directives into the email. "
            f"These instructions override any conflicting general advice.**\n"
            f"{user_instructions}\n"
            if user_instructions else ""
        )
 
        prompt = f"""You are an expert career coach specializing in personalized outreach emails that get responses.
Create a highly personalized email to reach out to a recruiter at {company["name"]} requesting a conversation.

CANDIDATE INFORMATION:
{profile_summary}

FULL CV:
{cv}

RECRUITER INFORMATION:
{recruiter_summary}

RECRUITER SELECTION CRITERIA (why this recruiter was matched):
{query}
{company_info_block}

COMPANY NEWS/ARTICLES:
{articles_contents}
{user_instructions_block}

------

CRITICAL INSTRUCTIONS:
Write a cold email a busy recruiter would actually reply to. The candidate's FULL CV is attached, so the email is the HOOK, not the résumé — do not try to convey the whole profile; make them want to open the CV and reply. Four short beats, natural paragraphs, no headers.
1. GREETING + HOOK (1-2 sentences): "Hi <recruiter first name>," then the hook.
   - Prefer ONE specific, genuine common ground with this recruiter (a shared school, a company they worked at, a specific topic/cause they engage with).
   - If there is no strong, specific common ground, do NOT force a weak one (never "you're based in Europe" or a vague "interest in education"): open instead with ONE specific recent development/product of the company, connected to the candidate.
   - No praise of the recruiter; never start a sentence with "Your".
2. ONE FLAGSHIP SELL, CHOSEN FOR RELEVANCE (2 sentences): the candidate's single achievement MOST RELEVANT to THIS company's domain — chosen by relevance, not raw impressiveness. Anchor it to ONE concrete result or number.
3. ONE RANGE SIGNAL (optional, at most ONE short clause — NOT a sentence, NOT a list): only if there is a genuinely relevant second dimension, you may append a single clause hinting at breadth, e.g. "...alongside my AI engineering work" or "...on top of full-stack product delivery". This signals versatility so the candidate doesn't read as one-note. NEVER expand it into a second full sell, a second project write-up, or a skills/tools/degree list. If in doubt, omit it. You may also nod once to the attached CV for the full picture.
4. WHY THIS COMPANY (1 sentence): connect the flagship to a real product, team, or problem of THIS company.
5. THE ASK (1 sentence): a 15-minute conversation to explore roles/fit in a named concrete area, framed around what the candidate could do for them. Never "contribute to your recruiting needs", "seeking interview", or generic "opportunities/advice/perspective".
6. CLOSING (required): always end the body with a short sign-off on its own line, then the candidate's first name on the next line. Keep it brief and sober, e.g. "Best," / "Thanks," / "Kind regards," (choose one, no exclamation). The email must NEVER end abruptly on the ask; the sign-off + first name are mandatory.

LENGTH 110-150 words. Sober, confident-peer tone. No superlatives, no exclamation marks. Do NOT use em-dashes or en-dashes (— –); use commas, periods, or parentheses instead. Em-dashes are the most visible tell of AI-written text.
ABSOLUTE BAN — the email must contain NONE of these words: inspiring, excited, thrilled, truly, passionate, passion, love, amazing, incredible, impressed, impressive, admire, eager, keen, glad, resonates, honored, deeply invested, intrigued. Re-read the draft and remove any before finalizing.
Only claim common ground supportable from the recruiter data.
SUBJECT: max 8 words, concrete, names the fit. No "Let's connect", no "seeking interview", no colon-stuffed clauses.

OUTPUT FORMAT: JSON with subject, body, key_points, recruiter_match_reason, and recruiter_match_points fields.

Also explain the recruiter choice using only the recruiter data and selection criteria:
- recruiter_match_reason: one concise personalized sentence (maximum 30 words).
- recruiter_match_points: 2-3 short evidence-based reasons this is a useful contact.
- Never invent responsibilities, regions, or hiring ownership that the data does not support.

IMPORTANT: After generating the email, create a "key_points" array with 3 items that explains why this email is perfectly tailored for the candidate's goal. Each key point must:
- Be maximum 80 characters long.
- Highlight a specific strength of the email (commonality, hypothetical bridge, etc.).
- Be an actionable insight that shows strategic thinking.
- Focus on WHY this approach will resonate with the recruiter, **touching on its psychological impact** (e.g., "Builds rapport", "Shows proactivity").

Generate ONLY the JSON output with no additional commentary.
"""

        email = ai_chat(prompt, "json", priority=priority)

        # Post-processing safety net: strip the em-dash / en-dash AI tell that
        # the model still emits occasionally despite the prompt instruction.
        if isinstance(email, dict):
            if isinstance(email.get("subject"), str):
                email["subject"] = strip_em_dashes(email["subject"])
            if isinstance(email.get("body"), str):
                email["body"] = strip_em_dashes(email["body"])

        save_email(user_id, ids[f'{company["name"]}-{user_id}'], email, prompt, email_address, cv_url)
        emails[company["name"]] = email
    
    return emails
