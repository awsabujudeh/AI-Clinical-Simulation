import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, scenario = "practice") {
  await page.goto(`/tests/browser/v2-017-e2e/monitor-assessment-harness.html?scenario=${scenario}`);
  await expect(page.getByRole("heading", { name: "Current patient" })).toBeVisible();
}

test("active Practice renders authoritative monitor and learner-safe timeline", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Clinical monitor" })).toBeVisible();
  await expect(page.getByText("112/68", { exact: true })).toBeVisible();
  await expect(page.getByText("Regular rhythm", { exact: true })).toBeVisible();
  await expect(page.getByText("Session started", { exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("committed action refreshes monitor and timeline only through authoritative refetch", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Examination" }).click();
  await page.getByRole("button", { name: /Perform synthetic examination/ }).click();
  await page.getByRole("button", { name: "Propose action" }).click();
  await expect(page.getByText("80", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic examination committed", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__V2_017_TEST_STATE__.submissions)).toBe(1);
  expect(await page.evaluate(() => window.__V2_017_TEST_STATE__.loads)).toBe(2);
});

test("active Assessment withholds score, findings, rubric, and debrief", async ({ page }) => {
  await open(page, "assessment");
  await expect(page.getByText("Assessment in progress", { exact: true })).toBeVisible();
  const assessment = page.getByRole("region", { name: "Assessment and debrief" });
  await expect(assessment).not.toContainText("Overall score");
  await expect(assessment).not.toContainText("Six-domain result");
  await expect(assessment).not.toContainText("Evidence-based debrief");
  await expect(assessment).not.toContainText("rubric");
});

test("authoritative finalization reveals six-domain Assessment and keeps Session read-only", async ({ page }) => {
  await open(page, "assessment");
  await page.getByRole("button", { name: "End simulation" }).click();
  await expect(page.getByText("73.17%", { exact: true })).toBeVisible();
  await expect(page.locator(".domain-score-grid article")).toHaveCount(6);
  await expect(page.getByText("Evidence-backed strength", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Examination" }).click();
  await expect(page.getByRole("button", { name: /Perform synthetic examination/ })).toBeDisabled();
  expect(await page.evaluate(() => window.__V2_017_TEST_STATE__.finalizations)).toBe(1);
});

test("reload of an ended Session restores final monitor, timeline, and Assessment", async ({ page }) => {
  await open(page, "final");
  await expect(page.getByText("112/68", { exact: true })).toBeVisible();
  await expect(page.getByText("Perform synthetic examination", { exact: true })).toBeVisible();
  await expect(page.getByText("73.17%", { exact: true })).toBeVisible();
});

test("Arabic RTL localizes all three surfaces while units remain readable", async ({ page }) => {
  await open(page, "final");
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar-JO");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("نظم منتظم", { exact: true })).toBeVisible();
  await expect(page.getByText("إجراء فحص اصطناعي", { exact: true })).toBeVisible();
  await expect(page.locator(".domain-score-grid").getByText("القصة المرضية", { exact: true })).toBeVisible();
  await expect(page.locator('.monitor-grid small[dir="ltr"]')).toHaveCount(5);
});

test("offline state is visibly stale and freezes private timeline access", async ({ page }) => {
  await open(page, "stale");
  await expect(page.getByText("Last confirmed", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Clinical monitor" }).getByText(/Values and clinical time are frozen/)).toBeVisible();
  await expect(page.getByText(/Timeline updates are unavailable/)).toBeVisible();
  expect(await page.evaluate(() => window.__V2_017_TEST_STATE__.timelineLoads)).toBe(0);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "tablet landscape", width: 1024, height: 768 }
]) {
  test(`${viewport.name} monitor/timeline/Assessment workspace has no horizontal clipping`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page, "final");
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
}
