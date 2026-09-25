import { prepareStemiConversationArtifact } from "../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { prepareDanaReview } from "../content/cases/anaphylaxis/dana-case.ts";
import stemiMedia from "../content/media/stemi/manifest.json" with { type: "json" };
import danaMedia from "../content/media/dana/manifest.json" with { type: "json" };
import { initializeReviewInMemorySession, projectAssessmentEvidenceFromSession } from "../packages/session-engine/src/index.ts";
import { evaluateReviewAssessment } from "../packages/assessment-engine/src/index.ts";
import { buildPatientConversationContext } from "../packages/patient-conversation/src/index.ts";
import { projectVisualPatient } from "../packages/api-core/src/service/visual-patient-projection.ts";
import { evaluatePinnedClinicalPolicy } from "../packages/clinical-engine/src/index.ts";
import { buildTutorEvidence, generateTutorDebrief } from "../packages/ai-gateway/src/index.ts";
import { createStemiKnowledgeRetrieval } from "../content/knowledge/stemi/index.ts";
import { STEMI_KNOWLEDGE_REGISTRY, STEMI_APPROVED_KNOWLEDGE_DOCUMENTS } from "../content/knowledge/stemi/registry.ts";
import { createFacultyDemoStore, projectFacultyStemi } from "./v2-025-faculty-store.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "../tests/fixtures/portable-sha256.ts";
import type { ReviewExecutionArtifact } from "../packages/case-schema/src/index.ts";
import type { Check } from "./preflight-model.ts";
import { TutorOutputLocaleSchema } from "../packages/contracts/src/index.ts";
import { FacultyDraftMetadataSchema } from "../packages/case-schema/src/faculty-metadata.ts";
import { prepareApprovedExpoCase, EXPO_MEDICAL_APPROVAL_BINDINGS } from "../content/cases/shared-catalogue/approved-expo-cases.ts";
import { verifyExpoExecution } from "../packages/case-schema/src/index.ts";
import { projectFacultyExpo } from "./v2-025-faculty-store.ts";

/** Fresh isolated immutable initial aggregates only; no repository, owner Session,
 * provider, time advancement or action submission dependency is accepted. */
export async function inspectReviewCase(name: "stemi" | "dana", artifact: ReviewExecutionArtifact) {
  const c = artifact.source_case;
  const expected = name === "stemi" ? stemiMedia.case_association : danaMedia;
  if (artifact.execution_authority === "APPROVED_EXPO") {
    if (artifact.review_execution_hash !== EXPO_MEDICAL_APPROVAL_BINDINGS[name === "stemi" ? "khalid" : "dana"].execution
      || !await verifyExpoExecution(artifact,hash)) throw Error("EXPO_MEDICAL_APPROVAL_INVALID");
  } else if (c.manifest.status !== "UNDER_REVIEW" || artifact.execution_authority !== "REVIEW_ONLY"
    || c.manifest.case_package_id !== expected.case_package_id || c.manifest.case_version_id !== expected.case_version_id
    || c.manifest.case_version !== (name === "stemi" ? "2.0.1" : "1.0.0")
    || artifact.review_execution_hash !== expected.review_execution_hash) throw Error("CASE_HASH_MISMATCH");
  const media = name === "stemi" ? stemiMedia.diagnostics : danaMedia.diagnostics;
  if (!media.every(m => c.action_catalogue.actions.some(a => a.action_id === m.action_id
    && a.investigation?.result.diagnostic_result_id === m.diagnostic_result_id))) throw Error("DIAGNOSTIC_BINDING_INVALID");
  const initial = initializeReviewInMemorySession({ session_id: `session.preflight.${name}`, mode: "PRACTICE_DEMO",
    review_execution_artifact: artifact, trusted_real_time_anchor_utc: "2026-09-06T10:00:00Z" });
  if (!initial.success) throw Error("SESSION_FOUNDATION_UNAVAILABLE");
  const s = initial.session;
  const before = JSON.stringify(s);
  const engine = evaluatePinnedClinicalPolicy({ operation: "PROCESS_DUE", policy: s.pinned_case.clinical_policy,
    state: s.patient_state, scheduler_state: s.scheduler_state, prior_event_facts: [], target_clinical_time: s.patient_state.clinical_time });
  if (!engine.success) throw Error("CLINICAL_ENGINE_UNAVAILABLE");
  const visual = projectVisualPatient(s);
  if (visual?.asset_id !== (name === "stemi" ? stemiMedia.runtime_package.presentation_asset_id : danaMedia.presentation_asset_id))
    throw Error("VISUAL_CASE_BINDING_INVALID");
  const context = buildPatientConversationContext({ case_package: c, patient_state: s.patient_state, locale: "ar-JO", history: [] });
  const patient = context.success && context.context.facts.length > 0
    && context.context.facts.every(f => f.fact_id.startsWith(`fact.${name}.`));
  const evidence = projectAssessmentEvidenceFromSession(s);
  if (!evidence.success) throw Error("ASSESSMENT_UNAVAILABLE");
  const result = evaluateReviewAssessment({ evaluation_schema_version: "1.0", execution_authority: artifact.execution_authority,
    evaluation_phase: "LIVE", assessment_id: `assessment.preflight.${name}`, review_execution_artifact: artifact, session_evidence: evidence.evidence });
  if (!result.success || result.result.domain_scores.length !== 6) throw Error("ASSESSMENT_UNAVAILABLE");
  if (artifact.execution_authority === "REVIEW_ONLY") {
  const packet = buildTutorEvidence({ artifact, assessment: result.result, locale: TutorOutputLocaleSchema.parse("ar-JO"), institution_id: "institution.preflight" });
  if (!packet) throw Error("TUTOR_EVIDENCE_UNAVAILABLE");
  const fallback = await generateTutorDebrief({ packet, hash, request_id: "request.preflight", correlation_id: "correlation.preflight" });
  if (fallback.tutor_status !== "TEMPLATE_FALLBACK" || fallback.plan.evidence_chunk_ids.length
    || JSON.stringify(fallback.packet.assessment) !== JSON.stringify(result.result) || JSON.stringify(s) !== before)
    throw Error("ASSESSMENT_IMMUTABILITY_FAILED");
  }
  if (JSON.stringify(s)!==before) throw Error("ASSESSMENT_IMMUTABILITY_FAILED");
  return { patient, unchanged: true, version: c.manifest.case_version };
}

export async function inspectDomain(): Promise<Check[]> {
  const rows: Check[] = [];
  let stemi: ReviewExecutionArtifact | undefined;
  for (const name of ["stemi", "dana"] as const) {
    try {
      let artifact: ReviewExecutionArtifact;
      artifact = await prepareApprovedExpoCase(name === "stemi" ? "khalid" : "dana",hash);
      if (name === "stemi") stemi=artifact;
      const result = await inspectReviewCase(name, artifact);
      rows.push({ id: name, status: "READY", code: "EXPO_MEDICAL_APPROVAL_VALID", detail: `${name === "stemi" ? "Khalid / STEMI" : "Dana / Anaphylaxis"} ${result.version}: exact hash, Session and six-domain assessment validated. Medical review COMPLETE via owner attestation. APPROVED_EXPO; production publication PENDING. Physician identity/time not formally recorded.` });
      rows.push({ id: `patient_${name}`, status: result.patient ? "READY" : "BLOCKED", code: result.patient ? "PATIENT_CONTEXT_ISOLATED" : "PATIENT_CONTEXT_INVALID",
        detail: "Structural ar-JO patient context only; own-case allowlisted facts, no live AI call. Network required for AI dialogue." });
    } catch {
      rows.push({ id: name, status: "BLOCKED", code: "CASE_VALIDATION_OR_HASH_FAILED", detail: "Review artifact, pinned version, Session or evidence validation failed. Check the focused case gate; no clinical data displayed." });
      rows.push({ id: `patient_${name}`, status: "BLOCKED", code: "PATIENT_CONTEXT_UNAVAILABLE", detail: "Own-case context could not be proven; do not run this patient demo." });
    }
  }
  const valid = rows.filter(r => r.id === "stemi" || r.id === "dana").every(r => r.status === "READY");
  rows.push({ id: "clinical", status: valid ? "READY" : "BLOCKED", code: valid ? "LOCAL_ENGINE_FOUNDATION_READY" : "CLINICAL_FOUNDATION_UNAVAILABLE",
    detail: "Case validation and pinned Session initialization use the existing deterministic engines. No AI owns truth. Operator checks never administer actions or advance a demo Session." });
  rows.push({ id: "assessment", status: valid ? "READY" : "BLOCKED", code: valid ? "ASSESSMENT_AND_TUTOR_FALLBACK_READY" : "ASSESSMENT_UNAVAILABLE",
    detail: "Both six-domain deterministic assessments evaluated without mutating Sessions. Approved Expo finalization is distinct from production publication. No provider call or invented citation; post-finalization Tutor fallback verified by focused tests." });
  try {
    const service = await createStemiKnowledgeRetrieval(hash);
    if (!service.success || STEMI_KNOWLEDGE_REGISTRY.sources.length !== 8 || STEMI_APPROVED_KNOWLEDGE_DOCUMENTS.length !== 0) throw Error();
    const result = await service.retrieve({ case_version_id: stemiMedia.case_association.case_version_id, topic_code: "stemi.action-reasoning",
      locale: "ar-JO", source_types: ["CLINICAL_GUIDELINE"], as_of: "2026-09-24T00:00:00Z", limit: 3 });
    if (result.clinical_evidence.length || result.curriculum_evidence.length) throw Error();
    rows.push({ id: "knowledge", status: "READY", code: "RAG_FOUNDATION_SOURCE_PENDING", detail: "Registry/hash/retrieval foundation verified; 8 registered sources, 0 trusted real documents. No approved JU/JUST alignment. Not a ready clinical corpus." });
  } catch { rows.push({ id: "knowledge", status: "DEGRADED", code: "RETRIEVAL_UNAVAILABLE", detail: "Educational retrieval unavailable. Deterministic Case/Assessment feedback remains; no citation substitution." }); }
  try {
    if (!stemi) throw Error();
    const store = createFacultyDemoStore(projectFacultyExpo(stemi), "institution.preflight");
    const member = { membership_id: "membership.preflight", institution_id: "institution.preflight", role: "FACULTY" } as const;
    const listed = store.list(member);
    if (!listed.success || listed.data[0]?.execution_authority !== "APPROVED_EXPO" || store.list({ ...member, role: "LEARNER" }).success) throw Error();
    if (!FacultyDraftMetadataSchema.safeParse(listed.data[0].metadata).success
      || Object.keys(store).some(k => !["list", "create", "update"].includes(k))) throw Error();
    rows.push({ id: "faculty", status: "READY", code: "FACULTY_MEMORY_DEMO_READY", detail: "Catalogue/details and metadata-only DRAFT contract available. SERVER-MEMORY DEMO: refresh survives, host restart clears drafts. No review/publish endpoint. Host availability is checked separately." });
  } catch { rows.push({ id: "faculty", status: "BLOCKED", code: "FACULTY_FOUNDATION_UNAVAILABLE", detail: "Local Faculty catalogue/authorization could not be verified." }); }
  return rows;
}
