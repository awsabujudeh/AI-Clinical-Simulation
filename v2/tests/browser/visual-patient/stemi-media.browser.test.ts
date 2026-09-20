import { it, expect } from "vitest";
import manifest from "../../../content/media/stemi/manifest.json";
import { MediaAssetDefinitionSchema } from "../../../packages/case-schema/src/index.ts";
import { prepareStemiConversationArtifact } from "../../../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import { resolvePatientStaticFallback } from "../../../apps/web/src/features/visual-patient/static-fallback.ts";

const patient = { presentation_schema_version: "1.0", asset_id: "stemi.physical-exam-v02",
  position: "semi_fowler", face: "pain", body: "pain_body", breathing: true, blink: true, hand: true, living: true };

it("fallback is failure-only and never invents a presentation for absent/unsupported state", () => {
  for (const status of ["IDLE", "LOADING", "READY"]) expect(resolvePatientStaticFallback(patient, status)).toBeUndefined();
  expect(resolvePatientStaticFallback(undefined, "FAILED")).toBeUndefined();
  expect(resolvePatientStaticFallback({ ...patient, asset_id: "other" }, "FAILED")).toBeUndefined();
  expect(resolvePatientStaticFallback({ ...patient, face: "relieved" }, "FAILED")).toBeUndefined();
  const before = JSON.stringify(patient);
  expect(resolvePatientStaticFallback(patient, "FAILED")?.path).toBe(manifest.patient_fallback.variants[0]!.path);
  expect(resolvePatientStaticFallback({ ...patient, position: "supine" }, "FAILED")?.path).toBe(manifest.patient_fallback.variants[1]!.path);
  expect(JSON.stringify(patient)).toBe(before);
});

it("inventory reuses exact Case MediaAsset identities/report/fallback references without granting diagnostic approval", async () => {
  const artifact = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
  expect(artifact.review_execution_hash).toBe(manifest.case_association.review_execution_hash);
  expect(artifact.source_case.manifest.case_version).toBe(manifest.case_association.case_version);
  expect(artifact.source_case.manifest.case_package_id).toBe(manifest.case_association.case_package_id);
  const assets = artifact.source_case.visual_manifest.media_assets;
  for (const entry of [manifest.patient_fallback, ...manifest.diagnostics]) {
    expect(MediaAssetDefinitionSchema.safeParse(entry.definition).success).toBe(true);
    expect(assets.find(a => a.media_asset_id === entry.definition.media_asset_id)).toMatchObject(entry.definition);
    expect(entry.rights_status).toBeTruthy(); expect(entry.clinical_review_status).toMatch(/^PENDING_/);
  }
  for (const media of manifest.diagnostics) {
    const action = artifact.source_case.action_catalogue.actions.find(a => a.action_id === media.action_id)!;
    const result = action.investigation?.result;
    if (!result || (result.result_type !== "ECG" && result.result_type !== "IMAGING" && result.result_type !== "ULTRASOUND")) throw Error("Expected existing diagnostic media result");
    expect(result.asset_references).toContainEqual(expect.objectContaining({ media_asset_id: media.definition.media_asset_id }));
    expect(result.diagnostic_result_id).toBe(media.diagnostic_result_id);
    expect(result.formal_report_key).toBe(media.formal_report_key);
    expect(result.fallback_fact_ids).toEqual(media.fallback_fact_ids);
    expect(media.clinical_review_status).toBe("PENDING_PHYSICIAN_REVIEW");
    expect(media.expo_status).toBe(media.packaged ? "REVIEW_ONLY" : "MEDIA_ASSET_PENDING");
  }
});
