import { test, expect, type Page } from "@playwright/test";

const baseUser = {
  uid: "redesign-user",
  email: "candidate@example.com",
  name: "Candidate",
  emailVerified: true,
  onboardingStep: 1,
  onboardingStage: "profile_source",
  plan: "free_trial",
  credits: 0,
};

async function mockUser(page: Page, overrides: Record<string, unknown> = {}) {
  const user = { ...baseUser, ...overrides };
  await page.context().addCookies([{
    name: "__playwright_user__",
    value: Buffer.from(JSON.stringify(user)).toString("base64"),
    domain: "localhost",
    path: "/",
  }]);
}

test.describe("Redesigned first candidacy", () => {
  test("starts from CV or LinkedIn instead of plan selection", async ({ page }) => {
    await mockUser(page);
    await page.goto("/dashboard");
    await expect(page.getByText("La tua prima candidatura").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Partiamo da te" })).toBeVisible();
    await expect(page.getByText("Choose Your Success Plan")).toHaveCount(0);
  });

  test("restores the meaningful recruiter-search state", async ({ page }) => {
    const preview = {
      status: "running",
      stage: "recruiter_search",
      company: { name: "Spotify", domain: "spotify.com" },
      searchContext: {
        queryCount: 30,
        narrative: "Stiamo privilegiando recruiter europei che seguono ruoli Product e Design.",
      },
    };
    await mockUser(page, {
      onboardingStep: 4,
      onboardingStage: "recruiter_search",
      onboardingPreview: preview,
    });
    await page.route("**/api/protected/onboarding-preview", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, preview }),
    }));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /persona giusta dentro Spotify/ })).toBeVisible();
    await expect(page.getByText(/30 strategie/)).toBeVisible();
    await expect(page.getByText(/recruiter europei/)).toBeVisible();
  });

  test("puts paid conversion on the completed candidacy page", async ({ page }) => {
    const preview = {
      status: "completed",
      stage: "preview_ready",
      company: { name: "Spotify", domain: "spotify.com" },
      recruiter: { name: "Giulia Rossi", jobTitle: "Senior Talent Partner" },
      email: { subject: "Product design fit at Spotify", body: "Hi Giulia,\n\nA personalized introduction.", keyPoints: ["Specific role fit"] },
    };
    await mockUser(page, { onboardingStep: 5, onboardingStage: "preview_ready", onboardingPreview: preview });
    await page.route("**/api/protected/onboarding-preview", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, preview }) }));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "La tua prima candidatura è pronta" })).toBeVisible();
    await expect(page.getByText("Giulia Rossi")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ora moltiplica le opportunità" })).toBeVisible();
    await expect(page.getByRole("button", { name: /esplora la dashboard/i })).toBeVisible();
  });
});
