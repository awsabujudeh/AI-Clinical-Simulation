import { VisualPatientPresentationSchema, type VisualPatientPresentation } from "../../../contracts/src/index.ts";
import type { InMemorySessionAggregate } from "../../../session-engine/src/index.ts";

/** Presentation-only asset binding to the exact reviewed case, never a clinical policy. */
export function projectVisualPatient(session: InMemorySessionAggregate): VisualPatientPresentation | undefined {
  const pin = session.pinned_case;
  if (pin.execution_authority !== "REVIEW_ONLY") return undefined;
  const approvedBindings = [
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
    breathing: true, blink: true, hand: true, living: true
  });
}
