import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockGetTokens, mockBatchUpdate, mockBatchCommit } = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
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

import { selectPlan } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

describe("selectPlan server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
  });

  describe("happy path - valid plans", () => {
    it('selectPlan("free_trial") updates onboardingStep=2 in Firestore and completes without error', async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(selectPlan("free_trial")).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ onboardingStep: 2, plan: "free_trial" })
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it('selectPlan("base") updates onboardingStep=2', async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(selectPlan("base")).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ onboardingStep: 2, plan: "base" })
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it('selectPlan("pro") updates onboardingStep=2', async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(selectPlan("pro")).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ onboardingStep: 2, plan: "pro" })
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it('selectPlan("ultra") updates onboardingStep=2', async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(selectPlan("ultra")).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ onboardingStep: 2, plan: "ultra" })
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("plan credits are included in the Firestore update for pro plan", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await selectPlan("pro");

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ credits: 1000 })
      );
    });

    it("plan credits are included in the Firestore update for ultra plan", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await selectPlan("ultra");

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ credits: 2500 })
      );
    });
  });

  describe("error cases - unknown plan", () => {
    it('selectPlan("unknown") throws an error due to missing plan data', async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(selectPlan("unknown")).rejects.toThrow();
    });

    it("batch commit is not called when plan is unknown", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      try {
        await selectPlan("unknown");
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });

  describe("authentication", () => {
    it("throws authentication error when user is not authenticated (null tokens)", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(selectPlan("free_trial")).rejects.toThrow();
    });

    it("throws authentication error when getTokens rejects", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token invalid"));

      await expect(selectPlan("free_trial")).rejects.toThrow();
    });

    it("does not call Firestore batch when user is not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await selectPlan("free_trial");
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("throws when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      await expect(selectPlan("free_trial")).rejects.toThrow("Email not verified");
    });
  });
});
