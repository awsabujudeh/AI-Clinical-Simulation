import type { HashAdapter } from "../../../packages/contracts/src/index.ts";
import { createKnowledgeRetrieval } from "../../../packages/ai-gateway/src/knowledge/retrieval.ts";
import { STEMI_KNOWLEDGE_REGISTRY } from "./registry.ts";
import bundle from "./bundle.json" with { type: "json" };

// Server-side pin. The empty approved corpus is intentional, not missing content
// to be filled by an LLM. Update only through reviewed admin ingestion/versioning.
export const STEMI_KNOWLEDGE_BUNDLE_HASH="493b8c933a672b9221250fba51ba96a5f426476dd52692ee99b092793b787261";
export function createStemiKnowledgeRetrieval(hash:HashAdapter){
  return createKnowledgeRetrieval({registry:STEMI_KNOWLEDGE_REGISTRY,bundle,expected_bundle_hash:STEMI_KNOWLEDGE_BUNDLE_HASH,hash});
}
