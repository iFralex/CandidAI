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

describe("completeOnboarding server action - free plan", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
    mockRedirect.mockReturnValue(undefined);
    // Replace global fetch with mock
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("happy path — free_trial", () => {
    it("saves customizations to account doc and updates onboardingStep", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const customizations = { instructions: "Be professional", tone: "formal" };

      await expect(completeOnboarding(customizations)).resolves.not.toThrow();

      // account doc must be updated with customizations
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );

      // user doc must be updated with onboardingStep
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: expect.any(Number) }
      );

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("commits the batch exactly once", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "Be concise" });

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("redirects to /dashboard after successful commit", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "Test instructions" });

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("saves exactly the passed customizations object — no extra fields added", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const customizations = { instructions: "Custom text", style: "casual" };

      await completeOnboarding(customizations);

      const customizationsUpdateCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "customizations" in data
      );
      expect(customizationsUpdateCall).toBeDefined();
      expect(customizationsUpdateCall![1].customizations).toEqual(customizations);
    });

    it("saves customizations with only instructions field", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const customizations = { instructions: "Be professional" };

      await completeOnboarding(customizations);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );
    });

    it("saves empty customizations object without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(completeOnboarding({})).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations: {} }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("saves null customizations without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(completeOnboarding(null)).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations: null }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });
  });

  describe("unreachable SERVER_RUNNER_URL — graceful handling", () => {
    it("action completes successfully even when SERVER_RUNNER_URL is unreachable (fetch rejects)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      // Simulate unreachable server
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      // completeOnboarding does not call startServer directly,
      // so the fetch error should not affect the action
      await expect(completeOnboarding({ instructions: "Test" })).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("action completes successfully even when SERVER_RUNNER_URL returns 503", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockResolvedValue({ ok: false, status: 503 });

      await expect(completeOnboarding({ instructions: "Test" })).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("Firestore batch commits regardless of fetch availability", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockRejectedValue(new TypeError("Network request failed"));

      await completeOnboarding({ instructions: "Be formal" });

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations: { instructions: "Be formal" } }
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

    it("does not call Firestore batch when user is not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await completeOnboarding({ instructions: "Test" });
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("throws when getTokens rejects", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token invalid"));

      await expect(
        completeOnboarding({ instructions: "Test" })
      ).rejects.toThrow();
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
