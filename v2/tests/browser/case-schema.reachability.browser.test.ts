import { describe, expect, it } from "vitest";

import {
  DraftCasePackageSchema,
  analyzeRuleReachability,
  computeModuleHashes,
  computeReviewSubjectHash,
  createPinnedClinicalPolicy,
  generateRuleReachabilityEvidence,
  preparePublicationCandidate,
  validateDraftCase,
  validateForPublicationCandidate,
  type DraftCasePackage
} from "../../packages/case-schema/src/index.ts";
import { TransitionRuleSchema } from "../../packages/contracts/src/index.ts";
import {
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createCandidateReadyUnderReviewCase
} from "../fixtures/cases/synthetic-case.ts";

const COMPLETED_AT = "2026-08-30T12:03:00Z";

function cloneCase(casePackage: DraftCasePackage): DraftCasePackage {
  return DraftCasePackageSchema.parse(JSON.parse(JSON.stringify(casePackage)));
}

function delayedFutureRule() {
  return TransitionRuleSchema.parse({
    rule_schema_version: "1.0",
    rule_id: "rule.synthetic.future-observation",
    rule_version: "1.0.0",
    trigger: {
      trigger_type: "COMMITTED_EVENT",
      event_type: "EXAM_PERFORMED",
      action_id: "examination.synthetic-check"
    },
    preconditions: [],
    exclusions: [],
    priority: 20,
    conflict_policy: "REPLACE",
    effects: [{
      effect_type: "SCHEDULE_RELATIVE",
      effect_id: "effect.synthetic.schedule-future",
      scheduled_item_id: "scheduled-item.synthetic.future-observation",
      category: "schedule.synthetic-future-observation",
      delay_clinical_seconds: 5,
      priority: 20,
      conflict_policy: "REPLACE",
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.set-future-hemodynamics",
        target: "hemodynamic_state",
        value: "hemodynamics.synthetic-future"
      }],
      emitted_events: []
    }],
    emitted_events: [],
    referenced_action_ids: ["examination.synthetic-check"],
    referenced_rule_ids: [],
    referenced_fact_ids: [],
    source_ids: ["source.synthetic.001"],
    timing_window_ids: [],
    scoring_evidence_refs: []
  });
}

describe("static rule reachability and observation coverage", () => {
  it("computes deterministic reachable rules and state values", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    const first = analyzeRuleReachability(casePackage);
    const second = analyzeRuleReachability(cloneCase(casePackage));

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.result).toBe("PASSED");
    expect(first.reachable_rule_ids).toEqual(["rule.synthetic.observation"]);
    expect(first.reachable_state_values.hemodynamic_state).toEqual([
      "hemodynamics.alternate",
      "hemodynamics.neutral"
    ]);
  });

  it("fails publication for a delayed reachable value without a pinned mapping", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    casePackage.rules.rules.push(delayedFutureRule());
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);

    const analysis = analyzeRuleReachability(casePackage);
    const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);

    expect(analysis.result).toBe("FAILED");
    expect(analysis.projection_coverage_issues).toEqual([{
      state_target: "hemodynamic_state",
      state_value: "hemodynamics.synthetic-future",
      mapping_path: "$.initial_state.observation_projection.hemodynamic_mappings"
    }]);
    expect(report.issues.map((item) => item.code)).toContain(
      "REACHABLE_OBSERVATION_MAPPING_MISSING"
    );
    expect(report.issues.map((item) => item.code)).toContain("RULE_REACHABILITY_FAILED");
  });

  it("passes the reachable-state coverage gate after the mapping is pinned", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    casePackage.rules.rules.push(delayedFutureRule());
    casePackage.initial_state.observation_projection!.hemodynamic_mappings[
      "hemodynamics.synthetic-future" as never
    ] = {
      heart_rate_bpm: 78,
      systolic_bp_mm_hg: 108,
      diastolic_bp_mm_hg: 68
    };
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);

    const candidate = await preparePublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(analyzeRuleReachability(casePackage).result).toBe("PASSED");
    expect(candidate.success).toBe(true);
  });

  it("includes authored initial scheduler effects in reachable projection coverage", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    casePackage.timeline_policy.initial_scheduled_items.push({
      scheduler_schema_version: "1.0",
      scheduled_item_id: "scheduled-item.synthetic.initial-future" as never,
      originating_rule_id: "rule.synthetic.observation" as never,
      category: "schedule.synthetic-initial-future" as never,
      due_clinical_time: 10 as never,
      priority: 5,
      conflict_policy: "REPLACE",
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.initial-respiratory" as never,
        target: "respiratory_state",
        value: "respiratory.synthetic-initial-future" as never
      }],
      emitted_events: []
    });
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);

    const analysis = analyzeRuleReachability(casePackage);
    expect(analysis.projection_coverage_issues).toContainEqual({
      state_target: "respiratory_state",
      state_value: "respiratory.synthetic-initial-future",
      mapping_path: "$.initial_state.observation_projection.respiratory_mappings"
    });
  });

  it("reports an unsatisfiable state-triggered rule deterministically", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    casePackage.rules.rules.push(TransitionRuleSchema.parse({
      ...delayedFutureRule(),
      rule_id: "rule.synthetic.unreachable",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "STATE_EQUALS",
          target: "respiratory_state",
          value: "respiratory.synthetic-never-produced"
        }]
      },
      effects: []
    }));

    const analysis = analyzeRuleReachability(casePackage);
    expect(analysis.result).toBe("FAILED");
    expect(analysis.unreachable_rules).toEqual([{
      rule_id: "rule.synthetic.unreachable",
      reason_codes: ["reachability.trigger-unsatisfied"]
    }]);
  });

  it("does not claim event-context predicates are reachable in a derived state trigger", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    casePackage.rules.rules.push(TransitionRuleSchema.parse({
      ...delayedFutureRule(),
      rule_id: "rule.synthetic.impossible-state-event-context",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "TRIGGER_EVENT_TYPE",
          event_type: "EXAM_PERFORMED"
        }]
      },
      effects: []
    }));
    const analysis = analyzeRuleReachability(casePackage);
    expect(analysis.unreachable_rules).toContainEqual({
      rule_id: "rule.synthetic.impossible-state-event-context",
      reason_codes: ["reachability.trigger-unsatisfied"]
    });
  });

  it("treats external committed-event and time triggers as conservatively reachable", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    casePackage.rules.rules.push(
      TransitionRuleSchema.parse({
        ...delayedFutureRule(),
        rule_id: "rule.synthetic.external-event-reachable",
        effects: []
      }),
      TransitionRuleSchema.parse({
        ...delayedFutureRule(),
        rule_id: "rule.synthetic.time-reachable",
        trigger: {
          trigger_type: "CLINICAL_TIME_THRESHOLD",
          threshold_clinical_time: 500
        },
        effects: []
      })
    );
    const analysis = analyzeRuleReachability(casePackage);
    expect(analysis.reachable_rule_ids).toContain("rule.synthetic.external-event-reachable");
    expect(analysis.reachable_rule_ids).toContain("rule.synthetic.time-reachable");
  });

  it("tracks a scheduled trigger created by another reachable rule", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    const producer = delayedFutureRule();
    const consumer = TransitionRuleSchema.parse({
      ...delayedFutureRule(),
      rule_id: "rule.synthetic.scheduled-consumer",
      trigger: {
        trigger_type: "SCHEDULED_ITEM",
        scheduled_item_id: "scheduled-item.synthetic.future-observation"
      },
      effects: []
    });
    casePackage.rules.rules.push(producer, consumer);
    casePackage.initial_state.observation_projection!.hemodynamic_mappings[
      "hemodynamics.synthetic-future" as never
    ] = { heart_rate_bpm: 78, systolic_bp_mm_hg: 108, diastolic_bp_mm_hg: 68 };
    const analysis = analyzeRuleReachability(casePackage);
    expect(analysis.reachable_rule_ids).toContain("rule.synthetic.scheduled-consumer");
  });

  it("fails liveness evidence and publication for an absolute same-time scheduler self-cycle", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    const selfRule = TransitionRuleSchema.parse({
      ...delayedFutureRule(),
      rule_id: "rule.synthetic.absolute-self-cycle",
      trigger: {
        trigger_type: "SCHEDULED_ITEM",
        scheduled_item_id: "scheduled-item.synthetic.absolute-self-cycle"
      },
      effects: [{
        effect_type: "SCHEDULE_ABSOLUTE",
        effect_id: "effect.synthetic.absolute-self-cycle",
        scheduled_item_id: "scheduled-item.synthetic.absolute-self-cycle",
        category: "schedule.synthetic-self-cycle",
        due_clinical_time: 0,
        priority: 10,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }]
    });
    casePackage.rules.rules.push(selfRule);
    casePackage.timeline_policy.initial_scheduled_items.push({
      scheduler_schema_version: "1.0",
      scheduled_item_id: "scheduled-item.synthetic.absolute-self-cycle" as never,
      originating_rule_id: selfRule.rule_id,
      category: "schedule.synthetic-self-cycle" as never,
      due_clinical_time: 0 as never,
      priority: 10,
      conflict_policy: "REPLACE",
      effects: [],
      emitted_events: []
    });
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);

    const analysis = analyzeRuleReachability(casePackage);
    const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(analysis.result).toBe("FAILED");
    expect(analysis.scheduler_liveness_findings.map((finding) => finding.code)).toEqual([
      "liveness.absolute-nonfuture",
      "liveness.absolute-self-cycle"
    ]);
    expect(report.issues.map((item) => item.code)).toContain("SCHEDULER_LIVENESS_UNSAFE");
    expect(report.issues.map((item) => item.code)).toContain("RULE_REACHABILITY_FAILED");
  });
});

describe("real Rule Reachability publication evidence", () => {
  it("is deterministic, hash-bound, version-bound, and produced by the current analyzer", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    const first = await generateRuleReachabilityEvidence(
      casePackage,
      COMPLETED_AT,
      TEST_HASH_ADAPTER
    );
    const second = await generateRuleReachabilityEvidence(
      cloneCase(casePackage),
      COMPLETED_AT,
      TEST_HASH_ADAPTER
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.analysis.result).toBe("PASSED");
    expect(first.evidence).toMatchObject({
      validation_code: "validation.rule-reachability",
      status: "PASSED",
      required_for_publication: true,
      validator_id: "validator.rule-reachability.v1",
      validator_version: "1.1.0",
      validated_case_version_id: casePackage.manifest.case_version_id,
      validated_case_version: casePackage.manifest.case_version,
      validated_review_subject_hash: first.review_subject_hash,
      completed_at_utc: COMPLETED_AT
    });
  });

  it.each([
    ["missing", (casePackage: DraftCasePackage) => { casePackage.validation.deferred_checks = []; }, "RULE_REACHABILITY_EVIDENCE_MISSING"],
    ["failed", (casePackage: DraftCasePackage) => { casePackage.validation.deferred_checks[0]!.status = "FAILED"; }, "RULE_REACHABILITY_FAILED"],
    ["different content hash", (casePackage: DraftCasePackage) => {
      casePackage.validation.deferred_checks[0]!.validated_review_subject_hash =
        "0000000000000000000000000000000000000000000000000000000000000000" as never;
    }, "RULE_REACHABILITY_EVIDENCE_STALE"],
    ["tampered evidence hash", (casePackage: DraftCasePackage) => {
      casePackage.validation.deferred_checks[0]!.evidence_hash =
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as never;
    }, "RULE_REACHABILITY_EVIDENCE_STALE"]
  ] as const)("rejects %s mandatory evidence", async (_label, mutate, expectedCode) => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    mutate(casePackage);
    const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(report.valid).toBe(false);
    expect(report.issues.map((item) => item.code)).toContain(expectedCode);
  });
});

describe("compiled Case Package pinned clinical policy extraction", () => {
  it("derives identity, hashes, facts, rules, timeline, and observation policy from one artifact", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    const candidate = await preparePublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(candidate.success).toBe(true);
    if (!candidate.success) return;

    const policy = createPinnedClinicalPolicy(candidate.candidate.package);
    expect(policy).toMatchObject({
      case_package_id: candidate.candidate.package.manifest.case_package_id,
      case_version_id: candidate.candidate.package.manifest.case_version_id,
      case_version: candidate.candidate.package.manifest.case_version,
      package_hash: candidate.candidate.candidate_package_hash,
      rule_schema_version: "1.0"
    });
    expect(policy.rules).toEqual(candidate.candidate.package.rules.rules);
    expect(policy.observation_projection).toEqual(
      candidate.candidate.package.initial_state.observation_projection
    );
    expect(policy.approved_case_fact_ids).toEqual(
      candidate.candidate.package.clinical_facts.facts.map((fact) => fact.fact_id).sort()
    );
    expect(policy.module_hashes.rules).toBe(
      candidate.candidate.package.manifest.module_hashes.rules
    );
  });
});

async function assertRuleMutationChangesAllHashes(
  baselineInput: DraftCasePackage,
  mutate: (casePackage: DraftCasePackage) => void
) {
  const baseline = cloneCase(baselineInput);
  await bindSyntheticReviewAndReachabilityEvidence(baseline);
  const baselineReviewHash = await computeReviewSubjectHash(baseline, TEST_HASH_ADAPTER);
  const baselineModules = await computeModuleHashes(baseline, TEST_HASH_ADAPTER);
  const baselineCandidate = await preparePublicationCandidate(baseline, TEST_HASH_ADAPTER);

  const changed = cloneCase(baseline);
  mutate(changed);
  await bindSyntheticReviewAndReachabilityEvidence(changed);
  const changedReviewHash = await computeReviewSubjectHash(changed, TEST_HASH_ADAPTER);
  const changedModules = await computeModuleHashes(changed, TEST_HASH_ADAPTER);
  const changedCandidate = await preparePublicationCandidate(changed, TEST_HASH_ADAPTER);

  expect(baselineCandidate.success).toBe(true);
  expect(changedCandidate.success).toBe(true);
  if (!baselineCandidate.success || !changedCandidate.success) return;
  expect(changedModules.rules).not.toBe(baselineModules.rules);
  expect(changedReviewHash).not.toBe(baselineReviewHash);
  expect(changedCandidate.candidate.candidate_package_hash).not.toBe(
    baselineCandidate.candidate.candidate_package_hash
  );
}

async function assertTimelineMutationChangesAllHashes(
  baselineInput: DraftCasePackage,
  mutate: (casePackage: DraftCasePackage) => void
) {
  const baseline = cloneCase(baselineInput);
  await bindSyntheticReviewAndReachabilityEvidence(baseline);
  const baselineReviewHash = await computeReviewSubjectHash(baseline, TEST_HASH_ADAPTER);
  const baselineModules = await computeModuleHashes(baseline, TEST_HASH_ADAPTER);
  const baselineCandidate = await preparePublicationCandidate(baseline, TEST_HASH_ADAPTER);

  const changed = cloneCase(baseline);
  mutate(changed);
  await bindSyntheticReviewAndReachabilityEvidence(changed);
  const changedReviewHash = await computeReviewSubjectHash(changed, TEST_HASH_ADAPTER);
  const changedModules = await computeModuleHashes(changed, TEST_HASH_ADAPTER);
  const changedCandidate = await preparePublicationCandidate(changed, TEST_HASH_ADAPTER);

  expect(baselineCandidate.success).toBe(true);
  expect(changedCandidate.success).toBe(true);
  if (!baselineCandidate.success || !changedCandidate.success) return;
  expect(changedModules.timeline_policy).not.toBe(baselineModules.timeline_policy);
  expect(changedReviewHash).not.toBe(baselineReviewHash);
  expect(changedCandidate.candidate.candidate_package_hash).not.toBe(
    baselineCandidate.candidate.candidate_package_hash
  );
}

describe("Case Package rule policy hash authority", () => {
  it("binds trigger changes into rule, review, and candidate hashes", async () => {
    const baseline = await createCandidateReadyUnderReviewCase();
    await assertRuleMutationChangesAllHashes(baseline, (changed) => {
      const trigger = changed.rules.rules[0]!.trigger;
      if (trigger.trigger_type !== "COMMITTED_EVENT") throw new Error("Fixture trigger changed.");
      trigger.event_type = "PROCEDURE_PERFORMED";
    });
  });

  it("binds precondition changes into rule, review, and candidate hashes", async () => {
    const baseline = await createCandidateReadyUnderReviewCase();
    await assertRuleMutationChangesAllHashes(baseline, (changed) => {
      changed.rules.rules[0]!.preconditions.push({
        condition_type: "STATE_EQUALS",
        target: "hemodynamic_state",
        value: "hemodynamics.neutral" as never
      });
    });
  });

  it("binds exclusion changes into rule, review, and candidate hashes", async () => {
    const baseline = await createCandidateReadyUnderReviewCase();
    await assertRuleMutationChangesAllHashes(baseline, (changed) => {
      changed.rules.rules[0]!.exclusions.push({
        condition_type: "OUTCOME_FLAG_PRESENT",
        outcome_flag: "outcome.synthetic-not-present" as never
      });
    });
  });

  it("binds effect changes into rule, review, and candidate hashes", async () => {
    const baseline = await createCandidateReadyUnderReviewCase();
    await assertRuleMutationChangesAllHashes(baseline, (changed) => {
      const effect = changed.rules.rules[0]!.effects[0]!;
      if (effect.effect_type !== "SET_STATE") throw new Error("Fixture effect changed.");
      effect.value = "hemodynamics.neutral" as never;
    });
  });

  it.each([
    ["priority", (changed: DraftCasePackage) => { changed.rules.rules[0]!.priority += 1; }],
    ["conflict policy", (changed: DraftCasePackage) => {
      changed.rules.rules[0]!.conflict_policy = "HIGHEST_PRIORITY";
    }]
  ] as const)("binds %s changes into rule, review, and candidate hashes", async (_label, mutate) => {
    const baseline = await createCandidateReadyUnderReviewCase();
    await assertRuleMutationChangesAllHashes(baseline, mutate);
  });

  it("binds delayed scheduled behavior into rule, review, and candidate hashes", async () => {
    const baseline = await createCandidateReadyUnderReviewCase();
    baseline.rules.rules.push(delayedFutureRule());
    baseline.initial_state.observation_projection!.hemodynamic_mappings[
      "hemodynamics.synthetic-future" as never
    ] = { heart_rate_bpm: 78, systolic_bp_mm_hg: 108, diastolic_bp_mm_hg: 68 };

    await assertRuleMutationChangesAllHashes(baseline, (changed) => {
      const effect = changed.rules.rules[1]!.effects[0]!;
      if (effect.effect_type !== "SCHEDULE_RELATIVE") throw new Error("Fixture effect changed.");
      effect.delay_clinical_seconds = 6;
    });
  });

  it("binds cancellation selectors into rule, review, and candidate hashes", async () => {
    const baseline = await createCandidateReadyUnderReviewCase();
    baseline.rules.rules[0]!.effects.push(
      TransitionRuleSchema.parse(delayedFutureRule()).effects[0]!,
      {
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: "effect.synthetic.schedule-second" as never,
        scheduled_item_id: "scheduled-item.synthetic.second" as never,
        category: "schedule.synthetic-second" as never,
        delay_clinical_seconds: 6,
        priority: 20,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      },
      {
        effect_type: "CANCEL_SCHEDULED",
        effect_id: "effect.synthetic.cancel-one" as never,
        selector: {
          selector_type: "SCHEDULED_ITEM_ID",
          scheduled_item_id: "scheduled-item.synthetic.future-observation" as never
        }
      }
    );
    baseline.initial_state.observation_projection!.hemodynamic_mappings[
      "hemodynamics.synthetic-future" as never
    ] = { heart_rate_bpm: 78, systolic_bp_mm_hg: 108, diastolic_bp_mm_hg: 68 };

    await assertRuleMutationChangesAllHashes(baseline, (changed) => {
      const effect = changed.rules.rules[0]!.effects[3]!;
      if (effect.effect_type !== "CANCEL_SCHEDULED") throw new Error("Fixture effect changed.");
      effect.selector = {
        selector_type: "SCHEDULED_ITEM_ID",
        scheduled_item_id: "scheduled-item.synthetic.second" as never
      };
    });
  });

  it("binds authored initial scheduled behavior into timeline, review, and candidate hashes", async () => {
    const baseline = await createCandidateReadyUnderReviewCase();
    baseline.timeline_policy.initial_scheduled_items.push({
      scheduler_schema_version: "1.0",
      scheduled_item_id: "scheduled-item.synthetic.hash-pinned" as never,
      originating_rule_id: baseline.rules.rules[0]!.rule_id,
      category: "schedule.synthetic-hash-pinned" as never,
      due_clinical_time: 10 as never,
      priority: 1,
      conflict_policy: "REPLACE",
      effects: [],
      emitted_events: []
    });
    await assertTimelineMutationChangesAllHashes(baseline, (changed) => {
      changed.timeline_policy.initial_scheduled_items[0]!.priority = 2;
    });
  });
});

describe("Case Schema declarative rule safety", () => {
  it("rejects a statically obvious equal-priority same-channel conflict", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    const conflicting = TransitionRuleSchema.parse({
      ...casePackage.rules.rules[0]!,
      rule_id: "rule.synthetic.static-conflict",
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.static-conflict",
        target: "hemodynamic_state",
        value: "hemodynamics.neutral"
      }]
    });
    casePackage.rules.rules.push(conflicting);
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);
    const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(report.issues.map((item) => item.code)).toContain(
      "AMBIGUOUS_EQUAL_PRIORITY_STATE_CONFLICT"
    );
  });

  it("rejects statically co-firing contradictory mixed conflict policies", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    casePackage.rules.rules[0]!.conflict_policy = "REPLACE";
    const mixed = TransitionRuleSchema.parse({
      ...casePackage.rules.rules[0]!,
      rule_id: "rule.synthetic.static-mixed-policy",
      priority: casePackage.rules.rules[0]!.priority + 1,
      conflict_policy: "BLOCK",
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.static-mixed-policy",
        target: "hemodynamic_state",
        value: "hemodynamics.neutral"
      }]
    });
    casePackage.rules.rules.push(mixed);
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);
    const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(report.issues.map((item) => item.code)).toContain("MIXED_CONFLICT_POLICIES");
  });

  it("does not claim an obvious static conflict across different eligibility contexts", async () => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    casePackage.rules.rules[0]!.preconditions = [{
      condition_type: "STATE_EQUALS",
      target: "hemodynamic_state",
      value: "hemodynamics.neutral" as never
    }];
    const conditionallyDifferent = TransitionRuleSchema.parse({
      ...casePackage.rules.rules[0]!,
      rule_id: "rule.synthetic.conditional-write",
      preconditions: [{
        condition_type: "STATE_EQUALS",
        target: "hemodynamic_state",
        value: "hemodynamics.alternate"
      }],
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.conditional-write",
        target: "hemodynamic_state",
        value: "hemodynamics.neutral"
      }]
    });
    casePackage.rules.rules.push(conditionallyDifferent);
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);
    const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(report.issues.map((item) => item.code)).not.toContain(
      "AMBIGUOUS_EQUAL_PRIORITY_STATE_CONFLICT"
    );
  });

  it.each([
    ["unsupported module rule version", (value: Record<string, unknown>) => {
      (value.rules as Record<string, unknown>).rule_schema_version = "2.0";
    }],
    ["unsupported individual rule version", (value: Record<string, unknown>) => {
      const rules = (value.rules as { rules: Array<Record<string, unknown>> }).rules;
      rules[0]!.rule_schema_version = "999.0";
    }],
    ["script-like executable field", (value: Record<string, unknown>) => {
      const rules = (value.rules as { rules: Array<Record<string, unknown>> }).rules;
      rules[0]!.execute = "fixture-only";
    }],
    ["unsupported state target", (value: Record<string, unknown>) => {
      const rules = (value.rules as { rules: Array<{ effects: Array<Record<string, unknown>> }> }).rules;
      rules[0]!.effects[0]!.target = "heart_rate_bpm";
    }]
  ] as const)("fails closed for %s", async (_label, mutate) => {
    const casePackage = await createCandidateReadyUnderReviewCase();
    const raw = JSON.parse(JSON.stringify(casePackage)) as Record<string, unknown>;
    mutate(raw);
    const report = validateDraftCase(raw);
    expect(report.valid).toBe(false);
    expect(report.issues.map((item) => item.code)).toContain("SCHEMA_INVALID");
  });
});
