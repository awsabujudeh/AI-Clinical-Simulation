import { beforeAll, describe, expect, it } from "vitest";
import {
  DANA_ADDITIONAL_EXAM, DANA_ADDITIONAL_HISTORY, DANA_AUTHOR_SOURCE,
  createDanaHistoryExamCase, prepareCurrentCompleteExpoCase,
} from "../../../content/cases/shared-catalogue/dana-history-exam.ts";
import { prepareCompleteExpoCase } from "../../../content/cases/shared-catalogue/complete-cases.ts";
import { validateDraftCase, validateForPublication } from "../../../packages/case-schema/src/index.ts";
import { buildPatientConversationContext } from "../../../packages/patient-conversation/src/index.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "../../fixtures/portable-sha256.ts";
import { wp1Fixture } from "../../fixtures/wp1.ts";
import { danaMotion } from "../../../apps/web/src/features/visual-patient/runtime/dana-motion.js";

const fixture = () => wp1Fixture("dana", "wp2-author-complete");
describe("Owner-authored Dana history/examination successor", () => {
  let current: Awaited<ReturnType<typeof prepareCurrentCompleteExpoCase>>;
  let parent: Awaited<ReturnType<typeof prepareCompleteExpoCase>>;
  beforeAll(async () => {
    current = await prepareCurrentCompleteExpoCase("dana", hash);
    parent = await prepareCompleteExpoCase("dana", hash);
  });
  it("validates a new immutable REVIEW_ONLY version without physician approval", async () => {
    const c = current.source_case;
    expect(validateDraftCase(c).valid).toBe(true);
    expect((await validateForPublication(c, undefined, hash)).valid).toBe(false);
    expect(c.manifest).toMatchObject({case_version:"1.4.0",case_version_id:"case-version.anaphylaxis.dana.005",status:"UNDER_REVIEW"});
    expect(c.validation).toMatchObject({approval_status:"UNDER_REVIEW",reviewers:[],reviews:[]});
    expect(c.validation.sources.find(s=>s.source_id===DANA_AUTHOR_SOURCE)).toMatchObject({status:"UNRESOLVED",required:true});
    expect(current.review_execution_hash).toBe("f468a31839af399b02b401aa5dde002d7ffc90d5da34026e3a8bb559a4084926");
    expect(current.review_subject_hash).toBe("83324ccac70604a53c3f9df32c26b9c0f84a0bc4845bd82632d07b577a4a9f09");
    expect(parent.review_execution_hash).toBe("f844ec87eaf0d84c9cf530430e5c611bfd353413a4ae5f0f5e01d2c464c68072");
  });
  it("preserves every previous fact/localization and clinical/action/visual/rubric module", () => {
    const c=current.source_case, p=parent.source_case;
    for(const f of p.clinical_facts.facts) expect(c.clinical_facts.facts.find(x=>x.fact_id===f.fact_id)).toEqual(f);
    for(const entry of p.localization.entries) expect(c.localization.entries.find(e=>e.key===entry.key)).toEqual(entry);
    for(const name of ["action_catalogue","rules","timeline_policy","assessment_rubric","visual_manifest","presentation","patient_profile","classification","curriculum_mappings"] as const) expect(c[name]).toEqual(p[name]);
    expect(c.initial_state).toEqual({...p.initial_state,patient_state:{...p.initial_state.patient_state,case_version:"1.4.0"}});
    expect(c.dialogue_policy.patient_state_manifestations).toEqual(p.dialogue_policy.patient_state_manifestations);
  });
  it("records bilingual author provenance for all 18 history and 8 exam additions", () => {
    const c=current.source_case, added=c.clinical_facts.facts.filter(f=>f.source_ids.includes(DANA_AUTHOR_SOURCE as never));
    expect(DANA_ADDITIONAL_HISTORY).toHaveLength(18);expect(DANA_ADDITIONAL_EXAM).toHaveLength(8);
    expect(added).toHaveLength(26);
    const provenance=c.clinical_facts.extensions!["balsim.authoring"] as {facts:{fact_id:string;origin:string;review_status:string}[]};
    expect(provenance.facts).toHaveLength(26);
    for(const f of added) {
      expect(provenance.facts.find(p=>p.fact_id===f.fact_id)).toMatchObject({origin:"SIMULATION_AUTHORED",review_status:"PENDING_PHYSICIAN_REVIEW"});
      const locales=c.localization.entries.find(e=>e.key===f.content_key)!.translations;
      expect(locales.map(t=>t.locale).sort()).toEqual(["ar-JO","en-US"]);
      expect(locales.every(t=>t.text.length>0)).toBe(true);
    }
  });
  it("completes all eight baseline examination domains without adding severe positive findings", () => {
    const exam=DANA_ADDITIONAL_EXAM;
    expect(exam.map(e=>e[0])).toEqual(["general","neurological","airway","respiratory","cardiovascular","abdomen","skin-mucosa","extremities-perfusion"]);
    expect(exam.find(e=>e[0]==="neurological")![1]).toContain("GCS 15");
    expect(exam.find(e=>e[0]==="airway")![1]).toContain("No visible tongue swelling");
    expect(exam.find(e=>e[0]==="abdomen")![1]).toContain("No focal tenderness");
    expect(exam.find(e=>e[0]==="extremities-perfusion")![1]).toContain("approximately 3 seconds");
    expect(exam.find(e=>e[0]==="general")![1]).toContain("not collapsed");
    expect(JSON.stringify(current.source_case.rules)).toBe(JSON.stringify(parent.source_case.rules));
  });
  for(const locale of ["en-US","ar-JO"] as const) it(`${locale}: Patient Conversation receives history only, never exam/truth/targets`,async()=>{
    const f=await fixture(), c=f.artifact.source_case;
    const result=buildPatientConversationContext({case_package:c,patient_state:f.raw().patient_state,locale,history:[]});
    expect(result.success).toBe(true);if(!result.success)throw Error("CONTEXT_FAILED");
    const ids=result.context.facts.map(f=>f.fact_id);
    for(const [id] of DANA_ADDITIONAL_HISTORY) expect(ids).toContain(`fact.dana.author.history.${id}`);
    for(const fact of c.clinical_facts.facts.filter(f=>f.fact_id.startsWith("fact.dana.author.exam."))) {
      expect(fact.disclosure_mode).toBe("after_exam");
      expect(c.dialogue_policy.forbidden_fact_ids).toContain(fact.fact_id);
      expect(c.dialogue_policy.disclosable_fact_ids).not.toContain(fact.fact_id);
      expect(ids).not.toContain(fact.fact_id);
    }
    expect(JSON.stringify(result.context)).not.toMatch(/GCS|capillary|hyperdynamic|FoCUS|104\/66|rubric|fact\.dana\.diagnosis|PENDING_PHYSICIAN_REVIEW|SIMULATION_AUTHORED/);
    expect(result.context.facts.every(f=>c.clinical_facts.facts.find(x=>x.fact_id===f.fact_id)?.disclosure_mode==="on_direct_question")).toBe(true);
  });
  it("keeps owner-bounded alcohol wording without inventing quantity/frequency",()=>{
    expect(DANA_ADDITIONAL_HISTORY.find(f=>f[0]==="alcohol")![1]).toBe("Alcohol use is none or occasional only; no relevant recent intake.");
  });
  it("after_exam still blocks accidental patient allow-list membership",async()=>{
    const f=await fixture(), c=structuredClone(f.artifact.source_case);
    const exam=c.clinical_facts.facts.filter(x=>x.fact_id.startsWith("fact.dana.author.exam."));
    c.dialogue_policy.disclosable_fact_ids.push(...exam.map(f=>f.fact_id));
    c.dialogue_policy.forbidden_fact_ids=c.dialogue_policy.forbidden_fact_ids.filter(id=>!exam.some(f=>f.fact_id===id));
    const result=buildPatientConversationContext({case_package:c,patient_state:f.raw().patient_state,locale:"en-US",history:[]});
    expect(result.success).toBe(true);if(!result.success)throw Error("CONTEXT_FAILED");
    expect(result.context.facts.some(f=>f.fact_id.startsWith("fact.dana.author.exam."))).toBe(false);
  });
  it("preserves Session ownership and institution isolation for the successor",async()=>{
    const f=await fixture();
    for(const token of ["other-learner","cross-reviewer"]) {
      for(const path of ["/state","/timeline","/assessment"]) {
        const response=await f.response(path,undefined,token);expect(response.status).toBe(404);
        expect(await response.text()).not.toMatch(/Dana|dana|history|anaphylaxis|GCS/);
      }
    }
  });
  it("keeps examiner-only baseline text and hidden vitals out of learner projections",async()=>{
    const f=await fixture(), s=await f.state();
    expect(s.observations.acquired).toEqual([]);
    expect(s.visual_patient).toMatchObject({asset_id:"dana.review-v01",face:"anxious",hand:true});
    for(const suffix of ["/state","/timeline","/assessment"]) {
      const response=await f.response(suffix);expect(response.status).toBe(200);
      expect(await response.text()).not.toMatch(/fact\.dana\.author|capillary refill|GCS 15|uvular|peritonism|source\.wp2\.dana-author|PENDING_PHYSICIAN_REVIEW/);
    }
    expect((await f.action("concept.expo.bp")).response.status).toBe(200);
    const acquired=await f.state();
    expect(acquired.observations.acquired.find(o=>o.measurement.channel==="BP")?.measurement).toMatchObject({systolic:82,diastolic:48});
    expect(JSON.stringify(acquired)).not.toContain("No signs of DVT");
    // No raw Case action bypass added to obtain findings in the shared catalogue.
    expect((await f.action("examination.dana.face-neck")).response.status).toBe(422);
    expect(f.h.getPatientProviderCalls()+f.h.getInterpreterProviderCalls()).toBe(0);
  });
  it("retains shared catalogue byte equality, every diagnostic and Khalid hash",async()=>{
    const k=await prepareCurrentCompleteExpoCase("khalid",hash);
    expect(k.review_execution_hash).toBe("1628d4fe87490fa4064c53b210dfc5a2380508ad66e11d55c6d1697aaafc1b74");
    expect(JSON.stringify(current.source_case.action_catalogue.shared!.catalogue)).toBe(JSON.stringify(k.source_case.action_catalogue.shared!.catalogue));
    const f=await fixture(),s=await f.state();
    expect(s.learner_action_catalogue.actions).toHaveLength(33);expect(s.investigations).toHaveLength(14);
    for(const i of s.investigations!)expect((await f.response(`/investigations/${i.diagnostic_result_id}`)).status).toBe(422);
  });
  it("keeps old Sessions pinned to 1.3.0 and new Sessions pinned to 1.4.0",async()=>{
    const old=await wp1Fixture("dana","wp2-complete"), next=await fixture();
    expect((await old.state()).pinned_case.case_version).toBe("1.3.0");
    expect((await next.state()).pinned_case.case_version).toBe("1.4.0");
    expect((await old.state()).pinned_case.case_version).toBe("1.3.0");
  });
  it("preserves delayed Dana treatment/visual response without disclosing historical exam as new measurements",async()=>{
    const f=await fixture();
    for(const id of ["epinephrine","oxygen","iv","crystalloid-500"])expect((await f.action(`concept.expo.${id}`)).response.status).toBe(200);
    expect((await f.state()).visual_patient?.face).toBe("anxious");
    f.elapsed(180);const s=await f.state();
    expect(s.visual_patient).toMatchObject({face:"relieved",body:"calm_body",hand:false});
    expect(danaMotion(4.3,{...s.visual_patient!,mode:"conversation",speaking:false})).toMatchObject({rash:.06,swelling:.05,scratch:0,calm:1});
    expect(s.observations.acquired).toEqual([]);
    for(const id of ["bp","respirations","pulse-ox"])await f.action(`concept.expo.${id}`);
    const observed=(await f.state()).observations.acquired.map(o=>o.measurement);
    expect(observed).toEqual(expect.arrayContaining([
      expect.objectContaining({channel:"BP",systolic:104,diastolic:66}),expect.objectContaining({channel:"RR",value:20}),
      expect.objectContaining({channel:"HR",value:98}),expect.objectContaining({channel:"SPO2",value:98}),
    ]));
  });
  it("does not modify the parent when multiple successor builds are requested",async()=>{
    await createDanaHistoryExamCase(hash);
    expect((await prepareCompleteExpoCase("dana",hash)).review_execution_hash).toBe(parent.review_execution_hash);
  });
});
