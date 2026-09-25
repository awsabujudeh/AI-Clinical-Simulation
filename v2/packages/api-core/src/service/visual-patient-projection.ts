import { VisualPatientPresentationSchema, type VisualPatientPresentation } from "../../../contracts/src/index.ts";
import type { InMemorySessionAggregate } from "../../../session-engine/src/index.ts";

/** Display bindings for the exact Case versions checked below. Never intent,
 * physiological inference, or a second procedure execution authority. */
function equipment(session: InMemorySessionAggregate, bindings: { bp: readonly string[]; iv: readonly string[]; infusion: readonly string[] }) {
  const executed = session.committed_events.filter(e => {
    const p = e.payload;
    return e.status === "COMMITTED" && e.actor_type === "LEARNER" && e.session_id === session.session_id
      && p !== null && typeof p === "object" && !Array.isArray(p)
      && p.execution_status === "EXECUTED" && p.catalogue_membership === "VERIFIED"
      && session.pinned_case.action_catalogue.some(a => a.action_id === e.action_id && a.execution_event_type === e.event_type);
  });
  const access = executed.find(e => bindings.iv.includes(e.action_id ?? ""));
  const acquired=(channel:string)=>executed.some(e=>{
    const p=session.pinned_case.action_catalogue.find(a=>a.action_id===e.action_id)?.observation_acquisition;
    return p&&[...p.channels,...(p.sample_channels??[])].some(c=>c===channel);
  });
  return { bp_cuff: acquired("BP") || executed.some(e => bindings.bp.includes(e.action_id ?? "")), iv_access: !!access,
    ...(session.pinned_case.action_catalogue.some(a=>a.observation_acquisition) ? {pulse_ox:acquired("SPO2")?"APPLIED_VISUAL_PENDING":"ABSENT"} : {}),
    iv_tubing: !!access && executed.some(e => e.sequence_no > access.sequence_no && bindings.infusion.includes(e.action_id ?? "")) };
}

/** Presentation-only asset binding to the exact reviewed case, never a clinical policy. */
export function projectVisualPatient(session: InMemorySessionAggregate): VisualPatientPresentation | undefined {
  const pin = session.pinned_case;
  if (pin.execution_authority !== "REVIEW_ONLY") return undefined;
  if ((pin.case_package_id === "case-package.anaphylaxis.dana.001"
    && pin.case_version_id === "case-version.anaphylaxis.dana.001" && pin.case_version === "1.0.0"
    && pin.review_execution_hash === "caab9211b2277341226e652e69b78a2fe2b6f7d11e8237ed5645f5e34ba90b8c")
    || (pin.case_package_id==="case-package.anaphylaxis.dana.002" && pin.case_version_id==="case-version.anaphylaxis.dana.002" && pin.case_version==="1.1.0"
      && pin.review_execution_hash==="46febaff5a13cdd8565922f3c65a48edd14a9ca1cd4b3d748996cb55a865eb2d")) {
    const s = session.patient_state;
    if (s.consciousness !== "consciousness.alert" || !["phase.dana.active", "phase.dana.stabilized"].includes(s.clinical_phase)) return undefined;
    const improved = s.outcome_flags.some(flag => flag === "outcome.dana.improved");
    return VisualPatientPresentationSchema.parse({ presentation_schema_version: "1.0", asset_id: "dana.review-v01",
      position: "semi_fowler", face: improved ? "relieved" : "anxious", body: improved ? "calm_body" : "itch_body",
      breathing: true, blink: true, hand: !improved, living: true,
      equipment: equipment(session, {bp:["procedure.dana.monitor"],iv:["procedure.dana.iv-access"],infusion:["procedure.dana.crystalloid-500"]}) });
  }
  const approvedBindings = [
    ["case-package.stemi.inferior-rv.003", "case-version.stemi.inferior-rv.003", "2.1.0", "245d740fc945e684def834c5ec2e469170d3b3b6d7dbf176f341939e1010afa8"],
    ["case-package.stemi.inferior-rv.001", "case-version.stemi.inferior-rv.001", "2.0.0", "a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7"],
    ["case-package.stemi.inferior-rv.002", "case-version.stemi.inferior-rv.002", "2.0.1", "90b8bfa625ff217edaefd2f235deacf396f9a9d8af86268c0acf411f939046f1"]
  ];
  if (!approvedBindings.some(([packageId, versionId, version, hash]) =>
    pin.case_package_id === packageId && pin.case_version_id === versionId
    && pin.case_version === version && pin.review_execution_hash === hash)) return undefined;
  const state = session.patient_state;
  // Approved alert, active-pain presentation only. No HR/BP thresholds, diagnosis
  // inference, or invented relief. Unsupported presentations use the UI fallback.
  const supported = new Set([
    "hemodynamics.stemi-baseline-hypotension",
    "hemodynamics.stemi-modestly-supported"
  ]);
  if (state.consciousness !== "consciousness.gcs-15"
    || state.pain_state.trend !== "trend.persistent"
    || !supported.has(state.hemodynamic_state)) return undefined;
  return VisualPatientPresentationSchema.parse({
    presentation_schema_version: "1.0", asset_id: "stemi.physical-exam-v02",
    position: "semi_fowler", face: "pain", body: "pain_body",
    breathing: true, blink: true, hand: true, living: true,
    equipment: equipment(session, {bp:["examination.hemodynamic-perfusion","examination.hemodynamic-reassessment"],iv:["procedure.peripheral-iv"],infusion:["procedure.normal-saline-250","medication.ufh-70-units-kg"]})
  });
}
