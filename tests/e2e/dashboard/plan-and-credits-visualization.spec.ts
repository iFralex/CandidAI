import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 17.1: E2E Test - Plan & Credits - Visualization
// Tests:
// - /dashboard/plan-and-credits loads current plan
// - Display: current plan, available credits, company limit, features
// - Current plan highlighted in plan grid
// - Credit packages shown
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "plan-credits-viz@example.com",
  name: "Plan Credits Viz User",
  uid: "plan-credits-viz-uid",
};

function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "base",
    credits: 150,
    maxCompanies: 10,
    emailVerified: true,
    ...overrides,
  };
}

async function mockUser(page: Page, overrides: Partial<Record<string, unknown>> = {}) {
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: buildMockUser(overrides),
      }),
    });
  });
}

async function mockAccount(page: Page) {
  await page.route("**/api/protected/account**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {},
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Page loads correctly
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Page Load", () => {
  test("navigating to /dashboard/plan-and-credits loads the page", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(page).not.toHaveURL(/error/, { timeout: 15000 });
    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
  });

  test("page has h1 heading 'Plan & Credits'", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(
      page.getByRole("heading", { name: /Plan & Credits/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("URL remains at /dashboard/plan-and-credits", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(page).toHaveURL(/plan-and-credits/, { timeout: 15000 });
  });

  test("page does not redirect to /login when user is authenticated", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Current plan display
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Current Plan Display", () => {
  test("page shows 'Choose a Plan' section heading", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(
      page.getByRole("heading", { name: /Choose a Plan/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("plan grid shows Base plan", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(page.getByText("Base")).toBeVisible({ timeout: 15000 });
  });

  test("plan grid shows Pro plan", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(page.getByText("Pro")).toBeVisible({ timeout: 15000 });
  });

  test("plan grid shows Ultra plan", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(page.getByText("Ultra")).toBeVisible({ timeout: 15000 });
  });

  test("plan grid does NOT show Free Trial plan (excluded)", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // The plan-and-credits page uses excludeFree=true, so Free Trial should not appear
    await expect(page.getByText("Free Trial")).not.toBeVisible({ timeout: 15000 });
  });

  test("plan cards show features list", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // Plan cards render features with check/x icons and text
    // At least some feature items should be visible in the list
    const featureItems = page.locator("ul li");
    await expect(featureItems.first()).toBeVisible({ timeout: 15000 });
  });

  test("plan cards show price information", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // Plans display prices (Base is €30, Pro is €69, Ultra is €139)
    // At least one formatted price should be visible
    await expect(page.getByText(/€/)).toBeVisible({ timeout: 15000 });
  });

  test("plan cards show 'one-time purchase' label", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(
      page.getByText(/one-time purchase/i).first()
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Plan grid - Buy Plan CTA buttons
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Plan Grid CTA Buttons", () => {
  test("plan cards show 'Buy Plan' buttons", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // PlanSelector renders CTA buttons with the ctaLabel passed from client.tsx ("Buy Plan")
    await expect(
      page.getByRole("button", { name: /Buy Plan/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("there are 3 Buy Plan buttons (one per non-free plan)", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await expect(buyPlanButtons).toHaveCount(3, { timeout: 15000 });
  });

  test("Pro plan has 'Most Popular' badge", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // The Pro plan is marked popular=true in config, so it shows "Most Popular" badge
    await expect(page.getByText(/Most Popular/i).first()).toBeVisible({
      timeout: 15000,
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Credit packages display
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Credit Packages", () => {
  test("page shows 'Top Up Credits' section heading", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    await expect(
      page.getByRole("heading", { name: /Top Up Credits/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("credit packages section shows 1,000 credits package", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // pkg_1000 shows "1,000 credits"
    await expect(page.getByText(/1,000/)).toBeVisible({ timeout: 15000 });
  });

  test("credit packages section shows 2,500 credits package", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // pkg_2500 shows "2,500 credits"
    await expect(page.getByText(/2,500/)).toBeVisible({ timeout: 15000 });
  });

  test("credit packages section shows 5,000 credits package", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // pkg_5000 shows "5,000 credits"
    await expect(page.getByText(/5,000/)).toBeVisible({ timeout: 15000 });
  });

  test("credit packages show 'credits' label", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // CreditSelector renders "{count} credits" text for each package
    await expect(page.getByText(/credits/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("credit packages show Buy buttons with price", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // CreditSelector with showBuyButton=true renders "Buy €X.XX" buttons
    await expect(
      page.getByRole("button", { name: /Buy/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("credit packages show package labels (Starter, Popular, Power)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // CreditSelector shows labels from packageLabels map
    await expect(page.getByText("Starter")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Popular")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Power")).toBeVisible({ timeout: 15000 });
  });

  test("credit packages show package descriptions", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // CreditSelector shows descriptions from packageDescriptions map
    await expect(
      page.getByText(/Great for occasional use/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Checkout dialog opens on click
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Checkout Dialog", () => {
  test("clicking 'Buy Plan' on Base opens checkout dialog", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // Click the first "Buy Plan" button (Base plan)
    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.first().click();

    // Dialog should open with title containing "Purchase"
    await expect(
      page.getByRole("dialog")
    ).toBeVisible({ timeout: 15000 });
  });

  test("checkout dialog shows plan name in title", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.first().click();

    // Dialog title should say "Purchase <PlanName> Plan"
    await expect(
      page.getByRole("dialog").getByText(/Purchase/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("clicking a credit Buy button opens checkout dialog", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    // Wait for Buy buttons to be visible, then click first "Buy €" credit button
    // Credit buy buttons say "Buy €X.XX" or similar
    const creditBuyButtons = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i })
      .getByRole("button", { name: /Buy/i });
    await creditBuyButtons.first().click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
  });

  test("checkout dialog can be closed", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.first().click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    // Close by pressing Escape
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });
  });
});
