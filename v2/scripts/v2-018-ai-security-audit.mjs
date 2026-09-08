import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const repositoryRoot = new URL("../../", import.meta.url);
const requiredFiles = [
  "packages/ai-gateway/package.json",
  "packages/ai-gateway/src/index.ts",
  "packages/ai-gateway/src/gateway.ts",
  "packages/ai-gateway/src/provider.ts",
  "packages/ai-gateway/src/openai-responses-provider.ts",
  "packages/ai-gateway/src/capability-registry.ts",
  "packages/ai-gateway/src/edge-composition.ts",
  "packages/contracts/src/ai.ts",
  "supabase/functions/ai-gateway/index.ts"
];
const requiredRepositoryFiles = [
  "planning_input/v2-018/V2-018_SECURE_AI_GATEWAY_BOUNDARY.md",
  "planning_input/v2-018/V2-018_OPENAI_RESPONSES_PROVIDER.md",
  "planning_input/v2-018/V2-018_MODEL_POLICY_AND_EVALUATION.md",
  "planning_input/v2-018/V2-018_STRUCTURED_OUTPUT_AND_FAILURE_MODEL.md",
  "planning_input/v2-018/V2-018_SECURITY_PRIVACY_AND_OBSERVABILITY.md",
  "planning_input/v2-018/V2-018_VERIFICATION_REPORT.md"
];

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

async function collect(directory, extensions) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collect(path, extensions));
    else if (extensions.includes(extname(entry.name))) output.push(path);
  }
  return output;
}

const checks = [];
function check(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

for (const file of requiredFiles) {
  let exists = false;
  try { exists = (await stat(new URL(file, root))).isFile(); } catch { exists = false; }
  check(`required file: ${file}`, exists);
}

for (const file of requiredRepositoryFiles) {
  let exists = false;
  try { exists = (await stat(new URL(file, repositoryRoot))).isFile(); } catch { exists = false; }
  check(`required repository file: ${file}`, exists);
}

const gatewaySourcePath = join(rootPath, "packages", "ai-gateway", "src");
const gatewayFiles = await collect(gatewaySourcePath, [".ts"]);
const gatewaySource = (await Promise.all(gatewayFiles.map((file) => readFile(file, "utf8")))).join("\n");
const contractsSource = await read("packages/contracts/src/ai.ts");
const edgeSource = await read("supabase/functions/ai-gateway/index.ts");
const apiSource = await read("packages/api-core/src/http/create-api-app.ts");
const webFiles = await collect(join(rootPath, "apps", "web", "src"), [".ts", ".tsx", ".js", ".jsx"]);
const webSource = (await Promise.all(webFiles.map((file) => readFile(file, "utf8")))).join("\n");
const browserDistPath = join(rootPath, "apps", "web", "dist");
let browserBundle = "";
try {
  if ((await stat(browserDistPath)).isDirectory()) {
    const builtFiles = await collect(browserDistPath, [".js", ".css", ".html"]);
    browserBundle = (await Promise.all(builtFiles.map((file) => readFile(file, "utf8")))).join("\n");
  }
} catch {
  browserBundle = "";
}

for (const [name, token] of [
  ["Responses endpoint", "/v1/responses"],
  ["store false", "store: false"],
  ["strict JSON schema", "type: \"json_schema\""],
  ["strict flag", "strict: true"],
  ["output budget", "max_output_tokens"],
  ["AbortController", "AbortController"],
  ["bounded attempts", "max_attempts"],
  ["trusted instructions", "instructions: request.instructions"],
  ["user-role content", "role: \"user\""],
  ["no-tools request", "tools: []"],
  ["no-tools choice", "tool_choice: \"none\""],
  ["local Zod validation", "output_schema.safeParse"],
  ["capability registry", "TrustedCapabilityRegistry"],
  ["server-only marker", "SERVER_ONLY"],
  ["environment key name", "OPENAI_API_KEY"],
  ["provider abstraction", "interface AiProvider"],
  ["transport abstraction", "interface AiHttpTransport"],
  ["budget authority", "interface AiCapacityAuthority"],
  ["safe audit logger", "interface AiGatewayLogger"],
  ["Luna candidate", "gpt-5.6-luna"],
  ["Terra candidate", "gpt-5.6-terra"]
]) check(name, gatewaySource.includes(token));

for (const token of [
  "previous_response_id:", "background:", "store: true", "temperature:",
  "chat/completions", "ChatCompletion", "from \"openai\"", "from '@openai/",
  "from \"@openai/", "process.env", "Deno.env", "node:crypto", "node:https",
  "submitClinicalAction", "PatientStateSchema", "AssessmentResultSchema",
  "SessionCoordinator", "previous_response_id =", "Math.random", "new Function", "eval("
]) check(`gateway excludes ${token}`, !gatewaySource.includes(token));

for (const token of [
  "api.openai.com", "OPENAI_API_KEY", "@ai-clinical-simulation/ai-gateway",
  "gpt-5.6-luna", "gpt-5.6-terra", "model-policy.", "prompt.patient",
  "Bearer ", "from \"openai\"", "from '@openai/"
]) check(`browser excludes ${token}`, !webSource.includes(token));

for (const token of [
  "AI_CAPABILITY_DISABLED", "AI_PROVIDER_NOT_CONFIGURED", "AI_PROVIDER_TIMEOUT",
  "AI_PROVIDER_RATE_LIMITED", "AI_PROVIDER_UNAVAILABLE", "AI_PROVIDER_REJECTED_REQUEST",
  "AI_RESPONSE_INCOMPLETE", "AI_RESPONSE_REFUSED", "AI_OUTPUT_INVALID",
  "AI_SCHEMA_MISMATCH", "AI_BUDGET_EXCEEDED", "AI_UNEXPECTED_FAILURE",
  "PATIENT_CONVERSATION", "CLINICAL_INTERPRETER", "TUTOR",
  "ASSESSMENT_ANALYSIS", "CASE_DRAFTING", "ar-JO", "en-US"
]) check(`shared AI contract contains ${token}`, contractsSource.includes(token));

check("Edge composition exports no HTTP route", !edgeSource.includes(".post(") && !edgeSource.includes("Deno.serve"));
check("Edge composition says no generic prompt route", edgeSource.includes("no") && edgeSource.includes("generic prompt route"));
check("submitQuestion route remains present", apiSource.includes('/v1/sessions/:session_id/questions'));
check("submitQuestion remains explicitly unavailable", apiSource.includes("authorized.success\n      ? errorJson(context, ERRORS.unavailable)"));
check("no Patient AI implementation file", !gatewayFiles.some((file) => relative(gatewaySourcePath, file).toLowerCase().includes("patient")));

const repositoryFiles = await collect(rootPath, [".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
const relevantFiles = repositoryFiles.filter((file) => !file.includes("node_modules") && !file.includes("dist"));
const secretPattern = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u;
let secretFound = false;
for (const file of relevantFiles) {
  if (secretPattern.test(await readFile(file, "utf8"))) secretFound = true;
}
check("no OpenAI-looking secret", !secretFound);
check("no browser provider URL", !webSource.includes("/v1/responses"));
check("no browser provider key", !secretPattern.test(webSource));
check("no runtime AI cache", !webSource.includes("ai_workflow_runs"));
check("no AI service-worker route", !webSource.toLowerCase().includes("openai"));
for (const token of [
  "api.openai.com", "OPENAI_API_KEY", "gpt-5.6-luna", "gpt-5.6-terra",
  "model-policy.patient", "prompt.patient-evaluation", "test-key-not-real"
]) check(`browser bundle excludes ${token}`, !browserBundle.includes(token));

const failures = checks.filter((entry) => !entry.condition);
if (failures.length > 0) {
  throw new Error(`V2-018 AI security audit failed:\n${failures.map((entry) => `- ${entry.name}`).join("\n")}`);
}

console.log(`V2_018_SECURITY_AUDIT=PASS assertions=${checks.length}/${checks.length}`);
console.log("BROWSER_OPENAI_DIRECT=ABSENT");
console.log("BROWSER_PROVIDER_SECRET=ABSENT");
console.log("PATIENT_AI_ACTIVATION=ABSENT");
console.log("CLINICAL_MUTATION_AUTHORITY=ABSENT");
