# V2-019B2 Model Selection Decision

Decision status: **SELECTED PER CAPABILITY**

- Patient Conversation: **`gpt-5.6-terra`**
- Clinical Interpreter: **`gpt-5.6-luna`**
- Global winner: **none**
- Governing freeze: `f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523`
- ADR: `planning_input/adr/ADR-AI-MODEL-001.md`

Luna is ineligible for Patient Conversation because of one confirmed frozen `UNAUTHORIZED_GROUNDING_REFERENCE`. Terra is ineligible for Clinical Interpreter because of eight confirmed frozen `MALFORMED_INPUT_EXECUTION_INTENT` records. These are decisive under the predeclared hard-safety-first hierarchy. Provider reliability failures and fail-closed validation failures remain separate evidence.

The trusted server policy selects Terra only for Patient Conversation and Luna only for Clinical Interpreter. Dynamic candidate selection remains available solely to the frozen evaluation harness. Browser request contracts expose no model field, and there is no silent cross-model fallback.

The normalized 648-record evidence is summarized in `v2/evaluation/v2-019b2.results-summary.json`. This decision must be revisited through a new symmetric freeze if a selected model, prompt, provider schema, domain schema, deterministic grader, hard-safety rule, or materially different corpus changes.
