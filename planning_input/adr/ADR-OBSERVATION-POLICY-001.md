# ADR-OBSERVATION-POLICY-001

## Case-Owned Deterministic Observation Projection Policy

Status: **ACCEPTED**

## Context

The initial V2-004 implementation placed `ObservationProjectionDefinition` only in the Clinical Engine package and runtime test fixtures. That left policy controlling displayed vitals and waveform descriptors outside the compiled, reviewed, version-pinned Case Package.

## Decision

1. Observation projection policy is reviewed Case content.
2. Portable observation data contracts live in the shared contracts package.
3. Clinical Engine owns deterministic projection behavior, not observation contract authority.
4. A Case Package stores its projection definition inline in the existing `initial_state` module as `observation_projection`.
5. No seventeenth Case module is added.
6. An incomplete Draft may temporarily omit `observation_projection`.
7. Publication candidate preparation and final publication may not omit it.
8. Observation policy is covered by the normal `initial_state` module hash, review-subject hash, candidate-package hash, and final package hash.
9. Changing displayed clinical observation policy invalidates the previous review and package hashes.
10. Published runtime processing must consume the policy from the pinned Case Package and must not inject an unreviewed sidecar policy.
11. The currently supported observation projection schema version is exactly `1.0`.
12. Reusable or externally referenced observation profiles require a separate versioned architecture decision and are not implemented now.
13. Current publication validation proves projection coverage for the authored initial Patient State. Once V2-005 defines reachable transition/effect semantics, Rule Reachability and publication validation must also prove coverage for every reachable observation-driving state code.
14. Patient State remains authoritative; observations remain deterministic downstream projections and cannot alter clinical truth.

## Consequences

- Observation policy is reviewable, deterministic, hash-bound, and session-pinned with the Case Package.
- Clinical Engine remains disease-neutral and contains no hidden vital defaults.
- Incomplete Draft authoring remains possible, while publication fails closed without a complete initial-state projection policy.
- No runtime sidecar, observations database, media generation dependency, or additional Case module is introduced.

## Architecture Relationship

This ADR clarifies the existing frozen principles that Case Packages own deterministic clinical policy, Patient State owns clinical truth, and vitals/waveforms are downstream projections. It does not change Clinical Engine truth ownership, implement transitions or effects, or alter any publication lifecycle and approval boundary established by `ADR-CASE-PUBLICATION-001`.
