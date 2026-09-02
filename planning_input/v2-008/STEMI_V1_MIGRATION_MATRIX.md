# Acute Inferior STEMI V1 Migration Matrix

Status: **PRELIMINARY V2-009 DECISION INPUT — NOT MEDICALLY APPROVED**

Record IDs resolve to the detailed extraction in `STEMI_V1_STRUCTURED_INVENTORY.md`. A range groups records only when they share the same classification and migration question; every detailed record retains exactly one classification in the inventory.

| V1 item / inventory IDs | Source reference | Category | Preliminary classification | V2 target module | Issue/question | V2-009 decision required |
|---|---|---|---|---|---|---|
| `stemi1` local case key (P-001) | `CASES_DB`, 322–324 | Identity | REPLACE | `manifest` | Assign stable Case/Version/Package identities; never reuse local UI key as package identity. | YES |
| Card title/subtitle (P-002–P-003) | 324–325 | Presentation | KEEP | `presentation`, `localization` | Preserve as candidate wording after fact/localization review. | YES |
| Arrival badge (P-004) | 326 | UI | DISCARD | — | UI badge is not Case truth. | NO |
| Missing name/height/weight (P-005, P-008–P-009) | No fields | Patient profile | UNKNOWN_DISCUSS | `patient_profile`, `clinical_facts` | Decide whether these facts are educationally necessary and source them. | YES |
| Age/sex/EMS (P-006–P-007, P-010) | 324–325 | Patient profile | KEEP | `patient_profile`, `presentation` | Validate and localize. | YES |
| Arrival clock (P-011) | 325 | Timing | UNKNOWN_DISCUSS | `presentation`, `timeline_policy` | Decide whether it is display context or clinically meaningful time. | YES |
| Hard-coded department (P-012) | `selectCase`, 560–566 | Presentation | CORRECT | `classification`, `presentation` | Move to Case-owned code/localized text if retained. | YES |
| Chief complaint (P-013) | 324–340 | Presentation | KEEP | `presentation`, `clinical_facts` | Validate exact wording/fact IDs. | YES |
| Threshold-generated appearance (P-014) | 685–693 | Observation/UI | REPLACE | `initial_state`, `visual_manifest` | Author explicit state and reviewed projection rather than infer truth from vitals. | YES |
| Unused `ar-SA` voice metadata (P-015) | 327, 835–839 | Localization | CORRECT | `patient_profile`, `dialogue_policy` | Use approved patient language `ar-JO`; voice implementation is out of scope. | YES |
| Initial numeric observations (S-001–S-008) | 328 | Initial state | KEEP | `initial_state` | Human review must map them to explicit state plus observation projection. | YES |
| Mixed mutable global state (S-009) | 528–540 | Architecture debt | REPLACE | `initial_state` and runtime engines | Never migrate this representation. | NO |
| Missing rhythm (S-010) | No field; message 461 | Initial state | UNKNOWN_DISCUSS | `initial_state` | Clinical reviewer must author explicit rhythm. | YES |
| Missing explicit state dimensions/complications (S-011–S-012) | 528–540, 614–662 | Initial state | REPLACE | `initial_state` | Author explicit language-neutral state; do not derive from numeric vitals. | YES |
| No active interventions (S-013) | 536–537 | Initial state | KEEP | `initial_state` | Confirm the empty initial set. | YES |
| Action/timer surrogate flags (S-014–S-015) | 532–535 | State/rules | REPLACE | `rules`, `timeline_policy` | Replace with events, explicit state, and scheduler semantics. | YES |
| Mutable interaction sets and mixed answers/feedback/time (S-016–S-020) | 530–539, 610–678 | Runtime debt | REPLACE | Session/Clinical/Assessment boundaries | Existing V2 engines own these concerns separately. | NO |
| Core pain/respiratory/GI/neurologic/urinary facts (H-001–H-008, H-010–H-038) | 331–381 | Clinical facts | KEEP | `clinical_facts`, `dialogue_policy` | Validate content, disclosure, localization, and sources. | YES |
| Vague aggravating factor (H-009) | 339 | Clinical fact | UNKNOWN_DISCUSS | `clinical_facts` | Clarify whether the statement is useful and intentional. | YES |
| PMH/no surgery/family/social facts (H-039, H-041, H-044–H-048) | 385–396 | Clinical facts | KEEP | `clinical_facts`, `dialogue_policy` | Validate and source. | YES |
| Vague hospitalization (H-040) | 386 | Clinical fact | UNKNOWN_DISCUSS | `clinical_facts` | Clarify diagnosis/date or omit. | YES |
| Daily medication and allergy wording (H-042–H-043) | 388–389 | Clinical facts | CORRECT | `clinical_facts` | Preserve exact uncertainty; add missing medication details only from approved sources. | YES |
| Button-only history tracking (H-049–H-050) | 785–792 | UI/scoring | REPLACE | `action_catalogue`, `assessment_rubric` | Catalogue interaction cannot be scoring authority. | YES |
| Free-text history not credited (H-051) | 804–827, 1101–1104 | Evidence discrepancy | CORRECT | Session evidence, `assessment_rubric` | Equivalent authoritative fact discovery needs one deterministic evidence route. | YES |
| Empty “Other” complaint bucket (H-052) | 382, 773 | UI placeholder | DISCARD | — | No authored fact exists to migrate. | NO |
| Six exam result groups (E-001–E-006) | 398–404 | Exam findings | KEEP | `clinical_facts`, `action_catalogue` | Split stable exam actions/findings and clinically review them. | YES |
| Accordion exam execution (E-007–E-008) | 856–874 | UI/exam behavior | REPLACE | `action_catalogue`, Session evidence | Define techniques, timing, repeat, disclosure, and state dependency. | YES |
| ECG result text (I-001) | 407 | Investigation | KEEP | `action_catalogue`, `clinical_facts` | Validate exact interpretation and timing. | YES |
| ECG asset (I-002) | 407 | Diagnostic media | UNKNOWN_DISCUSS | `visual_manifest` plus diagnostic contract | Establish provenance/license/clinical review and study linkage. | YES |
| Laboratory panels/results (I-003–I-008) | 408–413 | Investigations | KEEP | `clinical_facts`, future diagnostic contract | Validate every value/unit/reference/flag; structured lab schema is currently missing. | YES |
| CXR result (I-009) | 414 | Investigation | KEEP | `clinical_facts` | Validate report and result timing. | YES |
| CXR asset (I-010) | 414 | Diagnostic media | UNKNOWN_DISCUSS | `visual_manifest` plus diagnostic contract | Establish provenance/license/clinical review and report linkage. | YES |
| Echo text result (I-011) | 415 | Investigation | KEEP | `clinical_facts` | Validate report and decide modality representation. | YES |
| Synchronous result reveal (I-012) | 897–913 | Investigation behavior | REPLACE | `rules`, `timeline_policy` | Model order, pending completion, result availability, and evidence separately. | YES |
| Twenty decoy investigations (I-013–I-032) | 418–437 | Investigation catalogue | UNKNOWN_DISCUSS | `action_catalogue`, `assessment_rubric` | Review relevance, availability, durations, results, and penalties individually. | YES |
| Generic fabricated decoy result (I-033) | 914–919 | Investigation result | REPLACE | `clinical_facts` / diagnostic contract | No result may be invented by a generic handler. | YES |
| Monitor and IV access (A-001–A-002) | 440–441 | Initial actions | KEEP | `action_catalogue` | Define parameters/effects/evidence/repeat policy. | YES |
| Cath-lab activation (A-004) | 443 | Consult/procedure | KEEP | `action_catalogue`, `rules` | Separate activation, transfer/PCI, timing, and effects. | YES |
| Oxygen, Foley, NG (A-003, A-005–A-006) | 442–445 | Initial actions | UNKNOWN_DISCUSS | `action_catalogue`, `assessment_rubric` | Clinical indication and scoring require review. | YES |
| Six fluids (A-007–A-012) | 447–453 | Fluids | UNKNOWN_DISCUSS | `action_catalogue`, `rules` | Review indication, volume/rate/route, effects, and penalties. | YES |
| Eight procedures (A-013–A-020) | 455–463 | Procedures | UNKNOWN_DISCUSS | `action_catalogue`, `assessment_rubric` | Review availability and verdicts; add parameters/prerequisites. | YES |
| Shared 0.5-min once-only behavior (A-021) | 932–947 | Execution/timing | REPLACE | `action_catalogue`, `rules`, `timeline_policy` | Use Case-owned repeat and duration semantics. | YES |
| Display-route substring IV gate (A-022) | 966–989 | Prerequisite bug | CORRECT | `action_catalogue`, command validation | Route must be a validated selected parameter. | YES |
| All 37 medication entries (M-001–M-037) | 465–502 | Medications | UNKNOWN_DISCUSS | `action_catalogue`, `rules`, `assessment_rubric` | Individually review indication/verdict/route/effect; all lack dose/frequency. | YES |
| Missing medication parameters (M-038) | 465–502 | Medication content | CORRECT | `action_catalogue` | Source exact dose, formulation, route, and administration constraints. | YES |
| Shared click/timing and direct vital effects (M-039–M-040) | 972–1007 | Clinical logic | REPLACE | `rules`, `timeline_policy` | Re-author declaratively after clinical review; never port numeric writes. | YES |
| Primary diagnosis (D-001) | 270, 513 | Diagnosis | KEEP | `clinical_facts`, `action_catalogue` | Validate final wording/code. | YES |
| Nine alternate/partial/wrong diagnoses (D-002–D-010) | 270–272, 514 | Diagnosis choices | UNKNOWN_DISCUSS | `action_catalogue`, `assessment_rubric` | Review availability and scoring distinctions. | YES |
| Locked diagnosis submission (D-011) | 1071–1078 | UI behavior | REPLACE | Session/Assessment | Define submission/revision behavior explicitly. | YES |
| Cath-lab disposition (D-012) | 505 | Disposition | KEEP | `action_catalogue`, `assessment_rubric` | Validate exact target and completion meaning. | YES |
| Six other dispositions (D-013–D-018) | 506–511 | Disposition choices | UNKNOWN_DISCUSS | `action_catalogue`, `assessment_rubric` | Context and scoring require review. | YES |
| Locked/prerequisite-free disposition (D-019) | 1083–1089 | UI behavior | REPLACE | Session/Assessment | Author deterministic evidence and prerequisites. | YES |
| Manual end (D-020) | 284, 1118–1140 | Lifecycle | UNKNOWN_DISCUSS | Session lifecycle | Define learner/faculty termination permissions later. | YES |
| Arrest async end and resolved clock behavior (D-021–D-022) | 663–668, 1118 | Lifecycle defects | CORRECT | `rules`, Session lifecycle | Separate clinical outcome events from session finalization. | YES |
| Browser/tick/jump and hard-coded state transitions (R-001–R-020) | 522–668, 942–1065 | Dynamic physiology | REPLACE | `rules`, `timeline_policy`, Clinical Engine | Re-author; do not port. | YES |
| Resolved/arrested physiology short-circuit while clock continues (R-021) | 610, 614–615, 668 | Dynamic lifecycle defect | CORRECT | `rules`, Session lifecycle | Define coherent outcome/finalization behavior. | YES |
| Missing post-arrest/other complication paths (R-022) | No V1 path | Missing behavior | UNKNOWN_DISCUSS | `rules` | Clinical/product review decides intended scope. | YES |
| Symptom-onset timing (T-001) | 331 | Clinical timing fact | KEEP | `clinical_facts`, `timeline_policy` | Decide exact/relative representation. | YES |
| Arrival time and clinical durations (T-002, T-004–T-013) | 325, 407–437, 625–661, 907–910 | Timing policy | UNKNOWN_DISCUSS | `timeline_policy`, `rules`, `assessment_rubric` | Validate every duration/window; never infer from UI milliseconds. | YES |
| Browser clock, action jumps, network-time coupling, result reveal, sleep behavior (T-003, T-006, T-014, T-017–T-018) | 603–611, 897–1065 | Timing architecture | REPLACE | Session/Clinical scheduler | Existing V2 clock/scheduler semantics replace this. | NO |
| Layout/animation/final-narrative waits (T-015–T-016, T-020) | 47, 568, 1142–1156 | UI/technical timing | DISCARD | — | Must not become Clinical Time. | NO |
| Resolved clock inconsistency (T-019) | 610, 614–615, 668 | Lifecycle/timing | CORRECT | Session lifecycle | Decide exact finalization transition. | YES |
| Checklist/click scoring rules (Q-001–Q-006, Q-010) | 1095–1116 | Assessment | REPLACE | `assessment_rubric` | Translate only after human review into evidence-based criteria. | YES |
| Required-treatment list and critical penalty (Q-007–Q-008) | 515, 1110–1112 | Assessment policy | UNKNOWN_DISCUSS | `assessment_rubric` | Validate required actions and penalty/cap semantics. | YES |
| ECG duplicated penalty and missing arrest cap (Q-009, Q-016–Q-017) | 1107–1113 | Assessment inconsistencies | CORRECT | `assessment_rubric` | Resolve double counting, timing credit, and outcome caps. | YES |
| Equal six-domain mean (Q-011) | 1115 | Assessment weights | UNKNOWN_DISCUSS | `assessment_rubric` | Decide mapping/weights against canonical V2 six domains. | YES |
| Deterministic integer rounding (Q-012) | 1104–1115 | Arithmetic | KEEP | Assessment Engine | Preserve concept only if rubric arithmetic agrees. | YES |
| Live correctness disclosure (Q-013) | 753–758 | Disclosure | REPLACE | Assessment disclosure policy | Assessment mode must withhold correctness. | YES |
| Once-only credit behavior (Q-014) | handlers | Repeat semantics | KEEP | `assessment_rubric` | Make Case-owned criterion repeat policy explicit. | YES |
| Blocked-IV feedback behavior (Q-015) | 967–970 | Assessment/evidence | REPLACE | Session evidence, rubric | Rejected intent cannot equal execution credit/penalty without explicit rubric. | YES |
| Mutable click evidence (Q-018) | 536–539, 1101–1116 | Evidence | REPLACE | Session events, Assessment Engine | Use authoritative committed events only. | NO |
| Remote/model coupling and prompt-only guards (AI-001–AI-002, AI-005) | 523, 835–849 | AI architecture | REPLACE | Future AI Gateway/dialogue policy | Out of V2-009 clinical content except policy/facts. | YES |
| Patient facts/persona (AI-003–AI-004) | 804–839 | Dialogue content | KEEP | `dialogue_policy`, `clinical_facts` | Review tone, access, disclosure, and localization. | YES |
| Unvalidated AI response (AI-006) | 840–846 | Dialogue output | UNKNOWN_DISCUSS | Future AI boundary | Decide allowed response contract later. | YES |
| Heuristic/random fallbacks (AI-007–AI-008) | 810–827 | Dialogue behavior | REPLACE | `dialogue_policy` / future AI | Use deterministic, fact-scoped fallback. | YES |
| Chat state inconsistency (AI-009) | 830 | Dialogue behavior | CORRECT | `dialogue_policy` / future AI | Bind availability to explicit state/policy. | YES |
| AI order-to-execution and substring matching (AI-010–AI-011, AI-013) | 1013–1065 | Intent handling | REPLACE | Future AI Gateway + Session commands | AI may propose intent only; direct execution must not migrate. | NO |
| Free-text order scope bug (AI-012) | 1037–1043 | Intent handling | CORRECT | Future AI Gateway + Session commands | Tests/treatment scope must be authoritative and validated. | NO |
| Fallback boundary (AI-014) | 847–850, 1057–1060, 1152–1156 | Resilience | KEEP | `dialogue_policy` | Preserve deterministic fallback principle, not implementation. | YES |
| Stateless chat (AI-015) | 841 | AI behavior | UNKNOWN_DISCUSS | Future dialogue policy | Decide whether conversational history is required. | YES |
| AI debrief prose (AI-016) | 1142–1153 | AI behavior | REPLACE | Future debrief projection | AI scoring remains forbidden; any prose must consume authoritative evidence. | YES |
| Locale gap (AI-017) | 2, 835–839 | Localization | CORRECT | `localization`, `patient_profile` | Author `ar-JO`/`en-US`. | YES |
| Dead voice metadata (AI-018) | 327 | Voice | DISCARD | — | Do not migrate unused settings. | NO |
| Monitor UI (V-001) | 167–194 | Visual UI | DISCARD | — | Keep no V1 UI code. | NO |
| Numeric/rhythm rendering (V-002–V-003) | 699–728 | Observation projection | REPLACE | Observation policy, future UI | Explicit state/rhythm must remain authoritative. | NO |
| ECG/CXR/echo visual state (V-004–V-006) | 407, 414–415 | Diagnostic media | UNKNOWN_DISCUSS | `visual_manifest` + diagnostic contract | Asset provenance and modality-specific representation are unresolved. | YES |
| Avatar/dead sound UI (V-007, V-009) | 182; CSS 49–50 | UI artifacts | DISCARD | — | Do not migrate. | NO |
| Appearance projection and asset governance (V-008, V-010) | 407, 414, 685–693 | Visual policy | REPLACE | `visual_manifest`, observation policy | Use reviewed IDs/static fallbacks; no inferred rhythm. | YES |
| No media generation dependency (V-011) | Entire V1 | Product compatibility | KEEP | `visual_manifest` | Compatible with approved pre-generated visual-library direction. | NO |
| Runtime Google Fonts dependency (V-012) | CSS line 7 | UI dependency | DISCARD | — | Not Case truth and not part of the approved media inventory. | NO |
| Deterministic report components (F-001–F-003, F-007) | 1118–1156 | Debrief | KEEP | Assessment debrief projection | Rebuild from authoritative evidence. | YES |
| Unstructured critical/AI feedback (F-004–F-006) | 1139–1153 | Debrief | REPLACE | Assessment result/debrief evidence | AI prose cannot be scoring truth; stable findings/evidence required. | YES |
| Log order inconsistency (F-008) | 753–758, 1145 | Evidence/UI | CORRECT | Session event projection | Preserve authoritative sequence; choose presentation order explicitly. | YES |
| Architecture debt findings (AD-001–AD-015, AD-017) | See inventory | Architecture | REPLACE | Existing V2 packages | Already addressed structurally by V2 contracts/engines; do not port V1 patterns. | NO |
| Client-visible worker/model, no embedded secret (AD-016) | 523, fetch calls | Security boundary | CORRECT | Future AI Gateway | Endpoint/provider coupling needs later secure architecture; no credential copied. | NO |
| Leaked resize listener (AD-018) | 569 | UI lifecycle | DISCARD | — | Do not migrate browser lifecycle code. | NO |
| Contradictions C-001, C-006, C-009–C-010, C-014 | See inventory | Clinical/content uncertainty | UNKNOWN_DISCUSS | Relevant Case modules | Must be decided by clinical/product reviewers. | YES |
| Contradictions C-002–C-005, C-007–C-008, C-011–C-013, C-015–C-016 | See inventory | Structural/content defects | CORRECT | Relevant Case modules/runtime | Preserve evidence of defect; correct during reviewed authoring, not extraction. | YES |
| Restart/report stale DOM defects (C-017–C-018) | 530, 588–604, 1139 | UI state defects | CORRECT | — | V1 UI defects must not become Case content. | NO |

## Gate outcome

- V2-009 cannot begin final Case authoring safely until the diagnostic investigation contract gaps, medication parameters, explicit initial state/rhythm, timing semantics, clinical-rule review, and rubric decisions are resolved.
- No row in this matrix authorizes medical content or publication.
