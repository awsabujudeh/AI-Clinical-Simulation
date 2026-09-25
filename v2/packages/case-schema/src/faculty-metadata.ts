import { z } from "zod";
import { PatientLanguageSchema, ExecutionAuthoritySchema, OwnerAttestedMedicalReviewSchema } from "../../contracts/src/index.ts";
import { CaseManifestSchema, ClassificationModuleSchema, LocalizedEntrySchema,
  CurriculumMappingsModuleSchema, CaseSourceReferenceSchema } from "./schemas.ts";

// Metadata-only authoring surface, not another executable Case Package. Existing
// classification/localization/identity contracts remain the source of truth.
const Text = LocalizedEntrySchema.shape.translations.element.shape.text;
export const FacultyDraftMetadataSchema = z.strictObject({
  title: Text.max(160), specialty: ClassificationModuleSchema.shape.specialty_codes.element,
  difficulty: ClassificationModuleSchema.shape.difficulty_code,
  language: PatientLanguageSchema, description: Text.max(1000)
});
export type FacultyDraftMetadata = z.infer<typeof FacultyDraftMetadataSchema>;
export const FacultyCaseViewSchema = z.strictObject({
  identity: CaseManifestSchema.pick({ case_id: true, case_version_id: true, case_package_id: true, case_version: true, status: true }),
  metadata: FacultyDraftMetadataSchema,
  revision: z.number().int().nonnegative(),
  metadata_shell: z.boolean(),
  execution_authority: ExecutionAuthoritySchema.nullable(),
  medical_approval: OwnerAttestedMedicalReviewSchema.optional(),
  overview: Text,
  competencies: z.array(z.string()),
  curriculum: CurriculumMappingsModuleSchema.nullable(),
  critical_actions: z.array(z.string()),
  sources: z.array(CaseSourceReferenceSchema),
  media_status: z.array(z.string())
});
export type FacultyCaseView = z.infer<typeof FacultyCaseViewSchema>;
export const FacultyDraftUpdateSchema = z.strictObject({
  expected_revision: z.number().int().nonnegative(), metadata: FacultyDraftMetadataSchema
});
