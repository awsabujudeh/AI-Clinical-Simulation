# V2-018 Secure AI Gateway Boundary

V2-018 adds one server-only, provider-neutral gateway boundary under `packages/ai-gateway/` and one inactive Supabase Edge composition point. The browser never calls a model provider and receives neither credentials nor trusted instructions, model routing, tool definitions, schemas, or budgets.

AI is non-authoritative. The Case Package, Clinical Engine, Session Engine, Patient State, Clinical Time, committed Events, and deterministic Assessment retain their existing ownership. Gateway output cannot execute an action, mutate state, advance time, schedule work, or change a score.

The only invocation data contract contains a trusted capability identity, request/correlation identities, locale, and bounded user content. Capability configuration is server-owned. It fixes the prompt identity/version, candidate model policy, output schema, limits, and an empty tool list. There is no generic prompt route and no activated Patient AI endpoint in this task.

The Edge composition reads `OPENAI_API_KEY` through a server environment reader. An absent key returns a typed unavailable result. No credential or real environment file is committed, and automated tests use an injected transport only.
