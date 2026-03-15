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
        get: mockDocGet,
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("@/lib/server-auth", () => ({
  requireAuth: vi.fn(),
}));

import { GET } from "@/app/api/protected/user/route";

function makeGetRequest(cookieHeader?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  return new Request("http://localhost:3000/api/protected/user", {
    method: "GET",
    headers,
  });
}

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
  picture: "https://example.com/avatar.jpg",
};

const firestoreUserData = {
  name: "Test User",
  createdAt: "2024-01-01T00:00:00.000Z",
  lastLogin: "2024-01-10T00:00:00.000Z",
  onboardingStep: 3,
  plan: "pro",
  billingType: "monthly",
  credits: 500,
};

describe("GET /api/protected/user", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("happy path", () => {
    it("returns user data from Firestore for a valid auth cookie", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => firestoreUserData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
    });

    it("response contains uid, email, name, emailVerified, onboardingStep, plan, credits, picture, billingType", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: true, data: () => firestoreUserData });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const data = await res.json();

      expect(data.user).toMatchObject({
        uid: "user123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        onboardingStep: 3,
        plan: "pro",
        credits: 500,
        picture: "https://example.com/avatar.jpg",
        billingType: "monthly",
      });
    });
  });

  describe("missing cookie", () => {
    it("returns 401 when no auth cookie is present", async () => {
      // getTokens returns null → tokens?.decodedToken is undefined → uid access throws → 401
      mockGetTokens.mockResolvedValue(null);

      const req = makeGetRequest(); // no Cookie header
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  describe("expired or invalid token", () => {
    it("returns 401 when getTokens throws (expired token)", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token has been revoked"));

      const req = makeGetRequest("session=expired-token");
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns 401 when getTokens returns token with no decodedToken", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: null });

      const req = makeGetRequest("session=malformed-token");
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  describe("user not found in Firestore", () => {
    it("returns 404 when user document does not exist in Firestore", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);

      expect(res.status).toBe(404);
    });

    it("returns error message when user is not found", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const req = makeGetRequest("session=valid-cookie-value");
      const res = await GET(req);
      const data = await res.json();

      expect(data.error).toBeTruthy();
    });
  });
});
