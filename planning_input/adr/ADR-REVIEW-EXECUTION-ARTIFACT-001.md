# ADR-REVIEW-EXECUTION-ARTIFACT-001

## Review-Only Executable Case Artifact

Status: ACCEPTED

## Context

V2-009 preparation exposed a governance gap: specialist review and deterministic golden traces require an exact executable Case artifact, but the production runtime accepts only a published package. Fabricating an approved Clinical Review, Approval Record, or `PUBLISHED` lifecycle state to obtain that artifact would defeat the publication controls clarified by ADR-CASE-PUBLICATION-001.

## Decision

1. An eligible `UNDER_REVIEW` Case may produce a dedicated immutable `ReviewExecutionArtifact` for trusted review execution.
2. The artifact carries explicit `REVIEW_ONLY` execution authority and is structurally distinct from `CompiledCasePackage` and the publication candidate.
3. Artifact preparation is pure: it does not mutate lifecycle, persist data, fabricate reviewer identity, create an Approval Record, or publish anything.
4. `review_execution_hash` deterministically binds the artifact kind/version, review authority, exact source Case identity/version/lifecycle, all 16 exact modules, their module hashes, and `review_subject_hash`. The hash field itself is excluded from its own input.
5. Preparation fails closed on strict schema/reference errors, unsupported runtime semantics, Rule Reachability or Scheduler liveness failures, stale/missing technical evidence, reachable observation-coverage gaps, and unsupported diagnostic execution. Human Clinical, curriculum, visual, and media approval are not prerequisites for review execution.
6. Clinical Review remains pending and is not implied by technical executability. `review_subject_hash` continues to identify reviewable authored content; `review_execution_hash` identifies the exact executable review snapshot.
7. Clinical, Session, and Assessment packages use separate review-pinning constructors. Review contexts preserve `REVIEW_ONLY` and the exact review hash; production constructors continue to accept only published production artifacts.
8. A review artifact is excluded from production catalogue/playability contracts and cannot gain production authority through a runtime flag or sidecar.
9. Any specialist-relevant Case edit produces a new module/review/artifact hash as applicable. Review of artifact A does not approve artifact B.
10. The artifact is derived from the existing 16 modules; it is not a seventeenth authored Case module.
11. Future Faculty/specialist review records may bind the exposed `review_subject_hash` and/or `review_execution_hash`. This decision creates no reviewer or approval record.
12. V2-009 content remains `UNDER_REVIEW`; this gate authors no medical content.

## Consequences

- Review harnesses and future specialist preview can execute and score one exact Case snapshot without weakening publication.
- Published-package lifecycle, Clinical Review, exact-package Approval, and package-hash requirements remain unchanged.
- Review and production execution authority remain explicit, auditable, and non-interchangeable.
- The same portable Clinical, Session, and Assessment semantics can operate on separately pinned review authority without policy or action sidecars.

## Architecture Relationship

This supplemental implementation-era decision resolves the review-execution gap while preserving the frozen Logical and Physical Architecture. It is compatible with ADR-CASE-PUBLICATION-001, ADR-OBSERVATION-POLICY-001, ADR-RULE-EFFECT-LANGUAGE-001, ADR-CLINICAL-TIME-ADVANCEMENT-001, and ADR-DIAGNOSTIC-INVESTIGATION-CONTRACT-001. It does not change Clinical Engine truth ownership, Session orchestration, Assessment determinism, the 16-module Case model, or any production publication invariant.
