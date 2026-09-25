import type { InMemorySessionAggregate } from "../../../session-engine/src/index.ts";
import { SafeInvestigationStatusSchema } from "../../../contracts/src/index.ts";

/** Catalogue vocabulary + committed receipts only. Never returns findings/values/flags. */
export function investigationStatuses(session:InMemorySessionAggregate) {
  const shared=session.pinned_case.shared_catalogue;
  if(!shared || !session.pinned_case.action_catalogue.some(a=>a.investigation?.authoring)) return undefined;
  const searched=(shared.search_only?.actions??[]).filter(a=>{
    const id=shared.search_only!.bindings.find(b=>b.concept_id===a.action_id)?.case_action_id;
    return session.committed_events.some(e=>e.status==="COMMITTED" && e.session_id===session.session_id && e.clinical_time<=session.patient_state.clinical_time && e.action_id===id && e.event_type==="INVESTIGATION_ORDERED");
  });
  return [...shared.catalogue.actions,...searched].filter(a=>a.action_type==="INVESTIGATION").map(concept=>{
    const binding=[...shared.bindings,...(shared.search_only?.bindings??[])].find(b=>b.concept_id===concept.action_id)!;
    const action=session.pinned_case.action_catalogue.find(a=>a.action_id===binding.case_action_id)!;
    const inv=action.investigation!;
    const events=session.committed_events.filter(e=>e.status==="COMMITTED" && e.session_id===session.session_id && e.action_id===action.action_id && e.clinical_time<=session.patient_state.clinical_time);
    const order=events.find(e=>e.event_type==="INVESTIGATION_ORDERED");
    const available=events.some(e=>e.event_type==="INVESTIGATION_RESULT_AVAILABLE");
    const delay=inv.milestones.find(m=>m.milestone_type==="RESULT_AVAILABLE")!.offset_clinical_seconds;
    return SafeInvestigationStatusSchema.parse({action_id:concept.action_id,diagnostic_result_id:inv.result.diagnostic_result_id,
      labels:concept.labels.map(l=>({locale:l.locale,text:l.label})),
      status:!order?"NOT_ORDERED":available?"AVAILABLE":session.patient_state.clinical_time===order.clinical_time?"ORDERED":"PENDING",
      ...(order?{ordered_at:order.clinical_time,available_at:order.clinical_time+delay,
        collection_at:inv.authoring?.sample_context==="BASELINE_CASE_SAMPLE"?0:order.clinical_time,
        sample_context:inv.authoring?.sample_context??"AT_ORDER_STUDY"}:{}),
    });
  });
}
