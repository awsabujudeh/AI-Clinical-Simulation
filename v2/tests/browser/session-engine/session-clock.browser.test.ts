import { describe, expect, it } from "vitest";

import {
  advanceNormalClinicalClock,
  initializeSessionClinicalClock,
  pauseSessionClinicalClock,
  resumeSessionClinicalClock
} from "../../../packages/session-engine/src/index.ts";
import {
  BASELINE_CLOCK,
  createSyntheticSessionPolicy
} from "../../fixtures/session-engine/synthetic-session.ts";

function requireClockSuccess<T extends { success: boolean }>(result: T): Extract<T, { success: true }> {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result));
  return result as Extract<T, { success: true }>;
}

describe("pure normal Session/Clinical clock", () => {
  it("advances normal Expo time 1:1 and handles zero elapsed time", () => {
    const policy = createSyntheticSessionPolicy();
    const advanced = requireClockSuccess(advanceNormalClinicalClock({
      clock: BASELINE_CLOCK,
      policy,
      elapsed_real_seconds: 5
    }));
    const unchanged = requireClockSuccess(advanceNormalClinicalClock({
      clock: BASELINE_CLOCK,
      policy,
      elapsed_real_seconds: 0
    }));

    expect(advanced.clock.clinical_time).toBe(50);
    expect(advanced.applied_clinical_seconds).toBe(5);
    expect(unchanged.clock.clinical_time).toBe(45);
  });

  it("is monotonic and deterministic for repeated explicit elapsed input", () => {
    const input = {
      clock: BASELINE_CLOCK,
      policy: createSyntheticSessionPolicy(),
      elapsed_real_seconds: 9
    };
    const first = requireClockSuccess(advanceNormalClinicalClock(input));
    const second = requireClockSuccess(advanceNormalClinicalClock(input));

    expect(first.clock.clinical_time).toBeGreaterThanOrEqual(BASELINE_CLOCK.clinical_time);
    expect(second).toEqual(first);
    expect(input.clock).toEqual(BASELINE_CLOCK);
  });

  it("freezes while paused and resumes without paused-time catch-up", () => {
    const policy = createSyntheticSessionPolicy();
    const paused = requireClockSuccess(pauseSessionClinicalClock(BASELINE_CLOCK));
    const frozen = requireClockSuccess(advanceNormalClinicalClock({
      clock: paused.clock,
      policy,
      elapsed_real_seconds: 300
    }));
    const resumed = requireClockSuccess(resumeSessionClinicalClock(frozen.clock));
    const afterResume = requireClockSuccess(advanceNormalClinicalClock({
      clock: resumed.clock,
      policy,
      elapsed_real_seconds: 2
    }));

    expect(frozen.clock.clinical_time).toBe(45);
    expect(frozen.applied_clinical_seconds).toBe(0);
    expect(afterResume.clock.clinical_time).toBe(47);
  });

  it("contains malformed initialization and normal-clock input as typed failure", () => {
    const invalidInitial = initializeSessionClinicalClock(-1);
    const invalidAdvance = advanceNormalClinicalClock({
      clock: BASELINE_CLOCK,
      policy: createSyntheticSessionPolicy(),
      elapsed_real_seconds: 0.25
    });

    expect(invalidInitial.success).toBe(false);
    expect(invalidAdvance.success).toBe(false);
  });
});
