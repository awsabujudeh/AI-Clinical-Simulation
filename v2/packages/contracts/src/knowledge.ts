import { z } from "zod";
import { CaseVersionIdSchema, CurriculumObjectiveIdSchema, SourceIdSchema, SourceVersionIdSchema, Sha256DigestSchema } from "./ids.ts";
import { InstitutionMetadataSchema, EXPO_INSTITUTIONS } from "./institutions.ts";
import { AuthoredLocaleSchema } from "./locales.ts";
import { RealUtcTimeSchema } from "./events.ts";

export const KnowledgeLayerSchema = z.enum(["CURRICULUM", "CLINICAL_GUIDELINE", "SIMULATION_RUBRIC", "CASE_GROUND_TRUTH"]);
const Code = z.string().min(1).max(160).regex(/^[a-z0-9][a-z0-9._-]*$/u);
export const KnowledgeCurriculumContextSchema = z.strictObject({
  institution: InstitutionMetadataSchema,
  program_code: Code.nullable(), course_code: Code.nullable(), academic_year: z.number().int().min(1).max(12).nullable()
});
const Approval = z.strictObject({
  reviewer_ref: z.string().min(1).max(160), approval_ref: z.string().min(1).max(500),
  approved_at: RealUtcTimeSchema, approved_content_hash: Sha256DigestSchema,
  scope: z.literal("EDUCATIONAL_RETRIEVAL"), clinical_review: z.boolean()
});

/** Trusted admin registry data, never accepted from a learner request. */
export const KnowledgeSourceSchema = z.strictObject({
  source_id: SourceIdSchema, source_version_id: SourceVersionIdSchema,
  title: z.string().min(1).max(500), source_type: KnowledgeLayerSchema,
  publisher: z.string().min(1).max(300), document_version: z.string().min(1).max(100),
  location: z.string().min(1).max(1000), language: AuthoredLocaleSchema,
  provenance: z.string().min(1).max(1000),
  scope: z.strictObject({ case_version_ids: z.array(CaseVersionIdSchema).min(1).max(32), topic_codes: z.array(Code).min(1).max(64) }),
  visibility: z.enum(["GLOBAL", "INSTITUTION"]), curriculum: KnowledgeCurriculumContextSchema.nullable(),
  objective_id: z.union([CurriculumObjectiveIdSchema,z.literal("UNKNOWN_PENDING_SOURCE_REVIEW")]).nullable(),
  rights_status: z.enum(["APPROVED", "UNRESOLVED"]), rights_reference: z.string().min(1).max(1000).nullable(),
  access_status: z.enum(["LOCAL_AVAILABLE", "SOURCE_PENDING", "STRUCTURED_CASE_ONLY"]),
  ingestion_status: z.enum(["READY", "SOURCE_PENDING", "REVIEW_PENDING", "DIRECT_LOOKUP_ONLY"]),
  review_status: z.enum(["APPROVED", "UNRESOLVED", "REJECTED"]), approval: Approval.nullable(),
  lifecycle: z.enum(["ACTIVE", "DRAFT", "SUPERSEDED", "RETIRED"]),
  effective_from: RealUtcTimeSchema.nullable(), effective_to: RealUtcTimeSchema.nullable(),
  retrieval_eligible: z.boolean(), content_hash: Sha256DigestSchema.nullable()
}).superRefine((s,ctx)=>{
  const fail=(message:string)=>ctx.addIssue({code:"custom",message});
  const direct=s.source_type==="CASE_GROUND_TRUTH"||s.source_type==="SIMULATION_RUBRIC";
  if(direct && (s.retrieval_eligible || s.ingestion_status!=="DIRECT_LOOKUP_ONLY")) fail("Structured Case layers cannot enter retrieval");
  if(s.source_type==="CURRICULUM" && (!s.curriculum || s.visibility!=="INSTITUTION" || !s.objective_id)) fail("Curriculum needs exact institution/level/objective metadata");
  if(s.source_type!=="CURRICULUM" && (s.curriculum!==null || s.objective_id!==null || s.visibility!=="GLOBAL")) fail("Non-curriculum foundation sources must be global and separate");
  if(s.curriculum){const i=s.curriculum.institution;const known=EXPO_INSTITUTIONS.find(k=>k.institution_id===i.institution_id);
    if(known && (i.institution_code!==known.institution_code || i.institution_name!==known.institution_name)) fail("Institution metadata mismatch");}
  if(s.effective_from && s.effective_to && knowledgeTimeKey(s.effective_to)<=knowledgeTimeKey(s.effective_from)) fail("Invalid effective interval");
  if(s.retrieval_eligible && (s.review_status!=="APPROVED" || s.rights_status!=="APPROVED" || !s.rights_reference ||
    !s.approval || !s.content_hash || s.approval.approved_content_hash!==s.content_hash || s.lifecycle!=="ACTIVE" ||
    !s.effective_from || s.ingestion_status!=="READY" || s.access_status!=="LOCAL_AVAILABLE" ||
    (s.source_type==="CLINICAL_GUIDELINE" && !s.approval.clinical_review) || s.objective_id==="UNKNOWN_PENDING_SOURCE_REVIEW" ||
    (s.curriculum && (!s.curriculum.program_code || !s.curriculum.course_code || s.curriculum.academic_year===null)))) fail("Retrieval eligibility requires exact approved content and rights");
});
/** Comparable UTC keys retain all precision allowed by the shared timestamp contract. */
export function knowledgeTimeKey(value:string):string {
  return value.replace(/(?:\.(\d+))?Z$/u,(_match,fraction:string|undefined)=>`.${(fraction??"").padEnd(9,"0")}Z`);
}
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;
export const KnowledgeRegistrySchema = z.strictObject({
  schema_version:z.literal("1.0"), registry_version:Code, sources:z.array(KnowledgeSourceSchema).max(256)
}).superRefine((r,ctx)=>{
  const ids=new Set<string>(), activeIds=new Set<string>();
  for(const s of r.sources){
    if(ids.has(s.source_version_id))ctx.addIssue({code:"custom",message:"Duplicate source version"});ids.add(s.source_version_id);
    if(s.retrieval_eligible){if(activeIds.has(s.source_id))ctx.addIssue({code:"custom",message:"Multiple active versions of one source"});activeIds.add(s.source_id);}
  }
});
export type KnowledgeRegistry = z.infer<typeof KnowledgeRegistrySchema>;
export const KnowledgeLocatorSchema = z.strictObject({section:z.string().min(1).max(300),page:z.number().int().positive().optional(),paragraph:z.string().min(1).max(100).optional()});
// Admin-authored semantic sections, not automatic slicing of tables or arbitrary uploads.
export const KnowledgeSectionSchema = z.strictObject({
  section_id:Code, locator:KnowledgeLocatorSchema, topic_codes:z.array(Code).min(1).max(64),
  content:z.string().min(1).max(16000)
});
export const KnowledgeDocumentSchema = z.strictObject({
  schema_version:z.literal("1.0"), source_version_id:SourceVersionIdSchema,
  sections:z.array(KnowledgeSectionSchema).min(1).max(256)
}).superRefine((d,ctx)=>{const ids=new Set<string>();for(const s of d.sections){if(ids.has(s.section_id))ctx.addIssue({code:"custom",message:"Duplicate section"});ids.add(s.section_id);}});
export const KnowledgeChunkSchema = z.strictObject({
  chunk_id:Code, source_id:SourceIdSchema, source_version_id:SourceVersionIdSchema,
  source_type:z.enum(["CURRICULUM","CLINICAL_GUIDELINE"]), section:KnowledgeSectionSchema, excerpt_hash:Sha256DigestSchema
});
export const KnowledgeBundleSchema = z.strictObject({
  schema_version:z.literal("1.0"), registry_hash:Sha256DigestSchema,
  documents:z.array(KnowledgeDocumentSchema).max(256), chunks:z.array(KnowledgeChunkSchema).max(4096), bundle_hash:Sha256DigestSchema
});
export type KnowledgeBundle = z.infer<typeof KnowledgeBundleSchema>;
export const KnowledgeQuerySchema = z.strictObject({
  case_version_id:CaseVersionIdSchema, topic_code:Code, locale:AuthoredLocaleSchema,
  source_types:z.array(KnowledgeLayerSchema).min(1).max(4),
  curriculum:KnowledgeCurriculumContextSchema.optional(), objective_id:CurriculumObjectiveIdSchema.optional(),
  source_ids:z.array(SourceIdSchema).min(1).max(16).optional(),
  as_of:RealUtcTimeSchema, limit:z.number().int().min(1).max(6)
}).superRefine((q,ctx)=>{if((q.source_types.includes("CURRICULUM")||q.objective_id)&&!q.curriculum)ctx.addIssue({code:"custom",message:"Institution/level is mandatory"});});
export type KnowledgeQuery = z.infer<typeof KnowledgeQuerySchema>;
export const KnowledgeEvidenceSchema = z.strictObject({
  chunk_id:Code, source_id:SourceIdSchema, source_version_id:SourceVersionIdSchema,
  source_type:z.enum(["CURRICULUM","CLINICAL_GUIDELINE"]), content:z.string().min(1).max(16000),
  citation:z.strictObject({title:z.string(),publisher:z.string(),location:z.string(),document_version:z.string(),
    locator:KnowledgeLocatorSchema,source_content_hash:Sha256DigestSchema,excerpt_hash:Sha256DigestSchema,index_hash:Sha256DigestSchema}),
  language:AuthoredLocaleSchema, curriculum:KnowledgeCurriculumContextSchema.nullable(),
  objective_id:CurriculumObjectiveIdSchema.nullable(), relevance:z.literal("EXACT_CONTROLLED_TOPIC")
});
export const KnowledgeRetrievalResultSchema = z.strictObject({
  authority:z.literal("NON_AUTHORITATIVE_EVIDENCE"),
  status:z.enum(["AVAILABLE","NO_MATCH","SOURCE_PENDING","CURRICULUM_SOURCE_PENDING","RETRIEVAL_UNAVAILABLE","INVALID_QUERY","DIRECT_LOOKUP_REQUIRED"]),
  retrieval_mode:z.enum(["LOCAL_PINNED","INDEX_ADAPTER","PINNED_FALLBACK","NONE"]),
  index_hash:Sha256DigestSchema,
  clinical_evidence:z.array(KnowledgeEvidenceSchema).max(6),curriculum_evidence:z.array(KnowledgeEvidenceSchema).max(6)
}).superRefine((r,ctx)=>{
  const all=[...r.clinical_evidence,...r.curriculum_evidence];
  if(r.clinical_evidence.some(e=>e.source_type!=="CLINICAL_GUIDELINE")||r.curriculum_evidence.some(e=>e.source_type!=="CURRICULUM"))ctx.addIssue({code:"custom",message:"Evidence layer mismatch"});
  if((r.status!=="AVAILABLE"&&all.length>0)||(r.status==="AVAILABLE"&&all.length===0)||all.some(e=>e.citation.index_hash!==r.index_hash))ctx.addIssue({code:"custom",message:"Invalid evidence result"});
});
export type KnowledgeRetrievalResult=z.infer<typeof KnowledgeRetrievalResultSchema>;
