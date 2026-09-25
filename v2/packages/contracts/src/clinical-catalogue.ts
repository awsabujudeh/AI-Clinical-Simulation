import { z } from "zod";
import {
  ActionIdSchema,
  RuleIdSchema,
  SemanticVersionSchema,
  SourceIdSchema,
} from "./ids.ts";

export const ClinicalCatalogueIdentitySchema = z.strictObject({
  catalogue_id: z.string().regex(/^catalogue\.[a-z0-9.-]+$/u).max(160),
  version: SemanticVersionSchema,
});
export const ClinicalCatalogueCategorySchema = z.enum([
  "OBSERVATIONS",
  "INVESTIGATIONS",
  "MEDICATIONS",
  "PROCEDURES",
  "SUPPORTIVE_CARE",
  "MONITORING",
]);
/** Internal, Case-owned modeling policy. Never part of learner discovery. */
export const CaseActionOutcomePolicySchema = z.strictObject({
  policy_version: z.literal("1.0"),
  outcome_code: z.string().regex(/^outcome\.[a-z0-9.-]+$/u).max(160),
  behavior: z.enum(["AUTHORED_CASE_BEHAVIOR", "NO_MODELED_BENEFIT"]),
  unmatched_rule_behavior: z.literal("NO_MODELED_BENEFIT"),
  duration_seconds: z.number().int().min(1).max(300),
  duration_basis: z.literal("EXPO_SIMULATION_FIXTURE"),
  source_ids: z.array(SourceIdSchema).min(1).max(16),
  rule_ids: z.array(RuleIdSchema).max(32),
  review_status: z.enum(["PENDING_PHYSICIAN_REVIEW", "APPROVED_FOR_EXPO"]),
});
export const ClinicalConceptBindingSchema = z.strictObject({
  concept_id: ActionIdSchema,
  case_action_id: ActionIdSchema,
});
