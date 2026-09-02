# ADR-DIAGNOSTIC-INVESTIGATION-CONTRACT-001

## Case-Owned Diagnostic Investigation Contract

Status: **ACCEPTED**

## Context

V2-008 identified that V1 diagnostic investigations were not a safe source for direct migration: result structures, independent Clinical-Time availability, media governance, learner visibility, and deterministic non-media fallback were not yet represented as one reviewed Case-owned contract. V2-009 must not author real clinical values until that boundary is fixed.

## Decision

1. The existing sixteen-module Case Package remains unchanged. An `INVESTIGATION` definition belongs to its stable action in `action_catalogue`; language-neutral diagnostic findings remain stable references into `clinical_facts`; governed assets remain in `visual_manifest`; and the existing rule/timeline model remains the scheduling authority.
2. The shared contracts package owns one strict, portable, versioned diagnostic data authority. It discriminates `STRUCTURED_LAB`, `ECG`, `IMAGING`, `ULTRASOUND`, and `TEXT_REPORT` results without executable content or disease logic.
3. Case-authored diagnostic truth and diagnostic media are distinct. Assets represent reviewed truth but do not define it. Media-bearing results require Case-owned non-media fallback facts, so media failure never requires inference, computer vision, regeneration, or a provider call.
4. Diagnostic availability uses relative Simulation Clinical-Time milestones: `ORDERED`, optional `PERFORMED`, required `RESULT_AVAILABLE`, and component-specific `IMAGE_AVAILABLE` and `FORMAL_REPORT_AVAILABLE`. Image and formal-report availability remain separate. The generic V2-005 scheduler can represent each positive relative milestone independently; V2-006 remains the authority for Clinical-Time orchestration.
5. `ASYNC_PARALLEL` is the supported publication execution mode. Independent investigations retain independent schedules and are never summed into a global duration. `BLOCKING_PATIENT_UNAVAILABLE` may be represented in an incomplete Draft but fails publication until explicitly supported by Session orchestration.
6. Learner visibility is reviewed Case policy per structured result, media, machine interpretation, and formal report. It is diagnostic-content disclosure, separate from V2-007 Assessment correctness disclosure, and cannot be overridden by a runtime/client sidecar.
7. Diagnostic asset governance binds stable asset identity, semantic asset version, content hash, modality/media role, approved provenance, usage-rights reference, and approved Clinical Review reference. Publication fails closed when mandatory governance is absent, unresolved, stale, mismatched, or dangling.
8. Formal reports and findings are deterministic Case-authored content using existing localization keys. Patient-language identifiers remain exactly `ar-JO` and `en-US`.
9. Investigation definitions, results, timing, visibility, reports, asset references, fallbacks, and asset governance participate in normal module, review-subject, candidate, and package hashing. A pinned runtime receives them only through the exact compiled Case Package.
10. V2-007 continues to score authoritative committed investigation actions by stable `ActionId`, event sequence, and Clinical Time; UI intent or media-load success is not scoring evidence.
11. Runtime AI may not generate authoritative diagnostic findings or reports. A future Case Builder may propose Draft content only; publication still requires the normal source, review, validation, and exact-hash approval gates.
12. This gate authorizes no real STEMI values, interpretations, reports, turnaround times, assets, or clinical approval.

## Consequences

- V2-009 can author diagnostic content without adding a seventeenth module or a mutable diagnostic sidecar.
- Clinical truth survives media failure, while asset reuse remains versioned, rights-aware, clinically reviewed, and auditable.
- Existing Clinical Engine disease neutrality, generic scheduler behavior, Session Clinical-Time authority, and Assessment evidence authority remain intact.
- Investigation UI, viewers, storage, APIs, databases, real media, and clinical authoring remain outside this decision.

## Architecture Relationship

This ADR clarifies the frozen principles that immutable Case Packages own reviewed clinical policy and content, Clinical Time—not wall time—governs simulation behavior, media is a presentation dependency with mandatory fallback, and publication fails closed. It does not change the sixteen module boundaries or transfer medical truth, scheduling, session orchestration, assessment, persistence, AI, or UI ownership.
