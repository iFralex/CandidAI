from candidai_script.utils import extract_cv_text
from candidai_script.blog_posts import ai_chat
from candidai_script.database import save_email
from candidai_script.recruiter import get_work_email_from_rocketreach
from typing import Dict

def generate_email(user_id, ids, companies, profile_summary, cv_url, result_blog, result_recruiters, result_company_info, user_instructions):
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
        recruiter_summary = parse_recruiter(recruiter_summary)
        company_info = parse_company_info(result_company_info[company["name"]])
        profile_summary = parse_recruiter(profile_summary)
        email_address = get_work_email_from_rocketreach(recruiter_summary["full_name"], company["name"])
        
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
1. **FIND COMMON GROUND (OR CREATE IT)**: Analyze the recruiter's background deeply to identify shared elements.
   - Primary targets: Same university, previous companies, mutual connections, shared professional groups.
   - **Fallback strategy**: If no direct common ground exists, identify a specific, non-generic aspect of their career you genuinely admire (e.g., an article they wrote, a talk they gave, their transition from one industry to another).

2. **LEAD WITH A STRATEGIC SUBJECT LINE**: Create a subject line that is both professional and intriguing, ideally hinting at the common ground or a key value proposition. *Example: "Fellow [University Name] Alum & Data Scientist" or "Question about your work at [Previous Company]"*.

3. **LEAD WITH CONNECTION**: Start the email's first sentence by mentioning the most compelling commonality naturally. Avoid clichés like "I hope this email finds you well."

4. **CREATE A HYPOTHETICAL BRIDGE**: Use the articles/news to demonstrate deep interest. **Don't just mention the news; connect it to a potential challenge or opportunity for the company.** *Example: "I read about your recent launch of Product X. I imagine that optimizing user engagement is a key priority. In my previous role at Y, I increased engagement by 20% by..."* This shows proactive problem-solving.

5. **FRAME YOURSELF AS A SOLUTION**: Connect your most relevant experience directly to the hypothesis you just created or to the recruiter's specific focus area. Show how you can deliver value to *their* team or *their* specific hiring goals.

6. **BE SPECIFIC**: Avoid generic phrases. Use concrete examples and specific metrics from your background and your research on the company and recruiter.

7. **TONE**: Professional yet warm and human. Write like you're reaching out to a potential peer, not begging for attention.

8. **LENGTH**: 150-250 words maximum. Respect their time.

9. **LOW-FRICTION CALL TO ACTION**: End with a clear, confident request for a **brief, 15-minute conversation** to explore potential alignment.

OUTPUT FORMAT: JSON with subject, body, and key_points fields

IMPORTANT: After generating the email, create a "key_points" array with 3 items that explains why this email is perfectly tailored for the candidate's goal. Each key point must:
- Be maximum 80 characters long.
- Highlight a specific strength of the email (commonality, hypothetical bridge, etc.).
- Be an actionable insight that shows strategic thinking.
- Focus on WHY this approach will resonate with the recruiter, **touching on its psychological impact** (e.g., "Builds rapport", "Shows proactivity").

Generate ONLY the JSON output with no additional commentary.
"""

        email = ai_chat(prompt, "json")

        save_email(user_id, ids[f'{company["name"]}-{user_id}'], email, prompt, email_address)
        emails[company["name"]] = email
    
    return emails