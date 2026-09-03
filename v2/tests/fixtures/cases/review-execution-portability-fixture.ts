import {
  createPinnedReviewClinicalPolicy,
  prepareReviewExecutionArtifact
} from "../../../packages/case-schema/src/index.ts";
import { createPinnedReviewSessionCaseContext } from "../../../packages/session-engine/src/index.ts";
import { createPinnedReviewAssessmentContext } from "../../../packages/assessment-engine/src/index.ts";

import {
  TEST_HASH_ADAPTER,
  createReviewExecutableUnderReviewCase
} from "./synthetic-case.ts";

export async function createReviewExecutionPortabilitySnapshot(): Promise<string> {
  const source = await createReviewExecutableUnderReviewCase();
  const prepared = await prepareReviewExecutionArtifact(source, TEST_HASH_ADAPTER);
  if (!prepared.success) throw new Error("Review artifact portability fixture failed.");
  const policy = createPinnedReviewClinicalPolicy(prepared.artifact);
  const session = createPinnedReviewSessionCaseContext(prepared.artifact);
  const assessment = createPinnedReviewAssessmentContext(prepared.artifact);
  if (!session.success || !assessment.success) {
    throw new Error("Review artifact pinning portability fixture failed.");
  }
  return [
    prepared.artifact.execution_authority,
    prepared.artifact.review_execution_hash,
    prepared.artifact.review_subject_hash,
    prepared.artifact.module_hashes.initial_state,
    prepared.artifact.module_hashes.rules,
    prepared.artifact.module_hashes.validation,
    policy.execution_authority,
    session.context.execution_authority,
    assessment.context.execution_authority
  ].join("|");
}

export const REVIEW_EXECUTION_PORTABILITY_EXPECTED = "REVIEW_ONLY|75f4ea3b3a1cec3e6c7dfac9e2e3ceb483854207a5ccec3a831f062522e919e0|34a96a7d32599914ac5b51b7760d3eeed84dbc29d8e9ee00c30c9b6302f70e3a|870732bc9d2e0981ee7f817667768c33ccf5fd786e3dc5ed26320152567f09bf|3483f4c6bcf7010506236da46c0d508b17c4e9fa6d67c3f1f96312e88f5e58d7|aa04849f3b1e3b20da5cc64deb4232fed54560039b392d0400e219512201c9f2|REVIEW_ONLY|REVIEW_ONLY|REVIEW_ONLY";
