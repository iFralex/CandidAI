import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../vitest.setup";
import {
  startEmailsGenerationSuccess,
  startEmailsGenerationUserNotFound,
  startEmailsGenerationServerUnavailable,
  startEmailsGenerationMissingUserId,
} from "../../mocks/handlers/python-server";

const SERVER_RUNNER_URL = "http://91.99.227.223:5000/start_emails_generation";

async function postRunModule(body: Record<string, unknown> = {}) {
  return fetch(SERVER_RUNNER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Python Server MSW handlers", () => {
  describe("POST /start_emails_generation - success", () => {
    beforeEach(() => {
      server.use(startEmailsGenerationSuccess);
    });

    it("returns status 200", async () => {
      const res = await postRunModule({ user_id: "user123", module: "search" });
      expect(res.status).toBe(200);
    });

    it("returns status: queued in body", async () => {
      const res = await postRunModule({ user_id: "user123", module: "search" });
      const data = await res.json();
      expect(data.status).toBe("queued");
    });

    it("returns message: Processing started in body", async () => {
      const res = await postRunModule({ user_id: "user123", module: "search" });
      const data = await res.json();
      expect(data.message).toBe("Processing started");
    });
  });

  describe("POST /start_emails_generation - user not found", () => {
    beforeEach(() => {
      server.use(startEmailsGenerationUserNotFound);
    });

    it("returns status 404", async () => {
      const res = await postRunModule({ user_id: "nonexistent" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /start_emails_generation - server unavailable", () => {
    beforeEach(() => {
      server.use(startEmailsGenerationServerUnavailable);
    });

    it("returns status 503", async () => {
      const res = await postRunModule({ user_id: "user123" });
      expect(res.status).toBe(503);
    });
  });

  describe("POST /start_emails_generation - missing user_id", () => {
    beforeEach(() => {
      server.use(startEmailsGenerationMissingUserId);
    });

    it("returns status 400", async () => {
      const res = await postRunModule({});
      expect(res.status).toBe(400);
    });
  });
});
