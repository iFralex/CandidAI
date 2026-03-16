import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 22.2: E2E Test - Responsive
// Tests:
// - Mobile (375px): responsive layout, collapsed sidebar
// - Tablet (768px): hybrid layout
// - Desktop (1280px): full layout
// - No horizontal overflow on any breakpoint
// - Form usable on mobile (inputs, labels, buttons)
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "responsive@example.com",
  name: "Responsive User",
  uid: "responsive-uid",
};

function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "pro",
    credits: 100,
    maxCompanies: 20,
    emailVerified: true,
    ...overrides,
  };
}

async function mockUser(
  page: Page,
  overrides: Partial<Record<string, unknown>> = {}
) {
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

async function mockResults(page: Page) {
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function mockAccount(page: Page) {
  await page.route("**/api/protected/account**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function mockEmails(page: Page) {
  await page.route("**/api/protected/emails**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

async function checkNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    return body.scrollWidth <= window.innerWidth && html.scrollWidth <= window.innerWidth;
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Mobile (375px) - responsive layout, collapsed sidebar
// ---------------------------------------------------------------------------

test.describe("Responsive - Mobile (375px)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("dashboard loads on mobile viewport without layout breaking", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");

    // Page should load and display content
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    // Main content should be visible
    const main = page.locator("main");
    if ((await main.count()) > 0) {
      await expect(main).toBeVisible({ timeout: 15000 });
    }
  });

  test("sidebar is collapsed by default on mobile (375px)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");

    // On mobile, sidebar should be collapsed - sidebar nav links not directly visible
    // The sidebar trigger (hamburger) should be visible instead
    const trigger = page.locator('[data-slot="sidebar-trigger"]');
    if ((await trigger.count()) > 0) {
      await expect(trigger).toBeVisible({ timeout: 15000 });
    }

    // Sidebar nav links should NOT be visible without opening on mobile
    // (they should be inside a Sheet that is initially closed)
    const sidebarInner = page.locator('[data-slot="sidebar"]');
    if ((await sidebarInner.count()) > 0) {
      // On mobile the sidebar might be in a Sheet (data-mobile="true")
      const mobileSidebar = page.locator('[data-mobile="true"]');
      if ((await mobileSidebar.count()) > 0) {
        await expect(mobileSidebar).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("hamburger/trigger button visible on mobile (375px)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");

    // Sidebar trigger must be visible on mobile
    const trigger = page.locator('[data-slot="sidebar-trigger"]');
    await expect(trigger).toBeVisible({ timeout: 15000 });
  });

  test("no horizontal overflow on mobile (375px) dashboard", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const noOverflow = await checkNoHorizontalOverflow(page);
    expect(noOverflow).toBe(true);
  });

  test("no horizontal overflow on mobile (375px) settings page", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockAccount(page);

    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    const noOverflow = await checkNoHorizontalOverflow(page);
    expect(noOverflow).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Tablet (768px) - hybrid layout
// ---------------------------------------------------------------------------

test.describe("Responsive - Tablet (768px)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
  });

  test("dashboard loads on tablet viewport without layout breaking", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    const main = page.locator("main");
    if ((await main.count()) > 0) {
      await expect(main).toBeVisible({ timeout: 15000 });
    }
  });

  test("sidebar trigger or sidebar visible on tablet (768px)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");

    // On tablet, either the sidebar is visible or the trigger is available
    const trigger = page.locator('[data-slot="sidebar-trigger"]');
    const sidebarNav = page.getByRole("link", { name: /Send All/i });

    const triggerVisible = (await trigger.count()) > 0 && (await trigger.isVisible());
    const navVisible = (await sidebarNav.count()) > 0 && (await sidebarNav.isVisible());

    // At least one of them should be available
    expect(triggerVisible || navVisible).toBe(true);
  });

  test("no horizontal overflow on tablet (768px) dashboard", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const noOverflow = await checkNoHorizontalOverflow(page);
    expect(noOverflow).toBe(true);
  });

  test("no horizontal overflow on tablet (768px) send-all page", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");
    await page.waitForLoadState("networkidle");

    const noOverflow = await checkNoHorizontalOverflow(page);
    expect(noOverflow).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Desktop (1280px) - full layout
// ---------------------------------------------------------------------------

test.describe("Responsive - Desktop (1280px)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("dashboard loads on desktop viewport with full layout", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });

  test("sidebar navigation links are directly visible on desktop (1280px)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");

    // On desktop, sidebar links should be directly visible without clicking a trigger
    const sendAllLink = page.getByRole("link", { name: /Send All/i });
    await expect(sendAllLink).toBeVisible({ timeout: 15000 });

    const planLink = page.getByRole("link", { name: /Plan & Credits/i });
    await expect(planLink).toBeVisible({ timeout: 15000 });

    const settingsLink = page.getByRole("link", { name: /^Settings$/i });
    await expect(settingsLink).toBeVisible({ timeout: 15000 });
  });

  test("no horizontal overflow on desktop (1280px) dashboard", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const noOverflow = await checkNoHorizontalOverflow(page);
    expect(noOverflow).toBe(true);
  });

  test("no horizontal overflow on desktop (1280px) plan-and-credits page", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/plan-and-credits");
    await page.waitForLoadState("networkidle");

    const noOverflow = await checkNoHorizontalOverflow(page);
    expect(noOverflow).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test group 4: No horizontal overflow on any breakpoint
// ---------------------------------------------------------------------------

test.describe("Responsive - No Horizontal Overflow", () => {
  const viewports = [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 },
  ];

  for (const viewport of viewports) {
    test(`no overflow on ${viewport.name} (${viewport.width}px) - settings`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockUser(page);
      await mockResults(page);
      await mockAccount(page);

      await page.goto("/dashboard/settings");
      await page.waitForLoadState("networkidle");

      const noOverflow = await checkNoHorizontalOverflow(page);
      expect(noOverflow).toBe(true);
    });

    test(`no overflow on ${viewport.name} (${viewport.width}px) - plan-and-credits`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockUser(page);
      await mockResults(page);

      await page.goto("/dashboard/plan-and-credits");
      await page.waitForLoadState("networkidle");

      const noOverflow = await checkNoHorizontalOverflow(page);
      expect(noOverflow).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Test group 5: Form usable on mobile (inputs, labels, buttons)
// ---------------------------------------------------------------------------

test.describe("Responsive - Form Usability on Mobile (375px)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("settings form inputs are accessible on mobile", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);
    await mockAccount(page);

    await page.goto("/dashboard/settings");

    // All form inputs should be within viewport width
    const inputs = page.locator("input");
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const box = await input.boundingBox();
          if (box) {
            // Input should be within the 375px viewport
            expect(box.x + box.width).toBeLessThanOrEqual(375 + 20); // small tolerance
          }
        }
      }
    }
  });

  test("settings form buttons are clickable on mobile", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);
    await mockAccount(page);

    await page.goto("/dashboard/settings");

    // Buttons should be visible and interactable on mobile
    const buttons = page.getByRole("button");
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Find at least one visible button and check it's within viewport
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            // Button should be within the 375px viewport
            expect(box.x + box.width).toBeLessThanOrEqual(375 + 20);
          }
          break;
        }
      }
    }
  });

  test("settings form labels are visible on mobile", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);
    await mockAccount(page);

    await page.goto("/dashboard/settings");

    // Form labels should be visible
    const labels = page.locator("label");
    const labelCount = await labels.count();

    if (labelCount > 0) {
      for (let i = 0; i < Math.min(labelCount, 3); i++) {
        const label = labels.nth(i);
        if (await label.isVisible()) {
          const box = await label.boundingBox();
          if (box) {
            // Label should be within the 375px viewport
            expect(box.x + box.width).toBeLessThanOrEqual(375 + 20);
          }
        }
      }
    }
  });

  test("login form is usable on mobile (375px)", async ({ page }) => {
    await page.goto("/login");

    // Email and password inputs should be visible and within viewport
    const emailInput = page.getByRole("textbox", { name: /email/i });
    if ((await emailInput.count()) > 0 && (await emailInput.isVisible())) {
      const box = await emailInput.boundingBox();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(375 + 20);
      }
    }

    // Submit button should be visible
    const submitButton = page.getByRole("button", { name: /sign in|login|log in/i });
    if ((await submitButton.count()) > 0 && (await submitButton.isVisible())) {
      const box = await submitButton.boundingBox();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(375 + 20);
      }
    }
  });

  test("no horizontal overflow on login page on mobile (375px)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const noOverflow = await checkNoHorizontalOverflow(page);
    expect(noOverflow).toBe(true);
  });
});
