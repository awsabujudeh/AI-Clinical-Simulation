import { describe, expect, test } from "vitest";

import {
  ActorIdSchema,
  ActionDefinitionIdSchema,
  ActionIdSchema,
  ActionProposalIdSchema,
  ActionRequestIdSchema,
  AiWorkflowRequestIdSchema,
  AiWorkflowRunIdSchema,
  AssessmentIdSchema,
  CaseIdSchema,
  CasePackageIdSchema,
  CaseVersionIdSchema,
  CommandIdSchema,
  CorrelationIdSchema,
  CurriculumObjectiveIdSchema,
  EventIdSchema,
  FeedbackFindingIdSchema,
  InstitutionIdSchema,
  IdempotencyKeySchema,
  IntentCandidateIdSchema,
  MediaAssetIdSchema,
  RequestIdSchema,
  RuleIdSchema,
  RubricIdSchema,
  SchemaVersionSchema,
  SemanticVersionSchema,
  SessionIdSchema,
  SourceIdSchema,
  SourceVersionIdSchema,
  StateVersionSchema,
  VisualManifestIdSchema
} from "../../packages/contracts/src/index.ts";

describe("stable identifiers", () => {
  test("accepts representative identifiers for every required concept", () => {
    const fixtures = [
      [CaseIdSchema, "case.demo.001"],
      [CaseVersionIdSchema, "case-version.demo.001"],
      [CasePackageIdSchema, "case-package.demo.001"],
      [SessionIdSchema, "660e8400-e29b-41d4-a716-446655440000"],
      [CommandIdSchema, "cmd_01JTEST0000000000000000001"],
      [EventIdSchema, "550e8400-e29b-41d4-a716-446655440000"],
      [ActionIdSchema, "medication.generic"],
      [ActionDefinitionIdSchema, "action-definition.demo.001"],
      [IntentCandidateIdSchema, "intent_01JTEST000000000000000001"],
      [ActionRequestIdSchema, "actreq_01JTEST00000000000000001"],
      [ActionProposalIdSchema, "proposal_01JTEST00000000000000001"],
      [RuleIdSchema, "rule.demo.001"],
      [RubricIdSchema, "rubric.demo.001"],
      [AssessmentIdSchema, "assessment-001"],
      [FeedbackFindingIdSchema, "finding:001"],
      [InstitutionIdSchema, "ju"],
      [CurriculumObjectiveIdSchema, "objective.demo.001"],
      [SourceIdSchema, "source.demo.001"],
      [SourceVersionIdSchema, "source-version.demo.001"],
      [VisualManifestIdSchema, "visual.demo.001"],
      [MediaAssetIdSchema, "asset.demo.001"],
      [AiWorkflowRunIdSchema, "workflow-run-001"],
      [AiWorkflowRequestIdSchema, "workflow_request_001"],
      [RequestIdSchema, "request-001"],
      [CorrelationIdSchema, "correlation:001"],
      [ActorIdSchema, "learner-001"]
    ] as const;

    for (const [schema, value] of fixtures) {
      expect(schema.parse(value)).toBe(value);
    }
  });

  test("requires UUID event identity while operational IDs remain safe opaque values", () => {
    expect(EventIdSchema.parse("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(EventIdSchema.safeParse("event.demo.001").success).toBe(false);
    expect(EventIdSchema.safeParse("not-a-uuid").success).toBe(false);

    expect(SessionIdSchema.parse("660e8400-e29b-41d4-a716-446655440000")).toBe(
      "660e8400-e29b-41d4-a716-446655440000"
    );
    expect(CommandIdSchema.parse("opaque-command_01")).toBe("opaque-command_01");

    for (const value of ["", "   ", " leading", "line\nbreak", "x".repeat(129)] as const) {
      expect(SessionIdSchema.safeParse(value).success).toBe(false);
    }
  });

  test("accepts bounded opaque idempotency keys and separates version forms", () => {
    expect(IdempotencyKeySchema.parse("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(IdempotencyKeySchema.parse("retry-key_01:attempt.2")).toBe("retry-key_01:attempt.2");

    for (const value of ["", " ", "unsafe key", "control\u0001key", "x".repeat(129)] as const) {
      expect(IdempotencyKeySchema.safeParse(value).success).toBe(false);
    }

    expect(SchemaVersionSchema.parse("2.0")).toBe("2.0");
    expect(SchemaVersionSchema.safeParse("2.0.0").success).toBe(false);
    expect(SemanticVersionSchema.parse("2.0.0")).toBe("2.0.0");
    expect(SemanticVersionSchema.safeParse("2.0").success).toBe(false);
  });

  test("rejects malformed identifiers and state versions", () => {
    for (const value of ["", "Case.demo", "case", "case..demo", "case.demo/1"] as const) {
      expect(CaseIdSchema.safeParse(value).success).toBe(false);
    }

    expect(ActionIdSchema.safeParse("medication").success).toBe(false);
    expect(InstitutionIdSchema.safeParse("JU").success).toBe(false);
    expect(StateVersionSchema.safeParse(-1).success).toBe(false);
    expect(StateVersionSchema.safeParse(1.5).success).toBe(false);
  });

  test("serializes branded identifiers as ordinary JSON values", () => {
    const value = {
      case_id: CaseIdSchema.parse("case.demo.001"),
      state_version: StateVersionSchema.parse(4)
    };

    expect(JSON.stringify(value)).toBe('{"case_id":"case.demo.001","state_version":4}');
  });
});
