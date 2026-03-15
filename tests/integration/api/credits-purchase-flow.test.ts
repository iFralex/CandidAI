import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockPaymentIntentsCreate,
  mockConstructEvent,
  mockBatchSet,
  mockBatchUpdate,
  mockBatchCommit,
  mockHeadersGet,
  mockDocGet,
  mockStartServer,
  mockCookies,
} = vi.hoisted(() => ({
  mockPaymentIntentsCreate: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockHeadersGet: vi.fn(),
  mockDocGet: vi.fn(),
  mockStartServer: vi.fn(),
  mockCookies: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      paymentIntents: {
        create: mockPaymentIntentsCreate,
      },
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
  cookies: mockCookies,
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

import { POST as createPaymentPOST } from "@/app/api/create-payment/route";
import { POST as stripeWebhookPOST } from "@/app/api/stripe-webhook/route";

const mockUser = { uid: "user123", email: "test@example.com" };

function makeCreatePaymentRequest(purchaseType: string, itemId: string) {
  return new Request("http://localhost:3000/api/create-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchaseType, itemId, payment_method_id: "pm_test" }),
  });
}

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

function makeCreditWebhookEvent(
  itemId: string,
  paymentIntentId = "pi_test_credits_123",
  userId = "user123"
) {
  return {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: paymentIntentId,
        metadata: { userId, purchaseType: "credits", itemId },
        amount: 1000,
        currency: "eur",
        status: "succeeded",
        payment_method: "pm_test",
        latest_charge: null,
      },
    },
  };
}

function stubFetchForAuth() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, user: mockUser }),
    })
  );
}

describe("Credits Purchase Flow - End-to-End Integration", () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({ toString: () => "session=test-token" });
    mockPaymentIntentsCreate.mockResolvedValue({
      client_secret: "pi_test_secret_credits_123",
      id: "pi_test_credits_123",
    });
    mockHeadersGet.mockReturnValue("t=123,v1=fakesig");
    mockBatchCommit.mockResolvedValue(undefined);
    mockStartServer.mockResolvedValue(undefined);
    stubFetchForAuth();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Setup: Authenticated user with credits=0, base plan", () => {
    it("create-payment returns client_secret for pkg_1000 credits purchase", async () => {
      const req = makeCreatePaymentRequest("credits", "pkg_1000");
      const res = await createPaymentPOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.client_secret).toBe("pi_test_secret_credits_123");
    });

    it("create-payment sets amount=1000 for pkg_1000", async () => {
      const req = makeCreatePaymentRequest("credits", "pkg_1000");
      const res = await createPaymentPOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.amount).toBe(1000);
    });
  });

  describe("pkg_1000: user starts with credits=0, webhook increments to 1000", () => {
    it("webhook returns status 200 for pkg_1000 credit purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      const res = await stripeWebhookPOST(makeWebhookRequest());

      expect(res.status).toBe(200);
    });

    it("webhook increments credits by 1000 (not replaces) for user starting at 0", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          credits: { _increment: true, value: 1000 },
        })
      );
    });

    it("creates payment document in users/{uid}/payments/ for pkg_1000", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledOnce();
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseType: "credits",
          itemId: "pkg_1000",
        })
      );
    });

    it("sends purchase-confirmation email after pkg_1000 webhook", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/send-email"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("purchase-confirmation"),
        })
      );
    });

    it("does NOT call startServer (not a plan purchase) for pkg_1000", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe("pkg_2500: user has 1000 credits, webhook results in 3500 (increment, not replace)", () => {
    it("webhook returns status 200 for pkg_2500 credit purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      const res = await stripeWebhookPOST(makeWebhookRequest());

      expect(res.status).toBe(200);
    });

    it("webhook increments credits by 2500 (user at 1000 ends at 3500, not 2500)", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      // Uses FieldValue.increment(2500), not set to 2500
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          credits: { _increment: true, value: 2500 },
        })
      );
    });

    it("creates payment document for pkg_2500 purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseType: "credits",
          itemId: "pkg_2500",
        })
      );
    });

    it("does NOT call startServer for pkg_2500 credit purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe("pkg_5000: webhook increments credits by 5000", () => {
    it("webhook returns status 200 for pkg_5000 credit purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_5000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      const res = await stripeWebhookPOST(makeWebhookRequest());

      expect(res.status).toBe(200);
    });

    it("webhook increments credits by 5000 for pkg_5000", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_5000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          credits: { _increment: true, value: 5000 },
        })
      );
    });

    it("creates payment document for pkg_5000 purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_5000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseType: "credits",
          itemId: "pkg_5000",
        })
      );
    });

    it("does NOT call startServer for pkg_5000 credit purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_5000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      await stripeWebhookPOST(makeWebhookRequest());

      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe("Full flow: create-payment then webhook for credits", () => {
    it("pkg_1000: create-payment succeeds then webhook increments credits by 1000", async () => {
      // Step 1: Call create-payment
      const createReq = makeCreatePaymentRequest("credits", "pkg_1000");
      const createRes = await createPaymentPOST(createReq);
      const createBody = await createRes.json();

      expect(createRes.status).toBe(200);
      expect(createBody.client_secret).toBeDefined();

      // Step 2: Simulate Stripe webhook (payment confirmed)
      vi.clearAllMocks();
      mockBatchCommit.mockResolvedValue(undefined);
      mockStartServer.mockResolvedValue(undefined);
      mockHeadersGet.mockReturnValue("t=123,v1=fakesig");
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

      const webhookRes = await stripeWebhookPOST(makeWebhookRequest());

      expect(webhookRes.status).toBe(200);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ credits: { _increment: true, value: 1000 } })
      );
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ purchaseType: "credits", itemId: "pkg_1000" })
      );
    });

    it("pkg_2500: create-payment succeeds then webhook increments from 1000 to 3500", async () => {
      // Step 1: Call create-payment
      const createReq = makeCreatePaymentRequest("credits", "pkg_2500");
      const createRes = await createPaymentPOST(createReq);
      const createBody = await createRes.json();

      expect(createRes.status).toBe(200);
      expect(createBody.amount).toBe(2000);

      // Step 2: Simulate webhook with user having 1000 existing credits
      vi.clearAllMocks();
      mockBatchCommit.mockResolvedValue(undefined);
      mockStartServer.mockResolvedValue(undefined);
      mockHeadersGet.mockReturnValue("t=123,v1=fakesig");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      mockConstructEvent.mockReturnValue(makeCreditWebhookEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      const webhookRes = await stripeWebhookPOST(makeWebhookRequest());

      expect(webhookRes.status).toBe(200);
      // Increment by 2500 means: 1000 + 2500 = 3500 total
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ credits: { _increment: true, value: 2500 } })
      );
    });
  });
});
