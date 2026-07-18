import { test, expect } from "@playwright/test";

test("landing renders all sections without errors", async ({ page }) => {
  const pageErrors: string[] = [];
  const failedSameOrigin: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (req) => {
    if (new URL(req.url()).origin === new URL(page.url()).origin) {
      failedSameOrigin.push(req.url());
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /every agent action, accounted for/i }),
  ).toBeVisible();
  await expect(page.getByText("THE PROBLEM")).toBeVisible();
  await expect(page.getByLabel("example receipts")).toBeVisible();
  await expect(page.locator("#how")).toBeVisible();
  await expect(page.locator("#proof")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /stop trusting/i }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(failedSameOrigin).toEqual([]);
});

test("landing has no horizontal overflow at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(391);
});

test("primary CTAs are keyboard focusable", async ({ page }) => {
  await page.goto("/");
  const demoLink = page.getByRole("link", { name: "Open live demo" }).first();
  await demoLink.focus();
  await expect(demoLink).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app/);
});
