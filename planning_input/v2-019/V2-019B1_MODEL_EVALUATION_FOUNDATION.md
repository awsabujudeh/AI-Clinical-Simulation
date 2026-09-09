# V2-019B1 Model Evaluation Foundation

V2-019B1 supplies a deterministic, model-neutral 54-case labelled corpus over 18 categories: exact command, synonym, `ar-JO`, `en-US`, code-switching, numeric parameters, missing parameters, wrong-value preservation, ambiguity, no match, negation, hypothetical language, past tense, self-correction, prompt injection, unavailable action, compound command, and malformed input.

The strict metrics contract records basis-point rates for action-ID accuracy, parameter exactness, false-positive execution intent, ambiguity, no match, negation, missing-parameter preservation, hallucinated parameters, unlisted actions, schema validity, locale/code-switch accuracy, and prompt leakage. It also records latency, tokens, and provider-failure rate.

This is a harness foundation only. It contains no live provider comparison, selection weights, ranking, threshold policy, or production winner. `gpt-5.6-luna` and `gpt-5.6-terra` remain evaluation candidates. V2-019B2 owns the live comparative evaluation and any reviewed selection decision.

Permanent B1 tests use deterministic mocked Secure AI Gateway responses and require no OpenAI credential.
