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
const provider = await read("apps/web/src/features/voice/azure-speech-adapter.ts");
const server = await read("packages/api-core/src/voice/azure-token-provider.ts");
const route = await read("packages/api-core/src/http/create-api-app.ts");
const capture = await read("apps/web/src/features/voice/capture-controller.ts");
const tts = await read("apps/web/src/features/voice/PatientSpeech.tsx");
const model = await read("packages/ai-gateway/src/selected-model-policy.ts");
const pkg = JSON.parse(await read("apps/web/package.json"));
const freeze = JSON.parse(await read("evaluation/voice/v2-020a.freeze.json"));
const digest = value => createHash("sha256").update(canonicalSerialize(value)).digest("hex");
const checks = [
  ["policy frozen before live evidence", digest(VOICE_EVALUATION_POLICY) === freeze.policy_sha256],
  ["corpus frozen before live evidence", digest(VOICE_EVALUATION_CORPUS) === freeze.corpus_sha256],
  ["SDK pinned", pkg.dependencies["microsoft-cognitiveservices-speech-sdk"] === "1.51.0"],
  ["token route authenticated", route.indexOf('app.use("/v1/*"') < route.indexOf('app.post("/v1/voice/token"')],
  ["session authorization before token", route.includes("service.authorizeAndLoad(authority, body.data.session_id)")],
  ["token no-store", route.includes('context.header("Cache-Control", "no-store")')],
  ["server fixed STS and redirect rejection", server.includes("api.cognitive.microsoft.com/sts/v1.0/issueToken") && server.includes('redirect: "error"')],
  ["key absent browser", !/subscription_key|Ocp-Apim-Subscription-Key|AZURE_SPEECH_KEY/u.test(voice)],
  ["no audio persistence", !/localStorage|indexedDB|IndexedDB|MediaRecorder|writeFile|caches\./u.test(voice)],
  ["no clinical execution", !/actions\/propose|session_coordinator|clinical-engine|assessment-engine|patient_state|clinical_time/u.test(voice)],
  ["manual locale", provider.includes("speechRecognitionLanguage = input.locale") && !provider.includes("AutoDetectSourceLanguageConfig")],
  ["bounded recording", capture.includes("15_000") && capture.includes("5_000")],
  ["SDK telemetry disabled", provider.includes("enableTelemetry(false)")],
  ["stream released", provider.includes("track.stop()")],
  ["audio URL revoked", provider.includes("URL.revokeObjectURL")],
  ["plain exact TTS", provider.includes("speakTextAsync(input.text") && !provider.includes("speakSsmlAsync")],
  ["approved turn parsed", tts.includes("SafePatientConversationTurnSchema.safeParse(turn)") && tts.includes("text: parsed.data.patient_utterance")],
  ["model selection preserved", model.includes('PATIENT_CONVERSATION: "gpt-5.6-terra"') && model.includes('CLINICAL_INTERPRETER: "gpt-5.6-luna"')]
];
for (const directory of ["packages/clinical-engine/src", "packages/session-engine/src", "packages/assessment-engine/src", "packages/contracts/src"]) {
  for (const file of await files(join(root, directory))) {
    if (/microsoft-cognitiveservices-speech-sdk/u.test(await readFile(file, "utf8"))) throw Error("SDK entered portable core");
  }
}
const artifacts = [...await files(join(root, "apps/web/src")), ...await files(join(root, "tests/fixtures/voice")), ...await files(join(root, "evaluation/voice"))];
try { artifacts.push(...await files(join(root, "apps/web/dist"))); } catch { /* pre-build source audit; final verify builds first */ }
for (const file of artifacts) {
  const text = await readFile(file, "utf8");
  if (/sk-[A-Za-z0-9_-]{24,}|-----BEGIN .*PRIVATE KEY-----|https:\/\/[a-z0-9-]+\.supabase\.co/u.test(text)) throw Error("Secret/remote signature in voice artifacts");
  if (file.includes("dist") && /synthetic-test-secret-not-real|Ocp-Apim-Subscription-Key|AZURE_SPEECH_KEY/u.test(text)) throw Error("Server credential marker in bundle");
}
for (const [label, ok] of checks) if (!ok) throw Error(`Voice audit failed: ${label}`);
console.log(`V2-020A voice safety: ${checks.length}/${checks.length} PASS; portable SDK and source/bundle signature checks PASS`);
