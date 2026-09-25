import {prepareCompleteExpoCase} from "../../content/cases/shared-catalogue/complete-cases.ts";
import {PORTABLE_SHA256_ADAPTER as hash} from "../fixtures/portable-sha256.ts";
import {wp1Fixture} from "../fixtures/wp1.ts";
for(const [p,expected] of [["khalid","1628d4fe87490fa4064c53b210dfc5a2380508ad66e11d55c6d1697aaafc1b74"],["dana","f844ec87eaf0d84c9cf530430e5c611bfd353413a4ae5f0f5e01d2c464c68072"]] as const) {
  Deno.test(`Complete ${p} exact portable artifact hash / laboratory gating`,async()=>{
    const a=await prepareCompleteExpoCase(p,hash);
    if(a.review_execution_hash!==expected)throw Error("COMPLETE_CASE_HASH_DRIFT");
    const f=await wp1Fixture(p,"wp2-complete");
    await f.action("concept.expo.epinephrine");await f.action("concept.expo.cbc");
    const i=(await f.state()).investigations!.find(x=>x.action_id==="concept.expo.cbc")!;
    if((await f.response(`/investigations/${i.diagnostic_result_id}`)).status!==422)throw Error("EARLY_RESULT");
    f.elapsed(480);await f.state();
    const r=await f.response(`/investigations/${i.diagnostic_result_id}`);
    if(r.status!==200)throw Error("RESULT_MISSING");
    const result=(await r.json()).data;
    if(result.structured_result.analytes.length!==4||result.timing.available_at!==525)throw Error("DETERMINISM_DRIFT");
  });
}
