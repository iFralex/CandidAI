import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Hoist mocks so they are available inside vi.mock factory
const {
  mockGetTokens,
  mockUserGet,
  mockChangedCompaniesSet,
  mockBatchUpdate,
  mockBatchSet,
  mockBatchDelete,
  mockBatchCommit,
  mockRedirect,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockUserGet: vi.fn(),
  mockChangedCompaniesSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockRedirect: vi.fn(),
  mockFetch: vi.fn(),
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
  redirect: mockRedirect,
}));

// Firestore chain:
//   L1: collection("users").doc(userId) → userRef
//     .get() → mockUserGet
//   L2: L1.collection("data").doc("results"|"changed_companies"|...) → L2Doc
//     .set() → mockChangedCompaniesSet (used by changedCompaniesRef.set outside batch)
//   L3: L2.collection(companyId).doc("details"|"row"|"customizations") → L3Doc
// batch: update, set, delete, commit are fully mocked
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: mockUserGet,
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            set: mockChangedCompaniesSet,
            update: vi.fn(),
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({
                set: vi.fn(),
                update: vi.fn(),
              }),
            }),
          }),
        }),
      }),
    }),
    batch: vi.fn().mockReturnValue({
      update: mockBatchUpdate,
      set: mockBatchSet,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
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

import { confirmCompany } from "@/actions/onboarding-actions";

const validDecodedToken = {
  uid: "user123",
  email: "test@example.com",
  email_verified: true,
};

const makeUserSnap = (credits = 500) => ({
  exists: true,
  data: () => ({ credits }),
});

describe("confirmCompany server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockBatchCommit.mockResolvedValue(undefined);
    mockChangedCompaniesSet.mockResolvedValue(undefined);
    mockRedirect.mockReturnValue(undefined);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe("happy path — action=confirm: updates Firestore and removes from companies_to_confirm", () => {
    it("removes companyId from companies_to_confirm via batch.set with merge:true", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme Corp" } } },
        {}, {}
      );

      const arrayRemoveCall = mockBatchSet.mock.calls.find(
        ([, data]) => data?.companies_to_confirm !== undefined
      );
      expect(arrayRemoveCall).toBeDefined();
      expect(arrayRemoveCall![2]).toEqual({ merge: true });
    });

    it("updates detailsRef with company data via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme Corp" } } },
        {}, {}
      );

      const detailsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data?.company !== undefined
      );
      expect(detailsCall).toBeDefined();
      expect(detailsCall![1].company).toEqual({ name: "Acme Corp" });
    });

    it("updates resultsRef with company entry via batch.update", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme Corp" } } },
        {}, {}
      );

      const resultsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data?.company1 !== undefined
      );
      expect(resultsCall).toBeDefined();
      expect(resultsCall![1].company1).toEqual({ company: { name: "Acme Corp" } });
    });

    it("redirects to /dashboard after committing batch", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme" } } },
        {}, {}
      );

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("sets strategies on customizationsRef via batch.set when strategies are provided", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      const strategies = {
        company1: [{ criteria: [{ key: "job_title", value: ["hr manager"] }] }],
      };

      await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme" } } },
        strategies, {}
      );

      const strategiesCall = mockBatchSet.mock.calls.find(
        ([, data]) => data?.queries !== undefined
      );
      expect(strategiesCall).toBeDefined();
      expect(strategiesCall![1]).toEqual({ queries: strategies.company1 });
      expect(strategiesCall![2]).toEqual({ merge: true });
    });

    it("sets instructions on customizationsRef via batch.set when instructions are provided", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      const instructions = { company1: "Be formal and concise" };

      await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme" } } },
        {}, instructions
      );

      const instructionsCall = mockBatchSet.mock.calls.find(
        ([, data]) => data?.instructions !== undefined
      );
      expect(instructionsCall).toBeDefined();
      expect(instructionsCall![1]).toEqual({ instructions: "Be formal and concise" });
    });

    it("does not call changedCompaniesRef.set outside batch for confirm action", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme" } } },
        {}, {}
      );

      expect(mockChangedCompaniesSet).not.toHaveBeenCalled();
    });
  });

  describe("empty selections object — no company writes, commits and redirects OK", () => {
    it("still calls batch.commit and redirect for empty selections", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany({}, {}, {});

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("only makes the credits batch.update (amount=0) for empty selections", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany({}, {}, {});

      // credits update with deduction of 0 (no wrong actions)
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
      expect(mockBatchUpdate.mock.calls[0][1]).toEqual({ credits: 500 });
    });

    it("does not call batch.set or batch.delete for empty selections", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany({}, {}, {});

      expect(mockBatchSet).not.toHaveBeenCalled();
      expect(mockBatchDelete).not.toHaveBeenCalled();
    });

    it("does not call changedCompaniesRef.set for empty selections", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany({}, {}, {});

      expect(mockChangedCompaniesSet).not.toHaveBeenCalled();
    });
  });

  describe("companyId not in companies_to_confirm — no existence check, idempotent handling", () => {
    it("proceeds without error for a companyId not in companies_to_confirm", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      // arrayRemove is a no-op in Firestore if element is absent — no error expected
      await expect(
        confirmCompany(
          { "ghost-company": { action: "confirm", newData: { name: "Ghost" } } },
          {}, {}
        )
      ).resolves.not.toThrow();
    });

    it("still performs arrayRemove on companies_to_confirm (idempotent)", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { "ghost-company": { action: "confirm", newData: { name: "Ghost" } } },
        {}, {}
      );

      const arrayRemoveCall = mockBatchSet.mock.calls.find(
        ([, data]) => data?.companies_to_confirm !== undefined
      );
      expect(arrayRemoveCall).toBeDefined();
    });

    it("redirects to /dashboard normally for non-existent company", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { "non-existent-id": { action: "confirm", newData: { name: "X" } } },
        {}, {}
      );

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("partial data — null and empty string values are filtered from newData", () => {
    it("filters out null values from newData before writing to Firestore", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        {
          company1: {
            action: "confirm",
            newData: { name: "Acme", website: null, phone: "" },
          },
        },
        {}, {}
      );

      const detailsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data?.company !== undefined
      );
      expect(detailsCall).toBeDefined();
      expect(detailsCall![1].company).toEqual({ name: "Acme" });
      expect(detailsCall![1].company).not.toHaveProperty("website");
      expect(detailsCall![1].company).not.toHaveProperty("phone");
    });

    it("keeps only non-null non-empty-string fields in newData", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        {
          company1: {
            action: "confirm",
            newData: { name: "Acme", location: "NYC", industry: null, size: "" },
          },
        },
        {}, {}
      );

      const detailsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data?.company !== undefined
      );
      expect(detailsCall![1].company).toEqual({ name: "Acme", location: "NYC" });
    });

    it("accepts newData with all valid fields unchanged", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        {
          company1: {
            action: "confirm",
            newData: { name: "Acme", domain: "acme.com", employees: "100" },
          },
        },
        {}, {}
      );

      const detailsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data?.company !== undefined
      );
      expect(detailsCall![1].company).toEqual({
        name: "Acme",
        domain: "acme.com",
        employees: "100",
      });
    });
  });

  describe("action=wrong — deletes company data, deducts credits, sets changedCompanies", () => {
    it("calls batch.delete twice (rowRef and detailsRef) for wrong action", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "wrong", newData: { name: "Wrong Co" } } },
        {}, {}
      );

      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    });

    it("deducts change-company cost (70) from user credits for one wrong action", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "wrong", newData: { name: "Wrong Co" } } },
        {}, {}
      );

      const creditsCall = mockBatchUpdate.mock.calls.find(
        ([, data]) => data?.credits !== undefined
      );
      expect(creditsCall![1]).toEqual({ credits: 430 }); // 500 - 70
    });

    it("returns { success: false, error: 'Insufficient credits' } when credits below cost", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(50)); // only 50 credits, need 70

      const result = await confirmCompany(
        { company1: { action: "wrong", newData: { name: "Wrong Co" } } },
        {}, {}
      );

      expect(result).toEqual({ success: false, error: "Insufficient credits" });
    });

    it("does not call batch.commit when credits are insufficient", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(50));

      await confirmCompany(
        { company1: { action: "wrong", newData: { name: "Wrong Co" } } },
        {}, {}
      );

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("calls changedCompaniesRef.set outside batch for wrong action", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "wrong", newData: { name: "Wrong Co" } } },
        {}, {}
      );

      expect(mockChangedCompaniesSet).toHaveBeenCalledWith(
        expect.objectContaining({ company1: expect.anything() }),
        { merge: true }
      );
    });

    it("removes companyId from companies_to_confirm via batch.set for wrong action", async () => {
      mockGetTokens.mockResolvedValue({ decodedToken: validDecodedToken });
      mockUserGet.mockResolvedValue(makeUserSnap(500));

      await confirmCompany(
        { company1: { action: "wrong", newData: { name: "Wrong Co" } } },
        {}, {}
      );

      const arrayRemoveCall = mockBatchSet.mock.calls.find(
        ([, data]) => data?.companies_to_confirm !== undefined
      );
      expect(arrayRemoveCall).toBeDefined();
      expect(arrayRemoveCall![2]).toEqual({ merge: true });
    });
  });

  describe("authentication", () => {
    it("returns { success: false, error: 'User not authenticated' } when tokens are null", async () => {
      mockGetTokens.mockResolvedValue(null);

      const result = await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme" } } },
        {}, {}
      );

      expect(result).toEqual({ success: false, error: "User not authenticated" });
    });

    it("does not call batch.commit when unauthenticated", async () => {
      mockGetTokens.mockResolvedValue(null);

      await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme" } } },
        {}, {}
      );

      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("returns auth error when email is not verified", async () => {
      mockGetTokens.mockResolvedValue({
        decodedToken: { ...validDecodedToken, email_verified: false },
      });

      const result = await confirmCompany(
        { company1: { action: "confirm", newData: { name: "Acme" } } },
        {}, {}
      );

      expect(result).toEqual({ success: false, error: "User not authenticated" });
    });
  });
});
