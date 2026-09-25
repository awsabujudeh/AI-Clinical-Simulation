import {describe,it,expect} from "vitest";
import {createCompleteExpoCase,prepareCompleteExpoCase} from "../../../content/cases/shared-catalogue/complete-cases.ts";
import {prepareExpoCatalogueCase} from "../../../content/cases/shared-catalogue/expo-cases.ts";
import {COMPLETE_EXPO_CATALOGUE as catalogue} from "../../../content/cases/shared-catalogue/complete-catalogue.ts";
import {BASELINE_LABS,LAB_TIMING,PANELS} from "../../../content/cases/shared-catalogue/medical-dataset.ts";
import {PORTABLE_SHA256_ADAPTER as hash} from "../../fixtures/portable-sha256.ts";
import {wp1Fixture} from "../../fixtures/wp1.ts";
import {validateDraftCase,validateForPublication} from "../../../packages/case-schema/src/index.ts";
import {buildPatientConversationContext} from "../../../packages/patient-conversation/src/index.ts";
import {danaMotion} from "../../../apps/web/src/features/visual-patient/runtime/dana-motion.js";
import {matchingCaseDiagnostics} from "../../../apps/web/src/features/investigations/InvestigationResults.tsx";
import {sharedCatalogueProblems} from "../../../packages/case-schema/src/shared-catalogue-validation.ts";
import {investigationStatuses} from "../../../packages/api-core/src/service/investigation-status.ts";
import {ClinicalTimeSchema,SafeInvestigationProjectionSchema,SafeInvestigationStatusSchema} from "../../../packages/contracts/src/index.ts";
const fixture=(p:"khalid"|"dana")=>wp1Fixture(p,"wp2-complete");
it("complete shared vocabulary is 33 concepts / 14 investigations, identical in both Sessions",async()=>{
  const k=await fixture("khalid"),d=await fixture("dana");
  const ks=await k.state(),ds=await d.state();
  expect(ks.learner_action_catalogue).toEqual(catalogue);
  expect(JSON.stringify(ks.learner_action_catalogue)).toBe(JSON.stringify(ds.learner_action_catalogue));
  expect(catalogue.actions).toHaveLength(33);
  expect(catalogue.actions.filter(a=>a.action_type==="INVESTIGATION")).toHaveLength(14);
  expect(JSON.stringify(catalogue)).not.toMatch(/stemi|anaphylaxis|outcome|critical|rubric|beneficial|abnormal|diagnosis/iu);
});
for(const p of ["khalid","dana"] as const) describe(`WP2 complete ${p}`,()=>{
  it("validates successor with 100% explicit coverage, not publication",async()=>{
    const c=await createCompleteExpoCase(p,hash);
    expect(validateDraftCase(c).valid).toBe(true);
    expect((await validateForPublication(c,undefined,hash)).valid).toBe(false);
    expect(c.manifest.status).toBe("UNDER_REVIEW");
    for(const binding of c.action_catalogue.shared!.bindings) expect(c.action_catalogue.actions.find(a=>a.action_id===binding.case_action_id)?.outcome_policy).toBeDefined();
    expect(c.action_catalogue.shared!.bindings).toHaveLength(33);
    expect(c.action_catalogue.shared!.search_only?.bindings).toHaveLength(1);
  });
  it("validates the special-search binding with the same closed coverage rules",async()=>{
    const c=await createCompleteExpoCase(p,hash);
    c.action_catalogue.shared!.search_only!.bindings[0]!.case_action_id="investigation.foreign" as never;
    expect(sharedCatalogueProblems(c).length).toBeGreaterThan(0);
  });
  it("FoCUS is explicitly authored and gated; no fabricated EF for Dana",async()=>{
    const f=await fixture(p);
    if(p==="dana")await f.action("concept.expo.epinephrine");
    await f.action("concept.expo.focused-echo");
    const i=(await f.state()).investigations!.find(x=>x.action_id==="concept.expo.focused-echo")!;
    expect((await f.response(`/investigations/${i.diagnostic_result_id}`)).status).toBe(422);
    f.elapsed(240);await f.state();const r=await f.response(`/investigations/${i.diagnostic_result_id}`);
    expect(r.status).toBe(200);const data=(await r.json()).data;
    expect(JSON.stringify(data.finding_texts)).toContain(p==="dana"?"hyperdynamic":"LVEF about 45%");
    if(p==="dana") expect(data.structured_result.structured_measurements).toEqual([]);
  });
  it("preserves parent hashes, clinical state, all old rules and scoring",async()=>{
    const a=await prepareCompleteExpoCase(p,hash),old=await prepareExpoCatalogueCase(p,hash);
    expect(old.review_execution_hash).toBe(p==="khalid"?"bff79627aa2d99d6951cf3e4e325bab118772ad0b266b2e761ef61bd5cbe77ce":"5fa47d6c2f00c2be192bcae9030dd861a502879f308ef1d74d1f5e224c79cc82");
    // Explicit old-rule comparison: new additions may schedule diagnostics only.
    for(const rule of old.source_case.rules.rules) expect(a.source_case.rules.rules.find(r=>r.rule_id===rule.rule_id)).toEqual(rule);
    expect(a.source_case.assessment_rubric).toEqual(old.source_case.assessment_rubric);
    expect(a.source_case.initial_state.patient_state).toEqual({...old.source_case.initial_state.patient_state,case_version:p==="khalid"?"2.3.0":"1.3.0"});
    expect(a.review_execution_hash).not.toBe(old.review_execution_hash);
  });
  it("keeps lab results, echo and diagnosis outside Patient Conversation",async()=>{
    const f=await fixture(p),c=f.artifact.source_case;
    const context=buildPatientConversationContext({case_package:c,patient_state:f.raw().patient_state,locale:"en-US",history:[]});
    expect(context.success).toBe(true);if(!context.success)throw Error("CONTEXT_FAILED");
    expect(context.context.facts.every(x=>c.clinical_facts.facts.find(f=>f.fact_id===x.fact_id)?.disclosure_mode==="on_direct_question")).toBe(true);
    expect(JSON.stringify(context.context)).not.toMatch(/fact.complete|hs-cTnI|hyperdynamic|D-dimer|rubric|score_basis/);
    expect(JSON.stringify(context.context)).not.toContain(p==="khalid"?"food-triggered":"inferior STEMI");
  });
  it("initial result inventory exposes labels/status only and preserves hidden observations",async()=>{
    const f=await fixture(p),s=await f.state();
    expect(s.investigations).toHaveLength(14);
    expect(s.investigations!.every(i=>i.status==="NOT_ORDERED" && i.ordered_at===undefined && i.available_at===undefined)).toBe(true);
    expect(JSON.stringify(s.investigations)).not.toMatch(/analyte|reference_interval|source_ids|finding_fact|SIMULATION_AUTHORED|PENDING_PHYSICIAN/);
    expect(s.observations.acquired).toEqual([]);
    for(const i of s.investigations!) expect((await f.response(`/investigations/${i.diagnostic_result_id}`)).status).toBe(422);
    expect(s.visual_patient?.asset_id).toBe(p==="khalid"?"stemi.physical-exam-v02":"dana.review-v01");
  });
  it("inventory ignores unordered, future and foreign availability receipts",async()=>{
    const f=await fixture(p);
    await f.action("concept.expo.epinephrine");await f.action("concept.expo.cbc");
    f.elapsed(480);await f.state();
    const raw=structuredClone(f.raw());
    const action=raw.pinned_case.shared_catalogue!.bindings.find(b=>b.concept_id==="concept.expo.cbc")!.case_action_id;
    const status=()=>investigationStatuses(raw)!.find(i=>i.action_id==="concept.expo.cbc")!.status;
    expect(status()).toBe("AVAILABLE");
    raw.committed_events=raw.committed_events.filter(e=>!(e.action_id===action&&e.event_type==="INVESTIGATION_ORDERED"));
    expect(status()).toBe("NOT_ORDERED");
    raw.committed_events=structuredClone(f.raw().committed_events).map(e=>e.action_id===action?{...e,clinical_time:ClinicalTimeSchema.parse(raw.patient_state.clinical_time+1)}:e);
    expect(status()).toBe("NOT_ORDERED");
    raw.committed_events=structuredClone(f.raw().committed_events).map(e=>e.action_id===action?{...e,session_id:"session.foreign" as never}:e);
    expect(status()).toBe("NOT_ORDERED");
  });
  for(const [panel] of PANELS) it(`${panel}: explicit result / time gating / reference metadata / no provider`,async()=>{
    const f=await fixture(p);
    // Treat first to avoid unrelated no-adrenaline interrupt during the laboratory timing test.
    if(p==="dana") await f.action("concept.expo.epinephrine");
    const r=await f.action(`concept.expo.${panel}`);
    expect(r.response.status).toBe(200);
    const i=(await f.state()).investigations!.find(i=>i.action_id===`concept.expo.${panel}`)!;
    expect(i.available_at).toBe(i.ordered_at!+LAB_TIMING[p][panel]!);
    expect(i.collection_at).toBe(0);
    const result=()=>f.response(`/investigations/${i.diagnostic_result_id}`);
    f.elapsed(LAB_TIMING[p][panel]!-1);await f.state();expect((await result()).status).toBe(422);
    f.elapsed(LAB_TIMING[p][panel]!);await f.state();const rr=await result();expect(rr.status).toBe(200);
    const data=(await rr.json()).data;
    expect(data.timing.status).toBe("AVAILABLE");
    if(p==="dana" && panel==="troponin") {
      expect(data.structured_result.result_type).toBe("TEXT_REPORT");
      expect(JSON.stringify(data.finding_texts)).toContain("negative");
    } else {
      expect(data.structured_result.result_type).toBe("STRUCTURED_LAB");
      for(const a of data.structured_result.analytes) {
        expect(a.value).toBe(BASELINE_LABS[p][a.analyte_code.replace("analyte.","")]);
        expect(data.analyte_labels.find((l:{analyte_id:string})=>l.analyte_id===a.analyte_id).labels).toHaveLength(2);
      }
      if(p==="dana" && panel==="renal") expect(data.structured_result.analytes.find((a:{analyte_code:string})=>a.analyte_code==="analyte.egfr").value_qualifier).toBe("GREATER_THAN");
    }
    expect(JSON.stringify(data)).not.toMatch(/source_ids|SIMULATION_AUTHORED|PENDING_PHYSICIAN_REVIEW|rule\./);
    expect((await f.action(`concept.expo.${panel}`)).response.status).toBe(422);
    expect(f.h.getPatientProviderCalls()+f.h.getInterpreterProviderCalls()).toBe(0);
  });
  it("orders in parallel, cannot forge result/collection time or another case binding",async()=>{
    const f=await fixture(p);
    expect((await f.action("concept.expo.cbc",{parameters:{result:1,collection_at:0}})).response.status).toBe(422);
    expect((await f.action("investigation.complete.dana.cbc")).response.status).toBe(422);
    await f.action("concept.expo.epinephrine");await f.action("concept.expo.cbc");await f.action("concept.expo.lactate");
    const s=await f.state(), cbc=s.investigations!.find(i=>i.action_id==="concept.expo.cbc")!,lac=s.investigations!.find(i=>i.action_id==="concept.expo.lactate")!;
    expect(lac.available_at!).toBeLessThan(cbc.available_at!);
    f.elapsed(180);await f.state();expect((await f.response(`/investigations/${lac.diagnostic_result_id}`)).status).toBe(200);
    expect((await f.response(`/investigations/${cbc.diagnostic_result_id}`)).status).toBe(422);
    expect((await f.response(`/investigations/${cbc.diagnostic_result_id}`,undefined,"other-learner")).status).toBe(404);
    expect((await f.response(`/investigations/${p==="khalid"?"diagnostic-result.complete.dana.cbc":"diagnostic-result.stemi.cbc"}`)).status).toBe(404);
  });
  it("preserves special test authored results without first-level diagnosis giveaway",async()=>{
    const f=await fixture(p),s=await f.state(),special=s.search_only_actions![0]!;
    expect(s.learner_action_catalogue.actions.some(a=>a.action_id===special.action_id)).toBe(false);
    if(p==="dana") await f.action("concept.expo.epinephrine");
    expect((await f.action(special.action_id)).response.status).toBe(200);
    f.elapsed(600);const current=await f.state();
    const i=current.investigations!.find(x=>x.action_id===special.action_id)!;
    const result=await (await f.response(`/investigations/${i.diagnostic_result_id}`)).json();
    expect(JSON.stringify(result.data.finding_texts)).toContain(p==="khalid"?"V4R":"pending beyond this simulation");
    expect(JSON.stringify(result.data)).not.toContain("18.0");
  });
  it("complete result renderer resolves all fourteen server-owned entries; never legacy mismatched ECG",async()=>{
    const f=await fixture(p),s=await f.state();
    const entries=matchingCaseDiagnostics({projection:s} as never)!;
    expect(entries).toHaveLength(14);
    if(p==="khalid") {
      const ecg=entries.find(e=>e.action_id==="concept.expo.ecg")!;
      expect(ecg.packaged).toBeNull();expect(ecg.review_note).toBe("ECG_MATCHED_IMAGE_PENDING_PHYSICIAN_REVIEW");
    }
  });
});
it("bounded diagnostic prose supports FoCUS without widening catalogue labels",async()=>{
  const f=await fixture("dana");await f.action("concept.expo.epinephrine");await f.action("concept.expo.focused-echo");
  f.elapsed(240);const s=await f.state();
  const i=s.investigations!.find(i=>i.action_id==="concept.expo.focused-echo")!;
  const data=(await (await f.response(`/investigations/${i.diagnostic_result_id}`)).json()).data;
  expect(SafeInvestigationProjectionSchema.safeParse({...data,finding_texts:[[{locale:"en-US",text:"x".repeat(500)}]]}).success).toBe(true);
  expect(SafeInvestigationProjectionSchema.safeParse({...data,finding_texts:[[{locale:"en-US",text:"x".repeat(4001)}]]}).success).toBe(false);
  expect(SafeInvestigationStatusSchema.safeParse({...i,labels:[{locale:"en-US",text:"x".repeat(500)}]}).success).toBe(false);
});
it("Khalid fluid support retains persistent pain; no invented reperfusion success",async()=>{
  const f=await fixture("khalid");
  for(const id of ["cath","iv","saline-250"])await f.action(`concept.expo.${id}`);
  f.elapsed(600);const s=await f.state();
  expect(f.raw().patient_state.hemodynamic_state).toBe("hemodynamics.stemi-modestly-supported");
  expect(f.raw().patient_state.pain_state).toMatchObject({severity_0_10:7,trend:"trend.persistent"});
  expect(s.visual_patient).toMatchObject({face:"pain",hand:true});
  expect(f.raw().patient_state.outcome_flags).not.toContain("outcome.reperfusion-success");
});
it("Dana improvement remains delayed, clinical-state driven, and complete visual response downstream",async()=>{
  const f=await fixture("dana");
  await f.action("concept.expo.monitor");
  for(const id of ["epinephrine","oxygen","iv","crystalloid-500"]) expect((await f.action(`concept.expo.${id}`)).response.status).toBe(200);
  expect((await f.state()).visual_patient?.face).toBe("anxious");
  f.elapsed(180);const s=await f.state();
  expect(s.visual_patient).toMatchObject({face:"relieved",body:"calm_body",hand:false});
  expect(danaMotion(4.3,{...s.visual_patient!,mode:"conversation",speaking:false})).toMatchObject({rash:.06,swelling:.05,scratch:0,calm:1});
  expect(s.observations.acquired.find(a=>a.measurement.channel==="HR")?.measurement).toMatchObject({value:98});
  await f.action("concept.expo.bp");await f.action("concept.expo.respirations");await f.action("concept.expo.pulse-ox");
  const final=await f.state();
  expect(final.observations.acquired.find(a=>a.measurement.channel==="BP")?.measurement).toMatchObject({systolic:104,diastolic:66});
  expect(final.observations.acquired.find(a=>a.measurement.channel==="RR")?.measurement).toMatchObject({value:20});
  expect(final.observations.acquired.find(a=>a.measurement.channel==="SPO2")?.measurement).toMatchObject({value:98});
});
