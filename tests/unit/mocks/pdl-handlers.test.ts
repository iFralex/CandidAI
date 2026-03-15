import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../vitest.setup";
import {
  pdlPersonSearchSuccess,
  pdlCompanySearchSuccess,
  pdlPersonSearchNoResults,
  pdlPersonSearchRateLimit,
  pdlPersonSearchUnauthorized,
  pdlPersonSearchBadRequest,
} from "../../mocks/handlers/pdl";

const PDL_BASE_URL = "https://api.peopledatalabs.com";

async function postPersonSearch(body: Record<string, unknown> = {}) {
  return fetch(`${PDL_BASE_URL}/v5/person/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postCompanySearch(body: Record<string, unknown> = {}) {
  return fetch(`${PDL_BASE_URL}/v5/company/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PDL MSW handlers", () => {
  describe("POST /v5/person/search - success", () => {
    beforeEach(() => {
      server.use(pdlPersonSearchSuccess);
    });

    it("returns status 200", async () => {
      const res = await postPersonSearch({ query: { name: "recruiter" } });
      expect(res.status).toBe(200);
    });

    it("returns a list of 5 mock recruiters", async () => {
      const res = await postPersonSearch({ query: { name: "recruiter" } });
      const data = await res.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(5);
    });

    it("returns total equal to 5", async () => {
      const res = await postPersonSearch({ query: { name: "recruiter" } });
      const data = await res.json();
      expect(data.total).toBe(5);
    });

    it("returns recruiters with expected fields", async () => {
      const res = await postPersonSearch({ query: { name: "recruiter" } });
      const data = await res.json();
      const firstRecruiter = data.data[0];
      expect(firstRecruiter).toHaveProperty("id");
      expect(firstRecruiter).toHaveProperty("full_name");
      expect(firstRecruiter).toHaveProperty("job_title");
      expect(firstRecruiter).toHaveProperty("job_company_name");
    });

    it("returns correct status field in body", async () => {
      const res = await postPersonSearch({ query: { name: "recruiter" } });
      const data = await res.json();
      expect(data.status).toBe(200);
    });
  });

  describe("POST /v5/company/search - success", () => {
    beforeEach(() => {
      server.use(pdlCompanySearchSuccess);
    });

    it("returns status 200", async () => {
      const res = await postCompanySearch({ query: { name: "TechCorp" } });
      expect(res.status).toBe(200);
    });

    it("returns company data array", async () => {
      const res = await postCompanySearch({ query: { name: "TechCorp" } });
      const data = await res.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it("returns company with expected fields", async () => {
      const res = await postCompanySearch({ query: { name: "TechCorp" } });
      const data = await res.json();
      const company = data.data[0];
      expect(company).toHaveProperty("id");
      expect(company).toHaveProperty("name");
      expect(company).toHaveProperty("industry");
    });

    it("returns total field", async () => {
      const res = await postCompanySearch({ query: { name: "TechCorp" } });
      const data = await res.json();
      expect(data.total).toBe(1);
    });
  });

  describe("POST /v5/person/search - no results", () => {
    beforeEach(() => {
      server.use(pdlPersonSearchNoResults);
    });

    it("returns status 200", async () => {
      const res = await postPersonSearch({ query: { name: "nonexistent" } });
      expect(res.status).toBe(200);
    });

    it("returns empty data array", async () => {
      const res = await postPersonSearch({ query: { name: "nonexistent" } });
      const data = await res.json();
      expect(data.data).toEqual([]);
    });

    it("returns total: 0", async () => {
      const res = await postPersonSearch({ query: { name: "nonexistent" } });
      const data = await res.json();
      expect(data.total).toBe(0);
    });
  });

  describe("POST /v5/person/search - rate limit", () => {
    beforeEach(() => {
      server.use(pdlPersonSearchRateLimit);
    });

    it("returns status 429", async () => {
      const res = await postPersonSearch({ query: { name: "recruiter" } });
      expect(res.status).toBe(429);
    });
  });

  describe("POST /v5/person/search - unauthorized", () => {
    beforeEach(() => {
      server.use(pdlPersonSearchUnauthorized);
    });

    it("returns status 401", async () => {
      const res = await postPersonSearch({ query: { name: "recruiter" } });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /v5/person/search - bad request", () => {
    beforeEach(() => {
      server.use(pdlPersonSearchBadRequest);
    });

    it("returns status 400", async () => {
      const res = await postPersonSearch({});
      expect(res.status).toBe(400);
    });
  });
});
