import { test, expect, APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 23.3: Security Tests - Rate Limiting
// Tests:
// - 10+ requests to POST /api/auth in 1 minute from same IP:
//   rate limit activated (if implemented).
// - 10+ requests to POST /api/auth/forgot-password:
//   rate limit activated (if implemented).
//
// NOTE: Rate limiting is optional in this application ("if implemented").
// These tests verify that IF rate limiting is active, it correctly returns
// 429 Too Many Requests after the threshold. If rate limiting is not
// implemented, we verify the endpoint handles repeated requests without
// crashing (no 500 errors) and still rejects invalid credentials.
// ---------------------------------------------------------------------------

const RATE_LIMIT_THRESHOLD = 10;
const RATE_LIMIT_STATUS = 429;

// ---------------------------------------------------------------------------
// Helper: send N rapid requests to an endpoint and collect response statuses
// ---------------------------------------------------------------------------

async function sendRapidRequests(
  request: APIRequestContext,
  count: number,
  url: string,
  body: Record<string, string>
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i++) {
    const response = await request.post(url, {
      data: body,
      headers: {
        "Content-Type": "application/json",
      },
    });
    statuses.push(response.status());
  }
  return statuses;
}

// ---------------------------------------------------------------------------
// Test group 1: Rate limiting on POST /api/auth
// Send 11 rapid login attempts with invalid credentials.
// If rate limiting is implemented: at least one response should be 429.
// If not implemented: all responses should be non-500 (API stays stable).
// ---------------------------------------------------------------------------

test.describe("Rate Limiting - POST /api/auth", () => {
  test("10+ rapid requests to POST /api/auth: rate limit activated or endpoint stable", async ({
    request,
  }) => {
    const requestCount = RATE_LIMIT_THRESHOLD + 1;
    const statuses = await sendRapidRequests(
      request,
      requestCount,
      "/api/auth",
      {
        email: "ratelimit-test@example.com",
        password: "wrong-password-12345",
        mode: "login",
      }
    );

    // Rate limiting is optional - check if it was triggered
    const hasRateLimited = statuses.some((s) => s === RATE_LIMIT_STATUS);

    if (hasRateLimited) {
      // Rate limiting is implemented: 429 should appear at some point
      const firstRateLimitIndex = statuses.indexOf(RATE_LIMIT_STATUS);
      // The 429 should appear after at least one allowed request
      expect(firstRateLimitIndex).toBeGreaterThan(0);
      // Once rate limited, subsequent requests should also be rate limited
      const afterRateLimit = statuses.slice(firstRateLimitIndex);
      expect(afterRateLimit.every((s) => s === RATE_LIMIT_STATUS)).toBe(true);
    } else {
      // Rate limiting not implemented: endpoint must stay stable (no 500 crashes)
      statuses.forEach((status) => {
        expect(status).not.toBe(500);
      });
      // All requests should be rejected (invalid credentials: 400 or 401)
      statuses.forEach((status) => {
        expect([400, 401, 403]).toContain(status);
      });
    }
  });

  test("Rapid POST /api/auth with invalid email format: no 500 on repeated attempts", async ({
    request,
  }) => {
    const requestCount = RATE_LIMIT_THRESHOLD + 1;
    const statuses = await sendRapidRequests(
      request,
      requestCount,
      "/api/auth",
      {
        email: "not-an-email",
        password: "password123",
        mode: "login",
      }
    );

    // Endpoint must not crash regardless of rate limiting status
    statuses.forEach((status) => {
      expect(status).not.toBe(500);
    });

    // Each response should be an error (bad request, unauthorized, or rate limited)
    statuses.forEach((status) => {
      expect([400, 401, 403, RATE_LIMIT_STATUS]).toContain(status);
    });
  });

  test("Rapid POST /api/auth register mode: no 500 on repeated attempts", async ({
    request,
  }) => {
    const requestCount = RATE_LIMIT_THRESHOLD + 1;
    const statuses = await sendRapidRequests(
      request,
      requestCount,
      "/api/auth",
      {
        email: `ratelimit-register-${Date.now()}@example.com`,
        password: "password123456",
        mode: "register",
      }
    );

    // Endpoint must remain stable
    statuses.forEach((status) => {
      expect(status).not.toBe(500);
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Rate limiting on POST /api/auth/forgot-password
// Send 11 rapid forgot-password requests.
// If rate limiting is implemented: at least one response should be 429.
// If not implemented: all responses should be non-500 (API stays stable).
// ---------------------------------------------------------------------------

test.describe("Rate Limiting - POST /api/auth/forgot-password", () => {
  test("10+ rapid requests to POST /api/auth/forgot-password: rate limit activated or endpoint stable", async ({
    request,
  }) => {
    const requestCount = RATE_LIMIT_THRESHOLD + 1;
    const statuses = await sendRapidRequests(
      request,
      requestCount,
      "/api/auth/forgot-password",
      {
        email: "ratelimit-forgot@example.com",
      }
    );

    // Rate limiting is optional - check if it was triggered
    const hasRateLimited = statuses.some((s) => s === RATE_LIMIT_STATUS);

    if (hasRateLimited) {
      // Rate limiting is implemented: 429 must appear
      const firstRateLimitIndex = statuses.indexOf(RATE_LIMIT_STATUS);
      // At least one request should have gone through before rate limiting
      expect(firstRateLimitIndex).toBeGreaterThan(0);
    } else {
      // Rate limiting not implemented: endpoint must stay stable (no 500)
      statuses.forEach((status) => {
        expect(status).not.toBe(500);
      });
    }
  });

  test("Rapid POST /api/auth/forgot-password with non-existent email: no 500 on repeated attempts", async ({
    request,
  }) => {
    const requestCount = RATE_LIMIT_THRESHOLD + 1;
    const statuses = await sendRapidRequests(
      request,
      requestCount,
      "/api/auth/forgot-password",
      {
        email: "definitely-does-not-exist-12345@nowhere.example.com",
      }
    );

    // Endpoint must remain stable regardless of rate limiting
    statuses.forEach((status) => {
      expect(status).not.toBe(500);
    });
  });

  test("Rapid POST /api/auth/forgot-password with invalid email: handled gracefully", async ({
    request,
  }) => {
    const requestCount = RATE_LIMIT_THRESHOLD + 1;
    const statuses = await sendRapidRequests(
      request,
      requestCount,
      "/api/auth/forgot-password",
      {
        email: "not-a-valid-email",
      }
    );

    // Should reject invalid email format or apply rate limiting
    statuses.forEach((status) => {
      expect(status).not.toBe(500);
      expect([400, 401, 403, RATE_LIMIT_STATUS]).toContain(status);
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Verify rate limit response format (if rate limiting active)
// When a 429 is received, the response should include a Retry-After header
// or a meaningful error message.
// ---------------------------------------------------------------------------

test.describe("Rate Limiting - Response format when rate limited", () => {
  test("If POST /api/auth returns 429, response includes meaningful error", async ({
    request,
  }) => {
    const requestCount = RATE_LIMIT_THRESHOLD + 2;
    let rateLimitedResponse: Awaited<ReturnType<typeof request.post>> | null =
      null;

    for (let i = 0; i < requestCount; i++) {
      const response = await request.post("/api/auth", {
        data: {
          email: "ratelimit-format-test@example.com",
          password: "wrong-pass",
          mode: "login",
        },
        headers: { "Content-Type": "application/json" },
      });

      if (response.status() === RATE_LIMIT_STATUS) {
        rateLimitedResponse = response;
        break;
      }
    }

    if (rateLimitedResponse !== null) {
      // Rate limiting IS implemented - verify response format
      expect(rateLimitedResponse.status()).toBe(RATE_LIMIT_STATUS);

      // The 429 response should have a body (not empty)
      const text = await rateLimitedResponse.text();
      expect(text.length).toBeGreaterThan(0);

      // Check for Retry-After header (best practice but optional)
      // Just log if present - don't fail if absent
      const retryAfter = rateLimitedResponse.headers()["retry-after"];
      if (retryAfter) {
        const retryAfterValue = parseInt(retryAfter, 10);
        expect(retryAfterValue).toBeGreaterThan(0);
      }
    } else {
      // Rate limiting is not implemented - this test is informational only
      // The endpoint remained stable through all requests - that's a pass
      expect(true).toBe(true);
    }
  });

  test("If POST /api/auth/forgot-password returns 429, response is non-empty", async ({
    request,
  }) => {
    const requestCount = RATE_LIMIT_THRESHOLD + 2;
    let rateLimitedResponse: Awaited<ReturnType<typeof request.post>> | null =
      null;

    for (let i = 0; i < requestCount; i++) {
      const response = await request.post("/api/auth/forgot-password", {
        data: { email: "ratelimit-format-forgot@example.com" },
        headers: { "Content-Type": "application/json" },
      });

      if (response.status() === RATE_LIMIT_STATUS) {
        rateLimitedResponse = response;
        break;
      }
    }

    if (rateLimitedResponse !== null) {
      // Rate limiting IS implemented
      expect(rateLimitedResponse.status()).toBe(RATE_LIMIT_STATUS);

      const text = await rateLimitedResponse.text();
      expect(text.length).toBeGreaterThan(0);
    } else {
      // Rate limiting not implemented - endpoint was stable, that's acceptable
      expect(true).toBe(true);
    }
  });
});
