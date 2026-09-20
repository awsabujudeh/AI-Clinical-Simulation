import { createHash } from "node:crypto";
import { createStemiKnowledgeRetrieval } from "../content/knowledge/stemi/index.ts";
import { STEMI_KNOWLEDGE_REGISTRY } from "../content/knowledge/stemi/registry.ts";

const hash={async sha256(value){return createHash("sha256").update(value).digest("hex");}};
const service=await createStemiKnowledgeRetrieval(hash);
if(!service.success)throw Error(service.code);
const base={case_version_id:"case-version.stemi.inferior-rv.002",locale:"en-US",source_types:["CLINICAL_GUIDELINE"],as_of:"2026-09-20T00:00:00Z",limit:5};
for(const topic of ["stemi.inferior-recognition","stemi.timely-escalation","stemi.action-reasoning"]){
  const r=await service.retrieve({...base,topic_code:topic});if(r.status!=="SOURCE_PENDING"||r.clinical_evidence.length)throw Error("Unapproved clinical evidence escaped");
  console.log(`${topic}: ${r.status}; evidence=0; index=${r.index_hash}`);
}
for(const source of STEMI_KNOWLEDGE_REGISTRY.sources.filter(s=>s.source_type==="CURRICULUM")){
  const r=await service.retrieve({...base,topic_code:"stemi.inferior-recognition",source_types:["CURRICULUM"],curriculum:source.curriculum});
  if(r.status!=="CURRICULUM_SOURCE_PENDING"||r.curriculum_evidence.length)throw Error("Unapproved curriculum escaped");
  console.log(`${source.curriculum.institution.institution_code}: ${r.status}; objective=${source.objective_id}`);
}
console.log("PASS: eight registry records, zero real documents ingested, no fabricated approval/citation. Synthetic retrieval proof lives only in tests.");
