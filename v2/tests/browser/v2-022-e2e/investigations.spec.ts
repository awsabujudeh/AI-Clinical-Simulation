import { test, expect } from "@playwright/test";

test("actual STEMI app: authoritative pending/result/report timing with local review media", async ({ page }, info) => {
  await page.route("**/*", route => {
    const u = new URL(route.request().url());
    return u.protocol === "http:" && u.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.goto("/");
  await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({timeout:90000});
  await page.screenshot({path:info.outputPath("normal.png")});
  await page.getByRole("tab",{name:"Investigations",exact:true}).click();
  for (const label of ["order standard 12-lead ECG", "order right-sided ECG", "order chest radiograph", "order focused echocardiography"]) {
    await page.locator(".action-catalogue").getByRole("button",{name:label,exact:false}).click();
    const submitted=page.waitForResponse(r=>r.url().endsWith("/actions/propose") && r.request().method()==="POST");
    await page.locator(".action-form button[type=submit]").click();
    expect((await submitted).status()).toBe(200);
    await expect(page.locator(".action-form button[type=submit]")).toBeEnabled();
  }
  const ecg=page.getByTestId("diagnostic-result.stemi.ecg-standard");
  const right=page.getByTestId("diagnostic-result.stemi.ecg-right-sided");
  const cxr=page.getByTestId("diagnostic-result.stemi.chest-xray");
  await expect(ecg).toContainText("Ordered — pending");
  await expect(page.locator(".investigation-slot img")).toHaveCount(0);
  await page.locator(".investigation-slot").screenshot({path:info.outputPath("pending.png")});
  const advance=async(target:number)=>{const r=await page.request.post("/__review/next-milestone");expect(r.status()).toBe(200);expect(await r.json()).toMatchObject({success:true,target,reached:target});};
  await advance(119);
  await expect(ecg).toContainText("Ordered — pending");
  await advance(120);
  await expect(ecg.locator("img")).toBeVisible();
  await expect(ecg).toContainText("Sinus rhythm at approximately 84 bpm");
  await expect(ecg).toContainText("112");
  await expect.poll(()=>ecg.locator("img").evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);
  await ecg.screenshot({path:info.outputPath("ecg.png")});
  await expect(right).toContainText("MEDIA_ASSET_PENDING");
  await expect(right).toContainText("V4R");
  await expect(right.locator("img")).toHaveCount(0);
  await right.screenshot({path:info.outputPath("right-sided-ecg.png")});
  await advance(299); await expect(cxr.locator("img")).toHaveCount(0);
  await advance(300);
  await expect(cxr.locator("img")).toBeVisible();
  await expect(cxr).toContainText("Report pending or withheld");
  await expect(cxr).not.toContainText("Paired library reference report");
  await advance(479); await expect(cxr).toContainText("Report pending or withheld");
  await advance(480);
  await expect(cxr).toContainText("No acute cardiopulmonary abnormality.");
  await expect.poll(()=>cxr.locator("img").evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);
  await cxr.screenshot({path:info.outputPath("cxr.png")});
});
