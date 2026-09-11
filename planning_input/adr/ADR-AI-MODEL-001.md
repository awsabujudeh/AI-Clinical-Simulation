# ADR-AI-MODEL-001

## Capability-Specific AI Model Selection

Status: **ACCEPTED**

## Context

V2-019B2 compared `gpt-5.6-luna` and `gpt-5.6-terra` independently for Patient Conversation and Clinical Interpreter. The selection-valid run used freeze `f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523`: 54 synthetic cases per capability, three repetitions, both models, and 648 unique requests. Prompts, schemas, labels, deterministic graders, safety rules, reasoning effort, output limits, retry policy, storage policy, and tool policy were frozen symmetrically.

## Decision

1. `PATIENT_CONVERSATION` uses `gpt-5.6-terra`.
2. `CLINICAL_INTERPRETER` uses `gpt-5.6-luna`.
3. Selection is capability-specific; there is no global model winner.
4. Hard-safety eligibility precedes correctness, reliability, latency, and cost.
5. Luna is ineligible for Patient Conversation because one frozen record contained `UNAUTHORIZED_GROUNDING_REFERENCE`.
6. Terra is ineligible for Clinical Interpreter because eight frozen malformed-input records contained `MALFORMED_INPUT_EXECUTION_INTENT`.
7. Provider timeouts and incomplete responses remain reliability evidence and are not reclassified as hard-safety violations.
8. Selected models are trusted server-side policy. Browser requests cannot select or override a model.
9. There is no silent cross-model fallback. A provider or validation failure remains fail-closed under the owning capability contract.
10. Patient Conversation remains grounded dialogue only. Clinical Interpreter remains non-authoritative candidate interpretation and cannot execute a clinical action.
11. The selected policy is bound to the cited evaluation freeze. A future model, prompt, schema, grader, safety-rule, or materially different corpus change requires a new symmetric evaluation and an explicit policy update.

## Evidence

The run completed 648/648 unique frozen identities with five provider reliability failures and nine hard-safety-flagged records. The normalized checkpoint SHA-256 is `834ea968d4eec17a376e5da09e6cb9c305534a227ecf809dacd31ac5a2ee0fe0`.

For Patient Conversation, Luna achieved 108/162 exact successes and Terra 99/162. The paired Terra-minus-Luna difference was -5.56 percentage points with a deterministic paired-bootstrap 95% interval of -12.35 to +0.62 points. Luna nevertheless failed the preceding hard-safety gate; Terra is the only eligible Patient candidate.

For Clinical Interpreter, Luna achieved 134/162 exact successes and Terra 144/162. The paired Terra-minus-Luna difference was +6.17 percentage points with a deterministic paired-bootstrap 95% interval of 0.00 to +12.35 points. Terra nevertheless failed the preceding hard-safety gate; Luna is the only eligible Interpreter candidate.

The selection run used 491,715 input tokens and 65,736 output tokens and cost USD 0.8967456 under the frozen pricing snapshot. Including prior authorized diagnostics and symmetric schema smokes, cumulative spend was approximately USD 1.095232, below the USD 5.00 ceiling. Cost did not override safety.

The [cost and latency report](../v2-019/V2-019B2_COST_AND_LATENCY_REPORT.md) records median/p95 latency: Patient Luna 2473/4750 ms, Patient Terra 2119/3921 ms, Interpreter Luna 2559/3971 ms, and Interpreter Terra 2031/3851 ms. Terra's lower observed latency did not override either capability's safety gate.

Statistical limitations: this is a synthetic corpus, not evidence of medical realism or performance on real patients. The frozen paired bootstrap resamples case/repetition pairs; repeated observations of a case are not independent new clinical cases. The deterministic grader measures structured safety/correctness, not human voice preference. The separately blinded 12-pair voice review cannot override hard-safety eligibility. The [result summary](../../v2/evaluation/v2-019b2.results-summary.json) preserves the exact per-capability evidence under the cited freeze.

## Consequences

- Production composition must use the selected per-capability policy, while evaluation-only code may still instantiate either frozen candidate.
- The two capabilities may evolve independently and must be reevaluated independently.
- Human review of the blinded Patient voice artifact may inform later voice-quality work but cannot override this safety decision.
- Provider, schema, local-validation, and catalogue-reconciliation failures remain observable and fail closed.
- No Case truth, Patient State, rubric, execution authority, or provider credential moves to the browser.

## Architecture Relationship

This ADR applies the existing Secure AI Gateway, least-authority, server-owned policy, and deterministic evaluation principles. It does not change Clinical Engine authority, Session execution, Case ownership, Assessment ownership, or any frozen architectural invariant.
