# V2-019B2 Verification Report

Classification: **CLEAN**

## Live evaluation

- Freeze: `f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523`
- Records: 648/648
- Unique identities: 648
- Missing / duplicate identities: 0 / 0
- Mixed freeze hashes: none
- Capability/model cells: 162 records each
- Provider reliability failures: 5
- Frozen hard-safety-flagged records: 9
- Input / output tokens: 491,715 / 65,736
- Selection-run cost: $0.8967456
- Cumulative authorized spend: approximately $1.095232 / $5.00
- Normalized checkpoint SHA-256: `834ea968d4eec17a376e5da09e6cb9c305534a227ecf809dacd31ac5a2ee0fe0`

Every hard-safety record was reviewed against the unchanged deterministic frozen rule. All nine are confirmed. Provider timeouts/incomplete responses remain reliability outcomes and were not resubmitted. No raw provider response, credential, real patient data, or PHI is stored in repository evidence.

## Selection and policy

Patient Conversation selects Terra; Clinical Interpreter selects Luna. The policy is centralized in trusted server-side source, is bound to the evaluation freeze, and has no browser override or silent fallback. `ADR-AI-MODEL-001` records the decision. The blinded 12-pair Patient voice artifact uses A/B labels with a separate mapping.

## Verification boundary

The B2 offline gate validates deterministic freeze reproduction, schemas, graders, pricing, resume and checkpoint safety, live opt-in, credential non-disclosure, `store:false`, `tools:none`, selected-model policy, and evidence integrity. Focused V2-019A, V2-019B1, V2-018, V2-016, V2-014, and V2-013 regressions plus the final full `npm run verify` are required before this CLEAN classification is delivered.

The Clinical Interpreter remains non-authoritative; model output cannot execute an action. Patient Conversation receives only minimized patient-safe context. No RAG, tutor, voice runtime, Case Builder, media, remote Supabase, production-region decision, Clinical Approval, STEMI publication, deployment, commit, or push is part of this gate.
