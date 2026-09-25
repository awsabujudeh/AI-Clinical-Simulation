import { useEffect, useRef, useState } from "react";
import { SafeLearnerActionSchema, type ExamOption } from "@ai-clinical-simulation/contracts";
import { useLocalization } from "../../app/localization";
import { Panel, Button } from "../../components/ui";
import { isSessionMutationEntryEnabled } from "../../app/session-presentation";
import type { AuthSnapshot, SessionPresentationState, StudentUiServices } from "../../app/types";
import type { VisualExamSelection } from "./exam-intent";
import { currentVisualExamSelection } from "./exam-intent";

export function ExaminationPanel({services,auth,state,onAuthoritativeRefresh,onFocus,intent}:{
 services:StudentUiServices;auth:Extract<AuthSnapshot,{status:"AUTHENTICATED"}>;state:SessionPresentationState;
 onAuthoritativeRefresh():Promise<unknown>;onFocus(option:ExamOption):void;intent?:VisualExamSelection;
}) {
 const {locale}=useLocalization(), ar=locale==="ar-JO";
 const data=state.projection.examinations;
 const [selected,setSelected]=useState<string>(),[message,setMessage]=useState("");
 const [busy,setBusy]=useState(false),pending=useRef(false);
 const option=data?.options.find(x=>x.action_id===selected);
 useEffect(()=>{setSelected(undefined);setMessage("");},[state.projection.session_id]);
 useEffect(()=>{
  if(!intent || !currentVisualExamSelection(intent,state.projection))return;
  const r=intent.request;
  const key=r.tool==="stethoscope"?"auscultation":r.region_id.includes("CHEST")?"respiratory":r.region_id.includes("ABDOM")?"abdomen":r.region_id.includes("ARM")?"skin":r.region_id.includes("LEG")?"perfusion":r.region_id.includes("FACE")||r.region_id.includes("NECK")?"airway":"general";
  setSelected(`examination.expo.${key}`);
 },[intent]);
 if(!data)return null;
 const label=(o:ExamOption)=>o.labels.find(l=>l.locale===locale)!.text;
 async function perform(){
  if(!option || pending.current || !isSessionMutationEntryEnabled(state))return;
  pending.current=true;setBusy(true);setMessage("");
  try {
   const action=SafeLearnerActionSchema.parse({action_id:option.action_id,action_type:"EXAMINATION",labels:option.labels.map(l=>({locale:l.locale,label:l.text})),aliases:option.labels.map(l=>({locale:l.locale,phrases:[l.text]})),parameter_definitions:[],confirmation_policy:"NONE",repeat_policy:"REPEATABLE"});
   const result=await services.actions.submit({principal_user_id:auth.principal_user_id,session_id:state.projection.session_id,expected_state_version:state.projection.state_version,action,parameters:{},connectivity_state:"ONLINE"});
   await onAuthoritativeRefresh();setMessage(result.kind==="COMMITTED"?(ar?"تم تسجيل الفحص":"Examination recorded"):result.kind);
  }finally{pending.current=false;setBusy(false);}
 }
 return <Panel aria-label="Physical examination findings">
  <h2>{ar?"الفحص السريري والنتائج":"Physical examination and findings"}</h2>
  <p>{ar?"نتائج معتمدة بعد الفحص فقط. الصوت غير متاح. مدة 30 ثانية هي توقيت محاكاة مضغوط.":"Approved findings are disclosed only after examination. Auscultation audio is unavailable. The 30-second duration is a compressed simulation fixture."}</p>
  <div role="group" aria-label="Clinical examination actions">{data.options.map(o=><button type="button" key={o.action_id} disabled={busy||!isSessionMutationEntryEnabled(state)} aria-pressed={o===option} onClick={()=>{setSelected(o.action_id);onFocus(o);}}>{label(o)}</button>)}</div>
  {option?<p>{label(option)} — {option.tool} — 30s</p>:null}
  <Button disabled={!option||busy||!isSessionMutationEntryEnabled(state)} onClick={()=>void perform()}>{ar?"إجراء الفحص المحدد":"Perform selected examination"}</Button>
  <p role="status">{message}</p>
  <ol aria-label="Acquired examination findings">{data.receipts.map(r=><li key={r.event_id}>
   <strong>{data.options.find(o=>o.action_id===r.action_id)?.labels.find(l=>l.locale===locale)?.text}</strong> — {r.clinical_time}s
   {r.status==="AVAILABLE"?r.findings.map(f=><p key={f.fact_id}>{f.text.find(t=>t.locale===locale)?.text}</p>):<p>{ar?"لا توجد نتيجة فحص مؤلفة للحالة السريرية الحالية؛ لم تُفترض نتيجة طبيعية.":"No examination finding is authored for the current clinical state; no normal result was inferred."}</p>}
  </li>)}</ol>
 </Panel>;
}
