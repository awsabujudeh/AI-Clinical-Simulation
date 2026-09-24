import type { HashAdapter } from "../../../packages/contracts/src/index.ts";
import { CASE_MODULE_NAMES, DraftCasePackageSchema, generateRuleReachabilityEvidence, prepareReviewExecutionArtifact } from "../../../packages/case-schema/src/index.ts";

// Owner-locked synthetic Expo scenario. Numeric labs, response latency and rubric
// are authored REVIEW_ONLY proposals, not physician-approved medical policy.
const S = "source.dana.owner-scenario-review";
const mod = { module_schema_version: "2.0" };
const fact = (id: string, type: string, en: string, ar: string, disclosure = "on_direct_question") => ({ id: `fact.dana.${id}`, type, en, ar, disclosure });
const facts = [
  fact("identity", "HISTORY", "My name is Dana. I am an adult woman.", "اسمي دانا، أنا امرأة بالغة."),
  fact("onset", "HISTORY", "The itching, dizziness and difficulty breathing began about 10 to 15 minutes after a dessert that may have contained nuts.", "بلشت الحكة والدوخة وصعوبة التنفس بعد حوالي عشر إلى خمس عشرة دقيقة من حلو فيها مكسرات على الأغلب."),
  fact("allergy", "HISTORY", "I had a mild reaction to nuts before, but never a severe allergic reaction requiring admission. I do not have an epinephrine auto-injector available.", "صار معي تحسس خفيف من المكسرات قبل، بس ما دخلت المستشفى بسبب تحسس شديد. ما معي قلم أدرينالين."),
  fact("symptoms", "SYMPTOM", "I am itchy, anxious, dizzy and short of breath, with mild nausea and abdominal discomfort.", "عندي حكة وخوف ودوخة وضيق نفس وغثيان خفيف وعدم ارتياح بالبطن."),
  fact("general", "EXAM_FINDING", "Conscious, anxious and responsive; uncomfortable, scratching and mildly tachypneic.", "واعية وقلقة ومستجيبة، غير مرتاحة وتحك جلدها مع تسرع تنفس خفيف.", "after_exam"),
  fact("skin", "EXAM_FINDING", "Erythematous pruritic urticaria on exposed arms and upper chest/neck.", "شرى حمامي حاك على الذراعين المكشوفتين وأعلى الصدر والرقبة.", "after_exam"),
  fact("respiratory", "EXAM_FINDING", "Mild increased work of breathing with bilateral wheeze.", "زيادة خفيفة في جهد التنفس مع أزيز ثنائي الجانب.", "after_exam"),
  fact("cardiovascular", "EXAM_FINDING", "Tachycardia and hypotension.", "تسرع قلب مع انخفاض ضغط الدم.", "after_exam"),
  fact("ecg", "INVESTIGATION_RESULT", "Sinus tachycardia; no significant acute ischemic change. Diagnostic tracing pending review/media.", "تسرع جيبي دون تغير إقفاري حاد مهم. صورة التخطيط بانتظار المراجعة والوسائط.", "after_result"),
  fact("cxr", "INVESTIGATION_RESULT", "No acute cardiopulmonary abnormality. Image pending; text-only review result.", "لا شذوذ قلبي رئوي حاد. الصورة معلقة والنتيجة النصية للمراجعة فقط.", "after_result"),
  fact("vbg", "INVESTIGATION_RESULT", "Synthetic review VBG: pH 7.34, pCO2 36 mmHg, bicarbonate 19 mmol/L, lactate 2.8 mmol/L. Not a prerequisite for treatment; values require physician review.", "غاز وريدي اصطناعي للمراجعة: pH 7.34 وثاني أكسيد الكربون 36 ملم زئبق والبيكربونات 19 واللاكتات 2.8 مليمول/لتر. لا يؤخر العلاج ويحتاج مراجعة الطبيب.", "after_result"),
  fact("labs", "INVESTIGATION_RESULT", "Synthetic review ED panel: hemoglobin 13 g/dL, WBC 8.5 x10^3/uL, platelets 250 x10^3/uL, sodium 138 mmol/L, potassium 4.0 mmol/L, creatinine 0.8 mg/dL, glucose 112 mg/dL. Physician review pending.", "تحاليل طوارئ اصطناعية للمراجعة: هيموغلوبين 13، كريات بيضاء 8.5، صفائح 250، صوديوم 138، بوتاسيوم 4، كرياتينين 0.8 وسكر 112. مراجعة الطبيب معلقة.", "after_result"),
  fact("tryptase", "INVESTIGATION_RESULT", "Serum tryptase sample sent; result pending beyond this simulation. Supportive testing must not delay treatment and does not replace the clinical diagnosis.", "أرسلت عينة التريبتاز والنتيجة معلقة بعد نهاية المحاكاة. الفحص داعم ولا يؤخر العلاج ولا يستبدل التشخيص السريري.", "after_result"),
  fact("diagnosis", "DIAGNOSIS", "Food-triggered anaphylaxis with respiratory compromise and hypotension.", "التأق الحاد المحرّض بالطعام مع تأثر تنفسي وهبوط ضغط", "never_to_patient")
];
const action = (id: string, type: string, en: string, ar: string, prerequisites: string[] = []) => ({
  action_id: id, action_type: type, parameter_definitions: [],
  aliases: [{ locale: "en-US", phrases: [en], authority: "INTERPRETATION_ONLY" }, { locale: "ar-JO", phrases: [ar], authority: "INTERPRETATION_ONLY" }],
  // Same executable catalogue boundary as STEMI: explicit UI submission is the
  // intent; the Session/Clinical engines validate and commit it. The separate
  // two-stage administration contract is not implemented in this runtime.
  prerequisite_action_ids: prerequisites, confirmation_policy: "NONE",
  repeat_policy: "NOT_REPEATABLE", source_ids: [S]
});
const A = {
  help: "consult.dana.call-help", abcde: "examination.dana.abcde", skin: "examination.dana.skin", chest: "examination.dana.respiratory", face: "examination.dana.face-neck",
  history: "examination.dana.history", oxygen: "procedure.dana.oxygen", iv: "procedure.dana.iv-access", fluids: "procedure.dana.crystalloid-500", monitor: "procedure.dana.monitor",
  epi: "medication.dana.epinephrine-im-05", repeat: "medication.dana.repeat-epinephrine-im-05", anti: "medication.dana.antihistamine-adjunct", broncho: "medication.dana.bronchodilator-adjunct",
  dx: "diagnosis.dana.food-anaphylaxis", observe: "disposition.dana.monitored-observation", discharge: "disposition.dana.premature-discharge", education: "procedure.dana.allergy-safety-plan"
} as const;
export const DANA_ACTIONS = A;
const diagnostic = [ ["ecg", 60], ["cxr", 300], ["vbg", 180], ["labs", 480], ["tryptase", 600] ] as const;
const actions = [
  action(A.help,"CONSULT","call for resuscitation help","طلب فريق الإنعاش"), action(A.abcde,"EXAMINATION","perform ABCDE assessment","تقييم ABCDE"),
  action(A.skin,"EXAMINATION","examine arms and skin","فحص الذراعين والجلد"), action(A.chest,"EXAMINATION","examine respiratory system","فحص الجهاز التنفسي"),
  action(A.face,"EXAMINATION","inspect face, lips and neck","فحص الوجه والشفتين والرقبة"), action(A.history,"EXAMINATION","obtain allergy and exposure history","أخذ قصة التحسس والتعرض"),
  action(A.oxygen,"PROCEDURE","administer supplemental oxygen","إعطاء الأكسجين"), action(A.iv,"PROCEDURE","establish IV access","تأمين مدخل وريدي"),
  action(A.fluids,"PROCEDURE","give crystalloid 500 mL bolus and reassess","إعطاء دفعة بلورانية 500 مل وإعادة التقييم",[A.iv]),
  action(A.monitor,"PROCEDURE","apply ECG, SpO2 and BP monitoring","مراقبة التخطيط والإشباع والضغط"),
  action(A.epi,"MEDICATION","administer epinephrine 0.5 mg IM into anterolateral thigh","إعطاء أدرينالين 0.5 ملغ عضليًا في الجانب الأمامي الوحشي للفخذ"),
  action(A.repeat,"MEDICATION","repeat epinephrine 0.5 mg IM after 5 minutes if ABC problems persist","تكرار أدرينالين 0.5 ملغ عضليًا بعد خمس دقائق إذا استمرت مشاكل ABC",[A.epi]),
  action(A.anti,"MEDICATION","consider antihistamine for persistent skin symptoms after stabilization","النظر بمضاد الهيستامين للأعراض الجلدية بعد الاستقرار"),
  action(A.broncho,"MEDICATION","consider inhaled bronchodilator for persistent wheeze after first-line treatment","النظر بموسع قصبي مستنشق للأزيز المستمر بعد العلاج الأولي"),
  action(A.dx,"DIAGNOSIS","diagnose food-triggered anaphylaxis with hypotension","تشخيص التأق الغذائي مع هبوط الضغط"),
  action(A.observe,"DISPOSITION","arrange monitored observation after stabilization","ترتيب المراقبة بعد الاستقرار"),
  action(A.discharge,"DISPOSITION","discharge before stabilization and observation","تخريج قبل الاستقرار والمراقبة"),
  action(A.education,"PROCEDURE","plan allergy follow-up, trigger avoidance and epinephrine auto-injector education","خطة متابعة الحساسية وتجنب المحرض والتثقيف بقلم الأدرينالين"),
  ...diagnostic.map(([name, seconds]) => ({ ...action(`investigation.dana.${name}`,"INVESTIGATION",`order ${name.toUpperCase()} (must not delay treatment)`,`طلب ${name.toUpperCase()} دون تأخير العلاج`),
    investigation: { investigation_schema_version: "1.0", execution_mode: "ASYNC_PARALLEL",
      result: { result_schema_version: "1.0", diagnostic_result_id: `diagnostic-result.dana.${name}`, result_type: "TEXT_REPORT", modality: "TEXT_REPORT", source_ids: [S], finding_fact_ids: [`fact.dana.${name}`], report_content_key: `fact.dana.${name}` },
      milestones: [{ diagnostic_milestone_id: `diagnostic-milestone.dana.${name}-ordered`, milestone_type: "ORDERED", offset_clinical_seconds: 0 }, { diagnostic_milestone_id: `diagnostic-milestone.dana.${name}-result`, milestone_type: "RESULT_AVAILABLE", offset_clinical_seconds: seconds }, { diagnostic_milestone_id: `diagnostic-milestone.dana.${name}-report`, milestone_type: "FORMAL_REPORT_AVAILABLE", offset_clinical_seconds: seconds }],
      learner_visibility: { structured_result: "AT_COMPONENT_AVAILABILITY", media: "NEVER", machine_interpretation: "NEVER", formal_report: "AT_COMPONENT_AVAILABILITY" } } }))
];
const flag = (id: string) => ({ effect_type: "ADD_OUTCOME_FLAG", effect_id: `effect.dana.${id}`, outcome_flag: `outcome.dana.${id}` });
const has = (id: string) => ({ condition_type: "OUTCOME_FLAG_PRESENT", outcome_flag: `outcome.dana.${id}` });
const lacks = (id: string) => ({ condition_type: "OUTCOME_FLAG_ABSENT", outcome_flag: `outcome.dana.${id}` });
const set = (suffix: string, target: string, value: string) => ({ effect_type: "SET_STATE", effect_id: `effect.dana.${suffix}`, target, value });
const emit = (event_type: string, code: string) => ({ event_type, parameters: {}, payload: { code }, clinical_effect_ids: [] });
function schedule(id: string, seconds: number, effects: unknown[], emitted_events: unknown[] = []) { return { effect_type: "SCHEDULE_RELATIVE", effect_id: `effect.dana.schedule-${id}`, scheduled_item_id: `scheduled-item.dana.${id}`, category: `dana.${id}`, priority: 50, conflict_policy: "BLOCK", delay_clinical_seconds: seconds, effects, emitted_events }; }
function rule(id: string, trigger: unknown, effects: unknown[], preconditions: unknown[] = [], exclusions: unknown[] = [], emitted_events: unknown[] = [], refs: string[] = []) {
  return { rule_schema_version: "1.0", rule_id: `rule.dana.${id}`, rule_version: "1.0.0", trigger, preconditions, exclusions, priority: 50, conflict_policy: "BLOCK", effects, emitted_events,
    referenced_action_ids: refs, referenced_rule_ids: [], referenced_fact_ids: [], source_ids: [S], timing_window_ids: [], scoring_evidence_refs: [] };
}
const event = (event_type: string, action_id: string) => ({ trigger_type: "COMMITTED_EVENT", event_type, action_id });
const rules = [
  ...diagnostic.map(([name, seconds]) => rule(`diagnostic-${name}`,event("INVESTIGATION_ORDERED",`investigation.dana.${name}`),[
    schedule(`diagnostic-${name}`,seconds,[],[{ ...emit("INVESTIGATION_RESULT_AVAILABLE",`dana.${name}-available`), action_id: `investigation.dana.${name}` },{ ...emit("INVESTIGATION_FORMAL_REPORT_AVAILABLE",`dana.${name}-report`), action_id: `investigation.dana.${name}` }])],[],[],[],[`investigation.dana.${name}`])),
  rule("epi",event("MEDICATION_ORDERED",A.epi),[flag("epi-given"),schedule("epi-response",180,[flag("epi-response-ready")]),schedule("repeat-window",300,[flag("repeat-window-open")])],[],[has("epi-given")],[],[A.epi]),
  rule("oxygen",event("PROCEDURE_ORDERED",A.oxygen),[flag("oxygen-given")],[],[has("oxygen-given")],[],[A.oxygen]),
  rule("fluids",event("PROCEDURE_ORDERED",A.fluids),[schedule("fluid-response",180,[flag("fluid-response-ready")])],[],[has("fluid-response-ready")],[],[A.iv,A.fluids]),
  rule("improve",{ trigger_type: "STATE_CONDITION", conditions: [has("epi-response-ready"),has("oxygen-given"),has("fluid-response-ready")] },[
    set("phase-improved","clinical_phase","phase.dana.stabilized"),set("hemodynamics-improved","hemodynamic_state","hemodynamics.dana.improved"),set("respiratory-improved","respiratory_state","respiratory.dana.improved"),set("oxygenation-improved","oxygenation","oxygenation.dana.supported"),set("rhythm-improved","cardiac_rhythm","rhythm.sinus"),set("perfusion-improved","perfusion","perfusion.improved"),flag("improved")
  ],[],[has("improved")],[emit("PATIENT_STATE_CHANGED","dana.staged-response")]),
  rule("repeat-eligible",event("MEDICATION_ORDERED",A.repeat),[flag("repeat-given")],[has("repeat-window-open"),lacks("improved")],[has("repeat-given")],[],[A.epi,A.repeat]),
  rule("repeat-too-early",event("MEDICATION_ORDERED",A.repeat),[flag("repeat-outside-window")],[lacks("repeat-window-open")],[],[emit("CRITICAL_EVENT_OCCURRED","dana.repeat-before-five-minutes")],[A.repeat]),
  rule("critical-delay",{ trigger_type: "CLINICAL_TIME_THRESHOLD", threshold_clinical_time: 300 },[flag("critical-delay")],[lacks("epi-given")],[has("critical-delay")],[emit("CRITICAL_EVENT_OCCURRED","dana.epinephrine-delay-no-invented-collapse")],[A.epi]),
  rule("observation",event("DISPOSITION_SELECTED",A.observe),[flag("observation-planned")],[has("improved")],[],[{...emit("OUTCOME_REACHED","dana.stabilized-for-monitored-observation"),action_id:A.observe}],[A.observe]),
  rule("premature-discharge",event("DISPOSITION_SELECTED",A.discharge),[flag("unsafe-disposition")],[],[],[emit("CRITICAL_EVENT_OCCURRED","dana.premature-discharge")],[A.discharge])
];
const criterion = (id: string, ids: string[], types: string[], window?: string) => ({ rubric_item_id: `rubric-item.dana.${id}`, kind: "AWARD", points: 10,
  evidence: { authority: types.includes("OUTCOME_REACHED") ? "ANY_COMMITTED_EVENT" : "COMMITTED_LEARNER_EXECUTION", action_ids: ids, event_types: types, ...(window ? { timing_window_id: window } : {}) }, repeat_policy: { mode: "ONCE" } });
const domains = [
  ["history",1000,[criterion("history",[A.history],["EXAM_PERFORMED"])]],
  ["examination",1500,[criterion("abcde",[A.abcde],["EXAM_PERFORMED"]),criterion("skin",[A.skin],["EXAM_PERFORMED"])]],
  ["diagnostics",1000,[criterion("diagnosis",[A.dx],["DIAGNOSIS_SUBMITTED"])]],
  ["management",3500,[criterion("epi",[A.epi],["MEDICATION_ORDERED"],"window.dana.epi-early"),criterion("support",[A.oxygen],["PROCEDURE_ORDERED"]),criterion("fluids",[A.fluids],["PROCEDURE_ORDERED"])]],
  ["clinical-reasoning",1500,[criterion("help",[A.help],["CONSULT_REQUESTED"]),criterion("monitor",[A.monitor],["PROCEDURE_ORDERED"])]],
  ["reperfusion-disposition",1500,[criterion("observation",[A.observe],["OUTCOME_REACHED"]),criterion("education",[A.education],["PROCEDURE_ORDERED"])]]
] as const;
export async function createDanaCase(hash: HashAdapter) {
  const c = DraftCasePackageSchema.parse({
    manifest: { case_id:"case.anaphylaxis.dana.001",case_package_id:"case-package.anaphylaxis.dana.001",case_version_id:"case-version.anaphylaxis.dana.001",case_version:"1.0.0",schema_version:"2.0",status:"UNDER_REVIEW",modules:CASE_MODULE_NAMES.map(module_name=>({module_name,schema_version:"2.0",compatible_package_schema_versions:["2.0"],required:true,approval_status:"UNDER_REVIEW"})) },
    classification: { ...mod,setting_code:"setting.ed-resuscitation",specialty_codes:["specialty.emergency-medicine"],acuity_code:"acuity.high",difficulty_code:"difficulty.intermediate",target_level_codes:["level.senior-medical-student"],estimated_duration_minutes:15,tag_codes:["tag.anaphylaxis","tag.review-required"] },
    localization: { ...mod,fallback_locale:"en-US",entries:[...facts.map(f=>({key:f.id,translations:[{locale:"en-US",text:f.en},{locale:"ar-JO",text:f.ar}]})),
      ...[["case.dana.title","Dana — food-triggered anaphylaxis","دانا — التأق الحاد المحرّض بالطعام"],["case.dana.triage","Dana, an adult woman, is conscious and anxious with itching, mild breathlessness and dizziness after food.","دانا امرأة بالغة واعية وقلقة مع حكة وضيق نفس خفيف ودوخة بعد الطعام."],["dialogue.dana.fallback","I am not sure, doctor. Please ask me about what happened or how I feel.","مش متأكدة دكتور، اسألني شو صار معي أو كيف حاسة."],["instructor.dana.review","Owner-authored scenario; synthetic response timing and labs require physician review. No tests may delay IM epinephrine. No automatic home discharge.","سيناريو مؤلف للمراجعة، توقيت الاستجابة والتحاليل اصطناعيان ويحتاجان مراجعة الطبيب. لا تؤخر الفحوص الأدرينالين العضلي ولا تخريج تلقائي."]].map(([key,en,ar])=>({key,translations:[{locale:"en-US",text:en},{locale:"ar-JO",text:ar}]})),
      ...domains.map(([code])=>({key:`domain.dana.${code}`,translations:[{locale:"en-US",text:code==="reperfusion-disposition"?"Disposition and follow-up":code},{locale:"ar-JO",text:code==="reperfusion-disposition"?"التصرف والمتابعة":code}]}))] },
    patient_profile:{...mod,patient_id:"patient.dana",default_language:"ar-JO",supported_languages:["ar-JO","en-US"],persona_code:"persona.dana",conversational_style_code:"style.anxious-natural",disclosure_policy_id:"dialogue.dana.patient",extensions:{"dana.demographics":{synthetic_name_en:"Dana",synthetic_name_ar:"دانا",adult:true,sex:"female"}}},
    presentation:{...mod,chief_complaint_fact_id:"fact.dana.symptoms",arrival_context_code:"arrival.food-reaction",triage_summary_key:"case.dana.triage",initial_public_fact_ids:["fact.dana.identity","fact.dana.symptoms"]},
    initial_state:{...mod,patient_state:{state_schema_version:"1.0",state_version:0,case_version:"1.0.0",clinical_time:0,clinical_phase:"phase.dana.active",hemodynamic_state:"hemodynamics.dana.initial",cardiac_rhythm:"rhythm.sinus-tachycardia",perfusion:"perfusion.impaired",respiratory_state:"respiratory.dana.initial",oxygenation:"oxygenation.dana.room-air",consciousness:"consciousness.alert",neurologic_state:"neurologic.responsive",temperature_state:"temperature.normal",metabolic_state:"metabolic.review-baseline",pain_state:{severity_0_10:2,location_codes:["location.abdomen"],quality_codes:["quality.discomfort"],trend:"trend.persistent"},active_interventions:[],active_complications:[],outcome_flags:[]},
      observation_projection:{projection_schema_version:"1.0",projection_definition_id:"projection.dana.v1",hemodynamic_mappings:{"hemodynamics.dana.initial":{heart_rate_bpm:126,systolic_bp_mm_hg:82,diastolic_bp_mm_hg:48},"hemodynamics.dana.improved":{heart_rate_bpm:98,systolic_bp_mm_hg:104,diastolic_bp_mm_hg:66}},respiratory_mappings:{"respiratory.dana.initial":{respiratory_rate_per_minute:28},"respiratory.dana.improved":{respiratory_rate_per_minute:20}},oxygenation_mappings:{"oxygenation.dana.room-air":{spo2_percent:93},"oxygenation.dana.supported":{spo2_percent:98}},temperature_mappings:{"temperature.normal":{temperature_celsius:36.7}},consciousness_mappings:{"consciousness.alert":{display_code:"display.alert-responsive"}},rhythm_mappings:{"rhythm.sinus-tachycardia":{display_code:"display.sinus-tachycardia",waveform_descriptor:"waveform.sinus-tachycardia"},"rhythm.sinus":{display_code:"display.sinus",waveform_descriptor:"waveform.sinus"}}}},
    clinical_facts:{...mod,facts:facts.map(f=>({fact_id:f.id,fact_type:f.type,clinical_code:`dana.${f.id.split('.').at(-1)}`,content_key:f.id,disclosure_mode:f.disclosure,source_ids:[S]}))},
    action_catalogue:{...mod,actions},rules:{...mod,rule_schema_version:"1.0",rules},
    timeline_policy:{...mod,scheduler_schema_version:"1.0",time_ratio:1,pause_policy:"PAUSE_CLINICAL_TIME",deterministic_seed_policy:"FIXED",max_derived_evaluations:32,timing_windows:[{timing_window_id:"window.dana.epi-early",starts_at_clinical_seconds:0,ends_at_clinical_seconds:300,start_inclusive:true,end_inclusive:false,reference_event_type:"MEDICATION_ORDERED",reference_action_id:A.epi}],initial_scheduled_event_types:[],interrupting_event_types:["CRITICAL_EVENT_OCCURRED"],initial_scheduled_items:[]},
    assessment_rubric:{...mod,assessment_schema_version:"1.0",rubric_id:"rubric.dana.anaphylaxis",rubric_version:"1.0.0",domains:domains.map(([code,weight,criteria])=>({domain_code:`domain.${code}`,title_key:`domain.dana.${code}`,weight_basis_points:weight,criteria})),critical_items:[
      {rubric_item_id:"rubric-item.dana.critical-epi",kind:"CRITICAL_ACTION",evidence:{authority:"COMMITTED_LEARNER_EXECUTION",action_ids:[A.epi],event_types:["MEDICATION_ORDERED"],timing_window_id:"window.dana.epi-early"},effect:{effect_type:"CAP_OVERALL_SCORE",cap_basis_points:5000}},
      {rubric_item_id:"rubric-item.dana.unsafe-discharge",kind:"CRITICAL_ERROR",evidence:{authority:"COMMITTED_LEARNER_EXECUTION",action_ids:[A.discharge],event_types:["DISPOSITION_SELECTED"]},effect:{effect_type:"MARK_UNSAFE"}}],source_ids:[S]},
    dialogue_policy:{...mod,dialogue_policy_id:"dialogue.dana.patient",disclosable_fact_ids:facts.filter(f=>f.disclosure!=="never_to_patient").map(f=>f.id),forbidden_fact_ids:["fact.dana.diagnosis"],question_concept_codes:["question.onset","question.allergies","question.associated-symptoms","question.past-medical-history"],emotional_tone_code:"tone.anxious",deterministic_fallback_key:"dialogue.dana.fallback"},
    visual_manifest:{...mod,visual_manifest_id:"visual.dana.review",visual_manifest_version:"1.0.0",media_assets:[{media_asset_id:"asset.dana.static-pending",media_kind:"STATIC_IMAGE",required:true,static_fallback:true}],recipes:[{recipe_id:"recipe.dana.anxious-itching",media_asset_ids:["asset.dana.static-pending"],fallback_asset_id:"asset.dana.static-pending"}],required_static_fallback_asset_id:"asset.dana.static-pending",preload_groups:[]},
    curriculum_mappings:{...mod,objectives:[],mappings:[],official_alignment_claimed:false},
    validation:{...mod,required_source_ids:[S],sources:[{source_id:S,source_version_id:"source-version.dana.owner-scenario-review-v1",status:"UNRESOLVED",required:true}],reviewers:[],reviews:[],deferred_checks:[],review_status:"UNDER_REVIEW",approval_status:"UNDER_REVIEW"},
    instructor_notes:{...mod,facilitation_note_keys:["instructor.dana.review"],teaching_point_codes:["teaching.anaphylaxis-recognition","teaching.im-epinephrine-first","teaching.no-investigation-delay","teaching.monitored-observation"],patient_ai_access:"ALLOWED"}
  });
  c.validation.deferred_checks = [(await generateRuleReachabilityEvidence(c,"2026-09-21T00:00:00Z",hash)).evidence];
  return DraftCasePackageSchema.parse(c);
}
export async function prepareDanaReview(hash: HashAdapter) {
  return prepareReviewExecutionArtifact(await createDanaCase(hash), hash);
}
