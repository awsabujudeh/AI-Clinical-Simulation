import { FacultyCaseViewSchema, FacultyDraftMetadataSchema, FacultyDraftUpdateSchema,
  type FacultyCaseView } from "../packages/case-schema/src/faculty-metadata.ts";
import type { AuthorizedMembership } from "../packages/api-core/src/authorization/api-authority.ts";
import type { ReviewExecutionArtifact } from "../packages/case-schema/src/index.ts";
import media from "../content/media/stemi/manifest.json" with { type: "json" };
import { EXPO_MEDICAL_APPROVAL_BINDINGS } from "../content/cases/shared-catalogue/approved-expo-cases.ts";

/** Current medically approved catalogues; historical STEMI projection below is
 * deliberately retained for historical hosts/tests and pinned review Sessions. */
export function projectFacultyExpo(artifact: ReviewExecutionArtifact): FacultyCaseView {
  const c=artifact.source_case, b=Object.values(EXPO_MEDICAL_APPROVAL_BINDINGS).find(b=>b.execution===artifact.review_execution_hash);
  if (artifact.execution_authority!=="APPROVED_EXPO" || !artifact.medical_approval || !b) throw Error("EXPO_APPROVAL_REQUIRED");
  const label=(key:string)=>c.localization.entries.find(e=>e.key===key)?.translations.find(t=>t.locale==="en-US")?.text??key;
  return FacultyCaseViewSchema.parse({
    identity:{case_id:c.manifest.case_id,case_version_id:c.manifest.case_version_id,case_package_id:c.manifest.case_package_id,case_version:c.manifest.case_version,status:c.manifest.status},
    metadata:{title:b.id.startsWith("stemi")?"Khalid / STEMI":"Dana / Anaphylaxis",specialty:c.classification.specialty_codes[0],difficulty:c.classification.difficulty_code,
      language:c.patient_profile.default_language,description:label(c.presentation.triage_summary_key)},
    revision:0,metadata_shell:false,execution_authority:artifact.execution_authority,medical_approval:artifact.medical_approval,
    overview:label(c.presentation.triage_summary_key),competencies:[...new Set(c.curriculum_mappings.mappings.map(m=>m.competency_code))],curriculum:c.curriculum_mappings,
    critical_actions:c.assessment_rubric.critical_items.filter(i=>i.kind==="CRITICAL_ACTION").map(i=>i.evidence.action_ids.map(id=>c.action_catalogue.actions.find(a=>a.action_id===id)?.aliases.find(a=>a.locale==="en-US")?.phrases[0]??id).join(" / ")),
    sources:c.validation.sources,media_status:["Clinical interpretations/reports: APPROVED_FOR_EXPO (owner-attested).",
      "Diagnostic images withheld: rights/matching/asset availability remain separate. Authoritative text remains available.",
      "Khalid legacy 84-bpm ECG is not reintroduced. Production publication: PENDING."]});
}

export function projectFacultyStemi(artifact: ReviewExecutionArtifact): FacultyCaseView {
  const c = artifact.source_case;
  if (c.manifest.case_package_id !== media.case_association.case_package_id
    || artifact.review_execution_hash !== media.case_association.review_execution_hash) throw Error("MEDIA_CASE_MISMATCH");
  const label = (key: string) => c.localization.entries.find(e => e.key === key)?.translations.find(t => t.locale === "en-US")?.text ?? key;
  return FacultyCaseViewSchema.parse({
    identity: { case_id: c.manifest.case_id, case_version_id: c.manifest.case_version_id,
      case_package_id: c.manifest.case_package_id, case_version: c.manifest.case_version, status: c.manifest.status },
    metadata: { title: label("case.stemi.title-internal"), specialty: c.classification.specialty_codes[0],
      difficulty: c.classification.difficulty_code, language: c.patient_profile.default_language,
      description: label(c.presentation.triage_summary_key) },
    revision: 0, metadata_shell: false, execution_authority: "REVIEW_ONLY",
    overview: label(c.presentation.triage_summary_key),
    competencies: [...new Set(c.curriculum_mappings.mappings.map(m => m.competency_code))],
    curriculum: c.curriculum_mappings,
    critical_actions: c.assessment_rubric.critical_items.filter(i => i.kind === "CRITICAL_ACTION").map(i =>
      i.evidence.action_ids.map(id => c.action_catalogue.actions.find(a => a.action_id === id)?.aliases.find(a => a.locale === "en-US")?.phrases[0] ?? id).join(" / ")),
    sources: c.validation.sources,
    media_status: [ `Visual Patient: ${media.runtime_package.expo_status}; static fallback: ${media.patient_fallback.expo_status}`,
      ...media.diagnostics.map(m => `${m.modality}: ${m.expo_status} / ${m.clinical_review_status} / ${m.rights_status}${"review_note" in m ? ` — ${m.review_note}` : ""}`) ]
  });
}

type Result<T> = { success: true; data: T } | { success: false; code: "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "READ_ONLY" | "VERSION_CONFLICT" | "CAPACITY" };
/** Explicit localhost demo store. No production persistence or publication API. */
export function createFacultyDemoStore(seed: FacultyCaseView | FacultyCaseView[], institutionId: string) {
  const records = new Map<string, FacultyCaseView>((Array.isArray(seed)?seed:[seed]).map(s=>[s.identity.case_id, FacultyCaseViewSchema.parse(s)]));
  let sequence = 0;
  const allowed = (member: AuthorizedMembership | null) => member?.institution_id === institutionId && member.role === "FACULTY";
  const clone = (v: FacultyCaseView) => FacultyCaseViewSchema.parse(v);
  return {
    list(member: AuthorizedMembership | null): Result<FacultyCaseView[]> {
      return allowed(member) ? { success: true, data: [...records.values()].map(clone) } : { success: false, code: "FORBIDDEN" };
    },
    create(member: AuthorizedMembership | null, input: unknown): Result<FacultyCaseView> {
      if (!allowed(member)) return { success: false, code: "FORBIDDEN" };
      const parsed = FacultyDraftMetadataSchema.safeParse(input);
      if (!parsed.success) return { success: false, code: "INVALID" };
      if (records.size >= 100) return { success: false, code: "CAPACITY" };
      const n = sequence + 1;
      const draft = FacultyCaseViewSchema.parse({ identity: { case_id: `case.faculty-demo.${n}`, case_version_id: `case-version.faculty-demo.${n}`,
        case_package_id: `case-package.faculty-demo.${n}`, case_version: "0.1.0", status: "DRAFT" }, metadata: parsed.data,
        revision: 0, metadata_shell: true, execution_authority: null,
        overview: "Metadata shell only. No patient truth, rules, rubric or executable Case Package has been authored.",
        competencies: [], curriculum: null, critical_actions: [], sources: [], media_status: [] });
      sequence = n; records.set(draft.identity.case_id, draft);
      return { success: true, data: clone(draft) };
    },
    update(member: AuthorizedMembership | null, id: string, input: unknown): Result<FacultyCaseView> {
      if (!allowed(member)) return { success: false, code: "FORBIDDEN" };
      const parsed = FacultyDraftUpdateSchema.safeParse(input);
      if (!parsed.success) return { success: false, code: "INVALID" };
      const current = records.get(id);
      if (!current) return { success: false, code: "NOT_FOUND" };
      if (!current.metadata_shell || current.identity.status !== "DRAFT") return { success: false, code: "READ_ONLY" };
      if (current.revision !== parsed.data.expected_revision) return { success: false, code: "VERSION_CONFLICT" };
      const next = clone({ ...current, metadata: parsed.data.metadata, revision: current.revision + 1 });
      records.set(id, next); return { success: true, data: clone(next) };
    }
  };
}
