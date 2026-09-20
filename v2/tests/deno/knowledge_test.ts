import { knowledgeSnapshot } from "../fixtures/knowledge/synthetic-knowledge.ts";
import { PORTABLE_SHA256_ADAPTER } from "../fixtures/portable-sha256.ts";

Deno.test("knowledge evidence is byte-identical to the Browser pinned snapshot",async()=>{
  const actual=await PORTABLE_SHA256_ADAPTER.sha256(await knowledgeSnapshot());
  if(actual!=="aeacacaac897df849bb87ebe58c537ad5bf139708baeaf54656545bc88a33300")throw Error("Knowledge evidence snapshot mismatch");
});
