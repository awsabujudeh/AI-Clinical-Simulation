# V2-019B1 Interpretation Contract and Ambiguity

The provider-facing contract is one strict JSON object with schema version `1.0`, status, nullable status reasons, and bounded candidates. All top-level fields are required for provider compatibility; local refinement enforces the status-specific invariants:

- `MATCH`: exactly one candidate and no ambiguity/no-match reason.
- `AMBIGUOUS`: two or more distinct candidates, an ambiguity reason, and no no-match reason.
- `NO_MATCH`: no candidates, a no-match reason, and no ambiguity reason.

A candidate contains only an action identifier, explicit JSON parameter values, and unresolved required parameter identifiers. The public reconciled candidate additionally carries the Case-owned confirmation policy. It contains no recommendation, rationale, correctness, score, effects, rules, or hidden truth.

Local reconciliation revalidates action membership and every parameter name, type, allowed code, and configured numeric bound. Required parameters absent from the learner's explicit input are recomputed as unresolved. Unknown actions become `NO_MATCH/UNAVAILABLE_ACTION`; malformed model data fails closed.

Wrong but syntactically valid learner values are preserved. No medical default, correction, unit conversion, or guideline value is invented. Ambiguity is never resolved using medical knowledge. Negated, hypothetical, past-tense, recommendation-seeking, unsupported, and malformed inputs use explicit no-match reasons. A safely unambiguous self-correction retains the learner's final explicit value.

Compound commands are represented as multiple-intent ambiguity. They do not create a batch execution contract.
