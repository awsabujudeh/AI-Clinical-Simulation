import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectAssets, readPublicAsset, parseGlb } from './preflight-assets.mjs';
import { configurationChecks, probeReviewHost, runPreflight, REVIEW_PORTS } from './v2-028-preflight.mjs';
import { currentBuildIdentity, createReviewReadiness, serveReviewReadiness } from './review-readiness.mjs';
import { allowOperatorRequest } from './v2-028-preflight-host.mjs';
import { PreflightReportSchema } from '../runtime/preflight-model.ts';

const build = { version: '0.0.0', commit: 'a'.repeat(40), source_hash: 'b'.repeat(64), working_tree: 'MODIFIED', hardening_baseline: true };
const host = (kind = 'dana') => ({ schema_version: '1.0', host: kind, boot_id: '11111111-1111-4111-8111-111111111111',
  commit: build.commit, source_hash: build.source_hash, hardening_baseline: true, patient: true, voice: true, tutor: true, locale: 'ar-JO', provider_calls: 'NOT_PROBED' });
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
test('exact local asset hashes, clips, shapes, exam coverage and shared environment', async () => {
  const rows = await inspectAssets(); assert.equal(rows.length, 4); assert(rows.every(r => r.status === 'READY'));
});
test('missing primary => verified fallback degraded; both missing => blocked; no cross-patient masking', async () => {
  for (const all of [false, true]) {
    const rows = await inspectAssets(async p => { if (p.includes('/dana/') && (all || p.endsWith('.glb'))) throw Error('synthetic missing'); return readPublicAsset(p); });
    assert.equal(rows.find(r => r.id === 'dana_visual').status, all ? 'BLOCKED' : 'DEGRADED');
    assert.equal(rows.find(r => r.id === 'stemi_visual').status, 'READY');
  }
});
test('corrupt bytes cannot be falsely verified; missing paired reports retain deterministic text fallback', async () => {
  const rows = await inspectAssets(async p => p.endsWith('dana-review.glb') ? Buffer.from('broken') : readPublicAsset(p));
  assert.equal(rows.find(r => r.id === 'dana_visual').code, 'ASSET_HASH_MISMATCH');
  const reports = await inspectAssets(async p => { if (p.endsWith('-report.txt')) throw Error('missing'); return readPublicAsset(p); });
  assert.equal(reports.find(r => r.id === 'diagnostics').status, 'DEGRADED');
  await assert.rejects(readPublicAsset('/media/../../.env')); assert.throws(() => parseGlb(Buffer.alloc(30)));
});
test('host probe is a bounded fixed-loopback GET, never a provider/Session call or redirect', async () => {
  let calls = 0;
  const result = await probeReviewHost(4194, build, async (url, init) => {
    calls++; assert.equal(url, 'http://127.0.0.1:4194/__operator/readiness'); assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error'); assert.equal(init.headers, undefined); return json(host());
  });
  assert.equal(result.state, 'CURRENT'); assert.equal(calls, 1);
  await assert.rejects(probeReviewHost(443, build, () => { throw Error('must not call'); }));
});
test('stale, unknown, oversized or credential-shaped heartbeat is fail-closed', async () => {
  assert.equal((await probeReviewHost(4194, build, async () => json({ ...host(), source_hash: '0'.repeat(64) }))).state, 'STALE_REVIEW_HOST');
  for (const value of [{}, { ...host(), voice_id: 'synthetic-private-value' }, { ...host(), host: 'stemi' }, { padding: 'x'.repeat(5000) }]) {
    const result = await probeReviewHost(4194, build, async () => json(value));
    assert.equal(result.state, 'UNVERIFIABLE'); assert.equal(result.host, null);
  }
  assert.equal((await probeReviewHost(4194, build, async () => new Response('old host', { status: 404 }))).state, 'UNVERIFIABLE');
  assert.equal((await probeReviewHost(4194, build, async () => { throw new Error('private', { cause: { code: 'ECONNREFUSED' } }); })).state, 'NOT_RUNNING');
});
test('configuration is not connectivity, missing profile degrades, known stale host blocks', () => {
  const hosts = ['stemi', 'dana', 'tutor', 'faculty'].map((h, i) => ({ port: REVIEW_PORTS[i], state: 'CURRENT', host: host(h) }));
  const configured = configurationChecks({ openai: true, secret: 'synthetic-must-not-return' }, hosts);
  assert(configured.every(c => c.status === 'READY')); assert(!JSON.stringify(configured).includes('synthetic-must-not-return'));
  const absent = configurationChecks({ openai: false }, []);
  assert(absent.filter(r => r.id.startsWith('voice')).every(r => r.status === 'DEGRADED'));
  assert.equal(configurationChecks({ openai: true }, [{ state: 'STALE_REVIEW_HOST', host: host() }]).find(c => c.id === 'hosts').status, 'BLOCKED');
});
test('operator Origin/Host boundary rejects foreign origins and no host client role is trusted', () => {
  const request = { headers: { host: '127.0.0.1:4200', origin: 'http://127.0.0.1:4200' } };
  assert(allowOperatorRequest(request, 'http://127.0.0.1:4200'));
  for (const extra of [{ host: 'attacker.test' }, { origin: 'http://attacker.test' }, { 'sec-fetch-site': 'cross-site' }])
    assert(!allowOperatorRequest({ headers: { ...request.headers, ...extra } }, 'http://127.0.0.1:4200'));
});
test('readiness endpoint returns only allowlisted snapshot; wrong method never executes work', async () => {
  const snapshot = await createReviewReadiness('dana', { patient: false, voice: false, secret: 'synthetic-secret' });
  assert(!JSON.stringify(snapshot).includes('synthetic-secret')); assert(snapshot.hardening_baseline);
  let body, status, headers; const response = { writeHead(s, h) { status = s; headers = h; }, end(b) { body = b; } };
  assert(serveReviewReadiness({ method: 'GET' }, response, '/__operator/readiness', snapshot));
  assert.equal(status, 200); assert.equal(headers['Cache-Control'], 'no-store'); assert.deepEqual(JSON.parse(body), snapshot);
  serveReviewReadiness({ method: 'POST' }, response, '/__operator/readiness', snapshot); assert.equal(status, 405);
});
test('whole preflight: both cases/fallbacks, pending RAG, zero provider requests and immutable clinical input', async () => {
  const boot = await currentBuildIdentity();
  const report = await runPreflight({ boot, configuration: { openai: false }, probe: async port => ({ port, state: 'NOT_RUNNING', host: null }) });
  assert(PreflightReportSchema.safeParse(report).success); assert.equal(report.overall, 'DEGRADED'); assert.equal(report.blockers, 0);
  assert.equal(report.clinical_mutations, 0); assert.equal(report.provider_requests, 0);
  assert.equal(report.information.filter(i => i.status === 'SOURCE_PENDING').length, 3);
  assert.equal(report.information.filter(i => i.status === 'MEDICAL_REVIEW_COMPLETE').length, 2);
  assert(report.information.filter(i => i.status === 'MEDICAL_REVIEW_COMPLETE').every(i => /owner-attested/.test(i.detail)));
  assert(report.information.some(i => /production/i.test(i.detail) && i.status === 'PRODUCTION_PENDING'));
  assert(!/fact\.stemi|fact\.dana|api_key|voice_id|patient_state|instructions/i.test(JSON.stringify(report)));
  assert(!PreflightReportSchema.safeParse({ ...report, overall: 'READY' }).success);
  assert(!PreflightReportSchema.safeParse({ ...report, checks: report.checks.map(() => report.checks[0]) }).success);
  const stale = await runPreflight({ boot: { ...boot, source_hash: '0'.repeat(64) }, configuration: { openai: false }, probe: async port => ({ port, state: 'NOT_RUNNING', host: null }) });
  assert.equal(stale.overall, 'BLOCKED'); assert.equal(stale.checks[0].code, 'STALE_PREFLIGHT_HOST');
});
