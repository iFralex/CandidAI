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
    await expect(page.getByText("Your first application").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /find the right person/i })).toBeVisible();
    await page.getByRole("button", { name: "Create my first application" }).click();
    await expect(page.getByRole("heading", { name: "Let’s start with you" })).toBeVisible();
    await expect(page.getByText("Choose Your Success Plan")).toHaveCount(0);
  });

  test("restores the meaningful recruiter-search state", async ({ page }) => {
    const preview = {
      status: "running",
      stage: "recruiter_search",
      company: { name: "Spotify", domain: "spotify.com" },
      searchContext: {
        queryCount: 30,
        narrative: "We’re prioritizing European recruiters hiring for Product and Design roles.",
        targetRole: "Senior Product Designer",
        strengths: ["Product design", "SaaS experience"],
      },
      searchProgress: { attempt: 2, total: 91, strategy: "Skills, history and country", found: false },
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
    await expect(page.getByRole("heading", { name: "We know what to look for." })).toBeVisible();
    await expect(page.getByText(/Senior Product Designer/)).toBeVisible();
    await expect(page.getByText("Skills, history and country")).toBeVisible();
  });

  test("puts paid conversion on the completed candidacy page", async ({ page }) => {
    const preview = {
      status: "completed",
      stage: "preview_ready",
      company: { name: "Spotify", domain: "spotify.com" },
      recruiter: { name: "Giulia Rossi", jobTitle: "Senior Talent Partner" },
      recruiterProfile: { location: "Stockholm, Sweden", skills: ["Talent acquisition"], experience: [{ title: "Senior Talent Partner", company: "Spotify" }], education: [] },
      replayStrategies: ["Product recruiting in Sweden"],
      email: { subject: "Product design fit at Spotify", body: "Hi Giulia,\n\nA personalized introduction.", keyPoints: ["Specific role fit"] },
    };
    await mockUser(page, { onboardingStep: 5, onboardingStage: "preview_ready", onboardingPreview: preview });
    await page.route("**/api/protected/onboarding-preview", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, preview }) }));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your first application is ready" })).toBeVisible();
    await expect(page.getByText("Giulia Rossi", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "This wasn’t a template. It was a complete research process." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open in my email app" })).toBeVisible();
    await page.evaluate(() => { Math.random = () => 0 });
    await page.getByRole("button", { name: "Replay the research" }).click();
    await expect(page.getByRole("heading", { name: "We know what to look for." })).toBeVisible();
    await expect(page.getByText("Product recruiting in Sweden", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your application is taking shape" })).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText("Writing a personal introduction to Giulia")).toBeVisible();
    await page.getByRole("button", { name: "Back to result" }).click();
    await expect(page.getByRole("heading", { name: "Your first application is ready" })).toBeVisible();
    await page.getByRole("button", { name: "View full recruiter profile" }).click();
    await expect(page.getByText("Talent acquisition")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Continue with this plan" }).first().click();
    await expect(page.getByRole("heading", { name: "Continue with Base" })).toBeVisible();
    await expect(page.getByText("Secure one-time payment.")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("button", { name: /explore the dashboard/i })).toBeVisible();
  });

  test("renders a found recruiter after the realtime state refresh", async ({ page }) => {
    const preview = {
      status: "waiting_confirmation",
      stage: "recruiter_found",
      jobId: "preview-job",
      company: { name: "NVIDIA", domain: "nvidia.com" },
      recruiter: { name: "Claudia Fenaroli", jobTitle: "Senior HR Generalist" },
      matchedQuery: { id: 3, name: "Seniority, skills and country", criteria: [] },
    };
    await mockUser(page, { onboardingStep: 4, onboardingStage: "recruiter_found", onboardingPreview: preview });
    await page.route("**/api/protected/onboarding-preview", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, preview }) }));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your application is taking shape" })).toBeVisible();
    await expect(page.getByText("Claudia Fenaroli")).toBeVisible();
    await expect(page.getByText(/already writing the email/i)).toBeVisible();
  });
});
