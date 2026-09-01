import { z } from "zod";

import {
  CaseControlledValueSchema,
  RealUtcTimeSchema,
  RuleIdSchema,
  SemanticVersionSchema,
  type HashAdapter,
  type ImmediateStateEffect,
  type RuleCondition,
  type StateScalarTarget,
  type TransitionRule
} from "../../contracts/src/index.ts";

import { computeReviewSubjectHash, hashCanonicalJson } from "./hashing.ts";
import {
  DraftCasePackageSchema,
  HashDigestSchema,
  RULE_REACHABILITY_VALIDATION_CODE,
  ValidationEvidenceSchema,
  type DraftCasePackage,
  type HashDigest,
  type ValidationEvidence
} from "./schemas.ts";

export const RULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION = "1.1" as const;
export const RULE_REACHABILITY_ANALYZER_ID = "validator.rule-reachability.v1" as const;
export const RULE_REACHABILITY_ANALYZER_VERSION = "1.1.0" as const;

export const OBSERVATION_DRIVING_STATE_TARGETS = [
  "hemodynamic_state",
  "cardiac_rhythm",
  "respiratory_state",
  "oxygenation",
  "consciousness",
  "temperature_state"
] as const satisfies readonly StateScalarTarget[];

const ReachableStateValuesSchema = z.strictObject({
  clinical_phase: z.array(CaseControlledValueSchema),
  hemodynamic_state: z.array(CaseControlledValueSchema),
  cardiac_rhythm: z.array(CaseControlledValueSchema),
  perfusion: z.array(CaseControlledValueSchema),
  respiratory_state: z.array(CaseControlledValueSchema),
  oxygenation: z.array(CaseControlledValueSchema),
  consciousness: z.array(CaseControlledValueSchema),
  neurologic_state: z.array(CaseControlledValueSchema),
  temperature_state: z.array(CaseControlledValueSchema),
  metabolic_state: z.array(CaseControlledValueSchema)
});

export const ReachabilityProjectionCoverageIssueSchema = z.strictObject({
  state_target: z.enum(OBSERVATION_DRIVING_STATE_TARGETS),
  state_value: CaseControlledValueSchema,
  mapping_path: z.string().min(1).max(300)
});
export type ReachabilityProjectionCoverageIssue = z.infer<
  typeof ReachabilityProjectionCoverageIssueSchema
>;

export const UnreachableRuleSchema = z.strictObject({
  rule_id: RuleIdSchema,
  reason_codes: z.array(CaseControlledValueSchema).min(1).max(8)
});

export const SchedulerLivenessFindingSchema = z.strictObject({
  code: z.enum([
    "liveness.absolute-nonfuture",
    "liveness.absolute-self-cycle"
  ]),
  path: z.string().min(1).max(300),
  rule_id: RuleIdSchema,
  effect_id: CaseControlledValueSchema,
  scheduled_item_id: CaseControlledValueSchema
});
export type SchedulerLivenessFinding = z.infer<typeof SchedulerLivenessFindingSchema>;

export const RuleReachabilityAnalysisSchema = z.strictObject({
  analysis_schema_version: z.literal(RULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION),
  analyzer_id: z.literal(RULE_REACHABILITY_ANALYZER_ID),
  analyzer_version: z.literal(RULE_REACHABILITY_ANALYZER_VERSION),
  result: z.enum(["PASSED", "FAILED"]),
  reachable_rule_ids: z.array(RuleIdSchema),
  unreachable_rules: z.array(UnreachableRuleSchema),
  reachable_state_values: ReachableStateValuesSchema,
  projection_coverage_issues: z.array(ReachabilityProjectionCoverageIssueSchema),
  scheduler_liveness_findings: z.array(SchedulerLivenessFindingSchema)
});
export type RuleReachabilityAnalysis = z.infer<typeof RuleReachabilityAnalysisSchema>;

export const GeneratedRuleReachabilityEvidenceSchema = z.strictObject({
  review_subject_hash: HashDigestSchema,
  analysis: RuleReachabilityAnalysisSchema,
  evidence: ValidationEvidenceSchema
});
export type GeneratedRuleReachabilityEvidence = z.infer<
  typeof GeneratedRuleReachabilityEvidenceSchema
>;

type ReachabilityState = {
  scalarValues: Record<StateScalarTarget, Set<string>>;
  interventionPresent: Set<string>;
  interventionAbsent: Set<string>;
  complicationPresent: Set<string>;
  complicationAbsent: Set<string>;
  outcomePresent: Set<string>;
  outcomeAbsent: Set<string>;
  scheduledItemIds: Set<string>;
  scheduledCategories: Set<string>;
};

function allScalarTargets(): StateScalarTarget[] {
  return [
    "clinical_phase",
    "hemodynamic_state",
    "cardiac_rhythm",
    "perfusion",
    "respiratory_state",
    "oxygenation",
    "consciousness",
    "neurologic_state",
    "temperature_state",
    "metabolic_state"
  ];
}

function collectReferencedCollectionIds(casePackage: DraftCasePackage) {
  const interventionIds = new Set<string>(
    casePackage.initial_state.patient_state.active_interventions.map((item) => item.intervention_id)
  );
  const complicationIds = new Set<string>(
    casePackage.initial_state.patient_state.active_complications.map((item) => item.complication_id)
  );
  const outcomeFlags = new Set<string>(casePackage.initial_state.patient_state.outcome_flags);

  for (const rule of casePackage.rules.rules) {
    for (const condition of [
      ...rule.preconditions,
      ...rule.exclusions,
      ...(rule.trigger.trigger_type === "STATE_CONDITION" ? rule.trigger.conditions : [])
    ]) {
      if (
        condition.condition_type === "INTERVENTION_PRESENT"
        || condition.condition_type === "INTERVENTION_ABSENT"
      ) {
        interventionIds.add(condition.intervention_id);
      } else if (
        condition.condition_type === "COMPLICATION_PRESENT"
        || condition.condition_type === "COMPLICATION_ABSENT"
      ) {
        complicationIds.add(condition.complication_id);
      } else if (
        condition.condition_type === "OUTCOME_FLAG_PRESENT"
        || condition.condition_type === "OUTCOME_FLAG_ABSENT"
      ) {
        outcomeFlags.add(condition.outcome_flag);
      }
    }

    for (const effect of rule.effects) {
      const effects = effect.effect_type === "SCHEDULE_RELATIVE"
        || effect.effect_type === "SCHEDULE_ABSOLUTE"
        ? effect.effects
        : effect.effect_type === "CANCEL_SCHEDULED"
          ? []
          : [effect];
      for (const nestedEffect of effects) {
        if (
          nestedEffect.effect_type === "ADD_INTERVENTION"
          || nestedEffect.effect_type === "REMOVE_INTERVENTION"
        ) {
          interventionIds.add(nestedEffect.intervention_id);
        } else if (
          nestedEffect.effect_type === "ADD_COMPLICATION"
          || nestedEffect.effect_type === "REMOVE_COMPLICATION"
        ) {
          complicationIds.add(nestedEffect.complication_id);
        } else if (
          nestedEffect.effect_type === "ADD_OUTCOME_FLAG"
          || nestedEffect.effect_type === "REMOVE_OUTCOME_FLAG"
        ) {
          outcomeFlags.add(nestedEffect.outcome_flag);
        }
      }
    }
  }

  return { interventionIds, complicationIds, outcomeFlags };
}

function initialReachabilityState(casePackage: DraftCasePackage): ReachabilityState {
  const patientState = casePackage.initial_state.patient_state;
  const scalarValues = Object.fromEntries(
    allScalarTargets().map((target) => [target, new Set<string>([patientState[target]])])
  ) as Record<StateScalarTarget, Set<string>>;
  const { interventionIds, complicationIds, outcomeFlags } =
    collectReferencedCollectionIds(casePackage);
  const activeInterventions = new Set<string>(
    patientState.active_interventions.map((item) => item.intervention_id)
  );
  const activeComplications = new Set<string>(
    patientState.active_complications.map((item) => item.complication_id)
  );
  const activeOutcomes = new Set<string>(patientState.outcome_flags);

  const state: ReachabilityState = {
    scalarValues,
    interventionPresent: activeInterventions,
    interventionAbsent: new Set([...interventionIds].filter((id) => !activeInterventions.has(id))),
    complicationPresent: activeComplications,
    complicationAbsent: new Set([...complicationIds].filter((id) => !activeComplications.has(id))),
    outcomePresent: activeOutcomes,
    outcomeAbsent: new Set([...outcomeFlags].filter((flag) => !activeOutcomes.has(flag))),
    scheduledItemIds: new Set(
      casePackage.timeline_policy.initial_scheduled_items.map((item) => item.scheduled_item_id)
    ),
    scheduledCategories: new Set(
      casePackage.timeline_policy.initial_scheduled_items.map((item) => item.category)
    )
  };

  for (const item of casePackage.timeline_policy.initial_scheduled_items) {
    for (const effect of item.effects) {
      applyReachableImmediateEffect(effect, state);
    }
  }

  return state;
}

function conditionPossiblyTrue(
  condition: RuleCondition,
  state: ReachabilityState,
  caseFactIds: ReadonlySet<string>
): boolean {
  switch (condition.condition_type) {
    case "STATE_EQUALS":
      return state.scalarValues[condition.target].has(condition.value);
    case "STATE_NOT_EQUALS":
      return [...state.scalarValues[condition.target]].some((value) => value !== condition.value);
    case "INTERVENTION_PRESENT":
      return state.interventionPresent.has(condition.intervention_id);
    case "INTERVENTION_ABSENT":
      return state.interventionAbsent.has(condition.intervention_id);
    case "COMPLICATION_PRESENT":
      return state.complicationPresent.has(condition.complication_id);
    case "COMPLICATION_ABSENT":
      return state.complicationAbsent.has(condition.complication_id);
    case "OUTCOME_FLAG_PRESENT":
      return state.outcomePresent.has(condition.outcome_flag);
    case "OUTCOME_FLAG_ABSENT":
      return state.outcomeAbsent.has(condition.outcome_flag);
    case "CLINICAL_TIME_COMPARE":
      return condition.operator !== "LT" || condition.clinical_time > 0;
    case "TRIGGER_EVENT_TYPE":
    case "TRIGGER_ACTION_ID":
    case "PRIOR_EVENT_OCCURRED":
      return true;
    case "CASE_FACT_PRESENT":
      return caseFactIds.has(condition.fact_id);
  }
}

function conditionAlwaysTrue(
  condition: RuleCondition,
  state: ReachabilityState,
  caseFactIds: ReadonlySet<string>
): boolean {
  switch (condition.condition_type) {
    case "STATE_EQUALS": {
      const values = state.scalarValues[condition.target];
      return values.size === 1 && values.has(condition.value);
    }
    case "STATE_NOT_EQUALS":
      return !state.scalarValues[condition.target].has(condition.value);
    case "INTERVENTION_PRESENT":
      return state.interventionPresent.has(condition.intervention_id)
        && !state.interventionAbsent.has(condition.intervention_id);
    case "INTERVENTION_ABSENT":
      return state.interventionAbsent.has(condition.intervention_id)
        && !state.interventionPresent.has(condition.intervention_id);
    case "COMPLICATION_PRESENT":
      return state.complicationPresent.has(condition.complication_id)
        && !state.complicationAbsent.has(condition.complication_id);
    case "COMPLICATION_ABSENT":
      return state.complicationAbsent.has(condition.complication_id)
        && !state.complicationPresent.has(condition.complication_id);
    case "OUTCOME_FLAG_PRESENT":
      return state.outcomePresent.has(condition.outcome_flag)
        && !state.outcomeAbsent.has(condition.outcome_flag);
    case "OUTCOME_FLAG_ABSENT":
      return state.outcomeAbsent.has(condition.outcome_flag)
        && !state.outcomePresent.has(condition.outcome_flag);
    case "CASE_FACT_PRESENT":
      return caseFactIds.has(condition.fact_id);
    case "CLINICAL_TIME_COMPARE":
    case "TRIGGER_EVENT_TYPE":
    case "TRIGGER_ACTION_ID":
    case "PRIOR_EVENT_OCCURRED":
      return false;
  }
}

function ruleTriggerPossiblyReachable(
  rule: TransitionRule,
  state: ReachabilityState,
  caseFactIds: ReadonlySet<string>
): boolean {
  switch (rule.trigger.trigger_type) {
    case "COMMITTED_EVENT":
    case "CLINICAL_TIME_THRESHOLD":
      return true;
    case "SCHEDULED_ITEM":
      return (
        rule.trigger.scheduled_item_id === undefined
        || state.scheduledItemIds.has(rule.trigger.scheduled_item_id)
      ) && (
        rule.trigger.category === undefined
        || state.scheduledCategories.has(rule.trigger.category)
      );
    case "STATE_CONDITION":
      return rule.trigger.conditions.every((condition) =>
        condition.condition_type !== "TRIGGER_EVENT_TYPE"
        && condition.condition_type !== "TRIGGER_ACTION_ID"
        && conditionPossiblyTrue(condition, state, caseFactIds)
      );
  }
}

function rulePossiblyReachable(
  rule: TransitionRule,
  state: ReachabilityState,
  caseFactIds: ReadonlySet<string>
): boolean {
  return ruleTriggerPossiblyReachable(rule, state, caseFactIds)
    && rule.preconditions.every((condition) => conditionPossiblyTrue(condition, state, caseFactIds))
    && !rule.exclusions.some((condition) => conditionAlwaysTrue(condition, state, caseFactIds));
}

function addSetValue<T>(set: Set<T>, value: T): boolean {
  const sizeBefore = set.size;
  set.add(value);
  return set.size !== sizeBefore;
}

function applyReachableImmediateEffect(
  effect: ImmediateStateEffect,
  state: ReachabilityState
): boolean {
  switch (effect.effect_type) {
    case "SET_STATE":
      return addSetValue(state.scalarValues[effect.target], effect.value);
    case "SET_PAIN_STATE":
      return false;
    case "ADD_INTERVENTION":
      return addSetValue(state.interventionPresent, effect.intervention_id);
    case "REMOVE_INTERVENTION":
      return addSetValue(state.interventionAbsent, effect.intervention_id);
    case "ADD_COMPLICATION":
      return addSetValue(state.complicationPresent, effect.complication_id);
    case "REMOVE_COMPLICATION":
      return addSetValue(state.complicationAbsent, effect.complication_id);
    case "ADD_OUTCOME_FLAG":
      return addSetValue(state.outcomePresent, effect.outcome_flag);
    case "REMOVE_OUTCOME_FLAG":
      return addSetValue(state.outcomeAbsent, effect.outcome_flag);
  }
}

function applyReachableRuleEffects(rule: TransitionRule, state: ReachabilityState): boolean {
  let changed = false;

  for (const effect of rule.effects) {
    if (effect.effect_type === "SCHEDULE_RELATIVE" || effect.effect_type === "SCHEDULE_ABSOLUTE") {
      changed = addSetValue(state.scheduledItemIds, effect.scheduled_item_id) || changed;
      changed = addSetValue(state.scheduledCategories, effect.category) || changed;
      for (const scheduledEffect of effect.effects) {
        changed = applyReachableImmediateEffect(scheduledEffect, state) || changed;
      }
    } else if (effect.effect_type !== "CANCEL_SCHEDULED") {
      changed = applyReachableImmediateEffect(effect, state) || changed;
    }
  }

  return changed;
}

function unreachableReasonCodes(
  rule: TransitionRule,
  state: ReachabilityState,
  caseFactIds: ReadonlySet<string>
): string[] {
  const reasons: string[] = [];
  if (!ruleTriggerPossiblyReachable(rule, state, caseFactIds)) {
    reasons.push("reachability.trigger-unsatisfied");
  }
  if (!rule.preconditions.every((condition) => conditionPossiblyTrue(condition, state, caseFactIds))) {
    reasons.push("reachability.precondition-unsatisfied");
  }
  if (rule.exclusions.some((condition) => conditionAlwaysTrue(condition, state, caseFactIds))) {
    reasons.push("reachability.exclusion-always-blocks");
  }
  return reasons.length === 0 ? ["reachability.not-proven"] : reasons.sort();
}

function projectionCoverageIssues(
  casePackage: DraftCasePackage,
  state: ReachabilityState
): ReachabilityProjectionCoverageIssue[] {
  const definition = casePackage.initial_state.observation_projection;
  if (definition === undefined) {
    return [];
  }

  const mappingsByTarget: Partial<Record<
    typeof OBSERVATION_DRIVING_STATE_TARGETS[number],
    Readonly<Record<string, unknown>> | undefined
  >> = {
    hemodynamic_state: definition.hemodynamic_mappings,
    cardiac_rhythm: definition.rhythm_mappings,
    respiratory_state: definition.respiratory_mappings,
    oxygenation: definition.oxygenation_mappings,
    consciousness: definition.consciousness_mappings,
    temperature_state: definition.temperature_mappings
  };
  const mappingNameByTarget = {
    hemodynamic_state: "hemodynamic_mappings",
    cardiac_rhythm: "rhythm_mappings",
    respiratory_state: "respiratory_mappings",
    oxygenation: "oxygenation_mappings",
    consciousness: "consciousness_mappings",
    temperature_state: "temperature_mappings"
  } as const;
  const issues: ReachabilityProjectionCoverageIssue[] = [];

  for (const target of OBSERVATION_DRIVING_STATE_TARGETS) {
    const mappings = mappingsByTarget[target];
    if (target === "temperature_state" && mappings === undefined) {
      continue;
    }
    for (const value of [...state.scalarValues[target]].sort()) {
      if (mappings === undefined || !Object.hasOwn(mappings, value)) {
        issues.push(ReachabilityProjectionCoverageIssueSchema.parse({
          state_target: target,
          state_value: value,
          mapping_path: `$.initial_state.observation_projection.${mappingNameByTarget[target]}`
        }));
      }
    }
  }

  return issues.sort((left, right) => {
    const leftKey = `${left.state_target}\u0000${left.state_value}`;
    const rightKey = `${right.state_target}\u0000${right.state_value}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function schedulerLivenessFindings(
  casePackage: DraftCasePackage
): SchedulerLivenessFinding[] {
  const findings: SchedulerLivenessFinding[] = [];

  for (const rule of casePackage.rules.rules) {
    for (const [effectIndex, effect] of rule.effects.entries()) {
      if (effect.effect_type !== "SCHEDULE_ABSOLUTE") continue;

      const provenExecutionLowerBound = rule.trigger.trigger_type === "CLINICAL_TIME_THRESHOLD"
        ? rule.trigger.threshold_clinical_time
        : 0;
      if (effect.due_clinical_time <= provenExecutionLowerBound) {
        findings.push(SchedulerLivenessFindingSchema.parse({
          code: "liveness.absolute-nonfuture",
          path: `$.rules.rules.${rule.rule_id}.effects[${String(effectIndex)}]`,
          rule_id: rule.rule_id,
          effect_id: effect.effect_id,
          scheduled_item_id: effect.scheduled_item_id
        }));
      }

      if (
        rule.trigger.trigger_type === "SCHEDULED_ITEM"
        && (
          rule.trigger.scheduled_item_id === effect.scheduled_item_id
          || (
            rule.trigger.scheduled_item_id === undefined
            && rule.trigger.category === effect.category
          )
        )
      ) {
        findings.push(SchedulerLivenessFindingSchema.parse({
          code: "liveness.absolute-self-cycle",
          path: `$.rules.rules.${rule.rule_id}.effects[${String(effectIndex)}]`,
          rule_id: rule.rule_id,
          effect_id: effect.effect_id,
          scheduled_item_id: effect.scheduled_item_id
        }));
      }
    }
  }

  const seen = new Set<string>();
  return findings
    .sort((left, right) => {
      const leftKey = `${left.code}\u0000${left.rule_id}\u0000${left.effect_id}`;
      const rightKey = `${right.code}\u0000${right.rule_id}\u0000${right.effect_id}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    })
    .filter((finding) => {
      const key = `${finding.code}\u0000${finding.rule_id}\u0000${finding.effect_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function analyzeRuleReachability(input: unknown): RuleReachabilityAnalysis {
  const casePackage = DraftCasePackageSchema.parse(input);
  const state = initialReachabilityState(casePackage);
  const caseFactIds = new Set<string>(
    casePackage.clinical_facts.facts.map((fact) => fact.fact_id)
  );
  const reachableRuleIds = new Set<string>();
  const maximumPasses = Math.max(1, casePackage.rules.rules.length * 4 + 16);

  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;

    for (const rule of [...casePackage.rules.rules].sort((left, right) =>
      left.rule_id < right.rule_id ? -1 : left.rule_id > right.rule_id ? 1 : 0
    )) {
      if (!rulePossiblyReachable(rule, state, caseFactIds)) {
        continue;
      }
      changed = addSetValue(reachableRuleIds, rule.rule_id) || changed;
      changed = applyReachableRuleEffects(rule, state) || changed;
    }

    if (!changed) {
      break;
    }
  }

  const unreachableRules = casePackage.rules.rules
    .filter((rule) => !reachableRuleIds.has(rule.rule_id))
    .map((rule) => UnreachableRuleSchema.parse({
      rule_id: rule.rule_id,
      reason_codes: unreachableReasonCodes(rule, state, caseFactIds)
    }))
    .sort((left, right) => left.rule_id < right.rule_id ? -1 : left.rule_id > right.rule_id ? 1 : 0);
  const coverageIssues = projectionCoverageIssues(casePackage, state);
  const livenessFindings = schedulerLivenessFindings(casePackage);
  const reachableStateValues = Object.fromEntries(
    allScalarTargets().map((target) => [target, [...state.scalarValues[target]].sort()])
  );

  return RuleReachabilityAnalysisSchema.parse({
    analysis_schema_version: RULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION,
    analyzer_id: RULE_REACHABILITY_ANALYZER_ID,
    analyzer_version: RULE_REACHABILITY_ANALYZER_VERSION,
    result: unreachableRules.length === 0
      && coverageIssues.length === 0
      && livenessFindings.length === 0
      ? "PASSED"
      : "FAILED",
    reachable_rule_ids: [...reachableRuleIds].sort(),
    unreachable_rules: unreachableRules,
    reachable_state_values: reachableStateValues,
    projection_coverage_issues: coverageIssues,
    scheduler_liveness_findings: livenessFindings
  });
}

export async function computeRuleReachabilityEvidenceHash(
  casePackageInput: unknown,
  reviewSubjectHashInput: unknown,
  completedAtUtcInput: unknown,
  hashAdapter: HashAdapter
): Promise<HashDigest> {
  const casePackage = DraftCasePackageSchema.parse(casePackageInput);
  const reviewSubjectHash = HashDigestSchema.parse(reviewSubjectHashInput);
  const completedAtUtc = RealUtcTimeSchema.parse(completedAtUtcInput);
  const analysis = analyzeRuleReachability(casePackage);

  return hashCanonicalJson({
    validation_code: RULE_REACHABILITY_VALIDATION_CODE,
    analyzer_id: RULE_REACHABILITY_ANALYZER_ID,
    analyzer_version: RULE_REACHABILITY_ANALYZER_VERSION,
    case_version_id: casePackage.manifest.case_version_id,
    case_version: casePackage.manifest.case_version,
    review_subject_hash: reviewSubjectHash,
    completed_at_utc: completedAtUtc,
    analysis
  }, hashAdapter);
}

export async function generateRuleReachabilityEvidence(
  casePackageInput: unknown,
  completedAtUtcInput: unknown,
  hashAdapter: HashAdapter
): Promise<GeneratedRuleReachabilityEvidence> {
  const casePackage = DraftCasePackageSchema.parse(casePackageInput);
  const completedAtUtc = RealUtcTimeSchema.parse(completedAtUtcInput);
  const reviewSubjectHash = await computeReviewSubjectHash(casePackage, hashAdapter);
  const analysis = analyzeRuleReachability(casePackage);
  const evidenceHash = await computeRuleReachabilityEvidenceHash(
    casePackage,
    reviewSubjectHash,
    completedAtUtc,
    hashAdapter
  );
  const evidence: ValidationEvidence = ValidationEvidenceSchema.parse({
    validation_code: RULE_REACHABILITY_VALIDATION_CODE,
    status: analysis.result,
    required_for_publication: true,
    validator_id: RULE_REACHABILITY_ANALYZER_ID,
    validator_version: RULE_REACHABILITY_ANALYZER_VERSION,
    evidence_hash: evidenceHash,
    validated_case_version_id: casePackage.manifest.case_version_id,
    validated_case_version: casePackage.manifest.case_version,
    validated_review_subject_hash: reviewSubjectHash,
    completed_at_utc: completedAtUtc
  });

  return GeneratedRuleReachabilityEvidenceSchema.parse({
    review_subject_hash: reviewSubjectHash,
    analysis,
    evidence
  });
}
