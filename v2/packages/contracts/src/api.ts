import { z } from "zod";

import { CorrelationIdSchema, RequestIdSchema, SchemaVersionSchema } from "./ids.ts";
import { LocalizationKeySchema, TutorOutputLocaleSchema } from "./locales.ts";

export const ApiErrorCodeSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u, "Expected a stable machine error code")
  .brand<"ApiErrorCode">();
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const UserSafeMessageSchema = z.strictObject({
  locale: TutorOutputLocaleSchema,
  text: z.string().trim().min(1).max(500)
});
export type UserSafeMessage = z.infer<typeof UserSafeMessageSchema>;

export const ApiFieldIssueSchema = z.strictObject({
  field_path: z.string().min(1).max(160),
  code: ApiErrorCodeSchema,
  message_key: LocalizationKeySchema
});
export type ApiFieldIssue = z.infer<typeof ApiFieldIssueSchema>;

export const ApiDomainErrorSchema = z.strictObject({
  code: ApiErrorCodeSchema,
  message_key: LocalizationKeySchema,
  user_safe_message: UserSafeMessageSchema.optional(),
  correlation_id: CorrelationIdSchema.optional(),
  http_status: z.number().int().min(400).max(599),
  retryable: z.boolean(),
  field_issues: z.array(ApiFieldIssueSchema).optional()
});
export type ApiDomainError = z.infer<typeof ApiDomainErrorSchema>;

export const ApiErrorResponseSchema = z.strictObject({
  api_schema_version: SchemaVersionSchema,
  request_id: RequestIdSchema,
  error: ApiDomainErrorSchema
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
