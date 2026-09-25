import {describe,it,expect} from "vitest";
import {OwnerAttestedMedicalReviewSchema,AssessmentResultSchema,SubmitClinicalActionRequestSchema,StartSessionRequestSchema} from "../../../packages/contracts/src/index.ts";
import {ReviewRecordSchema,ReviewExecutionArtifactSchema,verifyExpoExecution,validateForPublication,isProductionPlayableCaseArtifact} from "../../../packages/case-schema/src/index.ts";
import {prepareApprovedExpoCase,EXPO_MEDICAL_APPROVAL_BINDINGS} from "../../../content/cases/shared-catalogue/approved-expo-cases.ts";
import {prepareCurrentCompleteExpoCase} from "../../../content/cases/shared-catalogue/dana-history-exam.ts";
import {PORTABLE_SHA256_ADAPTER as hash} from "../../fixtures/portable-sha256.ts";
import {wp1Fixture} from "../../fixtures/wp1.ts";
import {apiHeaders,createApiTestHarness,startBody} from "../../fixtures/api/secure-api.ts";
import {projectFacultyExpo,createFacultyDemoStore} from "../../../runtime/v2-025-faculty-store.ts";

describe("owner-attested medical approval, not publication",()=>{
  for(const patient of ["khalid","dana"] as const) {
    it(`${patient}: exact successor approval, unchanged medical content and parent hashes`,async()=>{
      const a=await prepareApprovedExpoCase(patient,hash),p=await prepareCurrentCompleteExpoCase(patient,hash);
      expect(await verifyExpoExecution(a,hash)).toBe(true);
      expect(a.execution_authority).toBe("APPROVED_EXPO");
      expect(a.review_execution_hash).toBe(EXPO_MEDICAL_APPROVAL_BINDINGS[patient].execution);
      expect(a.medical_approval).toMatchObject({reviewer_identity_status:"NOT_FORMALLY_RECORDED",review_timestamp_status:"NOT_FORMALLY_RECORDED",production_publication:"NOT_PUBLISHED"});
      expect(a.medical_approval).not.toHaveProperty("reviewed_at_utc");
      const withoutMedicalStatus=(v:unknown)=>JSON.parse(JSON.stringify(v, (key,value)=>key==="review_status"&&value==="APPROVED_FOR_EXPO"?"PENDING_PHYSICIAN_REVIEW":value));
      for(const name of ["clinical_facts","action_catalogue","rules","timeline_policy","assessment_rubric","visual_manifest","patient_profile","presentation","localization","dialogue_policy","curriculum_mappings"] as const) expect(withoutMedicalStatus(a.source_case[name])).toEqual(p.source_case[name]);
      expect(JSON.stringify(a.source_case.action_catalogue)).not.toContain("PENDING_PHYSICIAN_REVIEW");
      expect(JSON.stringify(a.source_case.clinical_facts)).not.toContain("PENDING_PHYSICIAN_REVIEW");
      expect(a.source_case.initial_state).toEqual({...p.source_case.initial_state,patient_state:{...p.source_case.initial_state.patient_state,case_version:a.source_identity.case_version}});
      expect(p.review_execution_hash).toBe(patient==="khalid"?"1628d4fe87490fa4064c53b210dfc5a2380508ad66e11d55c6d1697aaafc1b74":"f468a31839af399b02b401aa5dde002d7ffc90d5da34026e3a8bb559a4084926");
      expect(isProductionPlayableCaseArtifact(a)).toBe(false);
      const pub=await validateForPublication(a.source_case,undefined,hash);
      expect(pub.valid).toBe(false);expect(pub.issues.map(i=>i.code)).toContain("CLINICAL_REVIEW_MISSING");
    });
    it(`${patient}: no identity/time fabrication, floating hash, catalogue or review upgrade`,async()=>{
      const a=await prepareApprovedExpoCase(patient,hash),m=a.medical_approval!;
      expect(OwnerAttestedMedicalReviewSchema.safeParse(m).success).toBe(true);
      for(const change of [{review_evidence_type:"FORMAL_PHYSICIAN_REVIEW"},{reviewed_at_utc:"2026-09-25T00:00:00Z"},{reviewer_ref_id:"reviewer.invented"},{attested_by:"STUDENT"},{attestation_status:"UNCONFIRMED"}]) expect(OwnerAttestedMedicalReviewSchema.safeParse({...m,...change}).success).toBe(false);
      expect(ReviewRecordSchema.safeParse({review_id:"review.expo.test",review_type:"CLINICAL",status:"APPROVED",reviewed_case_version:m.case_version,reviewed_content_hash:m.review_subject_hash}).success).toBe(false);
      for(const change of [{case_version:"9.0.0"},{reviewed_execution_hash:"0".repeat(64)},{shared_catalogue_version:"9.0.0"},{case_id:"case.other"}]) expect(ReviewExecutionArtifactSchema.safeParse({...a,medical_approval:{...m,...change}}).success).toBe(false);
      expect(ReviewExecutionArtifactSchema.safeParse({...a,medical_approval:undefined}).success).toBe(false);
      const mutated=structuredClone(a);mutated.source_case.localization.entries[0]!.translations[0]!.text+=" changed";
      expect(await verifyExpoExecution(mutated,hash)).toBe(false);
      const h=await createApiTestHarness({review_artifact:mutated,hash_adapter:hash});
      const r=await h.app.request("/v1/review-sessions",{method:"POST",headers:apiHeaders({token:"faculty",idempotency:"idempotency.invalid-medical"}),body:JSON.stringify(startBody(mutated.source_case.manifest.case_id))});
      expect(r.status).not.toBe(201);
    });
    it(`${patient}: Session, WP1 acquisition, WP2 secrecy and finalized Expo assessment/Tutor`,async()=>{
      const f=await wp1Fixture(patient,"wp2-approved"),initial=await f.state();
      expect(initial.pinned_case.execution_authority).toBe("APPROVED_EXPO");
      expect(initial.observations.acquired).toHaveLength(0);expect(initial.visual_patient).toBeDefined();
      expect(initial.learner_action_catalogue.actions).toHaveLength(33);
      expect(JSON.stringify(initial.learner_action_catalogue)).not.toMatch(/APPROVED_FOR_EXPO|NO_MODELED_BENEFIT|reviewed_execution_hash|rubric|critical_action/);
      expect((await f.action("concept.expo.bp")).response.status).toBe(200);
      const state=await f.state();expect(state.observations.acquired.length).toBeGreaterThan(0);expect(state.visual_patient?.equipment?.bp_cuff).toBe(true);
      const r=await f.response("/end",{expected_state_version:state.state_version,reason:"LEARNER_COMPLETED"});
      const body=await r.json();expect(r.status,JSON.stringify(body)).toBe(200);
      const before=JSON.stringify(f.raw());
      const debrief=await f.response("/debriefs",{locale:"en-US"});const d=await debrief.json();
      expect(debrief.status,JSON.stringify(d)).toBe(200);
      expect(d.data.packet.mode).toBe("FINAL_DEBRIEF");
      const result=AssessmentResultSchema.parse(d.data.packet.assessment);
      expect(result.execution_authority).toBe("APPROVED_EXPO");expect(result.evaluation_phase).toBe("FINAL");expect(result.domain_scores).toHaveLength(6);
      expect(result.finalization_boundary?.authority).toBe("TRUSTED_EXPO_FINALIZATION");
      expect(d.data.packet.curriculum_status).toBe("CURRICULUM_SOURCE_PENDING");expect(d.data.packet.clinical_evidence).toHaveLength(0);
      expect(JSON.stringify(f.raw())).toBe(before);
      expect(AssessmentResultSchema.safeParse({...result,execution_authority:"REVIEW_ONLY"}).success).toBe(false);
      expect(AssessmentResultSchema.safeParse({...result,finalization_boundary:{...result.finalization_boundary,authority:"TRUSTED_SESSION_FINALIZATION"}}).success).toBe(false);
      expect((await f.response("/state",undefined,"other-learner")).status).toBe(404);
    });
    it(`${patient}: Faculty reports approval provenance without granting any approval write`,async()=>{
      const a=await prepareApprovedExpoCase(patient,hash),v=projectFacultyExpo(a);
      expect(v.medical_approval?.medical_review_status).toBe("APPROVED_FOR_EXPO");expect(v.execution_authority).toBe("APPROVED_EXPO");
      const member={membership_id:"membership.test",institution_id:"institution.test",role:"FACULTY"} as const,store=createFacultyDemoStore(v,member.institution_id);
      expect(store.update(member,v.identity.case_id,{expected_revision:0,metadata:v.metadata})).toEqual({success:false,code:"READ_ONLY"});
      expect(store.create(member,{...v.metadata,medical_approval:a.medical_approval}).success).toBe(false);
      expect(store.list({...member,role:"LEARNER"}).success).toBe(false);
    });
    it(`${patient}: cached integrity cannot bless later changed content`,async()=>{
      const f=await wp1Fixture(patient,"wp2-approved");
      expect((await f.response("/state")).status).toBe(200);
      f.artifact.source_case.localization.entries[0]!.translations[0]!.text+=" tampered";
      const rejected=await f.response("/state");
      expect(rejected.status).toBe(404);
      expect((await rejected.json()).error.code).toBe("RESOURCE_NOT_ACCESSIBLE");
    });
    it(`${patient}: approved report does not approve or release withheld diagnostic images`,async()=>{
      const f=await wp1Fixture(patient,"wp2-approved");
      expect((await f.action("concept.expo.ecg")).response.status).toBe(200);
      f.elapsed(1000);
      await f.state();
      const id=patient==="khalid"?"diagnostic-result.stemi.ecg-standard":"diagnostic-result.dana.ecg";
      const r=await f.response(`/investigations/${id}`),b=await r.json();
      expect(r.status,JSON.stringify(b)).toBe(200);
      expect(b.data.component_status.structured_result).toBe("AVAILABLE");
      expect(b.data.structured_result).toBeDefined();
      expect(b.data.component_status.media).toBe("WITHHELD");
      expect(b.data.media_assets??[]).toHaveLength(0);
    });
  }
  it("legacy review Sessions stay review-only and browser approval fields are rejected",async()=>{
    const f=await wp1Fixture("dana","wp2-author-complete"),s=await f.state();
    expect(s.pinned_case.execution_authority).toBe("REVIEW_ONLY");
    expect((await f.response("/end",{expected_state_version:s.state_version,reason:"LEARNER_COMPLETED"})).status).toBe(422);
    expect(StartSessionRequestSchema.safeParse({...startBody(f.artifact.source_case.manifest.case_id),owner_attested:true}).success).toBe(false);
    expect(SubmitClinicalActionRequestSchema.safeParse({action_id:"examination.observe.bp",parameters:{},medical_review_status:"APPROVED"}).success).toBe(false);
  });
});
