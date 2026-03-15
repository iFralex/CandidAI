import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../vitest.setup";
import {
  runModuleSuccess,
  runModuleUserNotFound,
  runModuleServerUnavailable,
  runModuleMissingUserId,
} from "../../mocks/handlers/python-server";

const SERVER_RUNNER_URL = "http://91.99.227.223:5000/run_module";

async function postRunModule(body: Record<string, unknown> = {}) {
  return fetch(SERVER_RUNNER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Python Server MSW handlers", () => {
  describe("POST /run_module - success", () => {
    beforeEach(() => {
      server.use(runModuleSuccess);
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

  describe("POST /run_module - user not found", () => {
    beforeEach(() => {
      server.use(runModuleUserNotFound);
    });

    it("returns status 404", async () => {
      const res = await postRunModule({ user_id: "nonexistent" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /run_module - server unavailable", () => {
    beforeEach(() => {
      server.use(runModuleServerUnavailable);
    });

    it("returns status 503", async () => {
      const res = await postRunModule({ user_id: "user123" });
      expect(res.status).toBe(503);
    });
  });

  describe("POST /run_module - missing user_id", () => {
    beforeEach(() => {
      server.use(runModuleMissingUserId);
    });

    it("returns status 400", async () => {
      const res = await postRunModule({});
      expect(res.status).toBe(400);
    });
  });
});
