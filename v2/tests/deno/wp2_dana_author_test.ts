import { prepareCurrentCompleteExpoCase } from "../../content/cases/shared-catalogue/dana-history-exam.ts";
import { buildPatientConversationContext } from "../../packages/patient-conversation/src/index.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "../fixtures/portable-sha256.ts";
import { wp1Fixture } from "../fixtures/wp1.ts";

Deno.test("Dana 1.4.0 author decision has exact portable hash and patient-only history", async () => {
  const a=await prepareCurrentCompleteExpoCase("dana",hash);
  if(a.review_execution_hash!=="f468a31839af399b02b401aa5dde002d7ffc90d5da34026e3a8bb559a4084926")throw Error("DANA_AUTHOR_HASH_DRIFT");
  const f=await wp1Fixture("dana","wp2-author-complete");
  for(const locale of ["ar-JO","en-US"]) {
    const result=buildPatientConversationContext({case_package:a.source_case,patient_state:f.raw().patient_state,locale,history:[]});
    if(!result.success)throw Error("DANA_CONTEXT_INVALID");
    if(result.context.facts.filter(f=>f.fact_id.startsWith("fact.dana.author.history.")).length!==18)throw Error("HISTORY_MISSING");
    if(result.context.facts.some(f=>f.fact_id.startsWith("fact.dana.author.exam.")))throw Error("EXAM_LEAK");
  }
  const s=await f.state();
  if(s.pinned_case.case_version!=="1.4.0"||s.visual_patient?.asset_id!=="dana.review-v01"||s.observations.acquired.length!==0)throw Error("REVIEW_BINDING_DRIFT");
});
