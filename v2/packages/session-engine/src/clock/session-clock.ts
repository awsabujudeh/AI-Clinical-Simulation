import { z } from "zod";

import {
  ElapsedRealSecondsSchema,
  PinnedClinicalPolicyEnvelopeSchema,
  SESSION_CLOCK_SCHEMA_VERSION,
  SessionClinicalClockSchema,
  type SessionClinicalClock
} from "../../../contracts/src/index.ts";

export const SessionTimeIssueCodeSchema = z.enum([
  "INVALID_CLOCK_INPUT",
  "INVALID_ADVANCEMENT_INPUT",
  "CLOCK_STATE_MISMATCH",
  "CLOCK_PAUSED",
  "CLINICAL_TIME_REGRESSION",
  "CLINICAL_TIME_OVERFLOW",
  "ADVANCEMENT_BUDGET_EXCEEDED",
  "CLINICAL_ENGINE_FAILURE"
]);
export type SessionTimeIssueCode = z.infer<typeof SessionTimeIssueCodeSchema>;

export const SessionTimeIssueSchema = z.strictObject({
  code: SessionTimeIssueCodeSchema,
  path: z.string().min(1).max(300),
  message: z.string().trim().min(1).max(500)
});
export type SessionTimeIssue = z.infer<typeof SessionTimeIssueSchema>;

export type SessionClockFailure = {
  success: false;
  issues: SessionTimeIssue[];
};

export type SessionClockSuccess = {
  success: true;
  issues: [];
  clock: SessionClinicalClock;
};

export type SessionClockResult = SessionClockFailure | SessionClockSuccess;

export const NormalClockAdvanceRequestSchema = z.strictObject({
  clock: SessionClinicalClockSchema,
  policy: PinnedClinicalPolicyEnvelopeSchema,
  elapsed_real_seconds: ElapsedRealSecondsSchema
});
export type NormalClockAdvanceRequest = z.infer<
  typeof NormalClockAdvanceRequestSchema
>;

export type NormalClockAdvanceSuccess = SessionClockSuccess & {
  elapsed_real_seconds: number;
  applied_clinical_seconds: number;
};
export type NormalClockAdvanceResult = SessionClockFailure | NormalClockAdvanceSuccess;

function issuesFromZodError(
  code: "INVALID_CLOCK_INPUT" | "INVALID_ADVANCEMENT_INPUT",
  error: z.ZodError
): SessionTimeIssue[] {
  return error.issues.map((issue) => SessionTimeIssueSchema.parse({
    code,
    path: issue.path.length === 0
      ? "$"
      : `$.${issue.path.map(String).join(".")}`,
    message: issue.message
  })).sort((left, right) => {
    const leftKey = `${left.path}\u0000${left.code}\u0000${left.message}`;
    const rightKey = `${right.path}\u0000${right.code}\u0000${right.message}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

export function createSessionTimeIssue(
  input: z.input<typeof SessionTimeIssueSchema>
): SessionTimeIssue {
  return SessionTimeIssueSchema.parse(input);
}

export function initializeSessionClinicalClock(
  clinicalTimeInput: unknown
): SessionClockResult {
  const parsed = SessionClinicalClockSchema.safeParse({
    clock_schema_version: SESSION_CLOCK_SCHEMA_VERSION,
    status: "RUNNING",
    clinical_time: clinicalTimeInput
  });

  return parsed.success
    ? { success: true, issues: [], clock: parsed.data }
    : {
        success: false,
        issues: issuesFromZodError("INVALID_CLOCK_INPUT", parsed.error)
      };
}

function setClockStatus(
  clockInput: unknown,
  status: SessionClinicalClock["status"]
): SessionClockResult {
  const parsed = SessionClinicalClockSchema.safeParse(clockInput);
  if (!parsed.success) {
    return {
      success: false,
      issues: issuesFromZodError("INVALID_CLOCK_INPUT", parsed.error)
    };
  }

  return {
    success: true,
    issues: [],
    clock: SessionClinicalClockSchema.parse({ ...parsed.data, status })
  };
}

export function pauseSessionClinicalClock(clockInput: unknown): SessionClockResult {
  return setClockStatus(clockInput, "PAUSED");
}

export function resumeSessionClinicalClock(clockInput: unknown): SessionClockResult {
  return setClockStatus(clockInput, "RUNNING");
}

function normalizeClinicalSeconds(value: number): number {
  // Nine-decimal normalization bounds cross-runtime floating representation
  // without introducing another Clinical-Time unit or hidden remainder state.
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

export function advanceNormalClinicalClock(
  input: unknown
): NormalClockAdvanceResult {
  const parsed = NormalClockAdvanceRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: issuesFromZodError("INVALID_ADVANCEMENT_INPUT", parsed.error)
    };
  }

  const { clock, elapsed_real_seconds: elapsedRealSeconds, policy } = parsed.data;
  if (clock.status === "PAUSED") {
    return {
      success: true,
      issues: [],
      clock: SessionClinicalClockSchema.parse(clock),
      elapsed_real_seconds: elapsedRealSeconds,
      applied_clinical_seconds: 0
    };
  }

  const appliedClinicalSeconds = normalizeClinicalSeconds(
    elapsedRealSeconds * policy.timeline_policy.time_ratio
  );
  const nextClinicalTime = normalizeClinicalSeconds(
    clock.clinical_time + appliedClinicalSeconds
  );
  if (!Number.isFinite(nextClinicalTime)) {
    return {
      success: false,
      issues: [createSessionTimeIssue({
        code: "CLINICAL_TIME_OVERFLOW",
        path: "$.elapsed_real_seconds",
        message: "Elapsed time would produce a non-finite Clinical Time."
      })]
    };
  }

  return {
    success: true,
    issues: [],
    clock: SessionClinicalClockSchema.parse({
      ...clock,
      clinical_time: nextClinicalTime
    }),
    elapsed_real_seconds: elapsedRealSeconds,
    applied_clinical_seconds: appliedClinicalSeconds
  };
}

export { issuesFromZodError as sessionTimeIssuesFromZodError };
