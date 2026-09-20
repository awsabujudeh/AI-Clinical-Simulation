import { KnowledgeRegistrySchema, KnowledgeDocumentSchema, KnowledgeQuerySchema,
  UNIVERSITY_OF_JORDAN, JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY } from "../../../packages/contracts/src/index.ts";
import { prepareKnowledgeBundle, createKnowledgeRetrieval } from "../../../packages/ai-gateway/src/knowledge/retrieval.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "../portable-sha256.ts";

// SOFTWARE FIXTURES ONLY. Synthetic approval references are not real medical governance.
export const TOPICS=["stemi.inferior-recognition","stemi.timely-escalation","stemi.action-reasoning"] as const;
export async function knowledgeFixture(){
  const documents=["clinical","ju","just"].map((id,index)=>KnowledgeDocumentSchema.parse({schema_version:"1.0",source_version_id:`source-version.synthetic.${id}.001`,
    sections:TOPICS.map((topic,i)=>({section_id:`section-${i}`,locator:{section:`Synthetic fixture ${i}`,page:i+1},topic_codes:[topic],
      content:`SYNTHETIC TEST ONLY: ${id} evidence fixture for ${topic}; not medical advice or an official objective.`}))}));
  const sources=await Promise.all(documents.map(async(d,i)=>{
    const digest=await hash.sha256(JSON.stringify(d));const institution=i===1?UNIVERSITY_OF_JORDAN:JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY;
    return {source_id:`source.synthetic.${["clinical","ju","just"][i]}`,source_version_id:d.source_version_id,title:`Synthetic source ${i}`,source_type:i===0?"CLINICAL_GUIDELINE":"CURRICULUM",
      publisher:"Synthetic test publisher",document_version:"test-1",location:`fixture:source-${i}`,language:"en-US",provenance:"Synthetic fixture; not actual approval",
      scope:{case_version_ids:["case-version.stemi.inferior-rv.002"],topic_codes:[...TOPICS]},visibility:i===0?"GLOBAL":"INSTITUTION",
      curriculum:i===0?null:{institution,program_code:"test-program",course_code:"test-course",academic_year:5},objective_id:i===0?null:`objective.synthetic.${institution.institution_id}`,
      rights_status:"APPROVED",rights_reference:"TEST_ONLY_permission",access_status:"LOCAL_AVAILABLE",ingestion_status:"READY",review_status:"APPROVED",
      approval:{reviewer_ref:"TEST_ONLY_reviewer",approval_ref:"TEST_ONLY_approval",approved_at:"2026-01-01T00:00:00Z",approved_content_hash:digest,scope:"EDUCATIONAL_RETRIEVAL",clinical_review:true},
      lifecycle:"ACTIVE",effective_from:"2026-01-01T00:00:00Z",effective_to:"2027-01-01T00:00:00Z",retrieval_eligible:true,content_hash:digest};
  }));
  const registry=KnowledgeRegistrySchema.parse({schema_version:"1.0",registry_version:"synthetic.1",sources});
  const built=await prepareKnowledgeBundle(registry,documents,hash);if(!built.success)throw Error(built.code);
  return {registry,documents,bundle:built.bundle,hash};
}
export const clinicalQuery=(topic:string=TOPICS[0])=>KnowledgeQuerySchema.parse({case_version_id:"case-version.stemi.inferior-rv.002",topic_code:topic,locale:"en-US",
  source_types:["CLINICAL_GUIDELINE"],as_of:"2026-09-20T00:00:00Z",limit:5});
export async function knowledgeSnapshot(){
  const f=await knowledgeFixture();const service=await createKnowledgeRetrieval({...f,expected_bundle_hash:f.bundle.bundle_hash});if(!service.success)throw Error(service.code);
  return JSON.stringify(await service.retrieve(clinicalQuery()));
}
