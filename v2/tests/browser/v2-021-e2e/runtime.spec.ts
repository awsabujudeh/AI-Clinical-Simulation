import { test, expect } from "@playwright/test";
test("presentation contract: pain + speaking + relief share instance and continuous animation clocks", async ({ page }) => {
  let loads = 0; page.on("request", r => { if (r.url().endsWith(".glb")) loads++; });
  const file = decodeURIComponent(new URL("./runtime-harness.html", import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
  await page.goto(`/@fs/${file}`);
  await expect.poll(() => page.evaluate(() => window.__VISUAL_CONTRACT__.ready)).toBe(true);
  const before = await page.evaluate(() => window.__VISUAL_CONTRACT__.runtime.stats());
  const after = await page.evaluate(() => {
    const h = window.__VISUAL_CONTRACT__; h.runtime.setSpeaking(true); return h.runtime.stats();
  });
  expect(after.state).toMatchObject({ face: "pain", body: "pain_body", speaking: true });
  expect(after.modelUUID).toBe(before.modelUUID); expect(after.entryCount).toBe(before.entryCount); expect(after.elapsed).toBeGreaterThanOrEqual(before.elapsed);
  const rest = await page.evaluate(() => {
    const h = window.__VISUAL_CONTRACT__; h.runtime.setSpeaking(false);
    h.runtime.setPresentation({ ...h.presentation, face: "relieved", body: "calm_body", hand: false }); return h.runtime.stats();
  });
  expect(rest.state).toMatchObject({ face: "relieved", body: "calm_body", speaking: false });
  expect(rest.entryCount).toBe(before.entryCount); expect(rest.modelUUID).toBe(before.modelUUID); expect(loads).toBe(1);
  expect(rest.elapsed).toBeGreaterThanOrEqual(after.elapsed);
  for (const face of ["neutral", "anxious", "pain"] as const) {
    const state = await page.evaluate(face => { const h = window.__VISUAL_CONTRACT__; h.runtime.setPresentation({ ...h.presentation, face }); return h.runtime.stats(); }, face);
    expect(state.state.face).toBe(face); expect(state.modelUUID).toBe(before.modelUUID);
  }
  await page.evaluate(() => window.__VISUAL_CONTRACT__.runtime.dispose());
});
