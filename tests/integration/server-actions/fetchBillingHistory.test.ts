import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockPaymentsGet,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockPaymentsGet: vi.fn(),
}));

vi.mock("next-firebase-auth-edge", () => ({
  getTokens: mockGetTokens,
  getApiRequestTokens: vi.fn(),
}));

vi.mock("next-firebase-auth-edge/next/cookies", () => ({
  refreshCookiesWithIdToken: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Firestore chain:
//   collection("users").doc(userId)
//     .collection("payments").orderBy("createdAt", "desc")
//       .get() → mockPaymentsGet
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            get: mockPaymentsGet,
          }),
        }),
      }),
    }),
  },
  adminAuth: {},
  adminStorage: {},
}));

vi.mock("@/config", () => ({
  clientConfig: { apiKey: "fake-api-key" },
  serverConfig: {
    cookieName: "CandidAIToken",
    cookieSignatureKeys: ["fake-sig-key"],
    serviceAccount: {},
  },
  plansData: {
    free_trial: { credits: 0, maxCompanies: 1 },
    base: { credits: 0, maxCompanies: 20 },
    pro: { credits: 1000, maxCompanies: 50 },
    ultra: { credits: 2500, maxCompanies: 100 },
  },
  creditsInfo: {
    "find-recruiter": { cost: 100 },
    "generate-email": { cost: 50 },
    "change-company": { cost: 70 },
  },
}));

import { fetchBillingHistory } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const makeTimestamp = (isoString: string) => ({
  toDate: () => new Date(isoString),
  seconds: Math.floor(new Date(isoString).getTime() / 1000),
});

const makePaymentDoc = (
  id: string,
  data: Record<string, unknown>
) => ({
  id,
  data: () => data,
});

const makePaymentsSnap = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => ({
  docs,
});

describe("fetchBillingHistory server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
  });

  describe("user with 3 payments — returns array ordered by date", () => {
    it("returns an array of 3 transactions when user has 3 payments", async () => {
      const docs = [
        makePaymentDoc("pay3", {
          createdAt: makeTimestamp("2024-03-01T10:00:00Z"),
          amount: 9900,
          currency: "usd",
          status: "succeeded",
          description: "Pro plan",
        }),
        makePaymentDoc("pay2", {
          createdAt: makeTimestamp("2024-02-01T10:00:00Z"),
          amount: 4900,
          currency: "usd",
          status: "succeeded",
          description: "Base plan",
        }),
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T10:00:00Z"),
          amount: 1000,
          currency: "usd",
          status: "succeeded",
          description: "Credits",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result).toHaveLength(3);
    });

    it("returns transactions in descending date order (most recent first)", async () => {
      const docs = [
        makePaymentDoc("pay3", {
          createdAt: makeTimestamp("2024-03-01T10:00:00Z"),
          amount: 9900,
          currency: "usd",
          status: "succeeded",
          description: "Pro plan",
        }),
        makePaymentDoc("pay2", {
          createdAt: makeTimestamp("2024-02-01T10:00:00Z"),
          amount: 4900,
          currency: "usd",
          status: "succeeded",
          description: "Base plan",
        }),
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T10:00:00Z"),
          amount: 1000,
          currency: "usd",
          status: "succeeded",
          description: "Credits",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].id).toBe("pay3");
      expect(result[1].id).toBe("pay2");
      expect(result[2].id).toBe("pay1");
    });

    it("returns correct id for each transaction", async () => {
      const docs = [
        makePaymentDoc("payment-abc", {
          createdAt: makeTimestamp("2024-03-01T00:00:00Z"),
          amount: 500,
          currency: "usd",
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].id).toBe("payment-abc");
    });

    it("returns correct amount for each transaction", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T00:00:00Z"),
          amount: 4900,
          currency: "usd",
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].amount).toBe(4900);
    });

    it("returns correct status for each transaction", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T00:00:00Z"),
          amount: 1000,
          currency: "usd",
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].status).toBe("succeeded");
    });

    it("returns correct createdAt ISO string from Firestore Timestamp", async () => {
      const isoDate = "2024-06-15T12:00:00.000Z";
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp(isoDate),
          amount: 1000,
          currency: "usd",
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].createdAt).toBe(isoDate);
    });

    it("returns correct createdAt ISO string from Firestore seconds-based timestamp", async () => {
      const seconds = 1718452800;
      const expectedIso = new Date(seconds * 1000).toISOString();
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: { seconds, toDate: undefined },
          amount: 1000,
          currency: "usd",
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].createdAt).toBe(expectedIso);
    });

    it("each transaction contains all required fields: id, createdAt, amount, status, description, currency", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T00:00:00Z"),
          amount: 1000,
          currency: "usd",
          status: "succeeded",
          description: "Credits pack",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();
      const tx = result[0];

      expect(tx).toHaveProperty("id");
      expect(tx).toHaveProperty("createdAt");
      expect(tx).toHaveProperty("amount");
      expect(tx).toHaveProperty("status");
      expect(tx).toHaveProperty("description");
      expect(tx).toHaveProperty("currency");
    });
  });

  describe("user without payments — returns empty array", () => {
    it("returns an empty array when user has no payments", async () => {
      mockPaymentsGet.mockResolvedValue(makePaymentsSnap([]));

      const result = await fetchBillingHistory();

      expect(result).toEqual([]);
    });

    it("returns empty array (not null or undefined) when no payments exist", async () => {
      mockPaymentsGet.mockResolvedValue(makePaymentsSnap([]));

      const result = await fetchBillingHistory();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe("field defaults — missing Firestore fields", () => {
    it("returns null for amount when amount field is missing", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T00:00:00Z"),
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].amount).toBeNull();
    });

    it("returns null for status when status field is missing", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T00:00:00Z"),
          amount: 500,
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].status).toBeNull();
    });

    it("returns null for createdAt when createdAt field is missing", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          amount: 500,
          currency: "usd",
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].createdAt).toBeNull();
    });

    it("returns usd as default currency when currency field is missing", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T00:00:00Z"),
          amount: 500,
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].currency).toBe("usd");
    });

    it("uses item field as fallback for description when description is missing", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T00:00:00Z"),
          amount: 500,
          currency: "usd",
          status: "succeeded",
          item: "base",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].description).toBe("base");
    });

    it("returns null for description when both description and item fields are missing", async () => {
      const docs = [
        makePaymentDoc("pay1", {
          createdAt: makeTimestamp("2024-01-01T00:00:00Z"),
          amount: 500,
          currency: "usd",
          status: "succeeded",
        }),
      ];

      mockPaymentsGet.mockResolvedValue(makePaymentsSnap(docs));

      const result = await fetchBillingHistory();

      expect(result[0].description).toBeNull();
    });
  });

  describe("unauthenticated user — throws error", () => {
    it("throws when getTokens returns null", async () => {
      mockGetTokens.mockResolvedValue(null);

      await expect(fetchBillingHistory()).rejects.toThrow();
    });

    it("throws when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      await expect(fetchBillingHistory()).rejects.toThrow("Email not verified");
    });
  });
});
