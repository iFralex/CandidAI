import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockGetTokens, mockBatchUpdate, mockBatchCommit, mockRedirect } = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockRedirect: vi.fn(),
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

import { submitQueries } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

describe("submitQueries server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
    mockRedirect.mockReturnValue(undefined);
  });

  describe("happy path", () => {
    it("saves queries to data/account.queries and updates onboardingStep=5", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const queries = { strategy: "domain", keywords: ["engineer", "developer"] };

      await expect(submitQueries(queries)).resolves.not.toThrow();

      // account doc must be updated with queries payload
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries }
      );

      // user doc must be updated with onboardingStep=5
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 5 }
      );

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("commits the batch exactly once per call", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await submitQueries({ strategy: "domain" });

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("redirects to /dashboard after successful commit", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await submitQueries({ strategy: "domain" });

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("saves exactly the passed queries object — no extra fields added", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const queries = { strategy: "domain", keywords: ["recruiter"] };

      await submitQueries(queries);

      const queriesUpdateCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "queries" in data
      );
      expect(queriesUpdateCall).toBeDefined();
      expect(queriesUpdateCall![1].queries).toEqual(queries);
    });

    it("saves queries with strategy='linkedin' correctly", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const queries = { strategy: "linkedin", criteria: [{ key: "title", value: ["engineer"] }] };

      await submitQueries(queries);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries }
      );
    });

    it("saves queries as an array of strategy objects", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const queries = [
        { strategy: "domain", criteria: [] },
        { strategy: "linkedin", criteria: [] },
      ];

      await submitQueries(queries);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries }
      );
    });
  });

  describe("empty queries — default behavior (no validation)", () => {
    it("saves empty object as queries without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(submitQueries({})).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries: {} }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("saves null as queries without error (no validation gate)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(submitQueries(null)).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries: null }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("saves empty array as queries without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(submitQueries([])).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries: [] }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("still updates onboardingStep=5 even with empty queries", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await submitQueries({});

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 5 }
      );
    });
  });

  describe("invalid strategy — default behavior (no validation)", () => {
    it("saves queries with invalid strategy value without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const queries = { strategy: "invalid_strategy_xyz" };

      await expect(submitQueries(queries)).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries }
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("saves queries with unknown fields without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const queries = { unknownField: 42, anotherField: "test" };

      await expect(submitQueries(queries)).resolves.not.toThrow();

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries }
      );
    });

    it("saves malformed queries object without error (no schema validation)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const queries = { strategy: 12345, criteria: "not-an-array" };

      await expect(submitQueries(queries)).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });
  });

  describe("authentication", () => {
    it("throws when user is not authenticated (null tokens)", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(
        submitQueries({ strategy: "domain" })
      ).rejects.toThrow();
    });

    it("does not call Firestore batch when user is not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await submitQueries({ strategy: "domain" });
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("throws when getTokens rejects", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token invalid"));

      await expect(
        submitQueries({ strategy: "domain" })
      ).rejects.toThrow();
    });

    it("throws when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      await expect(
        submitQueries({ strategy: "domain" })
      ).rejects.toThrow("Email not verified");
    });
  });
});
