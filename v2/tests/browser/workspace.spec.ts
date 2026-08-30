import { expect, test } from "@playwright/test";

test("V2 workspace placeholder loads", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "AI Clinical Simulation Platform V2" })
  ).toBeVisible();
  await expect(page.getByText("Workspace Initialized")).toBeVisible();
});
