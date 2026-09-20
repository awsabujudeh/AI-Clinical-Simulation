import {
  KnowledgeRegistrySchema, KnowledgeDocumentSchema, KnowledgeBundleSchema,
  KnowledgeQuerySchema, KnowledgeRetrievalResultSchema, Sha256DigestSchema, knowledgeTimeKey,
  type HashAdapter, type KnowledgeRegistry, type KnowledgeBundle, type KnowledgeQuery,
  type KnowledgeSource, type KnowledgeRetrievalResult
} from "../../../contracts/src/index.ts";

const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
type Failure={success:false;code:"INVALID_REGISTRY"|"INVALID_DOCUMENT"|"SOURCE_NOT_REGISTERED"|"SOURCE_NOT_APPROVED"|"DIRECT_LOOKUP_ONLY"|"HASH_MISMATCH"|"HASH_UNAVAILABLE"|"INVALID_BUNDLE"|"PIN_MISMATCH"};
const failure=(code:Failure["code"]):Failure=>({success:false,code});
// The strict schemas set property order. Section/array order is intentional.
// These are hashes of the normalized JSON data format, not raw PDF byte hashes.
const digest=async(value:unknown,hash:HashAdapter)=>Sha256DigestSchema.parse(await hash.sha256(JSON.stringify(value)));
const direct=(s:KnowledgeSource)=>s.source_type==="CASE_GROUND_TRUTH"||s.source_type==="SIMULATION_RUBRIC";

/** Trusted build/admin boundary. Repeated identical input is idempotent; no partial bundle on failure. */
export async function prepareKnowledgeBundle(registryInput:unknown, inputs:readonly unknown[], hash:HashAdapter):Promise<Failure|{success:true;bundle:KnowledgeBundle}> {
  const parsed=KnowledgeRegistrySchema.safeParse(registryInput);
  if(!parsed.success)return failure("INVALID_REGISTRY");
  if(!Array.isArray(inputs)||inputs.length>256)return failure("INVALID_DOCUMENT");
  const registry=parsed.data;
  const documents=new Map<string,ReturnType<typeof KnowledgeDocumentSchema.parse>>();
  const chunks:KnowledgeBundle["chunks"]=[];
  try {
    for(const input of inputs){
      const d=KnowledgeDocumentSchema.safeParse(input);if(!d.success)return failure("INVALID_DOCUMENT");
      const source=registry.sources.find(s=>s.source_version_id===d.data.source_version_id);
      if(!source)return failure("SOURCE_NOT_REGISTERED");
      if(direct(source))return failure("DIRECT_LOOKUP_ONLY");
      if(!source.retrieval_eligible)return failure("SOURCE_NOT_APPROVED");
      if(await digest(d.data,hash)!==source.content_hash)return failure("HASH_MISMATCH");
      if(documents.has(source.source_version_id))continue;
      if(d.data.sections.some(s=>s.topic_codes.some(t=>!source.scope.topic_codes.includes(t))))return failure("INVALID_DOCUMENT");
      documents.set(source.source_version_id,d.data);
      for(const section of d.data.sections){
        chunks.push({chunk_id:`chunk.${await digest([source.source_version_id,section.section_id],hash)}`,source_id:source.source_id,
          source_version_id:source.source_version_id,source_type:source.source_type as "CURRICULUM"|"CLINICAL_GUIDELINE",
          section,excerpt_hash:await digest(section.content,hash)});
      }
    }
    const payload={schema_version:"1.0" as const,registry_hash:await digest(registry,hash),
      documents:[...documents.values()].sort((a,b)=>compare(a.source_version_id,b.source_version_id)),
      chunks:chunks.sort((a,b)=>compare(a.chunk_id,b.chunk_id))};
    const bundle=KnowledgeBundleSchema.safeParse({...payload,bundle_hash:await digest(payload,hash)});
    return bundle.success?{success:true,bundle:bundle.data}:failure("INVALID_BUNDLE");
  }catch{return failure("HASH_UNAVAILABLE");}
}

/** Server adapter receives only already-authorized candidates, never a mixed unrestricted corpus.
 * A future PostgreSQL/pgvector implementation may rank these IDs. No new provider is required.
 */
export interface KnowledgeIndexAdapter {
  select(query:KnowledgeQuery, allowedChunkIds:readonly string[], indexHash:string):Promise<readonly string[]>;
}
function matchingContext(s:KnowledgeSource,q:KnowledgeQuery){
  if(!q.source_types.includes(s.source_type)||s.language!==q.locale||!s.scope.case_version_ids.includes(q.case_version_id)||
    !s.scope.topic_codes.includes(q.topic_code)||(q.source_ids&&!q.source_ids.includes(s.source_id)))return false;
  if(s.source_type==="CURRICULUM") {
    if(!s.curriculum||!q.curriculum||JSON.stringify(s.curriculum)!==JSON.stringify(q.curriculum))return false;
    if(q.objective_id && s.objective_id!==q.objective_id)return false;
  }
  return true;
}
function active(s:KnowledgeSource,q:KnowledgeQuery){
  return s.retrieval_eligible && s.lifecycle==="ACTIVE" && s.effective_from!==null && knowledgeTimeKey(s.effective_from)<=knowledgeTimeKey(q.as_of) &&
    (s.effective_to===null || knowledgeTimeKey(q.as_of)<knowledgeTimeKey(s.effective_to));
}

/** SERVER ONLY: registry, bundle pin, clock and institution context come from trusted composition.
 * No route, learner upload, Session mutation, scoring or LLM invocation is exposed here.
 */
export async function createKnowledgeRetrieval(options:{
  registry:unknown; bundle:unknown; expected_bundle_hash:string; hash:HashAdapter;
  index_adapter?:KnowledgeIndexAdapter; allow_pinned_fallback?:boolean;
}):Promise<Failure|{success:true;retrieve(input:unknown):Promise<KnowledgeRetrievalResult>}> {
  const registry=KnowledgeRegistrySchema.safeParse(options.registry);
  const bundle=KnowledgeBundleSchema.safeParse(options.bundle);
  if(!registry.success)return failure("INVALID_REGISTRY");
  if(!bundle.success)return failure("INVALID_BUNDLE");
  if(bundle.data.bundle_hash!==options.expected_bundle_hash)return failure("PIN_MISMATCH");
  // Rebuild from approved normalized inputs: no forged excerpt/metadata in a stored bundle.
  const rebuilt=await prepareKnowledgeBundle(registry.data,bundle.data.documents,options.hash);
  if(!rebuilt.success)return rebuilt;
  if(JSON.stringify(rebuilt.bundle)!==JSON.stringify(bundle.data))return failure("PIN_MISMATCH");
  const pinned=rebuilt.bundle;
  const sources:KnowledgeRegistry["sources"]=registry.data.sources;
  const adapter=options.index_adapter, fallback=options.allow_pinned_fallback===true;
  const empty=(status:KnowledgeRetrievalResult["status"],mode:KnowledgeRetrievalResult["retrieval_mode"]="NONE")=>
    KnowledgeRetrievalResultSchema.parse({authority:"NON_AUTHORITATIVE_EVIDENCE",status,retrieval_mode:mode,
      index_hash:pinned.bundle_hash,clinical_evidence:[],curriculum_evidence:[]});
  return {success:true,async retrieve(input){
    const parsed=KnowledgeQuerySchema.safeParse(input);if(!parsed.success)return empty("INVALID_QUERY");
    const q=parsed.data;
    if(q.source_types.some(t=>t==="CASE_GROUND_TRUTH"||t==="SIMULATION_RUBRIC"))return empty("DIRECT_LOOKUP_REQUIRED");
    if(q.source_ids?.some(id=>!sources.some(s=>s.source_id===id)))return empty("INVALID_QUERY");
    const scoped=sources.filter(s=>matchingContext(s,q));
    const permitted=new Map(scoped.filter(s=>active(s,q)).map(s=>[s.source_version_id,s]));
    let candidates=pinned.chunks.filter(c=>permitted.has(c.source_version_id)&&c.section.topic_codes.includes(q.topic_code));
    let mode:KnowledgeRetrievalResult["retrieval_mode"]="LOCAL_PINNED";
    if(adapter && candidates.length>0){
      try{
        const ids=await adapter.select(KnowledgeQuerySchema.parse(q),candidates.map(c=>c.chunk_id),pinned.bundle_hash);
        if(!Array.isArray(ids)||ids.some(id=>typeof id!=="string"||!candidates.some(c=>c.chunk_id===id)))throw Error("INVALID_CANDIDATE_IDS");
        const selected=new Set(ids);candidates=candidates.filter(c=>selected.has(c.chunk_id));mode="INDEX_ADAPTER";
      }catch{if(!fallback)return empty("RETRIEVAL_UNAVAILABLE");mode="PINNED_FALLBACK";}
    }
    // Stable ordering independent of adapter insertion order; no claimed semantic confidence.
    const selected=candidates.sort((a,b)=>compare(a.chunk_id,b.chunk_id)).slice(0,q.limit);
    if(!selected.length){
      const pending=scoped.some(s=>!s.retrieval_eligible || (active(s,q)&&!pinned.documents.some(d=>d.source_version_id===s.source_version_id)));
      return empty(pending?(q.source_types.includes("CURRICULUM")?"CURRICULUM_SOURCE_PENDING":"SOURCE_PENDING"):"NO_MATCH",mode);
    }
    const evidence=selected.map(c=>{
      const s=permitted.get(c.source_version_id)!;
      return {chunk_id:c.chunk_id,source_id:s.source_id,source_version_id:s.source_version_id,source_type:c.source_type,content:c.section.content,
        citation:{title:s.title,publisher:s.publisher,location:s.location,document_version:s.document_version,locator:c.section.locator,
          source_content_hash:s.content_hash,excerpt_hash:c.excerpt_hash,index_hash:pinned.bundle_hash},language:s.language,
        curriculum:s.curriculum,objective_id:s.objective_id,relevance:"EXACT_CONTROLLED_TOPIC"};
    });
    return KnowledgeRetrievalResultSchema.parse({authority:"NON_AUTHORITATIVE_EVIDENCE",status:"AVAILABLE",retrieval_mode:mode,index_hash:pinned.bundle_hash,
      clinical_evidence:evidence.filter(e=>e.source_type==="CLINICAL_GUIDELINE"),curriculum_evidence:evidence.filter(e=>e.source_type==="CURRICULUM")});
  }};
}

/** Verify a citation against the exact returned evidence, never against model-supplied metadata. */
export function verifyKnowledgeCitation(resultInput:unknown, chunkId:string, indexHash:string):boolean {
  const r=KnowledgeRetrievalResultSchema.safeParse(resultInput);
  return r.success && r.data.status==="AVAILABLE" && r.data.index_hash===indexHash &&
    [...r.data.clinical_evidence,...r.data.curriculum_evidence].some(e=>e.chunk_id===chunkId&&e.citation.index_hash===indexHash);
}
