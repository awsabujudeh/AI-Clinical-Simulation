import { describe, expect, test } from "vitest";

import {
  ActionExecutionStatusSchema,
  ActionProposalSchema,
  ActionRequestSchema,
  ApprovedActionDefinitionIdentitySchema,
  IntentCandidateSchema
} from "../../packages/contracts/src/index.ts";
import {
  VALID_ACTION_PROPOSAL,
  VALID_ACTION_REQUEST,
  VALID_INTENT_CANDIDATE
} from "../fixtures/contracts-fixture.ts";

describe("action contracts", () => {
  test("parses intent, approved definition identity, request, and proposal shapes", () => {
    expect(IntentCandidateSchema.parse(VALID_INTENT_CANDIDATE).action_reference).toEqual({
      resolution: "MATCHED",
      authority: "INTERPRETATION_ONLY",
      action_id: "investigation.generic-test"
    });
    expect(ApprovedActionDefinitionIdentitySchema.parse({
      action_definition_id: "action-definition.demo.001",
      action_id: "investigation.generic-test",
      case_version_id: "case-version.demo.001",
      action_type: "INVESTIGATION",
      approval_status: "APPROVED"
    }).approval_status).toBe("APPROVED");
    expect(ActionRequestSchema.parse(VALID_ACTION_REQUEST).source).toBe("UI");
    expect(ActionRequestSchema.parse(VALID_ACTION_REQUEST).catalogue_membership).toBe(
      "UNVERIFIED"
    );
    expect(ActionProposalSchema.parse(VALID_ACTION_PROPOSAL).execution_status).toBe(
      "PENDING_CONFIRMATION"
    );
  });

  test("represents an unknown catalogue action explicitly as invalid input", () => {
    const result = IntentCandidateSchema.parse({
      ...VALID_INTENT_CANDIDATE,
      action_reference: {
        resolution: "UNKNOWN",
        authority: "INTERPRETATION_ONLY",
        raw_action_id: "unmapped-action-from-input",
        issue_code: "UNKNOWN_ACTION_ID"
      },
      confidence: 0
    });

    expect(result.action_reference.resolution).toBe("UNKNOWN");
  });

  test("keeps interpreter matches and syntactic requests non-authoritative", () => {
    const intent = IntentCandidateSchema.parse(VALID_INTENT_CANDIDATE);
    const request = ActionRequestSchema.parse({
      ...VALID_ACTION_REQUEST,
      action_id: "procedure.unknown-to-pinned-package"
    });

    expect(intent.authority).toBe("NON_AUTHORITATIVE");
    expect(intent.action_reference.authority).toBe("INTERPRETATION_ONLY");
    expect(request.catalogue_membership).toBe("UNVERIFIED");
  });

  test("rejects unknown enum/status values and missing fields", () => {
    expect(ActionExecutionStatusSchema.safeParse("QUEUED").success).toBe(false);
    expect(ActionProposalSchema.safeParse({
      ...VALID_ACTION_PROPOSAL,
      execution_status: "QUEUED"
    }).success).toBe(false);
    const { idempotency_key: _omitted, ...missingRequiredField } = VALID_ACTION_REQUEST;
    expect(ActionRequestSchema.safeParse(missingRequiredField).success).toBe(false);
  });

  test("rejects unknown top-level fields and remains JSON serializable", () => {
    expect(ActionRequestSchema.safeParse({
      ...VALID_ACTION_REQUEST,
      execute_immediately: true
    }).success).toBe(false);

    const parsed = ActionProposalSchema.parse(VALID_ACTION_PROPOSAL);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });
});
