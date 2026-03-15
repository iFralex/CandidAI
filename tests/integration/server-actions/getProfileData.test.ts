import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockUserGet,
  mockAccountGet,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockUserGet: vi.fn(),
  mockAccountGet: vi.fn(),
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Firestore chain:
//   level1: collection("users").doc(userId)
//     .get() → mockUserGet
//   level2: .collection("data").doc("account")
//     .get() → mockAccountGet
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: mockUserGet,
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: mockAccountGet,
          }),
        }),
      }),
    }),
  },
  adminAuth: {},
  adminStorage: {},
}));

vi.mock("@/config", () => ({
  clientConfig: { apiKey: "fake-api-key" },
  serverConfig: {
    cookieName: "CandidAIToken",
    cookieSignatureKeys: ["fake-sig-key"],
    serviceAccount: {},
  },
  plansData: {
    free_trial: { credits: 0, maxCompanies: 1 },
    base: { credits: 0, maxCompanies: 20 },
    pro: { credits: 1000, maxCompanies: 50 },
    ultra: { credits: 2500, maxCompanies: 100 },
  },
  creditsInfo: {
    "find-recruiter": { cost: 100 },
    "generate-email": { cost: 50 },
    "change-company": { cost: 70 },
  },
}));

import { getProfileData } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const makeUserSnap = (data: Record<string, unknown>) => ({
  exists: true,
  data: () => data,
});

const makeAccountSnap = (data: Record<string, unknown>) => ({
  exists: true,
  data: () => data,
});

const makeEmptySnap = () => ({
  exists: false,
  data: () => undefined,
});

describe("getProfileData server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
  });

  describe("authenticated user — returns profile data from Firestore", () => {
    it("returns name, picture, plan, and account for an authenticated user", async () => {
      mockUserGet.mockResolvedValue(
        makeUserSnap({ name: "Alice", picture: "https://cdn.example.com/pic.jpg", plan: "pro" })
      );
      mockAccountGet.mockResolvedValue(
        makeAccountSnap({ credits: 1000, email: "alice@example.com" })
      );

      const result = await getProfileData();

      expect(result).toMatchObject({
        name: "Alice",
        picture: "https://cdn.example.com/pic.jpg",
        plan: "pro",
        account: { credits: 1000, email: "alice@example.com" },
      });
    });

    it("returns name from user doc", async () => {
      mockUserGet.mockResolvedValue(
        makeUserSnap({ name: "Bob", plan: "base" })
      );
      mockAccountGet.mockResolvedValue(makeAccountSnap({}));

      const result = await getProfileData();

      expect(result.name).toBe("Bob");
    });

    it("returns plan from user doc", async () => {
      mockUserGet.mockResolvedValue(
        makeUserSnap({ name: "Bob", plan: "ultra" })
      );
      mockAccountGet.mockResolvedValue(makeAccountSnap({}));

      const result = await getProfileData();

      expect(result.plan).toBe("ultra");
    });

    it("returns account data from account doc", async () => {
      const accountData = { credits: 500, email: "bob@example.com", onboardingStep: 50 };
      mockUserGet.mockResolvedValue(makeUserSnap({ name: "Bob", plan: "base" }));
      mockAccountGet.mockResolvedValue(makeAccountSnap(accountData));

      const result = await getProfileData();

      expect(result.account).toEqual(accountData);
    });
  });

  describe("user without picture — returns null", () => {
    it("returns picture as null when user doc has no picture field", async () => {
      mockUserGet.mockResolvedValue(
        makeUserSnap({ name: "Alice", plan: "free_trial" })
      );
      mockAccountGet.mockResolvedValue(makeAccountSnap({}));

      const result = await getProfileData();

      expect(result.picture).toBeNull();
    });

    it("returns picture as null when user doc has picture set to empty string", async () => {
      mockUserGet.mockResolvedValue(
        makeUserSnap({ name: "Alice", picture: "", plan: "free_trial" })
      );
      mockAccountGet.mockResolvedValue(makeAccountSnap({}));

      const result = await getProfileData();

      expect(result.picture).toBeNull();
    });

    it("returns empty string for name when user doc has no name", async () => {
      mockUserGet.mockResolvedValue(makeUserSnap({ plan: "free_trial" }));
      mockAccountGet.mockResolvedValue(makeAccountSnap({}));

      const result = await getProfileData();

      expect(result.name).toBe("");
    });

    it("returns free_trial as default plan when user doc has no plan", async () => {
      mockUserGet.mockResolvedValue(makeUserSnap({ name: "Alice" }));
      mockAccountGet.mockResolvedValue(makeAccountSnap({}));

      const result = await getProfileData();

      expect(result.plan).toBe("free_trial");
    });

    it("returns empty object as account when account doc does not exist", async () => {
      mockUserGet.mockResolvedValue(makeUserSnap({ name: "Alice", plan: "base" }));
      mockAccountGet.mockResolvedValue(makeEmptySnap());

      const result = await getProfileData();

      expect(result.account).toEqual({});
    });
  });

  describe("unauthenticated user — throws error", () => {
    it("throws when getTokens returns null", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(getProfileData()).rejects.toThrow();
    });

    it("throws when uid is missing from decoded token", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { uid: undefined, email: "test@example.com", email_verified: true },
      });

      await expect(getProfileData()).rejects.toThrow();
    });

    it("throws when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      await expect(getProfileData()).rejects.toThrow("Email not verified");
    });
  });
});
