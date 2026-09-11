import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const v2Root = fileURLToPath(new URL("../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function read(relative) {
  return readFile(join(v2Root, relative), "utf8");
}

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

const capability = await read("packages/clinical-interpreter/src/capability.ts");
const context = await read("packages/clinical-interpreter/src/context.ts");
const reconcile = await read("packages/clinical-interpreter/src/reconcile.ts");
const workflow = await read("packages/clinical-interpreter/src/workflow.ts");
const evaluation = await read("packages/clinical-interpreter/src/evaluation.ts");
const interpreterSource = `${capability}\n${context}\n${reconcile}\n${workflow}\n${evaluation}`;
const contracts = await read("packages/contracts/src/clinical-interpreter.ts");
const apiContracts = await read("packages/contracts/src/api-v1.ts");
const service = await read("packages/api-core/src/service/secure-api-service.ts");
const routes = await read("packages/api-core/src/http/create-api-app.ts");
const ui = await read("apps/web/src/features/actions/ClinicalInterpreterPanel.tsx");
const actionUi = await read("apps/web/src/features/actions/ClinicalActionsPanel.tsx");
const localization = await read("apps/web/src/app/localization.tsx");
const browserTests = await read("tests/browser/clinical-interpreter/clinical-interpreter.browser.test.ts");
const apiTests = await read("tests/browser/api/clinical-interpreter-api.browser.test.ts");
const uiTests = await read("tests/browser/student-ui/clinical-actions.browser.test.tsx");
const denoTests = await read("tests/deno/clinical_interpreter_test.ts");
const corpus = await read("tests/fixtures/clinical-interpreter.ts");
const portability = await read("scripts/portability-guard.mjs");
const packageJson = JSON.parse(await read("package.json"));

const checks = [];
function check(name, value) { checks.push({ name, pass: Boolean(value) }); }

check("01 distinct Clinical Interpreter package exists", await exists(join(v2Root, "packages/clinical-interpreter/package.json")));
check("02 trusted capability ID is CLINICAL_INTERPRETER", capability.includes('CLINICAL_INTERPRETER_CAPABILITY_ID: AiCapabilityId = "CLINICAL_INTERPRETER"'));
check("03 trusted prompt identity is server-owned", capability.includes('CLINICAL_INTERPRETER_PROMPT_ID = "prompt.clinical-interpreter"'));
check("04 trusted prompt version is pinned", capability.includes('CLINICAL_INTERPRETER_PROMPT_VERSION = "1.0"'));
check("05 capability has no tools", capability.includes("tools: []") && capability.includes("No tools are available"));
check("06 output budget is small and bounded", capability.includes("max_output_tokens: 1_536"));
check("07 Luna remains an evaluation candidate", corpus.includes("gpt-5.6-luna") || browserTests.includes("gpt-5.6-luna"));
check("08 Terra remains an evaluation candidate", browserTests.includes("gpt-5.6-terra"));
check("09 implementation selects no winner", !/winner|selected_model|production_model/iu.test(interpreterSource));
check("10 interpreter context is strict", contracts.includes("ClinicalInterpreterContextSchema = z.strictObject"));
check("11 context schema contains only locale and safe catalogue", contracts.includes("locale: PatientLanguageSchema") && contracts.includes("learner_action_catalogue: SafeLearnerActionCatalogueSchema"));
check("12 safe catalogue is runtime-validated", context.includes("SafeLearnerActionCatalogueSchema.safeParse"));
check("13 Case-owned aliases are learner-safe contract data", apiContracts.includes("LearnerActionAliasSchema") && apiContracts.includes("aliases:"));
check("14 safe parameter definitions remain in catalogue", apiContracts.includes("parameter_definitions: z.array(LearnerActionParameterDefinitionSchema)"));
check("15 Patient State is absent from interpreter core", !/PatientState|patient_state/u.test(interpreterSource));
check("16 rubric is absent from interpreter core", !/rubric/iu.test(interpreterSource));
check("17 expected-action truth is absent from interpreter core", !/expected_action/iu.test(interpreterSource));
check("18 package hashes are absent from interpreter context/core", !/package_hash/iu.test(interpreterSource));
check("19 scheduler authority is absent", !/scheduler/iu.test(interpreterSource));
check("20 clinical effects are absent", !/applyEffect|effect_proposal|clinical_effect/iu.test(interpreterSource));
check("21 RAG and retrieval are absent", !/\bRAG\b|embedding|vector search|retrieval/iu.test(interpreterSource));
check("22 interpreter core cannot submit Clinical Actions", !/submitClinicalAction|submitAction|SessionCoordinator/u.test(interpreterSource));
check("23 interpreter core cannot call actions/propose", !/actions\/propose/u.test(interpreterSource));
check("24 provider output is one strict root object", contracts.includes("ClinicalInterpreterProviderOutputSchema = z.strictObject"));
check("25 provider output schema version is pinned", contracts.includes('CLINICAL_INTERPRETER_MODEL_OUTPUT_SCHEMA_VERSION = "2.0"') && contracts.includes("output_schema_version: z.literal(CLINICAL_INTERPRETER_MODEL_OUTPUT_SCHEMA_VERSION)"));
check("26 provider output status is bounded", contracts.includes('status: z.enum(["MATCH", "AMBIGUOUS", "NO_MATCH"])'));
check("27 provider status reasons are explicit nullable fields", contracts.includes("ClinicalInterpreterAmbiguityReasonSchema.nullable()") && contracts.includes("ClinicalInterpreterNoMatchReasonSchema.nullable()"));
check("28 status-specific second refinement exists", contracts.includes(".superRefine((output, context)"));
check("29 candidate action identities are unique", contracts.includes("Interpreter candidate action identities must be unique"));
check("30 MATCH requires exactly one candidate", contracts.includes('output.status === "MATCH"') && contracts.includes("output.candidates.length === 1"));
check("31 AMBIGUOUS requires multiple candidates", contracts.includes('output.status === "AMBIGUOUS"') && contracts.includes("output.candidates.length >= 2"));
check("32 NO_MATCH requires zero candidates", contracts.includes("output.candidates.length === 0"));
check("33 model output rejects unknown fields", browserTests.includes("unknown structured fields") && browserTests.includes('prompt: "secret"'));
check("34 public interpretation declares NON_AUTHORITATIVE", contracts.includes('authority: z.literal("NON_AUTHORITATIVE")'));
check("35 second local model-output validation exists", reconcile.includes("ClinicalInterpreterModelOutputSchema.safeParse"));
check("36 action ID is reconciled against catalogue membership", reconcile.includes("actions.get(candidate.action_id)"));
check("37 extra parameters fail closed", reconcile.includes("if (definition === undefined || definition.value_type !== entry.value_type) return undefined"));
check("38 parameter primitive types are checked", reconcile.includes("function parameterMatches") && reconcile.includes('definition.value_type === "NUMBER"'));
check("39 allowed code values are checked", reconcile.includes("definition.allowed_codes.some"));
check("40 numeric bounds are checked", reconcile.includes("definition.minimum") && reconcile.includes("definition.maximum"));
check("41 missing required parameters are recomputed", reconcile.includes("unresolved = action.parameter_definitions") && reconcile.includes("Object.hasOwn"));
check("42 unresolved parameters are deterministically sorted", reconcile.includes(".sort();"));
check("43 Case confirmation policy is restored locally", reconcile.includes("confirmation_policy: action.confirmation_policy"));
check("44 unlisted action becomes explicit NO_MATCH", reconcile.includes('no_match_reason: "UNAVAILABLE_ACTION"'));
check("45 malformed output is distinct from outage", workflow.includes('gatewayResult.error.code === "AI_OUTPUT_INVALID"') && workflow.includes('"INTERPRETER_OUTPUT_INVALID"'));
check("46 Secure AI Gateway is the provider boundary", workflow.includes("SecureAiGateway") && workflow.includes("input.gateway.execute"));
check("47 gateway result is locally parsed", workflow.includes("AiGatewayResultSchema.parse"));
check("48 provider input is canonically serialized", workflow.includes("canonicalSerialize"));
check("49 learner utterance is explicitly marked untrusted", workflow.includes("untrusted_learner_utterance"));
check("50 provider output is reconciled after gateway success", workflow.includes("reconcileClinicalInterpretation"));
check("51 interpreter has no clock/state mutation calls", !/Date\.now|performance\.now|setInterval|setTimeout|advanceClinical|state_version\s*[+]=?/u.test(interpreterSource));
check("52 secured interpretation route exists", routes.includes('/v1/sessions/:session_id/actions/interpret'));
check("53 Session authorization precedes workflow", service.indexOf("const loaded = await authorizeAndLoad", service.indexOf("async function interpretClinicalAction")) < service.indexOf("executeClinicalInterpreter", service.indexOf("async function interpretClinicalAction")));
check("54 ended Session fails before provider use", service.includes('loaded.data.session.status === "ENDED"'));
check("55 API derives catalogue from authoritative Session", service.includes("safeLearnerActionCatalogue(") && service.includes("loaded.data.session"));
check("56 public request schema is strict and localized", contracts.includes("SubmitClinicalInterpretationRequestSchema = z.strictObject") && contracts.includes("locale: PatientLanguageSchema"));
check("57 browser model/prompt/schema/tools/effects injection is rejected", apiTests.includes('"model", "prompt", "schema", "tools", "effects", "patient_state"'));
check("58 response binds grounded authoritative State version", service.includes("grounded_state_version: loaded.data.session.patient_state.state_version"));
check("59 interpretation endpoint appends no authoritative Event", !/appendConversationEvent|committed_events\.push/u.test(service.slice(service.indexOf("async function interpretClinicalAction"), service.indexOf("async function getInvestigationResult"))));
check("60 actions/propose remains the execution route", routes.includes('/v1/sessions/:session_id/actions/propose'));
check("61 Clinical Interpreter has a distinct UI panel", actionUi.includes("<ClinicalInterpreterPanel") && ui.includes("clinical-interpreter"));
check("62 Patient Conversation remains on History only", actionUi.includes('domain === "HISTORY"') && actionUi.includes("<PatientConversationPanel"));
check("63 interpretation only populates manual form", actionUi.includes("onRecognized={useInterpretedAction}") && ui.includes("onRecognized(action, interpretation.candidate.parameters)"));
check("64 existing confirmation boundary remains present", actionUi.includes('phase === "AWAITING_CONFIRMATION"') && actionUi.includes("confirmation_policy"));
check("65 stale interpretation is rejected by state version", ui.includes("result.grounded_state_version !== stateVersion"));
check("66 manual action catalogue remains rendered", actionUi.includes("visibleActions.map"));
check("67 provider unavailable has explicit UI state", ui.includes('phase === "UNAVAILABLE"') && localization.includes("Interpreter unavailable"));
check("68 ended Session disables interpreter", actionUi.includes("enabled={enabled && state.kind !== \"ENDED\"}"));
check("69 canonical Patient locales are ar-JO and en-US", contracts.includes("PatientLanguageSchema") && corpus.includes('"ar-JO"') && corpus.includes('"en-US"'));
check("70 plain en is rejected by permanent test", browserTests.includes('locale: "en"') && browserTests.includes(".success).toBe(false)"));
check("71 internal UJ code is absent", !/\bUJ\b/u.test(`${interpreterSource}\n${contracts}\n${service}\n${ui}\n${localization}`));
check("72 all 18 evaluation categories exist", (evaluation.match(/^  "[A-Z_]+",?$/gmu) ?? []).length >= 18);
check("73 deterministic corpus contains 54 cases", corpus.includes("Array.from({ length: 54 }"));
check("74 metrics contract is strict", evaluation.includes("ClinicalInterpreterEvaluationMetricsSchema = z.strictObject"));
check("75 required B2 safety and quality metrics exist", evaluation.includes("false_positive_execution_intent_rate_basis_points") && evaluation.includes("prompt_injection_leakage_rate_basis_points") && evaluation.includes("provider_failure_rate_basis_points"));
check("76 metrics contain no weights or winner", !/weights|winner/iu.test(evaluation));
check("77 no live comparative evaluation exists", !/Promise\.all|fetch\(|new OpenAI|api\.openai\.com/u.test(evaluation));
check("78 focused Browser tests exist", await exists(join(v2Root, "tests/browser/clinical-interpreter/clinical-interpreter.browser.test.ts")));
check("79 focused Deno tests import the same source", denoTests.includes("packages/clinical-interpreter/src/index.ts"));
check("80 API authorization tests exist", apiTests.includes("denies unauthenticated, disabled-member, foreign-user, and cross-tenant"));
check("81 UI separation and stale tests exist", uiTests.includes("distinct input surfaces") && uiTests.includes("stale interpretation"));
check("82 focused Playwright workflow exists", typeof packageJson.scripts["test:v2-019b1:playwright"] === "string" && await exists(join(v2Root, "tests/browser/v2-019b1-e2e/clinical-interpreter.spec.ts")));
check("83 portability guard scans interpreter core", portability.includes("packages/clinical-interpreter/src/"));
check("84 generic interpreter has no disease-specific logic", !/STEMI|anaphylaxis|myocardial infarction|epinephrine|nitroglycerin|aspirin/iu.test(interpreterSource));

const docs = [
  "V2-019B1_CLINICAL_INTERPRETER_ARCHITECTURE.md",
  "V2-019B1_INTERPRETATION_CONTRACT_AND_AMBIGUITY.md",
  "V2-019B1_INTENT_EXECUTION_BOUNDARY.md",
  "V2-019B1_LOCALIZATION_AND_LANGUAGE_SAFETY.md",
  "V2-019B1_MODEL_EVALUATION_FOUNDATION.md",
  "V2-019B1_SECURITY_AND_DISCLOSURE.md",
  "V2-019B1_VERIFICATION_REPORT.md"
];
check("85 all canonical V2-019B1 documentation exists", (await Promise.all(docs.map((file) => exists(join(repositoryRoot, "planning_input", "v2-019", file))))).every(Boolean));
check("86 no nested v2/planning_input B1 documentation exists", !(await exists(join(v2Root, "planning_input", "v2-019", docs[0]))));
check("87 no secret, remote provider, media, B2, or deployment scope exists", !/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b|https:\/\/[a-z0-9]+\.supabase\.co|Meshy|diagnostic.media|V2-019B2|deploy/iu.test(`${interpreterSource}\n${service}\n${ui}`));

if (checks.length !== 87) throw new Error(`Audit definition error: expected 87 checks, found ${checks.length}.`);
const failed = checks.filter((entry) => !entry.pass);
for (const item of checks) console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name}`);
if (failed.length > 0) throw new Error(`${failed.length} V2-019B1 audit check(s) failed.`);
console.log("V2-019B1 Clinical Interpreter audit: 87/87 PASS");
