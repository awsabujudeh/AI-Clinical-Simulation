import type {ClinicalInterpretation,SafeLearnerActionCatalogue} from '../../contracts/src/index.ts';
import {reconcileClinicalInterpretation} from './reconcile.ts';
/** Bounded lexical convenience, never medical inference. Provider fallback keeps
 * the existing single-intent schema, safety validation and per-Session budget. */
export function splitClinicalOrder(text:string):string[]{
  // Scope of negation/conditional/past tense must not be lost by splitting.
  if(/\b(not|don't|without|if|would|already|gave|ordered)\b|(?:^|\s)(لا|ما|لو|اذا|إذا|أعطيت|اعطيت)(?:\s|$)/iu.test(text))return [text];
  return text.split(/\s*(?:[,،;؛\n]|\band\b|\bthen\b|\s+و(?=\S)|\s+ثم\s+)\s*/iu).map(x=>x.trim().replace(/^و(?=(?:اعمل|قيس|اعطي|اعط|ركب|حط|ابدأ)\s)/,''));
}
const normalized=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/\s+/g,' ').trim();
const vocabulary:Record<string,string[]>={bp:['قيس الضغط','قياس الضغط'],ecg:['تخطيط'],iv:['iv','ركب كانيولا','حط iv'],troponin:['troponin','تروبونين'],cbc:['cbc'],oxygen:['اكسجين'],epinephrine:['ادرينالين']};
export function controlledInterpretation(text:string,catalogue:SafeLearnerActionCatalogue):ClinicalInterpretation|undefined{
  const n=normalized(text).replace(/^(?:please\s+)?(?:give|get|order|measure|insert|apply|administer)\s+/,'').replace(/^(?:اعمل|اعطي|اعط|ركب|حط|ابدأ)\s+/,'');
  if(/\b(not|don't|without|if|would|already|gave|ordered)\b|(?:^|\s)(لا|لو|اذا|ما)(?:\s|$)/iu.test(n))return undefined;
  const fluids=['fluids','iv fluids','سوائل'].includes(n);
  const choices=catalogue.actions.filter(a=>fluids?['concept.expo.saline-250','concept.expo.crystalloid-500'].includes(a.action_id):[...a.labels.map(l=>l.label),...(a.aliases??[]).flatMap(l=>l.phrases),...(vocabulary[a.action_id.replace('concept.expo.','')]??[])].some(p=>normalized(p)===n));
  if(!choices.length)return undefined;
  const r=reconcileClinicalInterpretation({context:{context_schema_version:'1.0',locale:'en-US' as never,learner_action_catalogue:catalogue},model_output:{output_schema_version:'2.0',status:choices.length===1?'MATCH':'AMBIGUOUS',ambiguity_reason:choices.length===1?null:'UNCLEAR_ACTION',no_match_reason:null,candidates:choices.map(a=>({action_id:a.action_id,parameters:[]}))}});
  return r.success?r.interpretation:undefined;
}
