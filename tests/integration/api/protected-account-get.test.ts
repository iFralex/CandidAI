import { describe, it, expect, vi, afterEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockGetTokens, mockDocGet } = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockDocGet: vi.fn(),
}));

vi.mock("next-firebase-auth-edge", () => ({
  getTokens: mockGetTokens,
  getApiRequestTokens: vi.fn(),
}));

vi.mock("next-firebase-auth-edge/next/cookies", () => ({
  refreshCookiesWithIdToken: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: mockDocGet,
          }),
        }),
        get: mockDocGet,
      }),
    }),
  },
}));

vi.mock("@/lib/server-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/config", () => ({
  clientConfig: { apiKey: "fake-api-key" },
  serverConfig: {
    cookieName: "CandidAIToken",
    cookieSignatureKeys: ["fake-sig-key"],
    serviceAccount: {},
  },
}));

import { GET } from "@/app/api/protected/account/route";

function makeGetRequest(cookieHeader?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  return new Request("http://localhost:3000/api/protected/account", {
    method: "GET",
    headers,
  });
}

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const accountData = {
  companies: ["Acme Corp", "TechCorp"],
  profileSummary: "Experienced software engineer",
  queries: ["query1", "query2"],
  customizations: { tone: "professional", language: "en" },
};

describe("GET /api/protected/account", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("happy path", () => {
    it("returns account data for a valid auth request", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => accountData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it("response data contains companies, profileSummary, queries, and customizations", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => accountData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(body.data).toMatchObject({
        companies: expect.any(Array),
        profileSummary: "Experienced software engineer",
        queries: expect.any(Array),
        customizations: expect.any(Object),
      });
    });

    it("companies field is an array in the valid response", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => accountData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(Array.isArray(body.data.companies)).toBe(true);
    });

    it("companies can be an empty array in a valid response", async () => {
      const emptyAccountData = { ...accountData, companies: [] };
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => emptyAccountData,
      });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(Array.isArray(body.data.companies)).toBe(true);
      expect(body.data.companies).toHaveLength(0);
    });
  });

  describe("missing account document", () => {
    it("returns 404 when the data/account document does not exist", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);

      expect(res.status).toBe(404);
    });

    it("does not crash when data/account document is missing (returns proper JSON)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(body).toBeDefined();
      expect(body.error).toBeTruthy();
    });
  });

  describe("authentication", () => {
    it("returns status 401 when no auth cookie is provided", async () => {
      mockGetTokens.mockResolvedValue(null);

      const req = makeGetRequest();
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns status 401 when getTokens throws (expired or invalid token)", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token has been revoked"));

      const req = makeGetRequest("session=expired-token");
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });
});
