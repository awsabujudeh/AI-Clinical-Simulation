import { randomUUID } from 'node:crypto';
import { inspectDomain } from '../runtime/preflight-domain.ts';
import { HostReadinessSchema, PreflightReportSchema, aggregateReadiness } from '../runtime/preflight-model.ts';
import { inspectAssets, inspectCache } from './preflight-assets.mjs';
import { currentBuildIdentity } from './review-readiness.mjs';
import { createSelectedPatientConversationCapability } from '../packages/patient-conversation/src/index.ts';
import { createSelectedClinicalInterpreterCapability } from '../packages/clinical-interpreter/src/index.ts';
import { TUTOR_CAPABILITY } from '../packages/ai-gateway/src/index.ts';

export const REVIEW_PORTS = Object.freeze([4186, 4192, 4193, 4194, 4195, 4196, 4197, 4198, 4199]);
/** Fixed loopback allow-list. No supplied URL, proxy, redirect, authorization
 * header, token mint, question, live AI/voice request or Session route. */
export async function probeReviewHost(port, build, transport = fetch) {
  if (!REVIEW_PORTS.includes(port)) throw Error('PORT_NOT_ALLOWED');
  const none = state => ({ port, state, host: null });
  try {
    const response = await transport(`http://127.0.0.1:${port}/__operator/readiness`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(1200), cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return none('UNVERIFIABLE');
    let length = 0, text = ''; const reader = response.body.getReader(), decoder = new TextDecoder();
    try {
      while (true) { const r = await reader.read(); if (r.done) break; length += r.value.length;
        if (length > 4096) return none('UNVERIFIABLE'); text += decoder.decode(r.value, { stream: true }); }
    } finally { await reader.cancel(); }
    const parsed = HostReadinessSchema.safeParse(JSON.parse(text));
    const expected = port === 4186 ? 'stemi' : port === 4192 ? 'tutor' : port === 4193 ? 'faculty' : 'dana';
    if (!parsed.success || parsed.data.host !== expected) return none('UNVERIFIABLE');
    const h = parsed.data;
    return { port, state: h.hardening_baseline && h.commit === build.commit && h.source_hash === build.source_hash ? 'CURRENT' : 'STALE_REVIEW_HOST', host: h };
  } catch (error) { return none(error.cause?.code === 'ECONNREFUSED' ? 'NOT_RUNNING' : 'UNVERIFIABLE'); }
}
export function configurationChecks(configuration, hosts) {
  const current = name => hosts.filter(h => h.state === 'CURRENT' && h.host?.host === name);
  const rows = [];
  const patient = createSelectedPatientConversationCapability({ enabled: true }).data.model_policy.candidate_model;
  const interpreter = createSelectedClinicalInterpreterCapability({ enabled: true }).data.model_policy.candidate_model;
  const tutor = TUTOR_CAPABILITY.data.model_policy.candidate_model;
  const ai = configuration.openai && current('stemi').some(h => h.host.patient) && current('dana').some(h => h.host.patient) && current('tutor').some(h => h.host.tutor);
  rows.push({ id: 'ai_config', status: ai ? 'READY' : 'DEGRADED', code: ai ? 'AI_CONFIGURATION_PRESENT_NOT_LIVE_PROVEN' : 'AI_CONFIGURATION_OR_HOST_MISSING',
    detail: `Secure AI Gateway → OpenAI Responses policies: Patient ${patient}; Interpreter ${interpreter}; Tutor ${tutor}. Operator-process key presence: ${configuration.openai ? 'yes' : 'no'}. Patient/Tutor host activation checked separately from policy availability. Interpreter live host not probed. Connectivity NOT_PROBED; manual actions and assessment remain.` });
  for (const name of ['stemi', 'dana']) {
    const bound = current(name).some(h => h.host.voice);
    rows.push({ id: `voice_${name}`, status: bound ? 'READY' : 'DEGRADED', code: bound ? 'VOICE_PROFILE_BOUND_NOT_LIVE_PROVEN' : 'VOICE_CONFIGURATION_MISSING',
      detail: bound ? 'Current trusted host initialized its Session-bound approved review profile and token broker. ElevenLabs / ttd_websocket / eleven_v3_conversational. No key, Voice ID or token returned; live connectivity NOT_PROBED.'
        : 'No current trusted host confirms this patient’s voice binding. Restart the intended host in its own approved environment. Text fallback remains. A shared environment variable alone does not prove two patient profiles.' });
  }
  const unsafe = hosts.some(h => h.state === 'STALE_REVIEW_HOST' || h.state === 'UNVERIFIABLE');
  const all = ['stemi', 'dana', 'tutor', 'faculty'].every(name => current(name).length > 0);
  rows.push({ id: 'hosts', status: unsafe ? 'BLOCKED' : all ? 'READY' : 'DEGRADED',
    code: unsafe ? 'STALE_REVIEW_HOST' : all ? 'REVIEW_HOSTS_CURRENT' : 'REVIEW_HOST_NOT_RUNNING',
    detail: unsafe ? 'An active local review port cannot prove the current hardened source/boot identity. Restart or stop that exact host in its trusted terminal. No credentials are transferred.'
      : all ? 'All four review host types prove the current source snapshot and V2-027 ancestry. This is local operator provenance, not production remote attestation.'
        : 'Some review hosts are not running. Packaged foundations are checked independently; start intended demo hosts before presenting. Preflight does not create or consume their Sessions.' });
  return rows;
}
const information = [
  { id: 'stemi_review', status: 'REVIEW_PENDING', detail: 'Khalid / STEMI remains UNDER_REVIEW / REVIEW_ONLY. Physician review is pending, not technical demo approval.' },
  { id: 'dana_review', status: 'REVIEW_PENDING', detail: 'Dana / Anaphylaxis remains UNDER_REVIEW / REVIEW_ONLY. Owner visual approval is not physician approval.' },
  { id: 'media_review', status: 'REVIEW_PENDING', detail: 'STEMI ECG/CXR matching and formal rights review pending. ECG reference 84 bpm vs Case 112 bpm discrepancy unchanged. Dana diagnostic media text-only; distribution rights review pending.' },
  { id: 'clinical_sources', status: 'SOURCE_PENDING', detail: 'Trusted real clinical documents: 0. Guideline sources unresolved; Case truth and rubrics are never RAG evidence.' },
  { id: 'ju', status: 'SOURCE_PENDING', detail: 'JU curriculum: CURRICULUM_SOURCE_PENDING. Objective IDs UNKNOWN_PENDING_SOURCE_REVIEW.' },
  { id: 'just', status: 'SOURCE_PENDING', detail: 'JUST curriculum: CURRICULUM_SOURCE_PENDING. No invented official alignment.' },
  { id: 'live', status: 'NOT_PROBED', detail: 'No automatic external calls. Reuse separately authorized one-question/one-token review proofs and the bounded Tutor path; never use recheck as a provider retry. Configured is not connected or quota-available.' },
  { id: 'production', status: 'PRODUCTION_PENDING', detail: 'Trusted loopback operator only; fixture authentication, process-local budgets and public synthetic assets. No production security certification, DB-health claim, deployment or full offline bundle receipt.' }
];
/** Injection is server/test-only, never selected by a request query/body. */
export async function runPreflight({ boot, configuration, domain = inspectDomain, assets = inspectAssets,
  cache = inspectCache, build = currentBuildIdentity, probe = probeReviewHost } = {}) {
  const start = performance.now(), current = await build();
  const hosts = await Promise.all(REVIEW_PORTS.map(port => probe(port, current)));
  const currentBoot = current.hardening_baseline && boot.source_hash === current.source_hash && boot.commit === current.commit;
  const checks = [
    { id: 'build', status: currentBoot ? 'READY' : 'BLOCKED', code: currentBoot ? 'HARDENED_BUILD_CURRENT' : 'STALE_PREFLIGHT_HOST',
      detail: currentBoot ? 'V2-027 baseline ancestry verified; operator boot source matches current source fingerprint. Uncommitted source is labelled, not hidden.' : 'Restart this operator host: source/commit changed after boot or hardened ancestry cannot be proven.' },
    ...await domain(), ...await assets(), ...configurationChecks(configuration, hosts), await cache()
  ];
  return PreflightReportSchema.parse({ schema_version: '1.0', scope: 'TRUSTED_LOCAL_SYNTHETIC_EXPO',
    run_id: randomUUID(), checked_at: new Date().toISOString(), duration_ms: Math.round(performance.now() - start),
    build: { version: current.version, commit: current.commit, source_hash: current.source_hash, working_tree: current.working_tree },
    ...aggregateReadiness(checks), checks, information, hosts, provider_requests: 0, clinical_mutations: 0 });
}
