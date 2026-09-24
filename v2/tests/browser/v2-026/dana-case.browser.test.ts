import { describe, it, expect } from "vitest";
import { createDanaReviewSession } from "../../../runtime/v2-026-review-composition.ts";
import { DANA_ACTIONS as A, createDanaCase } from "../../../content/cases/anaphylaxis/dana-case.ts";
import { validateForPublication } from "../../../packages/case-schema/src/index.ts";
import { projectObservations } from "../../../packages/clinical-engine/src/index.ts";
import { apiHeaders, createApiTestHarness, startBody } from "../../fixtures/api/secure-api.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import { projectAssessmentEvidenceFromSession } from "../../../packages/session-engine/src/index.ts";
import { evaluateReviewAssessment } from "../../../packages/assessment-engine/src/index.ts";
import { buildPatientConversationContext } from "../../../packages/patient-conversation/src/index.ts";
import { projectVisualPatient } from "../../../packages/api-core/src/service/visual-patient-projection.ts";
import { prepareStemiConversationArtifact } from '../../../content/cases/stemi/v2-conversation/stemi-conversation-case.ts';
import { initializeReviewInMemorySession } from '../../../packages/session-engine/src/index.ts';
import { danaMotion } from '../../../apps/web/src/features/visual-patient/runtime/dana-motion.js';

describe("Dana — review-only second case on shared engines", () => {
  it('clinical improvement alone drives the complete visual response; renderer time and rejected intent cannot',async()=>{
    const a=await createDanaReviewSession();
    const session=()=>a.h.store.sessions.get(a.sessionId)!;
    const visual=()=>projectVisualPatient(session())!;
    const motion=(t:number)=>danaMotion(t,{...visual(),mode:'conversation',speaking:false});
    const initial=JSON.stringify(session().patient_state);
    for(const t of [0,180,3600,86400]){
      expect(motion(t)).toMatchObject({anxious:1,calm:0,rash:1,swelling:1});
    }
    expect(JSON.stringify(session().patient_state)).toBe(initial);
    expect((await a.action(A.fluids)).status).not.toBe(200); // no IV access
    expect(visual()).toMatchObject({face:'anxious',body:'itch_body',hand:true});
    expect((await a.advance(300)).success).toBe(true); // elapsed Clinical Time is not treatment
    expect(motion(4.3)).toMatchObject({scratch:1,anxious:1,calm:0,rash:1,swelling:1});
    for(const id of [A.epi,A.oxygen,A.iv,A.fluids])expect((await a.action(id)).status).toBe(200);
    expect((await a.advance(479)).success).toBe(true);
    expect(visual().body).toBe('itch_body');
    expect((await a.advance(480)).success).toBe(true);
    expect(session().patient_state.outcome_flags).toContain('outcome.dana.improved');
    expect(visual()).toMatchObject({face:'relieved',body:'calm_body',hand:false});
    expect(motion(4.3)).toMatchObject({scratch:0,neck:0,forearm:0,anxious:0,calm:1,rash:.06,swelling:.05});
    expect(motion(.75).thoracic).toBeCloseTo(.38);
    expect(motion(.75).breathing).toBeCloseTo(.010); // RR20 peak, down from RR28
    const before=JSON.stringify(session().patient_state);
    for(let t=0;t<90;t+=.3)motion(t);
    expect(JSON.stringify(session().patient_state)).toBe(before);
  });
  it('isolates patient facts, pinned visual assets and investigation identities in both directions',async()=>{
    const dana=await createDanaReviewSession();const stemi=await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
    const initialized=initializeReviewInMemorySession({session_id:'session.isolation.stemi',mode:'PRACTICE_DEMO',review_execution_artifact:stemi,trusted_real_time_anchor_utc:'2026-09-06T10:00:00Z'});
    if(!initialized.success)throw Error('STEMI_INIT_FAILED');
    const ds=dana.h.store.sessions.get(dana.sessionId)!;
    for(const [artifact,session,expected,excluded,asset] of [[dana.artifact,ds,'dana','stemi','dana.review-v01'],[stemi,initialized.session,'stemi','dana','stemi.physical-exam-v02']] as const){
      const context=buildPatientConversationContext({case_package:artifact.source_case,patient_state:session.patient_state,locale:'ar-JO',history:[]});
      expect(context.success).toBe(true);if(!context.success)throw Error('CONTEXT_FAILED');
      expect(context.context.facts.length).toBeGreaterThan(0);
      expect(context.context.facts.every(f=>f.fact_id.startsWith(`fact.${expected}.`))).toBe(true);
      expect(JSON.stringify(context.context)).not.toContain(`fact.${excluded}.`);
      expect(projectVisualPatient(session)?.asset_id).toBe(asset);
      expect(JSON.stringify(artifact.source_case.action_catalogue)).not.toContain(`investigation.${excluded}.`);
    }
  });
  it("validates and pins 16 modules without fabricated publication or source approval", async () => {
    const a = await createDanaReviewSession();
    expect(a.artifact.execution_authority).toBe("REVIEW_ONLY");
    expect(a.artifact.source_case.manifest.modules).toHaveLength(16);
    expect(a.artifact.source_case.validation.reviews).toEqual([]);
    expect((await validateForPublication(a.artifact.source_case, undefined, PORTABLE_SHA256_ADAPTER)).valid).toBe(false);
    expect(a.artifact.source_case.curriculum_mappings.official_alignment_claimed).toBe(false);
    expect(a.artifact.source_case.patient_profile.default_language).toBe("ar-JO");
  });
  it("projects exact locked initial observations and explicit rhythm", async () => {
    const c = await createDanaCase(PORTABLE_SHA256_ADAPTER);
    const r = projectObservations({ ...c.initial_state.patient_state, session_id: "session.dana.test" }, c.initial_state.observation_projection);
    expect(r.success).toBe(true);
    expect(JSON.stringify(r)).toContain('"heart_rate_bpm":126');
    expect(JSON.stringify(r)).toContain('"systolic_bp_mm_hg":82');
    expect(JSON.stringify(r)).toContain('"diastolic_bp_mm_hg":48');
    expect(JSON.stringify(r)).toContain('"respiratory_rate_per_minute":28');
    expect(JSON.stringify(r)).toContain('"spo2_percent":93');
    expect(JSON.stringify(r)).toContain('"temperature_celsius":36.7');
  });
  it("correct initial treatment settles after authored clinical delay, not instantly", async () => {
    const a = await createDanaReviewSession();
    for (const id of [A.help,A.abcde,A.oxygen,A.epi,A.iv,A.fluids,A.monitor]) expect((await a.action(id)).status).toBe(200);
    expect((await a.advance(179)).success).toBe(true);
    expect(a.h.store.sessions.get(a.sessionId)!.patient_state.hemodynamic_state).toBe("hemodynamics.dana.initial");
    expect((await a.advance(180)).success).toBe(true);
    const s = a.h.store.sessions.get(a.sessionId)!.patient_state;
    expect(s.hemodynamic_state).toBe("hemodynamics.dana.improved");
    const r = projectObservations(s, a.artifact.source_case.initial_state.observation_projection);
    expect(JSON.stringify(r)).toContain('"heart_rate_bpm":98');
    expect(JSON.stringify(r)).toContain('"systolic_bp_mm_hg":104');
    expect(JSON.stringify(r)).toContain('"diastolic_bp_mm_hg":66');
    expect(JSON.stringify(r)).toContain('"respiratory_rate_per_minute":20');
    expect(JSON.stringify(r)).toContain('"spo2_percent":98');
  });
  it("adjunct alone does not replace epinephrine; delay flags without invented collapse", async () => {
    const a = await createDanaReviewSession();
    expect((await a.action(A.anti)).status).toBe(200);
    expect((await a.advance(300)).success).toBe(true);
    const s = a.h.store.sessions.get(a.sessionId)!.patient_state;
    expect(s.outcome_flags).toContain("outcome.dana.critical-delay");
    expect(s.hemodynamic_state).toBe("hemodynamics.dana.initial");
  });
  it("five-minute repeat window is counted from first epinephrine", async () => {
    const early = await createDanaReviewSession(); await early.action(A.epi); await early.advance(299); await early.action(A.repeat);
    expect(early.h.store.sessions.get(early.sessionId)!.patient_state.outcome_flags).toContain("outcome.dana.repeat-outside-window");
    const due = await createDanaReviewSession(); await due.action(A.epi); await due.advance(300); await due.action(A.repeat);
    expect(due.h.store.sessions.get(due.sessionId)!.patient_state.outcome_flags).toContain("outcome.dana.repeat-given");
  });
  it("pending investigations reveal only after scheduled clinical availability; no approved images", async () => {
    const a = await createDanaReviewSession(); await a.action(A.epi);
    for (const id of ["ecg","cxr","vbg","labs","tryptase"]) expect((await a.action(`investigation.dana.${id}`)).status).toBe(200);
    const get = (id:string) => a.h.app.request(`/v1/sessions/${a.sessionId}/investigations/diagnostic-result.dana.${id}`,{headers:apiHeaders({token:"faculty"})});
    expect((await get("ecg")).status).toBe(422);
    expect((await a.advance(600)).success).toBe(true);
    for (const id of ["ecg","cxr","vbg","labs","tryptase"]) {
      const r = await get(id); expect(r.status).toBe(200);
      const data = (await r.json()).data;
      expect(data.finding_texts.length).toBeGreaterThan(0);
      expect(JSON.stringify(data)).not.toContain("APPROVED");
    }
  });
  it("premature discharge is unsafe, never a cure or published finalization", async () => {
    const a = await createDanaReviewSession(); expect((await a.action(A.discharge)).status).toBe(200);
    expect(a.h.store.sessions.get(a.sessionId)!.patient_state.outcome_flags).toContain("outcome.dana.unsafe-disposition");
  });
  it("six-domain assessment awards observation only from the clinically settled outcome", async () => {
    const a=await createDanaReviewSession();
    for(const id of [A.history,A.abcde,A.skin,A.dx,A.help,A.monitor,A.epi,A.oxygen,A.iv,A.fluids,A.education]) expect((await a.action(id)).status).toBe(200);
    await a.advance(180);expect((await a.action(A.observe)).status).toBe(200);
    const evidence=projectAssessmentEvidenceFromSession(a.h.store.sessions.get(a.sessionId)!);if(!evidence.success)throw Error("EVIDENCE_FAILED");
    const result=evaluateReviewAssessment({evaluation_schema_version:"1.0",execution_authority:"REVIEW_ONLY",evaluation_phase:"LIVE",assessment_id:"assessment.dana.trace",review_execution_artifact:a.artifact,session_evidence:evidence.evidence});
    expect(result.success).toBe(true);if(!result.success)return;
    expect(result.result.overall_score_basis_points).toBe(10000);
    expect(result.result.domain_scores).toHaveLength(6);
  });
  it("binds Dana display to the exact review hash; vitals alone never create improvement", async()=>{
    const a=await createDanaReviewSession(),s=structuredClone(a.h.store.sessions.get(a.sessionId)!);
    expect(projectVisualPatient(s)).toMatchObject({asset_id:"dana.review-v01",face:"anxious",body:"itch_body",blink:true});
    if(s.pinned_case.execution_authority!=="REVIEW_ONLY")throw Error();
    s.pinned_case.review_execution_hash="f".repeat(64) as never;
    expect(projectVisualPatient(s)).toBeUndefined();
  });
  it("reuses Patient Conversation with disclosed history only; test provider cannot change truth",async()=>{
    const a=await createDanaReviewSession();const s=a.h.store.sessions.get(a.sessionId)!;
    const context=buildPatientConversationContext({case_package:a.artifact.source_case,patient_state:s.patient_state,locale:"ar-JO",history:[]});
    expect(context.success).toBe(true);if(!context.success)return;
    expect(context.context.facts.some(f=>f.fact_id==="fact.dana.onset")).toBe(true);
    for(const id of ["fact.dana.diagnosis","fact.dana.vbg","fact.dana.skin"])expect(context.context.facts.some(f=>f.fact_id===id)).toBe(false);
    const h=await createApiTestHarness({review_artifact:a.artifact,enable_patient_conversation:true,patient_provider:{async execute(r){return{success:true,provider:"OPENAI",provider_model:r.model,provider_response_id:"response.dana.test-double",retry_count:0,output_text:JSON.stringify({output_schema_version:"1.0",locale:"ar-JO",utterance:"بلشت بعد حوالي عشر إلى خمس عشرة دقيقة من الحلو.",answer_mode:"GROUNDED",grounding_fact_ids:["fact.dana.onset"],grounding_state_refs:[],safety_flags:[],disclosure_status:"WITHIN_PATIENT_BOUNDARY"})};}}});
    const start=await h.app.request('/v1/review-sessions',{method:'POST',headers:apiHeaders({token:'faculty',idempotency:'idempotency.dana.patient-start'}),body:JSON.stringify(startBody(a.artifact.source_case.manifest.case_id,{mode:'PRACTICE_DEMO',patient_language:'ar-JO'}))});
    expect(start.status).toBe(201);
    const id=(await start.json()).data.session.session_id;
    const before=JSON.stringify(h.store.sessions.get(id)!.patient_state);
    const reply=await h.app.request(`/v1/sessions/${id}/questions`,{method:'POST',headers:apiHeaders({token:'faculty',idempotency:'idempotency.dana.question'}),body:JSON.stringify({text:'متى بلشت الأعراض؟',locale:'ar-JO',source:'TEXT',utterance_id:'utterance.dana.question'})});
    expect(reply.status).toBe(200);expect((await reply.json()).data.turn.grounding_fact_ids).toEqual(['fact.dana.onset']);
    expect(JSON.stringify(h.store.sessions.get(id)!.patient_state)).toBe(before);
  });
});
