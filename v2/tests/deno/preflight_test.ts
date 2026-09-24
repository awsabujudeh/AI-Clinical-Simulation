import { inspectDomain } from "../../runtime/preflight-domain.ts";
import { aggregateReadiness } from "../../runtime/preflight-model.ts";
import { PORTABLE_SHA256_ADAPTER } from "../fixtures/portable-sha256.ts";
Deno.test("V2-028 portable two-case local checks / truthful pending sources", async () => {
  const first = await inspectDomain(), second = await inspectDomain();
  if (JSON.stringify(first) !== JSON.stringify(second) || first.length !== 8
    || aggregateReadiness(first).overall !== "READY"
    || !first.find(c => c.id === "knowledge")?.detail.includes("0 trusted real documents")) throw Error("PREFLIGHT_PARITY_FAILED");
  if (await PORTABLE_SHA256_ADAPTER.sha256(JSON.stringify(first)) !== "ea126ec5c885747ae4005ff1cac481b61986aa6466e1da5331b416be5bcf5f17") throw Error("BROWSER_DENO_HASH_MISMATCH");
});
