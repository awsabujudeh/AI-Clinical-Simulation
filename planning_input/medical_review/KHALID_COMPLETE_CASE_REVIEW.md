# Khalid / STEMI — complete Case physician review

**Medical review COMPLETE — APPROVED_FOR_EXPO. Expo execution APPROVED_EXPO. Production publication PENDING. WP2 is not automatically closed.**

Approval basis: OWNER_ATTESTED_PHYSICIAN_REVIEW. Attested by OWNER, CONFIRMED. Physician role only; identity and exact physician review timestamp NOT_FORMALLY_RECORDED. No invented name, credentials or date. The separate approval envelope binds the exact execution/subject hashes and shared catalogue 1.1.0. Historical source lifecycle UNDER_REVIEW concerns unpublished-package governance, not current medical-review status.

Successor 2.4.0; case-version.stemi.inferior-rv.006.

Review execution hash: `e212c36090b59a4d324348c85fd1f5f7a0dbff02b1710a4e360a135e060760d7`

Review subject hash: `2e09cc954facbe91983decc60da03948ee0e012de8b16361e9b7d291f841386e`

Exact new synthetic values are owner-authored simulation data, not values prescribed by guidelines. Conflicting old values remain authoritative; decisions are listed below. This export includes legacy/non-shared actions so missing learner access is not hidden.

## 1. Demographics / context

| Field | Authored value |
| --- | --- |
| synthetic_name_en | Khaled Mansour |
| synthetic_name_ar | خالد منصور |
| age_years | 58 |
| sex | male |
| height_cm | 175 |
| weight_kg | 84 |
| occupation | taxi-driver |

Setting: setting.ed-resuscitation; difficulty: difficulty.intermediate-advanced; duration estimate 25 minutes.

## 2. HPI / symptoms

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.stemi.chief-complaint | Severe central pressure-like chest pain at rest. | on_direct_question |
| fact.stemi.pain-radiation | Pain radiates to the left arm and jaw. | on_direct_question |
| fact.stemi.associated-symptoms | Associated diaphoresis, nausea with one episode of vomiting, dyspnea, dizziness, near-syncope, and palpitations; no loss of consciousness. | on_direct_question |

## 3–4. History, allergies and medicines

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.stemi.symptom-onset | Symptoms began approximately 55 minutes before the emergency-department handoff and have remained continuous. | on_direct_question |
| fact.stemi.negative-infectious-history | No fever, chills, cough, or hemoptysis. | on_direct_question |
| fact.stemi.past-medical-history | Known hypertension, type 2 diabetes mellitus, and dyslipidemia; no known coronary disease, prior MI, PCI, CABG, heart failure, arrhythmia, stroke, chronic kidney disease, lung disease, or recent surgery. | on_direct_question |
| fact.stemi.home-medications | Home medicines are metformin 1000 mg twice daily, amlodipine 5 mg daily, and atorvastatin 20 mg nightly; no chronic aspirin or anticoagulant. | on_direct_question |
| fact.stemi.contraindications | No known drug allergies; denies aspirin allergy, active or prior significant bleeding, intracranial hemorrhage, gastrointestinal bleeding, trauma, surgery, anticoagulant use, sildenafil/vardenafil use, or tadalafil use. | on_direct_question |
| fact.stemi.social-risk | Smokes about one pack daily for 40 years (approximately 40 pack-years); denies alcohol, cocaine, amphetamine, and other drug use; works as a taxi driver with low activity. | on_direct_question |
| fact.stemi.family-history | Father had a myocardial infarction and died at approximately age 60. | on_direct_question |

No history additions or demographic substitutions. Full original cardiovascular risks, medications, family/social history and contraindication screen retained.

## 5. Initial hidden physiology / acquired observations

| Dimension | Authored initial truth |
| --- | --- |
| state_schema_version | 1.0 |
| state_version | 0 |
| case_version | 2.4.0 |
| clinical_time | 0 |
| clinical_phase | phase.stemi-acute-presentation |
| hemodynamic_state | hemodynamics.stemi-baseline-hypotension |
| cardiac_rhythm | rhythm.sinus-tachycardia |
| perfusion | perfusion.impaired |
| respiratory_state | respiratory.stemi-baseline-tachypnea |
| oxygenation | oxygenation.stemi-baseline-room-air |
| consciousness | consciousness.gcs-15 |
| neurologic_state | neurologic.no-focal-deficit |
| temperature_state | temperature.normothermic |
| metabolic_state | metabolic.mild-hyperglycemia |
| pain_state | {"severity_0_10":8,"location_codes":["location.retrosternal","location.left-arm","location.jaw"],"quality_codes":["quality.pressure","quality.crushing"],"trend":"trend.persistent"} |

| Projection | Values |
| --- | --- |
| hemodynamic_mappings: hemodynamics.stemi-baseline-hypotension | {"heart_rate_bpm":112,"systolic_bp_mm_hg":88,"diastolic_bp_mm_hg":60} |
| hemodynamic_mappings: hemodynamics.stemi-modestly-supported | {"heart_rate_bpm":106,"systolic_bp_mm_hg":94,"diastolic_bp_mm_hg":64} |
| hemodynamic_mappings: hemodynamics.stemi-delay-ten | {"heart_rate_bpm":118,"systolic_bp_mm_hg":82,"diastolic_bp_mm_hg":54} |
| hemodynamic_mappings: hemodynamics.stemi-shock | {"heart_rate_bpm":124,"systolic_bp_mm_hg":76,"diastolic_bp_mm_hg":48} |
| hemodynamic_mappings: hemodynamics.stemi-nitrate-harm | {"heart_rate_bpm":122,"systolic_bp_mm_hg":72,"diastolic_bp_mm_hg":44} |
| respiratory_mappings: respiratory.stemi-baseline-tachypnea | {"respiratory_rate_per_minute":24} |
| respiratory_mappings: respiratory.stemi-supported-clear-lungs | {"respiratory_rate_per_minute":23} |
| respiratory_mappings: respiratory.stemi-delay | {"respiratory_rate_per_minute":26} |
| respiratory_mappings: respiratory.stemi-shock | {"respiratory_rate_per_minute":28} |
| oxygenation_mappings: oxygenation.stemi-baseline-room-air | {"spo2_percent":92} |
| oxygenation_mappings: oxygenation.stemi-supported-room-air | {"spo2_percent":92} |
| oxygenation_mappings: oxygenation.stemi-shock-hypoxemia | {"spo2_percent":89} |
| temperature_mappings: temperature.normothermic | {"temperature_celsius":36.7} |
| consciousness_mappings: consciousness.gcs-15 | {"display_code":"display.consciousness-alert-gcs-15"} |
| consciousness_mappings: consciousness.gcs-14 | {"display_code":"display.consciousness-responsive-gcs-14"} |
| rhythm_mappings: rhythm.sinus-tachycardia | {"display_code":"display.rhythm-sinus-tachycardia","waveform_descriptor":"waveform.sinus-tachycardia"} |

Learner numeric HR/BP/RR/SpO2/temperature remain unknown until committed acquisition. BP is a point sample; monitoring refreshes only authored channels. BP cuff/IV/tubing remain downstream of receipts. Pulse-ox hardware remains PULSE_OX_VISUAL_ASSET_PENDING. Clinical Time is Session-owned. Measurement timings are compressed simulation fixtures, not real-world procedure durations.

## 6. Physical examination

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.stemi.general-appearance | Pale, clammy, anxious, diaphoretic, cool, visibly distressed, and speaking in short sentences. | after_exam |
| fact.stemi.cardiac-exam | Regular tachycardia; S1 and S2 present without murmur or rub. | after_exam |
| fact.stemi.jvp-exam | JVP is approximately 4 cm at 45 degrees; a subtle Kussmaul sign is optional and not core-scored. | after_exam |
| fact.stemi.perfusion-exam | Peripheral pulses are weak and symmetric, capillary refill is 3 seconds, and there is no edema. | after_exam |
| fact.stemi.respiratory-exam | Lungs are clear without crackles or wheeze; mildly increased work of breathing with symmetric air entry. | after_exam |
| fact.stemi.other-exam | No chest-wall tenderness or focal neurologic deficit; abdomen is soft and nontender without guarding, mass, or significant hepatomegaly; no unilateral leg swelling or pulse asymmetry. | after_exam |

General/skin: general appearance; airway evidence: speaking in short sentences only (no invented dedicated stridor/tongue finding); respiratory/cardiovascular/perfusion as above; neurological/abdomen/extremities: other-exam plus initial GCS15/no-focal state.

## 7. Investigation catalogue / timing

| Case action | First-level / search / legacy | Result type | Milestones (clinical seconds after order) |
| --- | --- | --- | --- |
| investigation.ecg-standard | SHARED | ECG | ORDERED:0; RESULT_AVAILABLE:120; IMAGE_AVAILABLE:120; FORMAL_REPORT_AVAILABLE:120 |
| investigation.ecg-right-sided | SEARCH_ONLY | ECG | ORDERED:0; RESULT_AVAILABLE:120; IMAGE_AVAILABLE:120; FORMAL_REPORT_AVAILABLE:120 |
| investigation.poc-glucose | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:60 |
| investigation.cbc | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.chemistry | LEGACY CASE ONLY — not in shared UI | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.coagulation | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.hs-ctni | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:600 |
| investigation.chest-xray | SHARED | IMAGING | ORDERED:0; RESULT_AVAILABLE:300; IMAGE_AVAILABLE:300; FORMAL_REPORT_AVAILABLE:480 |
| investigation.focused-echo | SHARED | ULTRASOUND | ORDERED:0; RESULT_AVAILABLE:240; IMAGE_AVAILABLE:240; FORMAL_REPORT_AVAILABLE:360 |
| investigation.complete.khalid.electrolytes | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.khalid.renal | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.khalid.blood-gas | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:180 |
| investigation.complete.khalid.lactate | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:180 |
| investigation.complete.khalid.liver | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.khalid.crp | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.khalid.d-dimer | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |

Milestones start at the committed order receipt after its 15-second simulation action cost. Independent orders run in parallel. Laboratory values are explicit fixed baseline samples collected at Case time 0, not newly inferred post-treatment physiology. Order/collection/availability times and result status are projected separately. This prevents baseline coagulation from masquerading as a post-heparin sample. Case repeat policy remains NOT_REPEATABLE; no invented serial troponin rise. Most lab panels have structured results only, not a fabricated narrative report.

## 8. Complete numerical result table

| Test/panel | Analyte | Value | Unit | Display interval | Flag | Sample |
| --- | --- | --- | --- | --- | --- | --- |
| investigation.poc-glucose | Blood glucose | 184 | unit.mg-dl | No universal interval asserted | Not inferred | BASELINE_CASE_SAMPLE t=0 |
| investigation.cbc | White blood cell count | 9.1 | unit.x10e3-per-ul | 3.4–9.6 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.cbc | Hemoglobin | 14.3 | unit.g-dl | 13.2–16.6 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.cbc | Hematocrit | 43 | unit.percent | 38.3–48.6 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.cbc | Platelets | 238 | unit.x10e3-per-ul | 150–400 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.coagulation | PT | 12.4 | unit.second | 11–13.5 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.coagulation | INR | 1 | unit.ratio | 0.8–1.2 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.coagulation | aPTT | 30 | unit.second | 25–35 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.hs-ctni | High-sensitivity cardiac troponin I | 286 | unit.ng-l | 0–34 | HIGH | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.electrolytes | Sodium | 138 | unit.mmol-l | 135–145 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.electrolytes | Potassium | 4.2 | unit.mmol-l | 3.5–5 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.electrolytes | Chloride | 102 | unit.mmol-l | 98–107 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.electrolytes | Serum bicarbonate | 21 | unit.mmol-l | 22–29 | LOW | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.electrolytes | Magnesium | 1.9 | unit.mg-dl | 1.7–2.4 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.renal | Blood urea nitrogen | 22 | unit.mg-dl | 7–20 | HIGH | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.renal | Creatinine | 1.1 | unit.mg-dl | 0.6–1.2 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.renal | eGFR | 78 | unit.ml-min-1-73m2 | No universal interval asserted | Not inferred | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.blood-gas | Blood gas pH | 7.45 | unit.ph | 7.35–7.45 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.blood-gas | Blood gas pCO2 | 31 | unit.mm-hg | 35–45 | LOW | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.blood-gas | Blood gas bicarbonate | 21 | unit.mmol-l | 22–26 | LOW | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.blood-gas | Arterial pO2 | 67 | unit.mm-hg | 80–100 | LOW | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.lactate | Lactate | 2.8 | unit.mmol-l | 0.5–2.2 | HIGH | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.liver | AST | 42 | unit.u-l | 10–40 | HIGH | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.liver | ALT | 30 | unit.u-l | 7–56 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.liver | Total bilirubin | 0.8 | unit.mg-dl | 0.2–1.2 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.liver | ALP | 88 | unit.u-l | 40–130 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.crp | CRP | 4 | unit.mg-l | 0–5 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.khalid.d-dimer | D-dimer | 0.35 | unit.mg-l-feu | 0–0.5 | NORMAL | BASELINE_CASE_SAMPLE t=0 |

Reference configuration: balsim.simulation-reference-bands.v1. CBC WBC/Hb/Hct bands informed by Mayo's adult laboratory catalogue; other bands are explicit simulation display configuration, not validated local-lab policy. No CRITICAL threshold is invented. eGFR is a supplied estimate (not recalculated from invented demographics). Dana >90 preserves its comparator. Glucose has no fasting interpretation. Current authored assay/qualifier limits are included in the owner-attested medical approval; no missing assay number is invented.

## 9. ECG / imaging / qualitative reports

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.stemi.ecg-inferior-findings | 12-lead ECG: sinus tachycardia about 112 bpm, PR 160 ms, QRS 90 ms, QTc about 435 ms; ST elevation II 2 mm, III 3 mm, aVF 2 mm with reciprocal ST depression in I and aVL and no posterior pattern in V1-V3. | after_result |
| fact.stemi.ecg-right-findings | Right-sided ECG: V3R ST elevation 1 mm and V4R ST elevation 1.5 mm, supporting right-ventricular involvement. | after_result |
| fact.stemi.cbc-result | CBC: WBC 9.1 x10^3/uL, hemoglobin 14.3 g/dL, hematocrit 43%, platelets 238 x10^3/uL. | after_result |
| fact.stemi.chemistry-result | Chemistry: sodium 138, potassium 4.2, chloride 102, bicarbonate 21 mmol/L, BUN 22 mg/dL, creatinine 1.1 mg/dL, glucose 184 mg/dL, magnesium 1.9 mg/dL. | after_result |
| fact.stemi.coagulation-result | Coagulation: INR 1.0 and aPTT 30 seconds. | after_result |
| fact.stemi.troponin-result | Synthetic hs-cTnI is 286 ng/L with authored upper reference limit 34 ng/L, flagged HIGH; assay/value/ULN require specialist review. | after_result |
| fact.stemi.poc-glucose-result | Point-of-care glucose is 184 mg/dL. | after_result |
| fact.stemi.cxr-result | Chest radiograph: no pulmonary edema, pneumothorax, focal air-space disease, or mediastinal abnormality; cardiac silhouette is not enlarged. | after_result |
| fact.stemi.echo-result | Focused echo: LVEF about 45%, inferior-wall hypokinesis, mildly-to-moderately dilated RV with reduced function, TAPSE about 14 mm, dilated IVC with reduced collapse, and no pericardial effusion, severe MR, VSD, or pulmonary edema. | after_result |

Khalid standard ECG remains approximately 112 bpm, PR160/QRS90/QTc435 ms; inferior/reciprocal findings unchanged. The 84-bpm ECG-002 image is suppressed for this successor. ECG_IMAGE_MATCHING_PENDING. Original media bytes are untouched. Right-sided ECG and existing quantitative RV echo remain unchanged.

## 10. Medication / procedure plan

| Action/order | Fixed dose/route or authored consideration | Prerequisites | Simulation duration | Repeat | Model/evidence |
| --- | --- | --- | --- | --- | --- |
| procedure.cardiac-monitor | apply cardiac monitor | None authored | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| procedure.peripheral-iv | establish peripheral IV access | None authored | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.aspirin-324-chewed | administer aspirin 324 mg chewed | None authored | 30 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.ticagrelor-180 | administer ticagrelor 180 mg loading dose | None authored | 30 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.clopidogrel-600 | administer clopidogrel 600 mg loading alternative | None authored | 30 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.ufh-70-units-kg | administer unfractionated heparin 70 units per kg IV bolus | procedure.peripheral-iv | 30 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.atorvastatin-80 | administer atorvastatin 80 mg | None authored | 30 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.nitroglycerin | administer nitroglycerin | None authored | Legacy action: existing contract | NOT_REPEATABLE | Legacy Case/rubric rules; no new effect |
| medication.iv-beta-blocker | administer intravenous beta blocker | None authored | Legacy action: existing contract | NOT_REPEATABLE | Legacy Case/rubric rules; no new effect |
| medication.norepinephrine-rescue | initiate draft norepinephrine rescue concept | None authored | Legacy action: existing contract | NOT_REPEATABLE | Legacy Case/rubric rules; no new effect |
| procedure.normal-saline-250 | give cautious 250 mL normal saline challenge over 10 clinical minutes | procedure.peripheral-iv | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| procedure.supplemental-oxygen | administer supplemental oxygen | None authored | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| consult.activate-cath-lab | activate primary PCI and Cath Lab pathway | None authored | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| procedure.expo.crystalloid-500 | crystalloid 500 | procedure.peripheral-iv | 15 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| medication.expo.epinephrine-im-05 | adrenaline | None authored | 30 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| consult.expo.call-help | call for help | None authored | 15 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| medication.expo.repeat-epinephrine-im-05 | repeat adrenaline | medication.expo.epinephrine-im-05 | 30 | NOT_REPEATABLE | NO_MODELED_BENEFIT |

Orders are existing fixed orders (empty parameter arrays), not a free prescribing engine. Selecting a different dose/route as an extra parameter is rejected. No new score weight or physiological injury is authored. Cross-case distractors consume time and log evidence; NO_MODELED_BENEFIT is scoped to this synthetic model, not a universal drug claim. Legacy norepinephrine/adjunct considerations are not complete dose-prescribing protocols.

## 11. Deterministic transitions

| Rule | Trigger / conditions | Effects (exact deterministic authoring) | Emitted evidence |
| --- | --- | --- | --- |
| rule.stemi.nitrate-harm | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"MEDICATION_ORDERED","action_id":"medication.nitroglycerin"},"preconditions":[{"condition_type":"STATE_EQUALS","target":"hemodynamic_state","value":"hemodynamics.stemi-baseline-hypotension"}],"exclusions":[{"condition_type":"COMPLICATION_PRESENT","complication_id":"complication.stemi.nitrate-hypotension"}]} | [{"effect_type":"SCHEDULE_RELATIVE","effect_id":"effect.stemi.schedule-nitrate-harm","scheduled_item_id":"scheduled-item.stemi.nitrate-harm","category":"harm.nitrate-hypotension","priority":100,"conflict_policy":"BLOCK","effects":[{"effect_type":"SET_STATE","effect_id":"effect.stemi.nitrate-hemodynamics","target":"hemodynamic_state","value":"hemodynamics.stemi-nitrate-harm"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.nitrate-perfusion","target":"perfusion","value":"perfusion.markedly-impaired"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.nitrate-consciousness","target":"consciousness","value":"consciousness.gcs-14"},{"effect_type":"SET_PAIN_STATE","effect_id":"effect.stemi.nitrate-pain","value":{"severity_0_10":9,"location_codes":["location.retrosternal","location.left-arm","location.jaw"],"quality_codes":["quality.pressure","quality.crushing"],"trend":"trend.persistent"}},{"effect_type":"ADD_COMPLICATION","effect_id":"effect.stemi.nitrate-complication","complication_id":"complication.stemi.nitrate-hypotension","complication_type":"complication.nitrate-associated-hypotension","attributes":{"dizziness":"marked","recoverable":true}}],"emitted_events":[{"event_type":"CRITICAL_EVENT_OCCURRED","action_id":"medication.nitroglycerin","parameters":{},"payload":{"complication_code":"nitrate-associated-hypotension","automatic_arrest":false},"clinical_effect_ids":["clinical-effect.stemi.nitrate-harm"]}],"delay_clinical_seconds":60}] | [] |
| rule.stemi.fluid-support | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"PROCEDURE_ORDERED","action_id":"procedure.normal-saline-250"},"preconditions":[{"condition_type":"STATE_EQUALS","target":"hemodynamic_state","value":"hemodynamics.stemi-baseline-hypotension"},{"condition_type":"COMPLICATION_ABSENT","complication_id":"complication.stemi.nitrate-hypotension"}],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.fluid-challenge-completed"}]} | [{"effect_type":"SCHEDULE_RELATIVE","effect_id":"effect.stemi.schedule-fluid-completion","scheduled_item_id":"scheduled-item.stemi.fluid-completion","category":"support.fluid-challenge","priority":60,"conflict_policy":"BLOCK","effects":[{"effect_type":"SET_STATE","effect_id":"effect.stemi.fluid-hemodynamics","target":"hemodynamic_state","value":"hemodynamics.stemi-modestly-supported"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.fluid-perfusion","target":"perfusion","value":"perfusion.modestly-improved"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.fluid-respiratory","target":"respiratory_state","value":"respiratory.stemi-supported-clear-lungs"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.fluid-oxygenation","target":"oxygenation","value":"oxygenation.stemi-supported-room-air"},{"effect_type":"SET_PAIN_STATE","effect_id":"effect.stemi.fluid-pain","value":{"severity_0_10":7,"location_codes":["location.retrosternal","location.left-arm","location.jaw"],"quality_codes":["quality.pressure","quality.crushing"],"trend":"trend.persistent"}},{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.stemi.fluid-completed","outcome_flag":"outcome.fluid-challenge-completed"}],"emitted_events":[{"event_type":"PATIENT_STATE_CHANGED","action_id":"procedure.normal-saline-250","parameters":{},"payload":{"transition_code":"modestly-supported-pre-pci","lungs":"clear"},"clinical_effect_ids":["clinical-effect.stemi.fluid-support"]}],"delay_clinical_seconds":600}] | [] |
| rule.stemi.delay-at-ten | {"trigger":{"trigger_type":"CLINICAL_TIME_THRESHOLD","threshold_clinical_time":600},"preconditions":[],"exclusions":[{"condition_type":"PRIOR_EVENT_OCCURRED","event_type":"CONSULT_REQUESTED","action_id":"consult.activate-cath-lab"},{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.delay-ten-applied"}]} | [{"effect_type":"SET_STATE","effect_id":"effect.stemi.delay-phase","target":"clinical_phase","value":"phase.stemi-deteriorating"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.delay-hemodynamics","target":"hemodynamic_state","value":"hemodynamics.stemi-delay-ten"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.delay-perfusion","target":"perfusion","value":"perfusion.worsened"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.delay-respiratory","target":"respiratory_state","value":"respiratory.stemi-delay"},{"effect_type":"SET_PAIN_STATE","effect_id":"effect.stemi.delay-pain","value":{"severity_0_10":9,"location_codes":["location.retrosternal","location.left-arm","location.jaw"],"quality_codes":["quality.pressure","quality.crushing"],"trend":"trend.worsening"}},{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.stemi.delay-marker","outcome_flag":"outcome.delay-ten-applied"}] | [{"event_type":"PATIENT_STATE_CHANGED","parameters":{},"payload":{"transition_code":"delay-deterioration","automatic_death":false},"clinical_effect_ids":["clinical-effect.stemi.delay-ten"]}] |
| rule.stemi.shock-at-eighteen | {"trigger":{"trigger_type":"CLINICAL_TIME_THRESHOLD","threshold_clinical_time":1080},"preconditions":[],"exclusions":[{"condition_type":"PRIOR_EVENT_OCCURRED","event_type":"CONSULT_REQUESTED","action_id":"consult.activate-cath-lab"},{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.shock-eighteen-applied"}]} | [{"effect_type":"SET_STATE","effect_id":"effect.stemi.shock-phase","target":"clinical_phase","value":"phase.stemi-shock"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.shock-hemodynamics","target":"hemodynamic_state","value":"hemodynamics.stemi-shock"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.shock-perfusion","target":"perfusion","value":"perfusion.markedly-impaired"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.shock-respiratory","target":"respiratory_state","value":"respiratory.stemi-shock"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.shock-oxygenation","target":"oxygenation","value":"oxygenation.stemi-shock-hypoxemia"},{"effect_type":"SET_STATE","effect_id":"effect.stemi.shock-consciousness","target":"consciousness","value":"consciousness.gcs-14"},{"effect_type":"SET_PAIN_STATE","effect_id":"effect.stemi.shock-pain","value":{"severity_0_10":9,"location_codes":["location.retrosternal","location.left-arm","location.jaw"],"quality_codes":["quality.pressure","quality.crushing"],"trend":"trend.worsening"}},{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.stemi.shock-marker","outcome_flag":"outcome.shock-eighteen-applied"}] | [{"event_type":"CRITICAL_EVENT_OCCURRED","parameters":{},"payload":{"transition_code":"shock-deterioration","oxygen_indicated":true,"automatic_arrest":false},"clinical_effect_ids":["clinical-effect.stemi.shock-eighteen"]}] |
| rule.stemi.oxygen-in-shock | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"PROCEDURE_ORDERED","action_id":"procedure.supplemental-oxygen"},"preconditions":[{"condition_type":"STATE_EQUALS","target":"oxygenation","value":"oxygenation.stemi-shock-hypoxemia"}],"exclusions":[{"condition_type":"INTERVENTION_PRESENT","intervention_id":"intervention.stemi.supplemental-oxygen"}]} | [{"effect_type":"ADD_INTERVENTION","effect_id":"effect.stemi.add-oxygen","intervention_id":"intervention.stemi.supplemental-oxygen","intervention_type":"intervention.supplemental-oxygen","parameters":{"indication":"shock-spo2-89"}}] | [] |
| rule.stemi.cath-pathway-marker | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"CONSULT_REQUESTED","action_id":"consult.activate-cath-lab"},"preconditions":[],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.cath-pathway-activated"}]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.stemi.cath-marker","outcome_flag":"outcome.cath-pathway-activated"}] | [] |
| rule.stemi.transfer-marker | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"DISPOSITION_SELECTED","action_id":"disposition.transfer-cath-lab"},"preconditions":[{"condition_type":"PRIOR_EVENT_OCCURRED","event_type":"CONSULT_REQUESTED","action_id":"consult.activate-cath-lab"}],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.transfer-initiated"}]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.stemi.transfer-marker","outcome_flag":"outcome.transfer-initiated"}] | [{"event_type":"OUTCOME_REACHED","action_id":"disposition.transfer-cath-lab","parameters":{},"payload":{"endpoint":"transfer-to-cath-lab","pci_performed":false},"clinical_effect_ids":["clinical-effect.stemi.transfer"]}] |

Supportive fluid response is modest and pain remains7/persistent. Initial pain8. No PCI success state exists. Aspirin/oxygen/time cannot clear the pain face. VISUAL_RESPONSE_AFTER_REPERFUSION = DEFERRED_NOT_MODELED; owner specifically confirmed retaining this behavior.

## 12–13. Diagnosis / disposition

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.stemi.hidden-diagnosis | Hidden Case truth: acute inferior-wall STEMI with significant right-ventricular involvement and early hypotension/impaired perfusion, without initial pulmonary edema or malignant arrhythmia. | never_to_patient |
| fact.stemi.endpoint | Successful endpoint is recognition, emergent PPCI pathway activation, preparation, and Cath Lab transfer; PCI itself is not simulated. | never_to_patient |

| Action | Authored label |
| --- | --- |
| diagnosis.inferior-stemi | identify acute inferior STEMI |
| diagnosis.rv-involvement | identify right ventricular involvement |
| diagnosis.oxygen-not-indicated-baseline | state that routine oxygen is not indicated at baseline SpO2 92 percent |
| disposition.transfer-cath-lab | initiate transfer to Cath Lab |
| disposition.ward-admission | admit to ward instead of emergent reperfusion |
| disposition.discharge-home | discharge home |

These existing Case actions are retained in the package, but not added to the neutral shared first-level catalogue in this investigation-only correction. Full diagnosis/disposition/examination learner workflow coverage remains a separate explicit integration limitation, not a missing medical diagnosis. No automatic publication or production finalization.

## 14. Scoring / critical actions

| Domain / weight basis points | Criteria / points / evidence |
| --- | --- |
| History / 1000 | [{"rubric_item_id":"rubric-item.stemi.history-focused-hpi","kind":"AWARD","points":4,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.focused-history"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.history-contraindications","kind":"AWARD","points":4,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.contraindication-review"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.history-risk","kind":"AWARD","points":2,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.risk-history"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}}] |
| Examination / 1000 | [{"rubric_item_id":"rubric-item.stemi.exam-hemodynamics","kind":"AWARD","points":4,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.hemodynamic-perfusion"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.exam-lungs-jvp","kind":"AWARD","points":4,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.lungs-jvp"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.exam-cardiac-neuro","kind":"AWARD","points":2,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.cardiac-neurologic"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}}] |
| Diagnostics / 2500 | [{"rubric_item_id":"rubric-item.stemi.diagnostic-ecg-timely","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["investigation.ecg-standard"],"event_types":["INVESTIGATION_ORDERED"],"timing_window_id":"window.stemi.ecg-by-ten"},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.diagnostic-inferior-recognition","kind":"AWARD","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["diagnosis.inferior-stemi"],"event_types":["DIAGNOSIS_SUBMITTED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.diagnostic-right-ecg","kind":"AWARD","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["investigation.ecg-right-sided"],"event_types":["INVESTIGATION_ORDERED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.diagnostic-rv-recognition","kind":"AWARD","points":3,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["diagnosis.rv-involvement"],"event_types":["DIAGNOSIS_SUBMITTED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.diagnostic-no-troponin-delay","kind":"AWARD","points":2,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["consult.activate-cath-lab"],"event_types":["CONSULT_REQUESTED"],"timing_window_id":"window.stemi.cath-full-credit"},"repeat_policy":{"mode":"ONCE"}}] |
| Management / 2500 | [{"rubric_item_id":"rubric-item.stemi.management-aspirin","kind":"AWARD","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.aspirin-324-chewed"],"event_types":["MEDICATION_ORDERED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.management-p2y12","kind":"AWARD","points":4,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.ticagrelor-180","medication.clopidogrel-600"],"event_types":["MEDICATION_ORDERED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.management-ufh","kind":"AWARD","points":4,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.ufh-70-units-kg"],"event_types":["MEDICATION_ORDERED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.management-safe-hemodynamics","kind":"AWARD","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.hemodynamic-reassessment"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.management-oxygen-decision","kind":"AWARD","points":2,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["diagnosis.oxygen-not-indicated-baseline"],"event_types":["DIAGNOSIS_SUBMITTED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.management-statin","kind":"AWARD","points":2,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.atorvastatin-80"],"event_types":["MEDICATION_ORDERED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.management-monitor","kind":"AWARD","points":1,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["procedure.cardiac-monitor"],"event_types":["PROCEDURE_ORDERED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.management-iv","kind":"AWARD","points":2,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["procedure.peripheral-iv"],"event_types":["PROCEDURE_ORDERED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.management-nitrate-safe-hemodynamics-forfeiture","kind":"PENALTY","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.nitroglycerin"],"event_types":["MEDICATION_ORDERED"]},"repeat_policy":{"mode":"ONCE"}}] |
| Clinical reasoning / 1500 | [{"rubric_item_id":"rubric-item.stemi.reasoning-rv","kind":"AWARD","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["diagnosis.rv-involvement"],"event_types":["DIAGNOSIS_SUBMITTED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.reasoning-reperfusion","kind":"AWARD","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["consult.activate-cath-lab"],"event_types":["CONSULT_REQUESTED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.reasoning-response","kind":"AWARD","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.hemodynamic-reassessment"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}}] |
| Reperfusion and disposition / 1500 | [{"rubric_item_id":"rubric-item.stemi.reperfusion-cath-early","kind":"AWARD","points":7,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["consult.activate-cath-lab"],"event_types":["CONSULT_REQUESTED"],"timing_window_id":"window.stemi.cath-full-credit"},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.reperfusion-cath-partial","kind":"AWARD","points":3,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["consult.activate-cath-lab"],"event_types":["CONSULT_REQUESTED"],"timing_window_id":"window.stemi.cath-partial-credit"},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.stemi.reperfusion-transfer","kind":"AWARD","points":5,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["disposition.transfer-cath-lab"],"event_types":["DISPOSITION_SELECTED"]},"repeat_policy":{"mode":"ONCE"}}] |

| Critical item | Evidence | Effect |
| --- | --- | --- |
| rubric-item.stemi.critical-nitrate-unsafe | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.nitroglycerin"],"event_types":["MEDICATION_ORDERED"]} | {"effect_type":"MARK_UNSAFE"} |
| rubric-item.stemi.critical-nitrate-deduction | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.nitroglycerin"],"event_types":["MEDICATION_ORDERED"]} | {"effect_type":"DEDUCT_OVERALL_SCORE","penalty_basis_points":1000} |
| rubric-item.stemi.critical-beta-unsafe | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.iv-beta-blocker"],"event_types":["MEDICATION_ORDERED"]} | {"effect_type":"MARK_UNSAFE"} |
| rubric-item.stemi.critical-beta-deduction | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.iv-beta-blocker"],"event_types":["MEDICATION_ORDERED"]} | {"effect_type":"DEDUCT_OVERALL_SCORE","penalty_basis_points":800} |
| rubric-item.stemi.critical-no-cath | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["consult.activate-cath-lab"],"event_types":["CONSULT_REQUESTED"],"timing_window_id":"window.stemi.cath-major-delay"} | {"effect_type":"CAP_OVERALL_SCORE","cap_basis_points":6000} |
| rubric-item.stemi.critical-wrong-disposition-unsafe | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["disposition.ward-admission","disposition.discharge-home"],"event_types":["DISPOSITION_SELECTED"]} | {"effect_type":"MARK_UNSAFE"} |
| rubric-item.stemi.critical-wrong-disposition-cap | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["disposition.ward-admission","disposition.discharge-home"],"event_types":["DISPOSITION_SELECTED"]} | {"effect_type":"CAP_OVERALL_SCORE","cap_basis_points":4000} |

All rubric weights/hooks are inherited unchanged. New diagnostic panels do not acquire invented scoring weights. Actions remain recorded for later assessment. No runtime AI writes clinical effects or results.

## 15. Visual findings

Same Khalid asset/rig. Strong pain + chest guarding initially; modest support retains persistent-pain face/hand. No time-only relief. No invented successful reperfusion.

## 16. Patient Conversation facts

| Patient-known fact | Authored statement |
| --- | --- |
| fact.stemi.chief-complaint | Severe central pressure-like chest pain at rest. |
| fact.stemi.pain-radiation | Pain radiates to the left arm and jaw. |
| fact.stemi.symptom-onset | Symptoms began approximately 55 minutes before the emergency-department handoff and have remained continuous. |
| fact.stemi.associated-symptoms | Associated diaphoresis, nausea with one episode of vomiting, dyspnea, dizziness, near-syncope, and palpitations; no loss of consciousness. |
| fact.stemi.negative-infectious-history | No fever, chills, cough, or hemoptysis. |
| fact.stemi.past-medical-history | Known hypertension, type 2 diabetes mellitus, and dyslipidemia; no known coronary disease, prior MI, PCI, CABG, heart failure, arrhythmia, stroke, chronic kidney disease, lung disease, or recent surgery. |
| fact.stemi.home-medications | Home medicines are metformin 1000 mg twice daily, amlodipine 5 mg daily, and atorvastatin 20 mg nightly; no chronic aspirin or anticoagulant. |
| fact.stemi.contraindications | No known drug allergies; denies aspirin allergy, active or prior significant bleeding, intracranial hemorrhage, gastrointestinal bleeding, trauma, surgery, anticoagulant use, sildenafil/vardenafil use, or tadalafil use. |
| fact.stemi.social-risk | Smokes about one pack daily for 40 years (approximately 40 pack-years); denies alcohol, cocaine, amphetamine, and other drug use; works as a taxi driver with low activity. |
| fact.stemi.family-history | Father had a myocardial infarction and died at approximately age 60. |

No new lab/imaging/hidden diagnosis enters the patient-known allow-list. No provider calls were needed for this correction. New values are not patient dialogue.

## 17. Media issues

ECG-002 root report states84bpm, not112. Read-only scoped Diagnostic Library search found no traced inferior110–115 candidate; nested duplicate report is empty. Preserve text fallback; do not modify/replace the image deceptively. Current clinical reports are approved for Expo. The reference CXR image is withheld in the approved Expo path while formal rights remain pending. Right ECG/echo images remain pending.

## 18. Preserved authoring conflicts / accepted current-content decisions

| Field | Existing truth | Requested target | Disposition |
| --- | --- | --- | --- |
| Khalid CBC | 9.1 / 14.3 / 43 / 238 | 10.8 / 14.1 / 42 / 230 | Preserve original four values |
| Khalid chloride / BUN / glucose | 102 / 22 / 184 | 101 / 32 / 178 | Preserve original values, including POC glucose |
| Khalid troponin | hs-cTnI 286 ng/L; ULN 34 | cTnI 4.80 ng/mL (4800 ng/L) | Preserve original assay/value; no serial rise invented |
| Khalid visual response | Modest support; pain 7, persistent; pain face retained | Clearer improved pain/face | Preserve existing behavior pending authored visual decision |

The owner confirms qualified-physician review of the current retained content. Existing values below are approved as modeled; conflicting requested replacements were not adopted. The checklist below preserves the original authoring review scope, not pending current approval.

| Item / evidence | APPROVE | CHANGE | COMMENT |
| --- | --- | --- | --- |
| All initial facts/history/exam | [ ] | [ ] |  |
| All laboratory values, assay assumptions, intervals and fixed baseline sample semantics | [ ] | [ ] |  |
| All ECG / FoCUS / imaging reports and pending media | [ ] | [ ] |  |
| All fixed orders, prerequisites and duplicate behavior | [ ] | [ ] |  |
| All transition timing fixtures and clinical response limits | [ ] | [ ] |  |
| Diagnosis, disposition and scoring plan | [ ] | [ ] |  |
| Patient-only disclosure and visual response | [ ] | [ ] |  |
| Every held conflict above | [ ] | [ ] |  |

Medical review: COMPLETE. Approval basis: OWNER_ATTESTED_PHYSICIAN_REVIEW. Reviewer identity and exact review timestamp: NOT_FORMALLY_RECORDED. Production publication: PENDING.

## Review history

Previous medical state: PENDING_PHYSICIAN_REVIEW / UNDER_REVIEW / REVIEW_ONLY, preserved in the 2.3.0 parent. Current 2.4.0 is a medical-metadata/version successor only. Source facts, values, rules, scoring and patient assets did not change. Prior pending authoring findings remain historical evidence, superseded for the current content by the bound owner attestation.

## Source traceability

- source.wp2.acs-2025: [2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline](https://professional.heart.org/en/science-news/2025-guideline-for-the-management-of-patients-with-acute-coronary-syndromes/top-things-to-know).
- source.wp2.rcuk-anaphylaxis-2021: [RCUK Emergency treatment of anaphylaxis (May 2021)](https://www.resus.org.uk/sites/default/files/2021-05/Emergency%20Treatment%20of%20Anaphylaxis%20May%202021_0.pdf).
- source.wp2.anaphylaxis-2023: [Anaphylaxis: A 2023 practice parameter update](https://www.aaaai.org/Aaaai/media/Media-Library-PDFs/Allergist%20Resources/Statements%20and%20Practice%20Parameters/Anaphylaxis-Practice-Paramaters-2023.pdf).
- source.wp2.expo-modeling-decision: [Owner-authorized WP2 bounded synthetic modeling decision](planning_input/medical_review/EXPO_SHARED_CATALOGUE_REVIEW.md).
- source.wp2.complete-case-authoring: [Owner-authored synthetic complete Case dataset and FoCUS clarification; conflicts retain prior truth](planning_input/medical_review/EXPO_CASE_COMPLETENESS_MATRIX.md).
- source.wp2.esc-2023: [2023 ESC ACS guideline](https://academic.oup.com/eurheartj/article/44/38/3720/7243210).
- source.wp2.wao-2020: [WAO Anaphylaxis Guidance 2020](https://doi.org/10.1016/j.waojou.2020.100472).
- source.wp2.reference-config: [Simulation display bands v1; local assay configuration, pending physician review](planning_input/medical_review/EXPO_CASE_COMPLETENESS_MATRIX.md).
- [Mayo CBC reference catalogue](https://mml.testcatalog.org/show/CBC): adult WBC/Hb/Hct display-band reference only.

Guidelines inform structure and urgency; they do not prescribe these exact patient numbers. Sources remain UNRESOLVED for approval/RAG purposes. No full copyrighted document ingested. Owner-attested physician review approves current medical content for Expo only; it does not approve source ingestion, media rights, official curriculum alignment or production publication.
