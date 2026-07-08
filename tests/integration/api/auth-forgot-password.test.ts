import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Hoist mocks so they are available inside vi.mock factory
const { mockGeneratePasswordResetLink } = vi.hoisted(() => ({
  mockGeneratePasswordResetLink: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    generatePasswordResetLink: mockGeneratePasswordResetLink,
  },
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

import { POST } from "@/app/api/auth/forgot-password/route";

const SEND_EMAIL_URL = "http://localhost:3000/api/send-email";

const server = setupServer(
  http.post(SEND_EMAIL_URL, () =>
    HttpResponse.json({ success: true }, { status: 200 })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

function makeForgotPasswordRequest(body: unknown) {
  return new Request("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  describe("happy path", () => {
    it("returns a generic success WITHOUT leaking the reset link", async () => {
      const fakeLink = "https://example.com/reset?oobCode=abc123";
      mockGeneratePasswordResetLink.mockResolvedValue(fakeLink);

      const req = makeForgotPasswordRequest({ email: "user@example.com" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // SECURITY: the reset link must never be returned to the caller — it is
      // emailed only. Returning it here was an account-takeover vector.
      expect(data.link).toBeUndefined();
      expect(data.success).toBe(true);
    });

    it("calls adminAuth.generatePasswordResetLink with the provided email", async () => {
      mockGeneratePasswordResetLink.mockResolvedValue("https://reset.link");

      const req = makeForgotPasswordRequest({ email: "user@example.com" });
      await POST(req);

      expect(mockGeneratePasswordResetLink).toHaveBeenCalledWith(
        "user@example.com",
        expect.objectContaining({ handleCodeInApp: false })
      );
    });

    it("fires POST /api/send-email with type='password-reset' after generating the link", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(SEND_EMAIL_URL, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ success: true });
        })
      );

      mockGeneratePasswordResetLink.mockResolvedValue("https://reset.link");

      const req = makeForgotPasswordRequest({ email: "user@example.com" });
      await POST(req);

      expect(capturedBody).toMatchObject({ type: "password-reset" });
    });
  });

  describe("error cases", () => {
    it("returns generic 200 for an unknown email (no user-enumeration)", async () => {
      const error = Object.assign(
        new Error("There is no user record corresponding to the provided identifier."),
        { code: "auth/user-not-found" }
      );
      mockGeneratePasswordResetLink.mockRejectedValue(error);

      const req = makeForgotPasswordRequest({ email: "notfound@example.com" });
      const res = await POST(req);
      const data = await res.json();

      // SECURITY: an unknown email must be indistinguishable from a known one,
      // otherwise the endpoint is a registered-email oracle. Same 200 + body.
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.error).toBeUndefined();
    });

    it("handles Resend 429 gracefully without crashing (still returns a response)", async () => {
      // Simulate send-email endpoint returning 429 (rate limit from Resend)
      server.use(
        http.post(SEND_EMAIL_URL, () =>
          HttpResponse.json(
            { success: false, error: "Too Many Requests" },
            { status: 429 }
          )
        )
      );

      mockGeneratePasswordResetLink.mockResolvedValue("https://reset.link");

      const req = makeForgotPasswordRequest({ email: "user@example.com" });
      const res = await POST(req);

      // Route does not check the send-email response, so it still returns the
      // generic 200 success (never the link).
      expect(res).toBeDefined();
      expect(res.status).toBe(200);
    });

    it("returns status 400 when email is missing from request body", async () => {
      const error = new Error("Invalid email address");
      mockGeneratePasswordResetLink.mockRejectedValue(error);

      const req = makeForgotPasswordRequest({ otherField: "value" });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns status 400 for empty body ({})", async () => {
      const error = new Error("The email address is invalid.");
      mockGeneratePasswordResetLink.mockRejectedValue(error);

      const req = new Request(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }
      );
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeTruthy();
    });
  });
});
