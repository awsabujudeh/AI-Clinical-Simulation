import { z } from "zod";

import {
  CompiledCasePackageSchema,
  ReviewExecutionArtifactSchema
} from "../../../case-schema/src/index.ts";
import type { PostgresSessionRpcClient } from "../../../session-engine/src/index.ts";

import {
  type ApiAuthorityRepository,
  type AuthorityResult,
  type AuthorizedProductionCase,
  type AuthorizedReviewCase,
  type AuthorizedSession
} from "./api-authority.ts";

export const POSTGRES_API_PRODUCTION_CASE_FUNCTION =
  "resolve_api_production_case_v2_013" as const;
export const POSTGRES_API_REVIEW_CASE_FUNCTION =
  "resolve_api_review_case_v2_013" as const;
export const POSTGRES_API_SESSION_AUTHORIZATION_FUNCTION =
  "authorize_api_session_v2_013" as const;

const MembershipShape = {
  membership_id: z.string().min(1).max(160),
  institution_id: z.string().min(2).max(64),
  role: z.enum(["LEARNER", "FACULTY", "REVIEWER"])
} as const;

const ProductionResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("AUTHORIZED"),
    ...MembershipShape,
    artifact: CompiledCasePackageSchema
  }),
  z.strictObject({ status: z.literal("NOT_FOUND") })
]);

const ReviewResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("AUTHORIZED"),
    ...MembershipShape,
    artifact: ReviewExecutionArtifactSchema
  }),
  z.strictObject({ status: z.literal("NOT_FOUND") })
]);

const SessionResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("AUTHORIZED"),
    ...MembershipShape,
    execution_authority: z.enum(["PUBLISHED_PRODUCTION", "REVIEW_ONLY"]),
    artifact: z.union([CompiledCasePackageSchema, ReviewExecutionArtifactSchema])
  }),
  z.strictObject({ status: z.literal("NOT_FOUND") })
]);

function unavailable<T>(): AuthorityResult<T> {
  return { success: false, code: "AUTHORITY_UNAVAILABLE" };
}

export class PostgresApiAuthorityRepository implements ApiAuthorityRepository {
  readonly #client: PostgresSessionRpcClient;

  constructor(client: PostgresSessionRpcClient) {
    this.#client = client;
  }

  async resolveProductionCase(input: {
    principal_user_id: string;
    case_id: string;
  }): Promise<AuthorityResult<AuthorizedProductionCase>> {
    try {
      const rpc = await this.#client.rpc(POSTGRES_API_PRODUCTION_CASE_FUNCTION, {
        p_user_id: input.principal_user_id,
        p_case_id: input.case_id
      });
      if (rpc.error !== null) return unavailable();
      const parsed = ProductionResponseSchema.safeParse(rpc.data);
      if (!parsed.success) return unavailable();
      if (parsed.data.status === "NOT_FOUND") return { success: false, code: "NOT_FOUND" };
      if (parsed.data.role !== "LEARNER") return { success: false, code: "NOT_AUTHORIZED" };
      return {
        success: true,
        value: {
          authority: "PUBLISHED_PRODUCTION",
          membership: {
            membership_id: parsed.data.membership_id,
            institution_id: parsed.data.institution_id,
            role: "LEARNER"
          },
          artifact: parsed.data.artifact
        }
      };
    } catch {
      return unavailable();
    }
  }

  async resolveReviewCase(input: {
    principal_user_id: string;
    case_id: string;
  }): Promise<AuthorityResult<AuthorizedReviewCase>> {
    try {
      const rpc = await this.#client.rpc(POSTGRES_API_REVIEW_CASE_FUNCTION, {
        p_user_id: input.principal_user_id,
        p_case_id: input.case_id
      });
      if (rpc.error !== null) return unavailable();
      const parsed = ReviewResponseSchema.safeParse(rpc.data);
      if (!parsed.success) return unavailable();
      if (parsed.data.status === "NOT_FOUND") return { success: false, code: "NOT_FOUND" };
      if (parsed.data.role === "LEARNER") return { success: false, code: "NOT_AUTHORIZED" };
      return {
        success: true,
        value: {
          authority: "REVIEW_ONLY",
          membership: {
            membership_id: parsed.data.membership_id,
            institution_id: parsed.data.institution_id,
            role: parsed.data.role
          },
          artifact: parsed.data.artifact
        }
      };
    } catch {
      return unavailable();
    }
  }

  async authorizeSession(input: {
    principal_user_id: string;
    session_id: string;
  }): Promise<AuthorityResult<AuthorizedSession>> {
    try {
      const rpc = await this.#client.rpc(POSTGRES_API_SESSION_AUTHORIZATION_FUNCTION, {
        p_user_id: input.principal_user_id,
        p_session_id: input.session_id
      });
      if (rpc.error !== null) return unavailable();
      const parsed = SessionResponseSchema.safeParse(rpc.data);
      if (!parsed.success) return unavailable();
      if (parsed.data.status === "NOT_FOUND") return { success: false, code: "NOT_FOUND" };
      const artifactAuthority = "package_hash" in parsed.data.artifact
        ? "PUBLISHED_PRODUCTION"
        : "REVIEW_ONLY";
      if (artifactAuthority !== parsed.data.execution_authority) return unavailable();
      return {
        success: true,
        value: {
          institution_id: parsed.data.institution_id,
          membership: {
            membership_id: parsed.data.membership_id,
            institution_id: parsed.data.institution_id,
            role: parsed.data.role
          },
          artifact: parsed.data.artifact
        }
      };
    } catch {
      return unavailable();
    }
  }
}
