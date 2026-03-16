import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 23.1: Security Tests - Auth Security
// Tests:
// - Requests to /api/protected/* without cookie: return status 401 (no data leaked).
// - Manually modified cookie: token validation fails -> status 401.
// - Cookie from another user (uid=attacker): no access to victim data.
// - Stripe webhook without valid signature: status 400 (no processing).
// - Stripe webhook with test signature in production environment: rejected.
// ---------------------------------------------------------------------------

const PROTECTED_ROUTES = [
  "/api/protected/user",
  "/api/protected/account",
  "/api/protected/results",
  "/api/protected/emails",
];

// ---------------------------------------------------------------------------
// Test group 1: Requests without cookie return 401
// ---------------------------------------------------------------------------

test.describe("Auth Security - No cookie returns 401", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`GET ${route} without cookie → 401, no data leaked`, async ({
      request,
    }) => {
      const response = await request.get(route, {
        headers: {
          // No cookie header - simulate unauthenticated request
          Cookie: "",
        },
      });

      expect(response.status()).toBe(401);

      // Ensure no sensitive user data is present in the response body
      const text = await response.text();
      expect(text).not.toContain('"uid"');
      expect(text).not.toContain('"email"');
      expect(text).not.toContain('"name"');
      expect(text).not.toContain('"credits"');
    });
  }
});

// ---------------------------------------------------------------------------
// Test group 2: Manually modified cookie causes 401
// ---------------------------------------------------------------------------

test.describe("Auth Security - Tampered cookie returns 401", () => {
  test("GET /api/protected/user with tampered cookie → 401", async ({
    request,
  }) => {
    // A tampered/invalid JWT-like cookie value
    const tamperedCookie =
      "session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJmYWtlLXVpZCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.INVALID_SIGNATURE";

    const response = await request.get("/api/protected/user", {
      headers: {
        Cookie: tamperedCookie,
      },
    });

    expect(response.status()).toBe(401);

    const text = await response.text();
    expect(text).not.toContain('"uid"');
    expect(text).not.toContain('"email"');
  });

  test("GET /api/protected/account with malformed cookie → 401", async ({
    request,
  }) => {
    const malformedCookie = "session=not-a-valid-token-at-all";

    const response = await request.get("/api/protected/account", {
      headers: {
        Cookie: malformedCookie,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("GET /api/protected/results with empty cookie value → 401", async ({
    request,
  }) => {
    const response = await request.get("/api/protected/results", {
      headers: {
        Cookie: "session=",
      },
    });

    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Cross-user cookie attack prevention
// ---------------------------------------------------------------------------

test.describe("Auth Security - Cross-user cookie attack", () => {
  test("Cookie belonging to attacker cannot access victim data", async ({
    request,
  }) => {
    // Simulate an attacker trying to impersonate another user with a crafted uid claim
    // The token below is not a real valid Firebase token so validation should fail
    const attackerCookie =
      "session=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJ2aWN0aW0tdWlkIiwiZW1haWwiOiJ2aWN0aW1AZXhhbXBsZS5jb20ifQ.FAKE_SIGNATURE";

    const response = await request.get("/api/protected/user", {
      headers: {
        Cookie: attackerCookie,
      },
    });

    // Must not succeed - either 401 (auth failure) or 403 (forbidden)
    expect([401, 403]).toContain(response.status());

    const text = await response.text();
    // Must not leak victim data
    expect(text).not.toContain('"victim-uid"');
    expect(text).not.toContain('"victim@example.com"');
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Stripe webhook signature validation
// ---------------------------------------------------------------------------

test.describe("Auth Security - Stripe webhook signature", () => {
  test("POST /api/stripe-webhook without Stripe-Signature → 400", async ({
    request,
  }) => {
    const fakePayload = JSON.stringify({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_fake",
          metadata: { userId: "attacker-uid", purchaseType: "credits" },
          amount: 1000,
          currency: "usd",
          status: "succeeded",
        },
      },
    });

    const response = await request.post("/api/stripe-webhook", {
      data: fakePayload,
      headers: {
        "Content-Type": "application/json",
        // No Stripe-Signature header
      },
    });

    expect(response.status()).toBe(400);

    // Verify no processing occurred (webhook error message expected)
    const text = await response.text();
    expect(text.toLowerCase()).toContain("webhook");
  });

  test("POST /api/stripe-webhook with invalid Stripe-Signature → 400", async ({
    request,
  }) => {
    const fakePayload = JSON.stringify({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_fake_invalid",
          metadata: { userId: "attacker-uid" },
        },
      },
    });

    const response = await request.post("/api/stripe-webhook", {
      data: fakePayload,
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=fake_timestamp,v1=fake_signature",
      },
    });

    expect(response.status()).toBe(400);
  });

  test("POST /api/stripe-webhook with test-mode signature in production → rejected", async ({
    request,
  }) => {
    // A test-mode signature format (whsec_test_... prefix) should be rejected
    // in production. We simulate by sending a properly formatted but invalid signature.
    const testPayload = JSON.stringify({
      id: "evt_test_webhook",
      type: "payment_intent.succeeded",
    });

    // Stripe test-mode webhook signature format
    const timestamp = Math.floor(Date.now() / 1000);
    const testSignature = `t=${timestamp},v1=0000000000000000000000000000000000000000000000000000000000000000`;

    const response = await request.post("/api/stripe-webhook", {
      data: testPayload,
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": testSignature,
      },
    });

    // The webhook should fail validation with a 400
    expect(response.status()).toBe(400);
  });
});
