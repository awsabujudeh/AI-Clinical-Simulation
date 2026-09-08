import { z } from "zod";

import type {
  AiHttpResponse,
  AiHttpTransport,
  AiProvider,
  AiProviderFailure,
  AiProviderRequest,
  AiProviderResult
} from "./provider.ts";

export const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses" as const;
export const MAX_PROVIDER_RESPONSE_CHARACTERS = 262_144 as const;
const MAX_OUTPUT_CHARACTERS_PER_TOKEN = 16;

const OpenAiContentPartSchema = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
  refusal: z.string().optional()
});

const OpenAiOutputItemSchema = z.looseObject({
  type: z.string(),
  content: z.array(OpenAiContentPartSchema).optional()
});

const OpenAiUsageSchema = z.looseObject({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative()
});

const OpenAiResponseSchema = z.looseObject({
  id: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(["completed", "failed", "in_progress", "cancelled", "queued", "incomplete"]),
  output: z.array(OpenAiOutputItemSchema),
  usage: OpenAiUsageSchema.nullable().optional(),
  error: z.unknown().nullable().optional(),
  incomplete_details: z.unknown().nullable().optional()
});

function failed(
  code: AiProviderFailure["code"],
  retryable: boolean,
  responseStatus: AiProviderFailure["response_status"],
  retryCount: number,
  details: Omit<AiProviderFailure, "success" | "provider" | "code" | "retryable" | "response_status" | "retry_count"> = {}
): AiProviderFailure {
  return Object.freeze({
    success: false,
    provider: "OPENAI",
    code,
    retryable,
    response_status: responseStatus,
    retry_count: retryCount,
    ...details
  });
}

function statusFailure(status: number, retryCount: number): AiProviderFailure {
  if (status === 429) {
    return failed("AI_PROVIDER_RATE_LIMITED", true, "FAILED", retryCount, {
      provider_http_status: status
    });
  }
  if ([500, 502, 503, 504].includes(status)) {
    return failed("AI_PROVIDER_UNAVAILABLE", true, "FAILED", retryCount, {
      provider_http_status: status
    });
  }
  return failed("AI_PROVIDER_REJECTED_REQUEST", false, "FAILED", retryCount, {
    provider_http_status: status
  });
}

function retryableHttp(status: number): boolean {
  return status === 429 || [500, 502, 503, 504].includes(status);
}

function openAiRequestBody(request: AiProviderRequest): Record<string, unknown> {
  return {
    model: request.model,
    instructions: request.instructions,
    input: [{
      role: "user",
      content: [{ type: "input_text", text: request.user_content }]
    }],
    text: {
      format: {
        type: "json_schema",
        name: request.output_schema_name,
        schema: request.output_json_schema,
        strict: true
      }
    },
    max_output_tokens: request.max_output_tokens,
    store: false,
    tools: [],
    tool_choice: "none",
    ...(request.reasoning_effort === undefined
      ? {}
      : { reasoning: { effort: request.reasoning_effort } })
  };
}

function parseCompletedResponse(
  response: z.infer<typeof OpenAiResponseSchema>,
  retryCount: number,
  maxOutputTokens: number
): AiProviderResult {
  const content = response.output.flatMap((item) => item.content ?? []);
  if (content.some((part) => part.type === "refusal" || part.refusal !== undefined)) {
    return failed("AI_RESPONSE_REFUSED", false, "REFUSED", retryCount, {
      provider_response_id: response.id,
      provider_model: response.model,
      ...(response.usage == null ? {} : { usage: response.usage })
    });
  }
  const outputText = content.filter(
    (part): part is typeof part & { text: string } => part.type === "output_text" && part.text !== undefined
  );
  if (outputText.length !== 1) {
    return failed("AI_OUTPUT_INVALID", false, "FAILED", retryCount, {
      provider_response_id: response.id,
      provider_model: response.model,
      ...(response.usage == null ? {} : { usage: response.usage })
    });
  }
  if (outputText[0]!.text.length > maxOutputTokens * MAX_OUTPUT_CHARACTERS_PER_TOKEN) {
    return failed("AI_BUDGET_EXCEEDED", false, "FAILED", retryCount, {
      provider_response_id: response.id,
      provider_model: response.model,
      ...(response.usage == null ? {} : { usage: response.usage })
    });
  }
  return Object.freeze({
    success: true,
    provider: "OPENAI",
    output_text: outputText[0]!.text,
    provider_response_id: response.id,
    provider_model: response.model,
    retry_count: retryCount,
    ...(response.usage == null ? {} : { usage: response.usage })
  });
}

export class OpenAiResponsesProvider implements AiProvider {
  readonly #apiKey: string | undefined;
  readonly #transport: AiHttpTransport;

  constructor(input: { api_key?: string; transport: AiHttpTransport }) {
    this.#apiKey = input.api_key?.trim() || undefined;
    this.#transport = input.transport;
  }

  async execute(request: AiProviderRequest): Promise<AiProviderResult> {
    if (this.#apiKey === undefined) {
      return failed("AI_PROVIDER_NOT_CONFIGURED", false, "FAILED", 0);
    }

    const body = JSON.stringify(openAiRequestBody(request));
    for (let attempt = 1; attempt <= request.max_attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeout_ms);
      let response: AiHttpResponse;
      try {
        response = await this.#transport.send({
          url: OPENAI_RESPONSES_ENDPOINT,
          method: "POST",
          headers: Object.freeze({
            Authorization: `Bearer ${this.#apiKey}`,
            "Content-Type": "application/json"
          }),
          body,
          signal: controller.signal
        });
      } catch {
        clearTimeout(timer);
        if (controller.signal.aborted) {
          return failed("AI_PROVIDER_TIMEOUT", true, "FAILED", attempt - 1);
        }
        if (attempt < request.max_attempts) continue;
        return failed("AI_PROVIDER_UNAVAILABLE", true, "FAILED", attempt - 1);
      }
      clearTimeout(timer);

      if (response.status < 200 || response.status >= 300) {
        if (retryableHttp(response.status) && attempt < request.max_attempts) continue;
        return statusFailure(response.status, attempt - 1);
      }

      if (response.body.length > MAX_PROVIDER_RESPONSE_CHARACTERS) {
        return failed("AI_BUDGET_EXCEEDED", false, "FAILED", attempt - 1, {
          provider_http_status: response.status
        });
      }

      let decoded: unknown;
      try {
        decoded = JSON.parse(response.body);
      } catch {
        return failed("AI_OUTPUT_INVALID", false, "FAILED", attempt - 1);
      }
      const parsed = OpenAiResponseSchema.safeParse(decoded);
      if (!parsed.success) {
        return failed("AI_OUTPUT_INVALID", false, "FAILED", attempt - 1);
      }
      const details = {
        provider_response_id: parsed.data.id,
        provider_model: parsed.data.model,
        ...(parsed.data.usage == null ? {} : { usage: parsed.data.usage })
      };
      if (parsed.data.status === "incomplete") {
        return failed("AI_RESPONSE_INCOMPLETE", false, "INCOMPLETE", attempt - 1, details);
      }
      if (parsed.data.status !== "completed") {
        return failed("AI_PROVIDER_UNAVAILABLE", false, "FAILED", attempt - 1, details);
      }
      return parseCompletedResponse(parsed.data, attempt - 1, request.max_output_tokens);
    }
    return failed("AI_UNEXPECTED_FAILURE", false, "FAILED", 0);
  }
}
