import { z } from "zod";

import {
  ActionRequestSchema,
  ActorIdSchema,
  CasePackageIdSchema,
  CaseVersionIdSchema,
  CorrelationIdSchema,
  RequestIdSchema,
  SemanticVersionSchema,
  Sha256DigestSchema,
  type HashAdapter,
  type Sha256Digest
} from "../../../contracts/src/index.ts";
import { canonicalSerialize } from "../../../case-schema/src/index.ts";

import {
  createSessionCommandIssue,
  sessionCommandIssuesFromZodError,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";

export const EXTERNAL_LEARNER_COMMAND_SCHEMA_VERSION = "1.0" as const;

export const ExternalLearnerActionRequestSchema = ActionRequestSchema.extend({
  request_schema_version: z.literal("1.0")
});
export type ExternalLearnerActionRequest = z.infer<
  typeof ExternalLearnerActionRequestSchema
>;

const expectedPinnedCaseCommonShape = {
  case_package_id: CasePackageIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema
} as const;

export const ExpectedPinnedCaseIdentitySchema = z.discriminatedUnion(
  "execution_authority",
  [
    z.strictObject({
      ...expectedPinnedCaseCommonShape,
      execution_authority: z.literal("PUBLISHED_PRODUCTION"),
      package_hash: Sha256DigestSchema
    }),
    z.strictObject({
      ...expectedPinnedCaseCommonShape,
      execution_authority: z.literal("REVIEW_ONLY"),
      review_execution_hash: Sha256DigestSchema
    })
  ]
);
export type ExpectedPinnedCaseIdentity = z.infer<
  typeof ExpectedPinnedCaseIdentitySchema
>;

export const ExternalLearnerCommandEnvelopeSchema = z.strictObject({
  command_schema_version: z.literal(EXTERNAL_LEARNER_COMMAND_SCHEMA_VERSION),
  request_id: RequestIdSchema,
  correlation_id: CorrelationIdSchema,
  learner_actor_id: ActorIdSchema,
  expected_case: ExpectedPinnedCaseIdentitySchema,
  action_request: ExternalLearnerActionRequestSchema
});
export type ExternalLearnerCommandEnvelope = z.infer<
  typeof ExternalLearnerCommandEnvelopeSchema
>;

export type CommandFingerprintResult =
  | {
      success: true;
      issues: [];
      command: ExternalLearnerCommandEnvelope;
      canonical_payload: string;
      fingerprint: Sha256Digest;
    }
  | { success: false; issues: SessionCommandIssue[] };

/**
 * Fingerprints normalized command data only. Trusted commit time, Patient
 * State, Scheduler State, and all wall-clock data are intentionally absent.
 */
export async function fingerprintExternalLearnerCommand(
  input: unknown,
  hashAdapter: HashAdapter
): Promise<CommandFingerprintResult> {
  const command = ExternalLearnerCommandEnvelopeSchema.safeParse(input);
  if (!command.success) {
    return {
      success: false,
      issues: sessionCommandIssuesFromZodError(
        "INVALID_COMMAND_INPUT",
        "$.command",
        command.error
      )
    };
  }

  const canonicalPayload = canonicalSerialize(command.data);
  try {
    const digest = Sha256DigestSchema.safeParse(
      await hashAdapter.sha256(canonicalPayload)
    );
    if (!digest.success) {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "COMMAND_FINGERPRINT_FAILED",
          path: "$.dependencies.hash_adapter",
          message: "Hash adapter did not return a valid SHA-256 digest."
        })]
      };
    }
    return {
      success: true,
      issues: [],
      command: command.data,
      canonical_payload: canonicalPayload,
      fingerprint: digest.data
    };
  } catch {
    return {
      success: false,
      issues: [createSessionCommandIssue({
        code: "COMMAND_FINGERPRINT_FAILED",
        path: "$.dependencies.hash_adapter",
        message: "Hash adapter failed before command evaluation."
      })]
    };
  }
}
