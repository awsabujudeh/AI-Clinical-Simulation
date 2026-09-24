import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createDanaReviewSession } from "../runtime/v2-026-review-composition.ts";
import { apiHeaders } from "../tests/fixtures/api/secure-api.ts";
import { prepareDanaLiveProof, createDanaQuestionAdmission, DANA_PROOF_QUESTION } from '../runtime/v2-026-live-proof.mjs';
import { assertLocalReviewEnvironment, reviewApiRequestAllowed } from './local-review-security.mjs';
import { createReviewReadiness, serveReviewReadiness } from './review-readiness.mjs';

assertLocalReviewEnvironment(process.env.NODE_ENV);

// Loopback-only review host; offline by default. Only the trusted opt-in
// composition reads credentials. They are never logged or sent to Vite.
const namespace=randomUUID();
const live=process.env.V2_ALLOW_LIVE_V2_026_VOICE_PROOF==='1'?prepareDanaLiveProof({getEnv:name=>process.env[name],fetch:globalThis.fetch}):undefined;
if(live&&!live.success){console.error(live.code);process.exit(1);}
const review = await createDanaReviewSession({namespace,...(live?.success?{patient_provider:live.patient_provider,speech_token_broker:live.speech_token_broker,voice_profile_id:live.profile.profile_id}:{})});
const admit=createDanaQuestionAdmission();
const readiness = await createReviewReadiness('dana', { patient: live?.success, voice: live?.success });
// An isolated offline review can coexist with the owner's trusted live host.
const portArg=process.argv.find(a=>a.startsWith('--port='));
const port=portArg?Number(portArg.slice(7)):4194;
if(!Number.isInteger(port)||port<4194||port>4199)throw Error('INVALID_LOCAL_REVIEW_PORT');
const origin = `http://127.0.0.1:${port}`;
const vite = await createViteServer({ root: fileURLToPath(new URL("../apps/web/", import.meta.url)), envDir: false,
  envPrefix: "__DANA_NO_CLIENT_ENV__", server: { middlewareMode: true, hmr: {port:24694+port-4194} }, appType: "custom" });
const entry = fileURLToPath(new URL("../tests/browser/v2-021-e2e/app.tsx", import.meta.url)).replaceAll("\\", "/");
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}` || (req.headers.origin && req.headers.origin !== origin) || req.headers["sec-fetch-site"] === "cross-site") { res.writeHead(403).end(); return; }
    const url = new URL(req.url, origin);
    if (serveReviewReadiness(req, res, url.pathname, readiness)) return;
    if (url.pathname === "/__review/session") { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ session_id: review.sessionId, patient_language: "ar-JO", review_namespace: namespace,...(live?.success?{voice_profile:live.profile,proof_question:DANA_PROOF_QUESTION,voice_selection:'OWNER_AUTHORIZED_FEMALE_REVIEW_ONLY'}:{}) })); return; }
    if (url.pathname === "/__review/advance" && req.method === "POST") {
      if(live){res.writeHead(403).end();return;}
      const r = await review.advance(180); res.writeHead(r.success ? 200 : 409, { "Content-Type": "application/json" }); res.end(JSON.stringify({success:r.success}));return;
    }
    if (url.pathname.startsWith("/v1/")) {
      if (!reviewApiRequestAllowed(req.method, url.pathname, review.sessionId)) { res.writeHead(403).end(); return; }
      const chunks = []; let bytes = 0;
      for await (const c of req) { bytes += c.length; if (bytes > 16384) { res.writeHead(413).end(); return; } chunks.push(c); }
      if(live?.success&&req.method!=='GET'){
        const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(url.pathname===`/v1/sessions/${review.sessionId}/questions`){
          const code=admit(body,req.headers['idempotency-key']);
          if(code){res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:{code}}));return;}
        }else if(url.pathname!=='/v1/voice/token'||body.capability!=='TTS'||body.session_id!==review.sessionId){res.writeHead(403).end();return;}
      }
      const r = await review.h.app.request(url.pathname + url.search, { method: req.method, headers: apiHeaders({ token: "faculty", idempotency: req.headers["idempotency-key"] }), ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
      res.writeHead(r.status, Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
    }
    vite.middlewares(req,res,async()=>{
      if(req.method!=="GET"||!/^\/(?:sessions\/[^/]+)?$/.test(url.pathname)){res.writeHead(404).end();return;}
      res.setHeader("Content-Type","text/html");res.end(await vite.transformIndexHtml(url.pathname,`<!doctype html><html><head><meta charset="UTF-8"><title>Dana — REVIEW ONLY</title></head><body><div id="root"></div><script type="module" src="/@fs/${entry}"></script></body></html>`));
    });
  }catch{res.writeHead(500).end("DANA_REVIEW_UNAVAILABLE");}
});
server.listen(port,"127.0.0.1",()=>console.log(`Dana REVIEW_ONLY; ${live?.success?'bounded live proof enabled':'offline / AI and voice unavailable'}: ${origin}`));
const close=()=>{server.closeAllConnections();server.close();void vite.close();};
process.once("SIGINT",close);process.once("SIGTERM",close);
