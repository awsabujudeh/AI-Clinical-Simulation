import { expect, test, type Page } from "@playwright/test";

async function openActions(page: Page, scenario = "match") {
  await page.goto(`/tests/browser/v2-019b1-e2e/clinical-interpreter-harness.html?scenario=${scenario}`);
  await expect(page.getByRole("heading", { name: "Talk with the patient" })).toBeVisible();
  await page.getByRole("tab", { name: "Examination" }).click();
  await expect(page.getByRole("heading", { name: "Describe a clinical action" })).toBeVisible();
}

test("patient conversation and clinical interpretation remain separate surfaces", async ({ page }) => {
  await page.goto("/tests/browser/v2-019b1-e2e/clinical-interpreter-harness.html");
  await expect(page.getByLabel("Question for the patient")).toBeVisible();
  await expect(page.getByLabel("Clinical command")).toHaveCount(0);
  await page.getByRole("tab", { name: "Examination" }).click();
  await expect(page.getByLabel("Clinical command")).toBeVisible();
  await expect(page.getByLabel("Question for the patient")).toHaveCount(0);
});

test("recognized language only populates the existing manual proposal path", async ({ page }) => {
  await openActions(page);
  await page.getByLabel("Clinical command").fill("Perform the synthetic examination");
  await page.getByRole("button", { name: "Interpret command" }).click();
  await expect(page.getByText(/Recognized for your review/u)).toBeVisible();
  expect(await page.evaluate(() => window.__V2_019B1_TEST_STATE__)).toEqual({ interpretations: 1, submissions: 0 });
  await page.getByRole("button", { name: "Propose action" }).click();
  await expect.poll(() => page.evaluate(() => window.__V2_019B1_TEST_STATE__.submissions)).toBe(1);
});

test("ambiguity and provider outage never hide the manual action catalogue", async ({ page }) => {
  await openActions(page, "ambiguous");
  await page.getByLabel("Clinical command").fill("Do the test");
  await page.getByRole("button", { name: "Interpret command" }).click();
  await expect(page.getByText("More than one available action may match. Choose through the manual catalogue.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Perform synthetic examination" })).toBeVisible();
  expect(await page.evaluate(() => window.__V2_019B1_TEST_STATE__.submissions)).toBe(0);

  await page.goto("/tests/browser/v2-019b1-e2e/clinical-interpreter-harness.html?scenario=unavailable");
  await page.getByRole("tab", { name: "Examination" }).click();
  await page.getByLabel("Clinical command").fill("Perform the synthetic examination");
  await page.getByRole("button", { name: "Interpret command" }).click();
  await expect(page.getByText("Interpreter unavailable. Manual Clinical Actions remain available.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Perform synthetic examination" })).toBeVisible();
  expect(await page.evaluate(() => window.__V2_019B1_TEST_STATE__.submissions)).toBe(0);
});

test("no-match and missing parameters remain non-executable", async ({ page }) => {
  await openActions(page, "no-match");
  await page.getByLabel("Clinical command").fill("What should I give?");
  await page.getByRole("button", { name: "Interpret command" }).click();
  await expect(page.getByText("No explicit available clinical action was recognized.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__V2_019B1_TEST_STATE__.submissions)).toBe(0);

  await page.goto("/tests/browser/v2-019b1-e2e/clinical-interpreter-harness.html?scenario=missing");
  await page.getByRole("tab", { name: "Medications" }).click();
  await page.getByLabel("Clinical command").fill("Give the synthetic medicine");
  await page.getByRole("button", { name: "Interpret command" }).click();
  await expect(page.getByText(/Recognized for your review/u)).toBeVisible();
  await page.getByRole("button", { name: "Propose action" }).click();
  await expect(page.getByText("This field is required.").first()).toBeVisible();
  expect(await page.evaluate(() => window.__V2_019B1_TEST_STATE__.submissions)).toBe(0);
});

test("interpreted medication retains the existing learner confirmation boundary", async ({ page }) => {
  await page.goto("/tests/browser/v2-019b1-e2e/clinical-interpreter-harness.html?scenario=medication");
  await page.getByRole("tab", { name: "Medications" }).click();
  await page.getByLabel("Clinical command").fill("Give the synthetic medicine with explicit values");
  await page.getByRole("button", { name: "Interpret command" }).click();
  await page.getByRole("button", { name: "Propose action" }).click();
  await expect(page.getByText("Confirm this proposal", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__V2_019B1_TEST_STATE__.submissions)).toBe(0);
});

test("ar-JO uses the same non-authoritative interpreter and ended Sessions disable it", async ({ page }) => {
  await page.goto("/tests/browser/v2-019b1-e2e/clinical-interpreter-harness.html");
  await page.getByRole("button", { name: "العربية" }).click();
  await page.getByRole("tab", { name: "الفحص" }).click();
  await page.getByLabel("الأمر السريري").fill("افحص المريض");
  await page.getByRole("button", { name: "تفسير الأمر" }).click();
  await expect(page.getByText(/تم التعرّف عليه لمراجعتك/u)).toBeVisible();

  await page.goto("/tests/browser/v2-019b1-e2e/clinical-interpreter-harness.html?scenario=ended");
  await page.getByRole("tab", { name: "Examination" }).click();
  await expect(page.getByLabel("Clinical command")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Interpret command" })).toBeDisabled();
  expect(await page.evaluate(() => window.__V2_019B1_TEST_STATE__.interpretations)).toBe(0);
});
