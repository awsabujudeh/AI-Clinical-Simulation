import { expect, test } from "@playwright/test";

test("V2 workspace placeholder loads", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "AI Clinical Simulation Platform V2" })
  ).toBeVisible();
  await expect(page.getByText("Workspace Initialized")).toBeVisible();
});

test("versioned PWA shell reloads safely without a network", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(
    () => page.evaluate(() => navigator.serviceWorker.controller !== null)
  ).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "AI Clinical Simulation Platform V2" })
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
