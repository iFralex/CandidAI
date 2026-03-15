import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockGetTokens, mockBatchUpdate, mockBatchCommit, mockRedirect, mockFetch } = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockRedirect: vi.fn(),
  mockFetch: vi.fn(),
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
  redirect: mockRedirect,
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({}),
        }),
      }),
    }),
    batch: vi.fn().mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
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

import { completeOnboarding } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

describe("completeOnboarding server action - paid plan", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
    mockRedirect.mockReturnValue(undefined);
    vi.stubGlobal("fetch", mockFetch);
  });

  describe.each([
    { plan: "base" },
    { plan: "pro" },
    { plan: "ultra" },
  ])("paid plan: $plan", ({ plan }) => {
    it(`saves customizations and sets onboardingStep=6 for ${plan} plan`, async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      const customizations = { instructions: `Test instructions for ${plan}`, tone: "formal" };

      await expect(completeOnboarding(customizations)).resolves.not.toThrow();

      // account doc must be updated with customizations
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );

      // user doc must be set to onboardingStep=6 (wait for payment, not 50)
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 6 }
      );

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it(`does NOT call startServer (fetch) during completeOnboarding for ${plan} plan`, async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "Some instructions" });

      // startServer calls global fetch — must NOT be invoked from completeOnboarding
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it(`redirects to /dashboard after completeOnboarding for ${plan} plan`, async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "Test instructions" });

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("onboardingStep=6 is 'wait for payment', not step 50", () => {
    it("sets onboardingStep to exactly 6, not 50 (step 50 is set by Stripe webhook after payment)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "paid plan user" });

      const onboardingStepCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "onboardingStep" in data
      );
      expect(onboardingStepCall).toBeDefined();
      expect(onboardingStepCall![1].onboardingStep).toBe(6);
    });

    it("startServer is NOT called by completeOnboarding — Stripe webhook is responsible for triggering it", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "Test" });

      // completeOnboarding must NOT trigger startServer for paid plans.
      // startServer is called from the Stripe webhook (payment_intent.succeeded)
      // after the user completes payment, setting onboardingStep=50.
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("batch commit behavior", () => {
    it("commits batch exactly once per call", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "Be concise" });

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("performs exactly 2 batch updates (account customizations + user onboardingStep)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "Test" });

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    });

    it("saves the exact customizations object passed — no extra fields", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      const customizations = { instructions: "Be formal", tone: "professional", style: "concise" };

      await completeOnboarding(customizations);

      const customizationsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "customizations" in data
      );
      expect(customizationsCall).toBeDefined();
      expect(customizationsCall![1].customizations).toEqual(customizations);
    });

    it("saves empty customizations without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(completeOnboarding({})).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations: {} }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });
  });

  describe("authentication", () => {
    it("throws when user is not authenticated (null tokens)", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(
        completeOnboarding({ instructions: "Test" })
      ).rejects.toThrow();
    });

    it("does not call Firestore batch when unauthenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await completeOnboarding({ instructions: "Test" });
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("throws when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      await expect(
        completeOnboarding({ instructions: "Test" })
      ).rejects.toThrow("Email not verified");
    });
  });
});
