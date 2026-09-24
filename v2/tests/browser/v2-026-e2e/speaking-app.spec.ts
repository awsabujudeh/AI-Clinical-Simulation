import {test,expect} from '@playwright/test';

test('actual App local playback shows Dana mouth/jaw START and END without provider or clinical mutation',async({page},info)=>{
 const errors:string[]=[],blocked:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():(blocked.push('EXTERNAL_REQUEST'),r.abort()));
 await page.route('**/__review/session',async r=>{
  const original=await r.fetch(),body=await original.json();expect(body.voice_profile).toBeUndefined();
  await r.fulfill({response:original,json:{...body,local_visual_playback_fixture:'DANA_VISUAL_ONLY'}});
 });
 await page.goto('/');await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({timeout:90000});
 await expect(page.getByRole('note')).toContainText('synthetic tone, no provider');
 const stats=()=>page.evaluate(async()=>{
  const path='/src/features/visual-patient/VisualPatient.tsx';const m=await import(/* @vite-ignore */path);
  return m.visualPatientDiagnostics(document.querySelector('.visual-patient-native canvas'));
 });
 const sid=new URL(page.url()).pathname.split('/').at(-1);
 const clinicalBefore=await (await page.request.get(`/v1/sessions/${sid}/state`)).json();
 const before=await stats();
 // A full suite shares the review host with the preceding treatment scenario.
 // Preserve the authoritative face/body, whether untreated or already improved.
 const expected=clinicalBefore.data.visual_patient;
 expect(expected.asset_id).toBe('dana.review-v01');
 expect(['anxious','relieved']).toContain(expected.face);
 expect(before.state).toMatchObject({face:expected.face,body:expected.body});
 const faceChannel=expected.face==='anxious'?'anxious':'calm';
 await page.getByRole('button',{name:'Enter physical examination'}).click();
 await page.getByRole('button',{name:'Face / lips',exact:true}).click();
 await page.waitForTimeout(1800);
 const canvas=page.locator('.visual-patient-native canvas');
 await canvas.screenshot({path:info.outputPath(`01-${expected.face}-before-speaking.png`)});
 await page.getByRole('button',{name:'Play patient audio',exact:true}).click();
 await expect.poll(async()=>(await stats()).state.speaking).toBe(true);
 await expect(page.locator('.visual-patient-native').getByRole('status')).toHaveText('Speaking');
 await expect.poll(async()=>(await stats()).exam.articulation,{intervals:[20]}).toBeGreaterThan(.48);
 await canvas.screenshot({path:info.outputPath('02-speaking-open.png')});
 await expect.poll(async()=>(await stats()).exam.articulation,{intervals:[20]}).toBeLessThan(.18);
 await canvas.screenshot({path:info.outputPath('03-speaking-narrow.png')});
 await expect.poll(async()=>(await stats()).exam.articulation,{intervals:[20]}).toBeGreaterThan(.45);
 await canvas.screenshot({path:info.outputPath('04-speaking-open-again.png')});
 expect((await stats()).exam.face[faceChannel]).toBeGreaterThan(.95);
 await expect.poll(async()=>(await stats()).exam.blink,{intervals:[20],timeout:8000}).toBeGreaterThan(.3);
 await expect.poll(async()=>(await stats()).state.speaking,{timeout:20000}).toBe(false);
 const after=await stats();expect(after.exam.articulation).toBe(0);
 expect(after.modelUUID).toBe(before.modelUUID);expect(after.modelLoads).toBe(1);
 expect(after.state.body).toBe(expected.body);expect(after.state.face).toBe(expected.face);
 expect(after.breathing).not.toBe(before.breathing);
 await canvas.screenshot({path:info.outputPath('05-after-audio-end.png')});
 expect((await (await page.request.get(`/v1/sessions/${sid}/state`)).json()).data).toEqual(clinicalBefore.data);
 expect(errors).toEqual([]);expect(blocked).toEqual([]);
});
