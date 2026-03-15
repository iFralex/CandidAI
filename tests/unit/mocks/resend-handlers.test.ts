import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../vitest.setup";
import {
  resendEmailSuccess,
  resendEmailRateLimit,
  resendEmailInvalidApiKey,
  resendEmailInvalidEmail,
  resendEmailServerError,
} from "../../mocks/handlers/resend";

const RESEND_BASE_URL = "https://api.resend.com";

async function postEmail(body: Record<string, unknown> = {}) {
  return fetch(`${RESEND_BASE_URL}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Resend MSW handlers", () => {
  describe("POST /emails - success", () => {
    beforeEach(() => {
      server.use(resendEmailSuccess);
    });

    it("returns status 200", async () => {
      const res = await postEmail({ to: "user@example.com", subject: "Test" });
      expect(res.status).toBe(200);
    });

    it("returns id: re_fake_123", async () => {
      const res = await postEmail({ to: "user@example.com", subject: "Test" });
      const data = await res.json();
      expect(data.id).toBe("re_fake_123");
    });
  });

  describe("POST /emails - rate limit", () => {
    beforeEach(() => {
      server.use(resendEmailRateLimit);
    });

    it("returns status 429", async () => {
      const res = await postEmail({ to: "user@example.com", subject: "Test" });
      expect(res.status).toBe(429);
    });

    it("returns Retry-After: 60 header", async () => {
      const res = await postEmail({ to: "user@example.com", subject: "Test" });
      expect(res.headers.get("Retry-After")).toBe("60");
    });
  });

  describe("POST /emails - invalid API key", () => {
    beforeEach(() => {
      server.use(resendEmailInvalidApiKey);
    });

    it("returns status 403", async () => {
      const res = await postEmail({ to: "user@example.com", subject: "Test" });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /emails - invalid email", () => {
    beforeEach(() => {
      server.use(resendEmailInvalidEmail);
    });

    it("returns status 422", async () => {
      const res = await postEmail({ to: "bad-email", subject: "Test" });
      expect(res.status).toBe(422);
    });

    it("returns error: Invalid email address", async () => {
      const res = await postEmail({ to: "bad-email", subject: "Test" });
      const data = await res.json();
      expect(data.error).toBe("Invalid email address");
    });
  });

  describe("POST /emails - server error", () => {
    beforeEach(() => {
      server.use(resendEmailServerError);
    });

    it("returns status 500", async () => {
      const res = await postEmail({ to: "user@example.com", subject: "Test" });
      expect(res.status).toBe(500);
    });
  });
});
