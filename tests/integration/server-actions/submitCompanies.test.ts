import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockGetTokens, mockBatchSet, mockBatchUpdate, mockBatchCommit } = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchSet: vi.fn(),
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
});
