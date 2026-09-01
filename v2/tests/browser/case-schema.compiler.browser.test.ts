import { describe, expect, test } from "vitest";

import { CaseControlledValueSchema } from "../../packages/contracts/src/index.ts";

import {
  CASE_MODULE_NAMES,
  DraftCasePackageSchema,
  canonicalSerialize,
  compileCasePackage,
  computeModuleHashes,
  computeReviewSubjectHash,
  hashCanonicalJson,
  preparePublicationCandidate
} from "../../packages/case-schema/src/index.ts";
import {
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createCandidateReadyUnderReviewCase,
  createFinalPublicationFixture,
  createPublicationApprovalRecord,
  reverseObjectKeyInsertionOrder
} from "../fixtures/cases/synthetic-case.ts";
import type { DraftCasePackage } from "../../packages/case-schema/src/index.ts";

describe("deterministic Case Package compilation", () => {
  test("sorts object keys recursively while preserving array order and rejecting non-JSON", () => {
    expect(canonicalSerialize({ z: 3, a: { z: 2, a: 1 }, items: [2, 1] })).toBe(
      '{"a":{"a":1,"z":2},"items":[2,1],"z":3}'
    );
    expect(() => canonicalSerialize({ invalid: undefined })).toThrow();
    expect(() => canonicalSerialize(new Date("2026-01-01T00:00:00Z"))).toThrow();
  });

  test("produces stable module hashes and a package hash excluding package_hash itself", async () => {
    const fixture = await createFinalPublicationFixture();
    const first = await compileCasePackage(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );
    const second = await compileCasePackage(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    expect(Object.keys(first.package.manifest.module_hashes).sort()).toEqual(
      [...CASE_MODULE_NAMES].sort()
    );
    expect(second.package.manifest.module_hashes).toEqual(first.package.manifest.module_hashes);
    expect(second.package.package_hash).toBe(first.package.package_hash);

    const { package_hash: _excluded, ...packageHashInput } = first.package;
    expect(await hashCanonicalJson(packageHashInput, TEST_HASH_ADAPTER)).toBe(
      first.package.package_hash
    );
  });

  test("normalizes source lifecycle to the same exact PUBLISHED candidate", async () => {
    const fixture = await createFinalPublicationFixture();
    const underReviewCandidate = await preparePublicationCandidate(
      fixture.underReview,
      TEST_HASH_ADAPTER
    );
    const approvedCandidate = await preparePublicationCandidate(
      fixture.approved,
      TEST_HASH_ADAPTER
    );

    expect(underReviewCandidate.success).toBe(true);
    expect(approvedCandidate.success).toBe(true);
    if (!underReviewCandidate.success || !approvedCandidate.success) return;
    expect(underReviewCandidate.candidate.candidate_package_hash).toBe(
      approvedCandidate.candidate.candidate_package_hash
    );
    expect(underReviewCandidate.candidate.package).toEqual(
      approvedCandidate.candidate.package
    );
    expect(fixture.underReview.manifest.status).toBe("UNDER_REVIEW");
    expect(fixture.approved.manifest.status).toBe("APPROVED");
    expect(approvedCandidate.candidate.package.manifest.status).toBe("PUBLISHED");
  });

  test("ignores object insertion order but changes hashes when final candidate content changes", async () => {
    const fixture = await createFinalPublicationFixture();
    const reordered = reverseObjectKeyInsertionOrder(fixture.approved);
    const originalCompilation = await compileCasePackage(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );
    const reorderedCompilation = await compileCasePackage(
      reordered,
      fixture.approval,
      TEST_HASH_ADAPTER
    );

    expect(originalCompilation.success).toBe(true);
    expect(reorderedCompilation.success).toBe(true);
    if (!originalCompilation.success || !reorderedCompilation.success) return;
    expect(reorderedCompilation.package.package_hash).toBe(originalCompilation.package.package_hash);
    expect(reorderedCompilation.package.manifest.module_hashes).toEqual(
      originalCompilation.package.manifest.module_hashes
    );

    const changed = DraftCasePackageSchema.parse(
      JSON.parse(JSON.stringify(fixture.approved))
    );
    changed.localization.entries[0]!.translations[0]!.text = "Changed synthetic fixture text";
    const updatedReviewHash = await computeReviewSubjectHash(changed, TEST_HASH_ADAPTER);
    for (const review of changed.validation.reviews) {
      review.reviewed_content_hash = updatedReviewHash;
    }
    await bindSyntheticReviewAndReachabilityEvidence(changed);
    const changedCandidate = await preparePublicationCandidate(changed, TEST_HASH_ADAPTER);

    expect(changedCandidate.success).toBe(true);
    if (!changedCandidate.success) return;
    const changedApproval = createPublicationApprovalRecord(
      changed,
      changedCandidate.candidate.candidate_package_hash
    );
    const changedCompilation = await compileCasePackage(
      changed,
      changedApproval,
      TEST_HASH_ADAPTER
    );

    expect(changedCompilation.success).toBe(true);
    if (!changedCompilation.success) return;
    expect(changedCompilation.package.manifest.module_hashes.localization).not.toBe(
      originalCompilation.package.manifest.module_hashes.localization
    );
    expect(changedCompilation.package.package_hash).not.toBe(
      originalCompilation.package.package_hash
    );
  });

  test("hashes final manifest content while keeping Clinical Review focused on authored content", async () => {
    const fixture = await createFinalPublicationFixture();
    const baseline = await preparePublicationCandidate(fixture.underReview, TEST_HASH_ADAPTER);
    const manifestChanged = DraftCasePackageSchema.parse(
      JSON.parse(JSON.stringify(fixture.underReview))
    );
    manifestChanged.manifest.extensions = {
      "fixture.publication-note": { revision: 2 }
    };
    const changed = await preparePublicationCandidate(manifestChanged, TEST_HASH_ADAPTER);

    expect(baseline.success).toBe(true);
    expect(changed.success).toBe(true);
    if (!baseline.success || !changed.success) return;
    expect(changed.candidate.candidate_package_hash).not.toBe(
      baseline.candidate.candidate_package_hash
    );
    expect(changed.candidate.package.manifest.module_hashes.manifest).not.toBe(
      baseline.candidate.package.manifest.module_hashes.manifest
    );
    expect(await computeReviewSubjectHash(manifestChanged, TEST_HASH_ADAPTER)).toBe(
      await computeReviewSubjectHash(fixture.underReview, TEST_HASH_ADAPTER)
    );
  });

  test.each([
    [
      "numeric observation mapping",
      (casePackage: DraftCasePackage) => {
        const stateCode = casePackage.initial_state.patient_state.hemodynamic_state;
        casePackage.initial_state.observation_projection!.hemodynamic_mappings[
          stateCode
        ]!.heart_rate_bpm = 71;
      }
    ],
    [
      "rhythm waveform descriptor",
      (casePackage: DraftCasePackage) => {
        const rhythmCode = casePackage.initial_state.patient_state.cardiac_rhythm;
        casePackage.initial_state.observation_projection!.rhythm_mappings[
          rhythmCode
        ]!.waveform_descriptor = CaseControlledValueSchema.parse(
          "waveform.synthetic-neutral-revised"
        );
      }
    ]
  ] as const)("binds %s changes to review, module, and candidate hashes", async (_label, mutate) => {
    const baseline = await createCandidateReadyUnderReviewCase();
    const baselineReviewHash = await computeReviewSubjectHash(baseline, TEST_HASH_ADAPTER);
    const baselineModuleHashes = await computeModuleHashes(baseline, TEST_HASH_ADAPTER);
    const baselineCandidate = await preparePublicationCandidate(baseline, TEST_HASH_ADAPTER);
    const changed = DraftCasePackageSchema.parse(JSON.parse(JSON.stringify(baseline)));
    mutate(changed);

    const staleReviewCandidate = await preparePublicationCandidate(changed, TEST_HASH_ADAPTER);
    expect(staleReviewCandidate.success).toBe(false);
    expect(staleReviewCandidate.report.issues.map((item) => item.code)).toContain(
      "REVIEW_CONTENT_HASH_MISMATCH"
    );

    const changedReviewHash = await computeReviewSubjectHash(changed, TEST_HASH_ADAPTER);
    const changedModuleHashes = await computeModuleHashes(changed, TEST_HASH_ADAPTER);
    await bindSyntheticReviewAndReachabilityEvidence(changed);
    const changedCandidate = await preparePublicationCandidate(changed, TEST_HASH_ADAPTER);

    expect(baselineCandidate.success).toBe(true);
    expect(changedCandidate.success).toBe(true);
    if (!baselineCandidate.success || !changedCandidate.success) return;
    expect(changedModuleHashes.initial_state).not.toBe(baselineModuleHashes.initial_state);
    expect(changedReviewHash).not.toBe(baselineReviewHash);
    expect(changedCandidate.candidate.candidate_package_hash).not.toBe(
      baselineCandidate.candidate.candidate_package_hash
    );
  });
});
