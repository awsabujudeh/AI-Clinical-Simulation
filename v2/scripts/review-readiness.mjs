import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HostReadinessSchema } from '../runtime/preflight-model.ts';

export const HARDENING_BASELINE = '6804472bc84a64b6e2fad3208aefe61474bd9b8b';
const root = fileURLToPath(new URL('../../', import.meta.url));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
/** Local source provenance, not remote attestation. Excludes environment files,
 * owner Lab and recordings. Snapshot is captured BEFORE serving. */
export async function currentBuildIdentity() {
  let commit = null, hardening_baseline = false, working_tree = 'UNKNOWN';
  try {
    commit = git(['rev-parse', 'HEAD']);
    git(['merge-base', '--is-ancestor', HARDENING_BASELINE, 'HEAD']); hardening_baseline = true;
    working_tree = git(['status', '--porcelain', '--', 'v2', 'planning_input/v2-028']) ? 'MODIFIED' : 'CLEAN';
  } catch { /* unknown baseline is never green */ }
  const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'v2']).split('\0')
    .filter(p => /\.(?:ts|tsx|js|mjs|json)$/.test(p) && !/(?:node_modules|test-results|dist|playwright-report)\//.test(p));
  const digest = createHash('sha256');
  for (const name of [...new Set(files)].sort()) { digest.update(name); digest.update('\0'); digest.update(await readFile(new URL(`../../${name}`, import.meta.url))); }
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  return { version: pkg.version, commit, source_hash: digest.digest('hex'), working_tree, hardening_baseline };
}
export async function createReviewReadiness(host, capabilities = {}) {
  const build = await currentBuildIdentity();
  return Object.freeze(HostReadinessSchema.parse({ schema_version: '1.0', host, boot_id: randomUUID(),
    commit: build.commit, source_hash: build.source_hash, hardening_baseline: build.hardening_baseline,
    patient: capabilities.patient === true, voice: capabilities.voice === true, tutor: capabilities.tutor === true,
    locale: 'ar-JO', provider_calls: 'NOT_PROBED' }));
}
/** Call only inside the existing host/Origin boundary. No capability is minted. */
export function serveReviewReadiness(req, res, path, snapshot) {
  if (path !== '/__operator/readiness') return false;
  res.writeHead(req.method === 'GET' ? 200 : 405, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(req.method === 'GET' ? snapshot : { code: 'METHOD_NOT_ALLOWED' })); return true;
}
