import type {
  CompiledCasePackage,
  ReviewExecutionArtifact
} from "../../../case-schema/src/index.ts";

export type MembershipRole = "LEARNER" | "FACULTY" | "REVIEWER";

export type AuthorizedMembership = Readonly<{
  membership_id: string;
  institution_id: string;
  role: MembershipRole;
}>;

export type AuthorizedProductionCase = Readonly<{
  authority: "PUBLISHED_PRODUCTION";
  membership: AuthorizedMembership & { role: "LEARNER" };
  artifact: CompiledCasePackage;
}>;

export type AuthorizedReviewCase = Readonly<{
  authority: "REVIEW_ONLY";
  membership: AuthorizedMembership & { role: "FACULTY" | "REVIEWER" };
  artifact: ReviewExecutionArtifact;
}>;

export type AuthorizedCase = AuthorizedProductionCase | AuthorizedReviewCase;

export type AuthorizedSession = Readonly<{
  membership: AuthorizedMembership;
  institution_id: string;
  artifact: CompiledCasePackage | ReviewExecutionArtifact;
}>;

export type AuthorityResult<T> =
  | { success: true; value: T }
  | {
      success: false;
      code: "NOT_AUTHORIZED" | "NOT_FOUND" | "AUTHORITY_UNAVAILABLE";
    };

/** DB-backed membership/resource authority. Token claims never supply roles. */
export interface ApiAuthorityRepository {
  resolveProductionCase(input: {
    principal_user_id: string;
    case_id: string;
  }): Promise<AuthorityResult<AuthorizedProductionCase>>;
  resolveReviewCase(input: {
    principal_user_id: string;
    case_id: string;
  }): Promise<AuthorityResult<AuthorizedReviewCase>>;
  authorizeSession(input: {
    principal_user_id: string;
    session_id: string;
  }): Promise<AuthorityResult<AuthorizedSession>>;
}
