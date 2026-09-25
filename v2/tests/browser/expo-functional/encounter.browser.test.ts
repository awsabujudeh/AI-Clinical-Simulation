import {describe,it,expect} from 'vitest';
import {createExpoEntry} from '../../../runtime/expo-entry.ts';
import {wp1Fixture} from '../../fixtures/wp1.ts';
import {apiHeaders,createApiTestHarness,startBody} from '../../fixtures/api/secure-api.ts';
import {prepareApprovedExpoCase} from '../../../content/cases/shared-catalogue/approved-expo-cases.ts';
import {PORTABLE_SHA256_ADAPTER} from '../../fixtures/portable-sha256.ts';
import {splitClinicalOrder} from '../../../packages/clinical-interpreter/src/compound.ts';
let serial=0;
async function fixture(patient:'patient-01'|'patient-02',mode:'PRACTICE_DEMO'|'ASSESSMENT'){
 let seconds=0,n=0;const entry=await createExpoEntry(`test-${++serial}`,()=>new Date(Date.UTC(2026,8,25,0,0,seconds)).toISOString());
 const start=await entry.begin({entry_id:patient,mode},'start'),data=start.body as any;expect(start.status).toBe(201);const id=data.data.session.session_id;
 async function request(path:string,body?:unknown,key?:string){const r=await entry.request(`/v1/sessions/${id}${path}`,body?'POST':'GET',body?JSON.stringify(body):undefined,key??`idempotency.test.${++n}`);return {status:r.status,body:await r.json()};}
 return {entry,id,request,start:data.data.session,elapsed(s:number){seconds=s;}};
}
for(const patient of ['patient-01','patient-02'] as const)for(const mode of ['PRACTICE_DEMO','ASSESSMENT'] as const)describe(`${patient} ${mode}`,()=>{
 it('starts at zero only after Begin, owns mode, executes a confirmed compound once and ends with six-domain assessment',async()=>{
  const f=await fixture(patient,mode);expect(f.start.clinical_time).toBe(0);expect(f.start.mode).toBe(mode);expect(f.start.encounter_decisions).toHaveLength(8);
  expect(JSON.stringify(f.entry.cards)).not.toMatch(/STEMI|anaphylaxis|diagnos|rubric|score|case-version/i);
  expect(JSON.stringify((await f.request('/assessment')).body)).not.toMatch(/overall_score_basis_points|domain_scores|FINAL_DEBRIEF/);
  expect((await f.request('/mode',{mode:mode==='ASSESSMENT'?'PRACTICE_DEMO':'ASSESSMENT'})).status).not.toBe(200);
  const plan=(await f.request('/quick-orders',{utterance_id:'order.1',locale:'en-US',text:'Measure BP, get IV access and give oxygen'})).body.data;
  expect(plan.fragments).toHaveLength(3);expect(plan.fragments.every((x:any)=>x.interpretation.status==='MATCH')).toBe(true);
  expect((await f.request('/timeline')).body.data.items.filter((x:any)=>x.item_type==='ACTION_COMMITTED')).toHaveLength(0);
  const body={plan_id:plan.plan_id,selected_indexes:[0,1,2],confirmed:true};const [a,b]=await Promise.all([f.request('/quick-orders/confirm',body),f.request('/quick-orders/confirm',body)]);
  expect(a.status).toBe(200);expect(b.body).toEqual(a.body);expect(a.body.data.outcomes).toHaveLength(3);
  const state=(await f.request('/state')).body.data;expect(state.clinical_time).toBeGreaterThan(0);expect(state.visual_patient.equipment.bp_cuff).toBe(true);
  if(mode==='ASSESSMENT')expect(state.assessment_disclosure).toMatchObject({projection_type:'ACTIVE_ASSESSMENT_WITHHELD'});
  else expect(state.assessment_disclosure.projection_type).toBe('ACTIVE_PRACTICE_FEEDBACK');
  expect(JSON.stringify(state.assessment_disclosure)).not.toMatch(/score_basis_points|rubric_weight/);
  const end=await f.request('/end',{expected_state_version:state.state_version,reason:'LEARNER_COMPLETED'});expect(end.status).toBe(200);expect(end.body.data.assessment.domain_scores).toHaveLength(6);
  const timeline=(await f.request('/timeline')).body.data.items;expect(timeline.filter((x:any)=>x.item_type==='ACTION_COMMITTED')).toHaveLength(3);
  expect((await f.request('/actions/propose',{command_id:'command.after',action_request_id:'action-request.after',action_id:'concept.expo.bp',parameters:{},expected_state_version:end.body.data.session.state_version,source:'UI'})).status).not.toBe(200);
  expect((await f.request('/quick-orders',{utterance_id:'order.after',locale:'en-US',text:'ECG'})).status).not.toBe(200);
  f.elapsed(2000);expect((await f.request('/state')).body.data.clinical_time).toBe(end.body.data.session.clinical_time);
 });
});
it('Arabic compounds, fluid clarification, partial orders and explicit prerequisite dependency ordering',async()=>{
 const f=await fixture('patient-02','ASSESSMENT');
 const plan=async(text:string,id:string)=>(await f.request('/quick-orders',{text,locale:'ar-JO',utterance_id:id})).body.data;
 const ar=await plan('حط IV، قيس الضغط، واعمل ECG','arabic');expect(ar.fragments.map((x:any)=>x.interpretation.status)).toEqual(['MATCH','MATCH','MATCH']);
 const fluid=await plan('give fluids','fluid');expect(fluid.fragments[0].interpretation.status).toBe('AMBIGUOUS');
 const partial=await plan('ECG and unknown thing','partial');expect(partial.fragments[1].interpretation.status).toBe('NO_MATCH');
 const r=await f.request('/quick-orders/confirm',{plan_id:partial.plan_id,selected_indexes:[0],confirmed:true});expect(r.body.data.outcomes).toEqual([{index:0,status:'COMMITTED'}]);
 const dependent=await plan('crystalloid 500 and IV access','dependent');
 const order=await f.request('/quick-orders/confirm',{plan_id:dependent.plan_id,selected_indexes:[0,1],confirmed:true});expect(order.body.data.outcomes).toEqual([{index:1,status:'COMMITTED'},{index:0,status:'COMMITTED'}]);
});
it('does not insert missing access, stops following actions, rejects invented plans/parameters and preserves failure replay',async()=>{
 const f=await fixture('patient-01','ASSESSMENT');const plan=(await f.request('/quick-orders',{text:'UFH and ECG',locale:'en-US',utterance_id:'order.fail'})).body.data;
 const confirm={plan_id:plan.plan_id,selected_indexes:[0,1],confirmed:true};const first=await f.request('/quick-orders/confirm',confirm);expect(first.body.data).toMatchObject({stopped:true,outcomes:[{index:0,status:'NOT_COMPLETED'}]});
 expect((await f.request('/quick-orders/confirm',confirm)).body).toEqual(first.body);
 expect((await f.request('/quick-orders/confirm',{...confirm,selected_indexes:[1]})).status).toBe(409);
 expect((await f.request('/quick-orders/confirm',{...confirm,plan_id:'forged'})).status).toBe(404);
 expect((await f.request('/quick-orders/confirm',{...confirm,parameters:{effect:'improve'}})).status).toBe(400);
 expect((await f.request('/quick-orders/confirm',{...confirm,confirmed:false})).status).toBe(400);
});
it('shares decision choices and preserves legacy authored diagnosis/disposition scoring and neutral evidence',async()=>{
 for(const patient of ['khalid','dana'] as const){const f=await wp1Fixture(patient,'wp2-approved');const s=await f.state();expect(s.encounter_decisions).toHaveLength(8);
  for(const id of [patient==='dana'?'anaphylaxis':'inferior-stemi','undetermined',patient==='dana'?'observation':'cath']){const r=await f.action('decision.expo.'+id);expect(r.response.status,JSON.stringify({patient,id,body:r.body})).toBe(200);}
  const now=await f.state();const end=await f.response('/end',{expected_state_version:now.state_version,reason:'LEARNER_COMPLETED'});expect(end.status).toBe(200);
 }
});
it('preserves cross-session ownership and rejects another Session plan',async()=>{
 const f=await wp1Fixture('dana','wp2-approved');
 const r=await f.h.app.request(f.path+'/quick-orders',{method:'POST',headers:apiHeaders({token:'other-learner'}),body:JSON.stringify({text:'ECG',locale:'en-US',utterance_id:'x'})});expect(r.status).toBe(404);
 const p=await f.response('/quick-orders',{text:'ECG',locale:'en-US',utterance_id:'x'});expect(p.status).toBe(200);
 const foreign=await f.h.app.request(f.path+'/quick-orders/confirm',{method:'POST',headers:apiHeaders({token:'other-learner'}),body:JSON.stringify({plan_id:(await p.json()).data.plan_id,selected_indexes:[0],confirmed:true})});expect(foreign.status).toBe(404);
});
it('does not split negation/conditional scope or lose unsupported fragments',()=>{
 expect(splitClinicalOrder('do not give aspirin and oxygen')).toEqual(['do not give aspirin and oxygen']);
 expect(splitClinicalOrder('if worse, give oxygen')).toHaveLength(1);
 expect(splitClinicalOrder('اعمل تخطيط وتروبونين')).toEqual(['اعمل تخطيط','تروبونين']);
});
it('uses existing gateway/reconciliation for unresolved language, with bounded cached requests and wrong-dose rejection',async()=>{
 const artifact=await prepareApprovedExpoCase('dana',PORTABLE_SHA256_ADAPTER);
 const h=await createApiTestHarness({review_artifact:artifact,hash_adapter:PORTABLE_SHA256_ADAPTER,enable_clinical_interpreter:true});
 const start=await h.app.request('/v1/review-sessions',{method:'POST',headers:apiHeaders({token:'faculty',idempotency:'idempotency.quick.provider'}),body:JSON.stringify(startBody(artifact.source_case.manifest.case_id,{mode:'ASSESSMENT'}))});const id=(await start.json()).data.session.session_id;
 const request=(text:string,key:string)=>h.app.request(`/v1/sessions/${id}/quick-orders`,{method:'POST',headers:apiHeaders({token:'faculty'}),body:JSON.stringify({text,locale:'en-US',utterance_id:key})});
 const output=(id:string)=>({output_schema_version:'2.0',status:'MATCH',ambiguity_reason:null,no_match_reason:null,candidates:[{action_id:id,parameters:[]}]});
 h.setInterpreterOutput(output('concept.expo.ecg'));const r=await request('obtain an electrocardiographic tracing and BP','one');expect(r.status).toBe(200);expect((await r.json()).data.fragments.every((f:any)=>f.interpretation.status==='MATCH')).toBe(true);expect(h.getInterpreterProviderCalls()).toBe(1);
 await request('obtain an electrocardiographic tracing and BP','one');expect(h.getInterpreterProviderCalls()).toBe(1);
 h.setInterpreterOutput(output('concept.expo.aspirin'));const dose=await request('Give aspirin 300 mg','two');expect((await dose.json()).data.fragments[0].interpretation.status).toBe('NO_MATCH');
 h.setInterpreterOutput(output('medication.other-patient'));const foreign=await request('use an invented therapy','three');expect((await foreign.json()).data.fragments[0].interpretation.status).toBe('NO_MATCH');
 expect(h.store.sessions.get(id)!.committed_events).toHaveLength(0);
});
it('entry rejects forged mode, medical fields, foreign identity and changed replay',async()=>{
 const e=await createExpoEntry(`security-${++serial}`,()=>new Date('2026-09-25T00:00:00Z').toISOString());
 for(const b of [{entry_id:'patient-03',mode:'ASSESSMENT'},{entry_id:'patient-01',mode:'UNRESTRICTED'},{entry_id:'patient-01',mode:'ASSESSMENT',diagnosis:'x'}])expect((await e.begin(b,'invalid')).status).toBe(400);
 expect((await e.begin({entry_id:'patient-01',mode:'ASSESSMENT'},'same')).status).toBe(201);
 expect((await e.begin({entry_id:'patient-01',mode:'PRACTICE_DEMO'},'same')).status).toBe(409);
});
