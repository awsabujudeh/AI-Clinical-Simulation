import {test,expect} from '@playwright/test';
for(const patient of ['Khalid','Dana'])for(const mode of ['PRACTICE_DEMO','ASSESSMENT'])test(`${patient} ${mode} complete functional journey`,async({page},info)=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4218/app');
 await expect(page.getByRole('heading',{name:'Select a patient'})).toBeVisible();
 await expect(page.locator('main')).not.toContainText(/STEMI|anaphylaxis/i);
 await page.getByRole('button',{name:new RegExp('^'+patient+' —')}).click();await page.getByLabel('Session mode').selectOption(mode);
 await page.getByRole('button',{name:'Review briefing',exact:true}).click();await expect(page.getByRole('heading',{name:'Encounter briefing'})).toBeVisible();
 await page.screenshot({path:info.outputPath('briefing.png')});
 const begin=page.waitForResponse(r=>r.url().endsWith('/__expo/begin'));await page.getByRole('button',{name:'Begin Encounter',exact:true}).click();
 const started=await(await begin).json();expect(started.data.session.clinical_time).toBe(0);expect(started.data.session.mode).toBe(mode);
 await expect(page.locator('[data-visual-status="READY"]')).toBeVisible({timeout:90000});
 await page.getByRole('tab',{name:'Investigations',exact:true}).click();
 const quick=page.getByRole('region',{name:'Quick clinical order'}).or(page.locator('section[aria-label="Quick clinical order"]'));
 await quick.getByLabel('Order text').fill('ECG and troponin');await quick.getByRole('button',{name:'Interpret orders',exact:true}).click();
 await expect(quick.getByRole('listitem')).toHaveCount(2);await quick.getByRole('button',{name:'Confirm and execute resolved orders only',exact:true}).click();await expect(quick.getByRole('status')).toHaveText('Confirmed actions recorded.');
 await quick.getByLabel('Order text').fill(patient==='Dana'?'adrenaline and IV access and oxygen and crystalloid 500':'aspirin and IV access');await quick.getByRole('button',{name:'Interpret orders',exact:true}).click();await quick.getByRole('button',{name:'Confirm and execute resolved orders only',exact:true}).click();await expect(quick.getByRole('status')).toHaveText('Confirmed actions recorded.');
 // Manual acquisition uses the same committed command path.
 async function manual(tab:string,label:RegExp){await page.getByRole('tab',{name:tab,exact:true}).click();await page.locator('.action-catalogue').getByRole('button',{name:label}).click();
  const response=page.waitForResponse(r=>r.url().endsWith('/actions/propose'));
  await page.locator('.action-form button[type=submit]').click();
  if(tab==='Diagnosis / Disposition'){const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByRole('button').first().click();}
  expect((await response).status()).toBe(200);
  await expect(page.locator('.action-status')).toContainText(/committed|recorded/i);
 }
 await manual('Examination',/^Measure blood pressure/);
 if(mode==='ASSESSMENT')await expect(page.locator('.assessment-slot')).not.toContainText(/Evidence-backed strength|Safety finding|Improvement opportunity/);
 else await expect(page.locator('.assessment-slot')).toContainText('Evidence-backed strength');
 await manual('Diagnosis / Disposition',patient==='Dana'?/^Food-triggered anaphylaxis/:/^Acute inferior STEMI/);
 await manual('Diagnosis / Disposition',patient==='Dana'?/^Monitored observation/:/^Transfer to catheterization laboratory/);
 await page.screenshot({path:info.outputPath('active.png'),fullPage:true});
 await page.locator('.assessment-slot').getByRole('button',{name:/End/}).click();await page.getByRole('alertdialog').getByRole('button',{name:/End/}).click();
 await expect(page).toHaveURL(/\/debrief$/);await expect(page.locator('.final-assessment')).toBeVisible();await expect(page.locator('.domain-score-grid article')).toHaveCount(6);
 await expect(page.locator('.visual-patient-native')).toHaveCount(0);await expect(page.locator('.action-form')).toHaveCount(0);
 await expect(page.locator('.learner-timeline')).toContainText(patient==='Dana'?'Food-triggered anaphylaxis':'Acute inferior STEMI');
 await expect(page.locator('.learner-timeline')).toContainText(patient==='Dana'?'Monitored observation':'Transfer to catheterization laboratory');
 await page.screenshot({path:info.outputPath('debrief.png'),fullPage:true});
 await page.reload();await expect(page.locator('.final-assessment')).toBeVisible();expect(errors).toEqual([]);
});
