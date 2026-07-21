import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockUserGet,
  mockPreviewGet,
  mockBatchSet,
  mockBatchUpdate,
  mockBatchCommit,
  mockRecordOnboardingTransition,
  mockRecordOnboardingSignal,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockUserGet: vi.fn(),
  mockPreviewGet: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockRecordOnboardingTransition: vi.fn(),
  mockRecordOnboardingSignal: vi.fn(),
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
  redirect: vi.fn(),
}));

vi.mock("@/lib/onboarding-lifecycle", () => ({
  recordOnboardingTransition: mockRecordOnboardingTransition,
  recordOnboardingSignal: mockRecordOnboardingSignal,
}));

// Firestore chain shaped for submitPreviewCompany:
//   users/{uid} -> userRef { get: mockUserGet }
//     .collection("data").doc("account") -> accountRef (only used as a batch.set() ref, no .get())
//     .collection("data").doc("onboarding_preview") -> previewRef { get: mockPreviewGet }
//   batch: set, update, commit are fully mocked
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "users") {
        return {
          doc: vi.fn().mockReturnValue({
            get: mockUserGet,
            collection: vi.fn().mockReturnValue({
              doc: vi.fn((docName: string) => {
                if (docName === "account") return {};
                if (docName === "onboarding_preview") return { get: mockPreviewGet };
                return {};
              }),
            }),
          }),
        };
      }
      return { doc: vi.fn().mockReturnValue({}) };
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
  creditsInfo: {
    "find-recruiter": { cost: 100 },
    "generate-email": { cost: 50 },
    "change-company": { cost: 70 },
  },
}));

import { submitPreviewCompany } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const snap = (data: Record<string, any> | undefined) => ({ data: () => data });

const company = { name: "Acme Corp", domain: "acme.com" };

describe("submitPreviewCompany server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
    mockUserGet.mockResolvedValue(snap({ onboardingStage: "target_company" }));
    mockBatchCommit.mockResolvedValue(undefined);
    mockRecordOnboardingTransition.mockResolvedValue(undefined);
    mockRecordOnboardingSignal.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe("profileStatus:'completed' — profile is ready", () => {
    beforeEach(() => {
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "completed" }));
    });

    it("sets onboardingStage to 'profile_review' via batch.update", async () => {
      await submitPreviewCompany(company);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStage: "profile_review", onboardingStep: 3 }
      );
    });

    it("records the lifecycle transition to 'profile_review'", async () => {
      await submitPreviewCompany(company);

      expect(mockRecordOnboardingTransition).toHaveBeenCalledWith(
        expect.objectContaining({ to: "profile_review" })
      );
      expect(mockRecordOnboardingSignal).not.toHaveBeenCalled();
    });

    it("returns { success: true }", async () => {
      const result = await submitPreviewCompany(company);
      expect(result).toEqual({ success: true });
    });
  });

  describe("profileStatus:'running' — profile still generating", () => {
    beforeEach(() => {
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "running" }));
    });

    it("sets onboardingStage to 'profile_generating' via batch.update", async () => {
      await submitPreviewCompany(company);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStage: "profile_generating", onboardingStep: 3 }
      );
    });

    it("does not call recordOnboardingTransition, emits a signal instead", async () => {
      await submitPreviewCompany(company);

      expect(mockRecordOnboardingTransition).not.toHaveBeenCalled();
      expect(mockRecordOnboardingSignal).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "profile_generating" })
      );
    });
  });

  describe("profileStatus absent/queued — treated same as not-ready", () => {
    it("sets onboardingStage to 'profile_generating' when profileStatus is absent", async () => {
      mockPreviewGet.mockResolvedValue(snap(undefined));

      await submitPreviewCompany(company);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStage: "profile_generating", onboardingStep: 3 }
      );
    });

    it("sets onboardingStage to 'profile_generating' when profileStatus is 'queued'", async () => {
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "queued" }));

      await submitPreviewCompany(company);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStage: "profile_generating", onboardingStep: 3 }
      );
    });
  });

  describe("profileStatus:'failed' — stay on the company step so the UI can show retry", () => {
    beforeEach(() => {
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "failed" }));
    });

    it("sets onboardingStage to 'target_company' via batch.update", async () => {
      await submitPreviewCompany(company);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStage: "target_company", onboardingStep: 3 }
      );
    });

    it("records the lifecycle transition to 'target_company'", async () => {
      await submitPreviewCompany(company);

      expect(mockRecordOnboardingTransition).toHaveBeenCalledWith(
        expect.objectContaining({ to: "target_company" })
      );
      expect(mockRecordOnboardingSignal).not.toHaveBeenCalled();
    });
  });

  describe("company save — independent of profileStatus", () => {
    beforeEach(() => {
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "completed" }));
    });

    it("saves the company on accountRef via batch.set with merge:true", async () => {
      await submitPreviewCompany(company);

      const companiesCall = mockBatchSet.mock.calls.find(
        ([, data]) => data?.companies !== undefined
      );
      expect(companiesCall).toBeDefined();
      expect(companiesCall![1]).toEqual({ companies: [company] });
      expect(companiesCall![2]).toEqual({ merge: true });
    });

    it("commits the batch", async () => {
      await submitPreviewCompany(company);
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });
  });

  describe("freePreviewConsumedAt guard", () => {
    it("returns an error and does not touch the batch when free preview already consumed", async () => {
      mockUserGet.mockResolvedValue(snap({ freePreviewConsumedAt: new Date().toISOString() }));
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "completed" }));

      const result = await submitPreviewCompany(company);

      expect(result).toEqual({
        success: false,
        error: "Your free candidacy has already been generated",
      });
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });

  describe("validation — no longer requires profileSummary", () => {
    it("does not reject when the account has no profileSummary yet", async () => {
      mockPreviewGet.mockResolvedValue(snap({ profileStatus: "running" }));

      const result = await submitPreviewCompany(company);

      expect(result).toEqual({ success: true });
    });

    it("rejects an empty company name", async () => {
      const result = await submitPreviewCompany({ name: "  " });
      expect(result).toEqual({ success: false, error: "Company name cannot be empty" });
    });

    it("rejects an invalid domain when no linkedin_url is provided", async () => {
      const result = await submitPreviewCompany({ name: "Acme", domain: "not a domain" });
      expect(result).toEqual({ success: false, error: "Invalid domain: not a domain" });
    });
  });

  describe("authentication", () => {
    it("throws when tokens are null", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(submitPreviewCompany(company)).rejects.toThrow();
    });
  });
});
