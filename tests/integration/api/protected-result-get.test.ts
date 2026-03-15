import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

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

// Route path: users/{userId}/data/results/{resultId}/{details|customizations|unlocked}
// Chain: collection -> doc -> collection -> doc -> collection -> doc -> get
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({
                get: mockDocGet,
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/config", () => ({
  clientConfig: { apiKey: "fake-api-key" },
  serverConfig: {
    cookieName: "CandidAIToken",
    cookieSignatureKeys: ["fake-sig-key"],
    serviceAccount: {},
  },
}));

import { GET } from "@/app/api/protected/result/[resultId]/route";

function makeGetRequest(resultId: string, cookieHeader?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  return new Request(
    `http://localhost:3000/api/protected/result/${resultId}`,
    {
      method: "GET",
      headers,
    }
  );
}

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const detailsData = {
  companyName: "Acme Corp",
  email: {
    subject: "Test Subject",
    body: "Test Body",
    prompt: "Test Prompt",
  },
  recruiter: "Jane Doe",
};

const customizationsData = {
  instructions: "Custom instructions",
  queries: ["query1", "query2"],
};

const unlockedData = {
  prompt: true,
  "generate-email": true,
  "find-recruiter": true,
};

describe("GET /api/protected/result/[resultId]", () => {
  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("happy path - valid resultId", () => {
    it("returns 200 with campaign details when resultId exists in Firestore", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => detailsData })
        .mockResolvedValueOnce({
          exists: true,
          data: () => customizationsData,
        })
        .mockResolvedValueOnce({ exists: true, data: () => unlockedData });

      const req = makeGetRequest("result123", "session=valid-cookie-value");
      const res = await GET(req, { params: { resultId: "result123" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("response contains details and customizations fields", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => detailsData })
        .mockResolvedValueOnce({
          exists: true,
          data: () => customizationsData,
        })
        .mockResolvedValueOnce({ exists: true, data: () => unlockedData });

      const req = makeGetRequest("result123", "session=valid-cookie-value");
      const res = await GET(req, { params: { resultId: "result123" } });
      const body = await res.json();

      expect(body.details).toBeDefined();
      expect(body.customizations).toBeDefined();
    });

    it("details data matches Firestore document content", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => detailsData })
        .mockResolvedValueOnce({
          exists: true,
          data: () => customizationsData,
        })
        .mockResolvedValueOnce({ exists: true, data: () => unlockedData });

      const req = makeGetRequest("result123", "session=valid-cookie-value");
      const res = await GET(req, { params: { resultId: "result123" } });
      const body = await res.json();

      expect(body.details.companyName).toBe("Acme Corp");
      expect(body.details.recruiter).toBe("Jane Doe");
    });

    it("unlocked fields are visible when all unlocked flags are true", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => detailsData })
        .mockResolvedValueOnce({
          exists: true,
          data: () => customizationsData,
        })
        .mockResolvedValueOnce({ exists: true, data: () => unlockedData });

      const req = makeGetRequest("result123", "session=valid-cookie-value");
      const res = await GET(req, { params: { resultId: "result123" } });
      const body = await res.json();

      expect(body.details.email?.prompt).not.toBeNull();
      expect(body.customizations.instructions).not.toBeNull();
      expect(body.customizations.queries).not.toBeNull();
    });

    it("unlocked fields are null when unlocked flags are false", async () => {
      const lockedData = { prompt: false, "generate-email": false, "find-recruiter": false };

      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => detailsData })
        .mockResolvedValueOnce({
          exists: true,
          data: () => customizationsData,
        })
        .mockResolvedValueOnce({ exists: true, data: () => lockedData });

      const req = makeGetRequest("result123", "session=valid-cookie-value");
      const res = await GET(req, { params: { resultId: "result123" } });
      const body = await res.json();

      expect(body.details.email?.prompt).toBeNull();
      expect(body.customizations.instructions).toBeNull();
      expect(body.customizations.queries).toBeNull();
    });
  });

  describe("non-existent resultId", () => {
    it("returns status 404 when the details document does not exist", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: false, data: () => null })
        .mockResolvedValueOnce({ exists: false, data: () => null })
        .mockResolvedValueOnce({ exists: false, data: () => null });

      const req = makeGetRequest(
        "nonexistent-result",
        "session=valid-cookie-value"
      );
      const res = await GET(req, {
        params: { resultId: "nonexistent-result" },
      });

      expect(res.status).toBe(404);
    });

    it("404 response includes an error field", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: false, data: () => null })
        .mockResolvedValueOnce({ exists: false, data: () => null })
        .mockResolvedValueOnce({ exists: false, data: () => null });

      const req = makeGetRequest(
        "nonexistent-result",
        "session=valid-cookie-value"
      );
      const res = await GET(req, {
        params: { resultId: "nonexistent-result" },
      });
      const body = await res.json();

      expect(body.error).toBeTruthy();
    });
  });

  describe("authentication", () => {
    it("returns status 401 when no auth cookie is provided and getTokens returns null", async () => {
      mockGetTokens.mockResolvedValue(null);

      const req = makeGetRequest("result123");
      const res = await GET(req, { params: { resultId: "result123" } });

      expect(res.status).toBe(401);
    });

    it("returns status 401 when getTokens returns null decodedToken", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: null });

      const req = makeGetRequest("result123", "session=invalid-token");
      const res = await GET(req, { params: { resultId: "result123" } });

      expect(res.status).toBe(401);
    });

    it("returns status 401 when getTokens throws an error", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token verification failed"));

      const req = makeGetRequest("result123", "session=expired-token");
      const res = await GET(req, { params: { resultId: "result123" } });

      expect(res.status).toBe(401);
    });
  });
});
