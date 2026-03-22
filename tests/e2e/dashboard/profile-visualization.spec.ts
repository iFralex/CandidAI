import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 19.1: E2E Test - Profile - Visualization
// Tests:
// - /dashboard/profile loads profile data
// - Display: current name, email (read-only), plan, credits
// - Name field is editable
// - Profile picture upload (if supported)
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "profile-viz@example.com",
  name: "Profile Viz User",
  uid: "profile-viz-uid",
};

function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "pro",
    credits: 250,
    maxCompanies: 20,
    emailVerified: true,
    ...overrides,
  };
}

async function mockUser(
  page: Page,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const userData = buildMockUser(overrides);
  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(userData)).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: userData,
      }),
    });
  });
}

async function mockAccount(page: Page) {
  const accountData = { success: true, data: {} };
  await page.request.post('/api/test/set-mock', {
    data: { pattern: '/api/protected/account', response: accountData },
  });
  await page.route("**/api/protected/account**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(accountData),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Page loads correctly
// ---------------------------------------------------------------------------

test.describe("Profile - Page Load", () => {
  test("navigating to /dashboard/profile loads the page", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page).not.toHaveURL(/error/, { timeout: 15000 });
    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
  });

  test("page has h1 heading 'Profile'", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(
      page.getByRole("heading", { name: /Profile/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("URL remains at /dashboard/profile", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page).toHaveURL(/profile/, { timeout: 15000 });
  });

  test("page shows subtitle about managing profile information", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(
      page.getByText(/Manage your profile information/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Basic Info section
// ---------------------------------------------------------------------------

test.describe("Profile - Basic Info Section", () => {
  test("page shows 'Basic Info' section heading", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText("Basic Info")).toBeVisible({ timeout: 15000 });
  });

  test("page shows 'Display Name' label", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText("Display Name")).toBeVisible({
      timeout: 15000,
    });
  });

  test("name input field is visible", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.locator("input#name")).toBeVisible({ timeout: 15000 });
  });

  test("name input field is editable (not read-only)", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    const nameInput = page.locator("input#name");
    await expect(nameInput).toBeVisible({ timeout: 15000 });

    // Input should be enabled and editable
    await expect(nameInput).toBeEnabled({ timeout: 15000 });
  });

  test("name input can receive text input", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    const nameInput = page.locator("input#name");
    await expect(nameInput).toBeVisible({ timeout: 15000 });

    // Clear and type a new name
    await nameInput.clear();
    await nameInput.fill("New Test Name");

    // Input should reflect the new value
    await expect(nameInput).toHaveValue("New Test Name");
  });

  test("page shows 'Save Changes' button in basic info section", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(
      page.getByRole("button", { name: /Save Changes/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("Save Changes button is enabled when form is loaded", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    const saveBtn = page.getByRole("button", { name: /Save Changes/i });
    await expect(saveBtn).toBeVisible({ timeout: 15000 });
    await expect(saveBtn).toBeEnabled({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Profile picture upload
// ---------------------------------------------------------------------------

test.describe("Profile - Profile Picture Upload", () => {
  test("page shows 'Profile Picture' label", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText("Profile Picture")).toBeVisible({
      timeout: 15000,
    });
  });

  test("page shows 'Upload new photo' button", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText(/Upload new photo/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("profile picture area is visible (avatar circle)", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    // The avatar is a rounded div that is clickable
    const avatarArea = page.locator(".rounded-full").first();
    await expect(avatarArea).toBeVisible({ timeout: 15000 });
  });

  test("file input for picture upload is present in DOM", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    // Hidden file input for profile picture is present in DOM
    const fileInput = page.locator("input[type='file'][accept='image/*']");
    await expect(fileInput).toBeAttached({ timeout: 15000 });
  });

  test("file input accepts image files", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    const fileInput = page.locator("input[type='file'][accept='image/*']");
    // The accept attribute should restrict to image files
    const acceptAttr = await fileInput.getAttribute("accept");
    expect(acceptAttr).toBe("image/*");
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Email update section
// ---------------------------------------------------------------------------

test.describe("Profile - Email Section", () => {
  test("page shows 'Email Address' section heading", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText("Email Address")).toBeVisible({
      timeout: 15000,
    });
  });

  test("page shows new email input field", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.locator("input#new-email")).toBeVisible({
      timeout: 15000,
    });
  });

  test("new email input is of type email", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    const emailInput = page.locator("input#new-email");
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    const typeAttr = await emailInput.getAttribute("type");
    expect(typeAttr).toBe("email");
  });

  test("page shows 'Update Email' button", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(
      page.getByRole("button", { name: /Update Email/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("Update Email button is disabled when email input is empty", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    // The button is disabled when email is empty (trimmed)
    const updateBtn = page.getByRole("button", { name: /Update Email/i });
    await expect(updateBtn).toBeVisible({ timeout: 15000 });
    await expect(updateBtn).toBeDisabled({ timeout: 15000 });
  });

  test("Update Email button is enabled when email input has value", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    const emailInput = page.locator("input#new-email");
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    // Type an email address to enable the button
    await emailInput.fill("new@example.com");

    const updateBtn = page.getByRole("button", { name: /Update Email/i });
    await expect(updateBtn).toBeEnabled({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Account Data section
// ---------------------------------------------------------------------------

test.describe("Profile - Account Data Section", () => {
  test("page shows 'Account Data' section heading", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText("Account Data")).toBeVisible({
      timeout: 15000,
    });
  });

  test("page shows 'User Profile' subsection", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText("User Profile")).toBeVisible({
      timeout: 15000,
    });
  });

  test("page shows 'Default Recruiter Criteria' subsection", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(
      page.getByText("Default Recruiter Criteria")
    ).toBeVisible({ timeout: 15000 });
  });

  test("page shows 'Default Custom Prompt' subsection", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText("Default Custom Prompt")).toBeVisible({
      timeout: 15000,
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 6: Credits and plan display in header
// ---------------------------------------------------------------------------

test.describe("Profile - Credits and Plan in Header", () => {
  test("header shows credits count from user data", async ({ page }) => {
    await mockUser(page, { credits: 250, plan: "pro" });
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    // Credits are shown in the dashboard header
    await expect(page.getByText("250").first()).toBeVisible({ timeout: 15000 });
  });

  test("header shows credits for a different credit amount", async ({
    page,
  }) => {
    await mockUser(page, { credits: 100, plan: "base" });
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page.getByText("100").first()).toBeVisible({ timeout: 15000 });
  });

  test("page does not redirect to /login when user is authenticated", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/profile");

    await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  });
});
