import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const { mockGetUser, mockEmailsSend } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockEmailsSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: mockEmailsSend,
      },
    };
  }),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    getUser: mockGetUser,
  },
}));

import { POST } from "@/app/api/send-email/route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockUserRecord = {
  uid: "user123",
  email: "test@example.com",
  displayName: "Test User",
};

describe("POST /api/send-email", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue(mockUserRecord);
    mockEmailsSend.mockResolvedValue({ data: { id: "email-id-123" }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("type: welcome", () => {
    it("calls Resend and returns 200 when userId and user data are valid", async () => {
      const res = await POST(
        makeRequest({
          userId: "user123",
          type: "welcome",
          data: {},
        })
      );

      expect(res.status).toBe(200);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it("HTML contains username and verification link", async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      mockEmailsSend.mockImplementation(async (payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return { data: { id: "email-id-123" }, error: null };
      });

      await POST(
        makeRequest({
          userId: "user123",
          type: "welcome",
          data: {},
        })
      );

      expect(capturedPayload).not.toBeNull();
      const html = capturedPayload!.html as string;
      // Should contain the display name
      expect(html).toContain("Test User");
      // Should contain a verify link with userId
      expect(html).toContain("/verify/user123");
    });
  });

  describe("type: password-reset", () => {
    it("calls Resend with the provided email and reset link, returns 200", async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      mockEmailsSend.mockImplementation(async (payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return { data: { id: "email-id-pw" }, error: null };
      });

      const res = await POST(
        makeRequest({
          type: "password-reset",
          data: {
            email: "reset@example.com",
            resetLink: "https://example.com/reset?token=abc123",
          },
        })
      );

      expect(res.status).toBe(200);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      // Email should be sent to the provided email, not Firebase user email
      expect(capturedPayload!.to).toBe("reset@example.com");
      const html = capturedPayload!.html as string;
      expect(html).toContain("https://example.com/reset?token=abc123");
    });
  });

  describe("type: new_emails_generated", () => {
    it("calls Resend and returns 200", async () => {
      const newData = [
        {
          company: { name: "TechCorp", domain: "techcorp.com" },
          recruiter: { name: "Sarah Johnson", jobTitle: "Technical Recruiter" },
          articles: [],
          preview: "Dear Sarah, I was impressed by your work...",
        },
      ];

      const res = await POST(
        makeRequest({
          userId: "user123",
          type: "new_emails_generated",
          data: { newData },
        })
      );

      expect(res.status).toBe(200);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("type: purchase-confirmation", () => {
    it("calls Resend and returns 200", async () => {
      const res = await POST(
        makeRequest({
          userId: "user123",
          type: "purchase-confirmation",
          data: {
            item: "Pro Plan",
            amount: "$69",
            newBalance: 1000,
          },
        })
      );

      expect(res.status).toBe(200);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("validation", () => {
    it("returns 400 for unrecognized type", async () => {
      const res = await POST(
        makeRequest({ type: "unknown_type", userId: "user123" })
      );

      expect(res.status).toBe(400);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("returns 400 for missing type field", async () => {
      const res = await POST(makeRequest({ userId: "user123" }));

      expect(res.status).toBe(400);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("returns 400 when userId is missing for welcome type", async () => {
      const res = await POST(makeRequest({ type: "welcome" }));

      expect(res.status).toBe(400);
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("returns 400 when userId is missing for new_emails_generated type", async () => {
      const res = await POST(
        makeRequest({ type: "new_emails_generated", data: { newData: [] } })
      );

      expect(res.status).toBe(400);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("returns 400 when userId is missing for purchase-confirmation type", async () => {
      const res = await POST(
        makeRequest({
          type: "purchase-confirmation",
          data: { item: "Pro Plan", amount: "$69", newBalance: 1000 },
        })
      );

      expect(res.status).toBe(400);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });
  });

  describe("Resend error handling", () => {
    it("returns an error response without crashing when Resend returns 500", async () => {
      mockEmailsSend.mockRejectedValue(
        new Error("Resend server error (500)")
      );

      const res = await POST(
        makeRequest({
          userId: "user123",
          type: "welcome",
          data: {},
        })
      );

      // Route should not crash; returns 500 from catch block
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("returns a graceful error without crashing when Resend returns 429", async () => {
      mockEmailsSend.mockRejectedValue(
        new Error("Too Many Requests (429)")
      );

      const res = await POST(
        makeRequest({
          userId: "user123",
          type: "welcome",
          data: {},
        })
      );

      // Route should not crash; returns 500 from catch block
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });
});
