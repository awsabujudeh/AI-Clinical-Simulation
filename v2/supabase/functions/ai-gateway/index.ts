// Server-only Supabase Edge composition point. V2-018 intentionally exposes no
// generic prompt route and activates no Patient AI workflow. A later trusted,
// authenticated workflow handler must supply capability-specific safe context,
// capacity authority, and exact-origin CORS policy before invoking this gateway.
export {
  AI_GATEWAY_RUNTIME,
  OPENAI_API_KEY_ENV_NAME,
  createAiGatewayEdgeComposition
} from "../../../packages/ai-gateway/src/index.ts";
