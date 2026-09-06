import { z } from "zod";

export const VerifiedPrincipalSchema = z.strictObject({
  authentication_authority: z.literal("VERIFIED_SUPABASE_JWT"),
  user_id: z.uuid(),
  issuer: z.string().url(),
  audience: z.string().min(1).max(160)
});
export type VerifiedPrincipal = z.infer<typeof VerifiedPrincipalSchema>;

export type AuthenticationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHENTICATION_INVALID"
  | "ANONYMOUS_NOT_ALLOWED";

export type AuthenticationResult =
  | { success: true; principal: VerifiedPrincipal }
  | { success: false; code: AuthenticationFailureCode };

/** Trust boundary: implementations must cryptographically verify credentials. */
export interface AuthenticationVerifier {
  verifyAuthorizationHeader(header: string | undefined): Promise<AuthenticationResult>;
}
