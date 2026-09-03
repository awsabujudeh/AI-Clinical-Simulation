# V2-009 Acute Inferior STEMI Case Authoring Specification

Status: **UNDER_REVIEW**
Case: `case.stemi.inferior-rv.001`
Case Version: `2.0.0` (`case-version.stemi.inferior-rv.001`)
Package identity: `case-package.stemi.inferior-rv.001`

This record transcribes the authorized V2-009 medical specification into a reviewable Case. It is not Clinical Approval and must not be treated as published medical content.

## Identity and audience

- Faculty title: Acute Inferior STEMI with Right Ventricular Involvement.
- Learner title (English): 58-year-old man with acute chest pain and hypotension.
- Learner title (Arabic): رجل يبلغ 58 عامًا يعاني من ألم صدري حاد مع انخفاض ضغط الدم
- Setting: ED resuscitation in a PCI-capable tertiary teaching hospital.
- Specialties: Emergency Medicine and Cardiology.
- Acuity: high. Difficulty: intermediate/advanced.
- Primary learner: senior medical student. Secondary learner: intern/early postgraduate.
- Synthetic patient: Khaled Mansour / خالد منصور, 58-year-old man, 175 cm, 84 kg, taxi driver.
- Patient language defaults to `ar-JO`; authored languages are exactly `ar-JO` and `en-US`.
- Symptoms began about 55 minutes before the authoritative ED handoff. Session Clinical Time begins at `T=0`.

## Authoritative initial truth

The hidden Case truth is acute inferior-wall STEMI with significant right-ventricular involvement, early hypotension, and impaired perfusion. There is no initial pulmonary edema, malignant arrhythmia, or cardiac arrest.

Initial Patient State is acute presentation, hypotensive, explicit sinus tachycardia, impaired perfusion, tachypnea without respiratory failure, borderline oxygenation on room air, alert without focal neurologic deficit, normothermic, mildly hyperglycemic, and in persistent retrosternal pressure/crushing pain radiating to the left arm and jaw at 8/10. Active interventions, complications, and outcome flags are empty.

Initial deterministic observations are HR 112/min, BP 88/60 mmHg, RR 24/min, SpO2 92% on room air, temperature 36.7 °C, and alert/GCS-compatible 15. These are projections; they are not Patient State authority.

Reachable authored projections are:

| State | HR | BP | RR | SpO2 | Consciousness | Pain |
|---|---:|---:|---:|---:|---|---:|
| Baseline | 112 | 88/60 | 24 | 92% room air | GCS-compatible 15 | 8 |
| Modestly supported pre-PCI | 106 | 94/64 | 23 | 92% room air | GCS-compatible 15 | 7 |
| Delay at T=10 | 118 | 82/54 | 26 | 92% | GCS-compatible 15 | 9 |
| Shock at T=18 | 124 | 76/48 | 28 | 89% | GCS-compatible 14 | 9 |
| Nitrate harm | 122 | 72/44 | unchanged baseline respiratory/oxygenation state | unchanged baseline respiratory/oxygenation state | GCS-compatible 14 | 9 |

Cardiac rhythm remains explicitly `sinus tachycardia` in all current branches. No HR/BP threshold creates VT/VF.

## History, examination, and patient disclosure

The authored HPI is severe central pressure/crushing pain at rest, continuous and not relieved by rest, radiating to left arm and jaw, with diaphoresis, nausea, one episode of vomiting, dyspnea, dizziness, near-syncope, and palpitations without loss of consciousness. The patient denies fever, chills, cough, and hemoptysis.

History includes hypertension, type 2 diabetes, and dyslipidemia; metformin 1000 mg twice daily, amlodipine 5 mg daily, and atorvastatin 20 mg nightly; no chronic aspirin or anticoagulant. There is no known CAD, prior MI/PCI/CABG, heart failure, arrhythmia, stroke, CKD, lung disease, or recent surgery. No known allergy, aspirin allergy, significant bleeding, intracranial or GI bleed, trauma, surgery, anticoagulant use, or PDE5 inhibitor use is reported. Smoking is approximately 40 pack-years; alcohol, cocaine, amphetamine, and other drug use are denied. His father had an MI and died near age 60.

Examination is pale, clammy, anxious, diaphoretic, cool, distressed, and short-sentenced. Tachycardia is regular; S1/S2 are present without murmur or rub. JVP is about 4 cm at 45°; subtle Kussmaul sign is optional and not core-scored. Pulses are weak and symmetric, capillary refill 3 seconds, with no edema. Lungs are clear without crackles or wheeze, with mildly increased work and symmetric entry. There is no chest-wall tenderness, focal neurologic deficit, significant abdominal finding, unilateral swelling, or pulse asymmetry.

The patient may spontaneously disclose pain, distress, sweating, and dizziness. Radiation, onset, history, medications, smoking, family history, bleeding/allergy/PDE5/anticoagulant facts require direct questions. JVP, lungs, and capillary refill require examination. Diagnostic results require their investigation milestones. Culprit anatomy, hidden diagnosis, rules, state, and rubric are never patient knowledge.

Authored example utterances from the task specification are:

- `هون بنص صدري… ضاغط عليّ بشكل قوي.`
- `آه… على إيدي الشمال، وحاسه شوي واصل لفكي.`
- `والله ما بعرف دكتور، بس خايف يكون الموضوع من قلبي.`

## Diagnostics

- Standard ECG becomes available 2 Clinical minutes after order: sinus tachycardia ~112, PR 160 ms, QRS 90 ms, QTc ~435 ms; ST elevation II 2 mm, III 3 mm, aVF 2 mm; reciprocal depression I/aVL; no posterior pattern V1-V3.
- Right-sided ECG becomes available 2 Clinical minutes after order: V3R 1 mm and V4R 1.5 mm ST elevation. It is not a Cath prerequisite.
- POC glucose returns at +1 minute. CBC, chemistry, and coagulation each return independently at +8 minutes. hs-cTnI returns at +10 minutes.
- CBC: WBC 9.1 ×10³/µL, Hb 14.3 g/dL, Hct 43%, platelets 238 ×10³/µL.
- Chemistry: Na 138, K 4.2, Cl 102, HCO3 21 mmol/L, BUN 22 mg/dL, creatinine 1.1 mg/dL, glucose 184 mg/dL, Mg 1.9 mg/dL.
- Coagulation: INR 1.0, aPTT 30 s.
- Synthetic hs-cTnI: 286 ng/L, authored ULN 34 ng/L, `HIGH`; assay/value/ULN require specialist review and are not a Cath prerequisite.
- CXR image/result is available at +5 minutes and formal report at +8: no edema, pneumothorax, focal disease, mediastinal abnormality, or enlarged silhouette.
- Focused echo image/result is available at +4 minutes and formal report at +6: LVEF about 45%, inferior hypokinesis, mildly-to-moderately dilated RV with reduced function, TAPSE about 14 mm, dilated IVC with reduced collapse, and no effusion, severe MR, VSD, or pulmonary edema.

All investigations execute asynchronously and in parallel. Diagnostic image/tracing assets, rights, provenance approval, and Clinical Review remain pending. Structured findings are the review-authoritative fallback.

## Actions and trajectory

The Case catalogues focused history/examination/reassessment, monitor and peripheral IV readiness, standard and right-sided ECG, POC glucose, CBC, chemistry, coagulation, hs-cTnI, CXR, focused echo, aspirin 324 mg chewed, ticagrelor 180 mg, clopidogrel 600 mg as alternative, UFH 70 U/kg IV bolus, atorvastatin 80 mg, cautious normal saline 250 mL over 10 Clinical minutes, oxygen, nitroglycerin, IV beta blocker, draft norepinephrine rescue, Cath/PPCI activation, Cath transfer, diagnosis submissions, and unsafe ward/discharge dispositions.

- Aspirin, P2Y12 therapy, UFH, statin, and Cath activation do not normalize observations or create instant reperfusion/cure.
- Baseline routine oxygen at SpO2 92% is not indicated. At authored shock SpO2 89%, oxygen becomes indicated; the oxygen rule is state-dependent.
- Nitroglycerin in baseline hypotension schedules a +1 Clinical minute nitrate-associated hypotension state (HR 122, BP 72/44, marked perfusion impairment/dizziness, GCS-compatible 14, significant pain). It is recoverable and does not create arrest/death.
- IV beta blocker in the baseline poor-perfusion state is assessment-unsafe. No quantitative physiologic response was invented.
- One cautious 250 mL normal-saline challenge over 10 Clinical minutes may reach the authored modest-support projection when baseline eligibility holds. Unlimited repeated improvement is not represented.
- Norepinephrine remains only a draft rescue action concept; exact trigger, dose, and effect are pending. No titration rule is authored.
- Detailed opioid execution is omitted because no authorized dose/effect was supplied.
- If Cath activation has not occurred by T=10, the deterministic delay state occurs. If still absent at T=18, shock occurs. Neither branch creates scripted death or malignant rhythm.
- The successful endpoint is recognition, activation, preparation, and transfer; PCI itself is not simulated.

## Assessment

The deterministic rubric has six domains totaling 10,000 basis points: History 10%, Examination 10%, Diagnostics 25%, Management 25%, Clinical Reasoning 15%, Reperfusion/Disposition 15%. Domain raw points preserve the authorized 10/10/25/25/15/15 allocation.

Cath educational timing is represented as full credit within the authored early window, partial credit in the wider window, and missed/major-delay behavior afterward. Exact window/cap policy remains specialist-review-required. Baseline nitroglycerin applies `MARK_UNSAFE`, forfeits exactly the 5-point Hemodynamically Safe Management criterion through one explicit Case-owned penalty, and applies the authorized 1,000-basis-point overall deduction. It does not zero the Management domain; aspirin, P2Y12, anticoagulation, oxygen-decision, statin, monitor, and IV-readiness credit remain independently scoreable. IV beta blocker applies `MARK_UNSAFE` and an 800-basis-point deduction. Missing Cath activation by the final authored window caps at 60%; ward/discharge applies `MARK_UNSAFE` and caps at 40%. All exact penalties and caps remain `SPECIALIST_REVIEW_REQUIRED`; these are draft Case educational thresholds, not guideline door-to-balloon claims.

## Governance boundary

The Case may execute only through the immutable `REVIEW_ONLY` artifact. Clinical Review, specialist sign-off, curriculum validation, diagnostic/media governance, exact-package Approval, and publication remain absent. Any clinically relevant edit changes the review hashes and must be re-reviewed.
