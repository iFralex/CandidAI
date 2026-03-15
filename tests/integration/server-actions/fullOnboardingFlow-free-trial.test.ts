import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockBatchSet,
  mockBatchUpdate,
  mockBatchCommit,
  mockUserGet,
  mockFileSave,
  mockGetSignedUrl,
  mockRedirect,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockUserGet: vi.fn(),
  mockFileSave: vi.fn(),
  mockGetSignedUrl: vi.fn(),
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
  adminStorage: {
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        save: mockFileSave,
        getSignedUrl: mockGetSignedUrl,
      }),
    }),
  },
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

import {
  selectPlan,
  submitCompanies,
  submitProfile,
  submitQueries,
  completeOnboarding,
} from "@/actions/onboarding-actions";

const FAKE_SIGNED_URL =
  "https://storage.googleapis.com/my-bucket/cv/user123/resume.pdf?X-Goog-Signature=abc123fake";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const validProfileData = {
  name: "John Doe",
  title: "Software Engineer",
  location: "Milan, Italy",
  profileSummary: {
    bio: "Experienced engineer",
    experience: [
      {
        company: "Acme Corp",
        role: "Engineer",
        startDate: "2020-01",
        endDate: "2023-12",
      },
    ],
  },
  cvUrl: null,
};

const mockCVFile = new File(["CV content"], "resume.pdf", { type: "application/pdf" });

const validQueries = { strategy: "domain", keywords: ["engineer", "developer"] };

describe("Full Onboarding Flow - Free Trial", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
    mockBatchCommit.mockResolvedValue(undefined);
    mockRedirect.mockReturnValue(undefined);
    mockFileSave.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);
    // User has free_trial plan (used by submitCompanies for plan limits)
    mockUserGet.mockResolvedValue({ data: () => ({ plan: "free_trial" }) });
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("Step 1: selectPlan('free_trial')", () => {
    it("completes without error", async () => {
      await expect(selectPlan("free_trial")).resolves.not.toThrow();
    });

    it("updates onboardingStep=2 for the user", async () => {
      await selectPlan("free_trial");

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ onboardingStep: 2 })
      );
    });

    it("sets plan='free_trial' on the user document", async () => {
      await selectPlan("free_trial");

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ plan: "free_trial" })
      );
    });

    it("commits the batch exactly once", async () => {
      await selectPlan("free_trial");

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step 2: submitCompanies", () => {
    it("completes without error for a single valid company", async () => {
      // submitCompanies returns undefined on success; only returns {error} on validation failure
      await expect(
        submitCompanies([{ name: "TestCo", domain: "testco.com" }])
      ).resolves.not.toThrow();
    });

    it("updates onboardingStep=3 for the user", async () => {
      await submitCompanies([{ name: "TestCo", domain: "testco.com" }]);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 3 }
      );
    });

    it("saves company data to the companies sub-collection", async () => {
      await submitCompanies([{ name: "TestCo", domain: "testco.com" }]);

      // batchSet used for creating company documents
      expect(mockBatchSet).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step 3: submitProfile", () => {
    it("completes without error with valid profile and CV", async () => {
      // submitProfile returns undefined on success; only returns {error} on validation failure
      await expect(
        submitProfile("free_trial", validProfileData, mockCVFile)
      ).resolves.not.toThrow();
    });

    it("uploads CV to Firebase Storage and sets cvUrl", async () => {
      await submitProfile("free_trial", validProfileData, mockCVFile);

      expect(mockFileSave).toHaveBeenCalledOnce();
      expect(mockGetSignedUrl).toHaveBeenCalledOnce();
    });

    it("updates onboardingStep=4 for the user", async () => {
      await submitProfile("free_trial", validProfileData, mockCVFile);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 4 }
      );
    });

    it("saves profile data to the data/account document", async () => {
      await submitProfile("free_trial", validProfileData, mockCVFile);

      const profileUpdateCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "name" in data
      );
      expect(profileUpdateCall).toBeDefined();
      expect(profileUpdateCall![1]).toMatchObject({
        name: validProfileData.name,
        cvUrl: FAKE_SIGNED_URL,
      });
    });

    it("commits the batch exactly once", async () => {
      await submitProfile("free_trial", validProfileData, mockCVFile);

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step 4: submitQueries", () => {
    it("completes without error", async () => {
      await expect(submitQueries(validQueries)).resolves.not.toThrow();
    });

    it("updates onboardingStep=5 for the user", async () => {
      await submitQueries(validQueries);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 5 }
      );
    });

    it("saves queries to the data/account document", async () => {
      await submitQueries(validQueries);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { queries: validQueries }
      );
    });

    it("commits the batch exactly once", async () => {
      await submitQueries(validQueries);

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step 5: completeOnboarding", () => {
    it("completes without error", async () => {
      await expect(
        completeOnboarding({ instructions: "Be professional" })
      ).resolves.not.toThrow();
    });

    it("updates onboardingStep on the user document", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: expect.any(Number) }
      );
    });

    it("saves customizations to the data/account document", async () => {
      const customizations = { instructions: "Be professional" };

      await completeOnboarding(customizations);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );
    });

    it("commits the batch exactly once", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("redirects to /dashboard after successful commit", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("Complete sequential flow", () => {
    it("all 5 steps complete without error in sequence", async () => {
      // Step 1
      await expect(selectPlan("free_trial")).resolves.not.toThrow();
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);
      mockFileSave.mockResolvedValue(undefined);
      mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "free_trial" }) });

      // Step 2
      await expect(
        submitCompanies([{ name: "TestCo", domain: "testco.com" }])
      ).resolves.not.toThrow();
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);
      mockFileSave.mockResolvedValue(undefined);
      mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);

      // Step 3
      await expect(
        submitProfile("free_trial", validProfileData, mockCVFile)
      ).resolves.not.toThrow();
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);

      // Step 4
      await expect(submitQueries(validQueries)).resolves.not.toThrow();
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);

      // Step 5
      await expect(
        completeOnboarding({ instructions: "Be professional" })
      ).resolves.not.toThrow();
    });

    it("each step performs a Firestore batch commit", async () => {
      // Step 1: selectPlan
      await selectPlan("free_trial");
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "free_trial" }) });
      mockFileSave.mockResolvedValue(undefined);
      mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);
      mockRedirect.mockReturnValue(undefined);

      // Step 2: submitCompanies
      await submitCompanies([{ name: "TestCo", domain: "testco.com" }]);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);
      mockFileSave.mockResolvedValue(undefined);
      mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);

      // Step 3: submitProfile
      await submitProfile("free_trial", validProfileData, mockCVFile);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);

      // Step 4: submitQueries
      await submitQueries(validQueries);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);

      // Step 5: completeOnboarding
      await completeOnboarding({ instructions: "Be professional" });
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("final completeOnboarding saves customizations to data/account document", async () => {
      const customizations = { instructions: "Be professional" };

      await completeOnboarding(customizations);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );
    });

    it("plan='free_trial' and onboardingStep are written across all batch commits", async () => {
      // Step 1: selectPlan sets plan and onboardingStep=2
      await selectPlan("free_trial");
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ plan: "free_trial", onboardingStep: 2 })
      );
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockUserGet.mockResolvedValue({ data: () => ({ plan: "free_trial" }) });

      // Step 2: submitCompanies sets onboardingStep=3
      await submitCompanies([{ name: "TestCo", domain: "testco.com" }]);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 3 }
      );
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockFileSave.mockResolvedValue(undefined);
      mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);

      // Step 3: submitProfile sets onboardingStep=4
      await submitProfile("free_trial", validProfileData, mockCVFile);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 4 }
      );
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);

      // Step 4: submitQueries sets onboardingStep=5
      await submitQueries(validQueries);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 5 }
      );
      vi.clearAllMocks();
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockRedirect.mockReturnValue(undefined);

      // Step 5: completeOnboarding saves customizations and updates onboardingStep
      await completeOnboarding({ instructions: "Be professional" });
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations: { instructions: "Be professional" } }
      );
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: expect.any(Number) }
      );
    });
  });

  describe("startServer (fetch /run_module) behavior", () => {
    it("fetch is not called by completeOnboarding in the free trial flow", async () => {
      // completeOnboarding does not directly invoke startServer;
      // the server is triggered externally (e.g., via a webhook or separate mechanism)
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("flow completes successfully even if fetch/startServer would throw", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        completeOnboarding({ instructions: "Be professional" })
      ).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("final Firestore state verification", () => {
    it("completeOnboarding writes customizations to data/account", async () => {
      const customizations = { instructions: "Be professional" };

      await completeOnboarding(customizations);

      const accountUpdateCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "customizations" in data
      );
      expect(accountUpdateCall).toBeDefined();
      expect(accountUpdateCall![1]).toEqual({ customizations });
    });

    it("completeOnboarding updates onboardingStep on the user document", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      const stepUpdateCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "onboardingStep" in data
      );
      expect(stepUpdateCall).toBeDefined();
      expect(stepUpdateCall![1].onboardingStep).toBeTypeOf("number");
    });

    it("completeOnboarding batch is committed atomically (once)", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("selectPlan sets plan='free_trial' and credits=0 on user document", async () => {
      await selectPlan("free_trial");

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          plan: "free_trial",
          credits: 0,
        })
      );
    });
  });

  describe("authentication — flow stops on auth failure", () => {
    it("selectPlan throws when not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(selectPlan("free_trial")).rejects.toThrow();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("submitCompanies throws when not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(
        submitCompanies([{ name: "TestCo", domain: "testco.com" }])
      ).rejects.toThrow();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("submitProfile throws when not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(
        submitProfile("free_trial", validProfileData, mockCVFile)
      ).rejects.toThrow();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("submitQueries throws when not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(submitQueries(validQueries)).rejects.toThrow();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("completeOnboarding throws when not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(
        completeOnboarding({ instructions: "Be professional" })
      ).rejects.toThrow();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });
});
