import type { HashAdapter } from "../../../packages/contracts/src/index.ts";
import { CaseActionDefinitionSchema, DraftCasePackageSchema, generateRuleReachabilityEvidence, prepareReviewExecutionArtifact, type DraftCasePackage } from "../../../packages/case-schema/src/index.ts";
import { createExpoCatalogueCase } from "./expo-cases.ts";
import { COMPLETE_EXPO_CATALOGUE } from "./complete-catalogue.ts";
import { BASELINE_LABS, LAB_DEFINITIONS, LAB_TIMING, MEDICAL_SOURCE, PANELS, REFERENCE_CONFIG, REVIEW_STATUS, type Patient } from "./medical-dataset.ts";

export const COMPLETE_CASE_REFERENCES = [
  {id:MEDICAL_SOURCE,title:"Owner-authored synthetic complete Case dataset and FoCUS clarification; conflicts retain prior truth",url:"planning_input/medical_review/EXPO_CASE_COMPLETENESS_MATRIX.md"},
  {id:"source.wp2.esc-2023",title:"2023 ESC ACS guideline",url:"https://academic.oup.com/eurheartj/article/44/38/3720/7243210"},
  {id:"source.wp2.wao-2020",title:"WAO Anaphylaxis Guidance 2020",url:"https://doi.org/10.1016/j.waojou.2020.100472"},
  {id:"source.wp2.reference-config",title:"Simulation display bands v1; local assay configuration, pending physician review",url:"planning_input/medical_review/EXPO_CASE_COMPLETENESS_MATRIX.md"},
];
function localize(c:DraftCasePackage,key:string,en:string,ar:string) {
  const old = c.localization.entries.find(e=>e.key===key);
  const translations = [{locale:"en-US" as never,text:en},{locale:"ar-JO" as never,text:ar}];
  if(old) old.translations=translations;
  else c.localization.entries.push({key:key as never,translations});
}
function fact(c:DraftCasePackage,id:string,en:string,ar:string,type:"HISTORY"|"EXAM_FINDING"|"INVESTIGATION_RESULT",known=false) {
  localize(c,id,en,ar);
  c.clinical_facts.facts.push({fact_id:id as never,fact_type:type,clinical_code:id as never,content_key:id as never,
    disclosure_mode:known?"on_direct_question":type==="EXAM_FINDING"?"after_exam":"after_result",source_ids:[MEDICAL_SOURCE as never]});
  if(known) c.dialogue_policy.disclosable_fact_ids.push(id as never);
}
const authoring = (sample_context:"BASELINE_CASE_SAMPLE"|"AT_ORDER_STUDY") => ({
  origin:"SIMULATION_AUTHORED" as const,review_status:REVIEW_STATUS,reference_configuration:REFERENCE_CONFIG,
  timing_basis:"SIMULATION_TIMING_FIXTURE" as const,sample_context,
});
const inheritedLabIds:Record<string,string> = {cbc:"investigation.cbc",glucose:"investigation.poc-glucose",troponin:"investigation.hs-ctni",coagulation:"investigation.coagulation"};
function policy(c:DraftCasePackage,id:string) {
  return {policy_version:"1.0" as const,outcome_code:`outcome.complete.${id}`,behavior:"AUTHORED_CASE_BEHAVIOR" as const,
    unmatched_rule_behavior:"NO_MODELED_BENEFIT" as const,duration_seconds:15,duration_basis:"EXPO_SIMULATION_FIXTURE" as const,
    rule_ids:c.rules.rules.filter(r=>r.referenced_action_ids.includes(id as never)).map(r=>r.rule_id),
    source_ids:[MEDICAL_SOURCE as never],review_status:REVIEW_STATUS};
}
function scheduledRule(c:DraftCasePackage,actionId:string,key:string,seconds:number,report=false) {
  c.rules.rules.push({rule_schema_version:"1.0",rule_id:`rule.complete.${key}` as never,rule_version:"1.0.0" as never,
    trigger:{trigger_type:"COMMITTED_EVENT",event_type:"INVESTIGATION_ORDERED",action_id:actionId as never},
    preconditions:[],exclusions:[],priority:50,conflict_policy:"BLOCK",
    effects:[{effect_type:"SCHEDULE_RELATIVE",effect_id:`effect.complete.${key}` as never,scheduled_item_id:`scheduled-item.complete.${key}` as never,
      category:`complete.${key}` as never,priority:50,conflict_policy:"BLOCK",delay_clinical_seconds:seconds,effects:[],
      emitted_events:["INVESTIGATION_RESULT_AVAILABLE",...(report?["INVESTIGATION_FORMAL_REPORT_AVAILABLE"]:[])].map(event_type=>({
        event_type:event_type as "INVESTIGATION_RESULT_AVAILABLE"|"INVESTIGATION_FORMAL_REPORT_AVAILABLE",action_id:actionId as never,
        parameters:{},payload:{code:`complete.${key}.available`},clinical_effect_ids:[],
      }))}],emitted_events:[],referenced_action_ids:[actionId as never],referenced_rule_ids:[],referenced_fact_ids:[],
    source_ids:[MEDICAL_SOURCE as never],timing_window_ids:[],scoring_evidence_refs:[]});
}
/** New hash-bound successors. No modification to the parent builders or their outputs. */
export async function createCompleteExpoCase(patient:Patient,hash:HashAdapter) {
  const c=await createExpoCatalogueCase(patient,hash), k=patient==="khalid";
  const suffix=k?"stemi.inferior-rv.005":"anaphylaxis.dana.004", version=k?"2.3.0":"1.3.0";
  c.manifest={...c.manifest,case_version:version as never,case_version_id:`case-version.${suffix}` as never,case_package_id:`case-package.${suffix}` as never};
  c.initial_state.patient_state.case_version=version as never;
  for(const r of COMPLETE_CASE_REFERENCES) {
    c.validation.sources.push({source_id:r.id as never,source_version_id:`${r.id.replace("source.","source-version.")}.v1` as never,status:"UNRESOLVED",required:true});
    c.validation.required_source_ids.push(r.id as never);
  }
  c.action_catalogue.shared!.catalogue=structuredClone(COMPLETE_EXPO_CATALOGUE);
  for(const [panel,en,ar,baseCodes] of PANELS) {
    const id=k && inheritedLabIds[panel] ? inheritedLabIds[panel]! : `investigation.complete.${patient}.${panel}`;
    const existing=c.action_catalogue.actions.find(a=>a.action_id===id);
    const key=`${patient}.${panel}`,resultId=existing?.investigation?.result.diagnostic_result_id??`diagnostic-result.complete.${key}`;
    const codes=[...baseCodes,...(k&&panel==="blood-gas"?["po2"]:[]),...(k&&panel==="electrolytes"?["magnesium"]:[])];
    const finding=`fact.complete.${key}`;
    let result:unknown;
    if(!k && panel==="troponin") {
      fact(c,finding,"Cardiac troponin is within the configured assay reference range (negative).","التروبونين القلبي ضمن المجال المرجعي للاختبار (سلبي).","INVESTIGATION_RESULT");
      result={result_schema_version:"1.0",diagnostic_result_id:resultId,result_type:"TEXT_REPORT",modality:"TEXT_REPORT",source_ids:[MEDICAL_SOURCE],finding_fact_ids:[finding],report_content_key:finding};
    } else {
      result={result_schema_version:"1.0",diagnostic_result_id:resultId,result_type:"STRUCTURED_LAB",modality:"LABORATORY",panel_code:`panel.complete.${panel}`,source_ids:[MEDICAL_SOURCE],finding_fact_ids:[],analytes:codes.map(code=>{
        const d=LAB_DEFINITIONS[code]!,value=BASELINE_LABS[patient][code]!;
        localize(c,`lab.complete.${code}`,d.en,d.ar);
        const range=d.range ?? (code==="hemoglobin"?(k?[13.2,16.6]:[11.6,15]):code==="hematocrit"?(k?[38.3,48.6]:[35.5,44.9]):code==="ph"?(k?[7.35,7.45]:[7.31,7.41]):code==="pco2"?(k?[35,45]:[41,51]):undefined);
        return {analyte_id:`analyte.complete.${key}.${code}`,analyte_code:`analyte.${code}`,display_label_key:`lab.complete.${code}`,value,unit_code:`unit.${d.unit}`,
          ...(!k&&code==="egfr"?{value_qualifier:"GREATER_THAN"}:{}),
          ...(range?{reference_interval:{lower_bound:range[0],upper_bound:range[1],lower_inclusive:true,upper_inclusive:true},abnormal_flag:value<range[0]! ? "LOW":value>range[1]! ? "HIGH":"NORMAL"}:{}),};
      })};
    }
    const seconds=LAB_TIMING[patient][panel]!;
    const newInvestigation={investigation_schema_version:"1.0",execution_mode:"ASYNC_PARALLEL",authoring:authoring("BASELINE_CASE_SAMPLE"),result,
      milestones:existing?.investigation?.milestones??[
        {diagnostic_milestone_id:`diagnostic-milestone.complete.${key}.ordered`,milestone_type:"ORDERED",offset_clinical_seconds:0},
        {diagnostic_milestone_id:`diagnostic-milestone.complete.${key}.result`,milestone_type:"RESULT_AVAILABLE",offset_clinical_seconds:seconds},
        ...(!k&&panel==="troponin"?[{diagnostic_milestone_id:`diagnostic-milestone.complete.${key}.report`,milestone_type:"FORMAL_REPORT_AVAILABLE",offset_clinical_seconds:seconds}]:[])],
      learner_visibility:existing?.investigation?.learner_visibility??{structured_result:"AT_COMPONENT_AVAILABILITY",media:"NEVER",machine_interpretation:"NEVER",formal_report:!k&&panel==="troponin"?"AT_COMPONENT_AVAILABILITY":"NEVER"}};
    if(!existing) scheduledRule(c,id,key,seconds,!k&&panel==="troponin");
    const action=CaseActionDefinitionSchema.parse({...(existing??{action_id:id,action_type:"INVESTIGATION",parameter_definitions:[],aliases:[{locale:"en-US",phrases:[en],authority:"INTERPRETATION_ONLY"},{locale:"ar-JO",phrases:[ar],authority:"INTERPRETATION_ONLY"}],prerequisite_action_ids:[],confirmation_policy:"NONE",repeat_policy:"NOT_REPEATABLE",source_ids:[MEDICAL_SOURCE]}),investigation:newInvestigation,outcome_policy:policy(c,id)});
    if(existing) c.action_catalogue.actions[c.action_catalogue.actions.indexOf(existing)]=action;
    else c.action_catalogue.actions.push(action);
    c.action_catalogue.shared!.bindings.push({concept_id:`concept.expo.${panel}` as never,case_action_id:id as never});
  }
  const echoId=k?"investigation.focused-echo":"investigation.complete.dana.focused-echo";
  if(!k) {
    const finding="fact.complete.dana.focused-echo";
    fact(c,finding,"Focused cardiac ultrasound: hyperdynamic, relatively underfilled LV with preserved global systolic function and low end-diastolic volume. No focal regional wall-motion abnormality, RV dilatation/obvious strain, or pericardial effusion. Small IVC with marked respiratory collapsibility supports reduced effective preload in the current distributive/anaphylactic shock state. No gross structural abnormality on this limited bedside study; not a comprehensive echocardiogram.","تصوير قلبي مركّز: بطين أيسر مفرط الحركة وقليل الامتلاء مع وظيفة انقباضية كلية محفوظة وحجم انبساطي منخفض. لا اضطراب بؤري بحركة الجدار ولا توسع أو إجهاد واضح للبطين الأيمن ولا انصباب تاموري. الوريد الأجوف السفلي صغير وشديد الانهيار مع التنفس، بما يدعم نقص الامتلاء الفعال في الصدمة التوزيعية/التأقية الحالية. لا شذوذ بنيوي جسيم بالفحص المحدود؛ ليس إيكو شاملًا.","INVESTIGATION_RESULT");
    scheduledRule(c,echoId,"dana.focused-echo",240,true);
    c.action_catalogue.actions.push(CaseActionDefinitionSchema.parse({action_id:echoId,action_type:"INVESTIGATION",parameter_definitions:[],aliases:[],prerequisite_action_ids:[],confirmation_policy:"NONE",repeat_policy:"NOT_REPEATABLE",source_ids:[MEDICAL_SOURCE],outcome_policy:policy(c,echoId),investigation:{
      investigation_schema_version:"1.0",execution_mode:"ASYNC_PARALLEL",authoring:authoring("AT_ORDER_STUDY"),result:{result_schema_version:"1.0",diagnostic_result_id:"diagnostic-result.complete.dana.focused-echo",result_type:"ULTRASOUND",modality:"ECHOCARDIOGRAPHY",source_ids:[MEDICAL_SOURCE],finding_fact_ids:[finding],fallback_fact_ids:[finding],asset_references:[],structured_measurements:[],formal_report_key:finding},
      milestones:[{diagnostic_milestone_id:"diagnostic-milestone.complete.dana.echo.ordered",milestone_type:"ORDERED",offset_clinical_seconds:0},{diagnostic_milestone_id:"diagnostic-milestone.complete.dana.echo.result",milestone_type:"RESULT_AVAILABLE",offset_clinical_seconds:240},{diagnostic_milestone_id:"diagnostic-milestone.complete.dana.echo.report",milestone_type:"FORMAL_REPORT_AVAILABLE",offset_clinical_seconds:240}],learner_visibility:{structured_result:"AT_COMPONENT_AVAILABILITY",media:"NEVER",machine_interpretation:"NEVER",formal_report:"AT_COMPONENT_AVAILABILITY"}}}));
  } else c.action_catalogue.actions.find(a=>a.action_id===echoId)!.outcome_policy=policy(c,echoId);
  c.action_catalogue.shared!.bindings.push({concept_id:"concept.expo.focused-echo" as never,case_action_id:echoId as never});
  // Owner-permitted searchable special tests; NOT part of the common first-level list.
  // Do not manufacture a Dana right-ECG or a Khalid tryptase just for symmetry.
  const specialId=k?"investigation.ecg-right-sided":"investigation.dana.tryptase";
  const special=c.action_catalogue.actions.find(a=>a.action_id===specialId)!;
  special.outcome_policy=policy(c,specialId);
  const specialConcept=CaseSpecialConcept(k);
  c.action_catalogue.shared!.search_only={actions:[specialConcept],bindings:[{concept_id:specialConcept.action_id,case_action_id:specialId as never}]};
  // Deliberately no fabricated histories, serial troponin, tryptase value or reperfusion state.
  // FoCUS is supplied by owner, never inferred from the disease label.
  c.validation.deferred_checks=[(await generateRuleReachabilityEvidence(c,"2026-09-25T00:00:00Z",hash)).evidence];
  return DraftCasePackageSchema.parse(c);
}
function CaseSpecialConcept(k:boolean) {
  return COMPLETE_EXPO_CATALOGUE.actions.filter(a=>a.action_id==="concept.expo.ecg").map(a=>({...structuredClone(a),
    action_id:(k?"concept.special.right-ecg":"concept.special.tryptase") as typeof a.action_id,
    labels:[{locale:"en-US" as never,label:k?"Right-sided ECG":"Serum tryptase"},{locale:"ar-JO" as never,label:k?"تخطيط القلب الأيمن":"تريبتاز المصل"}],
    aliases:[{locale:"en-US" as never,phrases:[k?"right-sided ECG":"serum tryptase"]},{locale:"ar-JO" as never,phrases:[k?"تخطيط القلب الأيمن":"تريبتاز المصل"]}],
    subcategory:"Special investigations",
  }))[0]!;
}
export async function prepareCompleteExpoCase(patient:Patient,hash:HashAdapter) {
  const result=await prepareReviewExecutionArtifact(await createCompleteExpoCase(patient,hash),hash);
  if(!result.success) throw Error(`WP2_COMPLETE_CASE_INVALID ${JSON.stringify(result.report)}`);
  return result.artifact;
}
