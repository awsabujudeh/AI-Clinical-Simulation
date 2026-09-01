import { describe, expect, it } from "vitest";

import {
  computeReviewSubjectHash,
  createPinnedClinicalPolicy,
  preparePublicationCandidate
} from "../../../packages/case-schema/src/index.ts";
import {
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createCandidateReadyUnderReviewCase
} from "../../fixtures/cases/synthetic-case.ts";

describe("Case-owned interrupt classification pinning", () => {
  it("changes normal review/module/candidate hashes and is extracted into pinned policy", async () => {
    const baseline = await createCandidateReadyUnderReviewCase();
    const changed = structuredClone(baseline);
    changed.timeline_policy.interrupting_event_types = ["CRITICAL_EVENT_OCCURRED"];
    await bindSyntheticReviewAndReachabilityEvidence(changed);

    const baselineCandidate = await preparePublicationCandidate(baseline, TEST_HASH_ADAPTER);
    const changedCandidate = await preparePublicationCandidate(changed, TEST_HASH_ADAPTER);
    expect(baselineCandidate.success).toBe(true);
    expect(changedCandidate.success).toBe(true);
    if (!baselineCandidate.success || !changedCandidate.success) return;

    expect(changedCandidate.candidate.package.manifest.module_hashes.timeline_policy).not.toBe(
      baselineCandidate.candidate.package.manifest.module_hashes.timeline_policy
    );
    expect(await computeReviewSubjectHash(changed, TEST_HASH_ADAPTER)).not.toBe(
      await computeReviewSubjectHash(baseline, TEST_HASH_ADAPTER)
    );
    expect(changedCandidate.candidate.candidate_package_hash).not.toBe(
      baselineCandidate.candidate.candidate_package_hash
    );

    const pinnedPolicy = createPinnedClinicalPolicy(changedCandidate.candidate.package);
    expect(pinnedPolicy.timeline_policy.interrupting_event_types).toEqual([
      "CRITICAL_EVENT_OCCURRED"
    ]);
    expect(pinnedPolicy.timeline_policy.time_ratio).toBe(1);
    expect(pinnedPolicy.timeline_policy.pause_policy).toBe("PAUSE_CLINICAL_TIME");
  });
});
