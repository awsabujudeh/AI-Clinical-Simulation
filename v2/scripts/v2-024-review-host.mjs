import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createApiTestHarness, apiHeaders, startBody } from "../tests/fixtures/api/secure-api.ts";
import { prepareStemiConversationArtifact } from "../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../tests/fixtures/portable-sha256.ts";
import { createStemiTutorRetrieval, createTutorGateway } from "../runtime/v2-024-tutor-composition.ts";
import { tutorTestGateway } from "../tests/fixtures/tutor.ts";

// Local REVIEW_ONLY host. No credentials are read unless the owner explicitly opts
// into a live Tutor. Default: deterministic fallback. Test double is clearly labeled.
const live = process.env.V2_ALLOW_LIVE_V2_024_TUTOR === "1";
const test = process.env.V2_024_TEST_TUTOR === "1";
if (live && test) throw Error("LIVE_AND_TEST_ARE_EXCLUSIVE");
const gateway = live ? createTutorGateway({ environment: { get: name => process.env[name] },
  clock: { nowMilliseconds: () => performance.now() }, capacity: { authorize: async () => ({ allowed: true }) } })
  : test ? tutorTestGateway().gateway : undefined;
const artifact = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
const h = await createApiTestHarness({ review_artifact: artifact, tutor: {
  ...(gateway ? { gateway } : {}), retrieve: await createStemiTutorRetrieval(PORTABLE_SHA256_ADAPTER) } });
const start = await h.app.request("/v1/review-sessions", { method: "POST", headers: apiHeaders({ token: "faculty", idempotency: "idempotency.tutor.review" }),
  body: JSON.stringify(startBody(artifact.source_case.manifest.case_id, { mode: "PRACTICE_DEMO", patient_language: "ar-JO" })) });
if (start.status !== 201) throw Error("REVIEW_START_FAILED");
const sessionId = (await start.json()).data.session.session_id;
const origin = "http://127.0.0.1:4192";
const vite = await createViteServer({ root: fileURLToPath(new URL("../apps/web/", import.meta.url)), envDir: false,
  envPrefix: "__V2_024_NO_CLIENT_ENV__", server: { middlewareMode: true, hmr: false }, appType: "custom" });
const entry = fileURLToPath(new URL("../tests/browser/v2-021-e2e/app.tsx", import.meta.url)).replaceAll("\\", "/");
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== "127.0.0.1:4192" || (req.headers.origin && req.headers.origin !== origin) || req.headers["sec-fetch-site"] === "cross-site") { res.writeHead(403).end(); return; }
    const url = new URL(req.url, origin);
    if (url.pathname === "/__review/session") { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ session_id: sessionId, patient_language: "ar-JO", review_namespace: "tutor-review", tutor_enabled: true, tutor_provider_mode: test ? "TEST_DOUBLE" : live ? "LIVE" : "UNAVAILABLE" })); return; }
    // Deterministic offline proof control: normal coordinator, no state/rubric edits.
    if (!live && url.pathname === "/__review/advance" && req.method === "POST") {
      const time = "2026-09-06T10:20:00Z"; h.setTrustedTime(time);
      const r = await h.dependencies.session_coordinator.syncRunningSession({ coordinator_schema_version: "1.0", session_id: sessionId, trusted_real_time_utc: time,
        request_id: "request.tutor.advance", correlation_id: "correlation.tutor.advance", idempotency_key: "idempotency.tutor.advance" });
      res.writeHead(r.success ? 200 : 409, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: r.success })); return;
    }
    if (url.pathname.startsWith("/v1/")) {
      const chunks = []; let bytes = 0;
      for await (const c of req) { bytes += c.length; if (bytes > 16384) { res.writeHead(413).end(); return; } chunks.push(c); }
      const r = await h.app.request(url.pathname + url.search, { method: req.method, headers: apiHeaders({ token: "faculty", idempotency: req.headers["idempotency-key"] }), ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    vite.middlewares(req, res, async () => {
      if (req.method !== "GET" || !/^\/(?:sessions\/[^/]+)?$/.test(url.pathname)) { res.writeHead(404).end(); return; }
      res.setHeader("Content-Type", "text/html"); res.end(await vite.transformIndexHtml(url.pathname, `<!doctype html><html><head><meta charset="UTF-8"><title>Tutor review</title></head><body><div id="root"></div><script type="module" src="/@fs/${entry}"></script></body></html>`));
    });
  } catch { res.writeHead(500).end("REVIEW_UNAVAILABLE"); }
});
server.listen(4192, "127.0.0.1", () => console.log(`Tutor REVIEW_ONLY (${test ? "TEST_DOUBLE — NOT LIVE AI" : live ? "LIVE" : "TEMPLATE FALLBACK"}): ${origin}`));
const close = () => { server.closeAllConnections(); server.close(); void vite.close(); };
process.once("SIGINT", close); process.once("SIGTERM", close);
