import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { SafeInvestigationProjectionSchema } from "../../../packages/contracts/src/index.ts";
import { InvestigationResult } from "../../../apps/web/src/features/investigations/InvestigationResults.tsx";
import manifest from "../../../content/media/stemi/manifest.json";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(()=>{host=document.createElement("div");document.body.append(host);root=createRoot(host);client=new QueryClient();
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("Original paired report")));});
afterEach(async()=>{await act(async()=>root.unmount());client.clear();host.remove();vi.unstubAllGlobals();});
const ecg=manifest.diagnostics[0]!;
function projection(status="AVAILABLE", id=ecg.diagnostic_result_id) {
  return SafeInvestigationProjectionSchema.parse({diagnostic_result_id:id,clinical_time:120,
    component_status:{structured_result:"AVAILABLE",media:status,machine_interpretation:"WITHHELD",formal_report:status},
    finding_texts:[[{locale:"en-US",text:"Authored finding"}]],formal_report_text:[{locale:"en-US",text:"Authored report"}],
    media_assets:[{media_asset_id:ecg.definition.media_asset_id,asset_role:"TRACING"}]});
}
async function render(result: Parameters<typeof InvestigationResult>[0]["result"], entry=ecg) {
  await act(async()=>root.render(<QueryClientProvider client={client}><InvestigationResult entry={entry} ordered locale="en-US" result={result}/></QueryClientProvider>));
}
it("pending orders disclose no image or report and do not fetch reference text",async()=>{
  await render({kind:"PENDING"});expect(host.textContent).toContain("Ordered — pending");
  expect(host.querySelector("img")).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
it.each(["PENDING","WITHHELD"])("%s component gates suppress media/report even if extra data is present",async status=>{
  await render({kind:"AVAILABLE",projection:projection(status)});
  expect(host.textContent).toContain("Authored finding");expect(host.textContent).not.toContain("Authored report");
  expect(host.querySelector("img")).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
it("available image with pending report does not disclose or fetch the paired report",async()=>{
  const p=projection();p.component_status.formal_report="PENDING";
  await render({kind:"AVAILABLE",projection:p});expect(host.querySelector("img")?.getAttribute("src")).toBe(ecg.packaged!.image_path);
  expect(host.textContent).not.toContain("Authored report");expect(fetch).not.toHaveBeenCalled();
});
it("available image/report use exact paired local files and preserve text on image failure",async()=>{
  await render({kind:"AVAILABLE",projection:projection()});
  expect(fetch).toHaveBeenCalledWith(ecg.packaged!.report_path);expect(host.textContent).toContain("Authored report");
  await act(async()=>host.querySelector("img")!.dispatchEvent(new Event("error")));
  expect(host.textContent).toContain("MEDIA_UNAVAILABLE");expect(host.textContent).toContain("Authored finding");
});
it("a different result identity or media identity cannot select the packaged image",async()=>{
  await render({kind:"AVAILABLE",projection:projection("AVAILABLE","diagnostic-result.other")});
  expect(host.querySelector("img")).toBeNull();expect(fetch).not.toHaveBeenCalled();
  const p=projection();p.media_assets=[];await render({kind:"AVAILABLE",projection:p});
  expect(host.querySelector("img")).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
it("missing right-sided image retains authoritative text and explicit pending-asset state",async()=>{
  const entry=manifest.diagnostics[1]!;const p=projection("AVAILABLE",entry.diagnostic_result_id);
  p.media_assets=[{media_asset_id:entry.definition.media_asset_id as never,asset_role:"TRACING"}];
  await render({kind:"AVAILABLE",projection:p},entry);
  expect(host.textContent).toContain("MEDIA_ASSET_PENDING");expect(host.textContent).toContain("Authored finding");
  expect(host.querySelector("img")).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
