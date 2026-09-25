import { prepareApprovedExpoCase, EXPO_MEDICAL_APPROVAL_BINDINGS } from "../../content/cases/shared-catalogue/approved-expo-cases.ts";
import { verifyExpoExecution, validateForPublication } from "../../packages/case-schema/src/index.ts";
import { AssessmentResultSchema } from "../../packages/contracts/src/index.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "../fixtures/portable-sha256.ts";
import { wp1Fixture } from "../fixtures/wp1.ts";

for (const patient of ["khalid", "dana"] as const) {
  Deno.test(`${patient}: approved Expo hash and final assessment are portable, not publication`, async () => {
    const a=await prepareApprovedExpoCase(patient,hash);
    if(!await verifyExpoExecution(a,hash)||a.review_execution_hash!==EXPO_MEDICAL_APPROVAL_BINDINGS[patient].execution)throw Error("EXPO_INTEGRITY_FAILED");
    if((await validateForPublication(a.source_case,undefined,hash)).valid)throw Error("PUBLICATION_BYPASS");
    if("reviewed_at_utc" in a.medical_approval!||a.medical_approval?.reviewer_identity_status!=="NOT_FORMALLY_RECORDED")throw Error("FABRICATED_REVIEW_METADATA");
    const f=await wp1Fixture(patient,"wp2-approved");
    if((await f.action("concept.expo.bp")).response.status!==200)throw Error("WP1_REGRESSION");
    const s=await f.state();
    if(s.learner_action_catalogue.actions.length!==33||s.observations.acquired.length===0)throw Error("WP2_OR_OBSERVATION_REGRESSION");
    if((await f.response("/end",{expected_state_version:s.state_version,reason:"LEARNER_COMPLETED"})).status!==200)throw Error("EXPO_FINALIZATION_FAILED");
    const before=JSON.stringify(f.raw()),r=await f.response("/debriefs",{locale:"en-US"}),b=await r.json();
    if(r.status!==200)throw Error("EXPO_DEBRIEF_FAILED");
    const result=AssessmentResultSchema.parse(b.data.packet.assessment);
    if(result.evaluation_phase!=="FINAL"||result.finalization_boundary?.authority!=="TRUSTED_EXPO_FINALIZATION"||result.domain_scores.length!==6)throw Error("ASSESSMENT_AUTHORITY_FAILED");
    if(before!==JSON.stringify(f.raw()))throw Error("TUTOR_MUTATED_SESSION");
  });
}
