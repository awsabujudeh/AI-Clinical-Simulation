import type { HashAdapter } from "../../../../packages/contracts/src/index.ts";
import {
  DraftCasePackageSchema,
  RULE_REACHABILITY_VALIDATION_CODE,
  ValidationEvidenceSchema,
  generateRuleReachabilityEvidence,
  type DraftCasePackage
} from "../../../../packages/case-schema/src/index.ts";

export const STEMI_CASE_ID = "case.stemi.inferior-rv.001" as const;
export const STEMI_CASE_VERSION_ID = "case-version.stemi.inferior-rv.001" as const;
export const STEMI_CASE_PACKAGE_ID = "case-package.stemi.inferior-rv.001" as const;
export const STEMI_CASE_VERSION = "2.0.0" as const;
export const STEMI_REACHABILITY_COMPLETED_AT_UTC = "2026-09-03T00:00:00Z" as const;

const SOURCE_PRIMARY = "source.stemi.acc-aha-acs-2025";
const SOURCE_ESC = "source.stemi.esc-acs-2023";
const SOURCE_SHOCK = "source.stemi.acc-shock-2025";
const SOURCE_CHEST_PAIN = "source.stemi.aha-chest-pain-2021";
const ALL_SOURCE_IDS = [SOURCE_PRIMARY, SOURCE_ESC, SOURCE_SHOCK, SOURCE_CHEST_PAIN];

const MODULE_NAMES = [
  "manifest",
  "classification",
  "localization",
  "patient_profile",
  "presentation",
  "initial_state",
  "clinical_facts",
  "action_catalogue",
  "rules",
  "timeline_policy",
  "assessment_rubric",
  "dialogue_policy",
  "visual_manifest",
  "curriculum_mappings",
  "validation",
  "instructor_notes"
] as const;

type FactAuthoring = Readonly<{
  id: string;
  type: "HISTORY" | "SYMPTOM" | "EXAM_FINDING" | "INVESTIGATION_RESULT" | "DIAGNOSIS" | "DIFFERENTIAL" | "DISPOSITION";
  code: string;
  disclosure: "on_direct_question" | "after_exam" | "after_result" | "never_to_patient";
  en: string;
  ar: string;
  sources?: readonly string[];
}>;

const FACTS: readonly FactAuthoring[] = [
  { id: "fact.stemi.chief-complaint", type: "SYMPTOM", code: "symptom.chest-pain-severe", disclosure: "on_direct_question", en: "Severe central pressure-like chest pain at rest.", ar: "ألم صدري مركزي شديد وضاغط أثناء الراحة." },
  { id: "fact.stemi.pain-radiation", type: "SYMPTOM", code: "symptom.pain-radiation-left-arm-jaw", disclosure: "on_direct_question", en: "Pain radiates to the left arm and jaw.", ar: "يمتد الألم إلى الذراع اليسرى والفك." },
  { id: "fact.stemi.symptom-onset", type: "HISTORY", code: "history.symptom-onset-55-minutes", disclosure: "on_direct_question", en: "Symptoms began approximately 55 minutes before the emergency-department handoff and have remained continuous.", ar: "بدأت الأعراض قبل نحو 55 دقيقة من تسليم الحالة في قسم الطوارئ واستمرت دون انقطاع." },
  { id: "fact.stemi.associated-symptoms", type: "SYMPTOM", code: "symptom.diaphoresis-nausea-dyspnea-dizziness", disclosure: "on_direct_question", en: "Associated diaphoresis, nausea with one episode of vomiting, dyspnea, dizziness, near-syncope, and palpitations; no loss of consciousness.", ar: "يرافق الألم تعرّق وغثيان مع نوبة قيء واحدة وضيق نفس ودوخة وشعور بقرب الإغماء وخفقان دون فقدان للوعي." },
  { id: "fact.stemi.negative-infectious-history", type: "HISTORY", code: "history.no-fever-cough-hemoptysis", disclosure: "on_direct_question", en: "No fever, chills, cough, or hemoptysis.", ar: "لا توجد حمى أو قشعريرة أو سعال أو نفث دموي." },
  { id: "fact.stemi.past-medical-history", type: "HISTORY", code: "history.hypertension-diabetes-dyslipidemia", disclosure: "on_direct_question", en: "Known hypertension, type 2 diabetes mellitus, and dyslipidemia; no known coronary disease, prior MI, PCI, CABG, heart failure, arrhythmia, stroke, chronic kidney disease, lung disease, or recent surgery.", ar: "لديه ارتفاع ضغط الدم والسكري من النوع الثاني واضطراب شحوم الدم، دون مرض تاجي معروف أو احتشاء سابق أو قسطرة أو جراحة مجازة أو فشل قلب أو اضطراب نظم أو سكتة أو مرض كلوي مزمن أو مرض رئوي أو جراحة حديثة." },
  { id: "fact.stemi.home-medications", type: "HISTORY", code: "history.home-medications", disclosure: "on_direct_question", en: "Home medicines are metformin 1000 mg twice daily, amlodipine 5 mg daily, and atorvastatin 20 mg nightly; no chronic aspirin or anticoagulant.", ar: "أدويته المنزلية ميتفورمين 1000 ملغ مرتين يوميًا وأملوديبين 5 ملغ يوميًا وأتورفاستاتين 20 ملغ ليلًا، ولا يتناول الأسبرين المزمن أو مضاد تخثر." },
  { id: "fact.stemi.contraindications", type: "HISTORY", code: "history.no-aspirin-allergy-bleeding-pde5", disclosure: "on_direct_question", en: "No known drug allergies; denies aspirin allergy, active or prior significant bleeding, intracranial hemorrhage, gastrointestinal bleeding, trauma, surgery, anticoagulant use, sildenafil/vardenafil use, or tadalafil use.", ar: "لا توجد حساسية دوائية معروفة، وينفي حساسية الأسبرين أو النزف الحالي أو السابق المهم أو النزف داخل القحف أو الهضمي أو الرضوض أو الجراحة أو استعمال مضاد تخثر أو سيلدينافيل/فاردينافيل أو تادالافيل." },
  { id: "fact.stemi.social-risk", type: "HISTORY", code: "history.smoking-40-pack-years", disclosure: "on_direct_question", en: "Smokes about one pack daily for 40 years (approximately 40 pack-years); denies alcohol, cocaine, amphetamine, and other drug use; works as a taxi driver with low activity.", ar: "يدخن نحو علبة يوميًا منذ 40 عامًا (نحو 40 علبة-سنة)، وينفي الكحول والكوكايين والأمفيتامين والمخدرات الأخرى، ويعمل سائق تاكسي ونشاطه منخفض." },
  { id: "fact.stemi.family-history", type: "HISTORY", code: "history.father-mi-age-60", disclosure: "on_direct_question", en: "Father had a myocardial infarction and died at approximately age 60.", ar: "أصيب والده باحتشاء عضلة القلب وتوفي بعمر يقارب 60 عامًا." },
  { id: "fact.stemi.general-appearance", type: "EXAM_FINDING", code: "exam.pale-clammy-diaphoretic-distressed", disclosure: "after_exam", en: "Pale, clammy, anxious, diaphoretic, cool, visibly distressed, and speaking in short sentences.", ar: "يبدو شاحبًا ومتعرقًا وقلقًا وبارد الأطراف ومتألمًا بوضوح ويتحدث بجمل قصيرة." },
  { id: "fact.stemi.cardiac-exam", type: "EXAM_FINDING", code: "exam.regular-tachycardia-no-murmur", disclosure: "after_exam", en: "Regular tachycardia; S1 and S2 present without murmur or rub.", ar: "تسرع قلب منتظم، والصوتان الأول والثاني مسموعان دون نفخة أو احتكاك." },
  { id: "fact.stemi.jvp-exam", type: "EXAM_FINDING", code: "exam.jvp-four-cm", disclosure: "after_exam", en: "JVP is approximately 4 cm at 45 degrees; a subtle Kussmaul sign is optional and not core-scored.", ar: "الضغط الوريدي الوداجي نحو 4 سم بزاوية 45 درجة؛ وقد توجد علامة كوسماول خفيفة بشكل اختياري وليست ضمن الدرجة الأساسية." },
  { id: "fact.stemi.perfusion-exam", type: "EXAM_FINDING", code: "exam.weak-pulses-capillary-refill-three-seconds", disclosure: "after_exam", en: "Peripheral pulses are weak and symmetric, capillary refill is 3 seconds, and there is no edema.", ar: "النبضات الطرفية ضعيفة ومتناظرة وامتلاء الشعيرات 3 ثوانٍ ولا توجد وذمة." },
  { id: "fact.stemi.respiratory-exam", type: "EXAM_FINDING", code: "exam.clear-lungs-mild-work", disclosure: "after_exam", en: "Lungs are clear without crackles or wheeze; mildly increased work of breathing with symmetric air entry.", ar: "الرئتان صافيتان دون خراخر أو أزيز، مع زيادة خفيفة في جهد التنفس ودخول هواء متناظر." },
  { id: "fact.stemi.other-exam", type: "EXAM_FINDING", code: "exam.no-focal-or-alternative-finding", disclosure: "after_exam", en: "No chest-wall tenderness or focal neurologic deficit; abdomen is soft and nontender without guarding, mass, or significant hepatomegaly; no unilateral leg swelling or pulse asymmetry.", ar: "لا يوجد ألم بجدار الصدر أو عجز عصبي بؤري؛ البطن لين وغير مؤلم دون دفاع أو كتلة أو تضخم كبدي مهم؛ ولا يوجد تورم أحادي بالساق أو عدم تناظر بالنبض." },
  { id: "fact.stemi.ecg-inferior-findings", type: "INVESTIGATION_RESULT", code: "diagnostic.ecg.inferior-st-elevation", disclosure: "after_result", en: "12-lead ECG: sinus tachycardia about 112 bpm, PR 160 ms, QRS 90 ms, QTc about 435 ms; ST elevation II 2 mm, III 3 mm, aVF 2 mm with reciprocal ST depression in I and aVL and no posterior pattern in V1-V3.", ar: "تخطيط 12 اشتقاقًا: تسرع جيبي نحو 112/د، PR 160 مللي ثانية، QRS 90 مللي ثانية، QTc نحو 435 مللي ثانية؛ ارتفاع ST بمقدار 2 مم في II و3 مم في III و2 مم في aVF مع انخفاض انعكاسي في I وaVL ودون نمط خلفي في V1-V3." },
  { id: "fact.stemi.ecg-right-findings", type: "INVESTIGATION_RESULT", code: "diagnostic.ecg.right-sided-st-elevation", disclosure: "after_result", en: "Right-sided ECG: V3R ST elevation 1 mm and V4R ST elevation 1.5 mm, supporting right-ventricular involvement.", ar: "التخطيط الأيمن: ارتفاع ST بمقدار 1 مم في V3R و1.5 مم في V4R بما يدعم إصابة البطين الأيمن." },
  { id: "fact.stemi.cbc-result", type: "INVESTIGATION_RESULT", code: "diagnostic.lab.cbc-authored", disclosure: "after_result", en: "CBC: WBC 9.1 x10^3/uL, hemoglobin 14.3 g/dL, hematocrit 43%, platelets 238 x10^3/uL.", ar: "تعداد الدم: الكريات البيضاء 9.1×10^3/ميكرولتر، الهيموغلوبين 14.3 غ/دل، الهيماتوكريت 43%، الصفائح 238×10^3/ميكرولتر." },
  { id: "fact.stemi.chemistry-result", type: "INVESTIGATION_RESULT", code: "diagnostic.lab.chemistry-authored", disclosure: "after_result", en: "Chemistry: sodium 138, potassium 4.2, chloride 102, bicarbonate 21 mmol/L, BUN 22 mg/dL, creatinine 1.1 mg/dL, glucose 184 mg/dL, magnesium 1.9 mg/dL.", ar: "الكيمياء: صوديوم 138، بوتاسيوم 4.2، كلوريد 102، بيكربونات 21 مليمول/لتر، BUN 22 ملغ/دل، كرياتينين 1.1 ملغ/دل، غلوكوز 184 ملغ/دل، مغنيسيوم 1.9 ملغ/دل." },
  { id: "fact.stemi.coagulation-result", type: "INVESTIGATION_RESULT", code: "diagnostic.lab.coagulation-authored", disclosure: "after_result", en: "Coagulation: INR 1.0 and aPTT 30 seconds.", ar: "التخثر: INR 1.0 وaPTT 30 ثانية." },
  { id: "fact.stemi.troponin-result", type: "INVESTIGATION_RESULT", code: "diagnostic.lab.hs-ctni-high", disclosure: "after_result", en: "Synthetic hs-cTnI is 286 ng/L with authored upper reference limit 34 ng/L, flagged HIGH; assay/value/ULN require specialist review.", ar: "قيمة hs-cTnI الاصطناعية 286 نانوغرام/لتر مع حد مرجعي أعلى مؤلف 34 نانوغرام/لتر ومصنفة مرتفعة؛ يحتاج الاختبار والقيمة والحد المرجعي إلى مراجعة اختصاصية." },
  { id: "fact.stemi.poc-glucose-result", type: "INVESTIGATION_RESULT", code: "diagnostic.lab.glucose-184", disclosure: "after_result", en: "Point-of-care glucose is 184 mg/dL.", ar: "سكر الدم الفوري 184 ملغ/دل." },
  { id: "fact.stemi.cxr-result", type: "INVESTIGATION_RESULT", code: "diagnostic.xray.no-acute-pulmonary-process", disclosure: "after_result", en: "Chest radiograph: no pulmonary edema, pneumothorax, focal air-space disease, or mediastinal abnormality; cardiac silhouette is not enlarged.", ar: "صورة الصدر: لا وذمة رئوية ولا استرواح صدر ولا مرض هوائي بؤري ولا شذوذ منصف، وظل القلب غير متضخم." },
  { id: "fact.stemi.echo-result", type: "INVESTIGATION_RESULT", code: "diagnostic.echo.rv-involvement", disclosure: "after_result", en: "Focused echo: LVEF about 45%, inferior-wall hypokinesis, mildly-to-moderately dilated RV with reduced function, TAPSE about 14 mm, dilated IVC with reduced collapse, and no pericardial effusion, severe MR, VSD, or pulmonary edema.", ar: "الإيكو المركّز: الكسر القذفي نحو 45% مع نقص حركة الجدار السفلي، توسع خفيف إلى متوسط للبطين الأيمن مع ضعف وظيفته، TAPSE نحو 14 مم، وريد أجوف سفلي متوسع قليل الانهيار، ودون انصباب تاموري أو قلس تاجي شديد أو عيب حاجزي بطيني أو وذمة رئوية." },
  { id: "fact.stemi.hidden-diagnosis", type: "DIAGNOSIS", code: "diagnosis.acute-inferior-stemi-rv-involvement", disclosure: "never_to_patient", en: "Hidden Case truth: acute inferior-wall STEMI with significant right-ventricular involvement and early hypotension/impaired perfusion, without initial pulmonary edema or malignant arrhythmia.", ar: "حقيقة الحالة المخفية: احتشاء حاد مرتفع ST في الجدار السفلي مع إصابة مهمة للبطين الأيمن وانخفاض ضغط/ضعف تروية مبكر، دون وذمة رئوية أو اضطراب نظم خبيث أولي." },
  { id: "fact.stemi.endpoint", type: "DISPOSITION", code: "disposition.cath-lab-transfer", disclosure: "never_to_patient", en: "Successful endpoint is recognition, emergent PPCI pathway activation, preparation, and Cath Lab transfer; PCI itself is not simulated.", ar: "النقطة النهائية الناجحة هي التعرف وتفعيل مسار القسطرة الأولية العاجلة والتحضير والنقل إلى مختبر القسطرة؛ ولا تتم محاكاة إجراء القسطرة نفسه." }
];

const fixedLocalization = [
  ["case.stemi.title-internal", "Acute Inferior STEMI with Right Ventricular Involvement", "احتشاء سفلي حاد مرتفع ST مع إصابة البطين الأيمن"],
  ["case.stemi.title-learner", "58-year-old man with acute chest pain and hypotension", "رجل يبلغ 58 عامًا يعاني من ألم صدري حاد مع انخفاض ضغط الدم"],
  ["case.stemi.triage", "58-year-old man with acute severe chest pain, diaphoresis, dizziness, and hypotension in an ED resuscitation setting.", "رجل عمره 58 عامًا يعاني ألمًا صدريًا حادًا شديدًا وتعرقًا ودوخة وانخفاض ضغط في منطقة الإنعاش بقسم الطوارئ."],
  ["dialogue.stemi.fallback", "I am not sure, doctor. Please ask me about what I am feeling or my history.", "والله ما بعرف دكتور، اسألني عن اللي حاس فيه أو عن تاريخي المرضي."],
  ["dialogue.stemi.chest-pain", "It is right here in the middle of my chest… pressing on me very hard.", "هون بنص صدري… ضاغط عليّ بشكل قوي."],
  ["dialogue.stemi.radiation", "Yes… to my left arm, and I feel it reaching my jaw a little.", "آه… على إيدي الشمال، وحاسه شوي واصل لفكي."],
  ["dialogue.stemi.concern", "Honestly I do not know, doctor, but I am afraid it is from my heart.", "والله ما بعرف دكتور، بس خايف يكون الموضوع من قلبي."],
  ["domain.stemi.history", "History", "القصة المرضية"],
  ["domain.stemi.examination", "Examination", "الفحص السريري"],
  ["domain.stemi.diagnostics", "Diagnostics", "الاستقصاءات"],
  ["domain.stemi.management", "Management", "التدبير"],
  ["domain.stemi.reasoning", "Clinical reasoning", "الاستدلال السريري"],
  ["domain.stemi.reperfusion", "Reperfusion and disposition", "إعادة التروية والتصرف"],
  ["diagnostic.stemi.ecg-standard-report", "Structured findings are the review-authoritative fallback; no final diagnostic tracing is included.", "النتائج المنظمة هي البديل المعتمد للمراجعة؛ لا توجد صورة تخطيط نهائية مرفقة."],
  ["diagnostic.stemi.ecg-right-report", "Structured right-sided findings are the review-authoritative fallback; no final tracing is included.", "نتائج التخطيط الأيمن المنظمة هي البديل المعتمد للمراجعة؛ لا توجد صورة نهائية مرفقة."],
  ["diagnostic.stemi.cxr-report", "No pulmonary edema, pneumothorax, focal air-space disease, or mediastinal abnormality. Cardiac silhouette is not enlarged.", "لا وذمة رئوية ولا استرواح صدر ولا مرض هوائي بؤري ولا شذوذ منصف. ظل القلب غير متضخم."],
  ["diagnostic.stemi.echo-report", "Focused echo findings require specialist review of the authored quantitative values.", "تتطلب نتائج الإيكو المركّز مراجعة اختصاصية للقيم الكمية المؤلفة."],
  ["instructor.stemi.pending-review", "UNDER_REVIEW content only. Clinical, specialist, curriculum, diagnostic-media, and publication approvals remain pending.", "محتوى قيد المراجعة فقط. ما تزال الموافقات السريرية والاختصاصية والمنهاجية ووسائط التشخيص والنشر معلّقة."],
  ["instructor.stemi.no-instant-cure", "Cath activation and antithrombotic orders do not produce instant reperfusion, vital normalization, or cure.", "لا يؤدي تفعيل القسطرة أو طلب مضادات التخثر والصفيحات إلى إعادة تروية أو تطبيع فوري للعلامات الحيوية أو شفاء فوري."]
] as const;

function aliases(id: string, en: string, ar: string) {
  return [
    { locale: "en-US", phrases: [en], authority: "INTERPRETATION_ONLY" },
    { locale: "ar-JO", phrases: [ar], authority: "INTERPRETATION_ONLY" }
  ];
}

function standardAction(input: {
  id: string;
  type: "EXAMINATION" | "MEDICATION" | "PROCEDURE" | "CONSULT" | "DIAGNOSIS" | "DISPOSITION";
  en: string;
  ar: string;
  sources?: string[];
  repeat?: "NOT_REPEATABLE" | "REPEATABLE" | "CASE_DEFINED";
  confirmation?: "NONE" | "EXPLICIT_REQUEST" | "EXPLICIT_ADMINISTRATION" | "CASE_DEFINED";
}) {
  return {
    action_id: input.id,
    action_type: input.type,
    parameter_definitions: [],
    aliases: aliases(input.id, input.en, input.ar),
    prerequisite_action_ids: [],
    confirmation_policy: input.confirmation ?? "NONE",
    repeat_policy: input.repeat ?? "NOT_REPEATABLE",
    source_ids: input.sources ?? [SOURCE_PRIMARY]
  };
}

function diagnosticMilestone(prefix: string, type: "ORDERED" | "RESULT_AVAILABLE" | "IMAGE_AVAILABLE" | "FORMAL_REPORT_AVAILABLE", seconds: number) {
  return {
    diagnostic_milestone_id: `diagnostic-milestone.stemi.${prefix}-${type.toLowerCase().replaceAll("_", "-")}`,
    milestone_type: type,
    offset_clinical_seconds: seconds
  };
}

function labAction(input: {
  id: string;
  prefix: string;
  en: string;
  ar: string;
  resultId: string;
  panelCode: string;
  available: number;
  factId: string;
  analytes: unknown[];
  sources?: string[];
}) {
  return {
    action_id: input.id,
    action_type: "INVESTIGATION",
    parameter_definitions: [],
    aliases: aliases(input.id, input.en, input.ar),
    prerequisite_action_ids: [],
    confirmation_policy: "NONE",
    repeat_policy: "NOT_REPEATABLE",
    source_ids: input.sources ?? [SOURCE_PRIMARY],
    investigation: {
      investigation_schema_version: "1.0",
      execution_mode: "ASYNC_PARALLEL",
      result: {
        result_schema_version: "1.0",
        diagnostic_result_id: input.resultId,
        result_type: "STRUCTURED_LAB",
        modality: "LABORATORY",
        panel_code: input.panelCode,
        analytes: input.analytes,
        finding_fact_ids: [input.factId],
        source_ids: input.sources ?? [SOURCE_PRIMARY]
      },
      milestones: [
        diagnosticMilestone(input.prefix, "ORDERED", 0),
        diagnosticMilestone(input.prefix, "RESULT_AVAILABLE", input.available)
      ],
      learner_visibility: {
        structured_result: "AT_COMPONENT_AVAILABILITY",
        media: "NEVER",
        machine_interpretation: "NEVER",
        formal_report: "NEVER"
      }
    }
  };
}

function analyte(id: string, code: string, label: string, value: number, unit: string, extra: Record<string, unknown> = {}) {
  return {
    analyte_id: `analyte.stemi.${id}`,
    analyte_code: code,
    display_label_key: label,
    value,
    unit_code: unit,
    ...extra
  };
}

const diagnosticLabelEntries = [
  ["diagnostic.stemi.wbc", "White blood cell count", "عدد الكريات البيضاء"],
  ["diagnostic.stemi.hemoglobin", "Hemoglobin", "الهيموغلوبين"],
  ["diagnostic.stemi.hematocrit", "Hematocrit", "الهيماتوكريت"],
  ["diagnostic.stemi.platelets", "Platelets", "الصفائح"],
  ["diagnostic.stemi.sodium", "Sodium", "الصوديوم"],
  ["diagnostic.stemi.potassium", "Potassium", "البوتاسيوم"],
  ["diagnostic.stemi.chloride", "Chloride", "الكلوريد"],
  ["diagnostic.stemi.bicarbonate", "Bicarbonate", "البيكربونات"],
  ["diagnostic.stemi.bun", "Blood urea nitrogen", "نيتروجين يوريا الدم"],
  ["diagnostic.stemi.creatinine", "Creatinine", "الكرياتينين"],
  ["diagnostic.stemi.glucose", "Glucose", "الغلوكوز"],
  ["diagnostic.stemi.magnesium", "Magnesium", "المغنيسيوم"],
  ["diagnostic.stemi.inr", "INR", "النسبة المعيارية الدولية"],
  ["diagnostic.stemi.aptt", "aPTT", "زمن الثرومبوبلاستين الجزئي المنشط"],
  ["diagnostic.stemi.hs-ctni", "High-sensitivity cardiac troponin I", "التروبونين القلبي I عالي الحساسية"],
  ["diagnostic.stemi.pr", "PR interval", "فترة PR"],
  ["diagnostic.stemi.qrs", "QRS duration", "مدة QRS"],
  ["diagnostic.stemi.qtc", "QTc", "QTc"],
  ["diagnostic.stemi.st-ii", "ST elevation II", "ارتفاع ST في II"],
  ["diagnostic.stemi.st-iii", "ST elevation III", "ارتفاع ST في III"],
  ["diagnostic.stemi.st-avf", "ST elevation aVF", "ارتفاع ST في aVF"],
  ["diagnostic.stemi.st-v3r", "ST elevation V3R", "ارتفاع ST في V3R"],
  ["diagnostic.stemi.st-v4r", "ST elevation V4R", "ارتفاع ST في V4R"],
  ["diagnostic.stemi.lvef", "Left ventricular ejection fraction", "الكسر القذفي للبطين الأيسر"],
  ["diagnostic.stemi.tapse", "TAPSE", "TAPSE"]
] as const;

const ACTIONS = [
  standardAction({ id: "examination.focused-history", type: "EXAMINATION", en: "take focused acute history", ar: "أخذ قصة مرضية حادة مركزة", sources: [SOURCE_CHEST_PAIN] }),
  standardAction({ id: "examination.contraindication-review", type: "EXAMINATION", en: "check medicines allergies bleeding and PDE5 history", ar: "التحقق من الأدوية والحساسية والنزف ومثبطات PDE5", sources: [SOURCE_PRIMARY] }),
  standardAction({ id: "examination.risk-history", type: "EXAMINATION", en: "review relevant medical and risk history", ar: "مراجعة التاريخ المرضي وعوامل الخطورة", sources: [SOURCE_CHEST_PAIN] }),
  standardAction({ id: "examination.hemodynamic-perfusion", type: "EXAMINATION", en: "assess hemodynamics and perfusion", ar: "تقييم الديناميكا الدموية والتروية" }),
  standardAction({ id: "examination.lungs-jvp", type: "EXAMINATION", en: "examine lungs and JVP", ar: "فحص الرئتين والضغط الوداجي" }),
  standardAction({ id: "examination.cardiac-neurologic", type: "EXAMINATION", en: "perform focused cardiac and neurologic examination", ar: "إجراء فحص قلبي وعصبي مركز" }),
  standardAction({ id: "examination.hemodynamic-reassessment", type: "EXAMINATION", en: "reassess hemodynamics after deterioration or support", ar: "إعادة تقييم الديناميكا الدموية بعد التدهور أو الدعم", repeat: "REPEATABLE" }),
  standardAction({ id: "procedure.cardiac-monitor", type: "PROCEDURE", en: "apply cardiac monitor", ar: "وصل جهاز مراقبة القلب" }),
  standardAction({ id: "procedure.peripheral-iv", type: "PROCEDURE", en: "establish peripheral IV access", ar: "تركيب خط وريدي طرفي" }),
  {
    action_id: "investigation.ecg-standard",
    action_type: "INVESTIGATION",
    parameter_definitions: [], aliases: aliases("investigation.ecg-standard", "order standard 12-lead ECG", "طلب تخطيط قلب قياسي 12 اشتقاقًا"), prerequisite_action_ids: [], confirmation_policy: "NONE", repeat_policy: "NOT_REPEATABLE", source_ids: [SOURCE_PRIMARY, SOURCE_ESC],
    investigation: {
      investigation_schema_version: "1.0", execution_mode: "ASYNC_PARALLEL",
      result: {
        result_schema_version: "1.0", diagnostic_result_id: "diagnostic-result.stemi.ecg-standard", result_type: "ECG", modality: "ECG", source_ids: [SOURCE_PRIMARY, SOURCE_ESC],
        finding_fact_ids: ["fact.stemi.ecg-inferior-findings"], fallback_fact_ids: ["fact.stemi.ecg-inferior-findings"],
        asset_references: [{ media_asset_id: "asset.stemi.ecg-standard-pending", asset_role: "TRACING" }],
        formal_report_key: "diagnostic.stemi.ecg-standard-report",
        structured_measurements: [
          { measurement_id: "measurement.stemi.ecg-standard-pr", measurement_code: "ecg.pr-ms", display_label_key: "diagnostic.stemi.pr", value: 160, unit_code: "unit.millisecond" },
          { measurement_id: "measurement.stemi.ecg-standard-qrs", measurement_code: "ecg.qrs-ms", display_label_key: "diagnostic.stemi.qrs", value: 90, unit_code: "unit.millisecond" },
          { measurement_id: "measurement.stemi.ecg-standard-qtc", measurement_code: "ecg.qtc-ms", display_label_key: "diagnostic.stemi.qtc", value: 435, unit_code: "unit.millisecond" },
          { measurement_id: "measurement.stemi.ecg-standard-st-ii", measurement_code: "ecg.st-elevation-ii-mm", display_label_key: "diagnostic.stemi.st-ii", value: 2, unit_code: "unit.millimeter" },
          { measurement_id: "measurement.stemi.ecg-standard-st-iii", measurement_code: "ecg.st-elevation-iii-mm", display_label_key: "diagnostic.stemi.st-iii", value: 3, unit_code: "unit.millimeter" },
          { measurement_id: "measurement.stemi.ecg-standard-st-avf", measurement_code: "ecg.st-elevation-avf-mm", display_label_key: "diagnostic.stemi.st-avf", value: 2, unit_code: "unit.millimeter" }
        ]
      },
      milestones: [diagnosticMilestone("ecg-standard", "ORDERED", 0), diagnosticMilestone("ecg-standard", "RESULT_AVAILABLE", 120), diagnosticMilestone("ecg-standard", "IMAGE_AVAILABLE", 120), diagnosticMilestone("ecg-standard", "FORMAL_REPORT_AVAILABLE", 120)],
      learner_visibility: { structured_result: "AT_COMPONENT_AVAILABILITY", media: "AT_COMPONENT_AVAILABILITY", machine_interpretation: "NEVER", formal_report: "AT_COMPONENT_AVAILABILITY" }
    }
  },
  {
    action_id: "investigation.ecg-right-sided",
    action_type: "INVESTIGATION",
    parameter_definitions: [], aliases: aliases("investigation.ecg-right-sided", "order right-sided ECG", "طلب تخطيط قلب باشتقاقات يمينية"), prerequisite_action_ids: [], confirmation_policy: "NONE", repeat_policy: "NOT_REPEATABLE", source_ids: [SOURCE_PRIMARY, SOURCE_ESC],
    investigation: {
      investigation_schema_version: "1.0", execution_mode: "ASYNC_PARALLEL",
      result: {
        result_schema_version: "1.0", diagnostic_result_id: "diagnostic-result.stemi.ecg-right-sided", result_type: "ECG", modality: "ECG", source_ids: [SOURCE_PRIMARY, SOURCE_ESC],
        finding_fact_ids: ["fact.stemi.ecg-right-findings"], fallback_fact_ids: ["fact.stemi.ecg-right-findings"], asset_references: [{ media_asset_id: "asset.stemi.ecg-right-pending", asset_role: "TRACING" }], formal_report_key: "diagnostic.stemi.ecg-right-report",
        structured_measurements: [
          { measurement_id: "measurement.stemi.ecg-right-v3r", measurement_code: "ecg.st-elevation-v3r-mm", display_label_key: "diagnostic.stemi.st-v3r", value: 1, unit_code: "unit.millimeter" },
          { measurement_id: "measurement.stemi.ecg-right-v4r", measurement_code: "ecg.st-elevation-v4r-mm", display_label_key: "diagnostic.stemi.st-v4r", value: 1.5, unit_code: "unit.millimeter" }
        ]
      },
      milestones: [diagnosticMilestone("ecg-right", "ORDERED", 0), diagnosticMilestone("ecg-right", "RESULT_AVAILABLE", 120), diagnosticMilestone("ecg-right", "IMAGE_AVAILABLE", 120), diagnosticMilestone("ecg-right", "FORMAL_REPORT_AVAILABLE", 120)],
      learner_visibility: { structured_result: "AT_COMPONENT_AVAILABILITY", media: "AT_COMPONENT_AVAILABILITY", machine_interpretation: "NEVER", formal_report: "AT_COMPONENT_AVAILABILITY" }
    }
  },
  labAction({ id: "investigation.poc-glucose", prefix: "poc-glucose", en: "order point-of-care glucose", ar: "طلب سكر دم فوري", resultId: "diagnostic-result.stemi.poc-glucose", panelCode: "panel.poc-glucose", available: 60, factId: "fact.stemi.poc-glucose-result", analytes: [analyte("poc-glucose", "lab.glucose", "diagnostic.stemi.glucose", 184, "unit.mg-dl")] }),
  labAction({ id: "investigation.cbc", prefix: "cbc", en: "order complete blood count", ar: "طلب تعداد دم كامل", resultId: "diagnostic-result.stemi.cbc", panelCode: "panel.cbc", available: 480, factId: "fact.stemi.cbc-result", analytes: [analyte("wbc", "lab.wbc", "diagnostic.stemi.wbc", 9.1, "unit.x10e3-per-ul"), analyte("hemoglobin", "lab.hemoglobin", "diagnostic.stemi.hemoglobin", 14.3, "unit.g-dl"), analyte("hematocrit", "lab.hematocrit", "diagnostic.stemi.hematocrit", 43, "unit.percent"), analyte("platelets", "lab.platelets", "diagnostic.stemi.platelets", 238, "unit.x10e3-per-ul")] }),
  labAction({ id: "investigation.chemistry", prefix: "chemistry", en: "order chemistry panel", ar: "طلب تحاليل الكيمياء", resultId: "diagnostic-result.stemi.chemistry", panelCode: "panel.basic-chemistry-magnesium", available: 480, factId: "fact.stemi.chemistry-result", analytes: [analyte("sodium", "lab.sodium", "diagnostic.stemi.sodium", 138, "unit.mmol-l"), analyte("potassium", "lab.potassium", "diagnostic.stemi.potassium", 4.2, "unit.mmol-l"), analyte("chloride", "lab.chloride", "diagnostic.stemi.chloride", 102, "unit.mmol-l"), analyte("bicarbonate", "lab.bicarbonate", "diagnostic.stemi.bicarbonate", 21, "unit.mmol-l"), analyte("bun", "lab.bun", "diagnostic.stemi.bun", 22, "unit.mg-dl"), analyte("creatinine", "lab.creatinine", "diagnostic.stemi.creatinine", 1.1, "unit.mg-dl"), analyte("glucose", "lab.glucose", "diagnostic.stemi.glucose", 184, "unit.mg-dl"), analyte("magnesium", "lab.magnesium", "diagnostic.stemi.magnesium", 1.9, "unit.mg-dl")] }),
  labAction({ id: "investigation.coagulation", prefix: "coagulation", en: "order coagulation panel", ar: "طلب تحاليل التخثر", resultId: "diagnostic-result.stemi.coagulation", panelCode: "panel.coagulation", available: 480, factId: "fact.stemi.coagulation-result", analytes: [analyte("inr", "lab.inr", "diagnostic.stemi.inr", 1, "unit.ratio"), analyte("aptt", "lab.aptt", "diagnostic.stemi.aptt", 30, "unit.second")] }),
  labAction({ id: "investigation.hs-ctni", prefix: "hs-ctni", en: "order high-sensitivity troponin I", ar: "طلب التروبونين I عالي الحساسية", resultId: "diagnostic-result.stemi.hs-ctni", panelCode: "panel.hs-ctni", available: 600, factId: "fact.stemi.troponin-result", analytes: [analyte("hs-ctni", "lab.hs-ctni", "diagnostic.stemi.hs-ctni", 286, "unit.ng-l", { reference_interval: { upper_bound: 34, lower_inclusive: true, upper_inclusive: true }, abnormal_flag: "HIGH" })] }),
  {
    action_id: "investigation.chest-xray", action_type: "INVESTIGATION", parameter_definitions: [], aliases: aliases("investigation.chest-xray", "order chest radiograph", "طلب صورة أشعة للصدر"), prerequisite_action_ids: [], confirmation_policy: "NONE", repeat_policy: "NOT_REPEATABLE", source_ids: [SOURCE_CHEST_PAIN],
    investigation: {
      investigation_schema_version: "1.0", execution_mode: "ASYNC_PARALLEL",
      result: { result_schema_version: "1.0", diagnostic_result_id: "diagnostic-result.stemi.chest-xray", result_type: "IMAGING", modality: "XRAY", source_ids: [SOURCE_CHEST_PAIN], finding_fact_ids: ["fact.stemi.cxr-result"], fallback_fact_ids: ["fact.stemi.cxr-result"], asset_references: [{ media_asset_id: "asset.stemi.cxr-pending", asset_role: "PRIMARY_IMAGE" }], formal_report_key: "diagnostic.stemi.cxr-report" },
      milestones: [diagnosticMilestone("cxr", "ORDERED", 0), diagnosticMilestone("cxr", "RESULT_AVAILABLE", 300), diagnosticMilestone("cxr", "IMAGE_AVAILABLE", 300), diagnosticMilestone("cxr", "FORMAL_REPORT_AVAILABLE", 480)],
      learner_visibility: { structured_result: "AT_COMPONENT_AVAILABILITY", media: "AT_COMPONENT_AVAILABILITY", machine_interpretation: "NEVER", formal_report: "AT_COMPONENT_AVAILABILITY" }
    }
  },
  {
    action_id: "investigation.focused-echo", action_type: "INVESTIGATION", parameter_definitions: [], aliases: aliases("investigation.focused-echo", "order focused echocardiography", "طلب إيكو قلب مركّز"), prerequisite_action_ids: [], confirmation_policy: "NONE", repeat_policy: "NOT_REPEATABLE", source_ids: [SOURCE_PRIMARY, SOURCE_SHOCK],
    investigation: {
      investigation_schema_version: "1.0", execution_mode: "ASYNC_PARALLEL",
      result: { result_schema_version: "1.0", diagnostic_result_id: "diagnostic-result.stemi.focused-echo", result_type: "ULTRASOUND", modality: "ECHOCARDIOGRAPHY", source_ids: [SOURCE_PRIMARY, SOURCE_SHOCK], finding_fact_ids: ["fact.stemi.echo-result"], fallback_fact_ids: ["fact.stemi.echo-result"], asset_references: [{ media_asset_id: "asset.stemi.echo-pending", asset_role: "STILL" }], formal_report_key: "diagnostic.stemi.echo-report", structured_measurements: [{ measurement_id: "measurement.stemi.echo-lvef", measurement_code: "echo.lvef-percent", display_label_key: "diagnostic.stemi.lvef", value: 45, unit_code: "unit.percent" }, { measurement_id: "measurement.stemi.echo-tapse", measurement_code: "echo.tapse-mm", display_label_key: "diagnostic.stemi.tapse", value: 14, unit_code: "unit.millimeter" }] },
      milestones: [diagnosticMilestone("echo", "ORDERED", 0), diagnosticMilestone("echo", "RESULT_AVAILABLE", 240), diagnosticMilestone("echo", "IMAGE_AVAILABLE", 240), diagnosticMilestone("echo", "FORMAL_REPORT_AVAILABLE", 360)],
      learner_visibility: { structured_result: "AT_COMPONENT_AVAILABILITY", media: "AT_COMPONENT_AVAILABILITY", machine_interpretation: "NEVER", formal_report: "AT_COMPONENT_AVAILABILITY" }
    }
  },
  standardAction({ id: "medication.aspirin-324-chewed", type: "MEDICATION", en: "administer aspirin 324 mg chewed", ar: "إعطاء أسبرين 324 ملغ ممضوغًا" }),
  standardAction({ id: "medication.ticagrelor-180", type: "MEDICATION", en: "administer ticagrelor 180 mg loading dose", ar: "إعطاء جرعة تحميل تيكاغريلور 180 ملغ" }),
  standardAction({ id: "medication.clopidogrel-600", type: "MEDICATION", en: "administer clopidogrel 600 mg loading alternative", ar: "إعطاء كلوبيدوغريل 600 ملغ كبديل تحميل" }),
  standardAction({ id: "medication.ufh-70-units-kg", type: "MEDICATION", en: "administer unfractionated heparin 70 units per kg IV bolus", ar: "إعطاء هيبارين غير مجزأ 70 وحدة/كغ دفعة وريدية" }),
  standardAction({ id: "medication.atorvastatin-80", type: "MEDICATION", en: "administer atorvastatin 80 mg", ar: "إعطاء أتورفاستاتين 80 ملغ" }),
  standardAction({ id: "medication.nitroglycerin", type: "MEDICATION", en: "administer nitroglycerin", ar: "إعطاء نيتروغليسرين" }),
  standardAction({ id: "medication.iv-beta-blocker", type: "MEDICATION", en: "administer intravenous beta blocker", ar: "إعطاء حاصر بيتا وريدي" }),
  standardAction({ id: "medication.norepinephrine-rescue", type: "MEDICATION", en: "initiate draft norepinephrine rescue concept", ar: "بدء مفهوم الإنقاذ بالنورإبينفرين قيد المراجعة", sources: [SOURCE_SHOCK] }),
  standardAction({ id: "procedure.normal-saline-250", type: "PROCEDURE", en: "give cautious 250 mL normal saline challenge over 10 clinical minutes", ar: "إعطاء تحدٍ حذر بمحلول ملحي 250 مل خلال 10 دقائق سريرية", sources: [SOURCE_PRIMARY, SOURCE_SHOCK] }),
  standardAction({ id: "procedure.supplemental-oxygen", type: "PROCEDURE", en: "administer supplemental oxygen", ar: "إعطاء أكسجين إضافي" }),
  standardAction({ id: "consult.activate-cath-lab", type: "CONSULT", en: "activate primary PCI and Cath Lab pathway", ar: "تفعيل مسار القسطرة الأولية ومختبر القسطرة" }),
  standardAction({ id: "diagnosis.inferior-stemi", type: "DIAGNOSIS", en: "identify acute inferior STEMI", ar: "تشخيص احتشاء سفلي حاد مرتفع ST" }),
  standardAction({ id: "diagnosis.rv-involvement", type: "DIAGNOSIS", en: "identify right ventricular involvement", ar: "تشخيص إصابة البطين الأيمن" }),
  standardAction({ id: "diagnosis.oxygen-not-indicated-baseline", type: "DIAGNOSIS", en: "state that routine oxygen is not indicated at baseline SpO2 92 percent", ar: "بيان أن الأكسجين الروتيني غير مستطب عند إشباع 92 بالمئة في الحالة الأساسية" }),
  standardAction({ id: "disposition.transfer-cath-lab", type: "DISPOSITION", en: "initiate transfer to Cath Lab", ar: "بدء النقل إلى مختبر القسطرة" }),
  standardAction({ id: "disposition.ward-admission", type: "DISPOSITION", en: "admit to ward instead of emergent reperfusion", ar: "إدخال المريض إلى الجناح بدل إعادة التروية العاجلة" }),
  standardAction({ id: "disposition.discharge-home", type: "DISPOSITION", en: "discharge home", ar: "تخريج المريض إلى المنزل" })
];

function scheduledDiagnosticRule(actionId: string, suffix: string, scheduled: readonly { delay: number; eventTypes: readonly string[] }[]) {
  return {
    rule_schema_version: "1.0", rule_id: `rule.stemi.diagnostic-${suffix}`, rule_version: "1.0.0",
    trigger: { trigger_type: "COMMITTED_EVENT", event_type: "INVESTIGATION_ORDERED", action_id: actionId }, preconditions: [], exclusions: [], priority: 50, conflict_policy: "BLOCK",
    effects: scheduled.map((entry, index) => ({
      effect_type: "SCHEDULE_RELATIVE", effect_id: `effect.stemi.diagnostic-${suffix}-${index + 1}`, scheduled_item_id: `scheduled-item.stemi.diagnostic-${suffix}-${index + 1}`, category: `diagnostic.${suffix}`, priority: 50, conflict_policy: "BLOCK", delay_clinical_seconds: entry.delay, effects: [], emitted_events: entry.eventTypes.map((eventType) => ({ event_type: eventType, action_id: actionId, parameters: {}, payload: { diagnostic_action_id: actionId, availability: eventType.toLowerCase() }, clinical_effect_ids: [] }))
    })),
    emitted_events: [], referenced_action_ids: [actionId], referenced_rule_ids: [], referenced_fact_ids: [], source_ids: [SOURCE_PRIMARY], timing_window_ids: [], scoring_evidence_refs: []
  };
}

const RULES = [
  scheduledDiagnosticRule("investigation.ecg-standard", "ecg-standard", [{ delay: 120, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE", "INVESTIGATION_IMAGE_AVAILABLE", "INVESTIGATION_FORMAL_REPORT_AVAILABLE"] }]),
  scheduledDiagnosticRule("investigation.ecg-right-sided", "ecg-right", [{ delay: 120, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE", "INVESTIGATION_IMAGE_AVAILABLE", "INVESTIGATION_FORMAL_REPORT_AVAILABLE"] }]),
  scheduledDiagnosticRule("investigation.poc-glucose", "poc-glucose", [{ delay: 60, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE"] }]),
  scheduledDiagnosticRule("investigation.cbc", "cbc", [{ delay: 480, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE"] }]),
  scheduledDiagnosticRule("investigation.chemistry", "chemistry", [{ delay: 480, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE"] }]),
  scheduledDiagnosticRule("investigation.coagulation", "coagulation", [{ delay: 480, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE"] }]),
  scheduledDiagnosticRule("investigation.hs-ctni", "hs-ctni", [{ delay: 600, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE"] }]),
  scheduledDiagnosticRule("investigation.chest-xray", "cxr", [{ delay: 300, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE", "INVESTIGATION_IMAGE_AVAILABLE"] }, { delay: 480, eventTypes: ["INVESTIGATION_FORMAL_REPORT_AVAILABLE"] }]),
  scheduledDiagnosticRule("investigation.focused-echo", "echo", [{ delay: 240, eventTypes: ["INVESTIGATION_RESULT_AVAILABLE", "INVESTIGATION_IMAGE_AVAILABLE"] }, { delay: 360, eventTypes: ["INVESTIGATION_FORMAL_REPORT_AVAILABLE"] }]),
  {
    rule_schema_version: "1.0", rule_id: "rule.stemi.nitrate-harm", rule_version: "1.0.0", trigger: { trigger_type: "COMMITTED_EVENT", event_type: "MEDICATION_ORDERED", action_id: "medication.nitroglycerin" },
    preconditions: [{ condition_type: "STATE_EQUALS", target: "hemodynamic_state", value: "hemodynamics.stemi-baseline-hypotension" }], exclusions: [{ condition_type: "COMPLICATION_PRESENT", complication_id: "complication.stemi.nitrate-hypotension" }], priority: 100, conflict_policy: "BLOCK",
    effects: [{ effect_type: "SCHEDULE_RELATIVE", effect_id: "effect.stemi.schedule-nitrate-harm", scheduled_item_id: "scheduled-item.stemi.nitrate-harm", category: "harm.nitrate-hypotension", priority: 100, conflict_policy: "BLOCK", delay_clinical_seconds: 60, effects: [
      { effect_type: "SET_STATE", effect_id: "effect.stemi.nitrate-hemodynamics", target: "hemodynamic_state", value: "hemodynamics.stemi-nitrate-harm" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.nitrate-perfusion", target: "perfusion", value: "perfusion.markedly-impaired" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.nitrate-consciousness", target: "consciousness", value: "consciousness.gcs-14" },
      { effect_type: "SET_PAIN_STATE", effect_id: "effect.stemi.nitrate-pain", value: { severity_0_10: 9, location_codes: ["location.retrosternal", "location.left-arm", "location.jaw"], quality_codes: ["quality.pressure", "quality.crushing"], trend: "trend.persistent" } },
      { effect_type: "ADD_COMPLICATION", effect_id: "effect.stemi.nitrate-complication", complication_id: "complication.stemi.nitrate-hypotension", complication_type: "complication.nitrate-associated-hypotension", attributes: { dizziness: "marked", recoverable: true } }
    ], emitted_events: [{ event_type: "CRITICAL_EVENT_OCCURRED", action_id: "medication.nitroglycerin", parameters: {}, payload: { complication_code: "nitrate-associated-hypotension", automatic_arrest: false }, clinical_effect_ids: ["clinical-effect.stemi.nitrate-harm"] }] }],
    emitted_events: [], referenced_action_ids: ["medication.nitroglycerin"], referenced_rule_ids: [], referenced_fact_ids: ["fact.stemi.hidden-diagnosis"], source_ids: [SOURCE_PRIMARY], timing_window_ids: [], scoring_evidence_refs: []
  },
  {
    rule_schema_version: "1.0", rule_id: "rule.stemi.fluid-support", rule_version: "1.0.0", trigger: { trigger_type: "COMMITTED_EVENT", event_type: "PROCEDURE_ORDERED", action_id: "procedure.normal-saline-250" },
    preconditions: [{ condition_type: "STATE_EQUALS", target: "hemodynamic_state", value: "hemodynamics.stemi-baseline-hypotension" }, { condition_type: "COMPLICATION_ABSENT", complication_id: "complication.stemi.nitrate-hypotension" }], exclusions: [{ condition_type: "OUTCOME_FLAG_PRESENT", outcome_flag: "outcome.fluid-challenge-completed" }], priority: 60, conflict_policy: "BLOCK",
    effects: [{ effect_type: "SCHEDULE_RELATIVE", effect_id: "effect.stemi.schedule-fluid-completion", scheduled_item_id: "scheduled-item.stemi.fluid-completion", category: "support.fluid-challenge", priority: 60, conflict_policy: "BLOCK", delay_clinical_seconds: 600, effects: [
      { effect_type: "SET_STATE", effect_id: "effect.stemi.fluid-hemodynamics", target: "hemodynamic_state", value: "hemodynamics.stemi-modestly-supported" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.fluid-perfusion", target: "perfusion", value: "perfusion.modestly-improved" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.fluid-respiratory", target: "respiratory_state", value: "respiratory.stemi-supported-clear-lungs" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.fluid-oxygenation", target: "oxygenation", value: "oxygenation.stemi-supported-room-air" },
      { effect_type: "SET_PAIN_STATE", effect_id: "effect.stemi.fluid-pain", value: { severity_0_10: 7, location_codes: ["location.retrosternal", "location.left-arm", "location.jaw"], quality_codes: ["quality.pressure", "quality.crushing"], trend: "trend.persistent" } },
      { effect_type: "ADD_OUTCOME_FLAG", effect_id: "effect.stemi.fluid-completed", outcome_flag: "outcome.fluid-challenge-completed" }
    ], emitted_events: [{ event_type: "PATIENT_STATE_CHANGED", action_id: "procedure.normal-saline-250", parameters: {}, payload: { transition_code: "modestly-supported-pre-pci", lungs: "clear" }, clinical_effect_ids: ["clinical-effect.stemi.fluid-support"] }] }],
    emitted_events: [], referenced_action_ids: ["procedure.normal-saline-250"], referenced_rule_ids: [], referenced_fact_ids: ["fact.stemi.respiratory-exam"], source_ids: [SOURCE_PRIMARY, SOURCE_SHOCK], timing_window_ids: [], scoring_evidence_refs: []
  },
  {
    rule_schema_version: "1.0", rule_id: "rule.stemi.delay-at-ten", rule_version: "1.0.0", trigger: { trigger_type: "CLINICAL_TIME_THRESHOLD", threshold_clinical_time: 600 }, preconditions: [], exclusions: [{ condition_type: "PRIOR_EVENT_OCCURRED", event_type: "CONSULT_REQUESTED", action_id: "consult.activate-cath-lab" }, { condition_type: "OUTCOME_FLAG_PRESENT", outcome_flag: "outcome.delay-ten-applied" }], priority: 80, conflict_policy: "REPLACE",
    effects: [
      { effect_type: "SET_STATE", effect_id: "effect.stemi.delay-phase", target: "clinical_phase", value: "phase.stemi-deteriorating" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.delay-hemodynamics", target: "hemodynamic_state", value: "hemodynamics.stemi-delay-ten" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.delay-perfusion", target: "perfusion", value: "perfusion.worsened" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.delay-respiratory", target: "respiratory_state", value: "respiratory.stemi-delay" },
      { effect_type: "SET_PAIN_STATE", effect_id: "effect.stemi.delay-pain", value: { severity_0_10: 9, location_codes: ["location.retrosternal", "location.left-arm", "location.jaw"], quality_codes: ["quality.pressure", "quality.crushing"], trend: "trend.worsening" } },
      { effect_type: "ADD_OUTCOME_FLAG", effect_id: "effect.stemi.delay-marker", outcome_flag: "outcome.delay-ten-applied" }
    ], emitted_events: [{ event_type: "PATIENT_STATE_CHANGED", parameters: {}, payload: { transition_code: "delay-deterioration", automatic_death: false }, clinical_effect_ids: ["clinical-effect.stemi.delay-ten"] }], referenced_action_ids: ["consult.activate-cath-lab"], referenced_rule_ids: [], referenced_fact_ids: ["fact.stemi.hidden-diagnosis"], source_ids: [SOURCE_PRIMARY, SOURCE_ESC], timing_window_ids: ["window.stemi.cath-major-delay"], scoring_evidence_refs: []
  },
  {
    rule_schema_version: "1.0", rule_id: "rule.stemi.shock-at-eighteen", rule_version: "1.0.0", trigger: { trigger_type: "CLINICAL_TIME_THRESHOLD", threshold_clinical_time: 1080 }, preconditions: [], exclusions: [{ condition_type: "PRIOR_EVENT_OCCURRED", event_type: "CONSULT_REQUESTED", action_id: "consult.activate-cath-lab" }, { condition_type: "OUTCOME_FLAG_PRESENT", outcome_flag: "outcome.shock-eighteen-applied" }], priority: 90, conflict_policy: "REPLACE",
    effects: [
      { effect_type: "SET_STATE", effect_id: "effect.stemi.shock-phase", target: "clinical_phase", value: "phase.stemi-shock" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.shock-hemodynamics", target: "hemodynamic_state", value: "hemodynamics.stemi-shock" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.shock-perfusion", target: "perfusion", value: "perfusion.markedly-impaired" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.shock-respiratory", target: "respiratory_state", value: "respiratory.stemi-shock" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.shock-oxygenation", target: "oxygenation", value: "oxygenation.stemi-shock-hypoxemia" },
      { effect_type: "SET_STATE", effect_id: "effect.stemi.shock-consciousness", target: "consciousness", value: "consciousness.gcs-14" },
      { effect_type: "SET_PAIN_STATE", effect_id: "effect.stemi.shock-pain", value: { severity_0_10: 9, location_codes: ["location.retrosternal", "location.left-arm", "location.jaw"], quality_codes: ["quality.pressure", "quality.crushing"], trend: "trend.worsening" } },
      { effect_type: "ADD_OUTCOME_FLAG", effect_id: "effect.stemi.shock-marker", outcome_flag: "outcome.shock-eighteen-applied" }
    ], emitted_events: [{ event_type: "CRITICAL_EVENT_OCCURRED", parameters: {}, payload: { transition_code: "shock-deterioration", oxygen_indicated: true, automatic_arrest: false }, clinical_effect_ids: ["clinical-effect.stemi.shock-eighteen"] }], referenced_action_ids: ["consult.activate-cath-lab"], referenced_rule_ids: ["rule.stemi.delay-at-ten"], referenced_fact_ids: ["fact.stemi.hidden-diagnosis"], source_ids: [SOURCE_PRIMARY, SOURCE_ESC, SOURCE_SHOCK], timing_window_ids: ["window.stemi.cath-major-delay"], scoring_evidence_refs: []
  },
  {
    rule_schema_version: "1.0", rule_id: "rule.stemi.oxygen-in-shock", rule_version: "1.0.0", trigger: { trigger_type: "COMMITTED_EVENT", event_type: "PROCEDURE_ORDERED", action_id: "procedure.supplemental-oxygen" }, preconditions: [{ condition_type: "STATE_EQUALS", target: "oxygenation", value: "oxygenation.stemi-shock-hypoxemia" }], exclusions: [{ condition_type: "INTERVENTION_PRESENT", intervention_id: "intervention.stemi.supplemental-oxygen" }], priority: 40, conflict_policy: "BLOCK",
    effects: [{ effect_type: "ADD_INTERVENTION", effect_id: "effect.stemi.add-oxygen", intervention_id: "intervention.stemi.supplemental-oxygen", intervention_type: "intervention.supplemental-oxygen", parameters: { indication: "shock-spo2-89" } }], emitted_events: [], referenced_action_ids: ["procedure.supplemental-oxygen"], referenced_rule_ids: ["rule.stemi.shock-at-eighteen"], referenced_fact_ids: [], source_ids: [SOURCE_PRIMARY], timing_window_ids: [], scoring_evidence_refs: []
  },
  {
    rule_schema_version: "1.0", rule_id: "rule.stemi.cath-pathway-marker", rule_version: "1.0.0", trigger: { trigger_type: "COMMITTED_EVENT", event_type: "CONSULT_REQUESTED", action_id: "consult.activate-cath-lab" }, preconditions: [], exclusions: [{ condition_type: "OUTCOME_FLAG_PRESENT", outcome_flag: "outcome.cath-pathway-activated" }], priority: 70, conflict_policy: "BLOCK", effects: [{ effect_type: "ADD_OUTCOME_FLAG", effect_id: "effect.stemi.cath-marker", outcome_flag: "outcome.cath-pathway-activated" }], emitted_events: [], referenced_action_ids: ["consult.activate-cath-lab"], referenced_rule_ids: [], referenced_fact_ids: ["fact.stemi.endpoint"], source_ids: [SOURCE_PRIMARY, SOURCE_ESC], timing_window_ids: [], scoring_evidence_refs: []
  },
  {
    rule_schema_version: "1.0", rule_id: "rule.stemi.transfer-marker", rule_version: "1.0.0", trigger: { trigger_type: "COMMITTED_EVENT", event_type: "DISPOSITION_SELECTED", action_id: "disposition.transfer-cath-lab" }, preconditions: [{ condition_type: "PRIOR_EVENT_OCCURRED", event_type: "CONSULT_REQUESTED", action_id: "consult.activate-cath-lab" }], exclusions: [{ condition_type: "OUTCOME_FLAG_PRESENT", outcome_flag: "outcome.transfer-initiated" }], priority: 70, conflict_policy: "BLOCK", effects: [{ effect_type: "ADD_OUTCOME_FLAG", effect_id: "effect.stemi.transfer-marker", outcome_flag: "outcome.transfer-initiated" }], emitted_events: [{ event_type: "OUTCOME_REACHED", action_id: "disposition.transfer-cath-lab", parameters: {}, payload: { endpoint: "transfer-to-cath-lab", pci_performed: false }, clinical_effect_ids: ["clinical-effect.stemi.transfer"] }], referenced_action_ids: ["consult.activate-cath-lab", "disposition.transfer-cath-lab"], referenced_rule_ids: ["rule.stemi.cath-pathway-marker"], referenced_fact_ids: ["fact.stemi.endpoint"], source_ids: [SOURCE_PRIMARY, SOURCE_ESC], timing_window_ids: [], scoring_evidence_refs: []
  }
];

function criterion(id: string, points: number, actionIds: string[], eventTypes: string[], extra: Record<string, unknown> = {}) {
  return { rubric_item_id: `rubric-item.stemi.${id}`, kind: "AWARD", points, evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: actionIds, event_types: eventTypes, ...extra }, repeat_policy: { mode: "ONCE" } };
}

const BASE_CASE_INPUT = {
  manifest: {
    case_id: STEMI_CASE_ID, case_version_id: STEMI_CASE_VERSION_ID, case_package_id: STEMI_CASE_PACKAGE_ID, case_version: STEMI_CASE_VERSION, schema_version: "2.0", status: "UNDER_REVIEW",
    modules: MODULE_NAMES.map((moduleName) => ({ module_name: moduleName, schema_version: "2.0", compatible_package_schema_versions: ["2.0"], required: true, approval_status: "UNDER_REVIEW" }))
  },
  classification: { module_schema_version: "2.0", setting_code: "setting.ed-resuscitation", specialty_codes: ["specialty.emergency-medicine", "specialty.cardiology"], acuity_code: "acuity.high", difficulty_code: "difficulty.intermediate-advanced", target_level_codes: ["level.senior-medical-student", "level.intern-early-pg"], estimated_duration_minutes: 25, tag_codes: ["tag.acute-coronary-syndrome", "tag.inferior-stemi", "tag.right-ventricular-involvement", "tag.review-required"] },
  localization: {
    module_schema_version: "2.0", fallback_locale: "en-US",
    entries: [
      ...fixedLocalization.map(([key, en, ar]) => ({ key, translations: [{ locale: "en-US", text: en }, { locale: "ar-JO", text: ar }] })),
      ...diagnosticLabelEntries.map(([key, en, ar]) => ({ key, translations: [{ locale: "en-US", text: en }, { locale: "ar-JO", text: ar }] })),
      ...FACTS.map((fact) => ({ key: fact.id, translations: [{ locale: "en-US", text: fact.en }, { locale: "ar-JO", text: fact.ar }] }))
    ]
  },
  patient_profile: {
    module_schema_version: "2.0", patient_id: "patient.stemi.khaled-mansour", default_language: "ar-JO", supported_languages: ["ar-JO", "en-US"], persona_code: "persona.khaled-mansour", conversational_style_code: "style.distressed-short-sentences", disclosure_policy_id: "dialogue.stemi.patient-v1",
    extensions: { "stemi.patient-demographics": { synthetic_name_en: "Khaled Mansour", synthetic_name_ar: "خالد منصور", age_years: 58, sex: "male", height_cm: 175, weight_kg: 84, occupation: "taxi-driver" } }
  },
  presentation: { module_schema_version: "2.0", chief_complaint_fact_id: "fact.stemi.chief-complaint", arrival_context_code: "arrival.ed-resuscitation", triage_summary_key: "case.stemi.triage", initial_public_fact_ids: ["fact.stemi.chief-complaint", "fact.stemi.general-appearance"] },
  initial_state: {
    module_schema_version: "2.0",
    patient_state: {
      state_schema_version: "1.0", state_version: 0, case_version: STEMI_CASE_VERSION, clinical_time: 0,
      clinical_phase: "phase.stemi-acute-presentation", hemodynamic_state: "hemodynamics.stemi-baseline-hypotension", cardiac_rhythm: "rhythm.sinus-tachycardia", perfusion: "perfusion.impaired", respiratory_state: "respiratory.stemi-baseline-tachypnea", oxygenation: "oxygenation.stemi-baseline-room-air", consciousness: "consciousness.gcs-15", neurologic_state: "neurologic.no-focal-deficit", temperature_state: "temperature.normothermic", metabolic_state: "metabolic.mild-hyperglycemia",
      pain_state: { severity_0_10: 8, location_codes: ["location.retrosternal", "location.left-arm", "location.jaw"], quality_codes: ["quality.pressure", "quality.crushing"], trend: "trend.persistent" }, active_interventions: [], active_complications: [], outcome_flags: []
    },
    observation_projection: {
      projection_schema_version: "1.0", projection_definition_id: "projection.stemi.inferior-rv-v1",
      hemodynamic_mappings: {
        "hemodynamics.stemi-baseline-hypotension": { heart_rate_bpm: 112, systolic_bp_mm_hg: 88, diastolic_bp_mm_hg: 60 },
        "hemodynamics.stemi-modestly-supported": { heart_rate_bpm: 106, systolic_bp_mm_hg: 94, diastolic_bp_mm_hg: 64 },
        "hemodynamics.stemi-delay-ten": { heart_rate_bpm: 118, systolic_bp_mm_hg: 82, diastolic_bp_mm_hg: 54 },
        "hemodynamics.stemi-shock": { heart_rate_bpm: 124, systolic_bp_mm_hg: 76, diastolic_bp_mm_hg: 48 },
        "hemodynamics.stemi-nitrate-harm": { heart_rate_bpm: 122, systolic_bp_mm_hg: 72, diastolic_bp_mm_hg: 44 }
      },
      respiratory_mappings: { "respiratory.stemi-baseline-tachypnea": { respiratory_rate_per_minute: 24 }, "respiratory.stemi-supported-clear-lungs": { respiratory_rate_per_minute: 23 }, "respiratory.stemi-delay": { respiratory_rate_per_minute: 26 }, "respiratory.stemi-shock": { respiratory_rate_per_minute: 28 } },
      oxygenation_mappings: { "oxygenation.stemi-baseline-room-air": { spo2_percent: 92 }, "oxygenation.stemi-supported-room-air": { spo2_percent: 92 }, "oxygenation.stemi-shock-hypoxemia": { spo2_percent: 89 } },
      temperature_mappings: { "temperature.normothermic": { temperature_celsius: 36.7 } },
      consciousness_mappings: { "consciousness.gcs-15": { display_code: "display.consciousness-alert-gcs-15" }, "consciousness.gcs-14": { display_code: "display.consciousness-responsive-gcs-14" } },
      rhythm_mappings: { "rhythm.sinus-tachycardia": { display_code: "display.rhythm-sinus-tachycardia", waveform_descriptor: "waveform.sinus-tachycardia" } }
    }
  },
  clinical_facts: { module_schema_version: "2.0", facts: FACTS.map((fact) => ({ fact_id: fact.id, fact_type: fact.type, clinical_code: fact.code, content_key: fact.id, disclosure_mode: fact.disclosure, source_ids: [...(fact.sources ?? ALL_SOURCE_IDS)] })) },
  action_catalogue: { module_schema_version: "2.0", actions: ACTIONS },
  rules: { module_schema_version: "2.0", rule_schema_version: "1.0", rules: RULES },
  timeline_policy: {
    module_schema_version: "2.0", scheduler_schema_version: "1.0", time_ratio: 1, pause_policy: "PAUSE_CLINICAL_TIME", deterministic_seed_policy: "FIXED", max_derived_evaluations: 32,
    timing_windows: [
      { timing_window_id: "window.stemi.ecg-by-ten", starts_at_clinical_seconds: 0, ends_at_clinical_seconds: 600, start_inclusive: true, end_inclusive: true, reference_event_type: "INVESTIGATION_ORDERED", reference_action_id: "investigation.ecg-standard" },
      { timing_window_id: "window.stemi.cath-full-credit", starts_at_clinical_seconds: 0, ends_at_clinical_seconds: 480, start_inclusive: true, end_inclusive: true, reference_event_type: "INVESTIGATION_RESULT_AVAILABLE", reference_action_id: "investigation.ecg-standard" },
      { timing_window_id: "window.stemi.cath-partial-credit", starts_at_clinical_seconds: 0, ends_at_clinical_seconds: 780, start_inclusive: true, end_inclusive: true, reference_event_type: "INVESTIGATION_RESULT_AVAILABLE", reference_action_id: "investigation.ecg-standard" },
      { timing_window_id: "window.stemi.cath-major-delay", starts_at_clinical_seconds: 0, ends_at_clinical_seconds: 1080, start_inclusive: true, end_inclusive: true, reference_event_type: "CONSULT_REQUESTED", reference_action_id: "consult.activate-cath-lab" }
    ], initial_scheduled_event_types: [], interrupting_event_types: ["CRITICAL_EVENT_OCCURRED"], initial_scheduled_items: []
  },
  assessment_rubric: {
    module_schema_version: "2.0", assessment_schema_version: "1.0", rubric_id: "rubric.stemi.inferior-rv-v1", rubric_version: "1.0.0",
    domains: [
      { domain_code: "domain.history", title_key: "domain.stemi.history", weight_basis_points: 1000, criteria: [criterion("history-focused-hpi", 4, ["examination.focused-history"], ["EXAM_PERFORMED"]), criterion("history-contraindications", 4, ["examination.contraindication-review"], ["EXAM_PERFORMED"]), criterion("history-risk", 2, ["examination.risk-history"], ["EXAM_PERFORMED"])] },
      { domain_code: "domain.examination", title_key: "domain.stemi.examination", weight_basis_points: 1000, criteria: [criterion("exam-hemodynamics", 4, ["examination.hemodynamic-perfusion"], ["EXAM_PERFORMED"]), criterion("exam-lungs-jvp", 4, ["examination.lungs-jvp"], ["EXAM_PERFORMED"]), criterion("exam-cardiac-neuro", 2, ["examination.cardiac-neurologic"], ["EXAM_PERFORMED"])] },
      { domain_code: "domain.diagnostics", title_key: "domain.stemi.diagnostics", weight_basis_points: 2500, criteria: [criterion("diagnostic-ecg-timely", 10, ["investigation.ecg-standard"], ["INVESTIGATION_ORDERED"], { timing_window_id: "window.stemi.ecg-by-ten" }), criterion("diagnostic-inferior-recognition", 5, ["diagnosis.inferior-stemi"], ["DIAGNOSIS_SUBMITTED"]), criterion("diagnostic-right-ecg", 5, ["investigation.ecg-right-sided"], ["INVESTIGATION_ORDERED"]), criterion("diagnostic-rv-recognition", 3, ["diagnosis.rv-involvement"], ["DIAGNOSIS_SUBMITTED"]), criterion("diagnostic-no-troponin-delay", 2, ["consult.activate-cath-lab"], ["CONSULT_REQUESTED"], { timing_window_id: "window.stemi.cath-full-credit" })] },
      { domain_code: "domain.management", title_key: "domain.stemi.management", weight_basis_points: 2500, criteria: [criterion("management-aspirin", 5, ["medication.aspirin-324-chewed"], ["MEDICATION_ORDERED"]), criterion("management-p2y12", 4, ["medication.ticagrelor-180", "medication.clopidogrel-600"], ["MEDICATION_ORDERED"]), criterion("management-ufh", 4, ["medication.ufh-70-units-kg"], ["MEDICATION_ORDERED"]), criterion("management-safe-hemodynamics", 5, ["examination.hemodynamic-reassessment"], ["EXAM_PERFORMED"]), criterion("management-oxygen-decision", 2, ["diagnosis.oxygen-not-indicated-baseline"], ["DIAGNOSIS_SUBMITTED"]), criterion("management-statin", 2, ["medication.atorvastatin-80"], ["MEDICATION_ORDERED"]), criterion("management-monitor", 1, ["procedure.cardiac-monitor"], ["PROCEDURE_ORDERED"]), criterion("management-iv", 2, ["procedure.peripheral-iv"], ["PROCEDURE_ORDERED"]), { rubric_item_id: "rubric-item.stemi.management-nitrate-safe-hemodynamics-forfeiture", kind: "PENALTY", points: 5, evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: ["medication.nitroglycerin"], event_types: ["MEDICATION_ORDERED"] }, repeat_policy: { mode: "ONCE" } }] },
      { domain_code: "domain.clinical-reasoning", title_key: "domain.stemi.reasoning", weight_basis_points: 1500, criteria: [criterion("reasoning-rv", 5, ["diagnosis.rv-involvement"], ["DIAGNOSIS_SUBMITTED"]), criterion("reasoning-reperfusion", 5, ["consult.activate-cath-lab"], ["CONSULT_REQUESTED"]), criterion("reasoning-response", 5, ["examination.hemodynamic-reassessment"], ["EXAM_PERFORMED"])] },
      { domain_code: "domain.reperfusion-disposition", title_key: "domain.stemi.reperfusion", weight_basis_points: 1500, criteria: [criterion("reperfusion-cath-early", 7, ["consult.activate-cath-lab"], ["CONSULT_REQUESTED"], { timing_window_id: "window.stemi.cath-full-credit" }), criterion("reperfusion-cath-partial", 3, ["consult.activate-cath-lab"], ["CONSULT_REQUESTED"], { timing_window_id: "window.stemi.cath-partial-credit" }), criterion("reperfusion-transfer", 5, ["disposition.transfer-cath-lab"], ["DISPOSITION_SELECTED"])] }
    ],
    critical_items: [
      { rubric_item_id: "rubric-item.stemi.critical-nitrate-unsafe", kind: "CRITICAL_ERROR", evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: ["medication.nitroglycerin"], event_types: ["MEDICATION_ORDERED"] }, effect: { effect_type: "MARK_UNSAFE" } },
      { rubric_item_id: "rubric-item.stemi.critical-nitrate-deduction", kind: "CRITICAL_ERROR", evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: ["medication.nitroglycerin"], event_types: ["MEDICATION_ORDERED"] }, effect: { effect_type: "DEDUCT_OVERALL_SCORE", penalty_basis_points: 1000 } },
      { rubric_item_id: "rubric-item.stemi.critical-beta-unsafe", kind: "CRITICAL_ERROR", evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: ["medication.iv-beta-blocker"], event_types: ["MEDICATION_ORDERED"] }, effect: { effect_type: "MARK_UNSAFE" } },
      { rubric_item_id: "rubric-item.stemi.critical-beta-deduction", kind: "CRITICAL_ERROR", evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: ["medication.iv-beta-blocker"], event_types: ["MEDICATION_ORDERED"] }, effect: { effect_type: "DEDUCT_OVERALL_SCORE", penalty_basis_points: 800 } },
      { rubric_item_id: "rubric-item.stemi.critical-no-cath", kind: "CRITICAL_ACTION", evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: ["consult.activate-cath-lab"], event_types: ["CONSULT_REQUESTED"], timing_window_id: "window.stemi.cath-major-delay" }, effect: { effect_type: "CAP_OVERALL_SCORE", cap_basis_points: 6000 } },
      { rubric_item_id: "rubric-item.stemi.critical-wrong-disposition-unsafe", kind: "CRITICAL_ERROR", evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: ["disposition.ward-admission", "disposition.discharge-home"], event_types: ["DISPOSITION_SELECTED"] }, effect: { effect_type: "MARK_UNSAFE" } },
      { rubric_item_id: "rubric-item.stemi.critical-wrong-disposition-cap", kind: "CRITICAL_ERROR", evidence: { authority: "COMMITTED_LEARNER_EXECUTION", action_ids: ["disposition.ward-admission", "disposition.discharge-home"], event_types: ["DISPOSITION_SELECTED"] }, effect: { effect_type: "CAP_OVERALL_SCORE", cap_basis_points: 4000 } }
    ], source_ids: [SOURCE_PRIMARY, SOURCE_ESC, SOURCE_SHOCK, SOURCE_CHEST_PAIN]
  },
  dialogue_policy: { module_schema_version: "2.0", dialogue_policy_id: "dialogue.stemi.patient-v1", disclosable_fact_ids: FACTS.filter((fact) => fact.disclosure !== "never_to_patient").map((fact) => fact.id), forbidden_fact_ids: FACTS.filter((fact) => fact.disclosure === "never_to_patient").map((fact) => fact.id), question_concept_codes: ["question.chest-pain", "question.radiation", "question.onset", "question.associated-symptoms", "question.past-medical-history", "question.home-medications", "question.allergies", "question.bleeding", "question.pde5", "question.anticoagulants", "question.smoking", "question.family-history"], emotional_tone_code: "tone.anxious-distressed", deterministic_fallback_key: "dialogue.stemi.fallback" },
  visual_manifest: {
    module_schema_version: "2.0", visual_manifest_id: "visual.stemi.review-v1", visual_manifest_version: "1.0.0",
    media_assets: [
      { media_asset_id: "asset.stemi.static-fallback-pending", media_kind: "STATIC_IMAGE", required: true, static_fallback: true },
      { media_asset_id: "asset.stemi.arrival-distressed-pending", media_kind: "STATIC_IMAGE", required: false, static_fallback: true },
      { media_asset_id: "asset.stemi.hypoperfusion-worsening-pending", media_kind: "STATIC_IMAGE", required: false, static_fallback: true },
      { media_asset_id: "asset.stemi.nitrate-harm-pending", media_kind: "STATIC_IMAGE", required: false, static_fallback: true },
      { media_asset_id: "asset.stemi.supported-pre-pci-pending", media_kind: "STATIC_IMAGE", required: false, static_fallback: true },
      { media_asset_id: "asset.stemi.transfer-cathlab-pending", media_kind: "STATIC_IMAGE", required: false, static_fallback: true },
      ...[["asset.stemi.ecg-standard-pending", "ECG"], ["asset.stemi.ecg-right-pending", "ECG"], ["asset.stemi.cxr-pending", "XRAY"], ["asset.stemi.echo-pending", "ECHOCARDIOGRAPHY"]].map(([media_asset_id, diagnostic_modality]) => ({ media_asset_id, media_kind: "STATIC_IMAGE", required: false, static_fallback: true, diagnostic_governance: { diagnostic_modality, provenance_source_ids: diagnostic_modality === "XRAY" ? [SOURCE_CHEST_PAIN] : [SOURCE_PRIMARY], rights_status: "UNRESOLVED", clinical_review_status: "UNRESOLVED" } }))
    ],
    recipes: ["arrival-distressed", "hypoperfusion-worsening", "nitrate-harm", "supported-pre-pci", "transfer-cathlab"].map((state) => ({ recipe_id: `recipe.stemi.${state}`, media_asset_ids: [`asset.stemi.${state}-pending`], fallback_asset_id: "asset.stemi.static-fallback-pending" })),
    required_static_fallback_asset_id: "asset.stemi.static-fallback-pending",
    preload_groups: [{ preload_group_id: "preload.stemi.review-required", media_asset_ids: ["asset.stemi.static-fallback-pending"] }]
  },
  curriculum_mappings: {
    module_schema_version: "2.0",
    objectives: [
      "recognize-acs-stemi", "obtain-interpret-ecg", "evaluate-rv-involvement", "safe-initial-management", "select-antithrombotic-reperfusion", "activate-ppci-without-troponin", "respond-to-deterioration-harm"
    ].flatMap((objective, index) => [
      { objective_id: `objective.ju.stemi-${index + 1}`, institution: { institution_id: "ju", institution_code: "JU", institution_name: "University of Jordan" }, objective_code: `unknown-pending-source-review.${objective}`, source_id: SOURCE_PRIMARY, status: "UNKNOWN" },
      { objective_id: `objective.just.stemi-${index + 1}`, institution: { institution_id: "just", institution_code: "JUST", institution_name: "Jordan University of Science and Technology" }, objective_code: `unknown-pending-source-review.${objective}`, source_id: SOURCE_PRIMARY, status: "UNKNOWN" }
    ]),
    mappings: [
      "recognize-acs-stemi", "obtain-interpret-ecg", "evaluate-rv-involvement", "safe-initial-management", "select-antithrombotic-reperfusion", "activate-ppci-without-troponin", "respond-to-deterioration-harm"
    ].flatMap((objective, index) => [
      { mapping_id: `mapping.ju.stemi-${index + 1}`, competency_code: `case-authored.${objective}`, institution_id: "ju", objective_id: `objective.ju.stemi-${index + 1}`, status: "UNKNOWN" },
      { mapping_id: `mapping.just.stemi-${index + 1}`, competency_code: `case-authored.${objective}`, institution_id: "just", objective_id: `objective.just.stemi-${index + 1}`, status: "UNKNOWN" }
    ]), official_alignment_claimed: false
  },
  validation: {
    module_schema_version: "2.0", required_source_ids: ALL_SOURCE_IDS,
    sources: [
      { source_id: SOURCE_PRIMARY, source_version_id: "source-version.stemi.acc-aha-acs-2025", status: "UNRESOLVED", required: true },
      { source_id: SOURCE_ESC, source_version_id: "source-version.stemi.esc-acs-2023", status: "UNRESOLVED", required: true },
      { source_id: SOURCE_SHOCK, source_version_id: "source-version.stemi.acc-shock-2025", status: "UNRESOLVED", required: true },
      { source_id: SOURCE_CHEST_PAIN, source_version_id: "source-version.stemi.aha-chest-pain-2021", status: "UNRESOLVED", required: true }
    ],
    reviewers: [
      { reviewer_ref_id: "reviewer.stemi.clinical", reviewer_role_code: "role.clinical-specialist-reviewer", status: "UNCONFIRMED" },
      { reviewer_ref_id: "reviewer.stemi.curriculum", reviewer_role_code: "role.curriculum-reviewer", status: "UNCONFIRMED" },
      { reviewer_ref_id: "reviewer.stemi.visual", reviewer_role_code: "role.visual-reviewer", status: "UNCONFIRMED" },
      { reviewer_ref_id: "reviewer.stemi.technical", reviewer_role_code: "role.technical-reviewer", status: "UNCONFIRMED" }
    ], reviews: [],
    deferred_checks: [ValidationEvidenceSchema.parse({ validation_code: RULE_REACHABILITY_VALIDATION_CODE, status: "PASSED", required_for_publication: true, validator_id: "validator.rule-reachability.v1", validator_version: "1.1.0", evidence_hash: "0".repeat(64), validated_case_version_id: STEMI_CASE_VERSION_ID, validated_case_version: STEMI_CASE_VERSION, validated_review_subject_hash: "0".repeat(64), completed_at_utc: STEMI_REACHABILITY_COMPLETED_AT_UTC })],
    review_status: "UNDER_REVIEW", approval_status: "UNDER_REVIEW"
  },
  instructor_notes: { module_schema_version: "2.0", facilitation_note_keys: ["instructor.stemi.pending-review", "instructor.stemi.no-instant-cure"], teaching_point_codes: ["teaching.recognize-inferior-stemi", "teaching.evaluate-rv-involvement", "teaching.safe-hypotension-management", "teaching.prioritize-ppci", "teaching.respond-to-harm"], patient_ai_access: "FORBIDDEN" }
};

/**
 * Exact authored UNDER_REVIEW source. Human approvals remain absent. The only
 * generated field is deterministic Rule Reachability evidence bound to this
 * exact review subject through the supplied portable hash authority.
 */
export async function createStemiUnderReviewCase(
  hashAdapter: HashAdapter
): Promise<DraftCasePackage> {
  const casePackage = DraftCasePackageSchema.parse(
    JSON.parse(JSON.stringify(BASE_CASE_INPUT))
  );
  const generated = await generateRuleReachabilityEvidence(
    casePackage,
    STEMI_REACHABILITY_COMPLETED_AT_UTC,
    hashAdapter
  );
  casePackage.validation.deferred_checks = [generated.evidence];
  return DraftCasePackageSchema.parse(casePackage);
}
