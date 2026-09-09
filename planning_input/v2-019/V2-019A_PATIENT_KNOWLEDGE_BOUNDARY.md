# V2-019A Patient Knowledge Boundary

## Authoritative patient-known source

The context projector admits only:

- facts declared `on_direct_question` and included by the Case-authored dialogue-policy allowlist;
- facts not listed as forbidden;
- explicit Case-authored current-state manifestation mappings that match committed Patient State;
- bounded prior dialogue for continuity, never as truth;
- localized persona/style/tone identifiers and a Case-authored deterministic fallback.

Truth status is explicit (`PRESENT`, `ABSENT`, `UNKNOWN`, or authored statement). A manifestation may explicitly replace a stale static patient fact.

## Excluded material

The Patient Agent is not given the whole Case Package, raw Patient State, hidden diagnosis, hidden diagnostic results, rules, scheduler, future deterioration, action expectations, Assessment rubric, scores, review records, approvals, or package hashes.

Numeric physiology does not implicitly authorize symptoms. A pressure, rate, oxygenation, or rhythm value can become conversational only through a reviewed Case-owned manifestation mapping.

## Refresh rule

Each turn rebuilds context from the pinned Case and current committed Patient State. Earlier model utterances provide continuity only and cannot override current Case/state truth.
