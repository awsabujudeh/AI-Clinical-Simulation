# Acute Inferior STEMI V1 Extraction Summary

Status: **DRAFT INVENTORY COMPLETE — NOT MEDICALLY APPROVED**

## Scope and source

- Primary source: protected `er_sim_10.html` at SHA-256 `2FE2732792EB1642909E53F42DB1A6455F9C72EF8088A0303F1E8857ECA2D512`.
- Context only: protected root `README.md` at SHA-256 `E1F5884A448E1CBD9125D1780A1236105D7E74DB2E3DD304F9A51F54857FCEE8`.
- V1 contains one in-file case: `stemi1`.
- No external service was called, no V1 file was changed, and no medical gap was filled from outside knowledge.

## Inventory counts

The detailed inventory contains **346 uniquely identified records**. Counts are based on record IDs in `STEMI_V1_STRUCTURED_INVENTORY.md`; every record has exactly one preliminary classification.

| Classification | Count | Meaning in this inventory |
|---|---:|---|
| KEEP | 90 | Candidate source material; still requires V2-009 review. |
| CORRECT | 32 | Concept/evidence should remain, but content or representation requires correction/normalization. |
| REPLACE | 90 | V1 representation/logic must not migrate as-is. |
| UNKNOWN_DISCUSS | 123 | Human clinical/product/content judgment is required. |
| DISCARD | 11 | V1-only UI/dead/technical artifact. |
| **Total** | **346** | No item is medically approved by this count. |

### Extracted catalogue totals

| Group | Count |
|---|---:|
| History/clinical facts | 48 facts across 10 complaint groups plus PMH/family/social history |
| V1 “required” history items | 20 |
| Examination groups | 6 organs, each exposing auscultation/inspection/palpation together |
| Investigations with authored results | 9 |
| Decoy/unnecessary investigation entries | 20 |
| Non-drug actions/fluids/procedures | 20 |
| Medications | 37 |
| Diagnosis choices | 10 |
| Disposition choices | 7 |
| Required-treatment IDs in V1 score | 7 |
| Dynamic-rule inventory records | 22 |
| Dedicated timing records | 20 |
| V1 scoring records | 18 |
| Open questions | 44 |

## Major clinical/content review concerns

1. V1 has no explicit rhythm or V2 Patient State dimensions; it derives rhythm, status, appearance, and sometimes GCS from numeric observations.
2. All 37 drugs lack dose/frequency/formulation and many display multi-route strings without route selection.
3. The patient reports daily aspirin while acute aspirin is required, with no prior dose/time/adherence context.
4. Oxygen is marked required and directly changes SpO₂; indication and effect are unreviewed.
5. Hard-coded deterioration, nitrate crisis, arrest, and three-flag recovery paths have no source/review evidence.
6. Investigation numbers, reference ranges, reports, delays, and decoy relevance/penalties are unreviewed.
7. ECG/CXR images have no provenance, license, or clinical review metadata; echo is text-only.
8. Diagnosis/disposition alternatives, critical-error labels, required actions, score weights, timing, and caps require clinical/assessment review.

## Major V1 architecture debt

- One HTML file owns case content, mutable state, UI, timers, medical logic, scoring, media, AI calls, and debrief.
- Browser `setInterval` and synchronous `jumpTime` own medical time; network delay can affect the state before an AI-parsed order executes.
- Vitals are mutated directly and then used to infer rhythm/state.
- AI order parsing can click execution buttons; local matching is permissive substring matching.
- Scoring uses mutable click sets/flags rather than committed, sequenced evidence.
- Investigations have no pending/asynchronous result boundary; time is skipped and the result appears immediately.
- Assets are inline Base64 without stable identity/provenance/review/fallback governance.
- There is no version pinning, immutable package, idempotency, event envelope, source governance, or publication gate.

## README-to-implementation discrepancies

- “Expandable case database” is currently one JavaScript object containing one case.
- “ECG simulation” combines a static embedded ECG investigation image with a synthetic header waveform inferred from HR/BP.
- “Medical imaging” is limited to embedded ECG/CXR JPEGs plus text-only echo.
- Voice is listed as future development; an unused `voice` object exists, but no voice/audio runtime exists.
- No medical-image generation exists in V1; assets are pre-embedded, consistent with not generating media in-platform.

## Diagnostic Investigation Contract Gate

Current V2 structural support across 13 requested capabilities:

| Status | Count | Summary |
|---|---:|---|
| SUPPORTED | 1 | Generic investigation order identity/event vocabulary. |
| PARTIAL | 9 | Duration, result event, diagnostic media/report linkage, provenance, fallback, and parallel scheduling have generic pieces but no complete investigation boundary. |
| MISSING | 3 | Structured laboratory result schema; independent image versus formal-report availability; explicit blocking/asynchronous completion mode. |
| UNCLEAR | 0 | The gaps are identifiable; their future design remains a review decision. |

V2-008 makes no schema extension. These findings feed the required contract gate before V2-009 investigation authoring.

## Migration readiness

- **Extraction readiness:** complete and traceable.
- **Medical approval readiness:** not attempted.
- **V2 Case Package readiness:** not ready; no Case Draft or publication artifact was created.
- **V2-009 inputs:** the detailed inventory, compact migration matrix, 44-question review queue, module crosswalk, and diagnostic-contract gap list are ready for human review.
- **Blocking decisions:** diagnostic contract, explicit initial state/rhythm, medication parameters, investigation/source validation, transition/timing review, assessment rubric, curriculum mapping, localization, and asset provenance.
