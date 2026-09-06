import { z } from "zod";

import {
  VerifiedPrincipalSchema,
  type AuthenticationResult,
  type AuthenticationVerifier
} from "./verified-principal.ts";

const JwtHeaderSchema = z.object({
  alg: z.literal("ES256"),
  typ: z.literal("JWT").optional(),
  kid: z.string().min(1).max(200).optional()
});

const JwtPayloadSchema = z.object({
  iss: z.string().url(),
  sub: z.uuid(),
  aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  exp: z.number().int().positive(),
  nbf: z.number().int().nonnegative().optional(),
  is_anonymous: z.boolean().optional()
});

export type SupabaseJwtVerifierOptions = Readonly<{
  public_key: CryptoKey;
  issuer: string;
  audience: string;
  now_epoch_seconds: () => number;
}>;

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid base64url");
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = atob(padded);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function decodeJson(value: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

/** ES256 verification; payload claims are consumed only after signature success. */
export function createSupabaseJwtVerifier(
  options: SupabaseJwtVerifierOptions
): AuthenticationVerifier {
  return Object.freeze({
    async verifyAuthorizationHeader(header: string | undefined): Promise<AuthenticationResult> {
      if (header === undefined) return { success: false, code: "AUTHENTICATION_REQUIRED" };
      const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u.exec(header);
      if (match === null) return { success: false, code: "AUTHENTICATION_INVALID" };
      try {
        const token = match[1]!;
        const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
        const parsedHeader = JwtHeaderSchema.safeParse(decodeJson(encodedHeader!));
        if (!parsedHeader.success) return { success: false, code: "AUTHENTICATION_INVALID" };
        const signature = decodeBase64Url(encodedSignature!).slice().buffer as ArrayBuffer;
        const verified = await crypto.subtle.verify(
          { name: "ECDSA", hash: "SHA-256" },
          options.public_key,
          signature,
          new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
        );
        if (!verified) return { success: false, code: "AUTHENTICATION_INVALID" };
        const payload = JwtPayloadSchema.safeParse(decodeJson(encodedPayload!));
        if (!payload.success) return { success: false, code: "AUTHENTICATION_INVALID" };
        const audience = Array.isArray(payload.data.aud)
          ? payload.data.aud
          : [payload.data.aud];
        const now = options.now_epoch_seconds();
        if (
          payload.data.iss !== options.issuer
          || !audience.includes(options.audience)
          || payload.data.exp <= now
          || (payload.data.nbf !== undefined && payload.data.nbf > now)
        ) {
          return { success: false, code: "AUTHENTICATION_INVALID" };
        }
        if (payload.data.is_anonymous === true) {
          return { success: false, code: "ANONYMOUS_NOT_ALLOWED" };
        }
        return {
          success: true,
          principal: VerifiedPrincipalSchema.parse({
            authentication_authority: "VERIFIED_SUPABASE_JWT",
            user_id: payload.data.sub,
            issuer: payload.data.iss,
            audience: options.audience
          })
        };
      } catch {
        return { success: false, code: "AUTHENTICATION_INVALID" };
      }
    }
  });
}
