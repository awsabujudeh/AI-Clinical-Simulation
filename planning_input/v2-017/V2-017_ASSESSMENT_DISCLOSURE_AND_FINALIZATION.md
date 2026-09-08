# V2-017 Assessment Disclosure and Finalization

## Active sessions

An active Assessment Session receives only `ACTIVE_ASSESSMENT_WITHHELD`. The UI does not request or display overall score, domain scores, correctness, unsafe findings, rubric criteria, expected actions, or debrief content. Practice / Demo may display only resolved deterministic findings already admitted by the V2-007 disclosure projection.

## Finalization

The learner may request finalization only for a current, active, production-authority Session. The request travels through the existing recovery mutation boundary with stable idempotency identity. The browser does not infer completion from diagnosis, disposition, elapsed time, or local state.

If the response is uncertain, V2-017 refreshes the authoritative Session and does not automatically create a second finalization. Only authoritative `ENDED` status enables the final Assessment read. The ended workspace keeps the final committed monitor and timeline while clinical mutation controls remain disabled.

## Final result

The server returns a strict learner-safe final projection containing the authoritative overall basis-point score, exactly six Case-defined domain records with localized labels, the final unsafe flag, and safe resolved findings/evidence references. React formats returned basis points for display only; it does not calculate weights, points, caps, penalties, unsafe status, or an overall result.

Assessment and debrief access requires authenticated Session authorization. Cross-user and cross-tenant reads fail without disclosing resource existence. No private Assessment response is placed in generic service-worker runtime cache.
