import { expect, test } from "@playwright/test";
for (
  const [patient, port, drug] of [[
    "Khalid",
    4216,
    "Adrenaline (epinephrine) 0.5 mg",
  ], ["Dana", 4217, "Aspirin 324 mg"]] as const
) {
  test(
    `${patient} shared catalogue, distractor receipt, acquired BP and existing patient`,
    async ({ page }, info) => {
      await page.route(
        "**/*",
        (r) =>
          new URL(r.request().url()).hostname === "127.0.0.1"
            ? r.continue()
            : r.abort(),
      );
      const origin = `http://127.0.0.1:${port}`;
      const boot = await (await page.request.get(`${origin}/__review/session`))
        .json();
      await page.goto(`${origin}/sessions/${boot.session_id}`);
      const initialState = await (await page.request.get(`${origin}/v1/sessions/${boot.session_id}/state`)).json();
      expect(initialState.data.pinned_case.case_version).toBe(patient === "Dana" ? "1.5.0" : "2.4.0");
      expect(initialState.data.pinned_case.execution_authority).toBe("APPROVED_EXPO");
      await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({
        timeout: 90000,
      });
      await expect(page.locator('[data-observation="BP"] strong')).toHaveText(
        "—",
      );
      await page.getByRole("tab", { name: "Medications", exact: true }).click();
      await expect(page.locator(".action-catalogue button")).toHaveCount(7);
      await page.locator(".action-catalogue").getByRole("button", {
        name: new RegExp(drug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      }).click();
      const r = page.waitForResponse((r) =>
        r.url().endsWith("/actions/propose")
      );
      await page.locator(".action-form button[type=submit]").click();
      expect((await r).status()).toBe(200);
      await page.screenshot({
        path: info.outputPath(`${patient}-shared-medications.png`),
        fullPage: true,
      });
      await page.getByRole("tab", { name: "Examination", exact: true }).click();
      await page.locator(".action-catalogue").getByRole("button", {
        name: "Measure blood pressure EXAMINATION",
        exact: true,
      }).click();
      const bp = page.waitForResponse((r) =>
        r.url().endsWith("/actions/propose")
      );
      await page.locator(".action-form button[type=submit]").click();
      expect((await bp).status()).toBe(200);
      await expect(page.locator('[data-observation="BP"] strong')).not
        .toHaveText("—");
      await expect(page.locator('[data-observation="TEMPERATURE"] strong'))
        .toHaveText("—");
      await page.reload();
      await expect(page.locator('[data-observation="BP"] strong')).not
        .toHaveText("—");
      await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({
        timeout: 90000,
      });
      await page.screenshot({
        path: info.outputPath(`${patient}-wp2-observation.png`),
        fullPage: true,
      });
      await page.getByRole("tab",{name:"Investigations",exact:true}).click();
      await expect(page.locator(".action-catalogue button")).toHaveCount(14);
      for(const name of ["CBC", "Coagulation profile"]) {
        await page.locator(".action-catalogue").getByRole("button",{name:new RegExp(name)}).click();
        await expect(page.locator(".action-form")).toContainText(name);
        const order=page.waitForResponse(r=>r.url().endsWith("/actions/propose"));
        await page.locator(".action-form button[type=submit]").click();
        const result=await order;expect(result.status(),await result.text()).toBe(200);
        await expect(page.locator(".action-form button[type=submit]")).toBeEnabled();
      }
      const stateUrl=`${origin}/v1/sessions/${boot.session_id}/state`;
      const state=async()=>(await (await page.request.get(stateUrl)).json()).data;
      const invoke=async(id:string,n:number)=>{
        // The real browser keeps polling the real trusted clock. A confirmed
        // version rejection committed nothing; explicitly reload before one new
        // test submission. Never retry a timeout/unknown/committed outcome.
        for(let attempt=0;attempt<3;attempt++) {
          const key=`${n}.${attempt}`,s=await state();
          const r=await page.request.post(`${origin}/v1/sessions/${boot.session_id}/actions/propose`,{headers:{"idempotency-key":`idempotency.complete-app.${key}`},data:{action_id:id,parameters:{},source:"UI",action_request_id:`action-request.complete-app.${key}`,command_id:`command.complete-app.${key}`,expected_state_version:s.state_version}});
          const b=await r.json();
          if(r.status()===409 && b.error?.code==="SESSION_VERSION_CONFLICT" && attempt<2)continue;
          expect(r.status(),JSON.stringify(b)).toBe(200);return;
        }
      };
      // Existing trusted compressed acquisition cost advances Clinical Time; no clock forgery.
      await invoke(patient==="Dana"?"concept.expo.epinephrine":"concept.expo.cath",100);
      for(let n=0;n<16;n++)await invoke("concept.expo.bp",101+n);
      await page.reload();
      const resultId=patient==="Dana"?"diagnostic-result.complete.dana.cbc":"diagnostic-result.stemi.cbc";
      await expect(page.getByTestId(resultId)).toContainText("Result available");
      await expect(page.getByTestId(resultId)).toContainText("White blood cell count");
      await expect(page.getByTestId(resultId)).toContainText(patient==="Dana"?"8.5":"9.1");
      await expect(page.getByTestId(resultId)).toContainText("Reference");
      await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({ timeout: 90000 });
      await page.screenshot({path:info.outputPath(`${patient}-complete-labs.png`),fullPage:true});
      await page.getByRole("tab",{name:"Investigations",exact:true}).click();
      await expect(page.locator(".action-catalogue button")).toHaveCount(14);
      await page.locator(".action-search input").fill(patient==="Dana"?"tryptase":"right-sided");
      await expect(page.locator(".action-catalogue button")).toHaveCount(1);
      await page.screenshot({path:info.outputPath(`${patient}-special-search.png`),fullPage:true});
      await page.getByRole("button",{name:"End simulation",exact:true}).click();
      // Synchronize with the visible app's authoritative refresh, not a forged
      // state version. Confirmation and existing stale-state guard stay intact.
      await page.waitForResponse(r=>r.url().endsWith("/state")&&r.status()===200);
      const end=page.waitForResponse(r=>r.url().endsWith("/end"));
      await page.getByRole("alertdialog").getByRole("button",{name:"End simulation",exact:true}).click();
      const ended=await end;expect(ended.status(),await ended.text()).toBe(200);
      await page.getByRole("button",{name:"Generate Tutor debrief",exact:true}).click();
      await expect(page.getByTestId("tutor-debrief")).toBeVisible();
      await expect(page.getByTestId("tutor-debrief")).toContainText("Curriculum mapping pending source approval");
      await expect(page.locator("body")).not.toContainText("REVIEW ASSESSMENT SNAPSHOT");
      await expect(page.locator("body")).not.toContainText("Physician review pending");
      await page.screenshot({path:info.outputPath(`${patient}-approved-expo-final-assessment.png`),fullPage:true});
    },
  );
}
