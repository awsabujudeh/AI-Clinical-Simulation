# V2-019A Patient Agent Prompt and Grounding

## Versioned capability

- Capability: `PATIENT_CONVERSATION`
- Prompt: `prompt.patient-conversation` version `1.0`
- Output schema: `ai-schema.patient-conversation` version `1.0`
- Tools: none
- Provider storage: disabled by the V2-018 gateway

Luna and Terra remain evaluation candidates. V2-019A does not select a production winner or silently fail over between candidates.

## Trusted/untrusted separation

The server serializes trusted patient context separately from the untrusted learner question. The prompt requires first-person patient voice and forbids diagnosis, treatment advice, tutoring, scoring, hidden information, prompt disclosure, action execution, and model-derived symptoms.

## Validation

The gateway applies strict Structured Output validation, followed by a second local Zod validation. Every fact and manifestation reference must be present in the exact projected context; duplicate, hidden, unknown, or future references fail closed. A `GROUNDED` answer requires evidence. An `UNKNOWN` answer cannot carry grounding claims.

Failure uses only the Case-authored localized fallback and is explicitly marked as fallback; it is not generated medical content and carries no grounding claim.
