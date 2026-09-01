import {
  ClinicalTimeSchema,
  SCHEDULER_SCHEMA_VERSION,
  ScheduledItemSchema,
  SchedulerStateSchema,
  type CancellationSelector,
  type ScheduledItem,
  type SchedulerState
} from "../../../contracts/src/index.ts";

import {
  createTransitionIssue,
  sortTransitionIssues,
  transitionIssuesFromZodError,
  type ClinicalTransitionIssue
} from "../validation/transition-issues.ts";

export type SchedulerValidationResult =
  | { success: false; issues: ClinicalTransitionIssue[] }
  | { success: true; issues: []; schedulerState: SchedulerState };

export function compareScheduledItems(left: ScheduledItem, right: ScheduledItem): number {
  if (left.due_clinical_time !== right.due_clinical_time) {
    return left.due_clinical_time - right.due_clinical_time;
  }

  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  if (left.scheduled_item_id !== right.scheduled_item_id) {
    return left.scheduled_item_id < right.scheduled_item_id ? -1 : 1;
  }

  return left.originating_rule_id < right.originating_rule_id
    ? -1
    : left.originating_rule_id > right.originating_rule_id
      ? 1
      : 0;
}

export function sortScheduledItems(items: readonly ScheduledItem[]): ScheduledItem[] {
  return [...items].sort(compareScheduledItems);
}

export function validateSchedulerState(input: unknown): SchedulerValidationResult {
  const parsed = SchedulerStateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      issues: sortTransitionIssues(
        transitionIssuesFromZodError("INVALID_SCHEDULER_STATE", "$.scheduler_state", parsed.error)
      )
    };
  }

  const seen = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const item of parsed.data.pending_items) {
    if (seen.has(item.scheduled_item_id)) {
      duplicateIds.add(item.scheduled_item_id);
    }
    seen.add(item.scheduled_item_id);
  }

  if (duplicateIds.size > 0) {
    return {
      success: false,
      issues: [...duplicateIds].sort().map((scheduledItemId) =>
        createTransitionIssue({
          code: "DUPLICATE_SCHEDULED_ITEM_ID",
          path: "$.scheduler_state.pending_items",
          scheduled_item_id: scheduledItemId,
          message: "Scheduler state contains a duplicate scheduled-item identity."
        })
      )
    };
  }

  return {
    success: true,
    issues: [],
    schedulerState: SchedulerStateSchema.parse({
      ...parsed.data,
      pending_items: sortScheduledItems(parsed.data.pending_items)
    })
  };
}

export function initializeClinicalScheduler(
  initialScheduledItemsInput: unknown
): SchedulerValidationResult {
  const items = ScheduledItemSchema.array().max(128).safeParse(initialScheduledItemsInput);

  if (!items.success) {
    return {
      success: false,
      issues: sortTransitionIssues(
        transitionIssuesFromZodError("INVALID_SCHEDULER_STATE", "$.initial_scheduled_items", items.error)
      )
    };
  }

  return validateSchedulerState({
    scheduler_schema_version: SCHEDULER_SCHEMA_VERSION,
    pending_items: items.data
  });
}

export function partitionDueScheduledItems(
  schedulerState: SchedulerState,
  targetClinicalTimeInput: unknown
):
  | { success: false; issues: ClinicalTransitionIssue[] }
  | {
      success: true;
      issues: [];
      dueItems: ScheduledItem[];
      remainingSchedulerState: SchedulerState;
    } {
  const targetClinicalTime = ClinicalTimeSchema.safeParse(targetClinicalTimeInput);

  if (!targetClinicalTime.success) {
    return {
      success: false,
      issues: sortTransitionIssues(
        transitionIssuesFromZodError(
          "INVALID_TRANSITION_INPUT",
          "$.target_clinical_time",
          targetClinicalTime.error
        )
      )
    };
  }

  const dueItems = schedulerState.pending_items.filter(
    (item) => item.due_clinical_time <= targetClinicalTime.data
  );
  const pendingItems = schedulerState.pending_items.filter(
    (item) => item.due_clinical_time > targetClinicalTime.data
  );

  return {
    success: true,
    issues: [],
    dueItems: sortScheduledItems(dueItems),
    remainingSchedulerState: SchedulerStateSchema.parse({
      scheduler_schema_version: SCHEDULER_SCHEMA_VERSION,
      pending_items: sortScheduledItems(pendingItems)
    })
  };
}

export function scheduledItemMatchesCancellation(
  item: ScheduledItem,
  selector: CancellationSelector
): boolean {
  return selector.selector_type === "SCHEDULED_ITEM_ID"
    ? item.scheduled_item_id === selector.scheduled_item_id
    : item.category === selector.category;
}
