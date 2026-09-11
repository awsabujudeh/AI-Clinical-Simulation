import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AiEvaluationRunRecordSchema,
  estimateEvaluationCostUsd
} from "../packages/ai-gateway/src/index.ts";
import {
  CLINICAL_INTERPRETER_EVALUATION_METHODOLOGY
} from "../packages/clinical-interpreter/src/index.ts";
import {
  PATIENT_CONVERSATION_EVALUATION_METHODOLOGY
} from "../packages/patient-conversation/src/index.ts";
import { canonicalSerialize } from "../packages/case-schema/src/index.ts";
import { CLINICAL_INTERPRETER_EVALUATION_CORPUS } from "../tests/fixtures/clinical-interpreter.ts";
import { PATIENT_CONVERSATION_EVALUATION_CORPUS } from "../tests/fixtures/v2-019b2-evaluation.ts";

const FREEZE_HASH = "f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523";
const MODELS = ["gpt-5.6-luna", "gpt-5.6-terra"];
const CAPABILITIES = ["PATIENT_CONVERSATION", "CLINICAL_INTERPRETER"];
const checkpointPath = process.env.V2_EVALUATION_RESULTS_PATH
  ?? join(tmpdir(), "ai-clinical-simulation-v2-019b2", "normalized-results.json");
const checkpointText = await readFile(checkpointPath, "utf8");
const checkpoint = JSON.parse(checkpointText);
if (checkpoint.evaluation_freeze_hash !== FREEZE_HASH) throw new Error("Freeze mismatch.");
const records = AiEvaluationRunRecordSchema.array().parse(checkpoint.records);

const caseMetadata = new Map([
  ...PATIENT_CONVERSATION_EVALUATION_CORPUS.map((item) => [item.evaluation_case_id, item]),
  ...CLINICAL_INTERPRETER_EVALUATION_CORPUS.map((item) => [item.evaluation_case_id, item])
]);

const expectedRunIds = new Set();
for (const capability of CAPABILITIES) {
  const corpus = capability === "PATIENT_CONVERSATION"
    ? PATIENT_CONVERSATION_EVALUATION_CORPUS
    : CLINICAL_INTERPRETER_EVALUATION_CORPUS;
  for (const evaluationCase of corpus) {
    for (let repetition = 1; repetition <= 3; repetition += 1) {
      for (const model of MODELS) {
        const shortCapability = capability === "PATIENT_CONVERSATION" ? "patient" : "interpreter";
        const shortModel = model.endsWith("luna") ? "luna" : "terra";
        expectedRunIds.add(
          `v2-019b2.${shortCapability}.${evaluationCase.evaluation_case_id.replaceAll("_", "-")}.${shortModel}.${repetition}`
        );
      }
    }
  }
}
const actualRunIds = new Set(records.map((record) => record.evaluation_run_id));
if (records.length !== 648 || actualRunIds.size !== 648 || expectedRunIds.size !== 648) {
  throw new Error("The evaluation matrix is not complete and unique.");
}
if ([...expectedRunIds].some((runId) => !actualRunIds.has(runId))) {
  throw new Error("The evaluation checkpoint is missing a frozen identity.");
}
if (records.some((record) => record.evaluation_freeze_hash !== FREEZE_HASH)) {
  throw new Error("The evaluation checkpoint contains a mixed freeze hash.");
}
for (const record of records) {
  const metadata = caseMetadata.get(record.evaluation_case_id);
  if (metadata === undefined) throw new Error("The evaluation checkpoint contains an unknown case.");
  const expectedCapability = record.evaluation_case_id.startsWith("patient-eval.")
    ? "PATIENT_CONVERSATION"
    : "CLINICAL_INTERPRETER";
  if (record.capability !== expectedCapability) {
    throw new Error("The evaluation checkpoint contains a case/capability mismatch.");
  }
}

function basisPoints(numerator, denominator) {
  return denominator === 0 ? 0 : Math.round(numerator * 10_000 / denominator);
}

function percentile(values, proportion) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(proportion * sorted.length) - 1)];
}

function exactSuccess(record) {
  return record.provider_outcome === "COMPLETED"
    && record.schema_valid
    && record.local_validation_valid
    && record.hard_safety_violations.length === 0
    && record.metrics.length > 0
    && record.metrics.every((metric) => metric.passed);
}

function semanticSignature(record) {
  return canonicalSerialize({
    provider_outcome: record.provider_outcome,
    schema_valid: record.schema_valid,
    local_validation_valid: record.local_validation_valid,
    hard_safety_violations: record.hard_safety_violations,
    metrics: record.metrics
  });
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

function pairedBootstrap(differences, samples = 10_000) {
  const random = lcg(0x019b2);
  const estimates = [];
  for (let sample = 0; sample < samples; sample += 1) {
    let sum = 0;
    for (let index = 0; index < differences.length; index += 1) {
      sum += differences[Math.floor(random() * differences.length)];
    }
    estimates.push(sum / differences.length);
  }
  return {
    samples,
    lower_95_basis_points: Math.round(percentile(estimates, 0.025) * 10_000),
    upper_95_basis_points: Math.round(percentile(estimates, 0.975) * 10_000)
  };
}

function summarize(capability, model) {
  const subset = records.filter((record) =>
    record.capability === capability && record.model_id === model);
  const metricCodes = capability === "PATIENT_CONVERSATION"
    ? PATIENT_CONVERSATION_EVALUATION_METHODOLOGY.metric_codes
    : CLINICAL_INTERPRETER_EVALUATION_METHODOLOGY.metric_codes;
  const metricRates = Object.fromEntries(metricCodes.map((metricCode) => {
    const passed = subset.filter((record) =>
      record.metrics.some((metric) => metric.metric_code === metricCode && metric.passed)).length;
    return [metricCode, { passed, total: subset.length, basis_points: basisPoints(passed, subset.length) }];
  }));
  const providerOutcomes = Object.fromEntries(
    [...new Set(subset.map((record) => record.provider_outcome))].sort().map((outcome) => [
      outcome,
      subset.filter((record) => record.provider_outcome === outcome).length
    ])
  );
  const safetyViolations = Object.fromEntries(
    [...new Set(subset.flatMap((record) => record.hard_safety_violations))].sort().map((code) => [
      code,
      subset.filter((record) => record.hard_safety_violations.includes(code)).length
    ])
  );
  const exact = subset.filter(exactSuccess).length;
  const byCategory = Object.fromEntries(
    [...new Set(subset.map((record) => caseMetadata.get(record.evaluation_case_id).category))]
      .sort()
      .map((category) => {
        const categoryRecords = subset.filter((record) =>
          caseMetadata.get(record.evaluation_case_id).category === category);
        const passed = categoryRecords.filter(exactSuccess).length;
        return [category, {
          passed,
          total: categoryRecords.length,
          basis_points: basisPoints(passed, categoryRecords.length)
        }];
      })
  );
  const byLocale = Object.fromEntries(["ar-JO", "en-US"].map((locale) => {
    const localeRecords = subset.filter((record) =>
      caseMetadata.get(record.evaluation_case_id).locale === locale);
    const passed = localeRecords.filter(exactSuccess).length;
    return [locale, {
      passed,
      total: localeRecords.length,
      basis_points: basisPoints(passed, localeRecords.length)
    }];
  }));
  const semanticUnstable = new Set();
  const outputUnstable = new Set();
  for (const caseId of new Set(subset.map((record) => record.evaluation_case_id))) {
    const repetitions = subset.filter((record) => record.evaluation_case_id === caseId);
    if (new Set(repetitions.map(semanticSignature)).size > 1) semanticUnstable.add(caseId);
    if (new Set(repetitions.map((record) => record.output_hash ?? `NO_OUTPUT:${record.provider_outcome}`)).size > 1) {
      outputUnstable.add(caseId);
    }
  }
  const latencies = subset.map((record) => record.latency_ms);
  const inputTokens = subset.reduce((sum, record) => sum + record.input_tokens, 0);
  const outputTokens = subset.reduce((sum, record) => sum + record.output_tokens, 0);
  return {
    records: subset.length,
    hard_safety_eligible: subset.every((record) => record.hard_safety_violations.length === 0),
    hard_safety_record_count: subset.filter((record) => record.hard_safety_violations.length > 0).length,
    hard_safety_violations: safetyViolations,
    provider_outcomes: providerOutcomes,
    schema_valid: subset.filter((record) => record.schema_valid).length,
    local_validation_valid: subset.filter((record) => record.local_validation_valid).length,
    exact_success: {
      passed: exact,
      total: subset.length,
      basis_points: basisPoints(exact, subset.length)
    },
    metrics: metricRates,
    by_category: byCategory,
    by_locale: byLocale,
    repetition_instability: {
      semantic_unstable_cases: semanticUnstable.size,
      output_hash_unstable_cases: outputUnstable.size,
      total_cases: new Set(subset.map((record) => record.evaluation_case_id)).size
    },
    latency_ms: {
      median: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95)
    },
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    cost_usd: Number(estimateEvaluationCostUsd({
      model_id: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens
    }).toFixed(8))
  };
}

const summaries = Object.fromEntries(CAPABILITIES.flatMap((capability) =>
  MODELS.map((model) => [`${capability}:${model}`, summarize(capability, model)])));

const paired = Object.fromEntries(CAPABILITIES.map((capability) => {
  const differences = [];
  for (const evaluationCase of capability === "PATIENT_CONVERSATION"
    ? PATIENT_CONVERSATION_EVALUATION_CORPUS
    : CLINICAL_INTERPRETER_EVALUATION_CORPUS) {
    for (let repetition = 1; repetition <= 3; repetition += 1) {
      const pair = MODELS.map((model) => records.find((record) =>
        record.capability === capability
        && record.model_id === model
        && record.evaluation_case_id === evaluationCase.evaluation_case_id
        && record.repetition_index === repetition));
      if (pair.some((record) => record === undefined)) throw new Error("Incomplete pair.");
      differences.push(Number(exactSuccess(pair[1])) - Number(exactSuccess(pair[0])));
    }
  }
  const delta = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  return [capability, {
    comparison: "TERRA_MINUS_LUNA_EXACT_SUCCESS",
    pairs: differences.length,
    delta_basis_points: Math.round(delta * 10_000),
    bootstrap: pairedBootstrap(differences)
  }];
}));

const hardSafetyRecords = records
  .filter((record) => record.hard_safety_violations.length > 0)
  .map((record) => ({
    capability: record.capability,
    model_id: record.model_id,
    evaluation_case_id: record.evaluation_case_id,
    category: caseMetadata.get(record.evaluation_case_id).category,
    repetition_index: record.repetition_index,
    violations: record.hard_safety_violations
  }));

const providerFailureRecords = records
  .filter((record) => record.provider_outcome !== "COMPLETED")
  .map((record) => ({
    capability: record.capability,
    model_id: record.model_id,
    evaluation_case_id: record.evaluation_case_id,
    repetition_index: record.repetition_index,
    provider_outcome: record.provider_outcome
  }));

const result = {
  analysis_version: "1.0",
  evaluation_freeze_hash: FREEZE_HASH,
  normalized_results_sha256: createHash("sha256").update(checkpointText).digest("hex"),
  total_records: records.length,
  unique_run_ids: new Set(records.map((record) => record.evaluation_run_id)).size,
  summaries,
  paired_exact_success: paired,
  hard_safety_records: hardSafetyRecords,
  provider_failure_records: providerFailureRecords,
  total_selection_cost_usd: Number(records.reduce(
    (sum, record) => sum + estimateEvaluationCostUsd({
      model_id: record.model_id,
      input_tokens: record.input_tokens,
      output_tokens: record.output_tokens
    }),
    0
  ).toFixed(8)),
  statistical_limitations: [
    "Synthetic corpus only; no real patient data or PHI.",
    "Exact-success bootstrap treats each case/repetition pair as the resampling unit.",
    "The frozen deterministic grader evaluates structured safety and correctness, not clinical realism or human voice preference.",
    "The 12-pair blinded voice artifact requires separate human review and cannot override hard-safety eligibility."
  ]
};

console.log(JSON.stringify(result, null, 2));
