import { expect, test } from "@playwright/test";
for (
  const [patient, port, bp] of [["Khalid", 4214, "88/60"], [
    "Dana",
    4215,
    "82/48",
  ]] as const
) {
  test(
    `${patient} actual acquired observation, cuff, clock and reload without providers`,
    async ({ page }, info) => {
      await page.route(
        "**/*",
        (r) =>
          new URL(r.request().url()).hostname === "127.0.0.1"
            ? r.continue()
            : r.abort(),
      );
      const origin = `http://127.0.0.1:${port}`;
      const b = await (await page.request.get(`${origin}/__review/session`))
        .json();
      await page.goto(`${origin}/sessions/${b.session_id}`);
      await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({
        timeout: 90000,
      });
      await expect(page.locator('[data-observation="BP"] strong')).toHaveText(
        "—",
      );
      await expect(page.locator('[data-observation="SPO2"] strong')).toHaveText(
        "—",
      );
      const stats = () =>
        page.evaluate(async () => {
          const path = "/src/features/visual-patient/VisualPatient.tsx";
          return (await import(/* @vite-ignore */ path))
            .visualPatientDiagnostics(
              document.querySelector(".visual-patient-native canvas"),
            );
        });
      const first = await stats();
      expect(first.equipment.bp_cuff).toBe(false);
      await page.locator(".monitor-slot").screenshot({
        path: info.outputPath(`${patient}-not-measured.png`),
      });
      await page.getByRole("tab", { name: "Examination", exact: true }).click();
      await page.locator(".action-catalogue").getByRole("button", {
        name: "Measure blood pressure EXAMINATION",
        exact: true,
      }).click({ timeout: 10000 });
      const request = page.waitForResponse((r) =>
        r.url().endsWith("/actions/propose")
      );
      await page.locator(".action-form button[type=submit]").click();
      expect((await request).status()).toBe(200);
      await expect(page.locator('[data-observation="BP"] strong')).toHaveText(
        bp,
      );
      await expect(page.locator('[data-observation="RR"] strong')).toHaveText(
        "—",
      );
      await expect.poll(async () => (await stats()).equipment.bp_cuff).toBe(
        true,
      );
      expect((await stats()).modelUUID).toBe(first.modelUUID);
      const state = async () =>
        (await (await page.request.get(
          `${origin}/v1/sessions/${b.session_id}/state`,
        )).json()).data;
      const measured = await state();
      await expect.poll(async () => (await state()).clinical_time)
        .toBeGreaterThan(measured.clinical_time);
      await page.reload();
      await expect(page.locator('[data-observation="BP"] strong')).toHaveText(
        bp,
      );
      const after = await state();
      expect(after.clinical_time).toBeGreaterThanOrEqual(
        measured.clinical_time,
      );
      expect(after.observations.acquired).toEqual(
        measured.observations.acquired,
      );
      await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({
        timeout: 90000,
      });
      await expect.poll(async () => (await stats()).equipment.bp_cuff).toBe(
        true,
      );
      await page.locator(".monitor-slot").screenshot({
        path: info.outputPath(`${patient}-acquired-after-reload.png`),
      });
      await page.screenshot({
        path: info.outputPath(`${patient}-actual-app.png`),
        fullPage: true,
      });
      // A failed 3D asset is independent of measurement/time authority.
      await page.route("**/*.glb", (route) => route.abort());
      await page.reload();
      await expect(
        page.getByText("Static fallback — 3D view unavailable", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator('[data-observation="BP"] strong')).toHaveText(
        bp,
      );
      await page.getByRole("tab", { name: "Examination", exact: true }).click();
      await page.locator(".action-catalogue").getByRole("button", {
        name: "Assess respiratory rate EXAMINATION", exact: true,
      }).click();
      const degradedMeasurement = page.waitForResponse((r) => r.url().endsWith("/actions/propose"));
      await page.locator(".action-form button[type=submit]").click();
      expect((await degradedMeasurement).status()).toBe(200);
      await expect(page.locator('[data-observation="RR"] strong')).not.toHaveText("—");
      await expect(page.getByText("Static fallback — 3D view unavailable", { exact: true })).toBeVisible();
      expect((await state()).clinical_time).toBeGreaterThanOrEqual(after.clinical_time + 30);
      await page.screenshot({
        path: info.outputPath(`${patient}-static-degraded.png`),
        fullPage: true,
      });
    },
  );
}
