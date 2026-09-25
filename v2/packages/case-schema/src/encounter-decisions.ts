import {SafeLearnerActionSchema} from '../../contracts/src/api-v1.ts';
import type {ReviewExecutionArtifact} from './schemas.ts';
// A common learner decision set, never a list of the active Case's correct answers.
const rows=[
 ['inferior-stemi','DIAGNOSIS','Acute inferior STEMI','احتشاء سفلي حاد مرتفع ST'],
 ['rv','DIAGNOSIS','Right ventricular involvement','إصابة البطين الأيمن'],
 ['anaphylaxis','DIAGNOSIS','Food-triggered anaphylaxis','التأق المحرض بالطعام'],
 ['undetermined','DIAGNOSIS','Diagnosis not yet determined','التشخيص غير محدد بعد'],
 ['cath','DISPOSITION','Transfer to catheterization laboratory','النقل إلى مختبر القسطرة'],
 ['observation','DISPOSITION','Monitored observation','المراقبة السريرية'],
 ['ward','DISPOSITION','Ward admission','الإدخال إلى الجناح'],
 ['discharge','DISPOSITION','Discharge home','التخريج إلى المنزل'],
] as const;
export const ENCOUNTER_DECISIONS=rows.map(([id,type,en,ar])=>SafeLearnerActionSchema.parse({action_id:`decision.expo.${id}`,action_type:type,labels:[{locale:'en-US',label:en},{locale:'ar-JO',label:ar}],parameter_definitions:[],confirmation_policy:'EXPLICIT_REQUEST',repeat_policy:'REPEATABLE'}));
const authored:Record<string,string[]>={
 'inferior-stemi':['diagnosis.inferior-stemi'],rv:['diagnosis.rv-involvement'],anaphylaxis:['diagnosis.dana.food-anaphylaxis'],
 cath:['disposition.transfer-cath-lab'],observation:['disposition.dana.monitored-observation'],ward:['disposition.ward-admission'],discharge:['disposition.discharge-home','disposition.dana.premature-discharge'],
};
export function decisionBinding(id:string,ids:readonly string[]){return authored[id.replace('decision.expo.','')]?.find(x=>ids.includes(x));}
export function deriveDecisionActions(a:ReviewExecutionArtifact){
 if(a.execution_authority!=='APPROVED_EXPO'||!['e212c36090b59a4d324348c85fd1f5f7a0dbff02b1710a4e360a135e060760d7','0cc26e1bad72fd44f84afe9f11832789cc60fd8408c9b13e1276c9fbf2a0dd65'].includes(a.review_execution_hash))return [];
 // Unmapped decisions record learner intent only. No new effect, finding or score.
 return ENCOUNTER_DECISIONS.map(o=>({action_id:o.action_id,action_type:o.action_type,parameter_definitions:[],prerequisite_action_ids:[],confirmation_policy:'NONE' as const,repeat_policy:'REPEATABLE' as const,execution_event_type:o.action_type==='DIAGNOSIS'?'DIAGNOSIS_SUBMITTED' as const:'DISPOSITION_SELECTED' as const}));
}
