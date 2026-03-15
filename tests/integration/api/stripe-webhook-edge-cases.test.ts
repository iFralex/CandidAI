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

function makeWebhookRequest(rawBody = "{}", sig = "t=123,v1=fakesig") {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sig !== null) {
    headers["stripe-signature"] = sig;
  }
  return new Request("http://localhost:3000/api/stripe-webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function makePlanEvent(userId = "user123") {
  return {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_edge_123",
        metadata: { userId, purchaseType: "plan", itemId: "base" },
        amount: 3000,
        currency: "eur",
        status: "succeeded",
        payment_method: "pm_test",
        latest_charge: null,
      },
    },
  };
}

describe("POST /api/stripe-webhook - Edge Cases", () => {
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

  it("returns status 400 for invalid Stripe signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const res = await POST(makeWebhookRequest());

    expect(res.status).toBe(400);
  });

  it("returns status 400 for missing Stripe signature header", async () => {
    mockHeadersGet.mockReturnValue(null);
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No stripe-signature header value was provided");
    });

    const res = await POST(makeWebhookRequest("{}", ""));

    expect(res.status).toBe(400);
  });

  it("skips processing and returns status 200 for already processed event (idempotency)", async () => {
    mockConstructEvent.mockReturnValue(makePlanEvent());
    // First docGet returns exists: true (payment already processed)
    mockDocGet.mockResolvedValueOnce({ exists: true });

    const res = await POST(makeWebhookRequest());

    expect(res.status).toBe(200);
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchUpdate).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("returns status 400 for missing userId in metadata", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_no_user",
          metadata: { purchaseType: "plan", itemId: "base" }, // no userId
          amount: 3000,
          currency: "eur",
          status: "succeeded",
          payment_method: "pm_test",
          latest_charge: null,
        },
      },
    });

    const res = await POST(makeWebhookRequest());

    expect(res.status).toBe(400);
  });

  it("skips and returns status 200 for unhandled event type (payment_intent.created)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: {
        object: {
          id: "pi_test_created",
          metadata: { userId: "user123", purchaseType: "plan", itemId: "base" },
        },
      },
    });

    const res = await POST(makeWebhookRequest());

    expect(res.status).toBe(200);
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("returns status 200 and does not crash when Resend returns 429", async () => {
    mockConstructEvent.mockReturnValue(makePlanEvent());
    mockDocGet
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

    // Simulate Resend 429 rate limit response
    mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal("fetch", mockFetch);

    const res = await POST(makeWebhookRequest());

    expect(res.status).toBe(200);
  });

  it("returns status 200 and does not crash when SERVER_RUNNER_URL is unreachable", async () => {
    mockConstructEvent.mockReturnValue(makePlanEvent());
    mockDocGet
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, data: () => ({ credits: 0 }) });

    // Simulate startServer throwing (e.g., server unreachable)
    mockStartServer.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await POST(makeWebhookRequest());

    expect(res.status).toBe(200);
  });
});
