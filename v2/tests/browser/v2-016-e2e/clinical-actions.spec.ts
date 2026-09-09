import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, scenario = "success") {
  await page.goto(`/tests/browser/v2-016-e2e/action-harness.html?scenario=${scenario}`);
  await expect(page.getByRole("heading", { name: "Current patient" })).toBeVisible();
}

test("@v2-016 learner selects and submits an action without optimistic medical state", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Examination" }).click();
  await page.getByRole("button", { name: /Perform synthetic examination/ }).click();
  await page.getByRole("button", { name: "Propose action" }).dblclick();
  await expect(page.getByText("Submitting intent", { exact: true })).toBeVisible();
  await expect(page.getByText("72", { exact: true })).toBeVisible();
  await expect(page.getByText("02:05", { exact: true })).toBeVisible();
  await expect(page.getByText(/Action committed and authoritative session refreshed/)).toBeVisible();
  await expect(page.getByText("80", { exact: true })).toBeVisible();
  await expect(page.getByText("02:10", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__V2_016_TEST_STATE__.submissions)).toBe(1);
  expect(await page.evaluate(() => window.__V2_016_TEST_STATE__.loads)).toBe(2);
});

test("@v2-016 structured medication requires valid fields and explicit confirmation", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Medications" }).click();
  await page.getByRole("button", { name: /Propose synthetic study medication/ }).click();
  await page.getByRole("button", { name: "Propose action" }).click();
  await expect(page.getByText("This field is required.")).toHaveCount(3);
  await page.getByLabel(/dose/).fill("10");
  await page.getByLabel(/unit/).selectOption("unit.synthetic-small");
  await page.getByLabel(/route/).selectOption("route.synthetic-a");
  await page.getByRole("button", { name: "Propose action" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm this proposal" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Propose action" }).click();
  await page.getByRole("button", { name: "Confirm and send" }).click();
  await expect(page.getByText(/Action committed and authoritative session refreshed/)).toBeVisible();
  expect(await page.evaluate(() => window.__V2_016_TEST_STATE__.lastParameters)).toEqual({
    dose: 10,
    unit: "unit.synthetic-small",
    route: "route.synthetic-a"
  });
});

test("@v2-016 stale conflict resynchronizes and never auto-reexecutes", async ({ page }) => {
  await open(page, "stale");
  await page.getByRole("tab", { name: "Examination" }).click();
  await page.getByRole("button", { name: /Perform synthetic examination/ }).click();
  await page.getByRole("button", { name: "Propose action" }).click();
  await expect(page.getByText(/Session state changed/)).toBeVisible();
  expect(await page.evaluate(() => window.__V2_016_TEST_STATE__.submissions)).toBe(1);
  expect(await page.evaluate(() => window.__V2_016_TEST_STATE__.loads)).toBe(2);
});

test("@v2-016 known offline state disables clinical mutation", async ({ page }) => {
  await open(page, "offline");
  await expect(page.getByText(/Connection lost/)).toBeVisible();
  await page.getByRole("tab", { name: "Examination" }).click();
  await expect(page.getByRole("button", { name: /Perform synthetic examination/ })).toBeDisabled();
  expect(await page.evaluate(() => window.__V2_016_TEST_STATE__.submissions)).toBe(0);
});

test("@v2-016 Arabic and English action interaction preserve RTL and LTR", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar-JO");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("tab", { name: "الفحص" }).click();
  await expect(page.getByRole("button", { name: /إجراء فحص اصطناعي/ })).toBeVisible();
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "tablet", width: 1024, height: 768 }
]) {
  test(`@v2-016 ${viewport.name} action workspace remains usable`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page);
    await page.getByRole("tab", { name: "Diagnosis / Disposition" }).click();
    await expect(page.getByRole("button", { name: /Enter learner diagnosis/ })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
}

test("@v2-016 keyboard focus reaches actions and no hidden correctness or provider access appears", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Examination" }).focus();
  await page.keyboard.press("Enter");
  const action = page.getByRole("button", { name: /Perform synthetic examination/ });
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Propose action" })).toBeVisible();
  let content = await page.locator("main").textContent();
  expect(content).not.toMatch(/rubric|correct action|expected action|score/iu);
  await page.getByRole("tab", { name: "History" }).click();
  content = await page.locator("main").textContent();
  expect(content).toContain("Reconnect to ask a new question");
});
