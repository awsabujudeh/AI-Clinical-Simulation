import { test, expect } from "@playwright/test";

test("Dana uses actual Student App, one shared runtime instance and review-only actions",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"&&/THREE.WebGLProgram|Shader Error/.test(m.text()))errors.push("SHADER_COMPILATION_FAILURE");});
  await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
  await page.goto("/");
  await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({timeout:90000});
  const stats=()=>page.evaluate(async()=>{
    const path="/src/features/visual-patient/VisualPatient.tsx";
    const m=await import(/* @vite-ignore */ path);
    return m.visualPatientDiagnostics(document.querySelector('.visual-patient-native canvas'));
  });
  const initial=await stats();expect(initial.modelLoads).toBe(1);expect(initial.state.body).toBe("itch_body");
  expect(initial.equipment).toEqual({bp_cuff:false,iv_access:false,iv_tubing:false});
  const visual=page.locator('.visual-patient-native');
  const capture=async(name:string)=>{await visual.scrollIntoViewIfNeeded();await visual.screenshot({path:info.outputPath(name+'.png')});};
  const canvas=page.locator('.visual-patient-native canvas');
  const frame=async(name:string)=>{await canvas.screenshot({path:info.outputPath(name+'.png')});};
  const breathingEvidence=async(label:string,amplitude:number)=>{
    // Observe actual renderer phases; never set animation/clinical time.
    // Retain both frames plus the continuous video for human motion review.
    const excursion=amplitude===.016?1:.38;
    await expect.poll(async()=> (await stats()).exam.thoracic,{intervals:[20],timeout:6000}).toBeGreaterThan(excursion*.96);
    await capture(`${label}-inhale`);
    await expect.poll(async()=> (await stats()).exam.thoracic,{intervals:[20],timeout:6000}).toBeLessThan(excursion*.04);
    await capture(`${label}-exhale`);
    // Two complete treated breaths / nearly three untreated breaths in video.
    // Real animation time only; no state, phase or clinical-clock override.
    await page.waitForTimeout(6200);
  };
  await page.screenshot({path:info.outputPath("dana-actual-app.png")});
  await capture('01-normal-untreated-no-devices');
  await capture('16-white-bed-pillow');
  await expect.poll(async()=> (await stats()).breathing).not.toBe(initial.breathing);
  await expect.poll(async()=> (await stats()).exam.blink,{intervals:[30],timeout:15000}).toBeGreaterThan(.3);
  await expect.poll(async()=>{const s=await stats();return s.exam.scratchRegion==='FOREARM'&&s.exam.scratchContact===1;},{intervals:[60],timeout:45000}).toBe(true);
  await page.screenshot({path:info.outputPath('dana-scratching.png')});
  await capture('04-forearm-contact-stroke');
  await expect.poll(async()=>{const s=await stats();return s.exam.scratchRegion==='NECK'&&s.exam.scratchContact===1&&Math.abs(s.exam.neckForearmRoll)>.1;},{intervals:[60],timeout:45000}).toBe(true);
  await page.screenshot({path:info.outputPath('dana-neck-scratching.png')});
  await capture('05-neck-contact-stroke');
  await frame('20-neck-wrist-contact-a');
  await page.waitForTimeout(220);await frame('21-neck-wrist-contact-b');
  await page.waitForTimeout(220);await frame('22-neck-wrist-contact-c');
  // Actual pointer orbit, not a hidden state/camera override. Check a second
  // angle of the held neck contact and preserve manual control afterwards.
  const bounds=await page.locator('.visual-patient-native canvas').boundingBox();
  if(!bounds)throw Error('Visual canvas missing');
  await page.mouse.move(bounds.x+bounds.width*.55,bounds.y+bounds.height*.5);
  await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.55+60,bounds.y+bounds.height*.5,{steps:12});await page.mouse.up();
  await capture('05b-neck-contact-alternate-angle');
  await page.getByRole("button",{name:"Enter physical examination"}).click();
  await page.getByRole("button",{name:"Chest",exact:true}).click();
  await expect.poll(async()=> (await stats()).exam.visibleGarments).toEqual(["Dana_Clinical_Bra"]);
  await expect.poll(async()=> (await stats()).positionMix).toBe(1);
  await page.waitForTimeout(1200); // camera easing, never medical time
  await page.screenshot({path:info.outputPath("dana-exam-top.png")});
  await capture('06-chest-body-complete');
  await page.getByRole('button',{name:'Stethoscope',exact:true}).click();
  await capture('08-abdomen-and-clinical-coverage');
  // User zoom after autofocus must remain under manual control.
  await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.4);await page.mouse.wheel(0,-170);
  await page.waitForTimeout(350);await capture('07-chest-neck-shoulder-close');
  await capture('17-abdomen-navel');
  await breathingEvidence('18-untreated-breathing',.016);
  for(const region of ['Left arm','Face / lips','Neck']){
    await page.getByRole('button',{name:region,exact:true}).click();await page.waitForTimeout(1200);
    await page.screenshot({path:info.outputPath(`dana-exam-${region.split(' ')[0]}.png`)});
    if(region==='Face / lips'){
      await capture('02-untreated-face-lip-swelling');await frame('23-untreated-face-lips');
      expect((await stats()).exam.swelling).toBe(1);
      expect((await stats()).exam.face.anxious).toBeGreaterThan(.95);
    }
  }
  await page.getByRole("button",{name:"Cover / Reset"}).click();
  await expect.poll(async()=> (await stats()).exam.visibleGarments).toEqual(["Dana_Ch22_Shirt"]);
  await capture('14-cover-reset');
  await page.getByRole("button",{name:"Exit examination"}).click();
  await page.waitForTimeout(1500);await capture('15-shared-ed-room');
  expect((await stats()).modelUUID).toBe(initial.modelUUID);
  await page.getByRole('tab',{name:'Investigations',exact:true}).click();
  await page.locator('.action-catalogue').getByRole('button',{name:/order ECG/}).click();
  const ordered=page.waitForResponse(r=>r.url().endsWith('/actions/propose')&&r.request().method()==='POST');
  await page.locator('.action-form button[type=submit]').click();expect((await ordered).status()).toBe(200);
  const ecg=page.getByTestId('diagnostic-result.dana.ecg');await expect(ecg).toContainText('Ordered — pending');
  // Existing actions panel and real Session/Clinical path, never direct state writes.
  for(const [tab,label] of [["Medications","administer epinephrine 0.5 mg"],["Procedures","administer supplemental oxygen"],["Procedures","establish IV access"],["Procedures","give crystalloid 500 mL"]]){
    await page.getByRole("tab",{name:tab,exact:true}).click();
    await page.locator('.action-catalogue').getByRole('button',{name:new RegExp(label!)}).click();
    const response=page.waitForResponse(r=>r.url().endsWith('/actions/propose')&&r.request().method()==='POST');
    await page.locator('.action-form button[type=submit]').click();expect((await response).status()).toBe(200);
    await expect(page.locator('.action-form button[type=submit]')).toBeEnabled();
  }
  expect((await stats()).equipment).toEqual({bp_cuff:false,iv_access:true,iv_tubing:true});
  expect((await page.request.post('/__review/advance')).status()).toBe(200);
  // The existing review transport refreshes authoritative state on commands;
  // do not fake a client-side clock or mutate the visual presentation in tests.
  await page.getByRole('tab',{name:'Procedures',exact:true}).click();
  await page.locator('.action-catalogue').getByRole('button',{name:/apply ECG, SpO2 and BP monitoring/}).click();
  const refreshed=page.waitForResponse(r=>r.url().endsWith('/actions/propose')&&r.request().method()==='POST');
  // Trusted advancement changed the version; the first stale command is rejected
  // and the existing UI resynchronizes. It must not silently overwrite state.
  await page.locator('.action-form button[type=submit]').click();expect((await refreshed).status()).toBe(409);
  await expect.poll(async()=> (await stats()).state.body).toBe('calm_body');
  await expect.poll(async()=> (await stats()).exam.face.calm).toBeGreaterThan(.95);
  await expect.poll(async()=> (await stats()).exam.rash).toBeLessThan(.1);
  await expect(page.locator('.action-form button[type=submit]')).toBeEnabled();
  const monitored=page.waitForResponse(r=>r.url().endsWith('/actions/propose')&&r.request().method()==='POST');
  await page.locator('.action-form button[type=submit]').click();expect((await monitored).status()).toBe(200);
  await expect.poll(async()=> (await stats()).equipment).toEqual({bp_cuff:true,iv_access:true,iv_tubing:true});
  expect((await stats()).exam.scratch).toBe(0);
  expect((await stats()).exam.swelling).toBe(.05);
  expect((await stats()).modelUUID).toBe(initial.modelUUID);
  await expect(ecg).toContainText('Sinus tachycardia');
  await expect(ecg.locator('img')).toHaveCount(0);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:info.outputPath('dana-improved.png')});
  await capture('11-improved-with-committed-devices');
  await page.getByRole('button',{name:'Enter physical examination'}).click();
  await page.getByRole('button',{name:'Face / lips',exact:true}).click();await page.waitForTimeout(1600);await capture('12-treated-face-swelling-reduced');
  await frame('24-treated-face-lips');
  await page.getByRole('button',{name:'Chest',exact:true}).click();await page.waitForTimeout(1600);await capture('13-rash-improvement');
  await breathingEvidence('19-treated-breathing',.010);
  expect((await stats()).modelLoads).toBe(1);
  expect((await stats()).modelUUID).toBe(initial.modelUUID);
  expect(errors).toEqual([]);
});

test('forced Dana GLB failure uses the packaged Dana reference still and retains clinical controls',async({page},info)=>{
 await page.route('**/dana-review.glb',r=>r.abort());await page.goto('/');
 await expect(page.getByText('Static fallback — 3D view unavailable')).toBeVisible();
 const image=page.locator('.visual-patient-native__fallback img');
 await expect(image).toHaveAttribute('src','/visual-patient/dana/review-v01/dana-static-anxious.png');
 expect(await image.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
 await expect(page.getByRole('tab',{name:'Medications',exact:true})).toBeEnabled();
 await expect(page.getByText('Initial-presentation reference still;', {exact:false})).toBeVisible();
 await page.screenshot({path:info.outputPath('dana-static-fallback-app.png')});
});
