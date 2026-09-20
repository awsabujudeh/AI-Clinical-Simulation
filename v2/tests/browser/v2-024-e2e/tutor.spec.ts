import { test, expect } from "@playwright/test";
test("STEMI actual App: review evidence, Tutor test-double priorities, pending sources and outage", async ({ page }, info) => {
  await page.route("**/*.glb", route => route.abort()); // existing static fallback; no visual changes
  const bootstrap = await (await page.request.get("/__review/session")).json();
  expect(bootstrap.tutor_provider_mode).toBe("TEST_DOUBLE");
  const state = (await (await page.request.get(`/v1/sessions/${bootstrap.session_id}/state`)).json()).data;
  const action = await page.request.post(`/v1/sessions/${bootstrap.session_id}/actions/propose`, {
    headers: { "Idempotency-Key": "idempotency.tutor.proof.ecg" }, data: {
      command_id: "command.tutor.proof.ecg", action_request_id: "action-request.tutor.proof.ecg",
      action_id: "investigation.ecg-standard", parameters: {}, expected_state_version: state.state_version, source: "UI" }
  });
  expect(action.status()).toBe(200);
  expect((await page.request.post("/__review/advance")).status()).toBe(200);
  await page.goto("/");
  await page.getByRole("button", { name: "Review debrief snapshot", exact: true }).click();
  const debrief = page.getByTestId("tutor-debrief");
  await expect(debrief).toBeVisible();
  await expect(debrief).toContainText("AI-assisted learning priorities");
  await expect(debrief).toContainText("Curriculum mapping pending source approval");
  await expect(debrief).toContainText("SOURCE_PENDING");
  await expect(debrief).toContainText("Unresolved");
  await expect(debrief).toContainText("Completed criterion");
  await expect(debrief).toContainText("Safety watch — not a recommendation");
  await expect(debrief).toContainText("no matching unsafe event recorded");
  await debrief.locator("..").screenshot({ path: info.outputPath("stemi-tutor-review.png") });
  // Actual server keeps simulation truth and scoring independent of Tutor calls.
  const before = (await (await page.request.get(`/v1/sessions/${bootstrap.session_id}/state`)).json()).data;
  await page.route("**/debriefs", route => route.abort());
  await page.getByRole("button", { name: "Review debrief snapshot", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Tutor unavailable" })).toBeVisible();
  await expect(debrief).toContainText("Deterministic score");
  await expect(debrief).toContainText("Critical actions");
  await expect(debrief).toContainText("Clinical-Time window");
  const after = (await (await page.request.get(`/v1/sessions/${bootstrap.session_id}/state`)).json()).data;
  expect(after).toEqual(before);
  await debrief.locator("..").screenshot({ path: info.outputPath("stemi-tutor-degraded.png") });
});
