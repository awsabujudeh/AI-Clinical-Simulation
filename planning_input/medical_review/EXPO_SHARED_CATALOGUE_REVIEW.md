# Expo shared catalogue — current medical approval and review history

**WP2 implementation — CLOSED. EXPO MEDICAL REVIEW GATE — CLOSED.**
Production publication and independent media/source/curriculum gates remain pending.

Medical review: **COMPLETE — APPROVED_FOR_EXPO**
Approval basis: **OWNER_ATTESTED_PHYSICIAN_REVIEW**
Reviewer role: **PHYSICIAN**
Reviewer identity: **NOT_FORMALLY_RECORDED**
Exact physician review timestamp: **NOT_FORMALLY_RECORDED**
Owner attestation: **CONFIRMED**
Expo execution: **APPROVED_EXPO / ALLOWED**
Production publication: **PENDING / NOT_PUBLISHED**

The owner attests that a qualified physician reviewed both complete current
medical datasets and confirmed their correctness. This is not a verified
physician identity/signature, a fabricated review date, or a production approval.
No attestation timestamp is substituted for the unknown physician review time.

Current immutable Expo successors: **Khalid 2.4.0 / Dana 1.5.0**.
Both pin `catalogue.balsim.expo-clinical@1.1.0`: **33 concepts / 66 explicit
case bindings**. This includes the inherited seven medication orders (six drugs),
all current diagnostic interpretations and laboratory reference displays.
The exact version/hash envelope is listed in
[approval contract handoff](OWNER_ATTESTED_EXPO_APPROVAL.md) and
[completeness matrix](EXPO_CASE_COMPLETENESS_MATRIX.md).

The previous physician-request checklists and finite-model rationale below are
preserved unchanged as audit history. Their then-pending statuses and v1.0.0
counts are historical, **not the status or scope of the current successors**.
The owner-attested review supersedes the pending medical decision for the
inherited mappings and complete v1.1.0 datasets; it does not add effects, new
score weights, new findings or requested conflicting replacement values.

Media matching and rights remain separate: Khalid's 84-bpm ECG image is
withheld; its approved Case interpretation remains available. Other unapproved
diagnostic images remain withheld/missing with deterministic text fallback.
Sources remain UNRESOLVED for publication/trusted RAG; JU/JUST remain pending.

## Preserved original v1.0.0 physician-review request

# Expo shared catalogue — physician review handoff

**PENDING_PHYSICIAN_REVIEW — NOT CLINICALLY APPROVED**

Implementation: FINAL_EXPO_SCOPE. Catalogue: `catalogue.balsim.expo-clinical@1.0.0`.

Review successors: Khalid **2.2.0**, Dana **1.2.0**, both UNDER_REVIEW / REVIEW_ONLY.
Prepared 2026-09-25. This is a synthetic educational model, not real-patient prescribing guidance.

## Review decision needed

Please review the selected fixed orders, new opposite-case mappings, explicit
no-modeled-benefit policies, access prerequisites, and compressed timing fixtures.
A technical PASS does not approve these medical decisions. No physician signature
or outcome is fabricated. Existing STEMI/media review (including ECG reference
84 bpm vs Case 112 bpm) remains independent and open.

Each action binds to a Case-owned deterministic policy. Neither LLM output, RAG,
Tutor nor learner input can select a result or effect. "No modeled benefit" means
the finite synthetic Case does not award a beneficial physiological response;
it does **not** mean a drug/fluid has no real effects, is harmless, or is appropriate.
No new adverse physiology was invented. Wrong actions still consume time and log
evidence. New scoring weights were not added.

## Authoritative references (metadata, not copied documents)

**K / D / W — existing Case Ground Truth, primary for these synthetic patients**
- `v2/content/cases/stemi/v2-draft/stemi-case.ts`
- `v2/content/cases/stemi/v2-conversation/stemi-conversation-case.ts`
- `v2/content/cases/anaphylaxis/dana-case.ts`
- `v2/content/cases/observations/wp1-cases.ts`
- Existing rules, patient facts, diagnostic results and rubric are unchanged in the successors.

**ACS — source.wp2.acs-2025**
- [Official ACC guideline record](https://www.acc.org/Guidelines/Guidelines/2025/02/27/17/21/Acute-Coronary-Syndromes-2025)
- [Official AHA key recommendations](https://professional.heart.org/en/science-news/2025-guideline-for-the-management-of-patients-with-acute-coronary-syndromes/top-things-to-know)
- [Full guideline, JACC DOI 10.1016/j.jacc.2024.11.009](https://www.jacc.org/doi/10.1016/j.jacc.2024.11.009)
- Trace used: ACS antiplatelet therapy, PCI pathway and high-intensity statin care.
  Exact existing fixed orders remain grounded in K; no recommendation was interpreted
  as evidence that these agents are physiologically inactive in anaphylaxis.

**RCUK — source.wp2.rcuk-anaphylaxis-2021**
- [Official emergency anaphylaxis guidance](https://www.resus.org.uk/library/additional-guidance/guidance-anaphylaxis/emergency-treatment-anaphylactic-reactions)
- [May 2021 guideline PDF](https://www.resus.org.uk/sites/default/files/2021-05/Emergency%20Treatment%20of%20Anaphylaxis%20May%202021_0.pdf)
- Trace used: sections 4–5; adult IM adrenaline 500 micrograms, repeat after five
  minutes if ABC problems persist, oxygen/support and crystalloid for hypotension.
  Antihistamines are not primary ABC treatment; routine steroids are not central.
  No opposite-case physiological counterfactual was inferred from these recommendations.

**AP23 — source.wp2.anaphylaxis-2023**
- [AAAAI-hosted 2023 practice parameter](https://www.aaaai.org/Aaaai/media/Media-Library-PDFs/Allergist%20Resources/Statements%20and%20Practice%20Parameters/Anaphylaxis-Practice-Paramaters-2023.pdf)
- DOI 10.1016/j.anai.2023.09.015; adult IM epinephrine treatment and dosing context.
  Supports the existing Dana treatment direction, not a newly invented STEMI harm model.

**M — source.wp2.expo-modeling-decision**
- Owner's explicit WP2 authoring authorization and this pending review record.
- General guidelines identify treatment context; the bounded counterfactual N policies
  below are **authoring decisions requiring physician review**, not guideline statements.
- These sources remain required UNRESOLVED records in Case validation. No RAG source
  promotion, curriculum approval, or copyrighted guideline ingestion occurred.

## Eleven new opposite-case clinical outcome mappings

All rows: **PENDING_PHYSICIAN_REVIEW**. N = explicit NO_MODELED_BENEFIT.
No drug-induced hypotension/arrhythmia/bleeding/allergy/sedation or other harm is
introduced. Listed access and order validation happen before commit.

| Shared concept | Case | Fixed dose/route or order | Modeled outcome | Rationale / source | Safety classification |
| --- | --- | --- | --- | --- | --- |
| concept.expo.aspirin | Dana | 324 mg chewed | N; 30 s + evidence | D's first-line/response rules remain adrenaline/support; aspirin is the existing K ACS order. D + K + ACS + RCUK/AP23 + M | Non-beneficial synthetic distractor; not asserted safe |
| concept.expo.ticagrelor | Dana | 180 mg oral | N; 30 s + evidence | Preserve D's existing response; transfer K fixed order without inventing counterfactual harm. D + K + ACS + RCUK/AP23 + M | Non-beneficial synthetic distractor |
| concept.expo.clopidogrel | Dana | 600 mg oral | N; 30 s + evidence | Same bounded model; does not replace adrenaline. D + K + ACS + RCUK/AP23 + M | Non-beneficial synthetic distractor |
| concept.expo.ufh | Dana | 70 units/kg IV bolus, prior IV access | N; 30 s + evidence | Existing K fixed order; no anticoagulation response or bleeding model added to D. D + K + ACS + RCUK/AP23 + M | Non-beneficial synthetic distractor; access validated |
| concept.expo.atorvastatin | Dana | 80 mg oral | N; 30 s + evidence | No acute anaphylaxis stabilization benefit modeled; exact K fixed order. D + K + ACS + RCUK/AP23 + M | Non-beneficial synthetic distractor |
| concept.expo.epinephrine | Khalid | 0.5 mg IM anterolateral thigh | N; 30 s + evidence | D's anaphylaxis order is not an authored K STEMI treatment response. K + D + ACS + RCUK/AP23 + M; no new harm claimed | Non-beneficial synthetic distractor; not clinical endorsement |
| concept.expo.repeat-epinephrine | Khalid | 0.5 mg IM thigh, prior first dose | N; 30 s + evidence | Retains distinct first/repeat identity; no anaphylaxis response/window transplanted into K. K + D + ACS + RCUK/AP23 + M | Non-beneficial synthetic distractor |
| concept.expo.saline-250 | Dana | 250 mL saline IV over 10 clinical min; IV access | N; 15 s order + evidence/device | D currently models the distinct 500 mL bolus, not partial-volume benefit. D + K + RCUK + M | Finite-model volume limitation; needs explicit physician review |
| concept.expo.crystalloid-500 | Khalid | 500 mL crystalloid IV bolus; IV access | N; 15 s order + evidence/device | K models a cautious distinct 250 mL/10-min response; no substitution or invented overload/benefit. K + D + RCUK + M | Finite-model volume limitation; needs explicit physician review |
| concept.expo.help | Khalid | Call resuscitation team | N; 15 s + consult evidence | Existing K escalation is Cath Lab; no new team response modeled. K + D + RCUK + M | Receipt-only support request, not a claim help is useless |
| concept.expo.cath | Dana | Activate Cath Lab / PCI pathway | N; 15 s + consult evidence | D has no authored PCI event/effect; K pathway identity reused, no procedure performed. D + K + ACS + M | Receipt-only distractor |

No medicine result was authored solely from model memory. Guidance was consulted
at the official sources above, but is not misrepresented as proving exact N
counterfactuals. The authorized finite-model decisions are separately visible for review.

## Inherited outcomes made explicit (31 additional Case bindings)

The [final coverage matrix](../uiux/WP2_SHARED_CLINICAL_CATALOGUE.md#final-expo-coverage-matrix)
lists all **42** bindings individually, including action IDs, parameters,
outcomes, references and review status. The remaining 31 use existing Case/WP1
rules/results/acquisition or evidence-only orders. Each now has an explicit
unmatched-rule N fallback and pending review metadata rather than an implicit absence.

| Concepts / Cases | Authored behavior retained | New bounded policy consideration |
| --- | --- | --- |
| Five observation concepts / both | Existing samples, provenance, time, devices | No new physiology; existing 15/30 s fixture costs |
| ECG and CXR / both | Existing deterministic result, report, independent schedule | No inferred normal result; 15 s order fixture |
| Aspirin, ticagrelor, clopidogrel, UFH, atorvastatin / Khalid | Existing fixed medication evidence/rubric; no fabricated immediate physiological benefit | 30 s order fixture; UFH now explicitly requires IV in successor only |
| First/repeat epinephrine / Dana | Existing epi flag, delayed readiness, five-minute eligibility and early-repeat critical event | 30 s order fixture; no dose/route change |
| IV / both | Existing access flags/evidence/device | 15 s fixture; nonrepeatable order retained |
| Saline-250 / Khalid | Existing support scheduled after 600 s | Explicit prior IV in successor; 15 s is order time, not infusion completion |
| Crystalloid-500 / Dana | Existing response-ready after 180 s | Existing prior IV preserved; 15 s order time |
| Oxygen / both | Existing case support flag/rule | 15 s order fixture; no new titration/delivery model |
| Help / Dana; Cath Lab / Khalid | Existing authored evidence/rubric | 15 s order fixture; no new service simulation |
| Monitoring / both | K continuous HR/rhythm; D continuous HR/SpO2/rhythm and one BP sample | Existing 15/30 s acquisition; no continuous BP claim |

These rows total 31 inherited bindings (10 observations + 4 investigations + 7
medications + 2 IV + 2 fluid + 2 oxygen + 2 escalation + 2 monitoring).

## Medication audit and exclusions

All eight Khalid and four Dana medication actions were inspected; exact 12-row
audit is in the handoff. Included seven orders/six drugs. Excluded identically
from both shared catalogues:
- Nitroglycerin: K harm rule retained internally; no specified shared dose/Dana mapping.
- IV beta blocker: existing unsafe assessment evidence retained; no specific agent/dose.
- Norepinephrine rescue: incomplete fixed prescription/response; no new infusion model.
- Antihistamine adjunct: no specific fixed agent/dose; never elevated above adrenaline.
- Bronchodilator adjunct: no specific fixed agent/dose or opposite-case model.

No unreviewed dose was filled in. No new score weight, P2Y12 interaction rule,
or contraindication was invented. Wrong-action evidence is retained for subsequent
assessment policy. Reject malformed/duplicate requests through existing contracts,
not because an action is medically non-optimal.

## Review limitations and preservation

- Physician must explicitly assess the two finite fluid-response limitations and
  whether the distractor orders are sufficient for the intended educational exercise.
- Fixed-dose orders are not a prescribing/calculation engine. Formulation or alternate
  routes are not learner-editable; current authored inputs are preserved.
- Medication orders are simulation fixtures, not a real clinical protocol.
- Prior Case versions/hashes, facts, dialogue, clinical rules, diagnostic content,
  scoring/rubrics, media/visual assets and publication gates remain unchanged.
- Both successors remain nonpublishable while required sources/review are pending.
- No patient data, credentials, provider token, audio/video or full guideline is here.

## Physician disposition (not completed)

Review status: **PENDING_PHYSICIAN_REVIEW**

Reviewer: **not recorded**

Approval date: **not recorded**

Approved mappings: **none recorded**

Required corrections: **awaiting actual physician review**
