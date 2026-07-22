import { describe, it, expect } from "vitest";
import { server } from "../../vitest.setup";

describe("Test infrastructure setup", () => {
  it("MSW server is initialized and running", () => {
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe("function");
    expect(typeof server.resetHandlers).toBe("function");
    expect(typeof server.close).toBe("function");
  });
});
