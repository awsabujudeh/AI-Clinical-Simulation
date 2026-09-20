import { it, expect } from "vitest";
import { createV2_022Review } from "../../../runtime/v2-022-review-composition.ts";
import { apiHeaders } from "../../fixtures/api/secure-api.ts";
import manifest from "../../../content/media/stemi/manifest.json";

it("real STEMI orders and scheduler gate findings, images and reports independently at exact Clinical Time", async()=>{
  const {h,sessionId,advance}=await createV2_022Review();
  const get=(id:string)=>h.app.request(`/v1/sessions/${sessionId}/investigations/${id}`,{headers:apiHeaders({token:"faculty"})});
  for(const [index,entry] of manifest.diagnostics.entries()){
    const pending=await get(entry.diagnostic_result_id); expect(pending.status).toBe(422);
    expect(JSON.stringify(await pending.json())).not.toContain("finding_texts");
    const state=(await(await h.app.request(`/v1/sessions/${sessionId}/state`,{headers:apiHeaders({token:"faculty"})})).json()).data;
    const order=await h.app.request(`/v1/sessions/${sessionId}/actions/propose`,{method:"POST",headers:apiHeaders({token:"faculty",idempotency:`idempotency.media.order-${index}`}),
      body:JSON.stringify({command_id:`command.media.${index}`,action_request_id:`action-request.media.${index}`,action_id:entry.action_id,expected_state_version:state.state_version,parameters:{},source:"UI"})});
    expect(order.status).toBe(200);
  }
  expect((await advance(119)).success).toBe(true);
  expect((await get(manifest.diagnostics[0]!.diagnostic_result_id)).status).toBe(422);
  expect((await advance(120)).success).toBe(true);
  for(const entry of manifest.diagnostics.slice(0,2)){
    const response=await get(entry.diagnostic_result_id);expect(response.status).toBe(200);
    const p=(await response.json()).data;
    expect(p.component_status.media).toBe("AVAILABLE");expect(p.component_status.formal_report).toBe("AVAILABLE");
    expect(p.finding_texts.length).toBeGreaterThan(0);expect(p.formal_report_text.length).toBeGreaterThan(0);
  }
  expect((await advance(299)).success).toBe(true);
  expect((await get(manifest.diagnostics[2]!.diagnostic_result_id)).status).toBe(422);
  expect((await advance(300)).success).toBe(true);
  const image=(await(await get(manifest.diagnostics[2]!.diagnostic_result_id)).json()).data;
  expect(image.component_status.media).toBe("AVAILABLE");expect(image.component_status.formal_report).toBe("PENDING");
  expect(image).not.toHaveProperty("formal_report_text");expect(image).not.toHaveProperty("formal_report_key");
  expect((await advance(480)).success).toBe(true);
  const report=(await(await get(manifest.diagnostics[2]!.diagnostic_result_id)).json()).data;
  expect(report.component_status.formal_report).toBe("AVAILABLE");expect(report.formal_report_text.length).toBeGreaterThan(0);
});
