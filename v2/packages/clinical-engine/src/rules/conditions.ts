import type {
  ClinicalEvaluationTrigger,
  ClinicalTime,
  PatientState,
  PriorCommittedEventFact,
  RuleCondition
} from "../../../contracts/src/index.ts";

export type ConditionEvaluationContext = {
  state: PatientState;
  trigger: ClinicalEvaluationTrigger;
  clinicalTime: ClinicalTime;
  priorEvents: readonly PriorCommittedEventFact[];
  caseFactIds: ReadonlySet<string>;
};

export type ConditionEvaluation = {
  matched: boolean;
  detailCode: string;
};

function compareClinicalTime(
  actual: number,
  operator: "LT" | "LTE" | "EQ" | "GTE" | "GT",
  expected: number
): boolean {
  switch (operator) {
    case "LT":
      return actual < expected;
    case "LTE":
      return actual <= expected;
    case "EQ":
      return actual === expected;
    case "GTE":
      return actual >= expected;
    case "GT":
      return actual > expected;
  }
}

export function evaluateCondition(
  condition: RuleCondition,
  context: ConditionEvaluationContext
): ConditionEvaluation {
  switch (condition.condition_type) {
    case "STATE_EQUALS":
      return {
        matched: context.state[condition.target] === condition.value,
        detailCode: `condition.state-equals.${condition.target}`
      };
    case "STATE_NOT_EQUALS":
      return {
        matched: context.state[condition.target] !== condition.value,
        detailCode: `condition.state-not-equals.${condition.target}`
      };
    case "INTERVENTION_PRESENT":
      return {
        matched: context.state.active_interventions.some(
          (item) => item.intervention_id === condition.intervention_id
        ),
        detailCode: "condition.intervention-present"
      };
    case "INTERVENTION_ABSENT":
      return {
        matched: !context.state.active_interventions.some(
          (item) => item.intervention_id === condition.intervention_id
        ),
        detailCode: "condition.intervention-absent"
      };
    case "COMPLICATION_PRESENT":
      return {
        matched: context.state.active_complications.some(
          (item) => item.complication_id === condition.complication_id
        ),
        detailCode: "condition.complication-present"
      };
    case "COMPLICATION_ABSENT":
      return {
        matched: !context.state.active_complications.some(
          (item) => item.complication_id === condition.complication_id
        ),
        detailCode: "condition.complication-absent"
      };
    case "OUTCOME_FLAG_PRESENT":
      return {
        matched: context.state.outcome_flags.includes(condition.outcome_flag),
        detailCode: "condition.outcome-flag-present"
      };
    case "OUTCOME_FLAG_ABSENT":
      return {
        matched: !context.state.outcome_flags.includes(condition.outcome_flag),
        detailCode: "condition.outcome-flag-absent"
      };
    case "CLINICAL_TIME_COMPARE":
      return {
        matched: compareClinicalTime(
          context.clinicalTime,
          condition.operator,
          condition.clinical_time
        ),
        detailCode: `condition.clinical-time-${condition.operator.toLowerCase()}`
      };
    case "TRIGGER_EVENT_TYPE":
      return {
        matched: context.trigger.trigger_type === "COMMITTED_EVENT"
          && context.trigger.event_type === condition.event_type,
        detailCode: "condition.trigger-event-type"
      };
    case "TRIGGER_ACTION_ID":
      return {
        matched: context.trigger.trigger_type === "COMMITTED_EVENT"
          && context.trigger.action_id === condition.action_id,
        detailCode: "condition.trigger-action-id"
      };
    case "PRIOR_EVENT_OCCURRED":
      return {
        matched: context.priorEvents.some((event) =>
          event.event_type === condition.event_type
          && (condition.action_id === undefined || event.action_id === condition.action_id)
        ),
        detailCode: "condition.prior-event-occurred"
      };
    case "CASE_FACT_PRESENT":
      return {
        matched: context.caseFactIds.has(condition.fact_id),
        detailCode: "condition.case-fact-present"
      };
  }
}

export function evaluateAllConditions(
  conditions: readonly RuleCondition[],
  context: ConditionEvaluationContext
): { matched: boolean; failedDetailCodes: string[] } {
  const failedDetailCodes = conditions
    .map((condition) => evaluateCondition(condition, context))
    .filter((result) => !result.matched)
    .map((result) => result.detailCode)
    .sort();

  return { matched: failedDetailCodes.length === 0, failedDetailCodes };
}

export function evaluateAnyCondition(
  conditions: readonly RuleCondition[],
  context: ConditionEvaluationContext
): { matched: boolean; matchedDetailCodes: string[] } {
  const matchedDetailCodes = conditions
    .map((condition) => evaluateCondition(condition, context))
    .filter((result) => result.matched)
    .map((result) => result.detailCode)
    .sort();

  return { matched: matchedDetailCodes.length > 0, matchedDetailCodes };
}
