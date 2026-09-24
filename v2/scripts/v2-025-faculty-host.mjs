import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { prepareStemiConversationArtifact } from "../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../tests/fixtures/portable-sha256.ts";
import { createFacultyDemoStore, projectFacultyStemi } from "../runtime/v2-025-faculty-store.ts";
import { assertLocalReviewEnvironment } from './local-review-security.mjs';

assertLocalReviewEnvironment(process.env.NODE_ENV);

// Same explicit loopback fixture-host boundary as V2-021/024. Never mounted in
// production; no identity, role or institution is accepted from the browser.
const origin = "http://127.0.0.1:4193";
const member = Object.freeze({ membership_id: "membership.faculty-demo", institution_id: "institution.faculty-demo", role: "FACULTY" });
const artifact = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
const store = createFacultyDemoStore(projectFacultyStemi(artifact), member.institution_id);
const vite = await createViteServer({ root: fileURLToPath(new URL("../apps/web/", import.meta.url)),
  envDir: false, envPrefix: "__V2_025_NO_CLIENT_ENV__", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
const entry = fileURLToPath(new URL("../tests/browser/v2-025-e2e/app.tsx", import.meta.url)).replaceAll("\\", "/");
const server = createServer(async (req, res) => {
  const json = (status, data) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
  try {
    if (req.headers.host !== "127.0.0.1:4193" || (req.headers.origin && req.headers.origin !== origin) || req.headers["sec-fetch-site"] === "cross-site") { json(403, { code: "FORBIDDEN" }); return; }
    const url = new URL(req.url, origin);
    if (url.pathname.startsWith("/__faculty/")) {
      let result;
      if (req.method === "GET" && url.pathname === "/__faculty/cases") result = store.list(member);
      else if (req.method === "POST" && /^\/__faculty\/cases(?:\/[^/]+)?$/.test(url.pathname)) {
        if (req.headers.origin !== origin || !req.headers["content-type"]?.startsWith("application/json")) { json(403, { code: "FORBIDDEN" }); return; }
        const chunks = []; let length = 0;
        for await (const c of req) { length += c.length; if (length > 8192) { json(413, { code: "TOO_LARGE" }); return; } chunks.push(c); }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { json(400, { code: "INVALID" }); return; }
        result = url.pathname === "/__faculty/cases" ? store.create(member, body)
          : store.update(member, decodeURIComponent(url.pathname.split("/")[3]), body);
      } else { json(404, { code: "NOT_FOUND" }); return; }
      json(result.success ? 200 : result.code === "VERSION_CONFLICT" ? 409 : result.code === "FORBIDDEN" || result.code === "READ_ONLY" ? 403 : result.code === "NOT_FOUND" ? 404 : 400, result); return;
    }
    // Dedicated demo serves only its own App routes; no production API forwarding.
    if (url.pathname.startsWith("/v1/")) { json(404, { code: "NOT_FOUND" }); return; }
    vite.middlewares(req, res, async () => {
      if (req.method !== "GET" || !/^\/(?:expo|faculty(?:\/new|\/cases\/[^/]+)?)?$/.test(url.pathname)) { json(404, { code: "NOT_FOUND" }); return; }
      res.setHeader("Content-Type", "text/html"); res.end(await vite.transformIndexHtml(url.pathname, `<!doctype html><html><head><meta charset="UTF-8"><title>Faculty Expo demo</title></head><body><div id="root"></div><script type="module" src="/@fs/${entry}"></script></body></html>`));
    });
  } catch { json(500, { code: "FACULTY_DEMO_UNAVAILABLE" }); }
});
server.listen(4193, "127.0.0.1", () => console.log(`LOCAL Faculty sandbox (memory only): ${origin}/expo`));
const close = () => { server.closeAllConnections(); server.close(); void vite.close(); };
process.once("SIGINT", close); process.once("SIGTERM", close);
