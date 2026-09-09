# V2-019A Security and Hallucination Guardrails

## Security

- Provider credentials, model policy, prompts, schemas, and tools remain server-owned.
- The browser submits only strict question data to the secured Session route.
- Authorization is derived from verified identity, active membership, tenant, and Session ownership.
- REVIEW_ONLY Cases are not exposed as production learner Cases.
- The durable turn table and RPCs are service-only and protected by ENABLE + FORCE RLS.
- Learner-safe transcript responses remove provider metadata.

## Hallucination containment

The model receives a minimized allowlist, not hidden Case truth. It cannot turn Patient State numerics into symptoms without a Case mapping. Every output is schema-validated and every grounding reference is checked against the exact context. Invalid or unsupported claims are not silently stripped and displayed.

Prompt-injection language is untrusted. Requests to reveal the system prompt, diagnosis, all Case facts, correct treatment, future events, or rubric cannot expand the allowlist. The Patient Agent cannot submit a Clinical Action, mutate Patient State, advance Clinical Time, or score Assessment.

No RAG, Clinical Interpreter, Tutor, Voice, diagnostic media, Meshy, Case Builder, or provider-owned conversation state is included.
