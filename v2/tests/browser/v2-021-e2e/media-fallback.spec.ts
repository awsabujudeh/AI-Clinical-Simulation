import { test, expect } from "@playwright/test";

test("@v2-022 actual app: 3D primary, local failure fallback, neutral double failure; no clinical writes", async ({ page }, info) => {
  let writes = 0;
  page.on("request", request => { if (request.method() !== "GET") writes++; });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.protocol === "http:" && url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  const state = async () => {
    const session = new URL(page.url()).pathname.split("/").pop();
    return (await (await page.request.get(`/v1/sessions/${session}/state`)).json()).data;
  };
  await page.goto("/");
  await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({ timeout: 90000 });
  const before = await state();
  await page.screenshot({ path: info.outputPath("normal.png"), fullPage: true });
  await page.route("**/*.glb", route => route.abort());
  await page.reload();
  const fallback = page.getByRole("img", { name: "Static patient illustration, not a live examination", exact: true });
  await expect(fallback).toBeVisible();
  await expect.poll(() => fallback.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".monitor-slot")).toBeVisible();
  await page.getByRole("tab", { name: "Investigations", exact: true }).click();
  await expect(page.locator(".action-catalogue button").first()).toBeEnabled();
  expect(await state()).toEqual(before);
  await page.screenshot({ path: info.outputPath("fallback.png"), fullPage: true });
  await page.route("**/media/stemi/**/*.png", route => route.abort());
  await page.reload();
  await expect(page.getByText("Patient view unavailable", { exact: true })).toBeVisible();
  await expect(fallback).toHaveCount(0);
  await expect(page.locator(".monitor-slot")).toBeVisible();
  expect(await state()).toEqual(before);
  expect(writes).toBe(0);
});
