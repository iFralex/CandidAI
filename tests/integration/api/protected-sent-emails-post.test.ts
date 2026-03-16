import { describe, it, expect, vi, afterEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockGetTokens, mockBatchUpdate, mockBatchCommit, mockAdminDoc } =
  vi.hoisted(() => ({
    mockGetTokens: vi.fn(),
    mockBatchUpdate: vi.fn(),
    mockBatchCommit: vi.fn().mockResolvedValue(undefined),
    mockAdminDoc: vi.fn().mockReturnValue({}),
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
    batch: vi.fn().mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
    doc: mockAdminDoc,
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

import { POST } from "@/app/api/protected/sent_emails/route";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
};

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/protected/sent_emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/protected/sent_emails", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  describe("happy path", () => {
    it("returns { success: true } when ids are valid and auth passes", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: ["company1", "company2"] });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("calls batch.update for results, emails, and details for each id", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: ["company1", "company2"] });
      await POST(req);

      // 3 updates per company id: results, emails, details
      expect(mockBatchUpdate).toHaveBeenCalledTimes(6);
    });

    it("calls batch.commit once after all updates", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: ["company1"] });
      await POST(req);

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("email_sent value passed to batch.update is a valid ISO timestamp string", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: ["company1"] });
      await POST(req);

      const updateCalls = mockBatchUpdate.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);

      // Each update call: (docRef, { field: timestamp })
      for (const [, updateData] of updateCalls) {
        const values = Object.values(updateData as Record<string, unknown>);
        expect(values.length).toBe(1);
        const timestamp = values[0] as string;
        expect(typeof timestamp).toBe("string");
        expect(() => new Date(timestamp)).not.toThrow();
        expect(new Date(timestamp).toISOString()).toBe(timestamp);
      }
    });

    it("batch.update uses dot-notation keys and does not overwrite other fields", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: ["company1"] });
      await POST(req);

      const updateCalls = mockBatchUpdate.mock.calls;
      for (const [, updateData] of updateCalls) {
        const keys = Object.keys(updateData as Record<string, unknown>);
        // Only one field per update call (dot-notation path for email_sent)
        expect(keys.length).toBe(1);
        expect(keys[0]).toMatch(/email_sent/);
      }
    });

    it("uses correct Firestore paths derived from authenticated uid", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: ["company1"] });
      await POST(req);

      const docPaths = mockAdminDoc.mock.calls.map(
        ([path]: [string]) => path
      );
      expect(docPaths).toContain("users/user123/data/results");
      expect(docPaths).toContain("users/user123/data/emails");
      expect(docPaths).toContain(
        "users/user123/data/results/company1/details"
      );
    });
  });

  describe("empty ids array", () => {
    it("returns { success: true } for empty ids array without calling batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: [] });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockBatchUpdate).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });

  describe("non-existent id handling", () => {
    it("handles gracefully when batch.commit throws (e.g. non-existent document)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockRejectedValue(new Error("NOT_FOUND: Document does not exist"));

      const req = makePostRequest({ ids: ["non-existent-id"] });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("validation", () => {
    it("returns status 400 when ids is not an array", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: "company1" });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns status 400 when ids is a string (not array)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: "company1,company2" });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns status 400 when ids is an object (not array)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const req = makePostRequest({ ids: { 0: "company1" } });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  describe("authentication", () => {
    it("returns status 401 when no auth token is provided (getTokens returns null)", async () => {
      mockGetTokens.mockResolvedValue(null);

      const req = makePostRequest({ ids: ["company1"] });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("returns status 401 when auth token is invalid or expired (getTokens throws)", async () => {
      mockGetTokens.mockRejectedValue(new Error("Invalid authentication token"));

      const req = makePostRequest({ ids: ["company1"] });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });
  });
});
