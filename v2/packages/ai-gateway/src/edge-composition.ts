import type { AiGatewayAuditEvent } from "@ai-clinical-simulation/contracts";

import type { TrustedCapabilityRegistry } from "./capability-registry.ts";
import { SecureAiGateway, type AiCapacityAuthority, type AiGatewayClock } from "./gateway.ts";
import { OpenAiResponsesProvider } from "./openai-responses-provider.ts";
import { fetchAiHttpTransport, type AiHttpTransport } from "./provider.ts";

export const OPENAI_API_KEY_ENV_NAME = "OPENAI_API_KEY" as const;

export interface ServerEnvironmentReader {
  get(name: typeof OPENAI_API_KEY_ENV_NAME): string | undefined;
}

export function createAiGatewayEdgeComposition(input: {
  environment: ServerEnvironmentReader;
  registry: TrustedCapabilityRegistry;
  capacity: AiCapacityAuthority;
  clock: AiGatewayClock;
  logger: { log(event: AiGatewayAuditEvent): void };
  transport?: AiHttpTransport;
}): SecureAiGateway {
  const provider = new OpenAiResponsesProvider({
    api_key: input.environment.get(OPENAI_API_KEY_ENV_NAME),
    transport: input.transport ?? fetchAiHttpTransport
  });
  return new SecureAiGateway({
    registry: input.registry,
    provider,
    capacity: input.capacity,
    clock: input.clock,
    logger: input.logger
  });
}
