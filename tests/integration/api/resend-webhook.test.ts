import { beforeEach, describe, expect, it, vi } from "vitest";

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("resend", () => ({ Resend: vi.fn().mockImplementation(function () { return { webhooks: { verify } }; }) }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: {} }));

import { POST } from "@/app/api/resend-webhook/route";

function request(headers = true) {
  return new Request("http://localhost/api/resend-webhook", {
    method: "POST",
    headers: headers ? { "svix-id": "evt_1", "svix-timestamp": "123", "svix-signature": "sig" } : {},
    body: JSON.stringify({ type: "email.delivered" }),
  });
}

describe("POST /api/resend-webhook", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    verify.mockReset();
  });

  it("rejects missing signatures", async () => {
    expect((await POST(request(false))).status).toBe(400);
  });

  it("rejects an invalid signature", async () => {
    verify.mockImplementation(() => { throw new Error("invalid"); });
    expect((await POST(request())).status).toBe(400);
  });

  it("acknowledges non-email events without touching storage", async () => {
    verify.mockReturnValue({ type: "domain.updated", data: {} });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ignored: true });
  });
});
