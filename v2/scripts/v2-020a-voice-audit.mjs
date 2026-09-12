import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { canonicalSerialize } from "../packages/case-schema/src/index.ts";
import { VOICE_EVALUATION_POLICY } from "../evaluation/voice/voice-evaluation.ts";
import { VOICE_EVALUATION_CORPUS } from "../tests/fixtures/voice/corpus.ts";
const root = fileURLToPath(new URL("../", import.meta.url));
async function files(path) {
  const result = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const full = join(path, item.name);
    if (item.isDirectory()) result.push(...await files(full)); else result.push(full);
  }
  return result;
}
const read = path => readFile(join(root, path), "utf8");
const voice = (await Promise.all((await files(join(root, "apps/web/src/features/voice"))).map(f => readFile(f, "utf8")))).join("\n");
const provider = await read("apps/web/src/features/voice/elevenlabs-speech-adapter.ts");
const server = await read("packages/api-core/src/voice/elevenlabs-token-provider.ts");
const tokenBroker = await read("packages/api-core/src/voice/token-broker.ts");
const tokenContract = await read("packages/contracts/src/voice.ts");
const route = await read("packages/api-core/src/http/create-api-app.ts");
const capture = await read("apps/web/src/features/voice/capture-controller.ts");
const tts = await read("apps/web/src/features/voice/PatientSpeech.tsx");
const model = await read("packages/ai-gateway/src/selected-model-policy.ts");
const pkg = JSON.parse(await read("apps/web/package.json"));
const freeze = JSON.parse(await read("evaluation/voice/v2-020c1.freeze.json"));
const prior = JSON.parse(await readFile(join(root, "../planning_input/v2-020/history/v2-020a.freeze.json"), "utf8"));
const digest = value => createHash("sha256").update(canonicalSerialize(value)).digest("hex");
const activeDocs = await Promise.all([
  "../planning_input/adr/ADR-VOICE-PROVIDER-001.md",
  "../planning_input/v2-020/V2-020_ELEVENLABS_PROVIDER_MIGRATION.md",
  "README.md"
].map(read));
const historicalDocs = await Promise.all([
  "V2-020A_EVALUATION_PROTOCOL.md", "V2-020A_VERIFICATION_REPORT.md", "V2-020A_VOICE_BOUNDARY.md",
  "V2-020B1_TRUSTED_RUNTIME_COMPOSITION.md", "V2-020B2A_LOCAL_STT_SMOKE_HARNESS.md"
].map(file => read(`../planning_input/v2-020/${file}`)));
// Product-owner governance is documentation, not a mutable scoring/corpus policy.
const closureGates = [
  "A. Credential/token integration works end-to-end.",
  "B. One real integrated STT smoke: microphone → partial → committed editable transcript, without clinical execution.",
  "C. One real integrated TTS smoke: approved Patient text → correct configured voice → playable audio; visible text remains authoritative.",
  "D. Existing safety/integration regression gates remain green.",
  "E. Permanent ElevenLabs key remains server-only.",
  "F. Text/manual fallback remains available.",
  "G. Final `npm run verify` and exact-SHA CI pass."
];
const checks = [
  ["policy frozen before live evidence", digest(VOICE_EVALUATION_POLICY) === freeze.policy_sha256],
  ["corpus frozen before live evidence", digest(VOICE_EVALUATION_CORPUS) === freeze.corpus_sha256],
  ["only provider changed; all prior semantic/safety thresholds retained", digest({ ...VOICE_EVALUATION_POLICY, provider: prior.provider }) === prior.policy_sha256 && prior.corpus_sha256 === freeze.corpus_sha256],
  ["provider selection CLOSED and quality APPROVED in all active guidance", activeDocs.every(doc => doc.includes("Provider selection: CLOSED.") && doc.includes("ElevenLabs provider quality: APPROVED."))],
  ["52 unchanged fixtures are regression evidence, not a required live quality retest", VOICE_EVALUATION_CORPUS.length === 52 && activeDocs.every(doc => doc.includes("Corpus role: SAFETY / INTEGRATION REGRESSION CORPUS.") && doc.includes("Full 52-live provider-quality retest required: NO."))],
  ["ADR and migration share only A-G integration closure gates", activeDocs.slice(0, 2).every(doc => closureGates.every(gate => doc.includes(gate)) && (doc.match(/^[A-Z]\. /gm) ?? []).length === 7)],
  ["historical quality gates explicitly superseded, not silently retained", historicalDocs.every(doc => doc.includes("C1A CLOSURE SUPERSESSION") && doc.includes("not a required live quality retest") && doc.includes("Only the A–G integration/verification checklist"))],
  ["speech-only native protocol: no agent SDK dependency", !Object.keys(pkg.dependencies).some(x => /elevenlabs|cognitiveservices|livekit/i.test(x))],
  ["token route authenticated", route.indexOf('app.use("/v1/*"') < route.indexOf('app.post("/v1/voice/token"')],
  ["session authorization before token", route.includes("service.authorizeAndLoad(authority, body.data.session_id)")],
  ["token no-store", route.includes('context.header("Cache-Control", "no-store")')],
  ["server fixed token endpoint and redirect rejection", server.includes("api.elevenlabs.io/v1/single-use-token/") && server.includes('redirect: "error"')],
  ["active TTD authorization is ttd_websocket, never ordinary TTS; STT remains realtime_scribe",
    [server, tokenBroker, tokenContract].every(source => source.includes('"ttd_websocket"') && source.includes('"realtime_scribe"') && !source.includes('"tts_websocket"'))],
  ["key absent browser", !/api_key|xi-api-key|ELEVENLABS_API_KEY/u.test(voice)],
  ["no audio persistence", !/localStorage|indexedDB|IndexedDB|MediaRecorder|writeFile|caches\./u.test(voice)],
  ["no clinical execution", !/actions\/propose|session_coordinator|clinical-engine|assessment-engine|patient_state|clinical_time/u.test(voice)],
  ["manual locale", provider.includes('set("language_code", token.language_code)') && provider.includes("secondary_languages")],
  ["bounded recording", capture.includes("15_000") && capture.includes("5_000")],
  ["speech only, no agent endpoint", !/convai|agent_id|Conversation.startSession/u.test(provider)],
  ["stream released", (await read("apps/web/src/features/voice/pcm-microphone.ts")).includes("track.stop()")],
  ["audio URL revoked", provider.includes("URL.revokeObjectURL")],
  ["plain exact TTS", provider.includes("text: input.text") && !/ssml|expressive_tags/u.test(provider)],
  ["approved turn parsed", tts.includes("SafePatientConversationTurnSchema.safeParse(turn)") && tts.includes("text: parsed.data.patient_utterance")],
  ["model selection preserved", model.includes('PATIENT_CONVERSATION: "gpt-5.6-terra"') && model.includes('CLINICAL_INTERPRETER: "gpt-5.6-luna"')]
];
for (const directory of ["packages/clinical-engine/src", "packages/session-engine/src", "packages/assessment-engine/src", "packages/contracts/src"]) {
  for (const file of await files(join(root, directory))) {
    if (/@elevenlabs\/client|@elevenlabs\/react|cognitiveservices/u.test(await readFile(file, "utf8"))) throw Error("SDK entered portable core");
  }
}
const artifacts = [...await files(join(root, "apps/web/src")), ...await files(join(root, "tests/fixtures/voice")), ...await files(join(root, "evaluation/voice"))];
// Historical provider identifier is forbidden in active sources/dependencies, not in historical evidence or security denylists.
const active = [...await files(join(root, "packages")), ...await files(join(root, "runtime")), ...await files(join(root, "apps/web/src")), join(root, "package-lock.json"), join(root, "apps/web/package.json")];
for (const file of active) {
  const source = await readFile(file, "utf8");
  if (new RegExp(prior.provider, "i").test(source) || /cognitiveservices|cognitive\.microsoft\.com|issueToken/u.test(source)) throw Error("Retired speech provider in active source/dependency");
  if (/@elevenlabs\/(?:client|react)|livekit|\/convai\/|Conversation\.startSession/u.test(source)) throw Error("Agent dependency/entry point in active source");
}
try { artifacts.push(...await files(join(root, "apps/web/dist"))); } catch { /* pre-build source audit; final verify builds first */ }
for (const file of artifacts) {
  const text = await readFile(file, "utf8");
  if (/ELEVENLABS_API_KEY|synthetic-runtime-key-not-a-credential/u.test(text)) throw Error("Server configuration/credential marker in client or evaluation artifact");
  if (/sk-[A-Za-z0-9_-]{24,}|-----BEGIN .*PRIVATE KEY-----|https:\/\/[a-z0-9-]+\.supabase\.co/u.test(text)) throw Error("Secret/remote signature in voice artifacts");
  if (file.includes("dist") && /synthetic-test-secret-not-real|xi-api-key|ELEVENLABS_API_KEY/u.test(text)) throw Error("Server credential marker in bundle");
}
for (const [label, ok] of checks) if (!ok) throw Error(`Voice audit failed: ${label}`);
console.log(`V2-020A voice safety: ${checks.length}/${checks.length} PASS; portable SDK and source/bundle signature checks PASS`);
