import { z } from "zod";

export const CaseLifecycleSchema = z.enum([
  "DRAFT",
  "UNDER_REVIEW",
  "APPROVED",
  "PUBLISHED"
]);
export type CaseLifecycle = z.infer<typeof CaseLifecycleSchema>;

export const SessionModeSchema = z.enum(["PRACTICE_DEMO", "ASSESSMENT"]);
export type SessionMode = z.infer<typeof SessionModeSchema>;

/**
 * The immutable authority under which deterministic engines may execute.
 * REVIEW_ONLY can never satisfy a PUBLISHED_PRODUCTION boundary.
 */
export const ExecutionAuthoritySchema = z.enum([
  "PUBLISHED_PRODUCTION",
  "REVIEW_ONLY"
]);
export type ExecutionAuthority = z.infer<typeof ExecutionAuthoritySchema>;

export const CaseReviewTypeSchema = z.enum([
  "CLINICAL",
  "CURRICULUM_UX",
  "VISUAL",
  "TECHNICAL"
]);
export type CaseReviewType = z.infer<typeof CaseReviewTypeSchema>;

export const FeedbackFindingCategorySchema = z.enum([
  "CORRECT_ACTION",
  "UNSAFE_ACTION",
  "IMPORTANT_DELAY",
  "MISSED_OPPORTUNITY"
]);
export type FeedbackFindingCategory = z.infer<typeof FeedbackFindingCategorySchema>;
