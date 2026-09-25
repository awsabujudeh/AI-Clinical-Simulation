import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createObservationReview } from "../runtime/wp1-review-composition.ts";
import { apiHeaders } from "../tests/fixtures/api/secure-api.ts";
import {
  assertLocalReviewEnvironment,
  reviewApiRequestAllowed,
} from "./local-review-security.mjs";

assertLocalReviewEnvironment(process.env.NODE_ENV);
const patient = process.argv.includes("--patient=dana") ? "dana" : "khalid";
const port = patient === "dana" ? 4215 : 4214;
const origin = `http://127.0.0.1:${port}`;
const namespace = randomUUID();
// Only this trusted server reads time. Whole seconds match existing clock precision.
const review = await createObservationReview(
  patient,
  namespace,
  () => new Date(Math.floor(Date.now() / 1000) * 1000).toISOString(),
);
const vite = await createViteServer({
  root: fileURLToPath(new URL("../apps/web/", import.meta.url)),
  envDir: false,
  envPrefix: "__WP1_NO_CLIENT_ENV__",
  server: { middlewareMode: true, hmr: { port: port + 20000 } },
  appType: "custom",
});
const entry = fileURLToPath(
  new URL("../tests/browser/v2-021-e2e/app.tsx", import.meta.url),
).replaceAll("\\", "/");
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (
      req.headers.host !== `127.0.0.1:${port}` ||
      req.headers.origin && req.headers.origin !== origin ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      res.writeHead(403).end();
      return;
    }
    const url = new URL(req.url, origin);
    if (url.pathname === "/__review/session" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          session_id: review.sessionId,
          patient_language: "ar-JO",
          review_namespace: namespace,
        }),
      );
      return;
    }
    if (url.pathname.startsWith("/v1/")) {
      if (
        !reviewApiRequestAllowed(req.method, url.pathname, review.sessionId) ||
        url.pathname === "/v1/voice/token"
      ) {
        res.writeHead(403).end();
        return;
      }
      const chunks = [];
      let bytes = 0;
      for await (const c of req) {
        bytes += c.length;
        if (bytes > 16384) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(c);
      }
      const r = await review.h.app.request(url.pathname + url.search, {
        method: req.method,
        headers: apiHeaders({
          token: "faculty",
          idempotency: req.headers["idempotency-key"],
        }),
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      });
      res.writeHead(r.status, Object.fromEntries(r.headers)).end(
        Buffer.from(await r.arrayBuffer()),
      );
      return;
    }
    vite.middlewares(req, res, async () => {
      if (
        req.method !== "GET" || !/^\/(?:sessions\/[^/]+)?$/.test(url.pathname)
      ) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        await vite.transformIndexHtml(
          url.pathname,
          `<!doctype html><html><head><meta charset="UTF-8"><title>WP1 observation review</title></head><body><div id="root"></div><script type="module" src="/@fs/${entry}"></script></body></html>`,
        ),
      );
    });
  } catch {
    res.writeHead(500).end("WP1_REVIEW_UNAVAILABLE");
  }
});
server.listen(
  port,
  "127.0.0.1",
  () =>
    console.log(
      `WP1 REVIEW_ONLY / providers unavailable: ${origin}/sessions/${review.sessionId}`,
    ),
);
const close = () => {
  server.closeAllConnections();
  server.close();
  void vite.close();
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
