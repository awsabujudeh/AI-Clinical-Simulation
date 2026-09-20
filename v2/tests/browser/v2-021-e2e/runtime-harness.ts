import { createPatientRuntime, type PatientRuntime } from "../../../apps/web/src/features/visual-patient/runtime/runtime.js";
import { VisualPatientPresentationSchema } from "../../../packages/contracts/src/index.ts";
const presentation = VisualPatientPresentationSchema.parse({ presentation_schema_version: "1.0", asset_id: "stemi.physical-exam-v02", position: "semi_fowler", face: "pain", body: "pain_body", breathing: true, blink: true, hand: true, living: true });
declare global { interface Window { __VISUAL_CONTRACT__: { runtime: PatientRuntime; presentation: typeof presentation; ready: boolean; failed: boolean; requests: unknown[] } } }
const state = { presentation, ready: false, failed: false, requests: [] as unknown[], runtime: undefined as unknown as PatientRuntime };
window.__VISUAL_CONTRACT__ = state;
state.runtime = createPatientRuntime(document.querySelector("canvas")!, document.getElementById("view")!, {
  onReady() { state.runtime.setPresentation(presentation); state.ready = true; },
  onError() { state.failed = true; }, onExamRequest(r) { state.requests.push(r); }
});
