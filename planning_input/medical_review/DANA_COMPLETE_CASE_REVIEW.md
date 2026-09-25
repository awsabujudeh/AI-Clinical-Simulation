# Dana / Anaphylaxis — complete Case physician review

**Medical review COMPLETE — APPROVED_FOR_EXPO. Expo execution APPROVED_EXPO. Production publication PENDING. WP2 is not automatically closed.**

Approval basis: OWNER_ATTESTED_PHYSICIAN_REVIEW. Attested by OWNER, CONFIRMED. Physician role only; identity and exact physician review timestamp NOT_FORMALLY_RECORDED. No invented name, credentials or date. The separate approval envelope binds the exact execution/subject hashes and shared catalogue 1.1.0. Historical source lifecycle UNDER_REVIEW concerns unpublished-package governance, not current medical-review status.

Successor 1.5.0; case-version.anaphylaxis.dana.006.

Review execution hash: `0cc26e1bad72fd44f84afe9f11832789cc60fd8408c9b13e1276c9fbf2a0dd65`

Review subject hash: `bc2ea75e05a4c58f8ec6e4fea6e280190fca85dc3a1e8ed6753abbd8b7e51022`

Exact new synthetic values are owner-authored simulation data, not values prescribed by guidelines. Conflicting old values remain authoritative; decisions are listed below. This export includes legacy/non-shared actions so missing learner access is not hidden.

## 1. Demographics / context

| Field | Authored value |
| --- | --- |
| synthetic_name_en | Dana |
| synthetic_name_ar | دانا |
| adult | true |
| sex | female |

Setting: setting.ed-resuscitation; difficulty: difficulty.intermediate; duration estimate 15 minutes.

## 2. HPI / symptoms

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.dana.symptoms | I am itchy, anxious, dizzy and short of breath, with mild nausea and abdominal discomfort. | on_direct_question |

## 3–4. History, allergies and medicines

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.dana.identity | My name is Dana. I am an adult woman. | on_direct_question |
| fact.dana.onset | The itching, dizziness and difficulty breathing began about 10 to 15 minutes after a dessert that may have contained nuts. | on_direct_question |
| fact.dana.allergy | I had a mild reaction to nuts before, but never a severe allergic reaction requiring admission. I do not have an epinephrine auto-injector available. | on_direct_question |
| fact.dana.author.history.pmh | No known chronic cardiovascular, renal, hepatic, neurological or endocrine disease. | on_direct_question |
| fact.dana.author.history.respiratory-pmh | No known chronic respiratory disease or asthma. | on_direct_question |
| fact.dana.author.history.prior-reaction | Previous nut exposure caused itching and a limited rash only. No previous severe allergic reaction, shock, hospital admission or intubation. | on_direct_question |
| fact.dana.author.history.medications | No regular prescription medication, beta-blocker, ACE inhibitor or regular antihistamine use. | on_direct_question |
| fact.dana.author.history.allergies | Suspected nut allergy based on the prior mild reaction. This episode followed dessert likely containing nuts. No known medication allergy is documented. | on_direct_question |
| fact.dana.author.history.family | No known family history of severe allergic reactions or hereditary angioedema; otherwise non-contributory to this encounter. | on_direct_question |
| fact.dana.author.history.smoking | Non-smoker; no vaping. | on_direct_question |
| fact.dana.author.history.substances | No recreational drug use. | on_direct_question |
| fact.dana.author.history.alcohol | Alcohol use is none or occasional only; no relevant recent intake. | on_direct_question |
| fact.dana.author.history.function | Independent baseline function. | on_direct_question |
| fact.dana.author.history.onset | This episode began about 10–15 minutes after dessert likely containing nuts. | on_direct_question |
| fact.dana.author.history.presenting-symptoms | At onset I developed generalized itching and hives, shortness of breath, dizziness/feeling faint, mild lip swelling, and mild nausea/abdominal cramping. | on_direct_question |
| fact.dana.author.history.neurological-negatives | No loss of consciousness, seizure or focal neurological symptoms during this episode. | on_direct_question |
| fact.dana.author.history.chest-pain | No chest pain during this episode. | on_direct_question |
| fact.dana.author.history.infection | No fever or infectious prodrome preceding this episode. | on_direct_question |
| fact.dana.author.history.gi-negatives | No repetitive vomiting, diarrhea or severe abdominal pain during this episode. | on_direct_question |
| fact.dana.author.history.exposures | No known recent new medication exposure, reported insect sting or major trauma. | on_direct_question |
| fact.dana.author.history.prearrival-epinephrine | No epinephrine was used before arrival. | on_direct_question |

Owner decision supplied the previously missing chronic PMH, regular medicines, family/social history and pertinent negatives. Eighteen additive patient-known history facts are SIMULATION_AUTHORED / APPROVED_FOR_EXPO. All prior facts are preserved; no conflicting history/exam field was found. Alcohol remains the supplied bounded wording: none or occasional only, no relevant recent intake; no frequency/quantity is invented. Adult female only; no invented precise age, weight or negative pregnancy history.

## 5. Initial hidden physiology / acquired observations

| Dimension | Authored initial truth |
| --- | --- |
| state_schema_version | 1.0 |
| state_version | 0 |
| case_version | 1.5.0 |
| clinical_time | 0 |
| clinical_phase | phase.dana.active |
| hemodynamic_state | hemodynamics.dana.initial |
| cardiac_rhythm | rhythm.sinus-tachycardia |
| perfusion | perfusion.impaired |
| respiratory_state | respiratory.dana.initial |
| oxygenation | oxygenation.dana.room-air |
| consciousness | consciousness.alert |
| neurologic_state | neurologic.responsive |
| temperature_state | temperature.normal |
| metabolic_state | metabolic.review-baseline |
| pain_state | {"severity_0_10":2,"location_codes":["location.abdomen"],"quality_codes":["quality.discomfort"],"trend":"trend.persistent"} |

| Projection | Values |
| --- | --- |
| hemodynamic_mappings: hemodynamics.dana.initial | {"heart_rate_bpm":126,"systolic_bp_mm_hg":82,"diastolic_bp_mm_hg":48} |
| hemodynamic_mappings: hemodynamics.dana.improved | {"heart_rate_bpm":98,"systolic_bp_mm_hg":104,"diastolic_bp_mm_hg":66} |
| respiratory_mappings: respiratory.dana.initial | {"respiratory_rate_per_minute":28} |
| respiratory_mappings: respiratory.dana.improved | {"respiratory_rate_per_minute":20} |
| oxygenation_mappings: oxygenation.dana.room-air | {"spo2_percent":93} |
| oxygenation_mappings: oxygenation.dana.supported | {"spo2_percent":98} |
| temperature_mappings: temperature.normal | {"temperature_celsius":36.7} |
| consciousness_mappings: consciousness.alert | {"display_code":"display.alert-responsive"} |
| rhythm_mappings: rhythm.sinus-tachycardia | {"display_code":"display.sinus-tachycardia","waveform_descriptor":"waveform.sinus-tachycardia"} |
| rhythm_mappings: rhythm.sinus | {"display_code":"display.sinus","waveform_descriptor":"waveform.sinus"} |

Learner numeric HR/BP/RR/SpO2/temperature remain unknown until committed acquisition. BP is a point sample; monitoring refreshes only authored channels. BP cuff/IV/tubing remain downstream of receipts. Pulse-ox hardware remains PULSE_OX_VISUAL_ASSET_PENDING. Clinical Time is Session-owned. Measurement timings are compressed simulation fixtures, not real-world procedure durations.

## 6. Physical examination

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.dana.general | Conscious, anxious and responsive; uncomfortable, scratching and mildly tachypneic. | after_exam |
| fact.dana.skin | Erythematous pruritic urticaria on exposed arms and upper chest/neck. | after_exam |
| fact.dana.respiratory | Mild increased work of breathing with bilateral wheeze. | after_exam |
| fact.dana.cardiovascular | Tachycardia and hypotension. | after_exam |
| fact.dana.author.exam.general | Alert, interactive, anxious and visibly uncomfortable, with repeated scratching and mild tachypneic respiratory distress; dizzy but not collapsed. | after_exam |
| fact.dana.author.exam.neurological | GCS 15. Alert and oriented to person, place and situation; follows commands and speech is understandable. No focal neurological deficit, seizure activity or altered mental status. | after_exam |
| fact.dana.author.exam.airway | Patent airway with mild lip edema. No visible tongue swelling, obvious uvular swelling, drooling, stridor or severe voice change/hoarseness. Able to speak, although respiratory discomfort may limit phrase length. | after_exam |
| fact.dana.author.exam.respiratory | Mild increased work of breathing with bilateral wheeze. No focal unilateral reduction in air entry or clinical evidence of tension pneumothorax. | after_exam |
| fact.dana.author.exam.cardiovascular | Tachycardic and hypotensive; peripheral pulse rapid and reduced in volume. Capillary refill approximately 3 seconds. No obvious peripheral edema. | after_exam |
| fact.dana.author.exam.abdomen | Soft, non-distended abdomen with mild diffuse crampy discomfort reported. No focal tenderness, guarding, rebound tenderness or peritonism. No active vomiting during examination. | after_exam |
| fact.dana.author.exam.skin-mucosa | Widespread pruritic erythematous urticaria, most visible on the arms, neck and upper chest, with mild lip swelling. No cyanosis, blistering or skin sloughing. | after_exam |
| fact.dana.author.exam.extremities-perfusion | Peripheral pulses present but reduced in volume in the hypotensive state; capillary refill approximately 3 seconds. No peripheral edema, unilateral limb swelling, focal limb tenderness or signs of DVT. | after_exam |

All eight required domains now have owner-authored baseline examination candidates: general, neurological, airway, respiratory, cardiovascular, abdomen, skin/mucosa and extremities/perfusion. Each is SIMULATION_AUTHORED / APPROVED_FOR_EXPO, after_exam and explicitly forbidden to Patient Conversation. Initial HR126/BP82/48/RR28/SpO2 93 remain in authoritative physiology and WP1 acquisition, not automatically disclosed by a visual exam click. Findings describe the initial presentation; do not reinterpret them as a newly sampled post-treatment examination.

The existing visual examination framework selects regions and requests a clinical action; it does not itself commit an examination or disclose text findings. Expanded action-to-finding delivery is not implemented by this content-authoring pass. New examiner-only text remains withheld by learner APIs, rather than leaking via catalogue, timeline, Patient Conversation or a camera click. A later findings integration must use matching committed exam actions and state-appropriate findings, not time or region selection alone.

| Fact / domain | Origin | Review | Scope |
| --- | --- | --- | --- |
| fact.dana.author.history.pmh / pmh | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.respiratory-pmh / respiratory-pmh | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.prior-reaction / prior-reaction | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.medications / medications | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.allergies / allergies | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.family / family | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.smoking / smoking | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.substances / substances | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.alcohol / alcohol | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.function / function | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.onset / onset | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.presenting-symptoms / presenting-symptoms | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.neurological-negatives / neurological-negatives | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.chest-pain / chest-pain | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.infection / infection | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.gi-negatives / gi-negatives | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.exposures / exposures | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.history.prearrival-epinephrine / prearrival-epinephrine | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | PATIENT_KNOWN_HISTORY |
| fact.dana.author.exam.general / general | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | INITIAL_EXAM_FINDING |
| fact.dana.author.exam.neurological / neurological | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | INITIAL_EXAM_FINDING |
| fact.dana.author.exam.airway / airway | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | INITIAL_EXAM_FINDING |
| fact.dana.author.exam.respiratory / respiratory | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | INITIAL_EXAM_FINDING |
| fact.dana.author.exam.cardiovascular / cardiovascular | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | INITIAL_EXAM_FINDING |
| fact.dana.author.exam.abdomen / abdomen | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | INITIAL_EXAM_FINDING |
| fact.dana.author.exam.skin-mucosa / skin-mucosa | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | INITIAL_EXAM_FINDING |
| fact.dana.author.exam.extremities-perfusion / extremities-perfusion | SIMULATION_AUTHORED | APPROVED_FOR_EXPO | INITIAL_EXAM_FINDING |

## 7. Investigation catalogue / timing

| Case action | First-level / search / legacy | Result type | Milestones (clinical seconds after order) |
| --- | --- | --- | --- |
| investigation.dana.ecg | SHARED | TEXT_REPORT | ORDERED:0; RESULT_AVAILABLE:60; FORMAL_REPORT_AVAILABLE:60 |
| investigation.dana.cxr | SHARED | TEXT_REPORT | ORDERED:0; RESULT_AVAILABLE:300; FORMAL_REPORT_AVAILABLE:300 |
| investigation.dana.vbg | LEGACY CASE ONLY — not in shared UI | TEXT_REPORT | ORDERED:0; RESULT_AVAILABLE:180; FORMAL_REPORT_AVAILABLE:180 |
| investigation.dana.labs | LEGACY CASE ONLY — not in shared UI | TEXT_REPORT | ORDERED:0; RESULT_AVAILABLE:480; FORMAL_REPORT_AVAILABLE:480 |
| investigation.dana.tryptase | SEARCH_ONLY | TEXT_REPORT | ORDERED:0; RESULT_AVAILABLE:600; FORMAL_REPORT_AVAILABLE:600 |
| investigation.complete.dana.cbc | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.dana.electrolytes | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.dana.renal | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.dana.glucose | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.dana.troponin | SHARED | TEXT_REPORT | ORDERED:0; RESULT_AVAILABLE:600; FORMAL_REPORT_AVAILABLE:600 |
| investigation.complete.dana.coagulation | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.dana.blood-gas | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:180 |
| investigation.complete.dana.lactate | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:180 |
| investigation.complete.dana.liver | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.dana.crp | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.dana.d-dimer | SHARED | STRUCTURED_LAB | ORDERED:0; RESULT_AVAILABLE:480 |
| investigation.complete.dana.focused-echo | SHARED | ULTRASOUND | ORDERED:0; RESULT_AVAILABLE:240; FORMAL_REPORT_AVAILABLE:240 |

Milestones start at the committed order receipt after its 15-second simulation action cost. Independent orders run in parallel. Laboratory values are explicit fixed baseline samples collected at Case time 0, not newly inferred post-treatment physiology. Order/collection/availability times and result status are projected separately. This prevents baseline coagulation from masquerading as a post-heparin sample. Case repeat policy remains NOT_REPEATABLE; no invented serial troponin rise. Most lab panels have structured results only, not a fabricated narrative report.

## 8. Complete numerical result table

| Test/panel | Analyte | Value | Unit | Display interval | Flag | Sample |
| --- | --- | --- | --- | --- | --- | --- |
| investigation.complete.dana.cbc | White blood cell count | 8.5 | unit.x10e3-per-ul | 3.4–9.6 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.cbc | Hemoglobin | 13 | unit.g-dl | 11.6–15 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.cbc | Hematocrit | 40 | unit.percent | 35.5–44.9 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.cbc | Platelets | 250 | unit.x10e3-per-ul | 150–400 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.electrolytes | Sodium | 138 | unit.mmol-l | 135–145 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.electrolytes | Potassium | 4 | unit.mmol-l | 3.5–5 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.electrolytes | Chloride | 103 | unit.mmol-l | 98–107 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.electrolytes | Serum bicarbonate | 20 | unit.mmol-l | 22–29 | LOW | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.renal | Blood urea nitrogen | 14 | unit.mg-dl | 7–20 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.renal | Creatinine | 0.8 | unit.mg-dl | 0.6–1.2 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.renal | eGFR | >90 | unit.ml-min-1-73m2 | No universal interval asserted | Not inferred | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.glucose | Blood glucose | 112 | unit.mg-dl | No universal interval asserted | Not inferred | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.coagulation | PT | 12.3 | unit.second | 11–13.5 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.coagulation | INR | 1 | unit.ratio | 0.8–1.2 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.coagulation | aPTT | 29 | unit.second | 25–35 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.blood-gas | Blood gas pH | 7.34 | unit.ph | 7.31–7.41 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.blood-gas | Blood gas pCO2 | 36 | unit.mm-hg | 41–51 | LOW | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.blood-gas | Blood gas bicarbonate | 19 | unit.mmol-l | 22–26 | LOW | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.lactate | Lactate | 2.8 | unit.mmol-l | 0.5–2.2 | HIGH | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.liver | AST | 22 | unit.u-l | 10–40 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.liver | ALT | 18 | unit.u-l | 7–56 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.liver | Total bilirubin | 0.6 | unit.mg-dl | 0.2–1.2 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.liver | ALP | 74 | unit.u-l | 40–130 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.crp | CRP | 2 | unit.mg-l | 0–5 | NORMAL | BASELINE_CASE_SAMPLE t=0 |
| investigation.complete.dana.d-dimer | D-dimer | 0.28 | unit.mg-l-feu | 0–0.5 | NORMAL | BASELINE_CASE_SAMPLE t=0 |

Reference configuration: balsim.simulation-reference-bands.v1. CBC WBC/Hb/Hct bands informed by Mayo's adult laboratory catalogue; other bands are explicit simulation display configuration, not validated local-lab policy. No CRITICAL threshold is invented. eGFR is a supplied estimate (not recalculated from invented demographics). Dana >90 preserves its comparator. Glucose has no fasting interpretation. Current authored assay/qualifier limits are included in the owner-attested medical approval; no missing assay number is invented.

## 9. ECG / imaging / qualitative reports

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.dana.ecg | Sinus tachycardia; no significant acute ischemic change. Diagnostic tracing pending review/media. | after_result |
| fact.dana.cxr | No acute cardiopulmonary abnormality. Image pending; text-only review result. | after_result |
| fact.dana.vbg | Synthetic review VBG: pH 7.34, pCO2 36 mmHg, bicarbonate 19 mmol/L, lactate 2.8 mmol/L. Not a prerequisite for treatment; values require physician review. | after_result |
| fact.dana.labs | Synthetic review ED panel: hemoglobin 13 g/dL, WBC 8.5 x10^3/uL, platelets 250 x10^3/uL, sodium 138 mmol/L, potassium 4.0 mmol/L, creatinine 0.8 mg/dL, glucose 112 mg/dL. Physician review pending. | after_result |
| fact.dana.tryptase | Serum tryptase sample sent; result pending beyond this simulation. Supportive testing must not delay treatment and does not replace the clinical diagnosis. | after_result |
| fact.complete.dana.troponin | Cardiac troponin is within the configured assay reference range (negative). | after_result |
| fact.complete.dana.focused-echo | Focused cardiac ultrasound: hyperdynamic, relatively underfilled LV with preserved global systolic function and low end-diastolic volume. No focal regional wall-motion abnormality, RV dilatation/obvious strain, or pericardial effusion. Small IVC with marked respiratory collapsibility supports reduced effective preload in the current distributive/anaphylactic shock state. No gross structural abnormality on this limited bedside study; not a comprehensive echocardiogram. | after_result |

Dana FoCUS is owner-supplied SIMULATION_AUTHORED / APPROVED_FOR_EXPO, not a comprehensive echo; no precise EF invented. Qualitative negative troponin uses the existing TEXT_REPORT contract. The current qualitative assay representation is approved for Expo; no numeric assay is invented. ECG source reports sinus tachycardia; initial authored HR is126. No invented ischemia.

## 10. Medication / procedure plan

| Action/order | Fixed dose/route or authored consideration | Prerequisites | Simulation duration | Repeat | Model/evidence |
| --- | --- | --- | --- | --- | --- |
| consult.dana.call-help | call for resuscitation help | None authored | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| procedure.dana.oxygen | administer supplemental oxygen | None authored | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| procedure.dana.iv-access | establish IV access | None authored | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| procedure.dana.crystalloid-500 | give crystalloid 500 mL bolus and reassess | procedure.dana.iv-access | 15 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| procedure.dana.monitor | apply ECG, SpO2 and BP monitoring | None authored | 30 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.dana.epinephrine-im-05 | administer epinephrine 0.5 mg IM into anterolateral thigh | None authored | 30 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.dana.repeat-epinephrine-im-05 | repeat epinephrine 0.5 mg IM after 5 minutes if ABC problems persist | medication.dana.epinephrine-im-05 | 30 | NOT_REPEATABLE | AUTHORED_CASE_BEHAVIOR |
| medication.dana.antihistamine-adjunct | consider antihistamine for persistent skin symptoms after stabilization | None authored | Legacy action: existing contract | NOT_REPEATABLE | Legacy Case/rubric rules; no new effect |
| medication.dana.bronchodilator-adjunct | consider inhaled bronchodilator for persistent wheeze after first-line treatment | None authored | Legacy action: existing contract | NOT_REPEATABLE | Legacy Case/rubric rules; no new effect |
| procedure.dana.allergy-safety-plan | plan allergy follow-up, trigger avoidance and epinephrine auto-injector education | None authored | Legacy action: existing contract | NOT_REPEATABLE | Legacy Case/rubric rules; no new effect |
| medication.expo.aspirin-324-chewed | aspirin | None authored | 30 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| medication.expo.atorvastatin-80 | atorvastatin | None authored | 30 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| consult.expo.activate-cath-lab | cath lab | None authored | 15 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| medication.expo.clopidogrel-600 | clopidogrel | None authored | 30 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| procedure.expo.normal-saline-250 | saline 250 | procedure.dana.iv-access | 15 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| medication.expo.ticagrelor-180 | ticagrelor | None authored | 30 | NOT_REPEATABLE | NO_MODELED_BENEFIT |
| medication.expo.ufh-70-units-kg | unfractionated heparin | procedure.dana.iv-access | 30 | NOT_REPEATABLE | NO_MODELED_BENEFIT |

Orders are existing fixed orders (empty parameter arrays), not a free prescribing engine. Selecting a different dose/route as an extra parameter is rejected. No new score weight or physiological injury is authored. Cross-case distractors consume time and log evidence; NO_MODELED_BENEFIT is scoped to this synthetic model, not a universal drug claim. Legacy norepinephrine/adjunct considerations are not complete dose-prescribing protocols.

## 11. Deterministic transitions

| Rule | Trigger / conditions | Effects (exact deterministic authoring) | Emitted evidence |
| --- | --- | --- | --- |
| rule.dana.epi | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"MEDICATION_ORDERED","action_id":"medication.dana.epinephrine-im-05"},"preconditions":[],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.epi-given"}]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.epi-given","outcome_flag":"outcome.dana.epi-given"},{"effect_type":"SCHEDULE_RELATIVE","effect_id":"effect.dana.schedule-epi-response","scheduled_item_id":"scheduled-item.dana.epi-response","category":"dana.epi-response","priority":50,"conflict_policy":"BLOCK","effects":[{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.epi-response-ready","outcome_flag":"outcome.dana.epi-response-ready"}],"emitted_events":[],"delay_clinical_seconds":180},{"effect_type":"SCHEDULE_RELATIVE","effect_id":"effect.dana.schedule-repeat-window","scheduled_item_id":"scheduled-item.dana.repeat-window","category":"dana.repeat-window","priority":50,"conflict_policy":"BLOCK","effects":[{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.repeat-window-open","outcome_flag":"outcome.dana.repeat-window-open"}],"emitted_events":[],"delay_clinical_seconds":300}] | [] |
| rule.dana.oxygen | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"PROCEDURE_ORDERED","action_id":"procedure.dana.oxygen"},"preconditions":[],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.oxygen-given"}]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.oxygen-given","outcome_flag":"outcome.dana.oxygen-given"}] | [] |
| rule.dana.fluids | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"PROCEDURE_ORDERED","action_id":"procedure.dana.crystalloid-500"},"preconditions":[],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.fluid-response-ready"}]} | [{"effect_type":"SCHEDULE_RELATIVE","effect_id":"effect.dana.schedule-fluid-response","scheduled_item_id":"scheduled-item.dana.fluid-response","category":"dana.fluid-response","priority":50,"conflict_policy":"BLOCK","effects":[{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.fluid-response-ready","outcome_flag":"outcome.dana.fluid-response-ready"}],"emitted_events":[],"delay_clinical_seconds":180}] | [] |
| rule.dana.improve | {"trigger":{"trigger_type":"STATE_CONDITION","conditions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.epi-response-ready"},{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.oxygen-given"},{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.fluid-response-ready"}]},"preconditions":[],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.improved"}]} | [{"effect_type":"SET_STATE","effect_id":"effect.dana.phase-improved","target":"clinical_phase","value":"phase.dana.stabilized"},{"effect_type":"SET_STATE","effect_id":"effect.dana.hemodynamics-improved","target":"hemodynamic_state","value":"hemodynamics.dana.improved"},{"effect_type":"SET_STATE","effect_id":"effect.dana.respiratory-improved","target":"respiratory_state","value":"respiratory.dana.improved"},{"effect_type":"SET_STATE","effect_id":"effect.dana.oxygenation-improved","target":"oxygenation","value":"oxygenation.dana.supported"},{"effect_type":"SET_STATE","effect_id":"effect.dana.rhythm-improved","target":"cardiac_rhythm","value":"rhythm.sinus"},{"effect_type":"SET_STATE","effect_id":"effect.dana.perfusion-improved","target":"perfusion","value":"perfusion.improved"},{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.improved","outcome_flag":"outcome.dana.improved"}] | [{"event_type":"PATIENT_STATE_CHANGED","parameters":{},"payload":{"code":"dana.staged-response"},"clinical_effect_ids":[]}] |
| rule.dana.repeat-eligible | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"MEDICATION_ORDERED","action_id":"medication.dana.repeat-epinephrine-im-05"},"preconditions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.repeat-window-open"},{"condition_type":"OUTCOME_FLAG_ABSENT","outcome_flag":"outcome.dana.improved"}],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.repeat-given"}]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.repeat-given","outcome_flag":"outcome.dana.repeat-given"}] | [] |
| rule.dana.repeat-too-early | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"MEDICATION_ORDERED","action_id":"medication.dana.repeat-epinephrine-im-05"},"preconditions":[{"condition_type":"OUTCOME_FLAG_ABSENT","outcome_flag":"outcome.dana.repeat-window-open"}],"exclusions":[]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.repeat-outside-window","outcome_flag":"outcome.dana.repeat-outside-window"}] | [{"event_type":"CRITICAL_EVENT_OCCURRED","parameters":{},"payload":{"code":"dana.repeat-before-five-minutes"},"clinical_effect_ids":[]}] |
| rule.dana.critical-delay | {"trigger":{"trigger_type":"CLINICAL_TIME_THRESHOLD","threshold_clinical_time":300},"preconditions":[{"condition_type":"OUTCOME_FLAG_ABSENT","outcome_flag":"outcome.dana.epi-given"}],"exclusions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.critical-delay"}]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.critical-delay","outcome_flag":"outcome.dana.critical-delay"}] | [{"event_type":"CRITICAL_EVENT_OCCURRED","parameters":{},"payload":{"code":"dana.epinephrine-delay-no-invented-collapse"},"clinical_effect_ids":[]}] |
| rule.dana.observation | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"DISPOSITION_SELECTED","action_id":"disposition.dana.monitored-observation"},"preconditions":[{"condition_type":"OUTCOME_FLAG_PRESENT","outcome_flag":"outcome.dana.improved"}],"exclusions":[]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.observation-planned","outcome_flag":"outcome.dana.observation-planned"}] | [{"event_type":"OUTCOME_REACHED","action_id":"disposition.dana.monitored-observation","parameters":{},"payload":{"code":"dana.stabilized-for-monitored-observation"},"clinical_effect_ids":[]}] |
| rule.dana.premature-discharge | {"trigger":{"trigger_type":"COMMITTED_EVENT","event_type":"DISPOSITION_SELECTED","action_id":"disposition.dana.premature-discharge"},"preconditions":[],"exclusions":[]} | [{"effect_type":"ADD_OUTCOME_FLAG","effect_id":"effect.dana.unsafe-disposition","outcome_flag":"outcome.dana.unsafe-disposition"}] | [{"event_type":"CRITICAL_EVENT_OCCURRED","parameters":{},"payload":{"code":"dana.premature-discharge"},"clinical_effect_ids":[]}] |

Improvement waits for epinephrine response180s + oxygen flag + fluid response180s. Targets HR98, BP104/66, RR20, supported SpO2 98. Repeat IM epinephrine is eligible after300s if ABC problems persist, with prior-dose prerequisite. Early repeat produces unsafe evidence; five-minute delay produces critical evidence without invented collapse.

## 12–13. Diagnosis / disposition

| Stable fact | Authored content | Disclosure |
| --- | --- | --- |
| fact.dana.diagnosis | Food-triggered anaphylaxis with respiratory compromise and hypotension. | never_to_patient |

| Action | Authored label |
| --- | --- |
| diagnosis.dana.food-anaphylaxis | diagnose food-triggered anaphylaxis with hypotension |
| disposition.dana.monitored-observation | arrange monitored observation after stabilization |
| disposition.dana.premature-discharge | discharge before stabilization and observation |

These existing Case actions are retained in the package, but not added to the neutral shared first-level catalogue in this investigation-only correction. Full diagnosis/disposition/examination learner workflow coverage remains a separate explicit integration limitation, not a missing medical diagnosis. No automatic publication or production finalization.

## 14. Scoring / critical actions

| Domain / weight basis points | Criteria / points / evidence |
| --- | --- |
| history / 1000 | [{"rubric_item_id":"rubric-item.dana.history","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.dana.history"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}}] |
| examination / 1500 | [{"rubric_item_id":"rubric-item.dana.abcde","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.dana.abcde"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.dana.skin","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["examination.dana.skin"],"event_types":["EXAM_PERFORMED"]},"repeat_policy":{"mode":"ONCE"}}] |
| diagnostics / 1000 | [{"rubric_item_id":"rubric-item.dana.diagnosis","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["diagnosis.dana.food-anaphylaxis"],"event_types":["DIAGNOSIS_SUBMITTED"]},"repeat_policy":{"mode":"ONCE"}}] |
| management / 3500 | [{"rubric_item_id":"rubric-item.dana.epi","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.dana.epinephrine-im-05"],"event_types":["MEDICATION_ORDERED"],"timing_window_id":"window.dana.epi-early"},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.dana.support","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["procedure.dana.oxygen"],"event_types":["PROCEDURE_ORDERED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.dana.fluids","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["procedure.dana.crystalloid-500"],"event_types":["PROCEDURE_ORDERED"]},"repeat_policy":{"mode":"ONCE"}}] |
| clinical-reasoning / 1500 | [{"rubric_item_id":"rubric-item.dana.help","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["consult.dana.call-help"],"event_types":["CONSULT_REQUESTED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.dana.monitor","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["procedure.dana.monitor"],"event_types":["PROCEDURE_ORDERED"]},"repeat_policy":{"mode":"ONCE"}}] |
| Disposition and follow-up / 1500 | [{"rubric_item_id":"rubric-item.dana.observation","kind":"AWARD","points":10,"evidence":{"authority":"ANY_COMMITTED_EVENT","action_ids":["disposition.dana.monitored-observation"],"event_types":["OUTCOME_REACHED"]},"repeat_policy":{"mode":"ONCE"}},{"rubric_item_id":"rubric-item.dana.education","kind":"AWARD","points":10,"evidence":{"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["procedure.dana.allergy-safety-plan"],"event_types":["PROCEDURE_ORDERED"]},"repeat_policy":{"mode":"ONCE"}}] |

| Critical item | Evidence | Effect |
| --- | --- | --- |
| rubric-item.dana.critical-epi | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["medication.dana.epinephrine-im-05"],"event_types":["MEDICATION_ORDERED"],"timing_window_id":"window.dana.epi-early"} | {"effect_type":"CAP_OVERALL_SCORE","cap_basis_points":5000} |
| rubric-item.dana.unsafe-discharge | {"authority":"COMMITTED_LEARNER_EXECUTION","action_ids":["disposition.dana.premature-discharge"],"event_types":["DISPOSITION_SELECTED"]} | {"effect_type":"MARK_UNSAFE"} |

All rubric weights/hooks are inherited unchanged. New diagnostic panels do not acquire invented scoring weights. Actions remain recorded for later assessment. No runtime AI writes clinical effects or results.

## 15. Visual findings

Same Dana asset/rig. Initial anxious/itch, RR28 breathing, rash1/swelling1; authoritative improved flag drives calm/relieved, scratch/neck/forearm0, RR20 breathing, rash0.06/swelling0.05. Renderer interpolation never changes Clinical Engine state.

## 16. Patient Conversation facts

| Patient-known fact | Authored statement |
| --- | --- |
| fact.dana.identity | My name is Dana. I am an adult woman. |
| fact.dana.onset | The itching, dizziness and difficulty breathing began about 10 to 15 minutes after a dessert that may have contained nuts. |
| fact.dana.allergy | I had a mild reaction to nuts before, but never a severe allergic reaction requiring admission. I do not have an epinephrine auto-injector available. |
| fact.dana.symptoms | I am itchy, anxious, dizzy and short of breath, with mild nausea and abdominal discomfort. |
| fact.dana.author.history.pmh | No known chronic cardiovascular, renal, hepatic, neurological or endocrine disease. |
| fact.dana.author.history.respiratory-pmh | No known chronic respiratory disease or asthma. |
| fact.dana.author.history.prior-reaction | Previous nut exposure caused itching and a limited rash only. No previous severe allergic reaction, shock, hospital admission or intubation. |
| fact.dana.author.history.medications | No regular prescription medication, beta-blocker, ACE inhibitor or regular antihistamine use. |
| fact.dana.author.history.allergies | Suspected nut allergy based on the prior mild reaction. This episode followed dessert likely containing nuts. No known medication allergy is documented. |
| fact.dana.author.history.family | No known family history of severe allergic reactions or hereditary angioedema; otherwise non-contributory to this encounter. |
| fact.dana.author.history.smoking | Non-smoker; no vaping. |
| fact.dana.author.history.substances | No recreational drug use. |
| fact.dana.author.history.alcohol | Alcohol use is none or occasional only; no relevant recent intake. |
| fact.dana.author.history.function | Independent baseline function. |
| fact.dana.author.history.onset | This episode began about 10–15 minutes after dessert likely containing nuts. |
| fact.dana.author.history.presenting-symptoms | At onset I developed generalized itching and hives, shortness of breath, dizziness/feeling faint, mild lip swelling, and mild nausea/abdominal cramping. |
| fact.dana.author.history.neurological-negatives | No loss of consciousness, seizure or focal neurological symptoms during this episode. |
| fact.dana.author.history.chest-pain | No chest pain during this episode. |
| fact.dana.author.history.infection | No fever or infectious prodrome preceding this episode. |
| fact.dana.author.history.gi-negatives | No repetitive vomiting, diarrhea or severe abdominal pain during this episode. |
| fact.dana.author.history.exposures | No known recent new medication exposure, reported insect sting or major trauma. |
| fact.dana.author.history.prearrival-epinephrine | No epinephrine was used before arrival. |

No new lab/imaging/hidden diagnosis enters the patient-known allow-list. No provider calls were needed for this correction. New values are not patient dialogue.

## 17. Media issues

ECG/CXR/FoCUS have deterministic text results; dedicated images remain MEDIA_PENDING. No stock normal study assigned merely for symmetry. Dana Visual Patient and static fallback unchanged.

## 18. Preserved authoring conflicts / accepted current-content decisions

| Field | Existing truth | Requested target | Disposition |
| --- | --- | --- | --- |
| Dana CBC WBC / Hb / platelets | 8.5 / 13 / 250 | 11.2 / 13.4 / 265 | Preserve original values; Hct 40 is a new addition |
| Dana potassium / glucose | 4.0 / 112 | 3.8 / 132 | Preserve original values |
| Dana blood gas | VBG pH 7.34 / pCO2 36 / HCO3 19 | ABG 7.46 / 30 / 21; PaO2 69 | Preserve authored VBG as allowed equivalent; no arterial O2 inference |
| Dana lactate | 2.8 mmol/L | 2.6 mmol/L | Preserve original value |
| Dana tryptase | Sample sent; result pending beyond simulation | Acute result 18.0 microgram/L during encounter | Hold new value/workflow pending explicit decision |

Tryptase: legacy sample-sent report becomes available after600 clinical seconds; the assay result itself remains pending beyond this encounter. Requested18µg/L is HELD because it conflicts. Normal tryptase would not exclude anaphylaxis; later baseline sampling is a separate follow-up concept, not an immediate result. No investigation is a prerequisite for adrenaline.

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

Previous medical state: PENDING_PHYSICIAN_REVIEW / UNDER_REVIEW / REVIEW_ONLY, preserved in the 1.4.0 parent. Current 1.5.0 is a medical-metadata/version successor only. Source facts, values, rules, scoring and patient assets did not change. Prior pending authoring findings remain historical evidence, superseded for the current content by the bound owner attestation.

## Source traceability

- source.wp2.acs-2025: [2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline](https://professional.heart.org/en/science-news/2025-guideline-for-the-management-of-patients-with-acute-coronary-syndromes/top-things-to-know).
- source.wp2.rcuk-anaphylaxis-2021: [RCUK Emergency treatment of anaphylaxis (May 2021)](https://www.resus.org.uk/sites/default/files/2021-05/Emergency%20Treatment%20of%20Anaphylaxis%20May%202021_0.pdf).
- source.wp2.anaphylaxis-2023: [Anaphylaxis: A 2023 practice parameter update](https://www.aaaai.org/Aaaai/media/Media-Library-PDFs/Allergist%20Resources/Statements%20and%20Practice%20Parameters/Anaphylaxis-Practice-Paramaters-2023.pdf).
- source.wp2.expo-modeling-decision: [Owner-authorized WP2 bounded synthetic modeling decision](planning_input/medical_review/EXPO_SHARED_CATALOGUE_REVIEW.md).
- source.wp2.complete-case-authoring: [Owner-authored synthetic complete Case dataset and FoCUS clarification; conflicts retain prior truth](planning_input/medical_review/EXPO_CASE_COMPLETENESS_MATRIX.md).
- source.wp2.esc-2023: [2023 ESC ACS guideline](https://academic.oup.com/eurheartj/article/44/38/3720/7243210).
- source.wp2.wao-2020: [WAO Anaphylaxis Guidance 2020](https://doi.org/10.1016/j.waojou.2020.100472).
- source.wp2.reference-config: [Simulation display bands v1; local assay configuration, pending physician review](planning_input/medical_review/EXPO_CASE_COMPLETENESS_MATRIX.md).
- source.wp2.dana-author-history-exam: [Owner decision: complete Dana history and examination; simulation-authored candidate, not physician approval](planning_input/medical_review/DANA_COMPLETE_CASE_REVIEW.md).
- [Mayo CBC reference catalogue](https://mml.testcatalog.org/show/CBC): adult WBC/Hb/Hct display-band reference only.

Guidelines inform structure and urgency; they do not prescribe these exact patient numbers. Sources remain UNRESOLVED for approval/RAG purposes. No full copyrighted document ingested. Owner-attested physician review approves current medical content for Expo only; it does not approve source ingestion, media rights, official curriculum alignment or production publication.
