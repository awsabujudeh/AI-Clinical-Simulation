import { Hono, type Context } from "hono";
import { z } from "zod";

import {
  API_V1_SCHEMA_VERSION,
  ApiErrorResponseSchema,
  ApiV1RequestHeadersSchema,
  EndSimulationRequestSchema,
  InvestigationPathParametersSchema,
  CorrelationIdSchema,
  RequestIdSchema,
  SessionPathParametersSchema,
  StartSessionRequestSchema,
  SubmitClinicalActionRequestSchema,
  SubmitQuestionRequestSchema,
  createApiV1SuccessEnvelopeSchema
} from "../../../contracts/src/index.ts";

import type { AuthenticationVerifier } from "../auth/verified-principal.ts";
import {
  ERRORS,
  apiErrorResponse,
  type ApiServiceError,
  type ApiServiceResult
} from "../errors/api-service-error.ts";
import {
  createSecureApiService,
  type ApiRequestAuthority,
  type SecureApiDependencies
} from "../service/secure-api-service.ts";

export const API_REQUEST_BODY_LIMIT_BYTES = 16_384;

type AppVariables = {
  authority: ApiRequestAuthority;
};

export type SecureApiAppDependencies = SecureApiDependencies & Readonly<{
  authentication_verifier: AuthenticationVerifier;
  allowed_origins: readonly string[];
}>;

function requestIdentity(context: Context): { request_id: string; correlation_id: string } {
  const requestId = RequestIdSchema.safeParse(context.req.header("X-Request-Id"));
  const correlationId = CorrelationIdSchema.safeParse(
    context.req.header("X-Correlation-Id")
  );
  return {
    request_id: requestId.success ? requestId.data : "request.unavailable",
    correlation_id: correlationId.success
      ? correlationId.data
      : "correlation.unavailable"
  };
}

function errorJson(context: Context, error: ApiServiceError) {
  const identity = requestIdentity(context);
  const response = ApiErrorResponseSchema.parse(apiErrorResponse({
    error,
    request_id: identity.request_id,
    correlation_id: identity.correlation_id
  }));
  return context.json(response, error.http_status);
}

function successJson(context: Context, data: unknown, status = 200) {
  const schema = createApiV1SuccessEnvelopeSchema(z.unknown());
  const response = schema.parse({
    api_schema_version: API_V1_SCHEMA_VERSION,
    request_id: requestIdentity(context).request_id,
    data
  });
  return context.json(response, status as 200);
}

async function parseJsonBody<T extends z.ZodType>(
  context: Context,
  schema: T
): Promise<ApiServiceResult<z.infer<T>>> {
  const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return { success: false, error: ERRORS.contentType };
  }
  const contentLength = Number(context.req.header("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > API_REQUEST_BODY_LIMIT_BYTES) {
    return { success: false, error: ERRORS.bodyTooLarge };
  }
  let text: string;
  try {
    text = await context.req.text();
  } catch {
    return { success: false, error: ERRORS.malformed };
  }
  if (new TextEncoder().encode(text).byteLength > API_REQUEST_BODY_LIMIT_BYTES) {
    return { success: false, error: ERRORS.bodyTooLarge };
  }
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success
      ? { success: true, data: parsed.data }
      : { success: false, error: ERRORS.malformed };
  } catch {
    return { success: false, error: ERRORS.malformed };
  }
}

function respond(context: Context, result: ApiServiceResult<unknown>, successStatus = 200) {
  return result.success
    ? successJson(context, result.data, successStatus)
    : errorJson(context, result.error);
}

export function createSecureApiApp(dependencies: SecureApiAppDependencies) {
  const app = new Hono<{ Variables: AppVariables }>();
  const service = createSecureApiService(dependencies);
  const origins = new Set(dependencies.allowed_origins);

  app.use("*", async (context, next) => {
    const origin = context.req.header("Origin");
    if (origin !== undefined && !origins.has(origin)) {
      return errorJson(context, ERRORS.forbidden);
    }
    if (context.req.method === "OPTIONS") {
      if (origin === undefined) return errorJson(context, ERRORS.forbidden);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key, X-Api-Schema-Version, X-Request-Id, X-Correlation-Id",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Vary": "Origin"
        }
      });
    }
    if (origin !== undefined) {
      context.header("Access-Control-Allow-Origin", origin);
      context.header("Access-Control-Allow-Credentials", "true");
      context.header("Vary", "Origin");
    }
    await next();
  });

  app.get("/health", (context) => successJson(context, {
    status: "OK",
    api_version: "v1"
  }));

  app.use("/v1/*", async (context, next) => {
    const authentication = await dependencies.authentication_verifier
      .verifyAuthorizationHeader(context.req.header("Authorization"));
    if (!authentication.success) return errorJson(context, ERRORS.authentication);
    const requestedSchemaVersion = context.req.header("X-Api-Schema-Version");
    if (
      requestedSchemaVersion !== undefined
      && requestedSchemaVersion !== API_V1_SCHEMA_VERSION
    ) {
      return errorJson(context, ERRORS.unsupportedVersion);
    }
    const headers = ApiV1RequestHeadersSchema.safeParse({
      api_schema_version: requestedSchemaVersion,
      request_id: context.req.header("X-Request-Id"),
      correlation_id: context.req.header("X-Correlation-Id"),
      ...(context.req.header("Idempotency-Key") === undefined
        ? {}
        : { idempotency_key: context.req.header("Idempotency-Key") })
    });
    if (!headers.success) return errorJson(context, ERRORS.malformed);
    context.set("authority", {
      principal: authentication.principal,
      request_id: headers.data.request_id,
      correlation_id: headers.data.correlation_id,
      ...(headers.data.idempotency_key === undefined
        ? {}
        : { idempotency_key: headers.data.idempotency_key })
    });
    await next();
  });

  app.use("/v1/*", async (context, next) => {
    if (["POST", "PUT", "PATCH"].includes(context.req.method)) {
      const contentLength = Number(context.req.header("Content-Length"));
      if (Number.isFinite(contentLength) && contentLength > API_REQUEST_BODY_LIMIT_BYTES) {
        return errorJson(context, ERRORS.bodyTooLarge);
      }
      try {
        const bytes = await context.req.raw.clone().arrayBuffer();
        if (bytes.byteLength > API_REQUEST_BODY_LIMIT_BYTES) {
          return errorJson(context, ERRORS.bodyTooLarge);
        }
      } catch {
        return errorJson(context, ERRORS.malformed);
      }
    }
    await next();
  });

  app.post("/v1/sessions", async (context) => {
    const body = await parseJsonBody(context, StartSessionRequestSchema);
    if (!body.success) return errorJson(context, body.error);
    return respond(context, await service.startSession({
      authority: context.get("authority"),
      request: body.data,
      review: false
    }), 201);
  });

  app.post("/v1/review-sessions", async (context) => {
    const body = await parseJsonBody(context, StartSessionRequestSchema);
    if (!body.success) return errorJson(context, body.error);
    return respond(context, await service.startSession({
      authority: context.get("authority"),
      request: body.data,
      review: true
    }), 201);
  });

  app.get("/v1/sessions/:session_id/state", async (context) => {
    const path = SessionPathParametersSchema.safeParse(context.req.param());
    if (!path.success) return errorJson(context, ERRORS.malformed);
    return respond(context, await service.getPatientState(
      context.get("authority"),
      path.data.session_id
    ));
  });

  app.get("/v1/sessions/:session_id/timeline", async (context) => {
    const path = SessionPathParametersSchema.safeParse(context.req.param());
    if (!path.success) return errorJson(context, ERRORS.malformed);
    return respond(context, await service.getLearnerTimeline(
      context.get("authority"),
      path.data.session_id
    ));
  });

  app.post("/v1/sessions/:session_id/actions/propose", async (context) => {
    const path = SessionPathParametersSchema.safeParse(context.req.param());
    if (!path.success) return errorJson(context, ERRORS.malformed);
    const body = await parseJsonBody(context, SubmitClinicalActionRequestSchema);
    if (!body.success) return errorJson(context, body.error);
    return respond(context, await service.submitClinicalAction({
      authority: context.get("authority"),
      session_id: path.data.session_id,
      request: body.data
    }));
  });

  app.get("/v1/sessions/:session_id/investigations/:result_id", async (context) => {
    const path = InvestigationPathParametersSchema.safeParse(context.req.param());
    if (!path.success) return errorJson(context, ERRORS.malformed);
    return respond(context, await service.getInvestigationResult(
      context.get("authority"),
      path.data.session_id,
      path.data.result_id
    ));
  });

  app.post("/v1/sessions/:session_id/end", async (context) => {
    const path = SessionPathParametersSchema.safeParse(context.req.param());
    if (!path.success) return errorJson(context, ERRORS.malformed);
    const body = await parseJsonBody(context, EndSimulationRequestSchema);
    if (!body.success) return errorJson(context, body.error);
    return respond(context, await service.endSimulation({
      authority: context.get("authority"),
      session_id: path.data.session_id,
      request: body.data
    }));
  });

  app.get("/v1/sessions/:session_id/assessment", async (context) => {
    const path = SessionPathParametersSchema.safeParse(context.req.param());
    if (!path.success) return errorJson(context, ERRORS.malformed);
    return respond(context, await service.getAssessment(
      context.get("authority"),
      path.data.session_id
    ));
  });

  app.post("/v1/sessions/:session_id/debriefs", async (context) => {
    const path = SessionPathParametersSchema.safeParse(context.req.param());
    if (!path.success) return errorJson(context, ERRORS.malformed);
    const body = await parseJsonBody(context, z.strictObject({}));
    if (!body.success) return errorJson(context, body.error);
    if (context.get("authority").idempotency_key === undefined) {
      return errorJson(context, ERRORS.malformed);
    }
    return respond(context, await service.getAssessment(
      context.get("authority"),
      path.data.session_id
    ));
  });

  app.post("/v1/sessions/:session_id/questions", async (context) => {
    const path = SessionPathParametersSchema.safeParse(context.req.param());
    if (!path.success) return errorJson(context, ERRORS.malformed);
    const body = await parseJsonBody(context, SubmitQuestionRequestSchema);
    if (!body.success) return errorJson(context, body.error);
    if (context.get("authority").idempotency_key === undefined) {
      return errorJson(context, ERRORS.malformed);
    }
    const authorized = await service.authorizeAndLoad(context.get("authority"), path.data.session_id);
    return authorized.success
      ? errorJson(context, ERRORS.unavailable)
      : errorJson(context, authorized.error);
  });

  app.post("/v1/faculty/cases", (context) => errorJson(context, ERRORS.unavailable));

  const knownPaths = [
    "/v1/sessions",
    "/v1/review-sessions",
    "/v1/faculty/cases"
  ];
  for (const path of knownPaths) {
    app.all(path, (context) => errorJson(context, ERRORS.malformed));
  }

  app.notFound((context) => errorJson(context, ERRORS.notFound));
  app.onError((_error, context) => errorJson(context, ERRORS.internal));

  return app;
}
