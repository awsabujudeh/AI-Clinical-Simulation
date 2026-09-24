import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { assertLocalReviewEnvironment } from './local-review-security.mjs';
import { currentBuildIdentity } from './review-readiness.mjs';
import { runPreflight } from './v2-028-preflight.mjs';

/** Same trusted-loopback operator boundary as V2-025, not production auth.
 * No production API, credential endpoint or arbitrary diagnostic command. */
export function allowOperatorRequest(req, origin) {
  return req.headers.host === new URL(origin).host
    && (!req.headers.origin || req.headers.origin === origin)
    && req.headers['sec-fetch-site'] !== 'cross-site';
}
export async function startPreflightHost({ port = 4200, runner = runPreflight, configuration,
  mode = process.env.NODE_ENV } = {}) {
  assertLocalReviewEnvironment(mode);
  if (![4200, 4201].includes(port)) throw Error('OPERATOR_PORT_NOT_ALLOWED');
  const origin = `http://127.0.0.1:${port}`, boot = await currentBuildIdentity();
  // Boolean-only trusted presence check; never returned value, env dump or provider call.
  const config = configuration ?? { openai: Boolean(process.env.OPENAI_API_KEY?.trim()) };
  const vite = await createViteServer({ root: fileURLToPath(new URL('../apps/web/', import.meta.url)), envDir: false,
    envPrefix: '__OPERATOR_NO_CLIENT_ENV__', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const entry = fileURLToPath(new URL('../runtime/preflight-entry.tsx', import.meta.url)).replaceAll('\\', '/');
  let inFlight;
  const server = createServer(async (req, res) => {
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Pragma', 'no-cache'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    try {
      if (!allowOperatorRequest(req, origin)) { json(403, { code: 'OPERATOR_LOCAL_ONLY' }); return; }
      const url = new URL(req.url, origin);
      if (url.pathname === '/__operator/preflight') {
        if (req.method !== 'POST') { json(405, { code: 'METHOD_NOT_ALLOWED' }); return; }
        if (req.headers.origin !== origin || req.headers['x-preflight-check'] !== 'local' || url.search) { json(403, { code: 'OPERATOR_LOCAL_ONLY' }); return; }
        // No client-injected probe URLs, scenarios, model settings or runtime data.
        for await (const chunk of req) { if (chunk.length) { json(400, { code: 'PREFLIGHT_INPUT_NOT_ALLOWED' }); return; } }
        inFlight ??= runner({ boot, configuration: config }).finally(() => { inFlight = undefined; });
        const result = await inFlight;
        console.info(JSON.stringify({ event: 'EXPO_PREFLIGHT', run_id: result.run_id, status: result.overall,
          blockers: result.blockers, degraded: result.degraded, duration_ms: result.duration_ms }));
        json(200, result); return;
      }
      if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/__')) { json(404, { code: 'NOT_FOUND' }); return; }
      vite.middlewares(req, res, async () => {
        if (req.method !== 'GET' || url.pathname !== '/expo/preflight') { json(404, { code: 'NOT_FOUND' }); return; }
        res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(url.pathname,
          `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Expo Operator Preflight</title></head><body><div id="root"></div><script type="module" src="/@fs/${entry}"></script></body></html>`));
      });
    } catch { json(503, { code: 'PREFLIGHT_UNAVAILABLE' }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const close = async () => { server.closeAllConnections(); server.close(); await vite.close(); };
  return { origin, close };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const host = await startPreflightHost();
  console.log(`OPERATOR ONLY; no live provider probes: ${host.origin}/expo/preflight`);
  process.once('SIGINT', () => void host.close()); process.once('SIGTERM', () => void host.close());
}
