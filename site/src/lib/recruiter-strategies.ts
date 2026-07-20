type Criterion = { key: string; value: string[] };
export type RecruiterStrategy = { id: number; name: string; criteria: Criterion[] };

/** Build the same progressive, precise-to-broad search used by onboarding and settings. */
export function buildDefaultRecruiterStrategies(profile: any): RecruiterStrategy[] {
  const values: Record<string, string[]> = {
    job_title_levels: ['senior', 'manager', 'director'],
    skills: (profile?.skills || []).filter(Boolean),
    company_name: (profile?.experience || []).map((e: any) => e.company?.name).filter(Boolean),
    school_name: (profile?.education || []).map((e: any) => e.school?.name).filter(Boolean),
    location_country: profile?.location?.country ? [profile.location.country.toLowerCase()] : [],
    location_continent: profile?.location?.continent ? [profile.location.continent.toLowerCase()] : [],
  };
  const presets: [string, string[]][] = [
    ['Seniority, skills, history and country', ['job_title_levels','skills','company_name','school_name','location_country']],
    ['Skills, history and country', ['skills','company_name','school_name','location_country']],
    ['Seniority, skills and country', ['job_title_levels','skills','location_country']],
    ['Seniority, company history and country', ['job_title_levels','company_name','location_country']],
    ['Seniority, education and country', ['job_title_levels','school_name','location_country']],
    ['Skills, company history and country', ['skills','company_name','location_country']],
    ['Skills, education and country', ['skills','school_name','location_country']],
    ['History and country', ['company_name','school_name','location_country']],
    ['Seniority and country', ['job_title_levels','location_country']],
    ['Skills and country', ['skills','location_country']],
    ['Company history and country', ['company_name','location_country']],
    ['Education and country', ['school_name','location_country']],
    ['Seniority, skills, history and continent', ['job_title_levels','skills','company_name','school_name','location_continent']],
    ['Skills, history and continent', ['skills','company_name','school_name','location_continent']],
    ['Seniority, skills and continent', ['job_title_levels','skills','location_continent']],
    ['Seniority, company history and continent', ['job_title_levels','company_name','location_continent']],
    ['Seniority, education and continent', ['job_title_levels','school_name','location_continent']],
    ['Skills, company history and continent', ['skills','company_name','location_continent']],
    ['Skills, education and continent', ['skills','school_name','location_continent']],
    ['Seniority and continent', ['job_title_levels','location_continent']],
    ['Skills and continent', ['skills','location_continent']],
    ['Company history and continent', ['company_name','location_continent']],
    ['Education and continent', ['school_name','location_continent']],
    ['Skills, company history and education', ['skills','company_name','school_name']],
    ['Seniority and skills', ['job_title_levels','skills']],
    ['Skills and company history', ['skills','company_name']],
    ['Skills and education', ['skills','school_name']],
    ['Skills only', ['skills']],
    ['Seniority only', ['job_title_levels']],
    ['Any available recruiter', []],
  ];
  const seen = new Set<string>();
  const strategies: RecruiterStrategy[] = [];
  for (const [name, keys] of presets) {
    const criteria = keys.filter(key => values[key]?.length).map(key => ({ key, value: [...new Set(values[key])] }));
    const signature = JSON.stringify(criteria);
    if (seen.has(signature)) continue;
    seen.add(signature);
    strategies.push({ id: strategies.length + 1, name, criteria });
  }
  return strategies;
}
