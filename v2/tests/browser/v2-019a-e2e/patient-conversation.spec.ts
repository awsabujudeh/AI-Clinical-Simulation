import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, scenario = "success") {
  await page.goto(`/tests/browser/v2-019a-e2e/patient-conversation-harness.html?scenario=${scenario}`);
  await expect(page.getByRole("heading", { name: "Talk with the patient" })).toBeVisible();
}

test("learner submits a patient question and receives the durable-shaped answer", async ({ page }) => {
  await open(page);
  await page.getByLabel("Question for the patient").fill("How do you feel?");
  await page.getByRole("button", { name: "Ask patient" }).click();
  await expect(page.getByText("Patient responding", { exact: true })).toBeVisible();
  await expect(page.locator(".patient-conversation__turn")).toContainText("I can answer from the reviewed patient information.");
  await expect(page.locator(".patient-conversation__turn")).toContainText("How do you feel?");
  expect(await page.evaluate(() => window.__V2_019A_TEST_STATE__.submissions)).toBe(1);
  await expect(page.getByText(/AI Assistant|ChatGPT/iu)).toHaveCount(0);
});

test("provider unavailable returns an explicit safe failure with no invented answer", async ({ page }) => {
  await open(page, "unavailable");
  await page.getByLabel("Question for the patient").fill("Tell me something");
  await page.getByRole("button", { name: "Ask patient" }).click();
  await expect(page.getByText("Reconnect to ask a new question. No response is generated offline.", { exact: true })).toBeVisible();
  await expect(page.locator(".patient-conversation__turn")).toHaveCount(0);
});

test("offline stale Session keeps conversation read-only", async ({ page }) => {
  await open(page, "offline");
  await expect(page.getByLabel("Question for the patient")).toBeDisabled();
  await expect(page.getByText("Reconnect to ask a new question. No response is generated offline.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__V2_019A_TEST_STATE__.loads)).toBe(0);
});

test("ended Session keeps patient conversation read-only", async ({ page }) => {
  await open(page, "ended");
  await expect(page.getByLabel("Question for the patient")).toBeDisabled();
  await expect(page.getByText("This Session has ended. The transcript remains read-only.", { exact: true })).toBeVisible();
});

test("Arabic patient conversation is localized RTL while preserving the same service", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar-JO");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByLabel("سؤال للمريض").fill("كيف حالك؟");
  await page.getByRole("button", { name: "اسأل المريض" }).click();
  await expect(page.locator(".patient-conversation__turn")).toContainText("أنا بخير ضمن المعلومات المؤلفة للمريض.");
});
