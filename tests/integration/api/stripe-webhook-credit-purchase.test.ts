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

function makeCreditEvent(itemId: string, userId = "user123") {
  return {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_credits_123",
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

describe("POST /api/stripe-webhook - Credit Purchase", () => {
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

  describe("pkg_1000 credit purchase", () => {
    it("returns status 200 for pkg_1000 credit purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 500 }) });

      const res = await POST(makeWebhookRequest());

      expect(res.status).toBe(200);
    });

    it("creates a payment document for pkg_1000 purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 500 }) });

      await POST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledOnce();
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseType: "credits",
          itemId: "pkg_1000",
        })
      );
    });

    it("increments users/user123.credits by 1000 for pkg_1000", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 500 }) });

      await POST(makeWebhookRequest());

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          credits: { _increment: true, value: 1000 },
        })
      );
    });

    it("sends purchase-confirmation email for pkg_1000 purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 1500 }) });

      await POST(makeWebhookRequest());

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/send-email"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("purchase-confirmation"),
        })
      );
    });

    it("does NOT call startServer (SERVER_RUNNER_URL) for credit purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_1000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 500 }) });

      await POST(makeWebhookRequest());

      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe("pkg_2500 credit purchase", () => {
    it("increments credits by 2500 for pkg_2500", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 2500 }) });

      const res = await POST(makeWebhookRequest());

      expect(res.status).toBe(200);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          credits: { _increment: true, value: 2500 },
        })
      );
    });

    it("creates payment document with purchaseType=credits and itemId=pkg_2500", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 2500 }) });

      await POST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseType: "credits",
          itemId: "pkg_2500",
        })
      );
    });

    it("does NOT call startServer for pkg_2500 purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_2500"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 2500 }) });

      await POST(makeWebhookRequest());

      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe("pkg_5000 credit purchase", () => {
    it("increments credits by 5000 for pkg_5000", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_5000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 5000 }) });

      const res = await POST(makeWebhookRequest());

      expect(res.status).toBe(200);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          credits: { _increment: true, value: 5000 },
        })
      );
    });

    it("creates payment document with purchaseType=credits and itemId=pkg_5000", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_5000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 5000 }) });

      await POST(makeWebhookRequest());

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseType: "credits",
          itemId: "pkg_5000",
        })
      );
    });

    it("does NOT call startServer for pkg_5000 purchase", async () => {
      mockConstructEvent.mockReturnValue(makeCreditEvent("pkg_5000"));
      mockDocGet
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 5000 }) });

      await POST(makeWebhookRequest());

      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });
});
