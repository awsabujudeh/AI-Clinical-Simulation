import type {
  AiGatewayErrorCode,
  AiUsageMetadata,
  JsonObject
} from "@ai-clinical-simulation/contracts";

export type AiProviderRequest = Readonly<{
  model: string;
  instructions: string;
  user_content: string;
  output_schema_name: string;
  output_json_schema: JsonObject;
  max_output_tokens: number;
  timeout_ms: number;
  max_attempts: 1 | 2;
  reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high";
}>;

export type AiProviderSuccess = Readonly<{
  success: true;
  provider: string;
  output_text: string;
  provider_response_id: string;
  provider_model: string;
  usage?: AiUsageMetadata;
  retry_count: number;
}>;

export type AiProviderFailure = Readonly<{
  success: false;
  provider: string;
  code: AiGatewayErrorCode;
  retryable: boolean;
  response_status: "FAILED" | "INCOMPLETE" | "REFUSED";
  retry_count: number;
  provider_http_status?: number;
  provider_response_id?: string;
  provider_model?: string;
  usage?: AiUsageMetadata;
}>;

export type AiProviderResult = AiProviderSuccess | AiProviderFailure;

export interface AiProvider {
  execute(request: AiProviderRequest): Promise<AiProviderResult>;
}

export type AiHttpRequest = Readonly<{
  url: string;
  method: "POST";
  headers: Readonly<Record<string, string>>;
  body: string;
  signal: AbortSignal;
}>;

export type AiHttpResponse = Readonly<{
  status: number;
  body: string;
}>;

export interface AiHttpTransport {
  send(request: AiHttpRequest): Promise<AiHttpResponse>;
}

export const fetchAiHttpTransport: AiHttpTransport = Object.freeze({
  async send(request: AiHttpRequest) {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: request.signal
    });
    return Object.freeze({ status: response.status, body: await response.text() });
  }
});
