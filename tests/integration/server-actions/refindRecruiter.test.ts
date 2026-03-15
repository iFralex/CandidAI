import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockBatchUpdate,
  mockBatchSet,
  mockBatchCommit,
  mockRedirect,
  mockFetch,
  mockUnlockedUpdate,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockRedirect: vi.fn(),
  mockFetch: vi.fn(),
  mockUnlockedUpdate: vi.fn(),
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

// Firestore chain:
//   level1: collection("users").doc(userId)
//   level2: .collection("data").doc("results" | "emails")
//   level3: .collection(companyId).doc("details" | "row" | "customizations" | "unlocked")
// deleteCreditsPaid calls level3Ref.update() directly (not via batch)
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({
                update: mockUnlockedUpdate,
              }),
            }),
            update: vi.fn(),
            set: vi.fn(),
          }),
        }),
      }),
    }),
    batch: vi.fn().mockReturnValue({
      update: mockBatchUpdate,
      set: mockBatchSet,
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
  creditsInfo: {
    "find-recruiter": { cost: 100 },
    "generate-email": { cost: 50 },
    "change-company": { cost: 70 },
  },
}));

import { refindRecruiter } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const validStrategy = [
  {
    criteria: [
      { key: "job_title", value: ["recruiter"] },
    ],
  },
];

describe("refindRecruiter server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
    mockUnlockedUpdate.mockResolvedValue(undefined);
    mockRedirect.mockReturnValue(undefined);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe("happy path — valid inputs", () => {
    it("calls Python server (startServer via fetch POST) on success", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", "https://linkedin.com/in/johndoe");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("redirects to /dashboard/companyId after completing", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", "https://linkedin.com/in/johndoe");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/company1");
    });

    it("calls batch.commit exactly once", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", "https://linkedin.com/in/johndoe");

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("calls deleteCreditsPaid — unlockedRef.update is called with find-recruiter key", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", "https://linkedin.com/in/johndoe");

      expect(mockUnlockedUpdate).toHaveBeenCalledTimes(1);
      const [updateArg] = mockUnlockedUpdate.mock.calls[0];
      expect(updateArg).toHaveProperty("find-recruiter");
    });

    it("uses the provided companyId in the redirect path", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("acme-corp", validStrategy, "Jane Smith", null);

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/acme-corp");
    });
  });

  describe("credit deduction behavior", () => {
    it("credits are decremented — unlockedRef.update called with find-recruiter deletion key", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      expect(mockUnlockedUpdate).toHaveBeenCalledOnce();
      const [updateArg] = mockUnlockedUpdate.mock.calls[0];
      // deleteCreditsPaid removes the "find-recruiter" key from unlocked doc
      expect(updateArg).toHaveProperty("find-recruiter");
    });

    it("batch.commit and deleteCreditsPaid run in parallel (both called before startServer)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockUnlockedUpdate).toHaveBeenCalledOnce();
    });

    it("no credit-check gate — proceeds regardless of credit balance (no check before deduction)", async () => {
      // The action deducts via deleteCreditsPaid but does NOT check balance first
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      // If there were a credit check it would need to read user doc first;
      // since there's none, action proceeds and still calls batch + deleteCreditsPaid
      await refindRecruiter("company1", validStrategy, "John Doe", null);

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockUnlockedUpdate).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  describe("Firestore batch operations", () => {
    it("saves updated strategy (queries) via batch.set with merge:true on customizationsRef", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ queries: expect.any(Array) }),
        { merge: true }
      );
    });

    it("deletes recruiter and email_sent from results via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      const updateCalls = mockBatchUpdate.mock.calls.map(([, data]) => data);
      const recruiterDeleteCall = updateCalls.find(
        (data) => data && "company1.recruiter" in data
      );
      expect(recruiterDeleteCall).toBeDefined();
      expect(recruiterDeleteCall).toHaveProperty("company1.email_sent");
    });

    it("deletes recruiter_summary, query, email from details via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      const updateCalls = mockBatchUpdate.mock.calls.map(([, data]) => data);
      const detailsDeleteCall = updateCalls.find(
        (data) => data && "recruiter_summary" in data
      );
      expect(detailsDeleteCall).toBeDefined();
      expect(detailsDeleteCall).toHaveProperty("query");
      expect(detailsDeleteCall).toHaveProperty("email");
    });

    it("deletes recruiter, query, email from row via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      const updateCalls = mockBatchUpdate.mock.calls.map(([, data]) => data);
      const rowDeleteCall = updateCalls.find(
        (data) => data && "recruiter" in data && "query" in data && "email" in data
      );
      expect(rowDeleteCall).toBeDefined();
    });

    it("deletes companyId entry from emails doc via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      const updateCalls = mockBatchUpdate.mock.calls.map(([, data]) => data);
      const emailsDeleteCall = updateCalls.find(
        (data) => data && "company1" in data
      );
      expect(emailsDeleteCall).toBeDefined();
    });
  });

  describe("strategy modification — exclude_names and exclude_linkedin_urls", () => {
    it("adds exclude_names with provided name to strategy criteria", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      const setBatchCall = mockBatchSet.mock.calls[0];
      const savedData = setBatchCall[1];
      const queries = savedData.queries as any[];
      const firstItem = queries[0];
      const excludeNamesCriteria = firstItem.criteria.find((c: any) => c.key === "exclude_names");
      expect(excludeNamesCriteria).toBeDefined();
      expect(excludeNamesCriteria.value).toContain("John Doe");
    });

    it("adds exclude_linkedin_urls when linkedinUrl is provided", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", "https://linkedin.com/in/johndoe");

      const setBatchCall = mockBatchSet.mock.calls[0];
      const savedData = setBatchCall[1];
      const queries = savedData.queries as any[];
      const firstItem = queries[0];
      const excludeLinkedinCriteria = firstItem.criteria.find((c: any) => c.key === "exclude_linkedin_urls");
      expect(excludeLinkedinCriteria).toBeDefined();
      expect(excludeLinkedinCriteria.value).toContain("https://linkedin.com/in/johndoe");
    });

    it("does not add exclude_linkedin_urls when linkedinUrl is null", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("company1", validStrategy, "John Doe", null);

      const setBatchCall = mockBatchSet.mock.calls[0];
      const savedData = setBatchCall[1];
      const queries = savedData.queries as any[];
      const firstItem = queries[0];
      const excludeLinkedinCriteria = firstItem.criteria.find((c: any) => c.key === "exclude_linkedin_urls");
      expect(excludeLinkedinCriteria).toBeUndefined();
    });

    it("invalid linkedinUrl (not a URL string) is accepted without error — no validation gate", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      // No validation occurs — the string is treated as a value to add
      await expect(
        refindRecruiter("company1", validStrategy, "John Doe", "not-a-valid-url")
      ).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/company1");
    });
  });

  describe("non-existent companyId — no existence check", () => {
    it("proceeds without error for any companyId string (no Firestore existence check)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(
        refindRecruiter("non-existent-company-xyz", validStrategy, "John Doe", null)
      ).resolves.not.toThrow();
    });

    it("redirects to the provided companyId regardless of existence", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("unknown-company", validStrategy, "Someone", null);

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/unknown-company");
    });

    it("calls deleteCreditsPaid even for a non-existent companyId", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await refindRecruiter("ghost-company", validStrategy, "John", null);

      expect(mockUnlockedUpdate).toHaveBeenCalledOnce();
    });
  });

  describe("Python server (startServer) behavior", () => {
    it("when fetch throws (unreachable server), refindRecruiter propagates the error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        refindRecruiter("company1", validStrategy, "John Doe", null)
      ).rejects.toThrow("ECONNREFUSED");
    });

    it("when fetch throws, batch.commit was still called before the error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockRejectedValue(new Error("Network failure"));

      try {
        await refindRecruiter("company1", validStrategy, "John Doe", null);
      } catch {
        // expected
      }

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("when fetch throws, redirect is NOT called", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      try {
        await refindRecruiter("company1", validStrategy, "John Doe", null);
      } catch {
        // expected
      }

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("when fetch returns 503 (!ok), action logs but still redirects", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockResolvedValue({ ok: false, status: 503 });

      await expect(
        refindRecruiter("company1", validStrategy, "John Doe", null)
      ).resolves.not.toThrow();

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/company1");
    });
  });

  describe("authentication", () => {
    it("throws when user is not authenticated (null tokens)", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(
        refindRecruiter("company1", validStrategy, "John Doe", null)
      ).rejects.toThrow();
    });

    it("does not call Firestore batch when unauthenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await refindRecruiter("company1", validStrategy, "John Doe", null);
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("does not call startServer when unauthenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await refindRecruiter("company1", validStrategy, "John Doe", null);
      } catch {
        // expected
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws when getTokens rejects", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token invalid"));

      await expect(
        refindRecruiter("company1", validStrategy, "John Doe", null)
      ).rejects.toThrow();
    });

    it("throws when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      await expect(
        refindRecruiter("company1", validStrategy, "John Doe", null)
      ).rejects.toThrow("Email not verified");
    });
  });
});
