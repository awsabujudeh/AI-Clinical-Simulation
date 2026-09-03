# V2-010 STEMI Functional Parity Summary

Status: **CLEAN — FUNCTIONAL PARITY, NOT CLINICAL APPROVAL**

V2-010 reconciles the complete 346-row V2-008 extraction against the approved V2-009 `UNDER_REVIEW` / `REVIEW_ONLY` Case and the deterministic V2 execution path. It does not clone V1, change medical content, or claim that later UI, AI, media, API, reliability, or publication work is complete.

## Final accounting

| Disposition | Count |
|---|---:|
| PRESERVED | 47 |
| INTENTIONALLY_REPLACED | 65 |
| INTENTIONALLY_REMOVED | 134 |
| SUPERSEDED_BY_V2 | 85 |
| PARITY_READY_DELIVERY_PENDING | 15 |
| FUNCTIONAL_GAP | 0 |
| **Total** | **346** |

The item-level ledger in `STEMI_V1_V2_FUNCTIONAL_PARITY_MATRIX.md` contains each V2-008 trace ID exactly once. `v2/scripts/v2-010-parity-audit.mjs` verifies the source inventory and ledger are both unique and exactly equal.

## Preserved or strengthened capabilities

- Structured bilingual presentation, history, examination, contraindication, social, and family facts.
- Explicit Patient State with deterministic observations and explicit rhythm ownership.
- Standard and right-sided ECGs, laboratory panels, troponin, chest radiograph, focused echo, independent Clinical-Time milestones, structured result truth, and static fallbacks.
- Case-owned actions for examination, monitoring, IV access, selected medications, fluid/oxygen support, Cath Lab activation, diagnosis, and disposition.
- T=10 deterioration, T=18 shock evolution, nitrate harm, bounded fluid support, state-dependent oxygen, and the explicit absence of automatic arrest or routine VT/VF.
- Six-domain deterministic assessment based on committed Session evidence, including Clinical-Time windows, penalties, unsafe findings, and debrief-ready evidence structures.

## Intentional replacements and removals

V2 replaces mutable browser state, direct vital writes, HR-derived rhythm, browser timers, synchronous diagnostics, click-count scoring, AI-to-button execution, and instant Cath/medication cure behavior with pinned Case policy, Clinical Time, the Scheduler, explicit state transitions, authoritative events, and deterministic assessment.

V2 intentionally removes low-value examination click-list entries, diagnostic and medication decoys, unsafe or unsupported clinical branches, dead UI artifacts, provider-coupled client behavior, and hidden execution paths. The matrix records a reason for every removal; none is used to conceal a missing function.

## End-to-end journey

| V1 journey stage | V2 parity path | Result |
|---|---|---|
| Presentation | Case profile, presentation, localization, initial Patient State | Preserved/replaced with reviewed structured data |
| History and free-text questions | Clinical facts plus disclosure and dialogue policy | Truth ready; Patient Agent/UI delivery pending |
| Examination | Stable examination facts and Case-owned examination actions | Preserved without click-list scoring |
| Investigations | Pinned diagnostic action contracts, independent milestones, structured results and fallbacks | Preserved/strengthened |
| Medications/actions | ActionRequest → Session validation → Clinical Engine → committed event | Intent/execution separation strengthened |
| Vitals and deterioration | Patient State → observation projection; Clinical-Time rules and scheduler | Superseded by deterministic architecture |
| Diagnosis and disposition | Pinned diagnosis/disposition actions and committed evidence | Preserved; endpoint corrected to PPCI preparation and transfer |
| Scoring | Committed event evidence → six-domain Assessment Engine | Replaced with deterministic evidence scoring |
| Final feedback | Deterministic assessment/debrief evidence | Domain parity ready; learner prose/UI later |

No meaningful stage disappears without an explicit disposition.

## Delivery and governance boundary

Domain parity is ready where final delivery is intentionally later: Patient Agent and free-text UI, Student UI/monitor rendering, approved diagnostic/visual assets, synthesized debrief prose, secure AI Gateway, persistent API/recovery, and production publication. These are not V2-010 functional gaps.

All 18 V2-009 specialist-review decisions remain pending. Sources, curriculum mappings, diagnostic-media provenance, Clinical Review, exact-package Approval, and publication remain unresolved. The Case remains `UNDER_REVIEW`; execution remains `REVIEW_ONLY`.
