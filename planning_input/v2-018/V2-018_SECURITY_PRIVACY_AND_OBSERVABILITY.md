# V2-018 Security, Privacy, and Observability

Provider access is server-only. The web application contains no provider URL, credential, SDK client, trusted prompt, candidate routing, or Authorization header. The inactive Edge composition exposes no generic prompt endpoint; future workflow handlers must add verified authorization, exact-origin CORS, safe context projection, persistent rate/budget authority, and a deterministic fallback before activation.

Trusted instructions remain separate from user content. User text is data and cannot set instructions, model, provider, schema, tools, storage, background mode, output limits, or conversation authority. Tools default to none and there are no mutation tools.

Audit events deliberately include only request/correlation identity, capability, prompt/schema/model-policy versions, provider category, status, latency, token counts, retry count, and normalized error code. They exclude API keys, Authorization headers, full prompts, user text, provider bodies, raw Patient State, complete Session or Case Package content, rubrics, scheduler state, approvals, and reviews. No AI response is added to Workbox or IndexedDB by V2-018.

The injected capacity authority is the fail-closed seam for later atomic rate and spend controls. No remote Supabase resource, production region, deployment, or live credential is introduced.
