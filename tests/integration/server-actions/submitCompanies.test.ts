import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockGetTokens, mockBatchSet, mockBatchUpdate, mockBatchCommit, mockUserGet } = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockUserGet: vi.fn(),
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
        get: mockUserGet,
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({}),
        }),
      }),
    }),
    batch: vi.fn().mockReturnValue({
      set: mockBatchSet,
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

import { submitCompanies } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

describe("submitCompanies server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
    // Default: pro plan (maxCompanies=50) — doesn't affect small-array happy-path tests
    mockUserGet.mockResolvedValue({ data: () => ({ plan: "pro" }) });
  });

  describe("happy path", () => {
    it("saves companies to data/account.companies and updates onboardingStep=3", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(
        submitCompanies([{ name: "Acme", domain: "acme.com" }])
      ).resolves.not.toThrow();

      // account doc updated with companies (batch.set with merge)
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        { companies: [{ name: "Acme", domain: "acme.com" }] },
        { merge: true }
      );

      // user doc updated with onboardingStep=3
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 3 }
      );

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("saves only the passed companies — no extra fields added by the action", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const companies = [{ name: "Acme", domain: "acme.com" }];
      await submitCompanies(companies);

      // batch.set must be called with exactly the passed companies array
      const [, setPayload] = mockBatchSet.mock.calls[0];
      expect(setPayload).toEqual({ companies });
      expect(Object.keys(setPayload)).toEqual(["companies"]);
    });

    it("each company in the saved payload matches the passed data (no email_sent added by the action)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const companies = [{ name: "Acme", domain: "acme.com" }];
      await submitCompanies(companies);

      const [, setPayload] = mockBatchSet.mock.calls[0];
      const savedCompany = setPayload.companies[0];

      // Only the passed fields are present — action does not add email_sent
      expect(savedCompany).toEqual({ name: "Acme", domain: "acme.com" });
      expect(savedCompany).not.toHaveProperty("email_sent");
    });

    it("saves multiple companies correctly", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const companies = [
        { name: "Acme", domain: "acme.com" },
        { name: "Globex", domain: "globex.com" },
      ];
      await submitCompanies(companies);

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        { companies },
        { merge: true }
      );
      const [, setPayload] = mockBatchSet.mock.calls[0];
      expect(setPayload.companies).toHaveLength(2);
    });

    it("uses merge: true so existing account data is preserved", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await submitCompanies([{ name: "Acme", domain: "acme.com" }]);

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Object),
        { merge: true }
      );
    });

    it("commits the batch exactly once per call", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await submitCompanies([{ name: "Acme", domain: "acme.com" }]);

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("validation", () => {
    it("returns error when companies array is empty", async () => {
      const result = await submitCompanies([]);
      expect(result).toEqual({ success: false, error: expect.any(String) });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("returns error for invalid domain without a dot (e.g. 'notadomain')", async () => {
      const result = await submitCompanies([{ name: "Acme", domain: "notadomain" }]);
      expect(result).toEqual({ success: false, error: expect.stringContaining("Invalid domain") });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("returns error for empty company name", async () => {
      const result = await submitCompanies([{ name: "", domain: "acme.com" }]);
      expect(result).toEqual({ success: false, error: expect.any(String) });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("returns error for whitespace-only company name", async () => {
      const result = await submitCompanies([{ name: "   ", domain: "acme.com" }]);
      expect(result).toEqual({ success: false, error: expect.any(String) });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("returns error when duplicate domains are submitted", async () => {
      const result = await submitCompanies([
        { name: "Acme", domain: "acme.com" },
        { name: "Acme Corp", domain: "acme.com" },
      ]);
      expect(result).toEqual({ success: false, error: expect.any(String) });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("treats duplicate domains case-insensitively", async () => {
      const result = await submitCompanies([
        { name: "Acme", domain: "Acme.com" },
        { name: "Acme Corp", domain: "acme.com" },
      ]);
      expect(result).toEqual({ success: false, error: expect.any(String) });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("does not call checkAuth (getTokens) when validation fails", async () => {
      await submitCompanies([]);
      expect(mockGetTokens).not.toHaveBeenCalled();
    });
  });

  describe("authentication", () => {
    it("throws when user is not authenticated (null tokens)", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(
        submitCompanies([{ name: "Acme", domain: "acme.com" }])
      ).rejects.toThrow();
    });

    it("does not call Firestore batch when user is not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await submitCompanies([{ name: "Acme", domain: "acme.com" }]);
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("throws when getTokens rejects", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token invalid"));

      await expect(
        submitCompanies([{ name: "Acme", domain: "acme.com" }])
      ).rejects.toThrow();
    });

    it("throws when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      await expect(
        submitCompanies([{ name: "Acme", domain: "acme.com" }])
      ).rejects.toThrow("Email not verified");
    });
  });

  describe("plan limits", () => {
    const makeCompanies = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `Company${i + 1}`, domain: `company${i + 1}.com` }));

    it("free_trial (maxCompanies=1): submit 1 company -> OK", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "free_trial" }) });

      await expect(
        submitCompanies([{ name: "Acme", domain: "acme.com" }])
      ).resolves.not.toThrow();
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("free_trial (maxCompanies=1): submit 2 companies -> error 'Exceeds plan limit'", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "free_trial" }) });

      const result = await submitCompanies([
        { name: "Acme", domain: "acme.com" },
        { name: "Globex", domain: "globex.com" },
      ]);

      expect(result).toEqual({ success: false, error: expect.stringMatching(/exceeds plan limit/i) });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("base (maxCompanies=20): submit 20 companies -> OK", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "base" }) });

      await expect(submitCompanies(makeCompanies(20))).resolves.not.toThrow();
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("base (maxCompanies=20): submit 21 companies -> error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "base" }) });

      const result = await submitCompanies(makeCompanies(21));

      expect(result).toEqual({ success: false, error: expect.stringMatching(/exceeds plan limit/i) });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("pro (maxCompanies=50): submit 50 companies -> OK", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "pro" }) });

      await expect(submitCompanies(makeCompanies(50))).resolves.not.toThrow();
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("ultra (maxCompanies=100): submit 100 companies -> OK", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "ultra" }) });

      await expect(submitCompanies(makeCompanies(100))).resolves.not.toThrow();
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });
  });
});
