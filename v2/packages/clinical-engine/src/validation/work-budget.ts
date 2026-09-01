export const ENGINE_WORK_LIMITS = Object.freeze({
  derived_passes: 32,
  rules_considered: 8192,
  rule_activations: 2048,
  effects_attempted: 4096,
  due_items_processed: 1024,
  scheduled_items_created: 1024,
  cancellations_processed: 1024,
  event_proposals_created: 512,
  trace_entries: 4096,
  scheduler_causal_depth: 256
} as const);

export type EngineWorkCategory = Exclude<keyof typeof ENGINE_WORK_LIMITS, "trace_entries">;

export type EngineWorkBudget = {
  counts: Record<EngineWorkCategory, number>;
  exceeded?: EngineWorkCategory | "trace_entries";
};

export function createEngineWorkBudget(): EngineWorkBudget {
  return {
    counts: {
      derived_passes: 0,
      rules_considered: 0,
      rule_activations: 0,
      effects_attempted: 0,
      due_items_processed: 0,
      scheduled_items_created: 0,
      cancellations_processed: 0,
      event_proposals_created: 0,
      scheduler_causal_depth: 0
    }
  };
}

export function consumeEngineWork(
  budget: EngineWorkBudget,
  category: EngineWorkCategory,
  amount = 1,
  lowerLimit?: number
): boolean {
  if (budget.exceeded !== undefined) {
    return false;
  }

  const hardLimit = ENGINE_WORK_LIMITS[category];
  const effectiveLimit = lowerLimit === undefined
    ? hardLimit
    : Math.min(hardLimit, lowerLimit);
  const next = budget.counts[category] + amount;
  if (next > effectiveLimit) {
    budget.exceeded = category;
    return false;
  }
  budget.counts[category] = next;
  return true;
}

export function markEngineWorkExceeded(
  budget: EngineWorkBudget,
  category: EngineWorkCategory | "trace_entries"
): void {
  if (budget.exceeded === undefined) {
    budget.exceeded = category;
  }
}
