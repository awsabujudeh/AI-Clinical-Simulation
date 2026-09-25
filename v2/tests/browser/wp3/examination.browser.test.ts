import {describe,it,expect} from "vitest";
import {wp1Fixture} from "../../fixtures/wp1.ts";
import {deriveExamActions,EXAM_OPTIONS} from "../../../packages/case-schema/src/examination-runtime.ts";
import {prepareApprovedExpoCase,EXPO_MEDICAL_APPROVAL_BINDINGS} from "../../../content/cases/shared-catalogue/approved-expo-cases.ts";
import {PORTABLE_SHA256_ADAPTER as hash} from "../../fixtures/portable-sha256.ts";
import {examinationProjection} from "../../../packages/api-core/src/service/examination-projection.ts";
for(const patient of ["khalid","dana"] as const)describe(`WP3 ${patient}`,()=>{
 for(const option of EXAM_OPTIONS)it(`gates ${option.action_id}, commits time/evidence and only selected findings`,async()=>{
  const f=await wp1Fixture(patient,"wp2-approved"),before=await f.state();
  expect(before.examinations?.receipts).toEqual([]);expect(JSON.stringify(before)).not.toMatch(/bilateral wheeze|capillary refill|Lungs are clear|fact\.dana|fact\.stemi/);
  const r=await f.action(option.action_id);expect(r.response.status,JSON.stringify(r.body)).toBe(200);
  const s=await f.state(),receipt=s.examinations!.receipts[0]!;
  expect(receipt).toMatchObject({session_id:s.session_id,case_version:s.pinned_case.case_version,action_id:option.action_id,tool:option.tool,region:option.region,clinical_time:30,status:"AVAILABLE"});
  expect(receipt.findings).toHaveLength(1);expect(receipt.findings[0]!.fact_id).toContain(patient==="dana"?"fact.dana.":"fact.stemi.");
  expect(f.raw().committed_events[0]!.payload).toMatchObject({execution_status:"EXECUTED",examination:{duration_seconds:30,status:"AVAILABLE"}});
  expect(s.observations.acquired).toHaveLength(0);
  expect((await r.retry()).status).toBe(200);expect((await f.state()).examinations!.receipts).toHaveLength(1);
  expect((await f.action(option.action_id)).response.status).toBe(200);expect((await f.state()).examinations!.receipts).toHaveLength(2);
  const timeline=await (await f.response('/timeline')).json();expect(JSON.stringify(timeline)).toContain(option.labels[0]!.text);
 });
 it('rejects forged result/region/tool and foreign ownership without side effects',async()=>{
  const f=await wp1Fixture(patient,"wp2-approved");
  for(const extra of [{findings:[{text:'normal'}]},{region:'CHEST'},{tool:'penlight'},{parameters:{finding:'normal'}},{case_version:'1.0.0'}])expect((await f.action('examination.expo.general',extra)).response.status).not.toBe(200);
  expect((await f.action('examination.expo.penlight')).response.status).toBe(422);
  expect((await f.response('/state',undefined,'other-learner')).status).toBe(404);
  expect(f.raw().committed_events).toHaveLength(0);
 });
 it('does not disclose altered, foreign, future or wrong-case receipts',async()=>{
  const f=await wp1Fixture(patient,"wp2-approved");await f.action('examination.expo.auscultation');
  for(const mutation of ['session','time','version','finding'] as const){const s=structuredClone(f.raw()),e=s.committed_events[0]!;
   if(mutation==='session')e.session_id='session.other' as never;
   if(mutation==='time')e.clinical_time=999 as never;
   if(mutation==='version')e.case_version='9.0.0' as never;
   if(mutation==='finding')(e.payload as any).examination.findings=[{fact_id:'forged',text:[]}];
   expect(examinationProjection(s)!.receipts).toHaveLength(0);
  }
 });
 it('preserves approved Case hashes and first-level catalogue; old versions receive no new binding',async()=>{
  const a=await prepareApprovedExpoCase(patient,hash);expect(a.review_execution_hash).toBe(EXPO_MEDICAL_APPROVAL_BINDINGS[patient].execution);
  expect(a.source_case.action_catalogue.shared!.catalogue.actions).toHaveLength(33);
  expect(deriveExamActions(a).map(a=>a.examination.option)).toEqual(EXAM_OPTIONS);
  expect(deriveExamActions({...a,execution_authority:'REVIEW_ONLY'})).toEqual([]);
  expect(deriveExamActions({...a,review_execution_hash:'0'.repeat(64) as never})).toEqual([]);
 });
 it('preserves WP1 acquisition, devices, prerequisites, repeat BP and monitoring without continuous BP',async()=>{
  const f=await wp1Fixture(patient,"wp2-approved");expect((await f.state()).visual_patient?.equipment).toMatchObject({bp_cuff:false,iv_access:false,iv_tubing:false,pulse_ox:'ABSENT'});
  expect((await f.action('concept.expo.saline-250')).response.status).toBe(422);
  for(const id of ['bp','bp','pulse-ox','iv','saline-250','monitor'])expect((await f.action('concept.expo.'+id)).response.status).toBe(200);
  const s=await f.state();expect(s.visual_patient?.equipment).toMatchObject({bp_cuff:true,iv_access:true,iv_tubing:true,pulse_ox:'APPLIED'});
  expect(s.observations.acquired.find(x=>x.measurement.channel==='BP')?.status).not.toBe('MONITORING');
  expect(s.learner_action_catalogue.actions).toHaveLength(33);
 });
});
it('state-changing treatment never makes baseline text a new current finding; prior receipts remain historical',async()=>{
 const f=await wp1Fixture('dana','wp2-approved');await f.action('examination.expo.skin');
 for(const id of ['epinephrine','oxygen','iv','crystalloid-500'])expect((await f.action('concept.expo.'+id)).response.status).toBe(200);
 f.elapsed(200);await f.state();expect(f.raw().patient_state.hemodynamic_state).toBe('hemodynamics.dana.improved');
 const r=await f.action('examination.expo.skin');expect(r.response.status).toBe(200);
 const receipts=(await f.state()).examinations!.receipts;
 expect(receipts[0]!.status).toBe('AVAILABLE');expect(receipts[1]!.status).toBe('CURRENT_STATE_NOT_AUTHORED');expect(receipts[1]!.findings).toEqual([]);
});
it('inspection does not leak auscultation and neurological exam does not leak abdomen/chest findings',async()=>{
 for(const p of ['dana','khalid'] as const){const f=await wp1Fixture(p,'wp2-approved');await f.action('examination.expo.respiratory');await f.action('examination.expo.neurological');
  const s=JSON.stringify((await f.state()).examinations!.receipts);expect(s).not.toMatch(/wheeze|crackles|abdomen|chest-wall tenderness/);
 }
});
