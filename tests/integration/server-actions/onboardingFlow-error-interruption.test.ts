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
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockUserGet: vi.fn(),
  mockFileSave: vi.fn(),
  mockGetSignedUrl: vi.fn(),
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
  submitCompanies,
  submitProfile,
  completeOnboarding,
} from "@/actions/onboarding-actions";

const FAKE_SIGNED_URL =
  "https://storage.googleapis.com/my-bucket/cv/user123/resume.pdf?X-Goog-Signature=fake";

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

const mockCVFile = new File(["CV content"], "resume.pdf", {
  type: "application/pdf",
});

describe("Onboarding Flow - Error Interruption", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
    mockBatchCommit.mockResolvedValue(undefined);
    mockRedirect.mockReturnValue(undefined);
    mockFileSave.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);
    mockUserGet.mockResolvedValue({ data: () => ({ plan: "base" }) });
  });

  describe("submitCompanies called again at onboardingStep=3 (step already completed)", () => {
    it("does not throw an error when called with a new set of companies", async () => {
      // The action has no step-guard: it overwrites companies and re-sets onboardingStep=3
      const newCompanies = [
        { name: "NewCo", domain: "newco.com" },
        { name: "AnotherCo", domain: "anotherco.com" },
      ];

      await expect(submitCompanies(newCompanies)).resolves.not.toThrow();
    });

    it("overwrites the companies list with the new submission", async () => {
      const newCompanies = [
        { name: "ReplacedCo", domain: "replacedco.com" },
      ];

      await submitCompanies(newCompanies);

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        { companies: newCompanies },
        { merge: true }
      );
    });

    it("still sets onboardingStep=3 (idempotent step update)", async () => {
      await submitCompanies([{ name: "Acme", domain: "acme.com" }]);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 3 }
      );
    });

    it("commits the batch exactly once per re-submission", async () => {
      await submitCompanies([{ name: "Acme", domain: "acme.com" }]);

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("user skipping steps - completeOnboarding called from onboardingStep=2", () => {
    it("does not throw an error (action does not enforce step ordering)", async () => {
      // completeOnboarding has no guard for current step — it proceeds regardless
      await expect(
        completeOnboarding({ instructions: "Skip all steps" })
      ).resolves.not.toThrow();
    });

    it("sets onboardingStep=6 even when user is at an earlier step", async () => {
      await completeOnboarding({ instructions: "Skip all steps" });

      const stepCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "onboardingStep" in data
      );
      expect(stepCall).toBeDefined();
      expect(stepCall![1].onboardingStep).toBe(6);
    });

    it("saves customizations regardless of current step", async () => {
      const customizations = { instructions: "Skip all steps" };

      await completeOnboarding(customizations);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );
    });

    it("commits the batch (gracefully handles step skip)", async () => {
      await completeOnboarding({ instructions: "Skip all steps" });

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("redirects to /dashboard after completing (even with skipped steps)", async () => {
      await completeOnboarding({ instructions: "Skip all steps" });

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("connection loss during submitProfile upload", () => {
    it("propagates error when Storage save fails (simulated network loss)", async () => {
      mockFileSave.mockRejectedValue(new Error("Network error: connection reset"));

      await expect(
        submitProfile("base", validProfileData, mockCVFile)
      ).rejects.toThrow("Network error: connection reset");
    });

    it("does not commit Firestore batch when Storage save fails", async () => {
      mockFileSave.mockRejectedValue(new Error("Network error: connection reset"));

      try {
        await submitProfile("base", validProfileData, mockCVFile);
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("does not update onboardingStep when Storage save fails", async () => {
      mockFileSave.mockRejectedValue(new Error("Network error: connection reset"));

      try {
        await submitProfile("base", validProfileData, mockCVFile);
      } catch {
        // expected
      }

      expect(mockBatchUpdate).not.toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 4 }
      );
    });

    it("can successfully retry submitProfile after a previous failure", async () => {
      // First attempt fails
      mockFileSave.mockRejectedValueOnce(new Error("Network error: connection reset"));

      try {
        await submitProfile("base", validProfileData, mockCVFile);
      } catch {
        // expected
      }

      expect(mockBatchCommit).not.toHaveBeenCalled();
      vi.clearAllMocks();

      // Second attempt succeeds
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockBatchCommit.mockResolvedValue(undefined);
      mockFileSave.mockResolvedValue(undefined);
      mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);

      await expect(
        submitProfile("base", validProfileData, mockCVFile)
      ).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("page reload mid-onboarding - onboardingStep persists in Firestore", () => {
    it("submitCompanies writes onboardingStep=3 to Firestore (persists on reload)", async () => {
      await submitCompanies([{ name: "Acme", domain: "acme.com" }]);

      // onboardingStep=3 is written to Firestore, so a page reload will read step=3
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 3 }
      );
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("submitProfile writes onboardingStep=4 to Firestore (persists on reload)", async () => {
      await submitProfile("base", validProfileData, mockCVFile);

      // onboardingStep=4 is written to Firestore, so a page reload will read step=4
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 4 }
      );
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("completeOnboarding writes onboardingStep=6 to Firestore (persists on reload)", async () => {
      await completeOnboarding({ instructions: "Test" });

      // onboardingStep=6 is written to Firestore, so a page reload restores from step 6
      const stepCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "onboardingStep" in data
      );
      expect(stepCall).toBeDefined();
      expect(stepCall![1].onboardingStep).toBe(6);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("failed submitProfile does NOT advance onboardingStep (reload restores previous step)", async () => {
      // Simulate a failed upload: onboardingStep should remain at its previous value
      mockFileSave.mockRejectedValue(new Error("Upload failed"));

      try {
        await submitProfile("base", validProfileData, mockCVFile);
      } catch {
        // expected
      }

      // onboardingStep update must not have been committed
      const stepUpdateCommitted = mockBatchCommit.mock.calls.length > 0;
      expect(stepUpdateCommitted).toBe(false);
    });
  });
});
