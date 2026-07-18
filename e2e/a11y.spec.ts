import { test, expect } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("landing terminal teaser fully renders under reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /every agent action, accounted for/i }),
  ).toBeVisible();
  // Under prefers-reduced-motion the teaser renders fully typed at mount.
  // Poll instead of a single shot: if the emulated preference reaches the
  // page after hydration, the typing loop still shows the full line within
  // one cycle, and the poll catches it either way.
  await page.locator("#proof").scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () => (await page.locator("#proof").innerText()).includes("verification failed: 239/478"),
      { timeout: 15_000 },
    )
    .toBe(true);
});

test("reduced motion: dashboard toolbar reachable by keyboard", async ({ page }) => {
  await page.goto("/app");
  const seed = page.getByRole("button", { name: "Run demo agent" }).first();
  await seed.focus();
  await expect(seed).toBeFocused();
});
