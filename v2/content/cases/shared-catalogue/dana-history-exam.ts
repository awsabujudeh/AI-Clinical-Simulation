import type { HashAdapter } from "../../../packages/contracts/src/index.ts";
import {
  ClinicalFactSchema,
  DraftCasePackageSchema,
  generateRuleReachabilityEvidence,
  prepareReviewExecutionArtifact,
} from "../../../packages/case-schema/src/index.ts";
import { createCompleteExpoCase, prepareCompleteExpoCase } from "./complete-cases.ts";
import type { Patient } from "./medical-dataset.ts";

export const DANA_AUTHOR_SOURCE = "source.wp2.dana-author-history-exam";
export const DANA_AUTHOR_REFERENCE = {
  id: DANA_AUTHOR_SOURCE,
  title: "Owner decision: complete Dana history and examination; simulation-authored candidate, not physician approval",
  url: "planning_input/medical_review/DANA_COMPLETE_CASE_REVIEW.md",
};
export const DANA_AUTHORING_STATUS = {
  origin: "SIMULATION_AUTHORED",
  review_status: "PENDING_PHYSICIAN_REVIEW",
} as const;

// Additive owner-supplied facts only. The previous 1.3.0 package remains immutable.
// History is patient-known; examination findings are examiner-only baseline data.
// No new clinical effects, visual animation, examination execution or disclosure UI.
export const DANA_ADDITIONAL_HISTORY = [
  ["pmh", "No known chronic cardiovascular, renal, hepatic, neurological or endocrine disease.", "لا يوجد مرض مزمن معروف في القلب أو الكلى أو الكبد أو الجهاز العصبي أو الغدد الصماء."],
  ["respiratory-pmh", "No known chronic respiratory disease or asthma.", "لا يوجد مرض تنفسي مزمن معروف ولا ربو معروف."],
  ["prior-reaction", "Previous nut exposure caused itching and a limited rash only. No previous severe allergic reaction, shock, hospital admission or intubation.", "التعرض السابق للمكسرات سبب حكة وطفحًا محدودًا فقط. لم تحدث سابقًا حساسية شديدة أو صدمة أو دخول للمستشفى أو تنبيب."],
  ["medications", "No regular prescription medication, beta-blocker, ACE inhibitor or regular antihistamine use.", "لا أستخدم أدوية بوصفة بانتظام، ولا حاصر بيتا ولا مثبط الإنزيم المحول للأنجيوتنسين ولا مضاد هيستامين بانتظام."],
  ["allergies", "Suspected nut allergy based on the prior mild reaction. This episode followed dessert likely containing nuts. No known medication allergy is documented.", "يوجد اشتباه بحساسية المكسرات استنادًا إلى التفاعل الخفيف السابق. حصلت هذه النوبة بعد حلوى يُرجح احتواؤها على مكسرات. لا توجد حساسية دوائية معروفة موثقة."],
  ["family", "No known family history of severe allergic reactions or hereditary angioedema; otherwise non-contributory to this encounter.", "لا توجد قصة عائلية معروفة لتفاعلات تحسسية شديدة أو وذمة وعائية وراثية؛ وباقي القصة العائلية غير مساهمة في هذه الزيارة."],
  ["smoking", "Non-smoker; no vaping.", "لا أدخن ولا أستخدم السجائر الإلكترونية."],
  ["substances", "No recreational drug use.", "لا أستخدم المخدرات الترفيهية."],
  ["alcohol", "Alcohol use is none or occasional only; no relevant recent intake.", "الكحول: لا تناول أو تناول عرضي فقط؛ لا تناول حديث ذو صلة."],
  ["function", "Independent baseline function.", "أعتمد على نفسي في حياتي اليومية قبل هذه النوبة."],
  ["onset", "This episode began about 10–15 minutes after dessert likely containing nuts.", "بدأت هذه النوبة بعد حوالي 10–15 دقيقة من حلوى يُرجح احتواؤها على مكسرات."],
  ["presenting-symptoms", "At onset I developed generalized itching and hives, shortness of breath, dizziness/feeling faint, mild lip swelling, and mild nausea/abdominal cramping.", "عند بداية النوبة ظهرت حكة عامة وشرى وضيق نفس ودوخة وإحساس بقرب الإغماء وتورم خفيف بالشفتين وغثيان خفيف ومغص بالبطن."],
  ["neurological-negatives", "No loss of consciousness, seizure or focal neurological symptoms during this episode.", "لم أفقد الوعي ولم تحدث نوبة تشنج أو أعراض عصبية بؤرية خلال هذه النوبة."],
  ["chest-pain", "No chest pain during this episode.", "لم يحدث ألم في الصدر خلال هذه النوبة."],
  ["infection", "No fever or infectious prodrome preceding this episode.", "لم توجد حمى أو أعراض عدوى تمهيدية قبل هذه النوبة."],
  ["gi-negatives", "No repetitive vomiting, diarrhea or severe abdominal pain during this episode.", "لم يحدث قيء متكرر أو إسهال أو ألم شديد بالبطن خلال هذه النوبة."],
  ["exposures", "No known recent new medication exposure, reported insect sting or major trauma.", "لا يوجد تعرض معروف لدواء جديد مؤخرًا ولا لسعة حشرة مبلّغ عنها ولا إصابة رضية كبيرة."],
  ["prearrival-epinephrine", "No epinephrine was used before arrival.", "لم يُستخدم الأدرينالين قبل الوصول."],
] as const;

export const DANA_ADDITIONAL_EXAM = [
  ["general", "Alert, interactive, anxious and visibly uncomfortable, with repeated scratching and mild tachypneic respiratory distress; dizzy but not collapsed.", "يقظة ومتفاعلة وقلقة وغير مرتاحة بوضوح، مع حك متكرر وضائقة تنفسية خفيفة وتسرع تنفس؛ تشعر بالدوخة دون انهيار."],
  ["neurological", "GCS 15. Alert and oriented to person, place and situation; follows commands and speech is understandable. No focal neurological deficit, seizure activity or altered mental status.", "مقياس غلاسكو 15. يقظة ومدركة للشخص والمكان والموقف، تتبع الأوامر وكلامها مفهوم. لا عجز عصبي بؤري ولا نشاط تشنجي ولا اضطراب في الحالة الذهنية."],
  ["airway", "Patent airway with mild lip edema. No visible tongue swelling, obvious uvular swelling, drooling, stridor or severe voice change/hoarseness. Able to speak, although respiratory discomfort may limit phrase length.", "مجرى الهواء سالك مع وذمة خفيفة بالشفتين. لا تورم مرئي باللسان ولا تورم واضح باللهاة ولا سيلان لعاب ولا صرير ولا تغير شديد بالصوت أو بحة. تستطيع الكلام وقد يحد الانزعاج التنفسي من طول العبارة."],
  ["respiratory", "Mild increased work of breathing with bilateral wheeze. No focal unilateral reduction in air entry or clinical evidence of tension pneumothorax.", "زيادة خفيفة بجهد التنفس مع أزيز ثنائي الجانب. لا نقص بؤري أحادي الجانب بدخول الهواء ولا دليل سريري على استرواح صدري ضاغط."],
  ["cardiovascular", "Tachycardic and hypotensive; peripheral pulse rapid and reduced in volume. Capillary refill approximately 3 seconds. No obvious peripheral edema.", "تسرع قلب وانخفاض ضغط الدم؛ النبض المحيطي سريع ومنخفض الحجم. زمن الامتلاء الشعيري حوالي 3 ثوانٍ. لا وذمة محيطية واضحة."],
  ["abdomen", "Soft, non-distended abdomen with mild diffuse crampy discomfort reported. No focal tenderness, guarding, rebound tenderness or peritonism. No active vomiting during examination.", "البطن لين وغير منتفخ مع إبلاغ عن مغص خفيف منتشر. لا إيلام بؤري ولا دفاع عضلي ولا ألم ارتدادي ولا علامات تهيج صفاقي. لا قيء فعّال أثناء الفحص."],
  ["skin-mucosa", "Widespread pruritic erythematous urticaria, most visible on the arms, neck and upper chest, with mild lip swelling. No cyanosis, blistering or skin sloughing.", "شرى حمامي حاك واسع الانتشار أوضح على الذراعين والرقبة وأعلى الصدر، مع تورم خفيف بالشفتين. لا زرقة ولا فقاعات ولا انسلاخ جلدي."],
  ["extremities-perfusion", "Peripheral pulses present but reduced in volume in the hypotensive state; capillary refill approximately 3 seconds. No peripheral edema, unilateral limb swelling, focal limb tenderness or signs of DVT.", "النبضات المحيطية موجودة لكنها منخفضة الحجم في حالة انخفاض الضغط؛ زمن الامتلاء الشعيري حوالي 3 ثوانٍ. لا وذمة محيطية ولا تورم أحادي الطرف ولا إيلام بؤري بالأطراف ولا علامات خثار وريدي عميق."],
] as const;

export async function createDanaHistoryExamCase(hash: HashAdapter) {
  const c = await createCompleteExpoCase("dana", hash);
  c.manifest = {
    ...c.manifest,
    case_version: "1.4.0" as typeof c.manifest.case_version,
    case_version_id: "case-version.anaphylaxis.dana.005" as typeof c.manifest.case_version_id,
    case_package_id: "case-package.anaphylaxis.dana.005" as typeof c.manifest.case_package_id,
  };
  c.initial_state.patient_state.case_version = c.manifest.case_version;
  const additions = [
    ...DANA_ADDITIONAL_HISTORY.map(([domain, en, ar]) => ({ domain, en, ar, kind: "HISTORY" as const })),
    ...DANA_ADDITIONAL_EXAM.map(([domain, en, ar]) => ({ domain, en, ar, kind: "EXAM_FINDING" as const })),
  ];
  const authoring = additions.map(({ domain, en, ar, kind }) => {
    const id = `fact.dana.author.${kind === "HISTORY" ? "history" : "exam"}.${domain}`;
    const f = ClinicalFactSchema.parse({
      fact_id: id, fact_type: kind, clinical_code: id, content_key: id,
      disclosure_mode: kind === "HISTORY" ? "on_direct_question" : "after_exam",
      ...(kind === "HISTORY" ? { patient_truth_status: "AUTHORED_STATEMENT" } : {}),
      source_ids: [DANA_AUTHOR_SOURCE],
    });
    c.clinical_facts.facts.push(f);
    c.localization.entries.push({
      key: f.content_key,
      translations: [{ locale: "en-US" as never, text: en }, { locale: "ar-JO" as never, text: ar }],
    });
    if (kind === "HISTORY") c.dialogue_policy.disclosable_fact_ids.push(f.fact_id);
    else c.dialogue_policy.forbidden_fact_ids.push(f.fact_id);
    return {
      fact_id: f.fact_id, domain, ...DANA_AUTHORING_STATUS,
      scope: kind === "HISTORY" ? "PATIENT_KNOWN_HISTORY" : "INITIAL_EXAM_FINDING",
      source_id: DANA_AUTHOR_SOURCE,
    };
  });
  // Use the existing hash-bound module extension for provenance, not a parallel
  // clinical store. ClinicalFact remains the sole fact/disclosure contract.
  c.clinical_facts.extensions = {
    ...c.clinical_facts.extensions,
    "balsim.authoring": { version: "1.0", facts: authoring },
  };
  c.validation.sources.push({
    source_id: DANA_AUTHOR_SOURCE as never,
    source_version_id: "source-version.wp2.dana-author-history-exam.v1" as never,
    status: "UNRESOLVED", required: true,
  });
  c.validation.required_source_ids.push(DANA_AUTHOR_SOURCE as never);
  c.validation.deferred_checks = [
    (await generateRuleReachabilityEvidence(c, "2026-09-25T00:00:00Z", hash)).evidence,
  ];
  return DraftCasePackageSchema.parse(c);
}

/** Intended current Expo review pins; old builders/Sessions remain unchanged. */
export async function prepareCurrentCompleteExpoCase(patient: Patient, hash: HashAdapter) {
  if (patient === "khalid") return prepareCompleteExpoCase(patient, hash);
  const result = await prepareReviewExecutionArtifact(await createDanaHistoryExamCase(hash), hash);
  if (!result.success) throw Error(`DANA_HISTORY_EXAM_CASE_INVALID ${JSON.stringify(result.report)}`);
  return result.artifact;
}
