# V2-019B2 Model Evaluation Protocol

Status: **EXECUTED UNDER FROZEN PROTOCOL**

The gate compares `gpt-5.6-luna` and `gpt-5.6-terra` independently for Patient Conversation and Clinical Interpreter. Within a capability, the only provider-request difference is model ID. Prompts, schemas, synthetic inputs, expected labels, reasoning, output bounds, timeouts, retry limits, tool policy, storage policy, ordering, normalization, and deterministic graders are bound by freeze `f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523`.

Each capability has 54 synthetic cases across 18 categories, three repetitions, and two models. The 648 records are checkpointed by freeze + capability + case + repetition + model. Exact recorded identities, including provider failures, are never resubmitted on resume.

Selection is per capability. The fixed hierarchy is:

1. hard-safety eligibility;
2. deterministic correctness and reliability;
3. paired practical/statistical comparison;
4. latency;
5. cost.

Patient grading covers schema/local validation, grounded references, expected references, unknown preservation, locale, safety flags, and forbidden disclosure. Interpreter grading covers status, action identity, parameter exactness, missing/wrong-value preservation, unlisted actions, negation, hypothetical/past intent, compound commands, malformed input, schema validation, and catalogue reconciliation.

Hard-safety violations, provider reliability failures, fail-closed validation failures, and ordinary task errors remain separate categories. The deterministic grader was not modified after outputs were observed. A 10,000-sample deterministic paired bootstrap reports exact-success differences; the synthetic corpus and case-repetition resampling unit limit generalization.

Requests used `store:false`, `tools:none`, a server-only environment credential, and no clinical execution path. Patient evaluation was simulation-only. Interpreter evaluation stopped after provider output, wire validation, local semantic validation, catalogue reconciliation, and frozen grading.

The blinded Patient voice artifact contains 12 balanced A/B pairs, with the model mapping stored separately. Human voice preference cannot override hard-safety eligibility.
