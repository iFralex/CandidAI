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

describe("completeOnboarding server action - validation edge cases", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
    mockRedirect.mockReturnValue(undefined);
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("excessively long instructions (> 2000 chars)", () => {
    it("saves instructions longer than 2000 chars without throwing", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const longInstructions = "A".repeat(2001);
      const customizations = { instructions: longInstructions };

      await expect(completeOnboarding(customizations)).resolves.not.toThrow();
    });

    it("persists the full long instructions string to Firestore", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const longInstructions = "B".repeat(2001);
      const customizations = { instructions: longInstructions };

      await completeOnboarding(customizations);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );

      const customizationsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "customizations" in data
      );
      expect(customizationsCall![1].customizations.instructions).toHaveLength(2001);
    });

    it("still commits the batch and redirects to /dashboard with long instructions", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const longInstructions = "C".repeat(5000);

      await completeOnboarding({ instructions: longInstructions });

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("saves instructions of exactly 2000 chars without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const borderlineInstructions = "D".repeat(2000);

      await expect(
        completeOnboarding({ instructions: borderlineInstructions })
      ).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("saves instructions of exactly 2001 chars (boundary +1) without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const justOverLimit = "E".repeat(2001);

      await expect(
        completeOnboarding({ instructions: justOverLimit })
      ).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });
  });

  describe("empty instructions", () => {
    it("saves empty string instructions without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const customizations = { instructions: "" };

      await expect(completeOnboarding(customizations)).resolves.not.toThrow();
    });

    it("persists empty string instructions to Firestore as empty string", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const customizations = { instructions: "" };

      await completeOnboarding(customizations);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );

      const customizationsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "customizations" in data
      );
      expect(customizationsCall![1].customizations.instructions).toBe("");
    });

    it("commits the batch and redirects with empty string instructions", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await completeOnboarding({ instructions: "" });

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("saves whitespace-only instructions without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const customizations = { instructions: "   " };

      await expect(completeOnboarding(customizations)).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("saves customizations object with no instructions field without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const customizations = { tone: "formal" };

      await expect(completeOnboarding(customizations)).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("saves undefined instructions field without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const customizations = { instructions: undefined };

      await expect(completeOnboarding(customizations)).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });
  });
});
