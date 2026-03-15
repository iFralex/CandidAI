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
    it("generates reset link and returns it for a valid registered email", async () => {
      const fakeLink = "https://example.com/reset?oobCode=abc123";
      mockGeneratePasswordResetLink.mockResolvedValue(fakeLink);

      const req = makeForgotPasswordRequest({ email: "user@example.com" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.link).toBe(fakeLink);
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
      // Allow fire-and-forget fetch to execute
      await new Promise((r) => setTimeout(r, 100));

      expect(capturedBody).toMatchObject({ type: "password-reset" });
    });
  });

  describe("error cases", () => {
    it("returns appropriate error when email is not found in Firebase", async () => {
      const error = Object.assign(
        new Error("There is no user record corresponding to the provided identifier."),
        { code: "auth/user-not-found" }
      );
      mockGeneratePasswordResetLink.mockRejectedValue(error);

      const req = makeForgotPasswordRequest({ email: "notfound@example.com" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(data.error).toBeTruthy();
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

      // Route does not check send-email response, so it should still return the link
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
