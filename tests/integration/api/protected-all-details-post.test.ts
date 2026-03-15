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

// Route uses: adminDb.collection('users').doc(uid).collection('data').doc('results').collection(companyId).doc('details').get()
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

import { POST } from "@/app/api/protected/all_details/route";

function makeRequest(body: Record<string, unknown>, cookieHeader?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  return new Request("http://localhost:3000/api/protected/all_details", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const company1Details = {
  recruiter: "Jane Doe",
  email: "jane@company1.com",
  position: "Engineering Manager",
};

const company2Details = {
  recruiter: "John Smith",
  email: "john@company2.com",
  position: "Technical Lead",
};

describe("POST /api/protected/all_details", () => {
  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("happy path - multiple companies", () => {
    it("returns details for both companies when companyIds has two entries", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => company1Details })
        .mockResolvedValueOnce({ exists: true, data: () => company2Details });

      const req = makeRequest(
        { companyIds: ["company1", "company2"] },
        "session=valid-cookie-value"
      );
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("response data contains companyId and data fields for each entry", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => company1Details })
        .mockResolvedValueOnce({ exists: true, data: () => company2Details });

      const req = makeRequest(
        { companyIds: ["company1", "company2"] },
        "session=valid-cookie-value"
      );
      const res = await POST(req);
      const body = await res.json();

      expect(body.data[0].companyId).toBe("company1");
      expect(body.data[0].data).toMatchObject(company1Details);
      expect(body.data[1].companyId).toBe("company2");
      expect(body.data[1].data).toMatchObject(company2Details);
    });
  });

  describe("non-existent companyId", () => {
    it("returns empty data object for a non-existent companyId without crashing", async () => {
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeRequest(
        { companyIds: ["unknown-company"] },
        "session=valid-cookie-value"
      );
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].companyId).toBe("unknown-company");
      expect(body.data[0].data).toEqual({});
    });

    it("handles mix of existing and non-existing companyIds without crashing", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => company1Details })
        .mockResolvedValueOnce({ exists: false, data: () => null });

      const req = makeRequest(
        { companyIds: ["company1", "nonexistent"] },
        "session=valid-cookie-value"
      );
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].data).toMatchObject(company1Details);
      expect(body.data[1].data).toEqual({});
    });
  });

  describe("empty companyIds array", () => {
    it("returns 400 when companyIds is an empty array", async () => {
      const req = makeRequest({ companyIds: [] }, "session=valid-cookie-value");
      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  describe("non-array companyIds", () => {
    it("returns 400 when companyIds is a string", async () => {
      const req = makeRequest(
        { companyIds: "company1" },
        "session=valid-cookie-value"
      );
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when companyIds is an object", async () => {
      const req = makeRequest(
        { companyIds: { id: "company1" } },
        "session=valid-cookie-value"
      );
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when companyIds is missing from body", async () => {
      const req = makeRequest({}, "session=valid-cookie-value");
      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  describe("authentication", () => {
    it("returns 401 when no auth cookie is provided and getTokens returns null", async () => {
      mockGetTokens.mockResolvedValue(null);

      const req = makeRequest({ companyIds: ["company1"] });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("returns 401 when getTokens returns null decodedToken", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: null });

      const req = makeRequest(
        { companyIds: ["company1"] },
        "session=invalid-token"
      );
      const res = await POST(req);

      expect(res.status).toBe(401);
    });
  });
});
