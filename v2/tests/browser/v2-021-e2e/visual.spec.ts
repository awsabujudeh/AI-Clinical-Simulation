import { expect, test, type Page } from "@playwright/test";
async function stats(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/features/visual-patient/VisualPatient.tsx";
    const module = await import(/* @vite-ignore */ path);
    return module.visualPatientDiagnostics(document.querySelector(".visual-patient-native canvas"));
  });
}
test("actual V2 STEMI: approved asset, persistent instance, exam reveals, breathing, safe camera and action intent", async ({ page }, info) => {
  let loads = 0; const errors: string[] = []; let commands = 0;
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (r.url().endsWith(".glb")) loads++; if (r.url().includes("/actions/propose")) commands++; });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Enter physical examination", exact: true })).toBeEnabled({ timeout: 90000 });
  const initial = await stats(page); expect(initial.modelLoads).toBe(1); expect(initial.state.face).toBe("pain");
  await page.screenshot({ path: info.outputPath("student-primary.png"), fullPage: true });
  expect(errors).toEqual([]);
  const breath = initial.breathing;
  await expect.poll(async () => (await stats(page)).breathing).not.toBe(breath);
  await page.getByLabel("Question for the patient", { exact: true }).fill("Where is your pain?");
  const questionResponse = page.waitForResponse(r => r.url().endsWith("/questions") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Ask patient", exact: true }).click();
  // The unchanged STEMI case forbids Patient AI. Preserve this real denial rather
  // than fabricate an answer/audio for the recording. This is a documented demo blocker.
  expect((await questionResponse).status()).toBe(422);
  await expect(page.locator(".patient-conversation__turn")).toHaveCount(0);
  expect((await stats(page)).state.speaking).toBe(false); // Text is not playback.
  await page.getByRole("button", { name: "Enter physical examination", exact: true }).click();
  await expect.poll(async () => (await stats(page)).positionMix).toBe(1);
  await page.screenshot({ path: info.outputPath("supine-examination.png"), fullPage: true });
  for (const [label, region] of [["Chest","CHEST"],["Abdomen","ABDOMEN"],["Left arm","LEFT_ARM"],["Right arm","RIGHT_ARM"],["Lower legs","LOWER_LEGS"],["Cover / Reset","DEFAULT_COVERED"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect.poll(async () => (await stats(page)).camera.transitioning).toBe(false);
    const s = await stats(page); expect(s.exam.region).toBe(region); expect(s.camera.insideRoom).toBe(true); expect(s.camera.insideObstacle).toBe(false); expect(s.modelUUID).toBe(initial.modelUUID);
    if (region === "CHEST") {
      await page.screenshot({ path: info.outputPath("physical-exam-chest.png"), fullPage: true });
      await page.locator(".visual-patient-native__viewport").screenshot({ path: info.outputPath("exposed-chest-close.png") });
      const value = s.breathing; await expect.poll(async () => (await stats(page)).breathing).not.toBe(value);
      const canvas = page.locator(".visual-patient-native canvas"); const box = (await canvas.boundingBox())!;
      // Actual pointer raycast, not an injected finding/event.
      for (const [x,y] of [[.5,.5],[.48,.45],[.52,.55],[.45,.55]] as const) {
        await canvas.click({ position: { x: box.width*x, y: box.height*y } });
        if ((await stats(page)).exam.requestCount) break;
      }
      await expect(page.getByTestId("visual-exam-intent")).toBeVisible(); expect(commands).toBe(0);
      await expect(page.getByRole("tab", { name: "Examination", exact: true })).toHaveAttribute("aria-selected", "true");
    }
  }
  await page.getByRole("button", { name: "Exit examination", exact: true }).click();
  await expect.poll(async () => (await stats(page)).positionMix).toBe(0);
  expect((await stats(page)).modelUUID).toBe(initial.modelUUID); expect(loads).toBe(1); expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  await expect.poll(async () => (await stats(page)).camera.insideRoom).toBe(true);
  const view = (await page.locator(".visual-patient-native canvas").boundingBox())!;
  await page.mouse.move(view.x + view.width * .55, view.y + view.height * .45); await page.mouse.down();
  await page.mouse.move(view.x + view.width * .85, view.y + view.height * .6, { steps: 8 }); await page.mouse.up();
  expect((await stats(page)).camera.insideRoom).toBe(true);
});
test("asset failure preserves clinical UI and typed interaction", async ({ page }) => {
  await page.route("**/*.glb", route => route.abort()); await page.goto("/");
  await expect(page.getByText("Patient view unavailable", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("tab", { name: "Examination", exact: true })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Clinical monitor", exact: true })).toBeVisible();
});
test("WebGL unavailable preserves clinical UI without a renderer", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind === "webgl2" || kind === "webgl" || kind === "experimental-webgl") return null;
      return Reflect.apply(getContext, this, [kind, ...args]);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.getByText("Patient view unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Examination", exact: true })).toBeEnabled();
});
test("modified manifest bytes fail asset integrity before scene readiness", async ({ page }) => {
  await page.route("**/visual_patient_stemi_physical_exam_runtime_v01.json", async route => {
    const original = await route.fetch(); await route.fulfill({ response: original, body: (await original.text()) + " " });
  });
  await page.goto("/");
  await expect(page.getByText("Patient view unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter physical examination", exact: true })).toBeDisabled();
});
