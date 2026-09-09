# V2-019B1 Clinical Interpreter Architecture

Status: implemented locally for review; V2-019 remains open for B2.

The Clinical Interpreter is a non-authoritative language adapter. It converts one learner utterance into a strict `MATCH`, `AMBIGUOUS`, or `NO_MATCH` interpretation candidate. Its complete action world is the authorized Session's learner-safe action catalogue. The server supplies only locale, learner-safe labels and aliases, parameter definitions, confirmation policy, and repeat policy.

The trusted `CLINICAL_INTERPRETER` capability runs through the V2-018 Secure AI Gateway with a versioned server-owned prompt, schema, model policy, small output budget, and no tools. Provider output passes a strict top-level Structured Output schema and a second deterministic local reconciliation against the pinned safe catalogue.

The interpreter does not receive the Case Package, Patient State, Clinical Time, rules, scheduler, diagnosis, rubric, expected actions, scores, future events, package hashes, or governance metadata. It owns no clinical effects, mutation, scoring, or finalization.

Patient Conversation is a separate dialogue-only surface. Text entered there never enters the clinical-command path. The interpreter is available only in the Clinical Actions area, where manual structured selection remains available.

V2-019B1 adds no architecture change or ADR. Compound utterances follow the existing single-`ActionRequest` authority: multiple plausible intents remain `AMBIGUOUS` for learner review and never become multi-action execution.
