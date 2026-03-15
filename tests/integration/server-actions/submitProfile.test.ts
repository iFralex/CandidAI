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

  describe("validation", () => {
    it("returns error 'Invalid file type' for a non-PDF file (e.g. .exe)", async () => {
      const cv = new File(["binary content"], "malware.exe", {
        type: "application/octet-stream",
      });

      const result = await submitProfile(
        "pro",
        { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Engineer" },
        cv
      );

      expect(result).toEqual({ success: false, error: "Invalid file type" });
      // must not reach Firebase Storage
      expect(mockFileSave).not.toHaveBeenCalled();
      // must not reach auth check
      expect(mockGetTokens).not.toHaveBeenCalled();
    });

    it("returns error 'Invalid file type' for a .docx file", async () => {
      const cv = new File(["docx content"], "cv.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const result = await submitProfile(
        "pro",
        { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Engineer" },
        cv
      );

      expect(result).toEqual({ success: false, error: "Invalid file type" });
      expect(mockFileSave).not.toHaveBeenCalled();
    });

    it("returns error 'File too large' when CV exceeds 5 MB", async () => {
      const largeBuffer = new Uint8Array(6 * 1024 * 1024); // 6 MB
      const cv = new File([largeBuffer], "large.pdf", {
        type: "application/pdf",
      });

      const result = await submitProfile(
        "pro",
        { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Engineer" },
        cv
      );

      expect(result).toEqual({ success: false, error: "File too large" });
      expect(mockFileSave).not.toHaveBeenCalled();
      expect(mockGetTokens).not.toHaveBeenCalled();
    });

    it("allows a PDF exactly at the 5 MB limit", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const exactBuffer = new Uint8Array(5 * 1024 * 1024); // exactly 5 MB
      const cv = new File([exactBuffer], "exact.pdf", { type: "application/pdf" });

      await expect(
        submitProfile("pro", { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Engineer" }, cv)
      ).resolves.not.toThrow();
    });

    it("returns error 'CV is required' when CV is null (initial onboarding)", async () => {
      const result = await submitProfile(
        "pro",
        { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Engineer" },
        null
      );

      expect(result).toEqual({ success: false, error: "CV is required" });
      // must not reach auth check
      expect(mockGetTokens).not.toHaveBeenCalled();
    });

    it("returns error 'CV is required' when CV is undefined (initial onboarding)", async () => {
      const result = await submitProfile(
        "pro",
        { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Engineer" }
        // cv not provided
      );

      expect(result).toEqual({ success: false, error: "CV is required" });
      expect(mockGetTokens).not.toHaveBeenCalled();
    });

    it("does NOT require CV when skipOnboardingStep=true (profile update)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      await expect(
        submitProfile(
          "pro",
          { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Engineer" },
          null,
          true // skipOnboardingStep
        )
      ).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("returns error 'Experience is required' when profileSummary.experience is empty", async () => {
      const cv = new File(["pdf content"], "resume.pdf", { type: "application/pdf" });

      const result = await submitProfile(
        "pro",
        {
          linkedinUrl: "https://linkedin.com/in/johndoe",
          profileSummary: { experience: [] },
        },
        cv
      );

      expect(result).toEqual({ success: false, error: "Experience is required" });
      expect(mockFileSave).not.toHaveBeenCalled();
      expect(mockGetTokens).not.toHaveBeenCalled();
    });

    it("does NOT require experience when profileSummary is a plain string", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const cv = new File(["pdf content"], "resume.pdf", { type: "application/pdf" });

      // profileSummary is a string, not an object — experience check is skipped
      await expect(
        submitProfile("pro", { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Engineer" }, cv)
      ).resolves.not.toThrow();
    });

    it("saves partial profile data (missing linkedinUrl) without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const cv = new File(["pdf content"], "resume.pdf", { type: "application/pdf" });

      // Only profileSummary provided — no linkedinUrl
      await expect(
        submitProfile("pro", { profileSummary: "Engineer with broad experience" }, cv)
      ).resolves.not.toThrow();

      // available data must be persisted
      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ profileSummary: "Engineer with broad experience" })
      );
    });

    it("saves partial profile data (missing profileSummary) without error", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });

      const cv = new File(["pdf content"], "resume.pdf", { type: "application/pdf" });

      // Only linkedinUrl provided — no profileSummary
      await expect(
        submitProfile("pro", { linkedinUrl: "https://linkedin.com/in/johndoe" }, cv)
      ).resolves.not.toThrow();

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ linkedinUrl: "https://linkedin.com/in/johndoe" })
      );
    });

    it("does not call Firebase Storage for invalid file type (fails before upload)", async () => {
      const cv = new File(["exe content"], "virus.exe", {
        type: "application/x-msdownload",
      });

      await submitProfile("pro", { linkedinUrl: "https://linkedin.com/in/johndoe", profileSummary: "Dev" }, cv);

      expect(mockFileSave).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
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
