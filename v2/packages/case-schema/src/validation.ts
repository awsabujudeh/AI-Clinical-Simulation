import { z } from "zod";

import type {
  HashAdapter,
  ImmediateStateEffect
} from "../../contracts/src/index.ts";

import { buildPublicationCandidateArtifact } from "./candidate.ts";
import { computeReviewSubjectHash } from "./hashing.ts";
import {
  RULE_REACHABILITY_ANALYZER_ID,
  RULE_REACHABILITY_ANALYZER_VERSION,
  analyzeRuleReachability,
  computeRuleReachabilityEvidenceHash,
  type RuleReachabilityAnalysis
} from "./reachability.ts";
import {
  CaseValidationIssueSchema,
  createValidationReport,
  type CaseValidationIssue,
  type CaseValidationReport,
  type ValidationIssueSeverity,
  type ValidationMode
} from "./report.ts";
import {
  CASE_MODULE_NAMES,
  CASE_SCHEMA_VERSION,
  DraftCasePackageSchema,
  PublicationApprovalRecordSchema,
  RULE_REACHABILITY_VALIDATION_CODE,
  type CaseModuleName,
  type DraftCasePackage,
  type HashDigest,
  type PublicationApprovalRecord,
  type PublicationCandidate
} from "./schemas.ts";

function pathText(path: readonly PropertyKey[]): string {
  let result = "$";

  for (const segment of path) {
    result += typeof segment === "number" ? `[${String(segment)}]` : `.${String(segment)}`;
  }

  return result;
}

function moduleFromPath(path: readonly PropertyKey[]): CaseModuleName | undefined {
  const first = path[0];
  return typeof first === "string" && (CASE_MODULE_NAMES as readonly string[]).includes(first)
    ? first as CaseModuleName
    : undefined;
}

function schemaIssues(error: z.ZodError): CaseValidationIssue[] {
  return error.issues.map((issue) => {
    const moduleName = moduleFromPath(issue.path);
    return CaseValidationIssueSchema.parse({
      code: "SCHEMA_INVALID",
      severity: "ERROR",
      ...(moduleName === undefined ? {} : { module: moduleName }),
      path: pathText(issue.path),
      related_ids: [],
      message: `Schema validation failed: ${issue.message}`
    });
  });
}

type IssueInput = {
  code: string;
  severity: ValidationIssueSeverity;
  module?: CaseModuleName;
  path: string;
  relatedIds?: readonly string[];
  message: string;
};

function issue(input: IssueInput): CaseValidationIssue {
  return CaseValidationIssueSchema.parse({
    code: input.code,
    severity: input.severity,
    ...(input.module === undefined ? {} : { module: input.module }),
    path: input.path,
    related_ids: [...(input.relatedIds ?? [])].sort(),
    message: input.message
  });
}

function gateSeverity(mode: ValidationMode): ValidationIssueSeverity {
  return mode === "DRAFT" ? "WARNING" : "ERROR";
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicateValues = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicateValues.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicateValues].sort();
}

function addDuplicateIssues(
  issues: CaseValidationIssue[],
  values: readonly string[],
  code: string,
  module: CaseModuleName,
  path: string,
  label: string
): void {
  for (const duplicate of duplicates(values)) {
    issues.push(issue({
      code,
      severity: "ERROR",
      module,
      path,
      relatedIds: [duplicate],
      message: `Duplicate ${label}: ${duplicate}`
    }));
  }
}

function addDanglingIssues(
  issues: CaseValidationIssue[],
  references: readonly string[],
  available: ReadonlySet<string>,
  code: string,
  module: CaseModuleName,
  path: string,
  label: string
): void {
  for (const reference of references) {
    if (!available.has(reference)) {
      issues.push(issue({
        code,
        severity: "ERROR",
        module,
        path,
        relatedIds: [reference],
        message: `Dangling ${label} reference: ${reference}`
      }));
    }
  }
}

function addMissingObservationMappingIssue(
  issues: CaseValidationIssue[],
  mappings: Readonly<Record<string, unknown>>,
  stateValue: string,
  code: string,
  path: string,
  label: string,
  mode: ValidationMode
): void {
  if (!Object.hasOwn(mappings, stateValue)) {
    issues.push(issue({
      code,
      severity: gateSeverity(mode),
      module: "initial_state",
      path,
      relatedIds: [stateValue],
      message: `The initial Patient State has no ${label} projection mapping.`
    }));
  }
}

type CaseRule = DraftCasePackage["rules"]["rules"][number];

function ruleActionReferences(rule: CaseRule): string[] {
  const references = [...rule.referenced_action_ids];

  if (rule.trigger.trigger_type === "COMMITTED_EVENT" && rule.trigger.action_id !== undefined) {
    references.push(rule.trigger.action_id);
  }

  const triggerConditions = rule.trigger.trigger_type === "STATE_CONDITION"
    ? rule.trigger.conditions
    : [];
  for (const condition of [...triggerConditions, ...rule.preconditions, ...rule.exclusions]) {
    if (
      condition.condition_type === "TRIGGER_ACTION_ID"
      || condition.condition_type === "PRIOR_EVENT_OCCURRED"
    ) {
      if (condition.action_id !== undefined) {
        references.push(condition.action_id);
      }
    }
  }

  for (const event of rule.emitted_events) {
    if (event.action_id !== undefined) {
      references.push(event.action_id);
    }
  }

  for (const effect of rule.effects) {
    if (effect.effect_type === "SCHEDULE_RELATIVE" || effect.effect_type === "SCHEDULE_ABSOLUTE") {
      for (const event of effect.emitted_events) {
        if (event.action_id !== undefined) {
          references.push(event.action_id);
        }
      }
    }
  }

  return references;
}

function ruleFactReferences(rule: CaseRule): string[] {
  const triggerConditions = rule.trigger.trigger_type === "STATE_CONDITION"
    ? rule.trigger.conditions
    : [];
  return [
    ...rule.referenced_fact_ids,
    ...[...triggerConditions, ...rule.preconditions, ...rule.exclusions]
      .filter((condition) => condition.condition_type === "CASE_FACT_PRESENT")
      .map((condition) => condition.fact_id)
  ];
}

function ruleEffectIds(rule: CaseRule): string[] {
  return rule.effects.flatMap((effect) => {
    if (effect.effect_type === "SCHEDULE_RELATIVE" || effect.effect_type === "SCHEDULE_ABSOLUTE") {
      return [effect.effect_id, ...effect.effects.map((scheduledEffect) => scheduledEffect.effect_id)];
    }

    return [effect.effect_id];
  });
}

function scheduledItemDeclarations(casePackage: DraftCasePackage) {
  const fromRules = casePackage.rules.rules.flatMap((rule) =>
    rule.effects.flatMap((effect) =>
      effect.effect_type === "SCHEDULE_RELATIVE" || effect.effect_type === "SCHEDULE_ABSOLUTE"
        ? [{
            scheduled_item_id: effect.scheduled_item_id,
            category: effect.category,
            originating_rule_id: rule.rule_id
          }]
        : []
    )
  );

  return [
    ...casePackage.timeline_policy.initial_scheduled_items.map((item) => ({
      scheduled_item_id: item.scheduled_item_id,
      category: item.category,
      originating_rule_id: item.originating_rule_id
    })),
    ...fromRules
  ];
}

function immediateEffectChannel(effect: ImmediateStateEffect): string {
  switch (effect.effect_type) {
    case "SET_STATE":
      return effect.target;
    case "SET_PAIN_STATE":
      return "pain_state";
    case "ADD_INTERVENTION":
    case "REMOVE_INTERVENTION":
      return `active_interventions.${effect.intervention_id}`;
    case "ADD_COMPLICATION":
    case "REMOVE_COMPLICATION":
      return `active_complications.${effect.complication_id}`;
    case "ADD_OUTCOME_FLAG":
    case "REMOVE_OUTCOME_FLAG":
      return `outcome_flags.${effect.outcome_flag}`;
  }
}

function ruleConditionsAreProvablyExclusive(left: CaseRule, right: CaseRule): boolean {
  for (const leftCondition of left.preconditions) {
    for (const rightCondition of right.preconditions) {
      if (
        leftCondition.condition_type === "STATE_EQUALS"
        && rightCondition.condition_type === "STATE_EQUALS"
        && leftCondition.target === rightCondition.target
        && leftCondition.value !== rightCondition.value
      ) {
        return true;
      }
      if (
        leftCondition.condition_type === "STATE_EQUALS"
        && rightCondition.condition_type === "STATE_NOT_EQUALS"
        && leftCondition.target === rightCondition.target
        && leftCondition.value === rightCondition.value
      ) {
        return true;
      }
      if (
        leftCondition.condition_type === "STATE_NOT_EQUALS"
        && rightCondition.condition_type === "STATE_EQUALS"
        && leftCondition.target === rightCondition.target
        && leftCondition.value === rightCondition.value
      ) {
        return true;
      }

      const inverseCollectionCondition = (
        leftType: string,
        rightType: string,
        leftId: string,
        rightId: string
      ) => leftCondition.condition_type === leftType
        && rightCondition.condition_type === rightType
        && leftId === rightId;

      if (
        (
          "intervention_id" in leftCondition
          && "intervention_id" in rightCondition
          && (
            inverseCollectionCondition(
              "INTERVENTION_PRESENT",
              "INTERVENTION_ABSENT",
              leftCondition.intervention_id,
              rightCondition.intervention_id
            )
            || inverseCollectionCondition(
              "INTERVENTION_ABSENT",
              "INTERVENTION_PRESENT",
              leftCondition.intervention_id,
              rightCondition.intervention_id
            )
          )
        )
        || (
          "complication_id" in leftCondition
          && "complication_id" in rightCondition
          && (
            inverseCollectionCondition(
              "COMPLICATION_PRESENT",
              "COMPLICATION_ABSENT",
              leftCondition.complication_id,
              rightCondition.complication_id
            )
            || inverseCollectionCondition(
              "COMPLICATION_ABSENT",
              "COMPLICATION_PRESENT",
              leftCondition.complication_id,
              rightCondition.complication_id
            )
          )
        )
        || (
          "outcome_flag" in leftCondition
          && "outcome_flag" in rightCondition
          && (
            inverseCollectionCondition(
              "OUTCOME_FLAG_PRESENT",
              "OUTCOME_FLAG_ABSENT",
              leftCondition.outcome_flag,
              rightCondition.outcome_flag
            )
            || inverseCollectionCondition(
              "OUTCOME_FLAG_ABSENT",
              "OUTCOME_FLAG_PRESENT",
              leftCondition.outcome_flag,
              rightCondition.outcome_flag
            )
          )
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function addStaticConflictIssues(
  casePackage: DraftCasePackage,
  issues: CaseValidationIssue[]
): void {
  const writes: Array<{
    group: string;
    channel: string;
    value: string;
    ruleId: string;
    effectId: string;
    conflictPolicy: CaseRule["conflict_policy"];
    priority: number;
    rule: CaseRule;
  }> = [];

  for (const rule of casePackage.rules.rules) {
    const triggerKey = JSON.stringify(rule.trigger);

    for (const effect of rule.effects) {
      const immediateEffects = effect.effect_type === "SCHEDULE_RELATIVE"
        || effect.effect_type === "SCHEDULE_ABSOLUTE"
        ? effect.effects.map((scheduledEffect) => ({
            effect: scheduledEffect,
            group: `scheduled:${rule.rule_id}:${effect.effect_id}`,
            conflictPolicy: effect.conflict_policy
          }))
        : effect.effect_type === "CANCEL_SCHEDULED"
          ? []
          : [{
              effect,
              group: `immediate:${triggerKey}`,
              conflictPolicy: rule.conflict_policy
            }];

      for (const entry of immediateEffects) {
        const { effect_id: _effectId, ...semanticEffect } = entry.effect;
        writes.push({
          group: entry.group,
          channel: immediateEffectChannel(entry.effect),
          value: JSON.stringify(semanticEffect),
          ruleId: rule.rule_id,
          effectId: entry.effect.effect_id,
          conflictPolicy: entry.conflictPolicy,
          priority: entry.group.startsWith("scheduled:")
            ? effect.effect_type === "SCHEDULE_RELATIVE" || effect.effect_type === "SCHEDULE_ABSOLUTE"
              ? effect.priority
              : rule.priority
            : rule.priority,
          rule
        });
      }
    }
  }

  const grouped = new Map<string, typeof writes>();
  for (const write of writes) {
    const key = `${write.group}\u0000${write.channel}`;
    const group = grouped.get(key) ?? [];
    group.push(write);
    grouped.set(key, group);
  }

  for (const [key, group] of grouped) {
    const conflictingPairs = group.flatMap((left, leftIndex) =>
      group.slice(leftIndex + 1).some((right) =>
        left.value !== right.value
        && !ruleConditionsAreProvablyExclusive(left.rule, right.rule)
      )
        ? group.slice(leftIndex + 1).filter((right) =>
            left.value !== right.value
            && !ruleConditionsAreProvablyExclusive(left.rule, right.rule)
          ).map((right) => [left, right] as const)
        : []
    );
    if (conflictingPairs.length === 0) {
      continue;
    }

    const mixedPolicy = conflictingPairs.some(
      ([left, right]) => left.conflictPolicy !== right.conflictPolicy
    );
    const ambiguousSamePriority = conflictingPairs.some(
      ([left, right]) => left.conflictPolicy === right.conflictPolicy
        && left.priority === right.priority
    );
    if (!mixedPolicy && !ambiguousSamePriority) {
      continue;
    }

    issues.push(issue({
      code: mixedPolicy
        ? "MIXED_CONFLICT_POLICIES"
        : "AMBIGUOUS_EQUAL_PRIORITY_STATE_CONFLICT",
      severity: "ERROR",
      module: "rules",
      path: "$.rules.rules.effects",
      relatedIds: group.flatMap((write) => [write.ruleId, write.effectId]),
      message: mixedPolicy
        ? `Statically co-firing contradictory writes use mixed conflict policies for ${key.split("\u0000")[1]}.`
        : `Statically obvious equal-priority contradictory writes target ${key.split("\u0000")[1]}.`
    }));
  }
}

function validateReviewGate(
  casePackage: DraftCasePackage,
  issues: CaseValidationIssue[],
  mode: ValidationMode,
  reviewType: "CLINICAL" | "TECHNICAL",
  missingCode: string,
  expectedReviewHash: HashDigest | undefined
): void {
  const approvedReviews = casePackage.validation.reviews.filter(
    (review) => review.review_type === reviewType && review.status === "APPROVED"
  );
  const reviewerById = new Map(
    casePackage.validation.reviewers.map((reviewer) => [reviewer.reviewer_ref_id, reviewer])
  );

  if (approvedReviews.length === 0) {
    issues.push(issue({
      code: missingCode,
      severity: gateSeverity(mode),
      module: "validation",
      path: "$.validation.reviews",
      relatedIds: [reviewType],
      message: `An approved ${reviewType} review is required for publication.`
    }));
    return;
  }

  for (const review of approvedReviews) {
    const reviewer = reviewerById.get(review.reviewer_ref_id);

    if (reviewer === undefined) {
      issues.push(issue({
        code: "REVIEWER_REFERENCE_UNRESOLVED",
        severity: "ERROR",
        module: "validation",
        path: "$.validation.reviews",
        relatedIds: [review.review_id, review.reviewer_ref_id],
        message: "Approved review references an unknown reviewer record."
      }));
    } else if (reviewer.status !== "CONFIRMED") {
      issues.push(issue({
        code: "REVIEWER_UNCONFIRMED",
        severity: gateSeverity(mode),
        module: "validation",
        path: "$.validation.reviewers",
        relatedIds: [review.reviewer_ref_id],
        message: "Approved review requires a confirmed reviewer reference."
      }));
    }

    if (review.reviewed_case_version !== casePackage.manifest.case_version) {
      issues.push(issue({
        code: "REVIEW_VERSION_MISMATCH",
        severity: "ERROR",
        module: "validation",
        path: "$.validation.reviews",
        relatedIds: [review.review_id],
        message: "Review is not bound to the manifest case version."
      }));
    }

    if (review.reviewed_content_hash === undefined) {
      issues.push(issue({
        code: "REVIEW_CONTENT_HASH_MISSING",
        severity: gateSeverity(mode),
        module: "validation",
        path: "$.validation.reviews",
        relatedIds: [review.review_id],
        message: "Approved review must identify the exact review-subject content hash."
      }));
    } else if (
      expectedReviewHash !== undefined
      && review.reviewed_content_hash !== expectedReviewHash
    ) {
      issues.push(issue({
        code: "REVIEW_CONTENT_HASH_MISMATCH",
        severity: "ERROR",
        module: "validation",
        path: "$.validation.reviews",
        relatedIds: [review.review_id],
        message: "Review content hash does not match the current Case Package content."
      }));
    }
  }
}

function validateParsedCase(
  casePackage: DraftCasePackage,
  mode: ValidationMode,
  expectedReviewHash?: HashDigest,
  reachabilityAnalysis?: RuleReachabilityAnalysis,
  expectedReachabilityEvidenceHash?: HashDigest
): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];
  const publicationSeverity = gateSeverity(mode);
  const manifest = casePackage.manifest;

  if (reachabilityAnalysis !== undefined) {
    for (const unreachableRule of reachabilityAnalysis.unreachable_rules) {
      issues.push(issue({
        code: "RULE_UNREACHABLE",
        severity: publicationSeverity,
        module: "rules",
        path: "$.rules.rules",
        relatedIds: [unreachableRule.rule_id, ...unreachableRule.reason_codes],
        message: "Static analysis could not prove this declarative rule reachable."
      }));
    }

    for (const coverageIssue of reachabilityAnalysis.projection_coverage_issues) {
      issues.push(issue({
        code: "REACHABLE_OBSERVATION_MAPPING_MISSING",
        severity: publicationSeverity,
        module: "initial_state",
        path: coverageIssue.mapping_path,
        relatedIds: [coverageIssue.state_target, coverageIssue.state_value],
        message: "A reachable observation-driving Patient State value has no pinned projection mapping."
      }));
    }

    for (const livenessFinding of reachabilityAnalysis.scheduler_liveness_findings) {
      issues.push(issue({
        code: "SCHEDULER_LIVENESS_UNSAFE",
        severity: publicationSeverity,
        module: "rules",
        path: livenessFinding.path,
        relatedIds: [
          livenessFinding.rule_id,
          livenessFinding.effect_id,
          livenessFinding.scheduled_item_id,
          livenessFinding.code
        ],
        message: "Static analysis found runtime scheduling that cannot prove strict Clinical-Time progress."
      }));
    }
  }

  addDuplicateIssues(
    issues,
    manifest.modules.map((module) => module.module_name),
    "DUPLICATE_MODULE_DECLARATION",
    "manifest",
    "$.manifest.modules",
    "module declaration"
  );

  const declarationByName = new Map(
    manifest.modules.map((declaration) => [declaration.module_name, declaration])
  );

  for (const moduleName of CASE_MODULE_NAMES) {
    const declaration = declarationByName.get(moduleName);

    if (declaration === undefined) {
      issues.push(issue({
        code: "MANIFEST_MODULE_MISMATCH",
        severity: "ERROR",
        module: "manifest",
        path: "$.manifest.modules",
        relatedIds: [moduleName],
        message: `Manifest does not declare required module: ${moduleName}`
      }));
      continue;
    }

    const moduleValue = casePackage[moduleName] as unknown as {
      module_schema_version?: string;
      schema_version?: string;
    };
    const actualSchemaVersion = moduleName === "manifest"
      ? moduleValue.schema_version
      : moduleValue.module_schema_version;

    if (declaration.schema_version !== actualSchemaVersion) {
      issues.push(issue({
        code: "MODULE_SCHEMA_VERSION_MISMATCH",
        severity: "ERROR",
        module: moduleName,
        path: "$.manifest.modules",
        relatedIds: [moduleName],
        message: "Declared module schema version does not match module content."
      }));
    }

    if (!declaration.compatible_package_schema_versions.includes(manifest.schema_version)) {
      issues.push(issue({
        code: "MODULE_SCHEMA_INCOMPATIBLE",
        severity: publicationSeverity,
        module: moduleName,
        path: "$.manifest.modules",
        relatedIds: [moduleName, manifest.schema_version],
        message: "Module does not declare compatibility with the package schema version."
      }));
    }

    if (!declaration.required) {
      issues.push(issue({
        code: "CORE_MODULE_NOT_REQUIRED",
        severity: publicationSeverity,
        module: moduleName,
        path: "$.manifest.modules",
        relatedIds: [moduleName],
        message: "Published packages must mark every frozen core module as required."
      }));
    }

    if (declaration.approval_status !== "APPROVED") {
      issues.push(issue({
        code: "MODULE_NOT_APPROVED",
        severity: publicationSeverity,
        module: moduleName,
        path: "$.manifest.modules",
        relatedIds: [moduleName],
        message: "Required module is not approved."
      }));
    }
  }

  if (manifest.schema_version !== CASE_SCHEMA_VERSION) {
    issues.push(issue({
      code: "PACKAGE_SCHEMA_UNSUPPORTED",
      severity: publicationSeverity,
      module: "manifest",
      path: "$.manifest.schema_version",
      relatedIds: [manifest.schema_version],
      message: `This compiler supports Case Schema ${CASE_SCHEMA_VERSION}.`
    }));
  }

  const lifecycleConflict = manifest.status === "DRAFT"
    ? casePackage.validation.approval_status !== "DRAFT"
      || casePackage.validation.review_status !== "DRAFT"
    : manifest.status === "UNDER_REVIEW"
      ? casePackage.validation.approval_status === "DRAFT"
        || casePackage.validation.review_status === "DRAFT"
      : casePackage.validation.approval_status !== "APPROVED"
        || casePackage.validation.review_status !== "APPROVED";

  if (lifecycleConflict) {
    issues.push(issue({
      code: "LIFECYCLE_STATUS_CONFLICT",
      severity: "ERROR",
      module: "validation",
      path: "$.validation",
      relatedIds: [manifest.status, casePackage.validation.approval_status],
      message: "Manifest lifecycle conflicts with validation review/approval status."
    }));
  }

  if (
    mode === "CANDIDATE"
    && manifest.status !== "UNDER_REVIEW"
    && manifest.status !== "APPROVED"
  ) {
    issues.push(issue({
      code: "PUBLICATION_CANDIDATE_LIFECYCLE_INVALID",
      severity: "ERROR",
      module: "manifest",
      path: "$.manifest.status",
      relatedIds: [manifest.status],
      message: "Publication candidates accept only an UNDER_REVIEW or APPROVED source Case Version."
    }));
  }

  if (mode === "PUBLICATION" && manifest.status !== "APPROVED") {
    issues.push(issue({
      code: "FINAL_PUBLICATION_SOURCE_NOT_APPROVED",
      severity: "ERROR",
      module: "manifest",
      path: "$.manifest.status",
      relatedIds: [manifest.status],
      message: "Final publication requires an APPROVED source Case Version."
    }));
  }

  if (casePackage.initial_state.patient_state.case_version !== manifest.case_version) {
    issues.push(issue({
      code: "INITIAL_STATE_VERSION_MISMATCH",
      severity: "ERROR",
      module: "initial_state",
      path: "$.initial_state.patient_state.case_version",
      relatedIds: [casePackage.initial_state.patient_state.case_version, manifest.case_version],
      message: "Initial Patient State case version must match the manifest."
    }));
  }

  const initialPatientState = casePackage.initial_state.patient_state;
  const observationProjection = casePackage.initial_state.observation_projection;

  if (observationProjection === undefined) {
    issues.push(issue({
      code: "OBSERVATION_PROJECTION_MISSING",
      severity: publicationSeverity,
      module: "initial_state",
      path: "$.initial_state.observation_projection",
      relatedIds: [],
      message: "A reviewed observation projection definition is required for publication."
    }));
  } else {
    addMissingObservationMappingIssue(
      issues,
      observationProjection.hemodynamic_mappings,
      initialPatientState.hemodynamic_state,
      "OBSERVATION_HEMODYNAMIC_MAPPING_MISSING",
      "$.initial_state.observation_projection.hemodynamic_mappings",
      "hemodynamic",
      mode
    );
    addMissingObservationMappingIssue(
      issues,
      observationProjection.respiratory_mappings,
      initialPatientState.respiratory_state,
      "OBSERVATION_RESPIRATORY_MAPPING_MISSING",
      "$.initial_state.observation_projection.respiratory_mappings",
      "respiratory",
      mode
    );
    addMissingObservationMappingIssue(
      issues,
      observationProjection.oxygenation_mappings,
      initialPatientState.oxygenation,
      "OBSERVATION_OXYGENATION_MAPPING_MISSING",
      "$.initial_state.observation_projection.oxygenation_mappings",
      "oxygenation",
      mode
    );
    addMissingObservationMappingIssue(
      issues,
      observationProjection.consciousness_mappings,
      initialPatientState.consciousness,
      "OBSERVATION_CONSCIOUSNESS_MAPPING_MISSING",
      "$.initial_state.observation_projection.consciousness_mappings",
      "consciousness",
      mode
    );
    addMissingObservationMappingIssue(
      issues,
      observationProjection.rhythm_mappings,
      initialPatientState.cardiac_rhythm,
      "OBSERVATION_RHYTHM_MAPPING_MISSING",
      "$.initial_state.observation_projection.rhythm_mappings",
      "cardiac-rhythm",
      mode
    );

    if (observationProjection.temperature_mappings !== undefined) {
      addMissingObservationMappingIssue(
        issues,
        observationProjection.temperature_mappings,
        initialPatientState.temperature_state,
        "OBSERVATION_TEMPERATURE_MAPPING_MISSING",
        "$.initial_state.observation_projection.temperature_mappings",
        "temperature",
        mode
      );
    }
  }

  if (!casePackage.patient_profile.supported_languages.includes(
    casePackage.patient_profile.default_language
  )) {
    issues.push(issue({
      code: "DEFAULT_LANGUAGE_UNSUPPORTED",
      severity: "ERROR",
      module: "patient_profile",
      path: "$.patient_profile.supported_languages",
      relatedIds: [casePackage.patient_profile.default_language],
      message: "Default patient language must be present in supported languages."
    }));
  }

  if (
    casePackage.patient_profile.disclosure_policy_id
    !== casePackage.dialogue_policy.dialogue_policy_id
  ) {
    issues.push(issue({
      code: "DIALOGUE_POLICY_REFERENCE_INVALID",
      severity: "ERROR",
      module: "patient_profile",
      path: "$.patient_profile.disclosure_policy_id",
      relatedIds: [casePackage.patient_profile.disclosure_policy_id],
      message: "Patient profile references an unknown dialogue policy."
    }));
  }

  const factIds = casePackage.clinical_facts.facts.map((fact) => fact.fact_id);
  const actionIds = casePackage.action_catalogue.actions.map((action) => action.action_id);
  const ruleIds = casePackage.rules.rules.map((rule) => rule.rule_id);
  const timingWindowIds = casePackage.timeline_policy.timing_windows.map(
    (timingWindow) => timingWindow.timing_window_id
  );
  const mediaAssetIds = casePackage.visual_manifest.media_assets.map(
    (asset) => asset.media_asset_id
  );
  const objectiveIds = casePackage.curriculum_mappings.objectives.map(
    (objective) => objective.objective_id
  );
  const sourceIds = casePackage.validation.sources.map((source) => source.source_id);

  addDuplicateIssues(issues, factIds, "DUPLICATE_FACT_ID", "clinical_facts", "$.clinical_facts.facts", "Fact ID");
  addDuplicateIssues(issues, actionIds, "DUPLICATE_ACTION_ID", "action_catalogue", "$.action_catalogue.actions", "Action ID");
  addDuplicateIssues(issues, ruleIds, "DUPLICATE_RULE_ID", "rules", "$.rules.rules", "Rule ID");
  addDuplicateIssues(issues, timingWindowIds, "DUPLICATE_TIMING_WINDOW_ID", "timeline_policy", "$.timeline_policy.timing_windows", "timing-window ID");
  addDuplicateIssues(issues, mediaAssetIds, "DUPLICATE_MEDIA_ASSET_ID", "visual_manifest", "$.visual_manifest.media_assets", "Media Asset ID");
  addDuplicateIssues(issues, objectiveIds, "DUPLICATE_OBJECTIVE_ID", "curriculum_mappings", "$.curriculum_mappings.objectives", "objective ID");
  addDuplicateIssues(issues, sourceIds, "DUPLICATE_SOURCE_ID", "validation", "$.validation.sources", "Source ID");
  addDuplicateIssues(
    issues,
    casePackage.validation.reviewers.map((reviewer) => reviewer.reviewer_ref_id),
    "DUPLICATE_REVIEWER_REFERENCE_ID",
    "validation",
    "$.validation.reviewers",
    "reviewer reference ID"
  );
  addDuplicateIssues(
    issues,
    casePackage.validation.reviews.map((review) => review.review_id),
    "DUPLICATE_REVIEW_ID",
    "validation",
    "$.validation.reviews",
    "review ID"
  );

  const facts = new Set<string>(factIds);
  const actions = new Set<string>(actionIds);
  const rules = new Set<string>(ruleIds);
  const timingWindows = new Set<string>(timingWindowIds);
  const mediaAssets = new Set<string>(mediaAssetIds);
  const objectives = new Set<string>(objectiveIds);
  const sources = new Set<string>(sourceIds);
  const reviewers = new Set<string>(
    casePackage.validation.reviewers.map((reviewer) => reviewer.reviewer_ref_id)
  );

  addDanglingIssues(
    issues,
    [casePackage.presentation.chief_complaint_fact_id, ...casePackage.presentation.initial_public_fact_ids],
    facts,
    "DANGLING_FACT_REFERENCE",
    "presentation",
    "$.presentation",
    "Fact ID"
  );
  addDanglingIssues(
    issues,
    [...casePackage.dialogue_policy.disclosable_fact_ids, ...casePackage.dialogue_policy.forbidden_fact_ids],
    facts,
    "DANGLING_FACT_REFERENCE",
    "dialogue_policy",
    "$.dialogue_policy",
    "Fact ID"
  );

  for (const fact of casePackage.clinical_facts.facts) {
    if (fact.disclosure_reference_fact_id !== undefined) {
      addDanglingIssues(issues, [fact.disclosure_reference_fact_id], facts, "DANGLING_FACT_REFERENCE", "clinical_facts", "$.clinical_facts.facts", "Fact ID");
    }
    addDanglingIssues(issues, fact.source_ids, sources, "DANGLING_SOURCE_REFERENCE", "clinical_facts", "$.clinical_facts.facts", "Source ID");
  }

  for (const action of casePackage.action_catalogue.actions) {
    addDanglingIssues(issues, action.prerequisite_action_ids, actions, "DANGLING_ACTION_REFERENCE", "action_catalogue", "$.action_catalogue.actions", "Action ID");
    addDanglingIssues(issues, action.source_ids, sources, "DANGLING_SOURCE_REFERENCE", "action_catalogue", "$.action_catalogue.actions", "Source ID");

    for (const parameter of action.parameter_definitions) {
      if (
        parameter.minimum !== undefined
        && parameter.maximum !== undefined
        && parameter.maximum < parameter.minimum
      ) {
        issues.push(issue({
          code: "INVALID_PARAMETER_RANGE",
          severity: "ERROR",
          module: "action_catalogue",
          path: "$.action_catalogue.actions.parameter_definitions",
          relatedIds: [action.action_id, parameter.parameter_code],
          message: "Action parameter maximum cannot be less than minimum."
        }));
      }
    }
  }

  for (const rule of casePackage.rules.rules) {
    addDanglingIssues(issues, ruleActionReferences(rule), actions, "DANGLING_ACTION_REFERENCE", "rules", "$.rules.rules", "Action ID");
    addDanglingIssues(issues, rule.referenced_rule_ids, rules, "DANGLING_RULE_REFERENCE", "rules", "$.rules.rules", "Rule ID");
    addDanglingIssues(issues, ruleFactReferences(rule), facts, "DANGLING_FACT_REFERENCE", "rules", "$.rules.rules", "Fact ID");
    addDanglingIssues(issues, rule.source_ids, sources, "DANGLING_SOURCE_REFERENCE", "rules", "$.rules.rules", "Source ID");
    addDanglingIssues(issues, rule.timing_window_ids, timingWindows, "DANGLING_TIMING_WINDOW_REFERENCE", "rules", "$.rules.rules", "timing-window ID");

    addDuplicateIssues(
      issues,
      ruleEffectIds(rule),
      "DUPLICATE_RULE_EFFECT_ID",
      "rules",
      "$.rules.rules.effects",
      "Rule Effect ID"
    );
  }

  addStaticConflictIssues(casePackage, issues);

  const scheduledDeclarations = scheduledItemDeclarations(casePackage);
  const declaredScheduledItemIds = new Set(
    scheduledDeclarations.map((declaration) => declaration.scheduled_item_id)
  );
  const declaredScheduledCategories = new Set(
    scheduledDeclarations.map((declaration) => declaration.category)
  );

  for (const declaration of scheduledDeclarations) {
    addDanglingIssues(
      issues,
      [declaration.originating_rule_id],
      rules,
      "DANGLING_RULE_REFERENCE",
      "timeline_policy",
      "$.timeline_policy.initial_scheduled_items",
      "originating Rule ID"
    );
  }

  for (const item of casePackage.timeline_policy.initial_scheduled_items) {
    addDanglingIssues(
      issues,
      item.emitted_events.flatMap((event) =>
        event.action_id === undefined ? [] : [event.action_id]
      ),
      actions,
      "DANGLING_ACTION_REFERENCE",
      "timeline_policy",
      "$.timeline_policy.initial_scheduled_items.emitted_events",
      "Action ID"
    );
  }

  for (const rule of casePackage.rules.rules) {
    if (rule.trigger.trigger_type === "SCHEDULED_ITEM") {
      const triggerDeclared = (
        rule.trigger.scheduled_item_id === undefined
        || declaredScheduledItemIds.has(rule.trigger.scheduled_item_id)
      ) && (
        rule.trigger.category === undefined
        || declaredScheduledCategories.has(rule.trigger.category)
      );
      if (!triggerDeclared) {
        issues.push(issue({
          code: "DANGLING_SCHEDULE_TRIGGER_REFERENCE",
          severity: "ERROR",
          module: "rules",
          path: "$.rules.rules.trigger",
          relatedIds: [rule.rule_id],
          message: "Scheduled-item trigger references no declared scheduled item or category."
        }));
      }
    }

    for (const effect of rule.effects) {
      if (effect.effect_type !== "CANCEL_SCHEDULED") {
        continue;
      }

      const selector = effect.selector;
      const declared = selector.selector_type === "SCHEDULED_ITEM_ID"
        ? declaredScheduledItemIds.has(selector.scheduled_item_id)
        : declaredScheduledCategories.has(selector.category);

      if (!declared) {
        issues.push(issue({
          code: "DANGLING_SCHEDULE_CANCELLATION_REFERENCE",
          severity: "ERROR",
          module: "rules",
          path: "$.rules.rules.effects.selector",
          relatedIds: [
            selector.selector_type === "SCHEDULED_ITEM_ID"
              ? selector.scheduled_item_id
              : selector.category
          ],
          message: "Schedule cancellation references no declared scheduled item or category."
        }));
      }
    }
  }

  for (const timingWindow of casePackage.timeline_policy.timing_windows) {
    if (
      timingWindow.ends_at_clinical_seconds
      <= timingWindow.starts_at_clinical_seconds
    ) {
      issues.push(issue({
        code: "INVALID_TIMING_WINDOW",
        severity: "ERROR",
        module: "timeline_policy",
        path: "$.timeline_policy.timing_windows",
        relatedIds: [timingWindow.timing_window_id],
        message: "Timing window end must be greater than its start."
      }));
    }
    if (timingWindow.reference_action_id !== undefined) {
      addDanglingIssues(issues, [timingWindow.reference_action_id], actions, "DANGLING_ACTION_REFERENCE", "timeline_policy", "$.timeline_policy.timing_windows", "Action ID");
    }
  }

  addDanglingIssues(issues, casePackage.assessment_rubric.source_ids, sources, "DANGLING_SOURCE_REFERENCE", "assessment_rubric", "$.assessment_rubric.source_ids", "Source ID");
  const rubricEvidence = [
    ...casePackage.assessment_rubric.domains.flatMap((domain) => domain.evidence),
    ...casePackage.assessment_rubric.critical_items.map((item) => item.evidence)
  ];
  for (const evidence of rubricEvidence) {
    addDanglingIssues(issues, evidence.action_ids, actions, "DANGLING_ACTION_REFERENCE", "assessment_rubric", "$.assessment_rubric", "Action ID");
    if (evidence.timing_window_id !== undefined) {
      addDanglingIssues(issues, [evidence.timing_window_id], timingWindows, "DANGLING_TIMING_WINDOW_REFERENCE", "assessment_rubric", "$.assessment_rubric", "timing-window ID");
    }
  }

  for (const recipe of casePackage.visual_manifest.recipes) {
    addDanglingIssues(issues, recipe.media_asset_ids, mediaAssets, "DANGLING_MEDIA_REFERENCE", "visual_manifest", "$.visual_manifest.recipes", "Media Asset ID");
    if (recipe.fallback_asset_id !== undefined) {
      addDanglingIssues(issues, [recipe.fallback_asset_id], mediaAssets, "DANGLING_MEDIA_REFERENCE", "visual_manifest", "$.visual_manifest.recipes", "Media Asset ID");
    }
  }
  for (const group of casePackage.visual_manifest.preload_groups) {
    addDanglingIssues(issues, group.media_asset_ids, mediaAssets, "DANGLING_MEDIA_REFERENCE", "visual_manifest", "$.visual_manifest.preload_groups", "Media Asset ID");
  }

  const fallbackId = casePackage.visual_manifest.required_static_fallback_asset_id;
  if (fallbackId === undefined) {
    issues.push(issue({
      code: "MISSING_VISUAL_FALLBACK",
      severity: publicationSeverity,
      module: "visual_manifest",
      path: "$.visual_manifest.required_static_fallback_asset_id",
      message: "A required static visual fallback must be declared."
    }));
  } else {
    const fallback = casePackage.visual_manifest.media_assets.find(
      (asset) => asset.media_asset_id === fallbackId
    );
    if (fallback === undefined) {
      issues.push(issue({
        code: "DANGLING_MEDIA_REFERENCE",
        severity: "ERROR",
        module: "visual_manifest",
        path: "$.visual_manifest.required_static_fallback_asset_id",
        relatedIds: [fallbackId],
        message: "Required visual fallback references an unknown Media Asset ID."
      }));
    } else if (!fallback.static_fallback || fallback.media_kind !== "STATIC_IMAGE") {
      issues.push(issue({
        code: "INVALID_VISUAL_FALLBACK",
        severity: publicationSeverity,
        module: "visual_manifest",
        path: "$.visual_manifest.required_static_fallback_asset_id",
        relatedIds: [fallbackId],
        message: "Required visual fallback must identify a static fallback image."
      }));
    }
  }

  addDanglingIssues(issues, casePackage.validation.required_source_ids, sources, "REQUIRED_SOURCE_MISSING", "validation", "$.validation.required_source_ids", "required Source ID");

  for (const objective of casePackage.curriculum_mappings.objectives) {
    addDanglingIssues(issues, [objective.source_id], sources, "DANGLING_SOURCE_REFERENCE", "curriculum_mappings", "$.curriculum_mappings.objectives", "Source ID");
    if (objective.status !== "APPROVED") {
      issues.push(issue({
        code: "CURRICULUM_MAPPING_UNRESOLVED",
        severity: publicationSeverity,
        module: "curriculum_mappings",
        path: "$.curriculum_mappings.objectives",
        relatedIds: [objective.objective_id],
        message: "Curriculum objective remains unresolved or placeholder."
      }));
    }
  }

  const objectiveById = new Map(
    casePackage.curriculum_mappings.objectives.map((objective) => [objective.objective_id, objective])
  );
  for (const mapping of casePackage.curriculum_mappings.mappings) {
    if (!objectives.has(mapping.objective_id)) {
      issues.push(issue({
        code: "DANGLING_CURRICULUM_OBJECTIVE_REFERENCE",
        severity: "ERROR",
        module: "curriculum_mappings",
        path: "$.curriculum_mappings.mappings",
        relatedIds: [mapping.mapping_id, mapping.objective_id],
        message: "Curriculum mapping references an unknown objective."
      }));
    } else if (objectiveById.get(mapping.objective_id)?.institution.institution_id !== mapping.institution_id) {
      issues.push(issue({
        code: "INSTITUTION_MAPPING_MISMATCH",
        severity: "ERROR",
        module: "curriculum_mappings",
        path: "$.curriculum_mappings.mappings",
        relatedIds: [mapping.mapping_id],
        message: "Curriculum mapping institution does not match its objective."
      }));
    }
    if (mapping.status !== "APPROVED") {
      issues.push(issue({
        code: "CURRICULUM_MAPPING_UNRESOLVED",
        severity: publicationSeverity,
        module: "curriculum_mappings",
        path: "$.curriculum_mappings.mappings",
        relatedIds: [mapping.mapping_id],
        message: "Curriculum mapping remains unresolved or placeholder."
      }));
    }
  }

  for (const source of casePackage.validation.sources) {
    if (source.status !== "APPROVED" && (source.required || mode === "PUBLICATION")) {
      issues.push(issue({
        code: "SOURCE_UNRESOLVED",
        severity: publicationSeverity,
        module: "validation",
        path: "$.validation.sources",
        relatedIds: [source.source_id],
        message: "Required source status is unresolved or placeholder."
      }));
    }
  }

  for (const review of casePackage.validation.reviews) {
    if (!reviewers.has(review.reviewer_ref_id)) {
      issues.push(issue({
        code: "REVIEWER_REFERENCE_UNRESOLVED",
        severity: "ERROR",
        module: "validation",
        path: "$.validation.reviews",
        relatedIds: [review.review_id, review.reviewer_ref_id],
        message: "Review references an unknown reviewer record."
      }));
    }
  }

  addDuplicateIssues(
    issues,
    casePackage.validation.deferred_checks.map((check) => check.validation_code),
    "DUPLICATE_VALIDATION_EVIDENCE",
    "validation",
    "$.validation.deferred_checks",
    "validation evidence code"
  );

  const reachabilityEvidence = casePackage.validation.deferred_checks.find(
    (check) => check.validation_code === RULE_REACHABILITY_VALIDATION_CODE
  );

  if (reachabilityEvidence === undefined) {
    issues.push(issue({
      code: "RULE_REACHABILITY_EVIDENCE_MISSING",
      severity: publicationSeverity,
      module: "validation",
      path: "$.validation.deferred_checks",
      relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
      message: "Mandatory Rule Reachability validation evidence is missing."
    }));
  } else {
    if (!reachabilityEvidence.required_for_publication) {
      issues.push(issue({
        code: "RULE_REACHABILITY_POLICY_INVALID",
        severity: publicationSeverity,
        module: "validation",
        path: "$.validation.deferred_checks",
        relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
        message: "Rule Reachability is mandatory and cannot be downgraded by authored data."
      }));
    }

    if (reachabilityEvidence.status === "DEFERRED") {
      issues.push(issue({
        code: "RULE_REACHABILITY_DEFERRED",
        severity: publicationSeverity,
        module: "validation",
        path: "$.validation.deferred_checks",
        relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
        message: "Mandatory Rule Reachability validation remains deferred."
      }));
    } else if (reachabilityEvidence.status === "UNRESOLVED") {
      issues.push(issue({
        code: "RULE_REACHABILITY_UNRESOLVED",
        severity: publicationSeverity,
        module: "validation",
        path: "$.validation.deferred_checks",
        relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
        message: "Mandatory Rule Reachability validation remains unresolved."
      }));
    } else if (reachabilityEvidence.status === "FAILED") {
      issues.push(issue({
        code: "RULE_REACHABILITY_FAILED",
        severity: publicationSeverity,
        module: "validation",
        path: "$.validation.deferred_checks",
        relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
        message: "Mandatory Rule Reachability validation failed."
      }));
    } else {
      if (
        reachabilityEvidence.validator_id !== RULE_REACHABILITY_ANALYZER_ID
        || reachabilityEvidence.validator_version !== RULE_REACHABILITY_ANALYZER_VERSION
      ) {
        issues.push(issue({
          code: "RULE_REACHABILITY_EVIDENCE_STALE",
          severity: publicationSeverity,
          module: "validation",
          path: "$.validation.deferred_checks",
          relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
          message: "Rule Reachability evidence was not produced by the currently supported analyzer."
        }));
      }

      const evidenceComplete = reachabilityEvidence.validator_id !== undefined
        && reachabilityEvidence.validator_version !== undefined
        && reachabilityEvidence.evidence_hash !== undefined
        && reachabilityEvidence.validated_case_version_id !== undefined
        && reachabilityEvidence.validated_case_version !== undefined
        && reachabilityEvidence.validated_review_subject_hash !== undefined
        && reachabilityEvidence.completed_at_utc !== undefined;

      if (!evidenceComplete) {
        issues.push(issue({
          code: "RULE_REACHABILITY_EVIDENCE_INCOMPLETE",
          severity: publicationSeverity,
          module: "validation",
          path: "$.validation.deferred_checks",
          relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
          message: "Passed Rule Reachability validation requires validator, evidence, exact-version, content-hash, and completion metadata."
        }));
      } else if (
        reachabilityEvidence.validated_case_version_id !== manifest.case_version_id
        || reachabilityEvidence.validated_case_version !== manifest.case_version
        || (
          expectedReviewHash !== undefined
          && reachabilityEvidence.validated_review_subject_hash !== expectedReviewHash
        )
        || (
          expectedReachabilityEvidenceHash !== undefined
          && reachabilityEvidence.evidence_hash !== expectedReachabilityEvidenceHash
        )
      ) {
        issues.push(issue({
          code: "RULE_REACHABILITY_EVIDENCE_STALE",
          severity: publicationSeverity,
          module: "validation",
          path: "$.validation.deferred_checks",
          relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
          message: "Rule Reachability evidence is not bound to the current Case Version and review-subject hash."
        }));
      }

      if (reachabilityAnalysis !== undefined && reachabilityAnalysis.result !== "PASSED") {
        issues.push(issue({
          code: "RULE_REACHABILITY_FAILED",
          severity: publicationSeverity,
          module: "validation",
          path: "$.validation.deferred_checks",
          relatedIds: [RULE_REACHABILITY_VALIDATION_CODE],
          message: "Current deterministic Rule Reachability analysis fails publication safety."
        }));
      }
    }
  }

  for (const deferredCheck of casePackage.validation.deferred_checks) {
    if (deferredCheck.validation_code === RULE_REACHABILITY_VALIDATION_CODE) {
      continue;
    }

    if (
      deferredCheck.status === "DEFERRED"
      || deferredCheck.status === "UNRESOLVED"
    ) {
      issues.push(issue({
        code: "DEFERRED_VALIDATION_UNRESOLVED",
        severity: deferredCheck.required_for_publication
          ? publicationSeverity
          : "WARNING",
        module: "validation",
        path: "$.validation.deferred_checks",
        relatedIds: [deferredCheck.validation_code],
        message: deferredCheck.required_for_publication
          ? "A publication-required validation remains unresolved or deferred."
          : "A non-blocking validation remains unresolved or deferred."
      }));
    } else if (deferredCheck.status === "FAILED") {
      issues.push(issue({
        code: "DEFERRED_VALIDATION_FAILED",
        severity: deferredCheck.required_for_publication
          ? publicationSeverity
          : "WARNING",
        module: "validation",
        path: "$.validation.deferred_checks",
        relatedIds: [deferredCheck.validation_code],
        message: deferredCheck.required_for_publication
          ? "A publication-required validation explicitly failed."
          : "A non-blocking validation explicitly failed."
      }));
    }
  }

  if (casePackage.validation.review_status !== "APPROVED") {
    issues.push(issue({
      code: "VALIDATION_REVIEW_INCOMPLETE",
      severity: publicationSeverity,
      module: "validation",
      path: "$.validation.review_status",
      relatedIds: [casePackage.validation.review_status],
      message: "Validation review status is incomplete."
    }));
  }
  if (
    (mode === "DRAFT" || mode === "PUBLICATION")
    && casePackage.validation.approval_status !== "APPROVED"
  ) {
    issues.push(issue({
      code: "VALIDATION_APPROVAL_INCOMPLETE",
      severity: publicationSeverity,
      module: "validation",
      path: "$.validation.approval_status",
      relatedIds: [casePackage.validation.approval_status],
      message: "Validation approval status is incomplete."
    }));
  } else if (
    mode === "CANDIDATE"
    && casePackage.validation.approval_status === "DRAFT"
  ) {
    issues.push(issue({
      code: "VALIDATION_APPROVAL_INCOMPLETE",
      severity: "ERROR",
      module: "validation",
      path: "$.validation.approval_status",
      relatedIds: [casePackage.validation.approval_status],
      message: "Candidate preparation requires validation approval to have entered review."
    }));
  }

  validateReviewGate(casePackage, issues, mode, "CLINICAL", "CLINICAL_REVIEW_MISSING", expectedReviewHash);
  validateReviewGate(casePackage, issues, mode, "TECHNICAL", "TECHNICAL_REVIEW_MISSING", expectedReviewHash);

  return issues;
}

export function validateDraftCase(input: unknown): CaseValidationReport {
  const parsed = DraftCasePackageSchema.safeParse(input);

  if (!parsed.success) {
    return createValidationReport("DRAFT", schemaIssues(parsed.error));
  }

  return createValidationReport(
    "DRAFT",
    validateParsedCase(
      parsed.data,
      "DRAFT",
      undefined,
      analyzeRuleReachability(parsed.data)
    )
  );
}

async function reachabilityValidationContext(
  casePackage: DraftCasePackage,
  reviewSubjectHash: HashDigest,
  hashAdapter: HashAdapter
): Promise<{
  analysis: RuleReachabilityAnalysis;
  expectedEvidenceHash?: HashDigest;
}> {
  const analysis = analyzeRuleReachability(casePackage);
  const evidence = casePackage.validation.deferred_checks.find(
    (check) => check.validation_code === RULE_REACHABILITY_VALIDATION_CODE
  );

  if (evidence?.completed_at_utc === undefined) {
    return { analysis };
  }

  return {
    analysis,
    expectedEvidenceHash: await computeRuleReachabilityEvidenceHash(
      casePackage,
      reviewSubjectHash,
      evidence.completed_at_utc,
      hashAdapter
    )
  };
}

export async function validateForPublicationCandidate(
  input: unknown,
  hashAdapter: HashAdapter
): Promise<CaseValidationReport> {
  const parsed = DraftCasePackageSchema.safeParse(input);

  if (!parsed.success) {
    return createValidationReport("CANDIDATE", schemaIssues(parsed.error));
  }

  try {
    const reviewSubjectHash = await computeReviewSubjectHash(parsed.data, hashAdapter);
    const reachability = await reachabilityValidationContext(
      parsed.data,
      reviewSubjectHash,
      hashAdapter
    );
    return createValidationReport(
      "CANDIDATE",
      validateParsedCase(
        parsed.data,
        "CANDIDATE",
        reviewSubjectHash,
        reachability.analysis,
        reachability.expectedEvidenceHash
      )
    );
  } catch {
    return createValidationReport("CANDIDATE", [issue({
      code: "HASH_ADAPTER_FAILURE",
      severity: "ERROR",
      path: "$",
      message: "The supplied hash adapter could not produce a valid SHA-256 digest."
    })]);
  }
}

function validateApprovalRecord(
  casePackage: DraftCasePackage,
  candidate: PublicationCandidate,
  approval: PublicationApprovalRecord
): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];

  if (approval.status !== "APPROVED") {
    issues.push(issue({
      code: "PACKAGE_APPROVAL_NOT_APPROVED",
      severity: "ERROR",
      path: "$.approval.status",
      relatedIds: [approval.approval_id, approval.status],
      message: "Exact-package Approval Record must have APPROVED status."
    }));
  }

  if (approval.case_version_id !== casePackage.manifest.case_version_id) {
    issues.push(issue({
      code: "PACKAGE_APPROVAL_VERSION_ID_MISMATCH",
      severity: "ERROR",
      path: "$.approval.case_version_id",
      relatedIds: [approval.approval_id, approval.case_version_id],
      message: "Approval Record Case Version identity does not match the source Case Version."
    }));
  }

  if (approval.case_version !== casePackage.manifest.case_version) {
    issues.push(issue({
      code: "PACKAGE_APPROVAL_VERSION_MISMATCH",
      severity: "ERROR",
      path: "$.approval.case_version",
      relatedIds: [approval.approval_id, approval.case_version],
      message: "Approval Record semantic Case Version does not match the source Case Version."
    }));
  }

  if (approval.approved_package_hash !== candidate.candidate_package_hash) {
    issues.push(issue({
      code: "PACKAGE_APPROVAL_HASH_MISMATCH",
      severity: "ERROR",
      path: "$.approval.approved_package_hash",
      relatedIds: [approval.approval_id, approval.approved_package_hash],
      message: "Approval Record hash does not match the recomputed publication candidate hash."
    }));
  }

  const reviewById = new Map(
    casePackage.validation.reviews.map((review) => [review.review_id, review])
  );
  const referencedReviewIds = new Set<string>();

  for (const reviewId of approval.required_review_ids) {
    if (referencedReviewIds.has(reviewId)) {
      issues.push(issue({
        code: "PACKAGE_APPROVAL_REVIEW_REFERENCE_INVALID",
        severity: "ERROR",
        path: "$.approval.required_review_ids",
        relatedIds: [approval.approval_id, reviewId],
        message: "Approval Record contains a duplicate required review reference."
      }));
      continue;
    }
    referencedReviewIds.add(reviewId);

    const review = reviewById.get(reviewId);
    if (review === undefined || review.status !== "APPROVED") {
      issues.push(issue({
        code: "PACKAGE_APPROVAL_REVIEW_REFERENCE_INVALID",
        severity: "ERROR",
        path: "$.approval.required_review_ids",
        relatedIds: [approval.approval_id, reviewId],
        message: "Approval Record references a missing or non-approved review."
      }));
    }
  }

  for (const requiredReviewType of ["CLINICAL", "TECHNICAL"] as const) {
    const hasRequiredReview = approval.required_review_ids.some((reviewId) => {
      const review = reviewById.get(reviewId);
      return review?.review_type === requiredReviewType && review.status === "APPROVED";
    });

    if (!hasRequiredReview) {
      issues.push(issue({
        code: "PACKAGE_APPROVAL_REQUIRED_REVIEW_MISSING",
        severity: "ERROR",
        path: "$.approval.required_review_ids",
        relatedIds: [approval.approval_id, requiredReviewType],
        message: `Approval Record must reference an approved ${requiredReviewType} review.`
      }));
    }
  }

  return issues;
}

export async function validateForPublication(
  input: unknown,
  approvalInput: unknown,
  hashAdapter: HashAdapter
): Promise<CaseValidationReport> {
  const parsed = DraftCasePackageSchema.safeParse(input);

  if (!parsed.success) {
    return createValidationReport("PUBLICATION", schemaIssues(parsed.error));
  }

  try {
    const reviewSubjectHash = await computeReviewSubjectHash(parsed.data, hashAdapter);
    const reachability = await reachabilityValidationContext(
      parsed.data,
      reviewSubjectHash,
      hashAdapter
    );
    const issues = validateParsedCase(
      parsed.data,
      "PUBLICATION",
      reviewSubjectHash,
      reachability.analysis,
      reachability.expectedEvidenceHash
    );

    let candidate: PublicationCandidate;
    try {
      candidate = await buildPublicationCandidateArtifact(parsed.data, hashAdapter);
    } catch {
      if (issues.some((validationIssue) => validationIssue.severity === "ERROR")) {
        return createValidationReport("PUBLICATION", issues);
      }
      throw new Error("Publication candidate hashing failed.");
    }

    if (approvalInput === undefined || approvalInput === null) {
      issues.push(issue({
        code: "PACKAGE_APPROVAL_MISSING",
        severity: "ERROR",
        path: "$.approval",
        message: "Final publication requires an external exact-package Approval Record."
      }));
    } else {
      const approval = PublicationApprovalRecordSchema.safeParse(approvalInput);

      if (!approval.success) {
        issues.push(issue({
          code: "PACKAGE_APPROVAL_INVALID",
          severity: "ERROR",
          path: "$.approval",
          message: "Exact-package Approval Record is structurally invalid."
        }));
      } else {
        issues.push(...validateApprovalRecord(parsed.data, candidate, approval.data));
      }
    }

    return createValidationReport("PUBLICATION", issues);
  } catch {
    return createValidationReport("PUBLICATION", [issue({
      code: "HASH_ADAPTER_FAILURE",
      severity: "ERROR",
      path: "$",
      message: "The supplied hash adapter could not produce valid publication hashes."
    })]);
  }
}
