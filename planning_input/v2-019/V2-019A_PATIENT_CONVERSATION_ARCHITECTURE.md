# V2-019A Patient Conversation Architecture

## Status

Implementation complete for review. V2-019 remains open pending V2-019B.

## Boundary

V2-019A adds a dialogue-only Patient Conversation path:

1. the secure API authenticates and authorizes the learner and Session;
2. the server rebuilds a minimized patient-safe context from the pinned Case and current authoritative Patient State;
3. an authoritative `QUESTION_ASKED` Event and unresolved turn are committed;
4. the tool-free V2-018 AI Gateway invokes the configured evaluation candidate;
5. strict output, locale, and grounding validation run locally;
6. the response and `PATIENT_RESPONSE_RECORDED` Event are committed before HTTP success.

The Patient Agent has no medical, action, state-transition, scoring, timing, or persistence authority. The browser never contacts a provider. The Session/Clinical boundaries remain authoritative.

## Clinical Time

A question has no question-specific Clinical-Time duration. Provider latency does not advance Clinical Time. Normal trusted Session synchronization is independent of Patient Conversation.

## Scope exclusions

No Clinical Interpreter, Tutor, RAG, Voice, Case Builder, diagnostic-media ingestion, remote Supabase resource, production-region selection, or deployment is included.
