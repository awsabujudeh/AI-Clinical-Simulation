import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const live = await readFile(new URL("scripts/v2-019b2-live-evaluation.mjs", root), "utf8");
const provider = await readFile(new URL("packages/ai-gateway/src/openai-responses-provider.ts", root), "utf8");
const freeze = JSON.parse(await readFile(new URL("evaluation/v2-019b2.freeze.json", root), "utf8"));
const fixture = await readFile(new URL("tests/fixtures/v2-019b2-evaluation.ts", root), "utf8");
const selectedPolicy = await readFile(new URL("packages/ai-gateway/src/selected-model-policy.ts", root), "utf8");
const patientCapability = await readFile(new URL("packages/patient-conversation/src/capability.ts", root), "utf8");
const interpreterCapability = await readFile(new URL("packages/clinical-interpreter/src/capability.ts", root), "utf8");
const apiFixture = await readFile(new URL("tests/fixtures/api/secure-api.ts", root), "utf8");
const resultSummary = JSON.parse(await readFile(new URL("evaluation/v2-019b2.results-summary.json", root), "utf8"));
const blindReview = JSON.parse(await readFile(new URL("evaluation/v2-019b2.patient-voice-blind.json", root), "utf8"));
const blindMapping = JSON.parse(await readFile(new URL("evaluation/v2-019b2.patient-voice-mapping.json", root), "utf8"));
const modelDecision = await readFile(new URL("../planning_input/v2-019/V2-019B2_MODEL_SELECTION_DECISION.md", root), "utf8");
const modelAdr = await readFile(new URL("../planning_input/adr/ADR-AI-MODEL-001.md", root), "utf8");

const checks = [
  ["offline test command exists", typeof packageJson.scripts["test:v2-019b2"] === "string"],
  ["live command exists", typeof packageJson.scripts["eval:v2-019b2:live"] === "string"],
  ["ordinary verify does not invoke live evaluation", !packageJson.scripts.verify.includes("eval:v2-019b2:live")],
  ["live opt-in is mandatory", live.includes('V2_ALLOW_LIVE_AI_EVAL !== "1"')],
  ["credential presence is gated", live.includes("process.env.OPENAI_API_KEY?.trim()")],
  ["credential is not printed", !live.includes("console.log(apiKey)") && !live.includes("console.error(apiKey)")],
  ["tracked freeze is checked before tasks", live.indexOf("tracked freeze does not match") < live.indexOf("const tasks = []")],
  ["cost is checked before tasks", live.indexOf("COST APPROVAL REQUIRED") < live.indexOf("const tasks = []")],
  ["concurrency comes from frozen policy", live.includes("tracked.freeze.maximum_concurrency")],
  ["normalized output excludes raw provider response", !live.includes("raw_provider_response")],
  ["candidate set is exact", JSON.stringify(freeze.freeze.candidates) === JSON.stringify(["gpt-5.6-luna", "gpt-5.6-terra"])],
  ["repeat policy is three", freeze.freeze.repetitions_per_case === 3],
  ["planned request count is 648", freeze.freeze.total_planned_requests === 648],
  ["bounded concurrency is two", freeze.freeze.maximum_concurrency === 2],
  ["candidate calls are paired by case", freeze.freeze.case_order_policy === "REPETITION_CAPABILITY_CASE_MODEL_PAIRED"],
  ["completed records are resumable", freeze.freeze.resume_policy === "FREEZE_BOUND_COMPLETED_RECORDS_SKIP_EXACTLY" && live.includes("pendingTasks")],
  ["checkpoints are atomically replaced", live.includes("writeJsonAtomically") && live.includes("rename(temporaryPath, path)")],
  ["hard budget is five dollars", freeze.freeze.pricing.hard_budget_usd === 5],
  ["projected maximum respects budget", freeze.freeze.pricing.projected_maximum_usd <= 5],
  ["both capability corpora have 54 cases", freeze.freeze.capabilities.every((item) => item.corpus_case_count === 54)],
  ["scoring methodology is hash-bound", freeze.freeze.capabilities.every((item) => /^[a-f0-9]{64}$/u.test(item.scoring_methodology_sha256))],
  ["capabilities are independent", freeze.freeze.capabilities[0].capability === "PATIENT_CONVERSATION" && freeze.freeze.capabilities[1].capability === "CLINICAL_INTERPRETER"],
  ["tools are frozen empty", freeze.freeze.capabilities.every((item) => item.tools.length === 0)],
  ["store false is frozen", freeze.freeze.capabilities.every((item) => item.store === false)],
  ["provider sends no tools", provider.includes("tools: []") && provider.includes('tool_choice: "none"')],
  ["provider sends store false", provider.includes("store: false")],
  ["Patient corpus has both locales", fixture.includes('"ar-JO"') && fixture.includes('"en-US"')],
  ["no third model in freeze", !JSON.stringify(freeze).includes("gpt-6") && !JSON.stringify(freeze).includes("sol")],
  ["results default outside repository", live.includes("tmpdir()")],
  ["blind labels omit brand names", live.includes("candidate_A") && live.includes("candidate_B")],
  ["model mapping is separate", live.includes("patient-voice-blind-mapping.json")],
  ["evaluation remains tool-free", !live.includes("retrieval") && !live.includes("web_search")],
  ["live runner cannot silently update model policy", !live.includes("ADR-AI-MODEL-001") && !live.includes("selected_model_policy")],
  ["result summary is bound to final freeze", resultSummary.evaluation_freeze_hash === freeze.evaluation_freeze_hash],
  ["result matrix is complete and unique", resultSummary.matrix.total_records === 648 && resultSummary.matrix.unique_identities === 648 && resultSummary.matrix.missing_identities === 0 && resultSummary.matrix.duplicate_identities === 0],
  ["result summary preserves provider failures", resultSummary.provider_failure_records.length === 5],
  ["result summary preserves hard-safety records", resultSummary.hard_safety_records.length === 9],
  ["selected Patient model is Terra", resultSummary.selection.PATIENT_CONVERSATION === "gpt-5.6-terra" && selectedPolicy.includes('PATIENT_CONVERSATION: "gpt-5.6-terra"')],
  ["selected Interpreter model is Luna", resultSummary.selection.CLINICAL_INTERPRETER === "gpt-5.6-luna" && selectedPolicy.includes('CLINICAL_INTERPRETER: "gpt-5.6-luna"')],
  ["selected policy is freeze-bound", selectedPolicy.includes(freeze.evaluation_freeze_hash)],
  ["Patient production capability uses central policy", patientCapability.includes("createSelectedPatientConversationCapability") && patientCapability.includes("SELECTED_AI_MODEL_POLICY.PATIENT_CONVERSATION")],
  ["Interpreter production capability uses central policy", interpreterCapability.includes("createSelectedClinicalInterpreterCapability") && interpreterCapability.includes("SELECTED_AI_MODEL_POLICY.CLINICAL_INTERPRETER")],
  ["trusted API composition uses selected policy", apiFixture.includes("createSelectedPatientConversationCapability") && apiFixture.includes("createSelectedClinicalInterpreterCapability")],
  ["blinded Patient artifact has twelve pairs", blindReview.evaluation_freeze_hash === freeze.evaluation_freeze_hash && blindReview.pairs.length === 12],
  ["blinded artifact contains no model names", !JSON.stringify(blindReview).includes("gpt-5.6-")],
  ["blind mapping is separate and complete", blindMapping.candidate_A === "gpt-5.6-luna" && blindMapping.candidate_B === "gpt-5.6-terra"],
  ["model decision is capability-specific", modelDecision.includes("Patient Conversation: **`gpt-5.6-terra`**") && modelDecision.includes("Clinical Interpreter: **`gpt-5.6-luna`**") && modelDecision.includes("Global winner: **none**")],
  ["accepted ADR records both selections", modelAdr.includes("Status: **ACCEPTED**") && modelAdr.includes("`PATIENT_CONVERSATION` uses `gpt-5.6-terra`") && modelAdr.includes("`CLINICAL_INTERPRETER` uses `gpt-5.6-luna`")]
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`V2-019B2 audit failed: ${label}`);
}
console.log(`V2-019B2 offline evaluation audit: ${checks.length}/${checks.length} PASS`);
