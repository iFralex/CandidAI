import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Hoist mocks so they are available inside vi.mock factory
const { mockDocUpdate } = vi.hoisted(() => ({
  mockDocUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    createUser: vi.fn(),
  },
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue(undefined),
        update: mockDocUpdate,
      }),
    }),
  },
}));

import { POST } from "@/app/api/auth/route";

const IDENTITY_TOOLKIT_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

const successResponse = {
  idToken: "fake_id_token",
  localId: "user123",
  email: "test@test.com",
  refreshToken: "fake_refresh",
};

const server = setupServer(
  http.post(IDENTITY_TOOLKIT_URL, () =>
    HttpResponse.json(successResponse)
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  mockDocUpdate.mockResolvedValue(undefined);
});
afterAll(() => server.close());

function makeLoginRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth - Login Mode", () => {
  describe("happy path", () => {
    it("returns { success: true, idToken, uid } for valid credentials", async () => {
      const req = makeLoginRequest({
        mode: "login",
        email: "test@test.com",
        password: "correct-password",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.idToken).toBe("fake_id_token");
      expect(data.uid).toBe("user123");
    });

    it("updates lastLogin in Firestore after successful login", async () => {
      const req = makeLoginRequest({
        mode: "login",
        email: "test@test.com",
        password: "correct-password",
      });
      await POST(req);

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLogin: expect.any(String),
        })
      );
    });
  });

  describe("error cases", () => {
    it("returns { success: false } with status 401 for wrong password (INVALID_PASSWORD)", async () => {
      server.use(
        http.post(IDENTITY_TOOLKIT_URL, () =>
          HttpResponse.json(
            { error: { message: "INVALID_PASSWORD" } },
            { status: 400 }
          )
        )
      );

      const req = makeLoginRequest({
        mode: "login",
        email: "test@test.com",
        password: "wrong-password",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("returns { success: false } with status 401 for unregistered email (EMAIL_NOT_FOUND)", async () => {
      server.use(
        http.post(IDENTITY_TOOLKIT_URL, () =>
          HttpResponse.json(
            { error: { message: "EMAIL_NOT_FOUND" } },
            { status: 400 }
          )
        )
      );

      const req = makeLoginRequest({
        mode: "login",
        email: "nobody@example.com",
        password: "some-password",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("returns { success: false } with status 403 for disabled account (USER_DISABLED)", async () => {
      server.use(
        http.post(IDENTITY_TOOLKIT_URL, () =>
          HttpResponse.json(
            { error: { message: "USER_DISABLED" } },
            { status: 400 }
          )
        )
      );

      const req = makeLoginRequest({
        mode: "login",
        email: "disabled@example.com",
        password: "some-password",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it("returns status 400 for missing mode", async () => {
      const req = new Request("http://localhost:3000/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@test.com",
          password: "password123",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns status 400 for invalid mode value", async () => {
      const req = makeLoginRequest({
        mode: "invalid-mode",
        email: "test@test.com",
        password: "password123",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
