import {test,expect} from '@playwright/test';
for(const [patient,port] of [['khalid',4216],['dana',4217]] as const)test(`${patient} actual-app examinations, devices and static fallback`,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const origin=`http://127.0.0.1:${port}`,boot=await(await page.request.get(origin+'/__review/session')).json();
 await page.goto(`${origin}/sessions/${boot.session_id}`);
 await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({timeout:90000});
 const stats=()=>page.evaluate(async()=>{const path='/src/features/visual-patient/VisualPatient.tsx';const m=await import(/* @vite-ignore */path);return m.visualPatientDiagnostics(document.querySelector('.visual-patient-native canvas'));});
 const first=await stats();expect(first.equipment).toMatchObject({bp_cuff:false,iv_access:false,iv_tubing:false});
 const actions=page.getByRole('group',{name:'Clinical examination actions'}),findings=page.getByRole('list',{name:'Acquired examination findings'});
 await expect(actions.getByRole('button')).toHaveCount(9);await expect(findings.getByRole('listitem')).toHaveCount(0);
 async function perform(label:string){
  await actions.getByRole('button',{name:label,exact:true}).click();
  for(let i=0;i<3;i++){
   const response=page.waitForResponse(r=>r.url().endsWith('/actions/propose'));
   await page.getByRole('button',{name:'Perform selected examination',exact:true}).click();
   const r=await response;
   if(r.status()===200){await expect(page.getByText('Examination recorded',{exact:true})).toBeVisible();return;}
   expect(r.status()).toBe(409);await expect(page.getByRole('button',{name:'Perform selected examination',exact:true})).toBeEnabled();
  }
  throw Error('state conflict');
 }
 await perform('Chest auscultation');await expect(findings).toContainText(patient==='dana'?'bilateral wheeze':'Lungs are clear');
 const canvas=page.locator('.visual-patient-native canvas');await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(3000);
 const bounds=await canvas.boundingBox();await page.mouse.click(bounds!.x+bounds!.width*.50,bounds!.y+bounds!.height*(patient==='dana'?.33:.42));
 await expect.poll(async()=>(await stats()).stethoscopeContact).toBe(true);
 await expect(page.getByRole('button',{name:'Penlight',exact:true})).toHaveCount(0);
 await page.locator('.visual-patient-native').screenshot({path:info.outputPath(`${patient}-chest-exam.png`)});
 await page.screenshot({path:info.outputPath(`${patient}-finding.png`),fullPage:true});
 await perform('Abdominal examination');await perform('Skin inspection');await perform('Peripheral perfusion examination');
 const visual=page.locator('.visual-patient-native');
 await visual.getByRole('button',{name:'Cover / Reset',exact:true}).click();
 expect((await stats()).exam.region).toBe('DEFAULT_COVERED');
 await visual.getByRole('button',{name:'Exit examination',exact:true}).click();
 async function order(label:RegExp,tab:string){
  await page.getByRole('tab',{name:tab,exact:true}).click();await page.locator('.action-catalogue').getByRole('button',{name:label}).click();
  for(let i=0;i<3;i++){
   const response=page.waitForResponse(r=>r.url().endsWith('/actions/propose'));await page.locator('.action-form button[type=submit]').click();const r=await response;
   if(r.status()===200)return;expect(r.status()).toBe(409);await expect(page.locator('.action-form button[type=submit]')).toBeEnabled();
  }throw Error('state conflict');
 }
 await order(/^Measure blood pressure/,'Examination');await order(/^Pulse oximetry/,'Examination');
 await order(/^Establish peripheral IV access/,'Procedures');
 await expect.poll(async()=>(await stats()).equipment).toMatchObject({bp_cuff:true,iv_access:true,pulse_ox:true});
 await visual.getByRole('button',{name:'Enter physical examination',exact:true}).click();
 await visual.getByRole('button',{name:'Right arm',exact:true}).click();
 await expect(visual.getByRole('button',{name:'Stethoscope',exact:true})).toHaveCount(0);
 await page.waitForTimeout(3500);
 await visual.screenshot({path:info.outputPath(`${patient}-devices.png`)});
 // Manual orbit is an interaction, not a clinical examination or repeated autofocus.
 const rect=await canvas.boundingBox();await page.mouse.move(rect!.x+rect!.width*.55,rect!.y+rect!.height*.45);await page.mouse.down();await page.mouse.move(rect!.x+rect!.width*.63,rect!.y+rect!.height*.49,{steps:8});await page.mouse.up();await page.waitForTimeout(700);
 await canvas.screenshot({path:info.outputPath(`${patient}-manual-camera.png`)});
 expect((await stats()).modelUUID).toBe(first.modelUUID);expect((await stats()).modelLoads).toBe(1);
 // Reload with only the 3D asset blocked. Server evidence and examination remain usable.
 await page.route('**/*.glb',r=>r.abort());await page.reload();
 await expect(page.getByText('Static fallback — 3D view unavailable',{exact:true})).toBeVisible({timeout:60000});
 const count=await findings.getByRole('listitem').count();await perform('Mental status / neurological assessment');
 await expect(findings.getByRole('listitem')).toHaveCount(count+1);
 await page.screenshot({path:info.outputPath(`${patient}-fallback-exam.png`),fullPage:true});
 expect(errors).toEqual([]);
});
