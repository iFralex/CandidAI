import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockCookiesGet,
  mockPreviewGet,
  mockUserUpdate,
  mockRecordOnboardingTransition,
  mockRecordOnboardingSignal,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockCookiesGet: vi.fn(),
  mockPreviewGet: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockRecordOnboardingTransition: vi.fn(),
  mockRecordOnboardingSignal: vi.fn(),
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
    get: mockCookiesGet,
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/onboarding-lifecycle", () => ({
  recordOnboardingTransition: mockRecordOnboardingTransition,
  recordOnboardingSignal: mockRecordOnboardingSignal,
}));

// Firestore mock shaped for advanceToProfileReview:
//   users/{uid} -> userRef { update: mockUserUpdate }
//     .collection("data").doc("onboarding_preview") -> previewRef { get: mockPreviewGet }
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "users") {
        return {
          doc: vi.fn().mockReturnValue({
            update: mockUserUpdate,
            collection: vi.fn().mockReturnValue({
              doc: vi.fn((docName: string) => {
                if (docName === "onboarding_preview") return { get: mockPreviewGet };
                return {};
              }),
            }),
          }),
        };
      }
      return { doc: vi.fn().mockReturnValue({}) };
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
  creditsInfo: {},
}));

import { advanceToProfileReview } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const snap = (data: Record<string, any> | undefined) => ({ data: () => data });

describe("advanceToProfileReview server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockCookiesGet.mockReturnValue(undefined);
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
    mockUserUpdate.mockResolvedValue(undefined);
  });

  describe("profileStatus:'completed'", () => {
    beforeEach(() => {
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "completed" }));
    });

    it("updates the user doc with onboardingStage:'profile_review' and onboardingStep:3", async () => {
      await advanceToProfileReview();

      expect(mockUserUpdate).toHaveBeenCalledWith({
        onboardingStage: "profile_review",
        onboardingStep: 3,
      });
    });

    it("returns { success: true }", async () => {
      const result = await advanceToProfileReview();
      expect(result).toEqual({ success: true });
    });
  });

  describe("profileStatus:'running' — job still in progress", () => {
    beforeEach(() => {
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "running" }));
    });

    it("does NOT update the user doc's stage", async () => {
      await advanceToProfileReview();

      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("still returns { success: true } (no-op, not an error)", async () => {
      const result = await advanceToProfileReview();
      expect(result).toEqual({ success: true });
    });
  });

  describe("no preview doc at all", () => {
    beforeEach(() => {
      mockPreviewGet.mockResolvedValue(snap(undefined));
    });

    it("does NOT update the user doc's stage", async () => {
      await advanceToProfileReview();

      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe("authentication", () => {
    it("throws when tokens are null", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(advanceToProfileReview()).rejects.toThrow();
    });

    it("does not touch Firestore when unauthenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await advanceToProfileReview();
      } catch {
        // expected
      }
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });
});
