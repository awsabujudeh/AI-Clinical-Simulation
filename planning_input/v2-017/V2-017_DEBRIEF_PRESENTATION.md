# V2-017 Debrief Presentation

The V2-017 debrief is a learner-safe organization of deterministic V2-007 output. It appears only after authoritative Session finalization and only when the secure Assessment endpoint returns a final projection.

The UI presents:

- the returned overall score;
- six returned Case-defined domain labels and scores;
- the returned final safety status; and
- resolved finding categories with safe committed-event Clinical Time references.

Internal rubric item identities, criteria, trace codes, raw event payloads, rule/scheduler details, package hashes, and governance metadata are excluded by the public contract. Evidence is shown as a safe event/time reference, not as an internal Event dump.

No LLM, Patient AI, Tutor AI, or RAG system writes or augments debrief content. The UI does not invent explanatory prose or infer medical correctness. Empty and unavailable states remain explicit and contain no placeholder medical claims.
