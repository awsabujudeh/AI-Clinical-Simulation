# V2-016 Clinical Action UI Model

## Purpose

V2-016 turns the existing Student simulation action region into a Case-driven learner-intent surface. The browser presents only actions supplied by the authorized safe Session projection and sends valid intent through the existing secure action and recovery boundaries.

## Authority

The learner UI owns selection, bounded field collection, client-side usability validation, confirmation presentation, and submission status. It does not decide execution, correctness, clinical effects, Clinical Time, diagnostic truth, or score. Those remain server-authoritative through the Session Coordinator and deterministic engines.

The interaction path is:

`safe Session projection → learner selection → shared ActionRequest → recovery journal → /actions/propose → authoritative commit → Session refetch`

No optimistic Patient State, vital, Clinical-Time, result, or scoring mutation occurs.

## Generic controls

The renderer supports the shared parameter types `STRING`, `NUMBER`, `INTEGER`, `BOOLEAN`, and `CODE`. Required fields, numeric bounds, permitted codes, unknown fields, and bounded learner text are validated before transport and again at the server contract boundary. The UI contains no disease-specific conditions, correct-dose hints, treatment rules, or state transitions.

## Immediate result boundary

V2-016 shows only interaction status and the subsequently loaded authoritative projection. It does not implement the final Event timeline, final debrief, investigation-result fabrication, Patient AI, Visual Patient behavior, or automatic Session finalization.
