# Acute Inferior STEMI V1 Structured Inventory

Status: **DRAFT EXTRACTION INVENTORY — NOT MEDICALLY APPROVED**

This document records what the protected V1 implementation contains. It does not endorse a fact, dose, rule, score, asset, or timing assumption. `KEEP` means only “candidate source material”; all items still require V2-009 human review.

## Sources and method

- Primary technical source: `er_sim_10.html`, SHA-256 `2FE2732792EB1642909E53F42DB1A6455F9C72EF8088A0303F1E8857ECA2D512`.
- Context source: root `README.md`, SHA-256 `E1F5884A448E1CBD9125D1780A1236105D7E74DB2E3DD304F9A51F54857FCEE8`.
- Source references below use V1 line numbers and function/object names. Long embedded Base64 payloads are described, not copied.
- Classification authority: preliminary migration triage only: `KEEP`, `CORRECT`, `REPLACE`, `UNKNOWN_DISCUSS`, or `DISCARD`.
- Each record ID is counted once in the extraction summary. Composite records keep inseparable V1 values together (for example one laboratory panel).

## Patient profile and presentation

| ID | Extracted V1 item | Nature | Classification | V1 source |
|---|---|---|---|---|
| P-001 | Case key `stemi1`. | Hard-coded technical identity | REPLACE | `CASES_DB.stemi1`, lines 322–324 |
| P-002 | Card title: “male, 58 years — acute chest pain” (Arabic). | Display summary with clinical facts | KEEP | `title`, line 324 |
| P-003 | Subtitle repeats male/58, ambulance arrival, and `02:34 AM`. | Display summary with clinical facts | KEEP | `sub`, line 325 |
| P-004 | Arrival badge `CHEST PAIN` with ambulance icon. | UI label | DISCARD | `arrivalBadge`, line 326 |
| P-005 | Patient name is absent. | Missing content | UNKNOWN_DISCUSS | No V1 field |
| P-006 | Age 58 years. | Clinical demographic | KEEP | `title`/`sub`, lines 324–325; AI prompt line 835 |
| P-007 | Sex/gender represented only as male (`ذكر`). | Clinical demographic | KEEP | `title`/`sub`, lines 324–325 |
| P-008 | Height is absent. | Missing content | UNKNOWN_DISCUSS | No V1 field |
| P-009 | Weight is absent. | Missing content | UNKNOWN_DISCUSS | No V1 field |
| P-010 | Arrival by ambulance/EMS. | Arrival context | KEEP | `sub`, line 325 |
| P-011 | Arrival display time `02:34 AM`; no date, timezone, or relationship to simulation clock. | Ambiguous timestamp | UNKNOWN_DISCUSS | `sub`, line 325 |
| P-012 | Department/location is hard-coded as `Resuscitation Room 2 — Emergency Department`, not stored in the case object. | Presentation/UI coupling | CORRECT | `selectCase`, lines 560–566 |
| P-013 | Chief complaint is acute central chest pain; detailed wording says a heavy object on the chest. | Clinical presentation | KEEP | lines 324–326, 332–336 |
| P-014 | General appearance initially renders from vital thresholds as pale, sweaty, in pain, afraid, and speaking with difficulty. | Computed UI projection, not authored initial fact | REPLACE | `updateAppearanceSummary`, lines 685–693 |
| P-015 | `voice.lang='ar-SA'`, pitch `0.75`, rate `0.95`; the object is never read. Patient prompt requests Jordanian colloquial Arabic. | Unused/mismatched localization metadata | CORRECT | `voice`, line 327; no `CASE.voice` use; prompt lines 835–839 |

## Initial state and state ownership

| ID | Extracted V1 item | V1 ownership/behavior | Classification | V1 source |
|---|---|---|---|---|
| S-001 | BP `85/60` mmHg. | Mutable numeric `state.vitals` copied from case data | KEEP | `initialVitals`, line 328; `freshState`, line 531 |
| S-002 | HR `118`/min. | Mutable numeric vital | KEEP | line 328 |
| S-003 | RR `28`/min. | Mutable numeric vital | KEEP | line 328 |
| S-004 | SpO₂ `90%`. | Mutable numeric vital | KEEP | line 328 |
| S-005 | Temperature `36.8` °C. | Mutable numeric vital; never changes except arrest reset to the same value | KEEP | lines 328, 664 |
| S-006 | Blood sugar `178` mg/dL. | Mutable numeric vital with optional linear drift | KEEP | lines 328, 542–546 |
| S-007 | Pain `8/10`. | Mutable numeric vital | KEEP | line 328 |
| S-008 | GCS `15`. | Mutable numeric vital | KEEP | line 328 |
| S-009 | V1 treats vitals, score flags, clinical truth, and UI state as one mutable global object. | Competing/mixed state representation | REPLACE | `freshState`, lines 528–540 |
| S-010 | No explicit initial cardiac-rhythm field exists; text elsewhere claims “sinus tachycardia only.” | Missing/implicit clinical truth | UNKNOWN_DISCUSS | No state field; cardioversion message line 461 |
| S-011 | No explicit hemodynamic, perfusion, respiratory, oxygenation, neurologic, temperature, or metabolic state dimensions exist. | Missing V2 state dimensions | REPLACE | `freshState`, lines 528–540 |
| S-012 | No explicit initial complication object/list exists; deterioration is inferred from vital thresholds and flags. | Hidden derived state | REPLACE | lines 533–535, 614–662 |
| S-013 | No interventions are active initially; `treatmentsGiven` starts empty. | Internal set | KEEP | lines 536–537 |
| S-014 | `ecgOrdered`, `aspirinGiven`, and `cathlabActivated` begin `false` and later act as a recovery bundle. | Boolean surrogate for authoritative actions/events | REPLACE | lines 532, 636–643 |
| S-015 | Nitro crisis, recovery, sugar-drift, and neglect timers are mutable hidden flags/timestamps. | Hidden internal state | REPLACE | lines 533–535 |
| S-016 | Asked history, completed exams, ordered tests, and treatments are mutable JavaScript `Set` objects. | Browser-memory execution state | REPLACE | lines 536–537 |
| S-017 | Diagnosis and disposition answers/correctness are stored in the same global clinical state. | Learner/assessment state mixed with patient truth | REPLACE | lines 538–539 |
| S-018 | Critical errors and live feedback are stored in the same global state. | Assessment/UI state mixed with patient truth | REPLACE | lines 538, 753–758 |
| S-019 | Clinical time is mutable `simMin`; `lastPhysioMin` is a hidden delta anchor. | Browser timer state | REPLACE | lines 530, 535, 610–618 |
| S-020 | “stable/deteriorating/critical/arrest” is inferred from BP, SpO₂, HR, and flags rather than explicit state. | Backward inference from observations | REPLACE | `computeStatusLevel`, lines 673–678 |

## History and clinical facts

`req=true` is V1 scoring metadata, not evidence of medical approval.

| ID | V1 fact/question → patient answer | Required | Classification | V1 source |
|---|---|---:|---|---|
| H-001 | Onset: began about one hour ago while sleeping. | Yes | KEEP | `complaints.pain.onset`, line 331 |
| H-002 | Location: middle of chest. | Yes | KEEP | `location`, line 332 |
| H-003 | Radiation: left arm and a little to jaw. | Yes | KEEP | `radiation`, line 333 |
| H-004 | Character: heavy object sitting on chest. | Yes | KEEP | `character`, line 334 |
| H-005 | Severity: approximately 8/10. | Yes | KEEP | `severity`, line 335 |
| H-006 | Duration: continuous. | Yes | KEEP | `duration`, line 336 |
| H-007 | Progression: increased a little en route. | No | KEEP | `progression`, line 337 |
| H-008 | Relieving factors: rest did not help. | Yes | KEEP | `relieving`, line 338 |
| H-009 | Aggravating factors: felt worse in ambulance; no mechanism specified. | No | UNKNOWN_DISCUSS | `aggravating`, line 339 |
| H-010 | Prior similar pain: none; first episode. | Yes | KEEP | `previous`, line 340 |
| H-011 | Dyspnea since pain began. | Yes | KEEP | `sob`, line 343 |
| H-012 | Cough denied. | No | KEEP | `cough`, line 344 |
| H-013 | Sputum denied. | No | KEEP | `sputum`, line 345 |
| H-014 | Hemoptysis denied. | No | KEEP | `bloodsputum`, line 346 |
| H-015 | Nausea present. | Yes | KEEP | `nausea`, line 349 |
| H-016 | Vomited once shortly before questioning. | Yes | KEEP | `vomit`, line 350 |
| H-017 | Hematemesis denied. | No | KEEP | `vomitblood`, line 351 |
| H-018 | Constipation denied. | No | KEEP | `constipation`, line 352 |
| H-019 | Diarrhea denied. | No | KEEP | `diarrhea`, line 353 |
| H-020 | Blood in stool denied. | No | KEEP | `bloodstool`, line 354 |
| H-021 | Stool described as normal brown. | No | KEEP | `stoolcolor`, line 355 |
| H-022 | Abnormal stool odor denied. | No | KEEP | `stoolsmell`, line 356 |
| H-023 | Stool frequency approximately once daily. | No | KEEP | `stoolfreq`, line 357 |
| H-024 | Headache denied. | No | KEEP | `headache`, line 360 |
| H-025 | Limb numbness denied. | No | KEEP | `numbness`, line 361 |
| H-026 | Visual problems denied. | No | KEEP | `visionprob`, line 362 |
| H-027 | Hearing problems denied. | No | KEEP | `hearingprob`, line 363 |
| H-028 | Seizure history denied. | No | KEEP | `seizure`, line 364 |
| H-029 | Dysuria denied. | No | KEEP | `dysuria`, line 367 |
| H-030 | Urine described as normal light yellow. | No | KEEP | `urinecolor`, line 368 |
| H-031 | Urinary frequency denied. | No | KEEP | `urinefreq`, line 369 |
| H-032 | Hematuria denied. | No | KEEP | `bloodurine`, line 370 |
| H-033 | Abnormal urine odor denied. | No | KEEP | `urinesmell`, line 371 |
| H-034 | Mild dizziness. | Yes | KEEP | `dizzy`, line 374 |
| H-035 | No syncope, but feels near-faint. | Yes | KEEP | `syncope`, line 375 |
| H-036 | Palpitations/rapid heartbeat sensation. | Yes | KEEP | `palpitations`, line 378 |
| H-037 | Fever/chills denied. | Yes | KEEP | `fever`, line 380 |
| H-038 | General fatigue/weakness. | No | KEEP | `fatigue`, line 381 |
| H-039 | PMH: diabetes, hypertension, hyperlipidemia. | Yes | KEEP | `pastHistory.pmh`, line 385 |
| H-040 | Prior hospitalization “a few years ago because of blood pressure”; details absent. | No | UNKNOWN_DISCUSS | `hospitalized`, line 386 |
| H-041 | Prior surgery denied. | No | KEEP | `surgeries`, line 387 |
| H-042 | Daily medications: Aspirin, Metformin, Amlodipine, Atorvastatin; doses/frequencies/adherence absent. | Yes | CORRECT | `meds`, line 388 |
| H-043 | Allergy answer says “No, I do not know that I have an allergy”; should not silently become stronger certainty. | Yes | CORRECT | `allergy`, line 389 |
| H-044 | Father died at age 60 from a heart attack. | Yes | KEEP | `familyHistory.family`, line 391 |
| H-045 | Smoking: about one pack/day for about 40 years. | Yes | KEEP | `socialHistory.smoking`, line 393 |
| H-046 | Alcohol denied. | No | KEEP | `alcohol`, line 394 |
| H-047 | Recreational substances denied. | No | KEEP | `drugs`, line 395 |
| H-048 | Occupation: taxi driver. | No | KEEP | `occupation`, line 396 |

### History delivery behavior

| ID | Extracted behavior | Classification | V1 source |
|---|---|---|---|
| H-049 | Catalogue questions reveal static answers once; repeat clicks are ignored through `historyAsked`. | REPLACE | `askHistory`, lines 785–792 |
| H-050 | Three questions (`smoking`, `radiation`, `family`) generate immediate positive live feedback; other required questions do not. | REPLACE | lines 788–790 |
| H-051 | Free text and catalogue paths use the same fact text, but free-text questions are not recorded in `historyAsked` and therefore earn no history score. | CORRECT | lines 804–827 versus 785–792, 1101–1104 |
| H-052 | An “Other (ask freely)” complaint accordion exists with no authored questions and only directs the learner to free text. | DISCARD | `complaints.other`, lines 382, 773 |

## Physical examination

All results are static and require clinical review before migration.

| ID | Examination and complete V1 result | Classification | V1 source |
|---|---|---|---|
| E-001 | Heart: clear tachycardia; no audible murmur or friction rub; no visible abnormal pulsation; apex not displaced; no thrill. | KEEP | `examOrgans.heart`, line 399 |
| E-002 | Chest/lungs: bilateral clear air entry, no crackles/wheeze; rapid symmetric movement, no obvious accessory use; non-tender, no subcutaneous emphysema. | KEEP | `chest`, line 400 |
| E-003 | Abdomen: normal bowel sounds; flat, no distension/scars; soft, non-tender, no mass/guarding. | KEEP | `abdomen`, line 401 |
| E-004 | Limbs: auscultation not applicable; peripheral pallor, no edema; cool extremities, delayed capillary refill, weak palpable pulses. | KEEP | `limbs`, line 402 |
| E-005 | Neurologic: auscultation not applicable; alert, tracking, no visible seizure; GCS 15, normal strength, no focal deficit. | KEEP | `neuro`, line 403 |
| E-006 | Skin: auscultation not applicable; marked pallor and profuse diaphoresis, no rash/jaundice; cool and clammy. | KEEP | `skin`, line 404 |
| E-007 | Opening an organ accordion counts the full organ as examined and reveals inspection/auscultation/palpation together; no action identity per technique. | REPLACE | `renderExamOrgans`, lines 856–874 |
| E-008 | Examination has no Clinical-Time cost, state dependency, repeat policy, or committed evidence beyond an in-memory set. | REPLACE | lines 863–866, 1105 |

## Investigations and results

### Investigations with authored V1 results

| ID | Investigation | V1 timing/result/media | Classification | V1 source |
|---|---|---|---|---|
| I-001 | ECG (`ecg`) | `2` min. Text: clear ST elevation in leads II, III, aVF. | KEEP | `realTests.ecg`, line 407 |
| I-002 | ECG asset | Inline JPEG data URL, 1000×571, 150,278 decoded bytes, SHA-256 `76E080B9A4F3E8599266E94EDFED2B7C71DFA13839802CAC5374214E55CACD10`; no provenance/review metadata. | UNKNOWN_DISCUSS | line 407 |
| I-003 | Troponin (`troponin`) | `5` min. Troponin I `4.80 ng/mL`, reference `0.00–0.04`, flag `H`. | KEEP | line 408 |
| I-004 | CBC (`cbc`) | `4` min. WBC `8.2 x10³/µL` (`4.0–11.0`); Hb `14.1 g/dL` (`13.0–17.0`); Hct `42%` (`40–52`); platelets `230 x10³/µL` (`150–400`). | KEEP | line 409 |
| I-005 | BMP/electrolytes (`bmp`) | `4` min. Na `138 mmol/L` (`135–145`); K `4.2` (`3.5–5.1`); Cl `101` (`98–107`); HCO3 `21` (`22–29`, `L`). | KEEP | line 410 |
| I-006 | KFT (`kft`) | `5` min. BUN `32 mg/dL` (`7–20`, `H`); creatinine `1.1 mg/dL` (`0.7–1.3`); eGFR `78 mL/min/1.73m²` (`>90`, `L`). | KEEP | line 411 |
| I-007 | ABG (`abg`) | `3` min. pH `7.32` (`7.35–7.45`, `L`); pCO₂ `34 mmHg` (`35–45`, `L`); pO₂ `78 mmHg` (`80–100`, `L`); HCO3 `18 mmol/L` (`22–26`, `L`); lactate `2.1 mmol/L` (`0.5–1.6`, `H`). | KEEP | line 412 |
| I-008 | Blood sugar (`bloodsugar`) | `2` min. Random glucose `178 mg/dL`, reference `74–106`, flag `H`. | KEEP | line 413 |
| I-009 | Chest X-ray (`cxr`) | `6` min. Text says normal, no pneumothorax or widened mediastinum. | KEEP | line 414 |
| I-010 | Chest X-ray asset | Inline JPEG data URL, 700×700, 60,169 decoded bytes, SHA-256 `F0D48035FE34F8FA2C661BFC50E95CBDD3F6A00B5C44BCCBFF2F819DA07EED7A`; no provenance/review metadata. | UNKNOWN_DISCUSS | line 414 |
| I-011 | Echocardiogram (`echo`) | `8` min. Inferior-wall hypokinesia; EF approximately `40%`; text only. | KEEP | line 415 |
| I-012 | Shared result behavior | All “real” results become visible immediately after synchronously adding `timeCost`; there is no pending/result-ready phase or parallel completion. | REPLACE | `orderRealTest`, lines 897–913 |

### Decoy/unnecessary investigation catalogue

Each item is orderable once, synchronously advances `simMin`, shows a generic “normal/not relevant” answer (except the β-hCG note), and deducts `penalty × 2` from the investigation domain. Medical relevance and penalty require review.

| ID | V1 ID / label | Time cost | Penalty | Classification | V1 source |
|---|---|---:|---:|---|---|
| I-013 | `crp` / CRP | 8 min | 2 | UNKNOWN_DISCUSS | line 418 |
| I-014 | `ddimer` / D-dimer | 20 min | 2 | UNKNOWN_DISCUSS | line 419 |
| I-015 | `ptinr` / PT/INR | 10 min | 2 | UNKNOWN_DISCUSS | line 420 |
| I-016 | `lft` / LFT | 10 min | 3 | UNKNOWN_DISCUSS | line 421 |
| I-017 | `vitd` / Vitamin D | 45 min | 4 | UNKNOWN_DISCUSS | line 422 |
| I-018 | `tumormarker` / Tumor Marker | 50 min | 4 | UNKNOWN_DISCUSS | line 423 |
| I-019 | `betahcg` / β-hCG; note says not applicable because patient is male | 15 min | 3 | UNKNOWN_DISCUSS | line 424 |
| I-020 | `ctbrain` / CT Brain | 40 min | 4 | UNKNOWN_DISCUSS | line 425 |
| I-021 | `ctchest` / CT Chest | 35 min | 3 | UNKNOWN_DISCUSS | line 426 |
| I-022 | `ctabdomen` / CT Abdomen | 40 min | 4 | UNKNOWN_DISCUSS | line 427 |
| I-023 | `abdxray` / Abdominal X-ray | 15 min | 2 | UNKNOWN_DISCUSS | line 428 |
| I-024 | `ultrasound` / abdominal ultrasound | 25 min | 2 | UNKNOWN_DISCUSS | line 429 |
| I-025 | `bloodculture` / Blood Culture | 30 min | 3 | UNKNOWN_DISCUSS | line 430 |
| I-026 | `urinalysis` / Urine Analysis | 15 min | 2 | UNKNOWN_DISCUSS | line 431 |
| I-027 | `covidflu` / COVID/Flu | 20 min | 2 | UNKNOWN_DISCUSS | line 432 |
| I-028 | `colonoscopy` / Colonoscopy | 60 min | 5 | UNKNOWN_DISCUSS | line 433 |
| I-029 | `lipase` / Lipase | 12 min | 3 | UNKNOWN_DISCUSS | line 434 |
| I-030 | `ckmb` / CK-MB | 15 min | 1 | UNKNOWN_DISCUSS | line 435 |
| I-031 | `lactatestandalone` / standalone Lactate | 8 min | 1 | UNKNOWN_DISCUSS | line 436 |
| I-032 | `toxicology` / Toxicology | 30 min | 3 | UNKNOWN_DISCUSS | line 437 |
| I-033 | Generic fabricated “normal (not relevant)” result is used without per-test data, units, report, or provenance. | — | — | REPLACE | `orderDecoyTest`, lines 914–919 |

## Non-medication actions, fluids, and procedures

The classification evaluates the V1 item as migration source material, not whether it is medically correct.

| ID | V1 action | Verdict/message or encoded effect | Classification | V1 source |
|---|---|---|---|---|
| A-001 | `monitor` / ABC + Cardiac Monitor | `correct`; “foundational ACS step”; no patient-state effect. | KEEP | line 440 |
| A-002 | `ivaccess` / IV Access ×2 | `correct`; unlocks any route string containing `IV`. | KEEP | line 441; lines 966–970 |
| A-003 | `oxygen` | `correct`; adds 4 SpO₂ points, capped at 97. | UNKNOWN_DISCUSS | line 442; lines 942–947 |
| A-004 | `cathlab` / activate Cath Lab + Primary PCI | `correct`; sets one Boolean used in recovery bundle. | KEEP | line 443; lines 942–947 |
| A-005 | `foley` / Foley catheter | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 444 |
| A-006 | `ngtube` / NG tube | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 445 |
| A-007 | `ns09` / 0.9% normal saline | `neutral`; “acceptable cautiously”; no hemodynamic effect. | UNKNOWN_DISCUSS | line 448 |
| A-008 | `rl` / Ringer lactate | `neutral`; “acceptable alternative”; no effect. | UNKNOWN_DISCUSS | line 449 |
| A-009 | `d5w` | `unnecessary`; no effect. | UNKNOWN_DISCUSS | line 450 |
| A-010 | `ns045` / 0.45% normal saline | `neutral`; no effect. | UNKNOWN_DISCUSS | line 451 |
| A-011 | `d10` | `wrong`; sugar target rises by 30 over 5 simulated minutes. | UNKNOWN_DISCUSS | line 452; line 936 |
| A-012 | `d50` | `critical`; sugar target rises by 90 over 4 simulated minutes. | UNKNOWN_DISCUSS | line 453; line 936 |
| A-013 | `chesttube` | `wrong`; no pneumothorax; feedback only. | UNKNOWN_DISCUSS | line 456 |
| A-014 | `bloodtransfusion` | `wrong`; no bleeding/anemia; feedback only. | UNKNOWN_DISCUSS | line 457 |
| A-015 | `ffp` | `wrong`; no documented coagulopathy; feedback only. | UNKNOWN_DISCUSS | line 458 |
| A-016 | `platelets` | `wrong`; no thrombocytopenia; feedback only. | UNKNOWN_DISCUSS | line 459 |
| A-017 | `albumin` | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 460 |
| A-018 | `cardioversion` | `critical`; message says only sinus tachycardia is documented; no state effect. | UNKNOWN_DISCUSS | line 461 |
| A-019 | `cvl` / central venous line | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 462 |
| A-020 | `aline` / arterial line | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 463 |
| A-021 | Every successful initial action/fluid/procedure is once-only and instantly adds `0.5` simulated minutes; no authored duration or completion state. | Shared execution behavior | REPLACE | lines 932–947 |
| A-022 | IV prerequisite is inferred by substring search on a display route (for example `SL/IV`, `IV/PO`, `IV/SC`), not the selected administration route. | Prerequisite bug/ambiguity | CORRECT | `needsIVAccess`, lines 966–970, 986–989 |

## Medications

No medication has an authored dose, frequency, formulation, or explicit administration parameters. `verdict` and message are V1 claims requiring clinical review. All are disabled after one successful administration; routes containing the characters `IV` require prior `ivaccess` even when alternatives are displayed.

| ID | Display / internal ID | Generic; class; route | V1 verdict and encoded effect | Classification | V1 source |
|---|---|---|---|---|---|
| M-001 | Adrenaline / `adrenaline` | Epinephrine; vasopressor/inotrope; IV | `critical`; direct HR +20, SBP +10. | UNKNOWN_DISCUSS | line 466; `VITAL_EFFECTS`, line 975 |
| M-002 | Amiodarone / `amiodarone` | Amiodarone HCl; class III antiarrhythmic; IV | `wrong`; direct HR −8. | UNKNOWN_DISCUSS | line 467; line 976 |
| M-003 | Aspirin / `aspirin` | Acetylsalicylic acid; antiplatelet; PO | `correct`; only sets `aspirinGiven=true`; no dose. | UNKNOWN_DISCUSS | line 468; line 990 |
| M-004 | Atropine / `atropine` | Atropine sulfate; anticholinergic; IV | `wrong`; direct HR +15. | UNKNOWN_DISCUSS | line 469; line 975 |
| M-005 | Calcium gluconate / `calciumgluc` | Electrolyte; IV | `wrong`; feedback only. | UNKNOWN_DISCUSS | line 470 |
| M-006 | Clopidogrel / `clopidogrel` | P2Y12 inhibitor; PO | `correct`; feedback/scoring only; no dose. | UNKNOWN_DISCUSS | line 471 |
| M-007 | Dexamethasone / `dexamethasone` | Corticosteroid; IV | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 472 |
| M-008 | Dextrose / `dextrose` | Dextrose 50%; carbohydrate; IV | `wrong`; sugar target +80 over 4 min. | UNKNOWN_DISCUSS | line 473; line 993 |
| M-009 | Diazepam / `diazepam` | Benzodiazepine; IV/PO | `unnecessary`; direct RR −2, HR −3; IV substring forces IV access. | UNKNOWN_DISCUSS | line 474; line 976 |
| M-010 | Dobutamine / `dobutamine` | Inotrope; IV infusion | `wrong`; direct HR +15, SBP +5. | UNKNOWN_DISCUSS | line 475; line 974 |
| M-011 | Dopamine / `dopamine` | Vasopressor/inotrope; IV infusion | `wrong`; direct SBP +12, DBP +8, HR +8. | UNKNOWN_DISCUSS | line 476; line 973 |
| M-012 | Enoxaparin / `enoxaparin` | LMWH; SC | `correct`; feedback/scoring only; no dose. | UNKNOWN_DISCUSS | line 477 |
| M-013 | Fentanyl / `fentanyl` | Opioid; IV | `good`; direct HR −6, RR −3, pain −3 with fixed floors. | UNKNOWN_DISCUSS | line 478; line 991 |
| M-014 | Hydrocortisone / `hydrocortisone` | Corticosteroid; IV | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 479 |
| M-015 | Ibuprofen / `ibuprofen` | NSAID; PO | `critical`; feedback/critical-error entry only. | UNKNOWN_DISCUSS | line 480 |
| M-016 | Insulin / `insulin` | Regular insulin; IV/SC | `wrong`; sugar target −70 over 6 min; IV substring forces IV access. | UNKNOWN_DISCUSS | line 481; line 992 |
| M-017 | Ipratropium / `ipratropium` | Inhaled anticholinergic bronchodilator | `wrong`; feedback only. | UNKNOWN_DISCUSS | line 482 |
| M-018 | Labetalol / `labetalol` | Alpha/beta blocker; IV | `critical`; direct SBP −15, DBP −10, HR −10. | UNKNOWN_DISCUSS | line 483; line 974 |
| M-019 | Magnesium sulfate / `magnesium` | Electrolyte/antiarrhythmic; IV | `unnecessary`; direct HR −3. | UNKNOWN_DISCUSS | line 484; line 976 |
| M-020 | Methylprednisolone / `methylprednisolone` | Corticosteroid; IV | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 485 |
| M-021 | Morphine / `morphine` | Opioid; IV | `good`; direct HR −6, RR −3, pain −3 with fixed floors. | UNKNOWN_DISCUSS | line 486; line 991 |
| M-022 | Nicardipine / `nicardipine` | Calcium-channel blocker; IV infusion | `critical`; direct SBP −18, DBP −12. | UNKNOWN_DISCUSS | line 487; line 975 |
| M-023 | Nitroglycerin / `nitroglycerin` | Nitrate/vasodilator; SL/IV | `conditional`; requires IV access because route contains IV. If SBP <90, starts scripted 6-min collapse; otherwise direct SBP −8 with floor 90. | UNKNOWN_DISCUSS | line 488; lines 995–1005 |
| M-024 | Noradrenaline / `noradrenaline` | Norepinephrine; IV infusion | `wrong`; direct SBP +15, DBP +10, HR +5. | UNKNOWN_DISCUSS | line 489; line 973 |
| M-025 | Omeprazole / `omeprazole` | PPI; IV/PO | `unnecessary`; feedback only; IV substring forces IV access. | UNKNOWN_DISCUSS | line 490 |
| M-026 | Ondansetron / `ondansetron` | 5-HT3 antiemetic; IV | `good`; feedback only. | UNKNOWN_DISCUSS | line 491 |
| M-027 | Pantoprazole / `pantoprazole` | PPI; IV | `unnecessary`; feedback only. | UNKNOWN_DISCUSS | line 492 |
| M-028 | Paracetamol / `paracetamol` | Acetaminophen; IV/PO | `unnecessary`; feedback only; IV substring forces IV access. | UNKNOWN_DISCUSS | line 493 |
| M-029 | Phenylephrine / `phenylephrine` | Vasopressor; IV infusion | `wrong`; direct SBP +15, DBP +12, HR −3. | UNKNOWN_DISCUSS | line 494; line 974 |
| M-030 | Salbutamol / `salbutamol` | Inhaled beta-2 agonist | `wrong`; direct HR +8. | UNKNOWN_DISCUSS | line 495; line 976 |
| M-031 | Vasopressin / `vasopressin` | Vasopressor; IV infusion | `wrong`; direct SBP +15, DBP +10. | UNKNOWN_DISCUSS | line 496; line 973 |
| M-032 | Ceftriaxone / `ceftriaxone` | Cephalosporin; IV | `wrong`; feedback only. | UNKNOWN_DISCUSS | line 497 |
| M-033 | Piperacillin/tazobactam / `piperacillin` | Penicillin antibiotic; IV | `wrong`; feedback only. | UNKNOWN_DISCUSS | line 498 |
| M-034 | Amoxicillin / `amoxicillin` | Penicillin antibiotic; PO | `wrong`; feedback only. | UNKNOWN_DISCUSS | line 499 |
| M-035 | Vancomycin / `vancomycin` | Glycopeptide; IV | `wrong`; feedback only. | UNKNOWN_DISCUSS | line 500 |
| M-036 | Sodium bicarbonate / `sodiumbicarb` | Alkalinizing agent; IV | `wrong`; feedback only. | UNKNOWN_DISCUSS | line 501 |
| M-037 | Adenosine / `adenosine` | Antiarrhythmic; rapid IV push | `wrong`; feedback only. | UNKNOWN_DISCUSS | line 502 |
| M-038 | All medications | Parameters absent | Dose/frequency/formulation/route selection is absent for every drug. | CORRECT | `drugs`, lines 465–502; modal lines 954–964 |
| M-039 | All medications | Shared execution behavior | Success is button-driven, once-only, and costs a fixed 0.5 simulated minutes regardless of item. | REPLACE | `commitDrug`, lines 986–1007 |
| M-040 | Drugs with coded effects | Embedded medical logic | Generic `VITAL_EFFECTS` and opioid/sugar special cases directly mutate displayed numeric vitals. | REPLACE | lines 972–994 |

## Diagnosis, disposition, and completion

| ID | V1 item | Encoded behavior | Classification | V1 source |
|---|---|---|---|---|
| D-001 | Acute Inferior STEMI | Exact “correct” diagnosis. | KEEP | UI line 270; `correctDiagnosis`, line 513 |
| D-002 | NSTEMI | “Partial” diagnosis worth 50. | UNKNOWN_DISCUSS | UI line 270; `partialDiagnoses`, line 514 |
| D-003 | Unstable Angina | “Partial” diagnosis worth 50. | UNKNOWN_DISCUSS | UI line 270; line 514 |
| D-004 | Pulmonary Embolism | “Wrong”; no special consequence. | UNKNOWN_DISCUSS | UI line 271; `submitDiagnosis`, lines 1071–1077 |
| D-005 | Aortic Dissection | “Wrong”; no special consequence. | UNKNOWN_DISCUSS | UI line 271; lines 1071–1077 |
| D-006 | GERD | “Wrong” and adds a critical-error entry. | UNKNOWN_DISCUSS | UI line 271; line 1076 |
| D-007 | Costochondritis | “Wrong”; no special consequence. | UNKNOWN_DISCUSS | UI line 272 |
| D-008 | Panic Attack | “Wrong”; no special consequence. | UNKNOWN_DISCUSS | UI line 272 |
| D-009 | Pericarditis | “Wrong”; no special consequence. | UNKNOWN_DISCUSS | UI line 272 |
| D-010 | Pneumothorax | “Wrong”; no special consequence. | UNKNOWN_DISCUSS | UI line 272 |
| D-011 | First submitted diagnosis locks the selector; diagnosis does not change patient state or control disposition. | UI/assessment behavior | REPLACE | lines 1071–1078 |
| D-012 | Cath Lab / Primary PCI immediately | “Correct” disposition, 100 points. | KEEP | `dispositions`, line 505 |
| D-013 | ICU / CCU | “Partial”, 50 points; message says acceptable later but not a substitute for Cath Lab. | UNKNOWN_DISCUSS | lines 506, 1087 |
| D-014 | Ward | “Wrong”, 0 points. | UNKNOWN_DISCUSS | line 507 |
| D-015 | General admission | “Wrong”, 0 points. | UNKNOWN_DISCUSS | line 508 |
| D-016 | OR | “Wrong”, 0 points. | UNKNOWN_DISCUSS | line 509 |
| D-017 | Transfer to another hospital | “Wrong”, 0 points, with no context about PCI capability/transport. | UNKNOWN_DISCUSS | line 510 |
| D-018 | Discharge home | “Wrong”, 0 points. | UNKNOWN_DISCUSS | line 511 |
| D-019 | First disposition click locks all options; no diagnosis/treatment prerequisite is enforced. | UI/assessment behavior | REPLACE | `chooseDisposition`, lines 1083–1089 |
| D-020 | Learner may manually end at any point from the disposition tab. | Completion behavior | UNKNOWN_DISCUSS | UI line 284; `endCase`, lines 1118–1140 |
| D-021 | Arrest automatically invokes end/report; `endCase` is asynchronous and not awaited. | Completion behavior | CORRECT | `triggerArrest`, lines 663–666 |
| D-022 | Recovery sets `resolved=true` but does not stop the clock or automatically end; learner must still end manually. | Completion inconsistency | CORRECT | `resolveCase`, line 668; `tick`, line 610 |

## Dynamic physiology and hard-coded clinical transitions

These rules are inventory only. None is approved for migration.

| ID | Trigger → condition → effect → timing | Classification | V1 source |
|---|---|---|---|
| R-001 | Browser interval fires → session running/not ended → add `1/60` sim minute → every nominal 1 second. | REPLACE | `SIM_MIN_PER_SEC`, line 522; `tick`, line 610; `setInterval`, line 604 |
| R-002 | Any investigation/action → `jumpTime(m)` → synchronously add minutes, run physiology once, render → immediate wall time. | REPLACE | `jumpTime`, line 611 |
| R-003 | Sugar drift configured → interpolate from current sugar to target → over configured 4/5/6 sim minutes. | REPLACE | lines 542–546, 620–623 |
| R-004 | Nitro given while SBP <90 → set crisis flag/time → scripted movement from HR 118/SBP 85/DBP 60/SpO₂ 90 toward 130/70/40/80, GCS 13 → linearly over 6 min. | REPLACE | lines 625–632, 995–1000 |
| R-005 | Nitro-crisis fraction reaches 1 → call arrest regardless of intervening treatment. | REPLACE | line 631 |
| R-006 | ECG ordered + aspirin given + cath lab activated → start recovery → BP to 112/72, HR to 84, SpO₂ to 97, GCS 15 → linearly over 4 min. | REPLACE | lines 636–643 |
| R-007 | Recovery fraction reaches 1 → set `resolved=true`; no event, explicit state transition, or completion. | REPLACE | lines 642, 668 |
| R-008 | Not in crisis/recovery and ECG absent → continuous deterioration rate `1.1` per elapsed minute. | REPLACE | lines 646–652 |
| R-009 | Same path with ECG ordered → slower deterioration rate `0.45`; ECG alone changes physiology. | REPLACE | lines 646–652 |
| R-010 | Deterioration formula: HR +`rate`; SBP −`0.6×rate`; DBP −`0.4×rate`; SpO₂ −`0.15×rate`, with numeric caps/floors. | REPLACE | lines 648–652 |
| R-011 | SBP <70 or SpO₂ <80 → GCS becomes 13; no explicit neurologic/consciousness transition. | REPLACE | line 653 |
| R-012 | SBP ≤65 or SpO₂ ≤78 or HR ≥145 → start neglect timer; if condition clears, reset it. | REPLACE | lines 655–661 |
| R-013 | Critical-threshold condition persists 8 min → trigger arrest. | REPLACE | lines 655–658 |
| R-014 | Arrest → overwrite all vitals with BP/HR/RR/SpO₂/pain zero, GCS 3, retain sugar, reset temperature to 36.8; log “VT then cardiac arrest.” | REPLACE | `triggerArrest`, lines 663–666 |
| R-015 | Oxygen click → direct SpO₂ +4 (cap 97) after a 0.5-min time jump. | REPLACE | lines 942–947 |
| R-016 | Morphine or fentanyl → direct HR −6, RR −3, pain −3 with fixed floors. | REPLACE | line 991 |
| R-017 | Twelve drugs in `VITAL_EFFECTS` → fixed immediate numeric BP/HR/RR changes with generic bounds. | REPLACE | lines 972–984, 994 |
| R-018 | HR >125 or SBP <75 → show synthetic `vtach` waveform; HR >105 or SBP <90 → `tach`; otherwise `normal`; arrest shows flatline. | REPLACE | `renderVitals`, lines 716–719; `drawWave`, lines 722–728 |
| R-019 | Vital thresholds → computed status/appearance text (`critical`, `stable`, etc.). | REPLACE | lines 673–693 |
| R-020 | AI/local order parser returns IDs → DOM buttons clicked sequentially → each click may advance time and alter later command behavior. | REPLACE | `executeOrderId`, lines 1023–1026; `parseOrders`, lines 1037–1065 |
| R-021 | `state.arrested` or `state.resolved` → physiology returns immediately; for resolved state the interval still advances `simMin`. | CORRECT | lines 610, 614–615, 668 |
| R-022 | No defibrillation, CPR, post-arrest treatment, rhythm recovery, spontaneous reperfusion, or other complication branch exists. | UNKNOWN_DISCUSS | No corresponding V1 rule/action |

## Dedicated timing inventory

“Timing class” describes how V1 uses the value; it is not V2 approval.

| ID | V1 time assumption | Timing class | Behavior | Classification | V1 source |
|---|---|---|---|---|---|
| T-001 | Symptom onset “about one hour ago.” | CLINICAL | Patient-reported, approximate; no link to simulation clock. | KEEP | line 331 |
| T-002 | Arrival `02:34 AM`. | AMBIGUOUS | Display-only time with no date/timezone or engine use. | UNKNOWN_DISCUSS | line 325 |
| T-003 | Nominal 1:1 clock. | CLINICAL | One simulated second per interval callback, not elapsed trusted time. | REPLACE | lines 522, 603–610 |
| T-004 | Real investigations: ECG 2, troponin 5, CBC 4, BMP 4, KFT 5, ABG 3, glucose 2, CXR 6, echo 8 minutes. | CLINICAL | Each cost is an immediate synchronous clock jump. | UNKNOWN_DISCUSS | lines 407–415, 897–913 |
| T-005 | Decoy investigations: 8–60 minutes per catalogue value. | CLINICAL | Immediate synchronous jump; values listed in I-013–I-032. | UNKNOWN_DISCUSS | lines 418–437, 914–919 |
| T-006 | Every initial action, fluid, procedure, or medication costs 0.5 minute. | AMBIGUOUS | Hard-coded shared action delay, not authored per action. | REPLACE | lines 936–944, 989 |
| T-007 | D10 sugar drift 5 minutes. | CLINICAL | Linear numeric interpolation. | UNKNOWN_DISCUSS | line 936 |
| T-008 | D50 fluid and dextrose drug sugar drift 4 minutes. | CLINICAL | Linear numeric interpolation. | UNKNOWN_DISCUSS | lines 936, 993 |
| T-009 | Insulin sugar drift 6 minutes. | CLINICAL | Linear numeric interpolation. | UNKNOWN_DISCUSS | line 992 |
| T-010 | Nitro crisis to arrest 6 minutes. | CLINICAL | Fixed scripted crisis. | UNKNOWN_DISCUSS | lines 625–632 |
| T-011 | Recovery bundle stabilizes patient in 4 minutes. | CLINICAL | Fixed scripted recovery. | UNKNOWN_DISCUSS | lines 636–643 |
| T-012 | Critical thresholds must persist 8 minutes before arrest. | CLINICAL | Reset if all thresholds clear. | UNKNOWN_DISCUSS | lines 655–661 |
| T-013 | ECG at or before 10 simulated minutes gets positive live feedback; later gets delay feedback. | CLINICAL/ASSESSMENT | Does not directly change numeric score. | UNKNOWN_DISCUSS | lines 907–910 |
| T-014 | AI patient/order/final-feedback network latency. | TECHNICAL | Interval keeps advancing while requests await; order-parser latency can therefore change clinical state/time before execution. | REPLACE | fetch calls lines 840–850, 1048–1065, 1148–1153; interval line 604 |
| T-015 | `setTimeout(...,0)` after case selection. | UI_ONLY | Sticky-layout calculation only. | DISCARD | lines 568–577 |
| T-016 | ECG monitor scroll animation 3 seconds. | UI_ONLY | CSS animation; no clinical meaning. | DISCARD | line 47 |
| T-017 | Result visibility. | AMBIGUOUS | Result appears after the clock is jumped; there is no real pending period or separate image/report availability. | REPLACE | lines 897–917 |
| T-018 | Browser sleep/background throttling. | TECHNICAL | Fixed callback increments lose elapsed time; no trusted elapsed-time catch-up. | REPLACE | `tick`/`setInterval`, lines 604, 610 |
| T-019 | Resolved state. | CLINICAL | Clinical values freeze, but displayed simulation clock continues until manual end. | CORRECT | lines 610, 614–615, 668 |
| T-020 | Final AI narrative delay. | TECHNICAL | Session is already ended; only report text waits/falls back. | DISCARD | lines 1118–1156 |

## Scoring and assessment

| ID | V1 scoring rule | Classification | V1 source |
|---|---|---|---|
| Q-001 | History domain = required catalogue questions asked / 20, rounded to percent. Free-text equivalents do not count. | REPLACE | `requiredHistoryList`/`computeScores`, lines 1095–1104 |
| Q-002 | Examination domain = number of six organ accordions opened / 6. | REPLACE | line 1105 |
| Q-003 | Investigation base score = number of all nine `realTests` ordered / 9, regardless of prioritization or necessity. | REPLACE | line 1106 |
| Q-004 | Each decoy penalty is summed then doubled and subtracted from investigation percent, clamped 0–100. | REPLACE | lines 1107–1108 |
| Q-005 | Diagnosis domain = 100 exact, 50 partial, otherwise 0. | REPLACE | line 1109 |
| Q-006 | Treatment base = count of seven required treatment IDs / 7. | REPLACE | lines 515, 1110–1111 |
| Q-007 | Required treatments are monitor, IV access, oxygen, aspirin, clopidogrel, enoxaparin, and cath-lab activation. | UNKNOWN_DISCUSS | line 515 |
| Q-008 | Each critical-error entry subtracts 20 points from treatment domain. | UNKNOWN_DISCUSS | line 1112 |
| Q-009 | Failure to order ECG subtracts another 15 treatment points even though ECG also belongs to investigations. | CORRECT | line 1112 |
| Q-010 | Disposition domain = 100 correct, 50 partial, otherwise 0. | REPLACE | line 1114 |
| Q-011 | Total = rounded unweighted mean of six domains: history, exam, tests, diagnosis, treatment, disposition. | UNKNOWN_DISCUSS | lines 1093, 1115–1116 |
| Q-012 | JavaScript `Math.round` performs domain and total rounding. | KEEP | lines 1104–1115 |
| Q-013 | Immediate positive/warning/negative feedback exposes correctness during the session; there is no Practice/Assessment disclosure distinction. | REPLACE | `logFeedback`, lines 753–758 and action handlers |
| Q-014 | Sets prevent repeat credit for successful catalogue actions/tests/exams/history; first diagnosis/disposition locks. | KEEP | lines 786, 865, 898, 915, 943, 987, 1077, 1084–1089 |
| Q-015 | Repeated blocked IV attempts create repeated live feedback but only one critical error per item via `_ivWarned`. | REPLACE | lines 967–970 |
| Q-016 | ECG timing gives feedback only, not a defined score bonus/penalty; most other Clinical-Time windows are absent from scoring. | CORRECT | lines 907–912 versus 1101–1116 |
| Q-017 | Arrest does not impose an explicit score cap/failure rule; the pre-arrest checklist can still yield points. | CORRECT | `endCase`/`computeScores`, lines 1101–1124 |
| Q-018 | Score evidence is mutable sets/flags and button clicks, not authoritative committed events with IDs/sequences. | REPLACE | `freshState`, lines 536–539; `computeScores`, lines 1101–1116 |

## AI patient, free-text orders, and language

No credential literal or authorization header is present in V1. A public worker endpoint is embedded; its server-side configuration was not inspected or called.

| ID | Extracted behavior | Nature | Classification | V1 source |
|---|---|---|---|---|
| AI-001 | Remote worker URL `https://ai-expo-proxy.aws-abujudeh.workers.dev`. | Client-coupled provider gateway | REPLACE | `WORKER_URL`, line 523 |
| AI-002 | Request model literal `claude-sonnet-5` is sent for patient, order parser, and final narrative. Provider is not otherwise identified in client code. | Provider/model coupling | REPLACE | lines 841, 1049, 1149 |
| AI-003 | Patient system prompt receives all 48 authored history facts on every free-text turn. | Dialogue context | KEEP | `allKnownFactsText`, lines 804–808; prompt lines 835–839 |
| AI-004 | Patient persona: conscious 58-year-old with a real but undisclosed MI, tired, in pain, afraid, short Jordanian Arabic replies. | Dialogue policy candidate | KEEP | lines 835–839 |
| AI-005 | Prompt says answer only from supplied facts, be vague for unknowns, never invent exam/diagnosis, never name diagnosis, always remain able to answer. | Prompt-only guardrail | REPLACE | lines 837–839 |
| AI-006 | AI response can hallucinate or disclose supplied facts because output is unvalidated free text; it cannot directly write V1 state. | Non-authoritative chat output | UNKNOWN_DISCUSS | lines 840–846 |
| AI-007 | Local free-text fallback token-matches Arabic question text against catalogue questions at ≥0.5 ratio. | String-matching interpretation | REPLACE | `localAnswerLookup`, lines 810–825 |
| AI-008 | Unmatched local fallback randomly selects one of three generic replies using `Math.random`. | Nondeterministic dialogue | REPLACE | lines 826–827 |
| AI-009 | Free-text chat is disabled only after `state.arrested`; changing GCS or resolved status does not block it. | Dialogue/state inconsistency | CORRECT | `sendChat`, line 830 |
| AI-010 | Order parser sends the entire tests+treatments catalogue and asks the AI for a JSON ID array. | Intent parser | REPLACE | lines 1013–1021, 1042–1055 |
| AI-011 | Returned IDs are not runtime-schema validated; matching DOM buttons are clicked and can change authoritative V1 state. | AI-to-execution coupling | REPLACE | lines 1053–1065, 1023–1026 |
| AI-012 | The `scope` argument selects only the textbox/result element; a tests request can execute treatment IDs and vice versa. | Scope bug | CORRECT | lines 1037–1043; full catalogue lines 1013–1021 |
| AI-013 | Local order fallback matches whole labels, IDs, or any label word longer than two characters; broad substring matches can over-select. | Ambiguous string matching | REPLACE | lines 1028–1035 |
| AI-014 | Patient and order AI failures fall back locally; final narrative failure uses deterministic template text. | Fallback boundary | KEEP | lines 847–850, 1057–1060, 1152–1156 |
| AI-015 | No conversation history is sent to the patient model; each free-text turn contains only the current question plus full fact prompt. | Dialogue limitation | UNKNOWN_DISCUSS | request body line 841 |
| AI-016 | AI is not used to decide numeric score, but generates final prose from mutable feedback log, total score, diagnosis, and disposition. | AI-generated debrief prose | REPLACE | lines 1142–1153 |
| AI-017 | Patient language is Arabic only in V1 UI/prompt; no `ar-JO`/`en-US` patient-language contract or authored localization keys exist. | Localization gap | CORRECT | document `lang="ar"`, line 2; prompt lines 835–839 |
| AI-018 | `voice` metadata exists but no speech synthesis, microphone, audio element, or audio playback uses it. | Dead metadata | DISCARD | line 327; no voice/audio use |

## Visual, monitor, and media inventory

| ID | V1 item | Truth category | Classification | V1 source |
|---|---|---|---|---|
| V-001 | Sticky dark monitor strip displays BP, HR, RR, SpO₂, temperature, sugar, pain, GCS, status, appearance, and animated ECG. | UI presentation | DISCARD | HTML lines 167–194; CSS lines 17–50 |
| V-002 | Numeric values render directly from mutable `state.vitals` with color thresholds. | Observation projection mixed with truth | REPLACE | `renderVitals`, lines 699–715 |
| V-003 | Animated ECG `normal`/`tach`/`vtach`/flat paths are synthetic SVG commands; rhythm is guessed from HR/BP. | Unsafe rhythm/visual projection | REPLACE | lines 716–728 |
| V-004 | ECG investigation has a static inline JPEG and text interpretation. | Diagnostic media | UNKNOWN_DISCUSS | I-001/I-002; line 407 |
| V-005 | Chest X-ray has a static inline JPEG and text report. | Diagnostic media | UNKNOWN_DISCUSS | I-009/I-010; line 414 |
| V-006 | No image accompanies echo; it is text-only. | Missing modality representation | UNKNOWN_DISCUSS | line 415 |
| V-007 | Mini patient avatar is a generic inline SVG silhouette; no state-dependent patient image exists. | UI placeholder | DISCARD | line 182 |
| V-008 | Appearance is four Arabic text summaries selected from threshold-derived status; no approved visual-patient asset or fallback manifest. | Textual visual cue | REPLACE | lines 685–693 |
| V-009 | `.soundrow` styling exists but no sound controls/content exist; there is no audio implementation. | Dead UI artifact | DISCARD | CSS lines 49–50; no matching HTML/runtime use |
| V-010 | Embedded images are self-contained fallbacks in practice, but have no stable MediaAssetId, provenance, license, review status, recipe, or preload metadata. | Asset-governance gap | REPLACE | lines 407, 414 |
| V-011 | No video/media generation, 3D avatar, or runtime diagnostic generation exists. | Absence compatible with current product direction | KEEP | No corresponding V1 dependency |
| V-012 | Cairo and JetBrains Mono fonts load from Google Fonts at runtime. | External UI dependency | DISCARD | CSS `@import`, line 7 |

## Final feedback and debrief

| ID | V1 item | Nature | Classification | V1 source |
|---|---|---|---|---|
| F-001 | Report title/verdict distinguishes arrest, resolved, and manual end. | Deterministic report | KEEP | lines 1121–1124 |
| F-002 | Report displays overall score and six-domain numeric breakdown. | Deterministic report | KEEP | lines 1124–1131 |
| F-003 | Deterministic missed lists show required history not clicked, organ accordions not opened, and decoy tests ordered. | Deterministic report | KEEP | lines 1132–1138 |
| F-004 | Critical-error strings are rendered as an unstructured list. | Unstructured report | REPLACE | line 1139 |
| F-005 | AI narrative requests two strengths, two weaknesses, and one practical recommendation, up to 120 Arabic words. | AI-generated feedback | REPLACE | lines 1142–1152 |
| F-006 | AI input contains the feedback log, total score, diagnosis/correctness, and disposition; it does not receive authoritative event evidence. | Evidence gap | REPLACE | lines 1145–1149 |
| F-007 | Fallback narrative reports total, whether any critical error exists, and generic advice to review timing/priorities. | Deterministic fallback | KEEP | lines 1152–1156 |
| F-008 | UI live log is reverse-chronological (`prepend`), while the in-memory array used for narrative remains append-order with floored-minute labels. | Presentation/evidence inconsistency | CORRECT | `logFeedback`, lines 753–758; line 1145 |

## Hard-coded architecture debt

| ID | Debt finding | Preliminary classification | V1 source |
|---|---|---|---|
| AD-001 | Case content, engine logic, UI, media, scoring, and AI prompts share one HTML file. | REPLACE | Entire file |
| AD-002 | Clinical truth is mutable global browser state with direct numeric writes. | REPLACE | lines 524–540, 614–668, 942–1007 |
| AD-003 | Disease logic is embedded in UI handlers and a generic-looking physiology function. | REPLACE | `applyPhysiology`, `commitDrug`, `handleInitialAction` |
| AD-004 | Browser timers and synchronous `jumpTime` own medical time. | REPLACE | lines 604, 610–612 |
| AD-005 | Displayed vitals are treated as state; status, consciousness, appearance, and rhythm are inferred backward from numbers. | REPLACE | lines 653, 673–719 |
| AD-006 | Scoring is coupled to clicks, mutable sets, labels, and flags rather than committed evidence. | REPLACE | lines 536–539, 785–1007, 1101–1116 |
| AD-007 | AI order-parser output can directly click execution buttons. | REPLACE | lines 1023–1065 |
| AD-008 | Action IDs are unversioned local strings; aliases, parameters, confirmation, idempotency, and event identities are absent. | REPLACE | `CASES_DB` actions and handlers |
| AD-009 | Investigation duration and result availability are one blocking clock jump; independent work is impossible. | REPLACE | lines 897–919 |
| AD-010 | Media is embedded Base64 without stable asset identity/provenance/review/fallback contracts. | REPLACE | lines 407, 414 |
| AD-011 | Clinical and display strings are mixed Arabic/English and serve as both content and logic inputs. | REPLACE | `CASES_DB`, UI, messages |
| AD-012 | Local order parsing relies on permissive substring matching; patient fallback relies on heuristic token matching. | REPLACE | lines 810–827, 1028–1035 |
| AD-013 | Successful actions are non-repeatable by disabled button/Set, not a Case-owned repeat policy. | REPLACE | lines 743, 898, 915, 943, 987 |
| AD-014 | Feedback and critical errors are free strings, not stable codes/evidence references. | REPLACE | lines 753–758, 929, 970, 997, 1076 |
| AD-015 | There is no persistence, package/version pinning, audit envelope, publication status, source/review evidence, or immutable Case Package. | REPLACE | Entire V1 architecture |
| AD-016 | The remote worker URL and provider model are client-visible; no client secret was found in V1. | CORRECT | lines 523, 840–841, 1048–1049, 1148–1149 |
| AD-017 | `innerHTML` renders case-authored strings and AI-derived IDs trigger DOM lookup; content/runtime trust boundaries are weak. | REPLACE | lines 555, 769, 867–872, 903–905, 1023–1065 |
| AD-018 | Each case selection adds another window resize listener and never removes it. | DISCARD | `selectCase`, line 569 |

## Contradictions and uncertainties

These are not resolved here.

| ID | Finding | Classification | V1 source |
|---|---|---|---|
| C-001 | The patient reports daily aspirin, while aspirin administration is again a required treatment; prior dose/time/adherence are absent. | UNKNOWN_DISCUSS | lines 388, 468, 515 |
| C-002 | No explicit rhythm exists, yet cardioversion feedback asserts sinus tachycardia and the monitor can display “VT” based solely on HR/BP. | CORRECT | lines 461, 716–728 |
| C-003 | Arrest feedback says ventricular tachycardia then arrest, but no rhythm transition or VT event precedes the flatline. | CORRECT | lines 663–666 |
| C-004 | “Real-time 1:1” is announced, yet every action/test instantaneously skips clinical minutes. | CORRECT | lines 603–611, 897–999 |
| C-005 | Test result UI says “Waiting… X Minutes” only after the clock already jumped and the result is shown synchronously. | CORRECT | lines 914–918 |
| C-006 | CXR and ECG have images, echo does not; no image/report availability distinction or asset provenance exists. | UNKNOWN_DISCUSS | lines 407, 414–415 |
| C-007 | `scope` labels free-text orders as tests/treatment but does not constrain what is executed. | CORRECT | lines 1037–1065 |
| C-008 | `SL/IV`, `IV/PO`, and `IV/SC` display alternatives but V1 forces prior IV access without selecting a route. | CORRECT | drug routes lines 474, 481, 488, 490, 493; lines 966–989 |
| C-009 | Recovery requires only ECG, aspirin, and cath-lab activation, while the score separately requires seven treatments. | UNKNOWN_DISCUSS | lines 636–643 versus line 515 |
| C-010 | Ordering ECG slows untreated deterioration before any result interpretation or treatment. | UNKNOWN_DISCUSS | lines 646–652, 907–910 |
| C-011 | Resolved patient physiology freezes while the simulation clock continues. | CORRECT | lines 610, 614–615, 668 |
| C-012 | Free-text history can return a correct fact but does not mark it asked or earn credit; button catalogue does. | CORRECT | lines 785–827, 1101–1104 |
| C-013 | “All options available equally” conflicts with IV-gated treatments and disabled repeats; no visible pending/blocked state contract exists. | CORRECT | UI line 243; lines 932–1007 |
| C-014 | Several “wrong/critical” drugs still produce potentially beneficial or harmful numeric changes; many “good/correct” drugs have no state effect. | UNKNOWN_DISCUSS | lines 466–502, 972–1007 |
| C-015 | The `voice` locale is `ar-SA`, UI/patient text is Jordanian Arabic, and the configuration is unused. | CORRECT | line 327; lines 835–839 |
| C-016 | Root README claims expandable case database, medical imaging, ECG simulation, and voice as features/future work; implementation is one in-file case, two embedded images, synthetic waveform, and no voice runtime. | CORRECT | `README.md` lines 11–29; V1 lines 322–517, 722–728 |
| C-017 | Restarting a case creates `simMin=0` but does not immediately call `updateClock`; the previous clock display can remain until the next interval tick. | CORRECT | `freshState`, line 530; `startCase`, lines 588–604 |
| C-018 | `repCriticalWrap` is populated only when errors exist and is not cleared on a later clean run, so prior critical errors can remain in the report DOM. | CORRECT | `startCase`, lines 588–604; `endCase`, line 1139 |

## V2 Case Schema module crosswalk

| V2 module | V1 material | Status | Migration note |
|---|---|---|---|
| `manifest` | Local key `stemi1` only; no version/package/schema/lifecycle/module declarations. | PARTIAL | New V2 identities/governance required. |
| `classification` | ED/resuscitation context, acute presentation, implicit acuity; no difficulty/target levels/codes/duration taxonomy. | PARTIAL | Extracted labels are not approved codes. |
| `localization` | Arabic UI/patient text plus English examination/results/labels; no localization keys or `ar-JO`/`en-US` bundles. | PARTIAL | Normalize without changing facts. |
| `patient_profile` | Age, male sex, Jordanian-Arabic persona, EMS arrival; name/height/weight absent; `ar-SA` voice metadata unused. | PARTIAL | Dialogue persona exists only in prompt/data. |
| `presentation` | Chest-pain title/badge, arrival subtitle, chief complaint/history facts. | SOURCE MATERIAL FOUND | Separate clinical facts from UI wording. |
| `initial_state` | Numeric vitals and hidden flags; no explicit V2 state dimensions or reviewed observation projection. | PARTIAL | Do not infer V2 truth from vitals. |
| `clinical_facts` | 48 history facts, 18 exam finding groups (six organs × three techniques), nine investigation result groups, diagnosis/differentials/dispositions. | SOURCE MATERIAL FOUND | Stable fact IDs/disclosure/source review still required. |
| `action_catalogue` | 29 investigations, 20 non-drug actions, 37 drugs, 10 diagnoses, seven dispositions. | SOURCE MATERIAL FOUND | Parameters, doses, aliases, confirmation, repeat policy, and review missing. |
| `rules` | Hard-coded deterioration, crisis, recovery, arrest, direct treatment effects. | SOURCE MATERIAL FOUND | Inventory only; all must be re-authored/reviewed, not ported. |
| `timeline_policy` | Nominal 1:1 time, investigation/action costs, crisis/recovery/neglect thresholds, ECG feedback window. | SOURCE MATERIAL FOUND | Browser/UI timing must not become approved Clinical Time automatically. |
| `assessment_rubric` | Six V1 sections, checklist percentages, penalties, diagnosis/disposition values, live feedback. | SOURCE MATERIAL FOUND | Crosswalk only; no automatic V2 criterion conversion. |
| `dialogue_policy` | Fact list, Jordanian-Arabic persona prompt, disclosure prohibitions, heuristic fallback. | PARTIAL | Prompt is not an approved policy; free-text score mismatch needs decision. |
| `visual_manifest` | Two embedded diagnostic JPEGs, synthetic monitor waveform, generic avatar, textual appearance. | PARTIAL | Stable asset IDs, provenance, review, recipes, and fallbacks missing. |
| `curriculum_mappings` | No JU/JUST objective or source mapping. | MISSING IN V1 | Must be sourced; no official alignment claimed. |
| `validation` | No source versions, reviewers, clinical/technical/curriculum review, reachability evidence, or approval record. | MISSING IN V1 | Publication gates remain wholly unresolved. |
| `instructor_notes` | Live messages and AI fallback advice exist, but no instructor-owned facilitation notes/teaching-point codes. | PARTIAL | Do not treat learner feedback strings as approved instructor notes. |

## Diagnostic investigation contract gap list

This checks current V2 contracts, not V1 medical content. No schema change is made in V2-008.

| Capability | Status | Current support and gap |
|---|---|---|
| Investigation order identity | SUPPORTED | Shared `ActionId`, `ActionType=INVESTIGATION`, Case action catalogue, and `INVESTIGATION_ORDERED` event exist. |
| Case-owned Clinical-Time duration | PARTIAL | Generic timing windows/scheduled effects can encode time, but no investigation definition binds an order to a reviewed duration/completion policy. |
| Result availability | PARTIAL | `INVESTIGATION_RESULT_AVAILABLE` event and scheduled events exist, but no strict result-availability contract links result, order, and investigation. |
| Structured laboratory values | MISSING | `ClinicalFact` identifies an investigation result but has no typed analyte/value/unit/reference/flag structure. Arbitrary event JSON would be an implementation hack. |
| ECG asset/reference | PARTIAL | `MediaAssetId` and visual manifest exist, but no investigation/result-to-diagnostic-asset linkage or ECG-specific fallback/report contract exists. |
| Imaging asset/reference | PARTIAL | Generic media can hold a static image, but no diagnostic study/result asset relationship exists. |
| Textual/structured report | PARTIAL | A localized `content_key` can carry report text; structured findings/report status are absent. |
| Image availability separate from formal report | MISSING | No independent preliminary-image and final-report availability model exists. |
| Provenance/review metadata | PARTIAL | Facts/actions/rules can reference sources and package review exists, but media definitions lack direct source/reviewer/provenance fields and diagnostic results lack a dedicated review boundary. |
| Diagnostic asset ID | PARTIAL | Generic `MediaAssetId` exists; no diagnostic asset/study identity binds modality, study, result, and fallback. |
| Fallback structured findings | PARTIAL | Clinical fact text and visual static fallback exist independently; no required investigation-specific structured fallback is bound to the result. |
| Independent/parallel completion | PARTIAL | Scheduler supports independent items, deterministic ordering, and event emission; Case Schema lacks investigation-specific completion semantics and references. |
| Blocking versus asynchronous semantics | MISSING | Action definition has no strict execution/completion mode for investigations. |

The Diagnostic Investigation Contract Gate should resolve these gaps before V2-009 authors investigation actions/results. Full reachable-state and publication validation must remain fail-closed.
