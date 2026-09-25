import { SafeExaminationProjectionSchema } from "../../../contracts/src/examination.ts";
import type { InMemorySessionAggregate } from "../../../session-engine/src/index.ts";
export function examinationProjection(s:InMemorySessionAggregate) {
  const actions=s.pinned_case.action_catalogue.filter(a=>a.examination);
  if(!actions.length)return undefined;
  const receipts=s.committed_events.flatMap(e=>{
    const a=actions.find(a=>a.action_id===e.action_id);
    if(!a?.examination || e.status!=="COMMITTED" || e.session_id!==s.session_id || e.case_version!==s.pinned_case.case_version || e.event_type!=="EXAM_PERFORMED" || e.actor_type!=="LEARNER" || e.clinical_time>s.patient_state.clinical_time)return [];
    const p=e.payload;
    if(!p || typeof p!=="object" || Array.isArray(p) || p.execution_status!=="EXECUTED" || p.catalogue_membership!=="VERIFIED")return [];
    const r=p.examination;
    if(!r || typeof r!=="object" || Array.isArray(r))return [];
    if(r.region!==a.examination.option.region || r.tool!==a.examination.option.tool
      || (r.status==="AVAILABLE" && JSON.stringify(r.findings)!==JSON.stringify(a.examination.findings)))return [];
    return [{session_id:s.session_id,case_version_id:s.pinned_case.case_version_id,case_version:s.pinned_case.case_version,event_id:e.event_id,sequence_no:e.sequence_no,clinical_time:e.clinical_time,action_id:e.action_id,region:r.region,tool:r.tool,status:r.status==='CURRENT_STATE_NOT_AUTHORED'?'FINDING_NOT_AVAILABLE_FOR_CURRENT_STATE':r.status,findings:r.findings}];
  }).slice(-256);
  return SafeExaminationProjectionSchema.parse({contract_version:"1.0.0",options:actions.map(a=>a.examination!.option),receipts});
}
