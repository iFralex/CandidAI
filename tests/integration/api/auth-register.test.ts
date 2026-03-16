import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Hoist mocks so they are available inside vi.mock factory
const { mockCreateUser, mockDocSet, mockDocUpdate } = vi.hoisted(() => ({
  mockCreateUser: vi.fn(),
  mockDocSet: vi.fn().mockResolvedValue(undefined),
  mockDocUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    createUser: mockCreateUser,
  },
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        set: mockDocSet,
        update: mockDocUpdate,
      }),
    }),
  },
}));

import { POST } from "@/app/api/auth/route";

const IDENTITY_TOOLKIT_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";
const SEND_EMAIL_URL = "http://localhost:3000/api/send-email";

const server = setupServer(
  http.post(IDENTITY_TOOLKIT_URL, () =>
    HttpResponse.json({
      idToken: "fake_id_token",
      localId: "new-user-uid",
      email: "new@example.com",
      refreshToken: "fake_refresh",
    })
  ),
  http.post(SEND_EMAIL_URL, () =>
    HttpResponse.json({ success: true }, { status: 200 })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  mockDocSet.mockResolvedValue(undefined);
  mockDocUpdate.mockResolvedValue(undefined);
});
afterAll(() => server.close());

function makeRegisterRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth - Register Mode", () => {
  describe("happy path", () => {
    beforeEach(() => {
      mockCreateUser.mockResolvedValue({ uid: "new-user-uid" });
    });

    it("returns { success: true, requiresVerification: true } for valid input", async () => {
      const req = makeRegisterRequest({
        mode: "register",
        email: "new@example.com",
        password: "password123",
        name: "Test User",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.requiresVerification).toBe(true);
    });

    it("creates Firestore document with name, email, createdAt, lastLogin", async () => {
      const req = makeRegisterRequest({
        mode: "register",
        email: "new@example.com",
        password: "password123",
        name: "Test User",
      });
      await POST(req);

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          email: "new@example.com",
          createdAt: expect.any(String),
          lastLogin: expect.any(String),
        })
      );
    });

    it("creates Firestore document with onboardingStep=1, plan=free_trial, credits=0, emailVerified=false", async () => {
      const req = makeRegisterRequest({
        mode: "register",
        email: "new@example.com",
        password: "password123",
        name: "Test User",
      });
      await POST(req);

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingStep: 1,
          plan: "free_trial",
          credits: 0,
          emailVerified: false,
        })
      );
    });

    it("fires POST /api/send-email with type='welcome' after registration", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(SEND_EMAIL_URL, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ success: true });
        })
      );

      const req = makeRegisterRequest({
        mode: "register",
        email: "new@example.com",
        password: "password123",
        name: "Test User",
      });
      await POST(req);
      // Poll until the fire-and-forget fetch completes
      await vi.waitFor(() => {
        expect(capturedBody).toMatchObject({ type: "welcome" });
      }, { timeout: 2000 });
    });
  });

  describe("error cases", () => {
    it("returns error for already registered email (status >= 400)", async () => {
      const error = Object.assign(new Error("EMAIL_EXISTS"), {
        code: "auth/email-already-exists",
      });
      mockCreateUser.mockRejectedValue(error);

      const req = makeRegisterRequest({
        mode: "register",
        email: "existing@example.com",
        password: "password123",
        name: "Test User",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("returns 400 for missing password", async () => {
      const req = makeRegisterRequest({
        mode: "register",
        email: "test@example.com",
        name: "Test User",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for malformed email", async () => {
      const req = makeRegisterRequest({
        mode: "register",
        email: "not-an-email",
        password: "password123",
        name: "Test User",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("handles missing name with default name or 400", async () => {
      mockCreateUser.mockResolvedValue({ uid: "new-user-uid" });
      const req = makeRegisterRequest({
        mode: "register",
        email: "test@example.com",
        password: "password123",
      });
      const res = await POST(req);
      // Missing name: route proceeds with empty string default and returns 201
      expect(res.status).toBe(201);
    });

    it("returns >= 400 for malformed JSON body", async () => {
      const req = new Request("http://localhost:3000/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{{",
      });
      const res = await POST(req);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("returns 400 for empty body ({})", async () => {
      const req = new Request("http://localhost:3000/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const res = await POST(req);
      // {} → mode is undefined → "Missing or invalid mode" → 400
      expect(res.status).toBe(400);
    });
  });
});
