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

// The Firestore chain for regenerateEmail goes 3 levels deep:
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
  creditsInfo: {},
}));

import { regenerateEmail } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

describe("regenerateEmail server action", () => {
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

  describe("happy path — sufficient credits", () => {
    it("saves instructions via batch.set with merge:true on customizationsRef", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Be more formal");

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        { instructions: "Be more formal" },
        { merge: true }
      );
    });

    it("deletes email_sent from results via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Be more formal");

      const updateCalls = mockBatchUpdate.mock.calls.map(([, data]) => data);
      const emailSentCall = updateCalls.find(
        (data) => data && "company1.email_sent" in data
      );
      expect(emailSentCall).toBeDefined();
    });

    it("deletes email field from details and row via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Be more formal");

      const updateCalls = mockBatchUpdate.mock.calls.map(([, data]) => data);
      const emailDeleteCall = updateCalls.find(
        (data) => data && "email" in data
      );
      expect(emailDeleteCall).toBeDefined();
    });

    it("deletes companyId entry from emails doc via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Be more formal");

      const updateCalls = mockBatchUpdate.mock.calls.map(([, data]) => data);
      const emailsDeleteCall = updateCalls.find(
        (data) => data && "company1" in data
      );
      expect(emailsDeleteCall).toBeDefined();
    });

    it("commits the batch exactly once", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Be more formal");

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("calls deleteCreditsPaid — unlockedRef.update is called with generate-email key", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Be more formal");

      expect(mockUnlockedUpdate).toHaveBeenCalledTimes(1);
      const [updateArg] = mockUnlockedUpdate.mock.calls[0];
      expect(updateArg).toHaveProperty("generate-email");
    });

    it("calls Python server (startServer via fetch POST)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Be more formal");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("redirects to /dashboard/companyId after completing", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Be more formal");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/company1");
    });

    it("uses the provided companyId in the redirect path", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("acme-corp", "Be concise");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/acme-corp");
    });
  });

  describe("deleteCreditsPaid is always called (no credit-check gate in regenerateEmail)", () => {
    it("calls unlockedRef.update exactly once per invocation", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Some instruction");

      expect(mockUnlockedUpdate).toHaveBeenCalledTimes(1);
    });

    it("batch.commit and deleteCreditsPaid run in parallel (both called before startServer)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "Test");

      // Both should be called
      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockUnlockedUpdate).toHaveBeenCalledOnce();
    });
  });

  describe("Python server (startServer) behavior", () => {
    it("when fetch throws (unreachable server), regenerateEmail propagates the error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        regenerateEmail("company1", "Be more formal")
      ).rejects.toThrow("ECONNREFUSED");
    });

    it("when fetch throws, batch.commit was still called before the error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockRejectedValue(new Error("Network failure"));

      try {
        await regenerateEmail("company1", "Be more formal");
      } catch {
        // expected
      }

      // batch.commit runs in Promise.all before startServer is called
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("when fetch throws, redirect is NOT called", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      try {
        await regenerateEmail("company1", "Be more formal");
      } catch {
        // expected
      }

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("when fetch returns 503 (!ok), logs error but action still redirects", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockFetch.mockResolvedValue({ ok: false, status: 503 });

      // startServer logs the error but does not throw, so redirect still happens
      await expect(regenerateEmail("company1", "Be more formal")).resolves.not.toThrow();

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/company1");
    });
  });

  describe("instructions parameter — no validation gate", () => {
    it("saves empty string instructions without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(regenerateEmail("company1", "")).resolves.not.toThrow();

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        { instructions: "" },
        { merge: true }
      );
    });

    it("saves empty string and still commits batch and redirects", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("company1", "");

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/company1");
    });

    it("saves any arbitrary instruction string as-is", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const instructions = "Use bullet points. Keep it under 150 words. Focus on the role.";

      await regenerateEmail("company1", instructions);

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        { instructions },
        { merge: true }
      );
    });
  });

  describe("non-existent companyId — no existence check", () => {
    it("proceeds without error for any companyId string (no Firestore existence check)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(
        regenerateEmail("non-existent-company-xyz", "Some instructions")
      ).resolves.not.toThrow();
    });

    it("redirects to the provided companyId regardless of existence", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await regenerateEmail("unknown-company", "Test");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/unknown-company");
    });
  });

  describe("authentication", () => {
    it("throws when user is not authenticated (null tokens)", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(
        regenerateEmail("company1", "Be more formal")
      ).rejects.toThrow();
    });

    it("does not call Firestore batch when unauthenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await regenerateEmail("company1", "Be more formal");
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("does not call startServer when unauthenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await regenerateEmail("company1", "Be more formal");
      } catch {
        // expected
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws when getTokens rejects", async () => {
      mockGetTokens.mockRejectedValue(new Error("Token invalid"));

      await expect(
        regenerateEmail("company1", "Be more formal")
      ).rejects.toThrow();
    });

    it("throws when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      await expect(
        regenerateEmail("company1", "Be more formal")
      ).rejects.toThrow("Email not verified");
    });
  });
});
