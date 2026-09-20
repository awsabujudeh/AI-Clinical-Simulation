import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createApiTestHarness, apiHeaders, startBody } from "../tests/fixtures/api/secure-api.ts";
import { prepareStemiConversationArtifact } from "../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../tests/fixtures/portable-sha256.ts";
import { prepareV2_021LiveProof, V2_021_PROOF_QUESTION } from "../runtime/v2-021-live-proof.mjs";
import { V2_021_PATIENT_LANGUAGE } from "../runtime/v2-021-review-bootstrap.ts";

// Explicit local review composition, never production auth or a deployed service.
// Actual API/Session/Clinical/Assessment implementations; memory storage and the
// existing test principal only. No medical overrides. Live provider composition
// is separate, explicit and bounded; the default offline test host has no secrets.
const origin = "http://127.0.0.1:4186";
const liveRequested = process.env.V2_ALLOW_LIVE_V2_021_VOICE_PROOF === "1";
const live = liveRequested ? prepareV2_021LiveProof({ getEnv: name => process.env[name], fetch: globalThis.fetch }) : undefined;
if (live && !live.success) { console.error(live.code); process.exit(1); }
const h = await createApiTestHarness({ enable_patient_conversation: true, ...(live?.success ? {
  review_artifact: await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER),
  patient_provider: live.patient_provider, speech_token_broker: live.speech_token_broker
} : {}) });
const start = await h.app.request("/v1/review-sessions", { method: "POST",
  headers: apiHeaders({ token: "faculty", idempotency: "idempotency.visual.review" }),
  body: JSON.stringify(startBody(h.reviewArtifact.source_case.manifest.case_id, {
    mode: "PRACTICE_DEMO", patient_language: V2_021_PATIENT_LANGUAGE })) });
const started = await start.json();
if (start.status !== 201 || !started.data?.session?.visual_patient) throw Error("REVIEW_COMPOSITION_UNAVAILABLE");
const vite = await createViteServer({ root: fileURLToPath(new URL("../apps/web/", import.meta.url)),
  envDir: false, envPrefix: "__V2_021_NO_CLIENT_ENV__", server: { middlewareMode: true, host: "127.0.0.1", hmr: false }, appType: "custom" });
const entry = fileURLToPath(new URL("../tests/browser/v2-021-e2e/app.tsx", import.meta.url)).replaceAll("\\", "/");
let acceptedQuestionKey;
const server = createServer(async (request, response) => {
  try {
    if (request.headers.host !== "127.0.0.1:4186" || (request.headers.origin && request.headers.origin !== origin)
      || request.headers["sec-fetch-site"] === "cross-site") { response.writeHead(403).end(); return; }
    const url = new URL(request.url, origin);
    if (url.pathname === "/__review/session") { response.setHeader("Content-Type", "application/json"); response.setHeader("Cache-Control", "no-store"); response.end(JSON.stringify({ session_id: started.data.session.session_id,
      patient_language: started.data.patient_language,
      ...(live?.success ? { voice_profile: live.profile, proof_question: V2_021_PROOF_QUESTION } : {}) })); return; }
    if (url.pathname.startsWith("/v1/")) {
      const chunks = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 65536) { response.writeHead(413).end(); return; } chunks.push(chunk); }
      if (live?.success && request.method !== "GET") {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (url.pathname === `/v1/sessions/${started.data.session.session_id}/questions`) {
          const key = request.headers["idempotency-key"];
          if (body.text !== V2_021_PROOF_QUESTION || body.locale !== "ar-JO" || !key
            || (acceptedQuestionKey && key !== acceptedQuestionKey)) { response.writeHead(403).end(); return; }
          acceptedQuestionKey = key;
        } else if (url.pathname !== "/v1/voice/token" || body.capability !== "TTS"
          || body.session_id !== started.data.session.session_id) { response.writeHead(403).end(); return; }
      }
      const result = await h.app.request(url.pathname + url.search, { method: request.method,
        headers: apiHeaders({ token: "faculty", idempotency: request.headers["idempotency-key"] }),
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(Buffer.from(await result.arrayBuffer())); return;
    }
    vite.middlewares(request, response, async () => {
      if (request.method !== "GET" || !/^\/(?:sessions\/[^/]+)?$/.test(url.pathname)) { response.writeHead(404).end(); return; }
      const html = await vite.transformIndexHtml(url.pathname, `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>V2 Student Simulation</title></head><body><div id="root"></div><script type="module" src="/@fs/${entry}"></script></body></html>`);
      response.setHeader("Content-Type", "text/html"); response.end(html);
    });
  } catch { response.writeHead(500).end("Local review unavailable"); }
});
server.listen(4186, "127.0.0.1", () => console.log(`V2-021 local review: ${origin}/sessions/${started.data.session.session_id}`));
const close = () => { server.closeAllConnections(); server.close(); void vite.close(); };
process.once("SIGINT", close); process.once("SIGTERM", close);
