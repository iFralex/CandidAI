import { test, expect } from "@playwright/test";

test.describe("Landing – apple-style experiment variant", () => {
    test("renders the apple variant when forced via query override", async ({ page }) => {
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        await expect(page.locator('[data-variant="apple"]')).toBeVisible();
        await expect(page.getByRole("heading", { name: /land your/i })).toBeVisible();
    });

    test("hero CTA only becomes opaque and interactive after scrolling through the pinned sequence", async ({ page }) => {
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        // Playwright's "visible" check only looks at bounding box / display /
        // visibility — an element sitting at `opacity: 0` still counts as
        // visible and clickable to Playwright, so a naive "find the CTA and
        // click it" test would pass even if the scroll-reveal animation were
        // completely broken (opacity permanently stuck at 0). Check the real
        // computed opacity AND visibility of the motion-driven wrapper: both
        // are now toggled (not just opacity) so the faded-out CTA is also
        // genuinely out of the tab order and hit-testing, not just invisible.
        const ctaBlock = page.locator('[data-testid="apple-hero-cta"]');
        await expect(ctaBlock).toHaveCSS("opacity", "0");
        await expect(ctaBlock).toHaveCSS("visibility", "hidden");

        // Scroll exactly to the end of the pinned hero (`useScroll`'s
        // "end end" offset means progress = 1 once the wrapper's bottom
        // reaches the viewport's bottom) — deterministic regardless of
        // viewport size or browser, unlike a fixed wheel-delta guess.
        await page.evaluate(() => {
            const hero = document.querySelector('[data-testid="apple-hero"]');
            if (!hero) return;
            const rect = hero.getBoundingClientRect();
            window.scrollTo(0, window.scrollY + rect.top + hero.clientHeight - window.innerHeight);
        });
        await page.waitForTimeout(300);

        await expect(ctaBlock).toHaveCSS("opacity", "1");
        await expect(ctaBlock).toHaveCSS("visibility", "visible");
        const registerLink = ctaBlock.getByRole("link", { name: /start free test/i });
        await expect(registerLink).toBeVisible();
        await registerLink.click();
        await page.waitForURL(/\/register/);
    });

    test("no horizontal page overflow on a narrow mobile viewport", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 667 });
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        const hasHorizontalOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(hasHorizontalOverflow).toBe(false);
    });

    test("mobile hero email and final CTA do not overlap", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 667 });
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        const hero = page.locator('[data-testid="apple-hero"]');
        await hero.evaluate((element) => {
            window.scrollTo(0, element.offsetTop + element.clientHeight - window.innerHeight);
        });
        await page.waitForTimeout(300);

        const emailBox = await page.locator('[data-testid="apple-hero-email-mobile"]').boundingBox();
        const ctaBox = await page.locator('[data-testid="apple-hero-cta"]').boundingBox();
        expect(emailBox).not.toBeNull();
        expect(ctaBox).not.toBeNull();
        expect(emailBox!.y + emailBox!.height).toBeLessThanOrEqual(ctaBox!.y - 12);
    });

    test("the quiet early CTA is reachable without scrolling at all", async ({ page }) => {
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        const earlyCta = page.locator('[data-testid="apple-hero-early-cta"]');
        await expect(earlyCta).toHaveCSS("opacity", "1");
        await earlyCta.getByRole("link", { name: /try one email free/i }).click();
        await page.waitForURL(/\/register/);
    });

    test("keeps pricing, FAQ and footer intact in the apple variant", async ({ page }) => {
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        await expect(page.locator("#pricing")).toBeVisible();
        await expect(page.getByText(/frequently asked questions/i)).toBeVisible();
        await expect(page.getByText(/all rights reserved/i)).toBeVisible();
    });

    test("a real wheel gesture over the gallery moves it horizontally", async ({ page }) => {
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        const gallery = page.locator('[data-testid="apple-email-gallery"]');
        await expect(gallery).toBeVisible();
        const before = await gallery.evaluate((el) => el.scrollLeft);

        // Hover the gallery and send a real vertical wheel gesture — this
        // exercises the actual wheel-to-horizontal conversion code path,
        // unlike directly poking `scrollLeft` (which would pass even if the
        // wheel handler were broken or missing).
        await gallery.hover();
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(100);

        const after = await gallery.evaluate((el) => el.scrollLeft);
        expect(after).toBeGreaterThan(before);
    });

    test("keyboard ArrowRight moves the scroll position through the gallery", async ({ page }) => {
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        const gallery = page.locator('[data-testid="apple-email-gallery"]');
        await gallery.focus();
        await expect(gallery).toBeFocused();

        const before = await gallery.evaluate((el) => el.scrollLeft);
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(100);
        const after = await gallery.evaluate((el) => el.scrollLeft);
        expect(after).toBeGreaterThan(before);
    });

    test("wheel scroll releases to the page once the gallery is fully scrolled", async ({ page }) => {
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        const gallery = page.locator('[data-testid="apple-email-gallery"]');
        await expect(gallery).toBeVisible();

        // Jump straight to the gallery's right edge, then keep sending
        // downward wheel gestures — the boundary check in the wheel handler
        // must stop intercepting once there's nothing left to scroll toward,
        // so the page itself should keep scrolling instead of getting stuck.
        await gallery.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        const clampedScrollLeft = await gallery.evaluate((el) => el.scrollLeft);

        const pageScrollBefore = await page.evaluate(() => window.scrollY);
        await gallery.hover();
        await page.mouse.wheel(0, 600);
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(150);

        const pageScrollAfter = await page.evaluate(() => window.scrollY);
        const galleryScrollAfter = await gallery.evaluate((el) => el.scrollLeft);

        expect(pageScrollAfter).toBeGreaterThan(pageScrollBefore);
        expect(galleryScrollAfter).toBe(clampedScrollLeft);
    });

    test("under reduced motion, the gallery keyboard nav advances past the second card and the hero CTA is already visible", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/?ca_exp_landing_redesign_v1=apple");

        // The static hero shows its full CTA immediately — no scrolling
        // needed, and no opacity/visibility gating to fight through.
        await expect(page.getByRole("link", { name: /start free test/i }).first()).toBeVisible();

        // Regression check: the gallery's scroll/resize-tracking effect must
        // stay active under reduced motion (only the visual scale/opacity
        // falloff between cards is disabled) — if it were disabled too,
        // `activeIndex` would stay stuck at 0 forever, and repeated
        // ArrowRight presses would never advance past the second card.
        const gallery = page.locator('[data-testid="apple-email-gallery"]');
        await gallery.focus();
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press("ArrowRight");
            await page.waitForTimeout(50);
        }
        const scrollLeft = await gallery.evaluate((el) => el.scrollLeft);
        const maxScrollLeft = await gallery.evaluate((el) => el.scrollWidth - el.clientWidth);
        // Three presses should have moved meaningfully past just the second
        // card — not all the way clamped at the very first step.
        expect(scrollLeft).toBeGreaterThan(maxScrollLeft * 0.3);
    });
});
