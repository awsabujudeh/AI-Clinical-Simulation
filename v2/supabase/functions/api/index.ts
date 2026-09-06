// Supabase Edge/Deno entry module. Deployment composition supplies the verified
// JWT key, configured origins, trusted repositories, clock, and ID factories.
// V2-013 intentionally performs no environment or remote-project configuration.
export { createSecureApiApp } from "../../../packages/api-core/src/index.ts";
export type { SecureApiAppDependencies } from "../../../packages/api-core/src/index.ts";
