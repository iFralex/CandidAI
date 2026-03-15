import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockPaymentIntentsCreate, mockCookies } = vi.hoisted(() => ({
  mockPaymentIntentsCreate: vi.fn(),
  mockCookies: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      paymentIntents: {
        create: mockPaymentIntentsCreate,
      },
    };
  }),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/config", () => ({
  plansInfo: [
    { id: "free_trial", price: 0 },
    { id: "base", price: 30 },
    { id: "pro", price: 69 },
    { id: "ultra", price: 139 },
  ],
  CREDIT_PACKAGES: [
    { id: "pkg_1000", credits: 1000, price: 1000 },
    { id: "pkg_2500", credits: 2500, price: 2000 },
    { id: "pkg_5000", credits: 5000, price: 3000 },
  ],
}));

import { POST } from "@/app/api/create-payment/route";

const mockUser = { uid: "user123", email: "test@example.com" };
const mockUserResponseOk = { success: true, user: mockUser };

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/create-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubFetchOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockUserResponseOk),
    })
  );
}

function stubFetchUnauthorized() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })
  );
}

describe("POST /api/create-payment", () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({ toString: () => "session=test-token" });
    mockPaymentIntentsCreate.mockResolvedValue({
      client_secret: "pi_test_secret_123",
      id: "pi_test_123",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("plan purchases", () => {
    it('returns { client_secret, type: "one_time", amount: 3000 } for base plan', async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "plan",
        itemId: "base",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.client_secret).toBe("pi_test_secret_123");
      expect(body.type).toBe("one_time");
      expect(body.amount).toBe(3000);
    });

    it("returns amount: 6900 for pro plan", async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "plan",
        itemId: "pro",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.amount).toBe(6900);
    });

    it("returns amount: 13900 for ultra plan", async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "plan",
        itemId: "ultra",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.amount).toBe(13900);
    });

    it("returns error response for free_trial plan (no payment for free trial)", async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "plan",
        itemId: "free_trial",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBeDefined();
    });
  });

  describe("credit purchases", () => {
    it("returns amount: 1000 for pkg_1000", async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "credits",
        itemId: "pkg_1000",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.amount).toBe(1000);
    });

    it("returns amount: 2000 for pkg_2500", async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "credits",
        itemId: "pkg_2500",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.amount).toBe(2000);
    });

    it("returns amount: 3000 for pkg_5000", async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "credits",
        itemId: "pkg_5000",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.amount).toBe(3000);
    });
  });

  describe("validation errors", () => {
    it("returns status 400 for invalid itemId (unknown plan)", async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "plan",
        itemId: "nonexistent_plan",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns status 400 for invalid purchaseType", async () => {
      stubFetchOk();
      const req = makePostRequest({
        purchaseType: "invalid_type",
        itemId: "base",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns status 400 when body fields are missing", async () => {
      const req = makePostRequest({});
      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  describe("error handling", () => {
    it("returns status 500 when Stripe API returns an error", async () => {
      stubFetchOk();
      mockPaymentIntentsCreate.mockRejectedValue(
        new Error("Stripe error: Your card was declined.")
      );
      const req = makePostRequest({
        purchaseType: "plan",
        itemId: "base",
        payment_method_id: "pm_test_fail",
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
    });

    it("returns status 401 when request has no auth", async () => {
      stubFetchUnauthorized();
      const req = makePostRequest({
        purchaseType: "plan",
        itemId: "base",
        payment_method_id: "pm_test",
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });
  });
});
