import {
  DiagnosticResultSchema,
  InvestigationDefinitionSchema
} from "../../../packages/contracts/src/index.ts";
import {
  preparePublicationCandidate,
  validateForPublicationCandidate
} from "../../../packages/case-schema/src/index.ts";
import { createPinnedSessionCaseContext } from "../../../packages/session-engine/src/index.ts";

import { TEST_HASH_ADAPTER } from "./synthetic-case.ts";
import { createDiagnosticCandidateReadyCase } from "./synthetic-diagnostic-case.ts";

export async function createDiagnosticPortabilitySnapshot() {
  const casePackage = await createDiagnosticCandidateReadyCase();
  const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
  const prepared = await preparePublicationCandidate(casePackage, TEST_HASH_ADAPTER);
  if (!prepared.success) {
    throw new Error("Synthetic diagnostic portability Case did not prepare.");
  }
  const pinned = createPinnedSessionCaseContext(prepared.candidate.package);
  if (!pinned.success) {
    throw new Error("Synthetic diagnostic portability Case did not pin.");
  }

  const investigations = casePackage.action_catalogue.actions.flatMap((action) =>
    action.investigation === undefined
      ? []
      : [InvestigationDefinitionSchema.parse(action.investigation)]
  );
  const results = investigations.map((definition) =>
    DiagnosticResultSchema.parse(definition.result)
  );

  return {
    report,
    result_types: results.map((result) => result.result_type),
    result_offsets: investigations.map((definition) =>
      definition.milestones.find((entry) => entry.milestone_type === "RESULT_AVAILABLE")
        ?.offset_clinical_seconds
    ),
    ecg_availability: investigations[1]!.milestones.map((entry) => [
      entry.milestone_type,
      entry.offset_clinical_seconds
    ]),
    action_catalogue_hash: prepared.candidate.package.manifest.module_hashes.action_catalogue,
    clinical_facts_hash: prepared.candidate.package.manifest.module_hashes.clinical_facts,
    visual_manifest_hash: prepared.candidate.package.manifest.module_hashes.visual_manifest,
    review_subject_hash: casePackage.validation.reviews[0]!.reviewed_content_hash,
    candidate_package_hash: prepared.candidate.candidate_package_hash,
    pinned_result_types: pinned.context.action_catalogue.flatMap((action) =>
      action.investigation === undefined ? [] : [action.investigation.result.result_type]
    )
  };
}

export const DIAGNOSTIC_PORTABILITY_EXPECTED = '{"report":{"mode":"CANDIDATE","valid":true,"publishable":false,"issues":[]},"result_types":["STRUCTURED_LAB","ECG","IMAGING","ULTRASOUND","TEXT_REPORT"],"result_offsets":[7,3,9,15,6],"ecg_availability":[["ORDERED",0],["PERFORMED",1],["IMAGE_AVAILABLE",2],["RESULT_AVAILABLE",3],["FORMAL_REPORT_AVAILABLE",5]],"action_catalogue_hash":"ad985a5e2e9f4ebebdc58932ac41a6a272101476305e90861e1df5d26432e5f2","clinical_facts_hash":"a823fcdbba599f9cbaefc32d585bb60638da58df188a2c28a1b61cb179ac9372","visual_manifest_hash":"0fa69a95626d30c1f8d6f031ce3d1f6d417d6135fa110ca95151eec98b61902d","review_subject_hash":"b4f741ef584265cf56633e47a0b0562fd34019175d72d72f3eb0fbbfb7e9c49f","candidate_package_hash":"4baab4fc5ebb06bc260c3330f3ddb2a0bf4536f47e36b76cfbbcff50e50da858","pinned_result_types":["STRUCTURED_LAB","ECG","IMAGING","ULTRASOUND","TEXT_REPORT"]}';
