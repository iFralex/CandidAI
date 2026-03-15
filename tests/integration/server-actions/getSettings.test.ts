import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockSettingsGet,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockSettingsGet: vi.fn(),
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

// Firestore chain:
//   collection("users").doc(userId)
//     .collection("data").doc("settings")
//       .get() → mockSettingsGet
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: mockSettingsGet,
          }),
        }),
      }),
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

import { getSettings } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const makeSettingsSnap = (data: Record<string, unknown>) => ({
  exists: true,
  data: () => data,
});

const makeEmptySnap = () => ({
  exists: false,
  data: () => undefined,
});

describe("getSettings server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
  });

  describe("returns notification settings from Firestore", () => {
    it("returns marketingEmails and reminderFrequency from Firestore when document exists", async () => {
      mockSettingsGet.mockResolvedValue(
        makeSettingsSnap({
          preferences: { marketingEmails: false, reminderFrequency: "daily" },
        })
      );

      const result = await getSettings();

      expect(result).toMatchObject({
        marketingEmails: false,
        reminderFrequency: "daily",
      });
    });

    it("returns marketingEmails: true when preferences.marketingEmails is true", async () => {
      mockSettingsGet.mockResolvedValue(
        makeSettingsSnap({
          preferences: { marketingEmails: true, reminderFrequency: "weekly" },
        })
      );

      const result = await getSettings();

      expect(result.marketingEmails).toBe(true);
    });

    it("returns correct reminderFrequency value from Firestore", async () => {
      mockSettingsGet.mockResolvedValue(
        makeSettingsSnap({
          preferences: { marketingEmails: false, reminderFrequency: "monthly" },
        })
      );

      const result = await getSettings();

      expect(result.reminderFrequency).toBe("monthly");
    });

    it("returns default marketingEmails: true when preferences object lacks the field", async () => {
      mockSettingsGet.mockResolvedValue(
        makeSettingsSnap({
          preferences: { reminderFrequency: "daily" },
        })
      );

      const result = await getSettings();

      expect(result.marketingEmails).toBe(true);
    });

    it("returns default reminderFrequency: weekly when preferences object lacks the field", async () => {
      mockSettingsGet.mockResolvedValue(
        makeSettingsSnap({
          preferences: { marketingEmails: false },
        })
      );

      const result = await getSettings();

      expect(result.reminderFrequency).toBe("weekly");
    });

    it("returns both defaults when preferences object is empty", async () => {
      mockSettingsGet.mockResolvedValue(
        makeSettingsSnap({ preferences: {} })
      );

      const result = await getSettings();

      expect(result).toMatchObject({
        marketingEmails: true,
        reminderFrequency: "weekly",
      });
    });

    it("returns both defaults when settings doc has no preferences field", async () => {
      mockSettingsGet.mockResolvedValue(makeSettingsSnap({}));

      const result = await getSettings();

      expect(result).toMatchObject({
        marketingEmails: true,
        reminderFrequency: "weekly",
      });
    });
  });

  describe("user without saved settings — returns defaults", () => {
    it("returns default settings when settings document does not exist", async () => {
      mockSettingsGet.mockResolvedValue(makeEmptySnap());

      const result = await getSettings();

      expect(result).toMatchObject({
        marketingEmails: true,
        reminderFrequency: "weekly",
      });
    });

    it("returns marketingEmails: true as default when no settings doc", async () => {
      mockSettingsGet.mockResolvedValue(makeEmptySnap());

      const result = await getSettings();

      expect(result.marketingEmails).toBe(true);
    });

    it("returns reminderFrequency: weekly as default when no settings doc", async () => {
      mockSettingsGet.mockResolvedValue(makeEmptySnap());

      const result = await getSettings();

      expect(result.reminderFrequency).toBe("weekly");
    });
  });
});
