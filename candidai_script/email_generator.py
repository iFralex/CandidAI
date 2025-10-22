from candidai_script.utils import extract_cv_text
from candidai_script.blog_posts import ai_chat
from candidai_script.database import save_email

def generate_email(user_id, ids, companies, profile_summary, cv_url, result_blog, result_recruiters):
    def parse(record):
        # Experience
        for key in ["birth_date", "birth_year", "dataset_version", "emails", "facebook_id", "facebook_username", "facebook_url", "github_url", "github_username", "id", "job_company_facebook_url", "job_company_founded", "job_company_id", "job_company_industry", "job_company_linkedin_id", "job_company_linkedin_url", "job_company_location_address_line_2", "job_company_location_continent", "job_company_location_country", "job_company_location_geo", "job_company_location_locality", "job_company_location_metro", "job_company_location_name", "job_company_location_postal_code", "job_company_location_region", "job_company_location_street_address", "job_company_size", "job_company_twitter_url", "job_company_website", "job_start_date", "job_title_class", "job_title_levels", "job_title_role", "job_title_sub_role", "last_initial", "linkedin_id", "linkedin_url", "linkedin_username", "location_address_line_2", "location_geo", "location_locality", "location_metro", "location_name", "location_names", "location_postal_code", "location_region", "location_street_address", "middle_initial", "middle_name", "mobile_phone", "personal_emails", "phone_numbers", "profiles", "recommended_personal_email", "regions", "street_addresses", "twitter_username", "twitter_url", "work_email"]:
            record.pop(key, None)

        experience = []
        for exp in record.get("experience", []):
            new_exp = exp.copy()
            for key in ["twitter_url", "linkedin_id", "id", "facebook_url", "linkedin_url"]:
                new_exp["company"].pop(key, None)
            if isinstance(new_exp.get("company", {}).get("location"), dict):
                for key in ["locality", "region", "address_line_2", "geo", "metro", "postal_code", "street_address"]:
                    new_exp["company"]["location"].pop(key, None)
            for key in ["class", "levels", "role", "sub_role"]:
                new_exp["title"].pop(key, None)
            experience.append(new_exp)

        # Education
        education = []
        for edu in record.get("education", []):
            new_edu = edu.copy()
            for key in ["twitter_url", "linkedin_id", "id", "facebook_url"]:
                new_edu["school"].pop(key, None)
            if isinstance(new_edu.get("school", {}).get("location"), dict):
                for key in ["locality", "region"]:
                    new_edu["school"]["location"].pop(key, None)
            education.append(new_edu)

        # Costruzione dell'oggetto finale
        record["education"] = education
        record["experience"] = experience
        
        return record
        
    cv = extract_cv_text(cv_url)
    emails = {}
    
    for company in companies:
        articles_contents = result_blog[company["name"]]
        recruiter_summary, query = result_recruiters[company["name"]]
        recruiter_summary = parse(recruiter_summary)
        
        prompt = f"""You are an expert career coach specializing in personalized outreach emails that get responses.
Create a highly personalized email to reach out to a recruiter at {company["name"]} requesting an interview.

CANDIDATE INFORMATION:
{profile_summary}

FULL CV:
{cv}

RECRUITER INFORMATION:
{recruiter_summary}

RECRUITER SELECTION CRITERIA (why this recruiter was matched):
{query}

COMPANY NEWS/ARTICLES:
{articles_contents}

CRITICAL INSTRUCTIONS:
1. **FIND COMMON GROUND**: Analyze the recruiter's background deeply and identify shared elements with the candidate:
   - Same university/alma mater
   - Same previous companies
   - Similar skills or certifications
   - Common interests or professional groups
   - Similar career paths or transitions
   - Mutual connections (if any)

2. **LEAD WITH CONNECTION**: Start the email by mentioning the most compelling commonality naturally (not forced)

3. **REFERENCE COMPANY INSIGHTS**: Use the articles/news to show genuine interest and understanding of the company's direction

4. **ALIGN EXPERIENCE**: Connect your relevant skills/experience directly to the company's needs and the recruiter's focus area

5. **BE SPECIFIC**: Avoid generic phrases. Use concrete examples and specific details from both profiles

6. **TONE**: Professional yet warm and human. Write like you're reaching out to a potential peer, not begging for attention

7. **LENGTH**: 150-250 words maximum. Respect their time.

8. **CALL TO ACTION**: Clear, confident request for a brief conversation

OUTPUT FORMAT: JSON with subject, body, and key_points fields

IMPORTANT: After generating the email, create a "key_points" array with 3 items that explains why this email is perfectly tailored for the candidate's goal. Each key point must:
- Be maximum 80 characters long
- Highlight a specific strength of the email (commonality used, company insight, skill alignment, etc.)
- Be actionable insight that shows strategic thinking
- Focus on WHY this approach will resonate with the recruiter

Output Example:
{{
  "subject": "...",
  "body": "...",
  "key_points": [
    "Leads with shared alma mater to build instant rapport",
    "References recent company expansion showing research depth",
    "Highlights ML experience matching recruiter's current hiring focus"
  ]
}}

Generate ONLY the JSON output with no additional commentary."""
        

        email = ai_chat(prompt, "json")

        save_email(user_id, ids[f'{company["name"]}-{user_id}'], email)
        emails[company["name"]] = email
    
    return emails