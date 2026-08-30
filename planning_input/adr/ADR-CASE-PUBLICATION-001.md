# ADR-CASE-PUBLICATION-001

## Publication Candidate, Review Hash, and Exact Package Approval

Status: ACCEPTED

## Context

V2-003 implementation exposed a lifecycle circularity if a source Case Version had to be `PUBLISHED` before the exact immutable artifact and hash required to authorize publication could be computed. This decision clarifies the pre-publication compilation and governance boundary without reopening or replacing either frozen Architecture document.

## Decision

1. The authoring/source Case Version lifecycle and immutable published Case Package lifecycle are distinct concepts.
2. A pure, deterministic Publication Candidate may be prepared from an eligible `UNDER_REVIEW` source after all required readiness, review, and evidence gates pass.
3. Candidate preparation does not publish, persist, or mutate lifecycle state. It projects the exact would-be immutable artifact with target package lifecycle `PUBLISHED`.
4. The identical candidate must be reproducible from the corresponding `APPROVED` source when package content and evidence have not changed.
5. Clinical Review binds `review_subject_hash`, which identifies the exact authored content subject to clinical review.
6. Final exact-package Approval binds `candidate_package_hash`, which identifies the exact would-be immutable published artifact.
7. `review_subject_hash` and `candidate_package_hash` have different responsibilities and must not be conflated.
8. Exact Package Approval is external governance evidence. It is excluded from the candidate bytes used to calculate the same `candidate_package_hash`, preventing hash self-reference.
9. Final publication requires an `APPROVED` source Case Version, valid Clinical Review, matching exact-package Approval and approved candidate hash, Technical validation, Visual fallback coverage, resolved source and curriculum requirements, and all mandatory publication-validation evidence.
10. Mandatory Rule Reachability validation is fail-closed. Missing, deferred, failed, unresolved, incomplete, or stale evidence blocks candidate readiness and final publication.
11. V2-003 does not implement lifecycle persistence, `approveCase` or `publishCase` APIs, roles or authentication, the Clinical Engine, or Rule Reachability analysis itself.

## Consequences

- Publication artifact hashing no longer depends on a prior `PUBLISHED` source lifecycle state.
- Candidate and package hashing contain no package-hash self-reference.
- Changes to clinically reviewed authored content invalidate the existing Clinical Review.
- Changes to any content in the final candidate artifact invalidate the existing exact-package Approval.
- Publication remains deterministic, fail-closed, and auditable.
- Future database and API implementations must preserve the separation between source lifecycle, candidate compilation, external exact-package approval, and immutable package persistence.

## Architecture Relationship

This ADR is a supplemental authoritative implementation-era decision that clarifies existing frozen principles for exact-hash approval, immutable Case Packages, review/version binding, and fail-closed publication. It does not reopen or replace the Logical Architecture or Physical Architecture, and it does not change Clinical Engine ownership or any other frozen architectural invariant.
