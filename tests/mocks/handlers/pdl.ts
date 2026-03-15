import { http, HttpResponse } from "msw";

const PDL_BASE_URL = "https://api.peopledatalabs.com";

// Mock recruiter data
const mockRecruiters = [
  {
    id: "pdl_person_1",
    full_name: "Alice Johnson",
    first_name: "Alice",
    last_name: "Johnson",
    job_title: "Technical Recruiter",
    job_company_name: "TechCorp",
    work_email: "alice.johnson@techcorp.com",
    linkedin_url: "linkedin.com/in/alicejohnson",
    location_name: "San Francisco, CA",
    skills: ["recruiting", "talent acquisition"],
  },
  {
    id: "pdl_person_2",
    full_name: "Bob Martinez",
    first_name: "Bob",
    last_name: "Martinez",
    job_title: "Senior Recruiter",
    job_company_name: "StartupXYZ",
    work_email: "bob.martinez@startupxyz.com",
    linkedin_url: "linkedin.com/in/bobmartinez",
    location_name: "New York, NY",
    skills: ["executive search", "recruiting"],
  },
  {
    id: "pdl_person_3",
    full_name: "Carol Smith",
    first_name: "Carol",
    last_name: "Smith",
    job_title: "HR Manager",
    job_company_name: "BigCo Inc",
    work_email: "carol.smith@bigco.com",
    linkedin_url: "linkedin.com/in/carolsmith",
    location_name: "Austin, TX",
    skills: ["human resources", "recruiting"],
  },
  {
    id: "pdl_person_4",
    full_name: "David Lee",
    first_name: "David",
    last_name: "Lee",
    job_title: "Talent Acquisition Specialist",
    job_company_name: "MegaCorp",
    work_email: "david.lee@megacorp.com",
    linkedin_url: "linkedin.com/in/davidlee",
    location_name: "Seattle, WA",
    skills: ["talent acquisition", "sourcing"],
  },
  {
    id: "pdl_person_5",
    full_name: "Eva Brown",
    first_name: "Eva",
    last_name: "Brown",
    job_title: "Recruiter",
    job_company_name: "InnovateCo",
    work_email: "eva.brown@innovateco.com",
    linkedin_url: "linkedin.com/in/evabrown",
    location_name: "Chicago, IL",
    skills: ["recruiting", "talent management"],
  },
];

const mockCompanyData = {
  id: "pdl_company_1",
  name: "TechCorp",
  display_name: "TechCorp Inc.",
  size: "201-500",
  employee_count: 350,
  founded: 2010,
  industry: "computer software",
  linkedin_url: "linkedin.com/company/techcorp",
  website: "https://techcorp.com",
  location_name: "San Francisco, CA",
  type: "private",
};

// POST /v5/person/search - success (5 mock recruiters)
export const pdlPersonSearchSuccess = http.post(
  `${PDL_BASE_URL}/v5/person/search`,
  () => {
    return HttpResponse.json({
      status: 200,
      data: mockRecruiters,
      total: mockRecruiters.length,
    });
  }
);

// POST /v5/company/search - success (mock company data)
export const pdlCompanySearchSuccess = http.post(
  `${PDL_BASE_URL}/v5/company/search`,
  () => {
    return HttpResponse.json({
      status: 200,
      data: [mockCompanyData],
      total: 1,
    });
  }
);

// POST /v5/person/search - no results
export const pdlPersonSearchNoResults = http.post(
  `${PDL_BASE_URL}/v5/person/search`,
  () => {
    return HttpResponse.json({ data: [], total: 0 });
  }
);

// POST /v5/person/search - rate limit (status 429)
export const pdlPersonSearchRateLimit = http.post(
  `${PDL_BASE_URL}/v5/person/search`,
  () => {
    return new HttpResponse(null, { status: 429 });
  }
);

// POST /v5/person/search - unauthorized (status 401)
export const pdlPersonSearchUnauthorized = http.post(
  `${PDL_BASE_URL}/v5/person/search`,
  () => {
    return new HttpResponse(null, { status: 401 });
  }
);

// POST /v5/person/search - bad request (status 400)
export const pdlPersonSearchBadRequest = http.post(
  `${PDL_BASE_URL}/v5/person/search`,
  () => {
    return new HttpResponse(null, { status: 400 });
  }
);

// Default handlers (success cases) for use in test setup
export const pdlHandlers = [pdlPersonSearchSuccess, pdlCompanySearchSuccess];
