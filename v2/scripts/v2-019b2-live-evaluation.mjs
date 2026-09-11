import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  AiEvaluationRunRecordSchema,
  OpenAiResponsesProvider,
  SecureAiGateway,
  TrustedCapabilityRegistry,
  estimateEvaluationCostUsd,
  fetchAiHttpTransport
} from "../packages/ai-gateway/src/index.ts";
import {
  createClinicalInterpreterCapability,
  gradeClinicalInterpretation,
  reconcileClinicalInterpretation
} from "../packages/clinical-interpreter/src/index.ts";
import {
  createPatientConversationCapability,
  gradePatientConversationOutput
} from "../packages/patient-conversation/src/index.ts";
import { canonicalSerialize } from "../packages/case-schema/src/index.ts";
import { CLINICAL_INTERPRETER_EVALUATION_CORPUS } from "../tests/fixtures/clinical-interpreter.ts";
import {
  createV2019B2FreezeArtifact,
  interpreterEvaluationUserContent,
  PATIENT_CONVERSATION_EVALUATION_CORPUS,
  patientEvaluationUserContent,
  projectedEvaluationCost,
  V2_019B2_CANDIDATES,
  V2_019B2_REPETITIONS
} from "../tests/fixtures/v2-019b2-evaluation.ts";

const BLOCKED = "V2-019B2 — LIVE EVALUATION BLOCKED: OPENAI_API_KEY REQUIRED";
const FREEZE_PATH = resolve("evaluation/v2-019b2.freeze.json");
const PRIOR_DIAGNOSTIC_SPEND_USD = 0.194786 + 0.0037004;
const MAX_NEW_RUN_SPEND_USD = 4.8;
const MAX_CUMULATIVE_SPEND_USD = 5;
const nodeHashAdapter = Object.freeze({
  async sha256(value) {
    return createHash("sha256").update(value).digest("hex");
  }
});

function fail(message, exitCode = 2) {
  console.error(message);
  process.exitCode = exitCode;
}

function providerOutcome(code) {
  return ({
    AI_PROVIDER_RATE_LIMITED: "RATE_LIMITED",
    AI_PROVIDER_TIMEOUT: "TIMED_OUT",
    AI_PROVIDER_UNAVAILABLE: "UNAVAILABLE",
    AI_OUTPUT_INVALID: "MALFORMED_OUTPUT",
    AI_SCHEMA_MISMATCH: "SCHEMA_INVALID",
    AI_RESPONSE_REFUSED: "REFUSED",
    AI_PROVIDER_NOT_CONFIGURED: "CREDENTIAL_FAILURE",
    AI_PROVIDER_REJECTED_REQUEST: "REJECTED",
    AI_RESPONSE_INCOMPLETE: "INCOMPLETE"
  })[code] ?? "OTHER_FAILURE";
}

function recordCostUsd(record) {
  return estimateEvaluationCostUsd({
    model_id: record.model_id,
    input_tokens: record.input_tokens,
    output_tokens: record.output_tokens
  });
}

async function gatewayFor(model, capability, apiKey) {
  let now = 0;
  return new SecureAiGateway({
    registry: new TrustedCapabilityRegistry([capability]),
    provider: new OpenAiResponsesProvider({ api_key: apiKey, transport: fetchAiHttpTransport }),
    capacity: { async authorize() { return { allowed: true }; } },
    clock: { nowMilliseconds() { return now = Math.max(now + 1, performance.now()); } },
    logger: { log() {} }
  });
}

function taskId(capability, caseId, model, repetition) {
  const shortCapability = capability === "PATIENT_CONVERSATION" ? "patient" : "interpreter";
  const shortModel = model.endsWith("luna") ? "luna" : "terra";
  return `v2-019b2.${shortCapability}.${caseId.replaceAll("_", "-")}.${shortModel}.${repetition}`;
}

async function runTask(task, apiKey, freezeHash) {
  const capabilityDefinition = task.capability === "PATIENT_CONVERSATION"
    ? createPatientConversationCapability({ enabled: true, candidate_model: task.model })
    : createClinicalInterpreterCapability({ enabled: true, candidate_model: task.model });
  const gateway = await gatewayFor(task.model, capabilityDefinition, apiKey);
  const runId = taskId(task.capability, task.case.evaluation_case_id, task.model, task.repetition);
  const result = await gateway.execute({
    gateway_schema_version: "1.0",
    request_id: runId,
    correlation_id: runId,
    capability_id: task.capability,
    locale: task.case.locale,
    input: {
      user_content: task.capability === "PATIENT_CONVERSATION"
        ? patientEvaluationUserContent(task.case)
        : interpreterEvaluationUserContent(task.case)
    }
  });

  if (!result.success) {
    return {
      record: AiEvaluationRunRecordSchema.parse({
        evaluation_schema_version: "1.0",
        evaluation_run_id: runId,
        evaluation_freeze_hash: freezeHash,
        capability: task.capability,
        evaluation_case_id: task.case.evaluation_case_id,
        repetition_index: task.repetition,
        model_id: task.model,
        prompt_id: capabilityDefinition.data.prompt.prompt_id,
        prompt_version: capabilityDefinition.data.prompt.prompt_version,
        output_schema_id: capabilityDefinition.data.output.output_schema_id,
        output_schema_version: capabilityDefinition.data.output.output_schema_version,
        provider_outcome: providerOutcome(result.error.code),
        schema_valid: false,
        local_validation_valid: false,
        hard_safety_violations: [],
        metrics: [],
        latency_ms: result.metadata?.latency_ms ?? 0,
        input_tokens: result.metadata?.usage?.input_tokens ?? 0,
        output_tokens: result.metadata?.usage?.output_tokens ?? 0,
        total_tokens: result.metadata?.usage?.total_tokens ?? 0,
        output_hash: null
      })
    };
  }

  let grade;
  let patientUtterance;
  if (task.capability === "PATIENT_CONVERSATION") {
    grade = gradePatientConversationOutput({ evaluation_case: task.case, output: result.output });
    patientUtterance = grade.output?.utterance;
  } else {
    const reconciled = reconcileClinicalInterpretation({
      model_output: result.output,
      context: {
        context_schema_version: "1.0",
        locale: task.case.locale,
        learner_action_catalogue: task.case.learner_action_catalogue
      }
    });
    grade = reconciled.success
      ? gradeClinicalInterpretation({ evaluation_case: task.case, interpretation: reconciled.interpretation })
      : {
          schema_valid: true,
          local_validation_valid: false,
          hard_safety_violations: [],
          metrics: [{ metric_code: "LOCAL_VALIDATION_SUCCESS", passed: false }]
        };
  }
  const outputHash = await nodeHashAdapter.sha256(canonicalSerialize(result.output));
  return {
    record: AiEvaluationRunRecordSchema.parse({
      evaluation_schema_version: "1.0",
      evaluation_run_id: runId,
      evaluation_freeze_hash: freezeHash,
      capability: task.capability,
      evaluation_case_id: task.case.evaluation_case_id,
      repetition_index: task.repetition,
      model_id: task.model,
      prompt_id: capabilityDefinition.data.prompt.prompt_id,
      prompt_version: capabilityDefinition.data.prompt.prompt_version,
      output_schema_id: capabilityDefinition.data.output.output_schema_id,
      output_schema_version: capabilityDefinition.data.output.output_schema_version,
      provider_outcome: "COMPLETED",
      schema_valid: grade.schema_valid,
      local_validation_valid: grade.local_validation_valid,
      hard_safety_violations: [...grade.hard_safety_violations],
      metrics: [...grade.metrics],
      latency_ms: result.metadata.latency_ms,
      input_tokens: result.metadata.usage?.input_tokens ?? 0,
      output_tokens: result.metadata.usage?.output_tokens ?? 0,
      total_tokens: result.metadata.usage?.total_tokens ?? 0,
      output_hash: outputHash
    }),
    patientUtterance
  };
}

async function runBounded(tasks, concurrency, worker) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function consume() {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await worker(tasks[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, consume));
  return results;
}

async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeJsonAtomically(path, value) {
  const temporaryPath = `${path}.pending`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function main() {
  if (process.env.V2_ALLOW_LIVE_AI_EVAL !== "1") {
    fail("V2-019B2 live evaluation refused: set V2_ALLOW_LIVE_AI_EVAL=1 explicitly.");
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    fail(BLOCKED);
    return;
  }

  const tracked = JSON.parse(await readFile(FREEZE_PATH, "utf8"));
  const recomputed = await createV2019B2FreezeArtifact(nodeHashAdapter);
  if (canonicalSerialize(tracked) !== canonicalSerialize(recomputed)) {
    fail("V2-019B2 live evaluation refused: tracked freeze does not match recomputed inputs.");
    return;
  }
  const cost = projectedEvaluationCost();
  if (cost.total_usd > tracked.freeze.pricing.hard_budget_usd) {
    fail("V2-019B2 — COST APPROVAL REQUIRED");
    return;
  }

  const tasks = [];
  for (let repetition = 1; repetition <= V2_019B2_REPETITIONS; repetition += 1) {
    for (const evaluationCase of PATIENT_CONVERSATION_EVALUATION_CORPUS) {
      for (const model of V2_019B2_CANDIDATES) {
        tasks.push({ capability: "PATIENT_CONVERSATION", case: evaluationCase, model, repetition });
      }
    }
    for (const evaluationCase of CLINICAL_INTERPRETER_EVALUATION_CORPUS) {
      for (const model of V2_019B2_CANDIDATES) {
        tasks.push({ capability: "CLINICAL_INTERPRETER", case: evaluationCase, model, repetition });
      }
    }
  }
  const outputDirectory = process.env.V2_EVALUATION_OUTPUT_DIR
    ? resolve(process.env.V2_EVALUATION_OUTPUT_DIR)
    : join(tmpdir(), "ai-clinical-simulation-v2-019b2");
  await mkdir(outputDirectory, { recursive: true });
  const resultsPath = join(outputDirectory, "normalized-results.json");
  const voiceCheckpointPath = join(outputDirectory, "patient-voice-safe-utterances.json");
  const existingResults = await readJsonIfPresent(resultsPath);
  if (existingResults !== undefined
    && existingResults.evaluation_freeze_hash !== tracked.evaluation_freeze_hash) {
    fail("V2-019B2 live evaluation refused: checkpoint freeze hash differs.");
    return;
  }
  const parsedExistingRecords = existingResults === undefined
    ? []
    : AiEvaluationRunRecordSchema.array().parse(existingResults.records);
  const expectedRunIds = new Set(tasks.map((task) =>
    taskId(task.capability, task.case.evaluation_case_id, task.model, task.repetition)));
  if (parsedExistingRecords.some((record) => !expectedRunIds.has(record.evaluation_run_id)
    || record.evaluation_freeze_hash !== tracked.evaluation_freeze_hash)) {
    fail("V2-019B2 live evaluation refused: checkpoint contains a foreign evaluation record.");
    return;
  }
  const resultsById = new Map(parsedExistingRecords.map((record) => [record.evaluation_run_id, record]));
  let actualNewRunSpendUsd = parsedExistingRecords.reduce(
    (sum, record) => sum + recordCostUsd(record),
    0
  );
  if (actualNewRunSpendUsd > MAX_NEW_RUN_SPEND_USD
    || PRIOR_DIAGNOSTIC_SPEND_USD + actualNewRunSpendUsd > MAX_CUMULATIVE_SPEND_USD) {
    fail("V2-019B2 — COST APPROVAL REQUIRED");
    return;
  }
  const existingVoice = await readJsonIfPresent(voiceCheckpointPath);
  if (existingVoice !== undefined
    && existingVoice.evaluation_freeze_hash !== tracked.evaluation_freeze_hash) {
    fail("V2-019B2 live evaluation refused: voice checkpoint freeze hash differs.");
    return;
  }
  const safeUtterances = new Map(Object.entries(existingVoice?.utterances ?? {}));
  const selectedCases = [
    ...PATIENT_CONVERSATION_EVALUATION_CORPUS.filter((item) => item.locale === "ar-JO").slice(0, 6),
    ...PATIENT_CONVERSATION_EVALUATION_CORPUS.filter((item) => item.locale === "en-US").slice(0, 6)
  ];
  const selectedVoiceCaseIds = new Set(selectedCases.map((item) => item.evaluation_case_id));
  let checkpointWrite = Promise.resolve();
  function persistCheckpoint() {
    checkpointWrite = checkpointWrite.then(async () => {
      const records = [...resultsById.values()].sort((left, right) =>
        left.evaluation_run_id.localeCompare(right.evaluation_run_id, "en-US"));
      await writeJsonAtomically(resultsPath, {
        evaluation_freeze_hash: tracked.evaluation_freeze_hash,
        records
      });
      await writeJsonAtomically(voiceCheckpointPath, {
        evaluation_freeze_hash: tracked.evaluation_freeze_hash,
        utterances: Object.fromEntries([...safeUtterances.entries()].sort())
      });
    });
    return checkpointWrite;
  }
  const pendingTasks = tasks.filter((task) => !resultsById.has(
    taskId(task.capability, task.case.evaluation_case_id, task.model, task.repetition)
  ));
  await runBounded(pendingTasks, tracked.freeze.maximum_concurrency, async (task) => {
    const item = await runTask(task, apiKey, tracked.evaluation_freeze_hash);
    const nextSpend = actualNewRunSpendUsd + recordCostUsd(item.record);
    if (nextSpend > MAX_NEW_RUN_SPEND_USD
      || PRIOR_DIAGNOSTIC_SPEND_USD + nextSpend > MAX_CUMULATIVE_SPEND_USD) {
      throw new Error("V2-019B2 — COST APPROVAL REQUIRED");
    }
    actualNewRunSpendUsd = nextSpend;
    resultsById.set(item.record.evaluation_run_id, item.record);
    if (task.capability === "PATIENT_CONVERSATION" && task.repetition === 1
      && selectedVoiceCaseIds.has(task.case.evaluation_case_id)
      && item.patientUtterance !== undefined) {
      safeUtterances.set(`${task.case.evaluation_case_id}:${task.model}:1`, item.patientUtterance);
    }
    await persistCheckpoint();
    return item;
  });
  const records = [...resultsById.values()].sort((left, right) =>
    left.evaluation_run_id.localeCompare(right.evaluation_run_id, "en-US"));

  const blindPairs = selectedCases.map((evaluationCase) => ({
    evaluation_case_id: evaluationCase.evaluation_case_id,
    category: evaluationCase.category,
    locale: evaluationCase.locale,
    question: evaluationCase.question,
    candidate_A: safeUtterances.get(`${evaluationCase.evaluation_case_id}:gpt-5.6-luna:1`),
    candidate_B: safeUtterances.get(`${evaluationCase.evaluation_case_id}:gpt-5.6-terra:1`)
  }));
  await writeFile(join(outputDirectory, "patient-voice-blind-review.json"), `${JSON.stringify({
    evaluation_freeze_hash: tracked.evaluation_freeze_hash,
    pairs: blindPairs
  }, null, 2)}\n`, "utf8");
  await writeFile(join(outputDirectory, "patient-voice-blind-mapping.json"), `${JSON.stringify({
    evaluation_freeze_hash: tracked.evaluation_freeze_hash,
    candidate_A: "gpt-5.6-luna",
    candidate_B: "gpt-5.6-terra"
  }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "LIVE_EVALUATION_COMPLETED",
    evaluation_freeze_hash: tracked.evaluation_freeze_hash,
    records: records.length,
    output_directory: outputDirectory
  }));
}

await main();
