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

import { GET } from "@/app/api/protected/emails/route";

function makeGetRequest(cookieHeader?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  return new Request("http://localhost:3000/api/protected/emails", {
    method: "GET",
    headers,
  });
}

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const emailsData = {
  companyA: "Dear John,\n\nWe are pleased to invite you...",
  companyB: "Hello,\n\nWe have reviewed your profile...",
};

describe("GET /api/protected/emails", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("user with generated emails", () => {
    it("returns email map with companyId keys and email content values", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => emailsData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toBeDefined();
      expect(body.data).toMatchObject({
        companyA: expect.any(String),
        companyB: expect.any(String),
      });
    });

    it("returns userId matching the authenticated user", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => emailsData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(body.userId).toBe(validDecodedToken.uid);
    });

    it("response has data and userId fields as per { data: { [companyId]: emailContent }, userId } shape", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => emailsData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(Object.keys(body)).toContain("data");
      expect(Object.keys(body)).toContain("userId");
    });
  });

  describe("user without generated emails", () => {
    it("returns empty data object when no email document exists", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual({});
    });

    it("returns userId even when no emails exist", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(body.userId).toBe(validDecodedToken.uid);
    });

    it("response has { data: {}, userId } shape when user has no emails", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const body = await res.json();

      expect(body.data).toEqual({});
      expect(body.userId).toBe(validDecodedToken.uid);
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
});
