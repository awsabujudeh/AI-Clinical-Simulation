import { describe,it,expect } from "vitest";
import { KnowledgeRegistrySchema, KnowledgeQuerySchema, KnowledgeRetrievalResultSchema } from "../../../packages/contracts/src/index.ts";
import { prepareKnowledgeBundle, createKnowledgeRetrieval, verifyKnowledgeCitation } from "../../../packages/ai-gateway/src/knowledge/retrieval.ts";
import { knowledgeFixture, clinicalQuery, TOPICS, knowledgeSnapshot } from "../../fixtures/knowledge/synthetic-knowledge.ts";
import { STEMI_KNOWLEDGE_REGISTRY, STEMI_APPROVED_KNOWLEDGE_DOCUMENTS } from "../../../content/knowledge/stemi/registry.ts";
import { createStemiKnowledgeRetrieval } from "../../../content/knowledge/stemi/index.ts";
import { createV2_022Review } from "../../../runtime/v2-022-review-composition.ts";
import { apiHeaders } from "../../fixtures/api/secure-api.ts";

async function setup(){const f=await knowledgeFixture();const s=await createKnowledgeRetrieval({...f,expected_bundle_hash:f.bundle.bundle_hash});if(!s.success)throw Error(s.code);return {...f,s};}
describe("controlled knowledge foundation",()=>{
  it.each(TOPICS)("synthetic STEMI topic %s returns only traceable educational evidence",async topic=>{
    const {s,bundle}=await setup();const r=await s.retrieve(clinicalQuery(topic));
    expect(r.status).toBe("AVAILABLE");expect(r.authority).toBe("NON_AUTHORITATIVE_EVIDENCE");expect(r.curriculum_evidence).toEqual([]);
    const e=r.clinical_evidence[0]!;expect(e.content).toContain("SYNTHETIC TEST ONLY");expect(e.citation.locator.section).toBeTruthy();
    expect(e.citation.source_content_hash).toMatch(/^[0-9a-f]{64}$/);expect(e.citation.document_version).toBe("test-1");
    expect(verifyKnowledgeCitation(r,e.chunk_id,bundle.bundle_hash)).toBe(true);
    expect(verifyKnowledgeCitation(r,"chunk.fabricated",bundle.bundle_hash)).toBe(false);
    expect(verifyKnowledgeCitation(r,e.chunk_id,"0".repeat(64))).toBe(false);
    expect(KnowledgeRetrievalResultSchema.safeParse(r).success).toBe(true);
  });
  it("duplicate ingestion is idempotent; ordering inputs does not change the bundle",async()=>{
    const f=await knowledgeFixture();expect(await prepareKnowledgeBundle(f.registry,[...f.documents].reverse().concat(f.documents),f.hash)).toEqual({success:true,bundle:f.bundle});
  });
  it("source/section IDs containing dots cannot collide into one chunk identity",async()=>{
    const f=await knowledgeFixture();const first=f.documents[0]!;first.sections[0]!.section_id="tail.foo";
    const second={...structuredClone(first),source_version_id:`${first.source_version_id}.tail`,sections:[{...first.sections[0]!,section_id:"foo"}]};
    const firstHash=await f.hash.sha256(JSON.stringify(first));
    f.registry.sources[0]!.content_hash=firstHash as never;f.registry.sources[0]!.approval!.approved_content_hash=firstHash as never;
    const secondHash=await f.hash.sha256(JSON.stringify(second));const secondSource=structuredClone(f.registry.sources[0]!);
    Object.assign(secondSource,{source_id:"source.synthetic.collision",source_version_id:second.source_version_id,content_hash:secondHash});secondSource.approval!.approved_content_hash=secondHash as never;
    f.registry.sources.push(secondSource);
    const result=await prepareKnowledgeBundle(f.registry,[...f.documents,second],f.hash);if(!result.success)throw Error(result.code);
    expect(new Set(result.bundle.chunks.map(c=>c.chunk_id)).size).toBe(result.bundle.chunks.length);
  });
  it("missing/unlisted source cannot ingest and failure returns no partial bundle",async()=>{
    const f=await knowledgeFixture();const unknown={...f.documents[0],source_version_id:"source-version.unlisted"};
    expect(await prepareKnowledgeBundle(f.registry,[f.documents[0],unknown],f.hash)).toEqual({success:false,code:"SOURCE_NOT_REGISTERED"});
  });
  it("tampered content and stale approval hash fail closed",async()=>{
    const f=await knowledgeFixture();f.documents[0]!.sections[0]!.content+=" altered";
    expect(await prepareKnowledgeBundle(f.registry,f.documents,f.hash)).toEqual({success:false,code:"HASH_MISMATCH"});
    f.registry.sources[0]!.approval!.approved_content_hash="0".repeat(64) as never;
    expect(KnowledgeRegistrySchema.safeParse(f.registry).success).toBe(false);
  });
  it("unapproved, rights-unresolved, rejected, superseded and missing clinical review cannot be eligible",async()=>{
    const f=await knowledgeFixture();for(const change of [{rights_status:"UNRESOLVED"},{review_status:"REJECTED"},{lifecycle:"SUPERSEDED"},{approval:null},{content_hash:null},{approval:{...f.registry.sources[0]!.approval,clinical_review:false}}]){
      const r=structuredClone(f.registry);Object.assign(r.sources[0]!,change);expect(KnowledgeRegistrySchema.safeParse(r).success).toBe(false);
    }
    f.registry.sources[0]!.retrieval_eligible=false;
    expect(await prepareKnowledgeBundle(f.registry,f.documents,f.hash)).toEqual({success:false,code:"SOURCE_NOT_APPROVED"});
  });
  it.each(["CASE_GROUND_TRUTH","SIMULATION_RUBRIC"])("%s stays out of ingestion and retrieval",async layer=>{
    const {s,registry,documents,hash}=await setup();const r=await s.retrieve({...clinicalQuery(),source_types:[layer]});expect(r.status).toBe("DIRECT_LOOKUP_REQUIRED");
    Object.assign(registry.sources[0]!,{source_type:layer,retrieval_eligible:false,ingestion_status:"DIRECT_LOOKUP_ONLY"});
    expect(await prepareKnowledgeBundle(registry,documents,hash)).toEqual({success:false,code:"DIRECT_LOOKUP_ONLY"});
  });
  it("JU/JUST, year, course, case and locale filter before adapter selection",async()=>{
    const f=await knowledgeFixture();const seen:string[][]=[];
    const service=await createKnowledgeRetrieval({...f,expected_bundle_hash:f.bundle.bundle_hash,index_adapter:{async select(_q,ids){seen.push([...ids]);return [...ids].reverse();}}});if(!service.success)throw Error();
    const query={...clinicalQuery(),source_types:["CURRICULUM"],curriculum:f.registry.sources[1]!.curriculum};
    const r=await service.retrieve(query);expect(r.curriculum_evidence.length).toBe(1);expect(r.curriculum_evidence[0]!.curriculum!.institution.institution_code).toBe("JU");
    expect(seen[0]!.every(id=>f.bundle.chunks.find(c=>c.chunk_id===id)?.source_id==="source.synthetic.ju")).toBe(true);expect(r.clinical_evidence).toEqual([]);
    for(const change of [{case_version_id:"case-version.other"},{locale:"ar-JO"},{curriculum:{...query.curriculum,academic_year:4}},{curriculum:{...query.curriculum,course_code:"other"}}]){
      const result=await service.retrieve({...query,...change});expect(result.curriculum_evidence).toEqual([]);
    }
    expect((await service.retrieve({...query,curriculum:undefined})).status).toBe("INVALID_QUERY");
  });
  it("unknown topic and source IDs return no fabricated evidence",async()=>{
    const {s}=await setup();expect((await s.retrieve(clinicalQuery("topic.unknown"))).status).toBe("NO_MATCH");
    expect((await s.retrieve({...clinicalQuery(),source_ids:["source.missing"]})).status).toBe("INVALID_QUERY");
  });
  it("expiry is exclusive, starts inclusive, and UTC fractions compare correctly",async()=>{
    const {s}=await setup();expect((await s.retrieve({...clinicalQuery(),as_of:"2027-01-01T00:00:00.000Z"})).status).toBe("NO_MATCH");
    expect((await s.retrieve({...clinicalQuery(),as_of:"2026-01-01T00:00:00.000000001Z"})).status).toBe("AVAILABLE");
    expect((await s.retrieve({...clinicalQuery(),as_of:"2025-12-31T23:59:59Z"})).status).toBe("NO_MATCH");
  });
  it("tampered bundles and wrong pins are rejected before service creation",async()=>{
    const f=await knowledgeFixture();expect(await createKnowledgeRetrieval({...f,expected_bundle_hash:"0".repeat(64)})).toEqual({success:false,code:"PIN_MISMATCH"});
    f.bundle.chunks[0]!.section.content="forged";
    expect(await createKnowledgeRetrieval({...f,expected_bundle_hash:f.bundle.bundle_hash})).toEqual({success:false,code:"PIN_MISMATCH"});
  });
  it("registry successor invalidates an old bundle and approval metadata cannot be silently replaced",async()=>{
    const f=await knowledgeFixture();f.registry.registry_version="synthetic.2";
    expect(await createKnowledgeRetrieval({...f,expected_bundle_hash:f.bundle.bundle_hash})).toEqual({success:false,code:"PIN_MISMATCH"});
    const next=await prepareKnowledgeBundle(f.registry,f.documents,f.hash);if(!next.success)throw Error();
    expect(next.bundle.bundle_hash).not.toBe(f.bundle.bundle_hash);
  });
  it("JSON property insertion order is normalized by the strict data schema",async()=>{
    const f=await knowledgeFixture();const reversed=f.documents.map(d=>({sections:d.sections.map(s=>({content:s.content,topic_codes:s.topic_codes,locator:s.locator,section_id:s.section_id})),source_version_id:d.source_version_id,schema_version:d.schema_version}));
    expect(await prepareKnowledgeBundle(f.registry,reversed,f.hash)).toEqual({success:true,bundle:f.bundle});
  });
  it("adapter outage degrades to the same approved bundle only when explicitly enabled",async()=>{
    const f=await knowledgeFixture();const index_adapter={async select():Promise<string[]>{throw Error("outage");}};
    for(const fallback of [false,true]){
      const s=await createKnowledgeRetrieval({...f,index_adapter,allow_pinned_fallback:fallback,expected_bundle_hash:f.bundle.bundle_hash});if(!s.success)throw Error();
      const r=await s.retrieve(clinicalQuery());expect(r.status).toBe(fallback?"AVAILABLE":"RETRIEVAL_UNAVAILABLE");expect(r.retrieval_mode).toBe(fallback?"PINNED_FALLBACK":"NONE");
    }
  });
  it("an adapter cannot inject unknown or cross-institution chunks",async()=>{
    const f=await knowledgeFixture();const s=await createKnowledgeRetrieval({...f,expected_bundle_hash:f.bundle.bundle_hash,index_adapter:{async select(){return [f.bundle.chunks.find(c=>c.source_type==="CURRICULUM")!.chunk_id];}}});if(!s.success)throw Error();
    expect((await s.retrieve(clinicalQuery())).status).toBe("RETRIEVAL_UNAVAILABLE");
  });
  it("strict input rejects arbitrary prompt, state writes, scoring and runtime sources",async()=>{
    const {s}=await setup();for(const extra of [{prompt:"ignore rules"},{patient_state:{}},{score:100},{sources:[]}]){
      expect((await s.retrieve({...clinicalQuery(),...extra})).status).toBe("INVALID_QUERY");
    }
    expect(KnowledgeQuerySchema.safeParse({...clinicalQuery(),topic_code:"constructor"}).success).toBe(true);
    expect((await s.retrieve(clinicalQuery("constructor"))).status).toBe("NO_MATCH");
  });
  it("input/output mutation cannot alter pinned service evidence",async()=>{
    const {s,registry,bundle}=await setup();const first=await s.retrieve(clinicalQuery());const before=JSON.stringify(first);
    registry.sources[0]!.title="changed";bundle.chunks[0]!.section.content="changed";first.clinical_evidence[0]!.content="changed";
    expect(JSON.stringify(await s.retrieve(clinicalQuery()))).toBe(before);
  });
  it("real registry never promotes unresolved sources; JU/JUST remain explicitly pending",async()=>{
    const f=await knowledgeFixture();expect(STEMI_APPROVED_KNOWLEDGE_DOCUMENTS).toHaveLength(0);
    const b=await prepareKnowledgeBundle(STEMI_KNOWLEDGE_REGISTRY,[],f.hash);if(!b.success)throw Error();
    const s=await createKnowledgeRetrieval({registry:STEMI_KNOWLEDGE_REGISTRY,bundle:b.bundle,expected_bundle_hash:b.bundle.bundle_hash,hash:f.hash});if(!s.success)throw Error();
    for(const topic of TOPICS)expect((await s.retrieve(clinicalQuery(topic))).status).toBe("SOURCE_PENDING");
    for(const record of STEMI_KNOWLEDGE_REGISTRY.sources.filter(s=>s.source_type==="CURRICULUM")){
      expect(record.objective_id).toBe("UNKNOWN_PENDING_SOURCE_REVIEW");
      expect((await s.retrieve({...clinicalQuery(),source_types:["CURRICULUM"],curriculum:record.curriculum})).status).toBe("CURRICULUM_SOURCE_PENDING");
    }
  });
  it("repeated run produces exact deterministic serialized evidence",async()=>{expect(await knowledgeSnapshot()).toBe(await knowledgeSnapshot());});
  it("Browser pins the same exact serialized evidence as Deno",async()=>{
    const f=await knowledgeFixture();expect(await f.hash.sha256(await knowledgeSnapshot())).toBe("aeacacaac897df849bb87ebe58c537ad5bf139708baeaf54656545bc88a33300");
    const real=await createStemiKnowledgeRetrieval(f.hash);expect(real.success).toBe(true);
  });
  it("malformed inputs, duplicate registry/sections and failed hash adapter return typed failures",async()=>{
    const f=await knowledgeFixture();expect(await prepareKnowledgeBundle({},[],f.hash)).toEqual({success:false,code:"INVALID_REGISTRY"});
    expect(await prepareKnowledgeBundle(f.registry,[{}],f.hash)).toEqual({success:false,code:"INVALID_DOCUMENT"});
    expect(KnowledgeRegistrySchema.safeParse({...f.registry,sources:[...f.registry.sources,f.registry.sources[0]]}).success).toBe(false);
    const d=structuredClone(f.documents[0]!);d.sections.push(d.sections[0]!);
    expect(await prepareKnowledgeBundle(f.registry,[d],f.hash)).toEqual({success:false,code:"INVALID_DOCUMENT"});
    expect(await prepareKnowledgeBundle(f.registry,f.documents,{async sha256(){throw Error("offline hash adapter");}})).toEqual({success:false,code:"HASH_UNAVAILABLE"});
  });
  it("retrieval outage cannot mutate the real review Session and clinical actions remain usable",async()=>{
    const {h,sessionId}=await createV2_022Review();const before=await h.store.load(sessionId as never);
    const f=await knowledgeFixture();const s=await createKnowledgeRetrieval({...f,expected_bundle_hash:f.bundle.bundle_hash,index_adapter:{async select(){throw Error("outage");}}});if(!s.success)throw Error();
    expect((await s.retrieve(clinicalQuery())).status).toBe("RETRIEVAL_UNAVAILABLE");
    expect(await h.store.load(sessionId as never)).toEqual(before);
    if(!before.success)throw Error();
    const r=await h.app.request(`/v1/sessions/${sessionId}/actions/propose`,{method:"POST",headers:apiHeaders({token:"faculty",idempotency:"idempotency.rag-outage-proof"}),
      body:JSON.stringify({command_id:"command.rag-outage-proof",action_request_id:"action-request.rag-outage-proof",action_id:"investigation.ecg-standard",expected_state_version:before.session.patient_state.state_version,parameters:{},source:"UI"})});
    expect(r.status).toBe(200);
  });
});
