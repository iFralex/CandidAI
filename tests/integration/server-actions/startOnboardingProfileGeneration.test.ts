import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockCookiesGet,
  mockAccountGet,
  mockPreviewGet,
  mockPreviewSetOutsideTx,
  mockTxSet,
  mockTxUpdate,
  mockAnalyticsAdd,
  mockRedirect,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockCookiesGet: vi.fn(),
  mockAccountGet: vi.fn(),
  mockPreviewGet: vi.fn(),
  mockPreviewSetOutsideTx: vi.fn(),
  mockTxSet: vi.fn(),
  mockTxUpdate: vi.fn(),
  mockAnalyticsAdd: vi.fn(),
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
    get: mockCookiesGet,
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

// Firestore mock shaped for startOnboardingProfileGeneration:
//   users/{uid} -> userRef
//     .collection("data").doc("account") -> accountRef { get: mockAccountGet }
//     .collection("data").doc("onboarding_preview") -> previewRef { get: mockPreviewGet, set: mockPreviewSetOutsideTx }
//   _onboarding_jobs -> auto-id generator for the candidate job id
//   analytics_events -> .add() used by recordOnboardingSignal
//   runTransaction(cb) invokes cb with { get: ref => ref.get(), set: mockTxSet, update: mockTxUpdate }
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "_onboarding_jobs") {
        return { doc: vi.fn().mockReturnValue({ id: "generated-job-id-123" }) };
      }
      if (name === "analytics_events") {
        return { add: mockAnalyticsAdd };
      }
      if (name === "users") {
        return {
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn((docName: string) => {
                if (docName === "account") return { get: mockAccountGet };
                if (docName === "onboarding_preview") return { get: mockPreviewGet, set: mockPreviewSetOutsideTx };
                return {};
              }),
            }),
          }),
        };
      }
      return { doc: vi.fn().mockReturnValue({}) };
    }),
    runTransaction: vi.fn(async (cb: any) => cb({
      get: vi.fn((ref: any) => ref.get()),
      set: mockTxSet,
      update: mockTxUpdate,
    })),
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

import { startOnboardingProfileGeneration } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const snap = (data: Record<string, any> | undefined) => ({ data: () => data });

describe("startOnboardingProfileGeneration server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockCookiesGet.mockReturnValue(undefined);
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
    mockAnalyticsAdd.mockResolvedValue(undefined);
    mockPreviewSetOutsideTx.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe("happy path — no job running, account has linkedinUrl", () => {
    beforeEach(() => {
      mockAccountGet.mockResolvedValue(snap({ linkedinUrl: "https://linkedin.com/in/someone" }));
      mockPreviewGet.mockResolvedValue(snap(undefined));
    });

    it("writes profileStatus:'queued' on the preview doc via the transaction", async () => {
      await startOnboardingProfileGeneration();

      const setCall = mockTxSet.mock.calls.find(([, data]) => data?.profileStatus !== undefined);
      expect(setCall).toBeDefined();
      expect(setCall![1]).toMatchObject({
        profileJobId: "generated-job-id-123",
        profileStatus: "queued",
        profileProgress: "Queued",
      });
      expect(setCall![2]).toEqual({ merge: true });
    });

    it("sets onboardingStage:'target_company' and onboardingStep:3 on the user doc via the transaction", async () => {
      await startOnboardingProfileGeneration();

      expect(mockTxUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { onboardingStage: "target_company", onboardingStep: 3 }
      );
    });

    it("calls the bridge hitting /start_onboarding_profile", async () => {
      await startOnboardingProfileGeneration();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(String(url)).toMatch(/\/start_onboarding_profile$/);
    });

    it("returns { success: true, jobId, resumed: false }", async () => {
      const result = await startOnboardingProfileGeneration();

      expect(result).toEqual({ success: true, jobId: "generated-job-id-123", resumed: false });
    });
  });

  describe("resumed — profileStatus already 'running'", () => {
    beforeEach(() => {
      mockAccountGet.mockResolvedValue(snap({ linkedinUrl: "https://linkedin.com/in/someone" }));
      mockPreviewGet.mockResolvedValue(snap({ profileJobId: "existing-job-999", profileStatus: "running" }));
    });

    it("returns { resumed: true } without touching the transaction writes", async () => {
      const result = await startOnboardingProfileGeneration();

      expect(result).toEqual({ success: true, jobId: "existing-job-999", resumed: true });
      expect(mockTxSet).not.toHaveBeenCalled();
      expect(mockTxUpdate).not.toHaveBeenCalled();
    });

    it("does NOT call the bridge (fetch) when resumed", async () => {
      await startOnboardingProfileGeneration();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("neither linkedinUrl nor cvUrl on the account", () => {
    beforeEach(() => {
      mockAccountGet.mockResolvedValue(snap({}));
      mockPreviewGet.mockResolvedValue(snap(undefined));
    });

    it("throws", async () => {
      await expect(startOnboardingProfileGeneration()).rejects.toThrow(/LinkedIn or CV is required/);
    });

    it("does not call the bridge (fetch)", async () => {
      try {
        await startOnboardingProfileGeneration();
      } catch {
        // expected
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("bridge failure", () => {
    beforeEach(() => {
      mockAccountGet.mockResolvedValue(snap({ linkedinUrl: "https://linkedin.com/in/someone" }));
      mockPreviewGet.mockResolvedValue(snap(undefined));
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
    });

    it("marks the preview profileStatus:'failed' and rethrows", async () => {
      await expect(startOnboardingProfileGeneration()).rejects.toThrow();

      expect(mockPreviewSetOutsideTx).toHaveBeenCalledWith(
        expect.objectContaining({ profileStatus: "failed" }),
        { merge: true }
      );
    });
  });

  describe("authentication", () => {
    it("throws when tokens are null", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(startOnboardingProfileGeneration()).rejects.toThrow();
    });

    it("does not touch Firestore when unauthenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      try {
        await startOnboardingProfileGeneration();
      } catch {
        // expected
      }
      expect(mockTxSet).not.toHaveBeenCalled();
    });
  });
});
