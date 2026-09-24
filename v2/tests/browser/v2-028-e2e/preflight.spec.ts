import { test, expect } from '@playwright/test';

test('actual operator app: both cases, truthful degradation, safe recheck and injected failure', async ({ page, request }) => {
  const remote: string[] = [], clinical: string[] = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { remote.push(url.hostname); await route.abort(); return; }
    if (url.pathname.startsWith('/v1/')) clinical.push(url.pathname);
    await route.continue();
  });
  await page.goto('http://127.0.0.1:4200/expo/preflight');
  await expect(page.getByRole('heading', { name: 'Expo Preflight', exact: true })).toBeVisible();
  await expect(page.locator('[data-check="clinical"]')).toContainText('LOCAL_ENGINE_FOUNDATION_READY');
  for (const id of ['stemi', 'dana', 'stemi_visual', 'dana_visual', 'shared_ed', 'assessment', 'knowledge', 'faculty'])
    await expect(page.locator(`[data-check="${id}"] > strong`)).toHaveText('READY');
  await expect(page.locator('[data-check="cache"]')).toContainText('NOT certified');
  await expect(page.getByText('0 trusted real documents', { exact: false })).toBeVisible();
  await expect(page.getByText('Physician review is pending', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/v2-028-owner-review/preflight-actual.png', fullPage: true });
  const initial = await page.getByLabel('Readiness summary').innerText();
  await page.getByRole('button', { name: 'Re-run Preflight' }).click();
  await expect(page.getByRole('button', { name: 'Re-run Preflight' })).toBeEnabled();
  expect(await page.getByLabel('Readiness summary').innerText()).not.toBe(initial);
  await page.goto('http://127.0.0.1:4201/expo/preflight');
  await expect(page.getByLabel('Readiness summary').getByRole('heading', { name: 'BLOCKED', exact: true })).toBeVisible();
  await expect(page.locator('[data-check="dana_visual"]')).toContainText('PRIMARY_AND_FALLBACK_UNAVAILABLE');
  await expect(page.locator('[data-check="clinical"] > strong')).toHaveText('READY');
  await expect(page.locator('[data-check="stemi_visual"] > strong')).toHaveText('READY');
  await page.screenshot({ path: 'test-results/v2-028-owner-review/preflight-injected-failure.png', fullPage: true });
  expect(remote).toEqual([]); expect(clinical).toEqual([]);
  const origin = 'http://127.0.0.1:4200';
  expect((await request.post(`${origin}/__operator/preflight`, { headers: { Origin: 'https://foreign.invalid', 'X-Preflight-Check': 'local' } })).status()).toBe(403);
  expect((await request.post(`${origin}/__operator/preflight`, { headers: { Origin: origin, 'X-Preflight-Check': 'local' }, data: { scenario: 'fake-ready' } })).status()).toBe(400);
  expect((await request.post(`${origin}/v1/voice/token`)).status()).toBe(404);
  expect((await request.get(`${origin}/__operator/preflight`)).status()).toBe(405);
});
