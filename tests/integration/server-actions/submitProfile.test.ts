import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockBatchUpdate,
  mockBatchCommit,
  mockFileSave,
  mockGetSignedUrl,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockFileSave: vi.fn(),
  mockGetSignedUrl: vi.fn(),
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

import { submitProfile } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const FAKE_SIGNED_URL =
  "https://storage.googleapis.com/my-bucket/cv/user123/resume.pdf?X-Goog-Signature=abc123fake";

describe("submitProfile server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
    mockFileSave.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);
  });

  describe("happy path", () => {
    it("uploads CV to Firebase Storage and saves the signed URL to data/account.cvUrl", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const profileData = {
        linkedinUrl: "https://linkedin.com/in/johndoe",
        profileSummary: "Experienced software engineer",
      };

      const cv = new File(["cv content"], "resume.pdf", {
        type: "application/pdf",
      });

      await expect(
        submitProfile("pro", profileData, cv)
      ).resolves.not.toThrow();

      // CV file must have been uploaded to Firebase Storage
      expect(mockFileSave).toHaveBeenCalledOnce();
      expect(mockGetSignedUrl).toHaveBeenCalledOnce();

      // account doc must be updated with profileData fields AND the signed CV URL
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          linkedinUrl: "https://linkedin.com/in/johndoe",
          profileSummary: "Experienced software engineer",
          cvUrl: FAKE_SIGNED_URL,
        })
      );
    });

    it("saves profileSummary to data/account via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const profileData = {
        linkedinUrl: "https://linkedin.com/in/janedoe",
        profileSummary: "Senior product manager with 10 years of experience",
      };

      const cv = new File(["cv content"], "cv.pdf", {
        type: "application/pdf",
      });

      await submitProfile("base", profileData, cv);

      // profileSummary must appear in the account update payload
      const accountUpdateCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "profileSummary" in data
      );
      expect(accountUpdateCall).toBeDefined();
      expect(accountUpdateCall![1].profileSummary).toBe(
        "Senior product manager with 10 years of experience"
      );
    });

    it("updates onboardingStep=4 on the user document", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const profileData = {
        linkedinUrl: "https://linkedin.com/in/johndoe",
        profileSummary: "Engineer",
      };

      const cv = new File(["cv content"], "resume.pdf", {
        type: "application/pdf",
      });

      await submitProfile("pro", profileData, cv);

      // user doc must be updated with onboardingStep=4
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 4 }
      );

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("CV URL saved in the account payload is a valid Firebase Storage HTTPS URL", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const profileData = {
        linkedinUrl: "https://linkedin.com/in/johndoe",
        profileSummary: "Senior developer",
      };

      const cv = new File(["pdf bytes"], "cv.pdf", {
        type: "application/pdf",
      });

      await submitProfile("pro", profileData, cv);

      // Find the batch.update call that contains cvUrl (the account doc update)
      const accountUpdateCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "cvUrl" in data
      );

      expect(accountUpdateCall).toBeDefined();
      const savedCvUrl: string = accountUpdateCall![1].cvUrl;

      // Must be a valid URL
      expect(() => new URL(savedCvUrl)).not.toThrow();

      // Firebase Storage signed URLs are HTTPS
      expect(savedCvUrl).toMatch(/^https:\/\//);

      // Must reference Firebase/Google Cloud Storage
      expect(savedCvUrl).toMatch(/storage\.googleapis\.com/);
    });
  });
});
