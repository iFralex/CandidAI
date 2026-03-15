import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../vitest.setup";
import {
  signInSuccess,
  signInWrongPassword,
  signInUserNotFound,
  signInAccountDisabled,
  signInTooManyAttempts,
} from "../../mocks/handlers/firebase-identity";

const SIGN_IN_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

async function postSignIn(body: Record<string, unknown> = {}) {
  return fetch(SIGN_IN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Firebase Identity Toolkit MSW handlers", () => {
  describe("POST signInWithPassword - success", () => {
    beforeEach(() => {
      server.use(signInSuccess);
    });

    it("returns status 200", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "password123",
      });
      expect(res.status).toBe(200);
    });

    it("returns idToken in body", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "password123",
      });
      const data = await res.json();
      expect(data.idToken).toBe("fake_id_token");
    });

    it("returns localId in body", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "password123",
      });
      const data = await res.json();
      expect(data.localId).toBe("user123");
    });

    it("returns email in body", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "password123",
      });
      const data = await res.json();
      expect(data.email).toBe("test@test.com");
    });

    it("returns refreshToken in body", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "password123",
      });
      const data = await res.json();
      expect(data.refreshToken).toBe("fake_refresh");
    });
  });

  describe("POST signInWithPassword - wrong password", () => {
    beforeEach(() => {
      server.use(signInWrongPassword);
    });

    it("returns status 400", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "wrongpassword",
      });
      expect(res.status).toBe(400);
    });

    it("returns INVALID_PASSWORD error message", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "wrongpassword",
      });
      const data = await res.json();
      expect(data.error.message).toBe("INVALID_PASSWORD");
    });
  });

  describe("POST signInWithPassword - user not found", () => {
    beforeEach(() => {
      server.use(signInUserNotFound);
    });

    it("returns status 400", async () => {
      const res = await postSignIn({
        email: "notfound@test.com",
        password: "password123",
      });
      expect(res.status).toBe(400);
    });

    it("returns EMAIL_NOT_FOUND error message", async () => {
      const res = await postSignIn({
        email: "notfound@test.com",
        password: "password123",
      });
      const data = await res.json();
      expect(data.error.message).toBe("EMAIL_NOT_FOUND");
    });
  });

  describe("POST signInWithPassword - account disabled", () => {
    beforeEach(() => {
      server.use(signInAccountDisabled);
    });

    it("returns status 400", async () => {
      const res = await postSignIn({
        email: "disabled@test.com",
        password: "password123",
      });
      expect(res.status).toBe(400);
    });

    it("returns USER_DISABLED error message", async () => {
      const res = await postSignIn({
        email: "disabled@test.com",
        password: "password123",
      });
      const data = await res.json();
      expect(data.error.message).toBe("USER_DISABLED");
    });
  });

  describe("POST signInWithPassword - too many attempts", () => {
    beforeEach(() => {
      server.use(signInTooManyAttempts);
    });

    it("returns status 400", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "password123",
      });
      expect(res.status).toBe(400);
    });

    it("returns TOO_MANY_ATTEMPTS_TRY_LATER error message", async () => {
      const res = await postSignIn({
        email: "test@test.com",
        password: "password123",
      });
      const data = await res.json();
      expect(data.error.message).toBe("TOO_MANY_ATTEMPTS_TRY_LATER");
    });
  });
});
