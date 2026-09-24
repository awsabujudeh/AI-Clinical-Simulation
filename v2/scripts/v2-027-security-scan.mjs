import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Read files, NEVER the environment/credential store. Findings print path/category
// only, never source lines, matched values, provider bodies or credentials.
const root = fileURLToPath(new URL('../../', import.meta.url));
const failures = [];
const textExtensions = new Set(['.ts', '.tsx', '.mjs', '.js', '.json', '.md', '.txt', '.html', '.css', '.sql', '.toml', '.yml', '.yaml', '.log', '.map']);
const signatures = [
  ['provider key', /\bsk[-_](?:proj-)?[A-Za-z0-9_-]{24,}\b/u],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/u],
  ['persisted bearer material', /["'](?:single_use_token|access_token|refresh_token)["']\s*:\s*["'][A-Za-z0-9._-]{40,}["']/u],
  ['literal live voice identifier', /(?:voice_id|Voice ID)["']?\s*[:=]\s*["']?(?!synthetic)[A-Za-z0-9]{20}\b/u],
  ['credential-bearing URL', /https?:\/\/[^\s/@:'"<>]+:[^\s/@'"<>]+@/u],
  ['literal provider credential', /(?:OPENAI_API_KEY|ELEVENLABS_API_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*["'](?!synthetic)[A-Za-z0-9_-]{24,}["']/u]
];
export function secretCategories(text) { return signatures.filter(([, pattern]) => pattern.test(text)).map(([category]) => category); }
// Detector self-tests: deliberately assembled, non-provider values, no real secret.
assert.ok(secretCategories('sk-' + 'A'.repeat(30)).includes('provider key'));
assert.ok(secretCategories('sk_' + 'B'.repeat(32)).includes('provider key'));
assert.ok(secretCategories('-----BEGIN ' + 'PRIVATE KEY-----').includes('private key'));
assert.deepEqual(secretCategories('getEnv("OPENAI_API_KEY") synthetic-token'), []);

async function scan(path, bundle = false) {
  const text = await readFile(path, 'utf8');
  for (const category of secretCategories(text)) failures.push(`${relative(root, path)}: ${category}`);
  if (bundle) {
    // Scoped speech bearer delivery is intentional; permanent credentials,
    // trusted prompts/model choice and fixture-auth helpers are not browser code.
    for (const marker of ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'xi-api-key',
      'api.openai.com', 'V2_ALLOW_LIVE_', 'VERIFIED_SUPABASE_JWT', 'test.faculty', 'DANA_VISUAL_ONLY',
      'local-speaking-fixture', 'LOCAL_REVIEW_DISABLED_IN_PRODUCTION', 'prompt.tutor.evidence-priorities']) {
      if (text.includes(marker)) failures.push(`${relative(root, path)}: server/dev marker in bundle (${marker})`);
    }
  }
}
async function textFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await textFiles(path));
    else if (textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}
const candidates = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'v2', 'planning_input'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
let sourceCount = 0;
for (const name of candidates) {
  if (/(?:^|\/)(?:node_modules|test-results|playwright-report|coverage|dist)\//u.test(name)
    || (name !== 'v2/.env.example' && /(?:^|\/)(?:\.env(?:\..*)?|credentials(?:\.[^/]*)?|[^/]+\.(?:pem|key|pfx))$/iu.test(name))) failures.push(`${name}: prohibited repository artifact`);
  if (name === 'v2/.env.example') {
    const example = await readFile(join(root, name), 'utf8');
    if (!example.split(/\r?\n/u).every(line => !line.trim() || line.trim().startsWith('#'))) failures.push(`${name}: example must remain comment-only`);
  }
  if (textExtensions.has(extname(name)) || name === 'v2/.env.example') { await scan(join(root, name)); sourceCount++; }
}
const bundleFiles = await textFiles(join(root, 'v2/apps/web/dist'));
assert.ok(bundleFiles.some(path => path.endsWith('.js')), 'Completed production build required');
for (const path of bundleFiles) await scan(path, true);
let artifactCount = 0;
const artifacts = join(root, 'v2/test-results');
try {
  for (const path of await textFiles(artifacts)) {
    // Text diagnostics only; do not decode/browse owner recordings or local secrets.
    if ((await stat(path)).size <= 2_000_000) { await scan(path); artifactCount++; }
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
if (failures.length) throw Error(`SECURITY_SCAN_FAILED\n${failures.join('\n')}`);
console.log(`V2_027_SECRET_SCAN=PASS repository_text_files=${sourceCount} bundle_text_files=${bundleFiles.length} local_text_artifacts=${artifactCount}`);
console.log('ENVIRONMENT_READ=NO; VALUES_PRINTED=NO; PROVIDER_REQUESTS=ZERO; BINARY_MEDIA_NOT_SCANNED');
