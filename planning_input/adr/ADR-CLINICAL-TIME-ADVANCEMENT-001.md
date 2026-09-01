# ADR-CLINICAL-TIME-ADVANCEMENT-001

## Deterministic Clinical-Time Advancement

Status: ACCEPTED

## Context

Simulation Clinical Time is authoritative medical time. Wall time and UI animation duration are presentation inputs and cannot determine clinical truth. V2-006 requires normal clock progression and short learner-facing experiences for actions that consume longer Clinical-Time intervals without bypassing the deterministic Clinical Engine scheduler.

## Decision

1. Normal Expo progression uses `time_ratio = 1.0`: approximately one elapsed real second advances one Clinical second. Portable core functions receive explicit elapsed input and do not read a runtime clock.
2. Pause freezes Clinical Time. Resume continues from the current Clinical Time and never adds wall duration spent paused.
3. Action-driven compressed advancement is distinct from the normal ratio. The learner may see a short progress experience, but Clinical Time advances through the complete Case-owned duration.
4. Compressed advancement processes all applicable rules and scheduled work chronologically through the requested target using the pinned Clinical Engine boundary. It never jumps over intermediate clinical work.
5. A Case-owned interrupting event stops compressed advancement at that event's Clinical Time. Work scheduled after the reached time remains pending and can be processed on a later advancement without rewind or duplication.
6. Independent scheduled work completes at its own Clinical Time. Durations are not automatically summed into a global sequential wait.
7. At Clinical Time `T`, due Case-owned work at or before `T` is resolved before an external learner command at `T` is evaluated.
8. Action timing and interrupt classification are reviewed, hash-bound Case Package policy extracted into the immutable pinned Clinical Policy envelope. Runtime clients and AI cannot inject either authority.
9. Compressed action advancement does not globally change the Expo `time_ratio = 1.0`; it is a discrete deterministic Clinical-Time operation.
10. Authoritative normal synchronization receives an explicit trusted UTC timestamp and stores matched real-time and Clinical-Time anchors. Portable Session code never reads a live runtime clock.
11. Browser-sleep catch-up is normal RUNNING synchronization over a larger trusted elapsed interval. It processes scheduled work chronologically and stops at an exact Case-owned interrupt rather than jumping to the requested target.
12. A PAUSED Session does not consume elapsed wall time. Resume preserves Clinical Time and establishes a new trusted real-time anchor, so paused duration is never caught up.
13. Normal synchronization, browser-sleep catch-up, and action-driven compressed advancement may reuse deterministic advancement mechanics, but retain distinct authority and source semantics.

## Scope

V2-006A defines the clock and time-advancement foundation; V2-006C integrates its trusted-time, pause, resume, and catch-up semantics through the in-memory Session Coordinator. This ADR does not implement investigation schemas or UI, database persistence, APIs, assessment, AI, voice, media, or lifecycle persistence.

## Consequences

- Clinical outcomes remain reproducible from pinned Case policy, authoritative state, scheduler state, and explicit time input.
- UI duration cannot skip scheduled clinical work or rewrite Clinical Time.
- Interrupts are disease-neutral engine behavior driven by reviewed Case data.
- Future Session command orchestration must preserve due-work-before-command ordering and fail closed without exposing a partially advanced authoritative state.

## Architecture Relationship

This ADR clarifies implementation of the frozen principles for explicit Simulation Clinical Time, Case-owned clinical policy, deterministic scheduled effects, Session Engine coordination, and immutable version pinning. It does not change Clinical Engine truth ownership or any other frozen architectural invariant.
