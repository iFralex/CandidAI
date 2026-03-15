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

function makeCreditEvent(
  itemId: string,
  paymentIntentId = "pi_idempotency_test_123",
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

describe("POST /api/stripe-webhook - Idempotency", () => {
  beforeEach(() => {
    mockHeadersGet.mockReturnValue("t=123,v1=fakesig");
    mockBatchCommit.mockResolvedValue(undefined);
    mockStartServer.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Duplicate paymentIntentId - credits only incremented once", () => {
    it("first webhook call (payment not yet recorded) processes normally and returns 200", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_1000"));
      // Payment document does not exist yet -> process payment
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      const res = await POST(makeWebhookRequest());

      expect(res.status).toBe(200);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ credits: { _increment: true, value: 1000 } })
      );
      expect(mockBatchSet).toHaveBeenCalledOnce();
    });

    it("second webhook call with same paymentIntentId (payment already recorded) returns 200 without incrementing credits", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_1000"));
      // Payment document already exists -> skip (idempotent)
      mockDocGet.mockResolvedValueOnce({ exists: true });

      const res = await POST(makeWebhookRequest());

      expect(res.status).toBe(200);
      // Credits must NOT be incremented on duplicate
      expect(mockBatchUpdate).not.toHaveBeenCalled();
    });

    it("same paymentIntentId sent twice: batchUpdate called exactly once total", async () => {
      const event = makeCreditEvent("pkg_1000");
      mockConstructEvent.mockReturnValue(event);

      // First call: payment doc does not exist
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1000 }) });

      await POST(makeWebhookRequest());

      const firstCallUpdateCount = mockBatchUpdate.mock.calls.length;
      expect(firstCallUpdateCount).toBe(1);

      // Second call: payment doc now exists (simulate already processed)
      mockDocGet.mockResolvedValueOnce({ exists: true });

      await POST(makeWebhookRequest());

      // batchUpdate call count must not have increased
      expect(mockBatchUpdate).toHaveBeenCalledTimes(firstCallUpdateCount);
    });
  });

  describe("Payment document not duplicated on repeated webhook", () => {
    it("first webhook call creates exactly one payment document", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 2500 }) });

      await POST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledTimes(1);
    });

    it("second webhook call with same paymentIntentId does NOT call batchSet (no duplicate doc)", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_2500"));
      // Payment doc already exists
      mockDocGet.mockResolvedValueOnce({ exists: true });

      await POST(makeWebhookRequest());

      expect(mockBatchSet).not.toHaveBeenCalled();
    });

    it("same paymentIntentId sent twice: batchSet called exactly once total", async () => {
      const event = makeCreditEvent("pkg_5000");
      mockConstructEvent.mockReturnValue(event);

      // First call
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 5000 }) });

      await POST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledTimes(1);

      // Second call: already processed
      mockDocGet.mockResolvedValueOnce({ exists: true });

      await POST(makeWebhookRequest());

      // batchSet must still be exactly 1 - no duplicate document created
      expect(mockBatchSet).toHaveBeenCalledTimes(1);
    });

    it("batchCommit not called on duplicate webhook (no batch operations run)", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_1000"));
      // Already processed
      mockDocGet.mockResolvedValueOnce({ exists: true });

      await POST(makeWebhookRequest());

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });
});
