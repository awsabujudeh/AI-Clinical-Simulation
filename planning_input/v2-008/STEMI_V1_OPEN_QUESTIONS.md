# Acute Inferior STEMI V1 Open Questions

Status: **REVIEW QUEUE — NO ANSWERS OR MEDICAL APPROVAL IMPLIED**

Only questions that require clinical judgment, product decisions, architecture/contract decisions, or content sourcing are listed. V1 evidence is preserved so V2-009 reviewers can answer without guessing.

| ID | Review type | Priority | Question | V1 evidence / why unresolved |
|---|---|---|---|---|
| OQ-001 | Clinical judgment | BLOCKING | What exact explicit initial cardiac rhythm should V2 author? | V1 has no rhythm field; one message says sinus tachycardia while monitor may show VT from HR/BP (lines 461, 716–728). |
| OQ-002 | Clinical judgment | BLOCKING | What explicit initial hemodynamic, perfusion, respiratory, oxygenation, consciousness, neurologic, temperature, metabolic, pain, intervention, complication, and outcome states are intended? | V1 supplies only numeric vitals and hidden flags (lines 328, 528–540). |
| OQ-003 | Clinical judgment/content sourcing | BLOCKING | Are all initial numeric observations (85/60, HR 118, RR 28, SpO₂ 90, 36.8, glucose 178, pain 8, GCS 15) mutually intended and source-supported? | V1 line 328; no source/review evidence. |
| OQ-004 | Content sourcing | BLOCKING | What source and license authorize the embedded ECG image, and does a clinical reviewer confirm it matches the intended text interpretation? | Inline JPEG and result coexist at line 407; no provenance. |
| OQ-005 | Content sourcing | BLOCKING | What source and license authorize the embedded chest X-ray, and does the image match the authored report? | Inline JPEG and result at line 414; no provenance. |
| OQ-006 | Clinical judgment/content sourcing | BLOCKING | Are every laboratory value, unit, reference interval, and high/low flag intended for this patient and institution-neutral presentation? | V1 lines 408–413; no citations/review. |
| OQ-007 | Clinical judgment/content sourcing | BLOCKING | Is the echo finding and EF value intended, and what modality-appropriate asset/report representation is required? | Text-only echo at line 415. |
| OQ-008 | Architecture/contract | BLOCKING | What strict diagnostic investigation contract will bind order identity, Clinical-Time duration, pending/result availability, structured data, report, diagnostic asset, fallback, and provenance? | Current V2 Case Schema is PARTIAL/MISSING across the Diagnostic Investigation Contract Gate. |
| OQ-009 | Architecture/contract | BLOCKING | How are image availability and formal report availability represented independently? | Neither V1 nor current V2 Case Schema has this boundary. |
| OQ-010 | Architecture/contract/product | BLOCKING | Which investigations complete independently/asynchronously, which block learner flow, and which can run in parallel? | V1 serially jumps time and reveals immediately (lines 897–919). |
| OQ-011 | Clinical judgment | BLOCKING | Which of the 20 V1 decoy investigations should be available, and what result/timing/assessment consequence—if any—does each have? | V1 lines 418–437 use generic normal results and fixed penalties. |
| OQ-012 | Clinical judgment/content sourcing | BLOCKING | For each of 37 medications, what exact dose, formulation, route, frequency/one-time instruction, prerequisite, confirmation, repeat policy, and evidence source apply? | V1 lines 465–502 contain no dose or frequency. |
| OQ-013 | Clinical judgment | BLOCKING | How should the reported home aspirin use affect acute aspirin history, ordering, administration, contraindication checks, and scoring? | Daily aspirin fact line 388; acute aspirin required at lines 468 and 515. |
| OQ-014 | Clinical judgment | BLOCKING | Is oxygen indicated/required for the authored initial state, under which conditions, and what state effect is reviewed? | V1 marks oxygen correct/required and directly adds 4 SpO₂ points (lines 442, 515, 945). |
| OQ-015 | Clinical judgment/product | BLOCKING | Does “activate Cath Lab + Primary PCI” represent one action or distinct consult/activation/transfer/procedure milestones, and when is the case considered complete? | V1 conflates them at lines 443 and 505. |
| OQ-016 | Clinical judgment | BLOCKING | Which antiplatelet/anticoagulant choices are required or optional, with what contraindication and timing rules? | V1 requires aspirin, clopidogrel, and enoxaparin without doses (line 515). |
| OQ-017 | Clinical judgment | BLOCKING | What nitrate contraindication/validation rules and effects are intended? | V1 uses only SBP <90 and a fixed six-minute collapse (lines 625–632, 995–1005). |
| OQ-018 | Clinical judgment | BLOCKING | Which fluid actions are appropriate, harmful, or unavailable, with what volume/rate and patient-state effect? | V1 lines 447–453 contain labels/verdicts but no volume/rate and mostly no effect. |
| OQ-019 | Clinical judgment | BLOCKING | Which procedures and alternative medications should be exposed as learner choices, and are the V1 verdicts/critical labels correct? | V1 lines 455–502; all classifications are preliminary only. |
| OQ-020 | Clinical judgment | BLOCKING | What deterioration, complication, arrest, and recovery pathways are clinically intended, including their triggers and timings? | V1 hard-coded rules at lines 614–668 are not approved. |
| OQ-021 | Clinical judgment/product | HIGH | Is post-arrest management within Expo case scope? | V1 ends immediately on arrest and has no CPR/defibrillation/recovery branch (lines 663–666). |
| OQ-022 | Clinical judgment | BLOCKING | Which clinically relevant authored changes should follow each accepted treatment, and which actions should have no immediate state effect? | V1 combines fixed numeric writes, flags, and feedback-only actions (lines 942–1007). |
| OQ-023 | Clinical judgment | HIGH | Are all six organ examination findings intended, and should techniques be separate actions with state-dependent disclosure? | Static three-technique bundles at lines 398–404, 856–874. |
| OQ-024 | Clinical judgment/content sourcing | HIGH | Which of the 48 history facts are required, optional, irrelevant distractors, contraindication-critical, or intentionally unknown? | `req` flags are V1 score choices, not validation evidence (lines 329–397). |
| OQ-025 | Content sourcing | HIGH | What should replace the vague prior hospitalization, and are medication adherence and allergy certainty intentionally unknown? | Lines 386, 388–389. |
| OQ-026 | Product/content | HIGH | Is an authored name, height, or weight needed, or should those facts remain absent/undisclosed? | No V1 fields. |
| OQ-027 | Product/content | BLOCKING | What bilingual `ar-JO`/`en-US` localization is required, and which English examination/result strings need authoritative translation? | V1 mixes Arabic and English and has unused `ar-SA` metadata. |
| OQ-028 | Product/architecture | HIGH | What exact patient-dialogue facts, disclosure modes, emotional tone, uncertainty responses, and deterministic fallback are allowed? | V1 prompt/fallback lines 804–850; prompt-only controls are not sufficient. |
| OQ-029 | Product/architecture | HIGH | Should free-text history discovery and catalogue history produce the same committed evidence and score outcome? | V1 free text returns facts but does not update `historyAsked` (lines 785–827). |
| OQ-030 | Clinical judgment/assessment | BLOCKING | How do V1’s six sections map to the canonical V2 six domains, and what weights/max points are approved? | Equal V1 mean at lines 1093–1116 is not a V2 rubric. |
| OQ-031 | Clinical judgment/assessment | BLOCKING | Which actions, omissions, orders, diagnoses, and dispositions earn points or penalties, and which are critical failures/caps? | V1 checklist and free-string errors at lines 1101–1116. |
| OQ-032 | Clinical judgment/assessment | BLOCKING | Which Clinical-Time windows and event-ordering criteria are required, including ECG timing? | V1 gives ECG live feedback at 10 min but no numeric timing criterion (lines 907–912). |
| OQ-033 | Clinical judgment/assessment | HIGH | Should arrest force failure or cap the score, and how should resolved/manual termination affect finalization? | V1 has no arrest cap and allows manual end (lines 1118–1124). |
| OQ-034 | Product/assessment | HIGH | Which feedback can be shown live in Practice, and what must be withheld in Assessment until final debrief? | V1 always exposes correctness live (lines 753–758). |
| OQ-035 | Product | HIGH | Which diagnosis and disposition alternatives should be offered, and can a learner revise a submission? | V1 options/locking at lines 270–274, 1071–1089. |
| OQ-036 | Product/clinical judgment | HIGH | Under what facility/transfer context is direct Cath Lab versus transfer versus CCU appropriate? | V1 always marks transfer wrong and Cath Lab correct (lines 505–511). |
| OQ-037 | Content sourcing/governance | BLOCKING | Which clinical sources, source versions, reviewers, and review scopes will support every fact/action/rule/rubric/asset? | V1 contains no provenance; V2 publication gates require it. |
| OQ-038 | Content sourcing/governance | BLOCKING | What JU and JUST curriculum objectives are officially sourced and validated without claiming unsupported alignment? | V1 has no curriculum mapping. |
| OQ-039 | Product/visual | HIGH | Which approved reusable Visual Patient assets and dedicated STEMI Expo pack assets are required, with mandatory static fallbacks? | V1 has only a generic avatar, two inline diagnostic images, and textual appearance. |
| OQ-040 | Product/visual | HIGH | What rhythm/waveform descriptors should accompany each explicit reachable rhythm state? | V1 guesses waveform from HR/BP; V2 requires explicit rhythm ownership. |
| OQ-041 | Clinical judgment/timing | BLOCKING | Are the V1 investigation delays, 0.5-min action cost, four-minute recovery, six-minute nitrate crisis, and eight-minute arrest dwell valid? | Values exist only in V1 code and must not be silently promoted. |
| OQ-042 | Product/timing | HIGH | Is `02:34 AM` meaningful case context, and how does one-hour symptom onset relate to Session Clinical Time zero? | V1 fields are disconnected (lines 325, 331). |
| OQ-043 | Architecture/contract | BLOCKING | Once V2-009 rules define reachable diagnostic/result states, how will publication validation prove every reachable observation and investigation-result dependency is covered? | Existing reachability evidence is mandatory, but investigation-specific vocabulary is incomplete. |
| OQ-044 | Product/AI | MEDIUM | Is AI-generated debrief prose desired later, and if so, what evidence-only input and non-authoritative disclosure boundary applies? | V1 uses mutable feedback strings and score (lines 1142–1153); V2 deterministic result already exists. |

## Required review sequence before V2-009 final authoring

1. Resolve the Diagnostic Investigation Contract Gate (OQ-008–OQ-010, OQ-043).
2. Establish clinical/source review for initial state, investigations, medications, actions, and transitions.
3. Decide V2 rubric/domain/timing/cap policy.
4. Source and approve localization, curriculum mappings, and visual/diagnostic assets.
5. Only then author a V2 Draft; publication approval remains a later, separate gate.
