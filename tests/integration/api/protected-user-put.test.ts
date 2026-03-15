import { describe, it, expect, vi, afterEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockRequireAuth, mockDocUpdate } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockDocUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/server-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        update: mockDocUpdate,
        get: vi.fn(),
        set: vi.fn(),
      }),
    }),
  },
}));

vi.mock("next-firebase-auth-edge", () => ({
  getTokens: vi.fn(),
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

vi.mock("@/config", () => ({
  clientConfig: { apiKey: "fake-api-key" },
  serverConfig: {
    cookieName: "CandidAIToken",
    cookieSignatureKeys: ["fake-sig-key"],
    serviceAccount: {},
  },
}));

import { PUT } from "@/app/api/protected/user/route";

function makePutRequest(body: Record<string, unknown>, withAuth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (withAuth) {
    headers["authToken"] = "valid-token";
  }
  return new Request("http://localhost:3000/api/protected/user", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
};

describe("PUT /api/protected/user", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockDocUpdate.mockResolvedValue(undefined);
  });

  describe("happy path", () => {
    it("updates Firestore name and updatedAt, returning { success: true }", async () => {
      mockRequireAuth.mockResolvedValue(validDecodedToken);

      const req = makePutRequest({ name: "New Name" });
      const res = await PUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("calls Firestore update with trimmed name and updatedAt timestamp", async () => {
      mockRequireAuth.mockResolvedValue(validDecodedToken);

      const req = makePutRequest({ name: "  New Name  " });
      await PUT(req);

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Name",
          updatedAt: expect.any(String),
        })
      );
    });

    it("updatedAt is a valid ISO timestamp", async () => {
      mockRequireAuth.mockResolvedValue(validDecodedToken);

      const req = makePutRequest({ name: "New Name" });
      await PUT(req);

      const updateArg = mockDocUpdate.mock.calls[0][0];
      expect(() => new Date(updateArg.updatedAt)).not.toThrow();
      expect(new Date(updateArg.updatedAt).toISOString()).toBe(
        updateArg.updatedAt
      );
    });
  });

  describe("validation errors", () => {
    it("returns status 400 for empty string name", async () => {
      mockRequireAuth.mockResolvedValue(validDecodedToken);

      const req = makePutRequest({ name: "" });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });

    it("returns status 400 for whitespace-only name", async () => {
      mockRequireAuth.mockResolvedValue(validDecodedToken);

      const req = makePutRequest({ name: "   " });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });

    it("accepts excessively long name (no server-side length validation in current implementation)", async () => {
      // The current implementation does not validate maximum name length.
      // This test documents the actual behavior: long names are accepted.
      mockRequireAuth.mockResolvedValue(validDecodedToken);

      const longName = "A".repeat(500);
      const req = makePutRequest({ name: longName });
      const res = await PUT(req);

      expect(res.status).toBe(200);
    });
  });

  describe("authentication", () => {
    it("returns status 401 when no auth token is provided", async () => {
      mockRequireAuth.mockRejectedValue(
        new Error("No authentication token provided")
      );

      const req = makePutRequest({ name: "New Name" }, false);
      const res = await PUT(req);

      expect(res.status).toBe(401);
    });

    it("returns status 401 for invalid or expired token", async () => {
      mockRequireAuth.mockRejectedValue(
        new Error("Invalid authentication token")
      );

      const req = makePutRequest({ name: "New Name" });
      const res = await PUT(req);

      expect(res.status).toBe(401);
    });
  });

  describe("Firestore field isolation", () => {
    it("update call contains only name and updatedAt (does not overwrite credits or plan)", async () => {
      mockRequireAuth.mockResolvedValue(validDecodedToken);

      const req = makePutRequest({ name: "New Name" });
      await PUT(req);

      const updateArg = mockDocUpdate.mock.calls[0][0];
      // Firestore update() only modifies specified fields; verify only name+updatedAt are set
      expect(Object.keys(updateArg)).toEqual(
        expect.arrayContaining(["name", "updatedAt"])
      );
      expect(updateArg).not.toHaveProperty("credits");
      expect(updateArg).not.toHaveProperty("plan");
      expect(updateArg).not.toHaveProperty("email");
      expect(updateArg).not.toHaveProperty("billingType");
    });
  });
});
