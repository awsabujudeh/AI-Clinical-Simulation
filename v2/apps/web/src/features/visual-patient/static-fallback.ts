import { VisualPatientPresentationSchema } from "@ai-clinical-simulation/contracts";
import manifest from "../../../../../content/media/stemi/manifest.json";

/** Presentation-only resolution after failure; never supplies clinical truth. */
export function resolvePatientStaticFallback(presentation: unknown, status: string) {
  const parsed = VisualPatientPresentationSchema.safeParse(presentation);
  if (status !== "FAILED" || !parsed.success
    || parsed.data.asset_id !== manifest.runtime_package.presentation_asset_id) return undefined;
  return manifest.patient_fallback.variants.find(v =>
    v.position === parsed.data.position && v.face === parsed.data.face);
}
