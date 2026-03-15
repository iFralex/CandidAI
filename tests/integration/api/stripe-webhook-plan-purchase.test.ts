import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockConstructEvent,
  mockBatchSet,
  mockBatchUpdate,
  mockBatchCommit,
  mockHeadersGet,
  mockDocGet,
  mockStartServer,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockHeadersGet: vi.fn(),
  mockDocGet: vi.fn(),
  mockStartServer: vi.fn(),
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

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: mockHeadersGet }),
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
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: mockDocGet,
          }),
        }),
        get: mockDocGet,
      }),
    }),
    batch: vi.fn().mockReturnValue({
      set: mockBatchSet,
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
  },
}));

vi.mock("@/config", () => ({
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
}));

vi.mock("@/actions/onboarding-actions", () => ({
  startServer: mockStartServer,
}));

import { POST } from "@/app/api/stripe-webhook/route";

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

function makePlanEvent(itemId: string, userId = "user123") {
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

describe("POST /api/stripe-webhook - Plan Purchase", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHeadersGet.mockReturnValue("t=123,v1=fakesig");
    mockBatchCommit.mockResolvedValue(undefined);
    mockStartServer.mockResolvedValue(undefined);
    mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("base plan purchase", () => {
    it("returns status 200 for a valid base plan webhook", async () => {
      mockConstructEvent.mockReturnValue(makePlanEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      const res = await POST(makeWebhookRequest());

      expect(res.status).toBe(200);
    });

    it("creates a payment document in users/user123/payments/{paymentIntentId}", async () => {
      mockConstructEvent.mockReturnValue(makePlanEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await POST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledOnce();
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseType: "plan",
          itemId: "base",
        })
      );
    });

    it("updates user document with plan=base, maxCompanies=20, onboardingStep=50", async () => {
      mockConstructEvent.mockReturnValue(makePlanEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await POST(makeWebhookRequest());

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          plan: "base",
          maxCompanies: 20,
          onboardingStep: 50,
          credits: { _increment: true, value: 0 },
        })
      );
    });

    it("calls startServer (SERVER_RUNNER_URL) with userId for plan purchase", async () => {
      mockConstructEvent.mockReturnValue(makePlanEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await POST(makeWebhookRequest());

      expect(mockStartServer).toHaveBeenCalledWith("user123");
    });

    it("sends purchase-confirmation email via /api/send-email", async () => {
      mockConstructEvent.mockReturnValue(makePlanEvent("base"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await POST(makeWebhookRequest());

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/send-email"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("purchase-confirmation"),
        })
      );
    });
  });

  describe("pro plan purchase", () => {
    it("updates user with credits=increment(1000) and maxCompanies=50 for pro plan", async () => {
      mockConstructEvent.mockReturnValue(makePlanEvent("pro"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      const res = await POST(makeWebhookRequest());

      expect(res.status).toBe(200);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          plan: "pro",
          maxCompanies: 50,
          onboardingStep: 50,
          credits: { _increment: true, value: 1000 },
        })
      );
    });
  });

  describe("ultra plan purchase", () => {
    it("updates user with credits=increment(2500) and maxCompanies=100 for ultra plan", async () => {
      mockConstructEvent.mockReturnValue(makePlanEvent("ultra"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 2500 }) });

      const res = await POST(makeWebhookRequest());

      expect(res.status).toBe(200);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          plan: "ultra",
          maxCompanies: 100,
          onboardingStep: 50,
          credits: { _increment: true, value: 2500 },
        })
      );
    });
  });
});
