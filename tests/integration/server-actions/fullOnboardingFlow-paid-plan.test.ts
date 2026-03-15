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
  mockConstructEvent,
  mockHeadersGet,
  mockDocGet,
  mockStartServer,
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
  mockConstructEvent: vi.fn(),
  mockHeadersGet: vi.fn(),
  mockDocGet: vi.fn(),
  mockStartServer: vi.fn(),
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
  headers: vi.fn().mockResolvedValue({ get: mockHeadersGet }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      webhooks: {
        constructEvent: mockConstructEvent,
      },
      charges: {
        retrieve: vi.fn().mockResolvedValue({ receipt_url: null }),
      },
    };
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: (n: number) => ({ _increment: true, value: n }),
  },
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: mockUserGet,
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: mockDocGet,
          }),
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
  plansInfo: [
    { id: "free_trial", name: "Free Trial", price: 0 },
    { id: "base", name: "Base", price: 30 },
    { id: "pro", name: "Pro", price: 69 },
    { id: "ultra", name: "Ultra", price: 139 },
  ],
  CREDIT_PACKAGES: [
    { id: "pkg_1000", credits: 1000, price: 1000 },
    { id: "pkg_2500", credits: 2500, price: 2000 },
    { id: "pkg_5000", credits: 5000, price: 3000 },
  ],
  plansData: {
    free_trial: { credits: 0, maxCompanies: 1 },
    base: { credits: 0, maxCompanies: 20 },
    pro: { credits: 1000, maxCompanies: 50 },
    ultra: { credits: 2500, maxCompanies: 100 },
  },
  creditsInfo: {},
}));

vi.mock("@/actions/onboarding-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/actions/onboarding-actions")>();
  return {
    ...actual,
    startServer: mockStartServer,
  };
});

import {
  selectPlan,
  submitCompanies,
  submitProfile,
  submitQueries,
  completeOnboarding,
} from "@/actions/onboarding-actions";
import { POST as stripeWebhookPOST } from "@/app/api/stripe-webhook/route";

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

function makeWebhookRequest(rawBody = "{}") {
  return new Request("http://localhost:3000/api/stripe-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "t=123,v1=fakesig",
    },
    body: rawBody,
  });
}

function makePlanWebhookEvent(itemId: string, userId = "user123") {
  return {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_123",
        metadata: { userId, purchaseType: "plan", itemId },
        amount: 3000,
        currency: "eur",
        status: "succeeded",
        payment_method: "pm_test",
        latest_charge: null,
      },
    },
  };
}

function resetServerActionMocks() {
  mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
  mockBatchCommit.mockResolvedValue(undefined);
  mockRedirect.mockReturnValue(undefined);
  mockFileSave.mockResolvedValue(undefined);
  mockGetSignedUrl.mockResolvedValue([FAKE_SIGNED_URL]);
  mockUserGet.mockResolvedValue({ data: () => ({ plan: "base" }) });
  vi.stubGlobal("fetch", mockFetch);
}

describe("Full Onboarding Flow - Paid Plan (base)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    resetServerActionMocks();
  });

  describe("Step 1: selectPlan('base')", () => {
    it("completes without error", async () => {
      await expect(selectPlan("base")).resolves.not.toThrow();
    });

    it("sets plan='base' on the user document", async () => {
      await selectPlan("base");

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ plan: "base" })
      );
    });

    it("updates onboardingStep=2 for the user", async () => {
      await selectPlan("base");

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ onboardingStep: 2 })
      );
    });

    it("commits the batch exactly once", async () => {
      await selectPlan("base");

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step 2: submitCompanies", () => {
    it("completes without error for a single valid company", async () => {
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

      expect(mockBatchSet).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step 3: submitProfile", () => {
    it("completes without error with valid profile and CV", async () => {
      await expect(
        submitProfile("base", validProfileData, mockCVFile)
      ).resolves.not.toThrow();
    });

    it("uploads CV to Firebase Storage and sets cvUrl", async () => {
      await submitProfile("base", validProfileData, mockCVFile);

      expect(mockFileSave).toHaveBeenCalledOnce();
      expect(mockGetSignedUrl).toHaveBeenCalledOnce();
    });

    it("updates onboardingStep=4 for the user", async () => {
      await submitProfile("base", validProfileData, mockCVFile);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 4 }
      );
    });

    it("saves profile data with cvUrl to the data/account document", async () => {
      await submitProfile("base", validProfileData, mockCVFile);

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
      await submitProfile("base", validProfileData, mockCVFile);

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

  describe("Step 5: completeOnboarding - paid plan waits for payment", () => {
    it("completes without error", async () => {
      await expect(
        completeOnboarding({ instructions: "Be professional" })
      ).resolves.not.toThrow();
    });

    it("sets onboardingStep=6 (waiting for payment), not 50", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      const stepUpdateCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "onboardingStep" in data
      );
      expect(stepUpdateCall).toBeDefined();
      expect(stepUpdateCall![1].onboardingStep).toBe(6);
    });

    it("saves customizations to the data/account document", async () => {
      const customizations = { instructions: "Be professional" };

      await completeOnboarding(customizations);

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { customizations }
      );
    });

    it("does NOT call startServer before Stripe payment is confirmed", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockStartServer).not.toHaveBeenCalled();
    });

    it("does NOT call fetch (startServer) before Stripe payment is confirmed", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("redirects to /dashboard after completeOnboarding", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("commits batch exactly once", async () => {
      await completeOnboarding({ instructions: "Be professional" });

      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Stripe webhook for plan purchase - sets onboardingStep=50", () => {
    beforeEach(() => {
      // Reset mockDocGet queue to avoid leaking unconsumed mockResolvedValueOnce values
      mockDocGet.mockReset();
      mockHeadersGet.mockReturnValue("t=123,v1=fakesig");
      mockBatchCommit.mockResolvedValue(undefined);
      mockStartServer.mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);
    });

    it("returns status 200 for valid base plan webhook", async () => {
      mockConstructEvent.mockReturnValue(makePlanWebhookEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      const res = await stripeWebhookPOST(makeWebhookRequest());

      expect(res.status).toBe(200);
    });

    it("sets plan='base' on the user document via webhook", async () => {
      mockConstructEvent.mockReturnValue(makePlanWebhookEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ plan: "base" })
      );
    });

    it("sets maxCompanies=20 for base plan via webhook", async () => {
      mockConstructEvent.mockReturnValue(makePlanWebhookEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ maxCompanies: 20 })
      );
    });

    it("sets onboardingStep=50 via Stripe webhook (not 6 anymore)", async () => {
      mockConstructEvent.mockReturnValue(makePlanWebhookEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ onboardingStep: 50 })
      );
    });

    it("calls startServer with userId after Stripe webhook for plan purchase", async () => {
      mockConstructEvent.mockReturnValue(makePlanWebhookEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockStartServer).toHaveBeenCalledWith("user123");
    });

    it("creates a payment document in Firestore via webhook", async () => {
      mockConstructEvent.mockReturnValue(makePlanWebhookEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledOnce();
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ purchaseType: "plan", itemId: "base" })
      );
    });
  });

  describe("Complete sequential flow - paid plan end-to-end", () => {
    it("all 5 server action steps complete without error in sequence", async () => {
      // Step 1
      await expect(selectPlan("base")).resolves.not.toThrow();
      vi.clearAllMocks();
      resetServerActionMocks();

      // Step 2
      await expect(
        submitCompanies([{ name: "TestCo", domain: "testco.com" }])
      ).resolves.not.toThrow();
      vi.clearAllMocks();
      resetServerActionMocks();

      // Step 3
      await expect(
        submitProfile("base", validProfileData, mockCVFile)
      ).resolves.not.toThrow();
      vi.clearAllMocks();
      resetServerActionMocks();

      // Step 4
      await expect(submitQueries(validQueries)).resolves.not.toThrow();
      vi.clearAllMocks();
      resetServerActionMocks();

      // Step 5
      await expect(
        completeOnboarding({ instructions: "Be professional" })
      ).resolves.not.toThrow();
    });

    it("onboardingStep progresses 2→3→4→5→6 across all server action steps", async () => {
      // Step 1: selectPlan sets plan and onboardingStep=2
      await selectPlan("base");
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ plan: "base", onboardingStep: 2 })
      );
      vi.clearAllMocks();
      resetServerActionMocks();

      // Step 2: submitCompanies sets onboardingStep=3
      await submitCompanies([{ name: "TestCo", domain: "testco.com" }]);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 3 }
      );
      vi.clearAllMocks();
      resetServerActionMocks();

      // Step 3: submitProfile sets onboardingStep=4
      await submitProfile("base", validProfileData, mockCVFile);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 4 }
      );
      vi.clearAllMocks();
      resetServerActionMocks();

      // Step 4: submitQueries sets onboardingStep=5
      await submitQueries(validQueries);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStep: 5 }
      );
      vi.clearAllMocks();
      resetServerActionMocks();

      // Step 5: completeOnboarding sets onboardingStep=6 (waits for payment)
      await completeOnboarding({ instructions: "Be professional" });
      const stepCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "onboardingStep" in data
      );
      expect(stepCall).toBeDefined();
      expect(stepCall![1].onboardingStep).toBe(6);
    });

    it("startServer is NOT called during any server action step", async () => {
      // Steps 1-5 should not trigger startServer
      await selectPlan("base");
      vi.clearAllMocks();
      resetServerActionMocks();

      await submitCompanies([{ name: "TestCo", domain: "testco.com" }]);
      vi.clearAllMocks();
      resetServerActionMocks();

      await submitProfile("base", validProfileData, mockCVFile);
      vi.clearAllMocks();
      resetServerActionMocks();

      await submitQueries(validQueries);
      vi.clearAllMocks();
      resetServerActionMocks();

      await completeOnboarding({ instructions: "Be professional" });

      // startServer should never have been called across all 5 steps
      expect(mockStartServer).not.toHaveBeenCalled();
    });

    it("Stripe webhook transitions state from onboardingStep=6 to 50 with plan='base'", async () => {
      // Simulate server action phase ends at onboardingStep=6
      await completeOnboarding({ instructions: "Be professional" });
      const stepAfterComplete = mockBatchUpdate.mock.calls.find(
        ([, data]) => data && "onboardingStep" in data
      );
      expect(stepAfterComplete![1].onboardingStep).toBe(6);

      vi.clearAllMocks();
      mockDocGet.mockReset();

      // Now simulate Stripe webhook completing the flow
      mockHeadersGet.mockReturnValue("t=123,v1=fakesig");
      mockStartServer.mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);
      mockConstructEvent.mockReturnValue(makePlanWebhookEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      const res = await stripeWebhookPOST(makeWebhookRequest());

      expect(res.status).toBe(200);
      // Final state: plan="base", onboardingStep=50, maxCompanies=20
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          plan: "base",
          onboardingStep: 50,
          maxCompanies: 20,
        })
      );
      // startServer is called by webhook
      expect(mockStartServer).toHaveBeenCalledWith("user123");
    });
  });

  describe("authentication — flow stops on auth failure", () => {
    it("selectPlan throws when not authenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(selectPlan("base")).rejects.toThrow();
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
        submitProfile("base", validProfileData, mockCVFile)
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
