import { ExamOptionSchema, PinnedExamSchema } from "../../contracts/src/examination.ts";
import type { ReviewExecutionArtifact } from "./schemas.ts";

// Versioned runtime delivery binding to immutable, approved facts. No changes to
// Case bytes, effects, rubric, shared catalogue 1.1.0, or historical Sessions.
export const EXAM_OPTIONS = [
  ["general","General inspection","المعاينة العامة","GENERAL","inspection"],
  ["airway","Airway inspection","فحص مجرى الهواء","AIRWAY","inspection"],
  ["respiratory","Respiratory inspection","معاينة التنفس","CHEST","inspection"],
  ["auscultation","Chest auscultation","تسمع الصدر","CHEST","stethoscope"],
  ["cardiovascular","Cardiovascular examination","الفحص القلبي الوعائي","CHEST","clinical"],
  ["abdomen","Abdominal examination","فحص البطن","ABDOMEN","clinical"],
  ["skin","Skin inspection","فحص الجلد","SKIN","inspection"],
  ["perfusion","Peripheral perfusion examination","فحص التروية الطرفية","EXTREMITIES","clinical"],
  ["neurological","Mental status / neurological assessment","تقييم الحالة الذهنية والأعصاب","NEUROLOGICAL","clinical"],
].map(([id,en,ar,region,tool])=>ExamOptionSchema.parse({action_id:`examination.expo.${id}`,labels:[{locale:"en-US",text:en},{locale:"ar-JO",text:ar}],region,tool,duration_seconds:30,repeat_policy:"REPEATABLE"}));

/** Baseline text is not a post-treatment sample. Never infer a new finding when
 * relevant physiology changes. Successful repeated exams still record time. */
export function examStateSignature(s: {consciousness:unknown; respiratory_state:unknown; hemodynamic_state:unknown; pain_state:unknown; clinical_phase:unknown; active_complications:unknown}) {
  return JSON.stringify([s.consciousness,s.respiratory_state,s.hemodynamic_state,s.pain_state,s.clinical_phase,s.active_complications]);
}
// Excerpts are exact substrings of approved localized text, verified below.
// This prevents a composite "other exam" fact leaking abdomen through neuro.
const khalid = [
  ["general-appearance"],
  ["general-appearance","speaking in short sentences.","يتحدث بجمل قصيرة."],
  ["respiratory-exam","mildly increased work of breathing","زيادة خفيفة في جهد التنفس"],
  ["respiratory-exam","Lungs are clear without crackles or wheeze","الرئتان صافيتان دون خراخر أو أزيز"],
  ["cardiac-exam","Regular tachycardia","تسرع قلب منتظم"],
  ["other-exam","abdomen is soft and nontender without guarding, mass, or significant hepatomegaly","البطن لين وغير مؤلم دون دفاع أو كتلة أو تضخم كبدي مهم"],
  ["general-appearance","Pale, clammy","يبدو شاحبًا ومتعرقًا"],
  ["perfusion-exam"],
  ["other-exam","No chest-wall tenderness or focal neurologic deficit","لا يوجد ألم بجدار الصدر أو عجز عصبي بؤري"],
];
const dana = [
  ["author.exam.general"],["author.exam.airway"],
  ["respiratory","Mild increased work of breathing","زيادة خفيفة في جهد التنفس"],
  ["respiratory","bilateral wheeze.","أزيز ثنائي الجانب."],
  ["author.exam.cardiovascular"],["author.exam.abdomen"],["author.exam.skin-mucosa"],
  ["author.exam.extremities-perfusion"],["author.exam.neurological"],
];
export function deriveExamActions(a:ReviewExecutionArtifact) {
  if(a.execution_authority!=="APPROVED_EXPO")return [];
  const patient = a.review_execution_hash==="e212c36090b59a4d324348c85fd1f5f7a0dbff02b1710a4e360a135e060760d7"?"stemi"
    :a.review_execution_hash==="0cc26e1bad72fd44f84afe9f11832789cc60fd8408c9b13e1276c9fbf2a0dd65"?"dana":undefined;
  if(!patient)return [];
  const c=a.source_case, bindings=patient==="stemi"?khalid:dana;
  return EXAM_OPTIONS.map((option,i)=>{
    const [suffix,en,ar]=bindings[i]!;
    const fact=c.clinical_facts.facts.find(f=>f.fact_id===`fact.${patient}.${suffix}` && f.fact_type==="EXAM_FINDING" && f.disclosure_mode==="after_exam");
    if(!fact)throw Error("EXAM_BINDING_FACT_MISSING");
    const text=(["en-US","ar-JO"] as const).map((locale,index)=>{
      const source=c.localization.entries.find(e=>e.key===fact.content_key)?.translations.find(t=>t.locale===locale)?.text;
      const excerpt=index===0?en:ar;
      if(!source || (excerpt && !source.includes(excerpt)))throw Error("EXAM_BINDING_EXCERPT_MISMATCH");
      let delivered=excerpt??source;
      // Keep the explicit negation while omitting the unrelated chest-wall clause.
      if(patient==="stemi" && i===8)delivered=delivered.replace(locale==="en-US"?"chest-wall tenderness or ":"ألم بجدار الصدر أو ","");
      return {locale,text:delivered};
    });
    return {action_id:option.action_id,action_type:"EXAMINATION" as const,parameter_definitions:[],prerequisite_action_ids:[],confirmation_policy:"NONE" as const,repeat_policy:"REPEATABLE" as const,execution_event_type:"EXAM_PERFORMED" as const,
      examination:PinnedExamSchema.parse({option,baseline_state_signature:examStateSignature(c.initial_state.patient_state),findings:[{fact_id:fact.fact_id,text}]})};
  });
}
