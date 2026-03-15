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

import { GET } from "@/app/api/protected/results/route";

function makeGetRequest(cookieHeader?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  return new Request("http://localhost:3000/api/protected/results", {
    method: "GET",
    headers,
  });
}

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const resultsData = {
  company1: {
    recruiter: "Jane Doe",
    email_sent: null,
    blog_articles: ["article1", "article2"],
    status: "active",
  },
  company2: {
    recruiter: "John Smith",
    email_sent: "2024-01-15T10:00:00.000Z",
    blog_articles: ["article3"],
    status: "sent",
  },
};

describe("GET /api/protected/results", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("happy path - active campaigns", () => {
    it("returns campaign map when user has active campaigns", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => resultsData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it("response data contains company map with recruiter, email_sent, blog_articles fields", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => resultsData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(body.data).toMatchObject({
        company1: expect.objectContaining({
          recruiter: expect.any(String),
          blog_articles: expect.any(Array),
        }),
        company2: expect.objectContaining({
          recruiter: expect.any(String),
          email_sent: expect.any(String),
          blog_articles: expect.any(Array),
        }),
      });
    });

    it("data keys are company IDs mapping to campaign objects", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => resultsData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(Object.keys(body.data)).toContain("company1");
      expect(Object.keys(body.data)).toContain("company2");
    });
  });

  describe("user without campaigns", () => {
    it("returns empty object when the data/results document does not exist", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({});
    });

    it("returns success true with empty data when no campaigns exist", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(typeof body.data).toBe("object");
      expect(Object.keys(body.data)).toHaveLength(0);
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

    it("returns status 401 when tokens have no decodedToken", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: null });

      const req = makeGetRequest("session=invalid-token");
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  describe("Firestore error handling", () => {
    it("returns status 500 when Firestore is inaccessible", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockRejectedValue(new Error("Firestore unavailable"));

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);

      expect(res.status).toBe(500);
    });

    it("returns an error message when Firestore is inaccessible", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockRejectedValue(new Error("DEADLINE_EXCEEDED"));

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(body.error).toBeTruthy();
    });
  });
});
