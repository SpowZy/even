import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("the money flow: seed, verify green, tamper, verify red, export", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await page.goto("/app");
  await page.getByRole("button", { name: "Run demo agent" }).first().click();

  // The seeded run verifies green.
  await expect(page.getByText(/CHAIN VERIFIED/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("row").nth(1)).toBeVisible();

  // Receipt detail drawer opens.
  await page.getByRole("row").nth(1).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  // Tamper: the chain must go red and name the broken link.
  await page.getByRole("button", { name: "Simulate tampering" }).click();
  await expect(page.getByText(/CHAIN BROKEN at seq \d+/)).toBeVisible({
    timeout: 15_000,
  });

  // CFO export downloads with the expected shape.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CFO CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^even-.*\.csv$/);
  const path = await download.path();
  const csv = await readFile(path!, "utf8");
  expect(csv).toContain("tool,calls,input_tokens,output_tokens,usd");
  expect(csv).toContain("TOTAL");
  expect(csv).toContain("extract_invoice");
});
