import { startPreflightHost } from '../../../scripts/v2-028-preflight-host.mjs';
import { runPreflight } from '../../../scripts/v2-028-preflight.mjs';
import { inspectAssets, readPublicAsset } from '../../../scripts/preflight-assets.mjs';
// Named, server-only synthetic failure. No real file or environment is altered;
// no browser-selected scenario, no providers, no real Session dependencies.
const host = await startPreflightHost({ port: 4201, configuration: { openai: false }, runner: input => runPreflight({ ...input,
  probe: async port => ({ port, state: 'NOT_RUNNING', host: null }),
  assets: () => inspectAssets(p => { if (p.includes('/dana/')) throw Error('INJECTED_ASSET_UNAVAILABLE'); return readPublicAsset(p); }) }) });
console.log(`SYNTHETIC FAILURE FIXTURE ONLY: ${host.origin}/expo/preflight`);
process.once('SIGINT', () => void host.close()); process.once('SIGTERM', () => void host.close());
