# V2-014 Offline and Recovery Model

## Slice A scope

V2-014A establishes server-authoritative reconnect/reload recovery, a bounded in-doubt mutation journal, safe last-known display projection, and the PWA application-shell boundary. V2-014 remains open; Slice B owns interruption, crash/restart, simultaneous-tab, stale-cache, service-worker-update, prolonged-outage, and recovery-chaos adversarial closure.

## Authority

The server-side Session, Clinical, persistence, and Assessment boundaries remain authoritative. Browser recovery data cannot grant identity, institution membership, role, Session ownership, Case execution authority, Patient State, Clinical Time, scheduler state, Events, diagnostic availability, or score.

Offline behavior is read-only. The UI may load the static application shell and show a frozen, explicitly `STALE_LAST_KNOWN` safe projection whose `mutation_authority` is `NONE`. The browser does not advance Clinical Time, run rules, run the scheduler, infer diagnostic availability, or change observations while disconnected.

## Mutation delivery states

- `NOT_SENT`: the mutation did not cross the transport boundary. It is not journaled as a future action and is never automatically submitted after reconnect.
- `IN_DOUBT`: a validated mutation was journaled before send, transport was attempted, and no definitive response arrived. Only the same canonical request with the same idempotency key may be reconciled.
- Confirmed outcomes: a typed server response establishes success, rejection, stale conflict, idempotency conflict, authentication failure, or authorization failure. Terminal records are removed; unresolved ambiguous/dependency failures remain bounded recovery metadata.

`SESSION_VERSION_CONFLICT` means the intent was not executed against the stale base. Recovery clears that journal entry, requires an authoritative Session refresh, and never rebuilds or automatically retries the clinical intent against new state.

## Reload flow

1. Restore and verify the current authentication context.
2. Fetch the safe authoritative Session projection from `/v1`.
3. Inspect strictly validated, same-principal/same-Session in-doubt records.
4. Reconcile each exact request through the existing authenticated API and durable idempotency/CAS boundary.
5. Fetch the authoritative projection again after reconciliation.
6. Resume mutation controls only when synchronization is complete.

Missing/expired authentication pauses reconciliation. A changed principal, disabled membership, or foreign Session fails closed because the local principal/session identifiers are only lookup scope; the API reauthorizes every operation.

## Start, action, and finalization ambiguity

The same model applies to `startSession`, action proposal, and `endSimulation`. A committed response that is lost leaves one exact journal entry. A retry reuses its request and idempotency key; durable server replay returns the already-created Session, already-committed clinical outcome, or already-finalized Assessment without duplicate execution.

## Connectivity

The deterministic states are `ONLINE`, `OFFLINE_OR_UNREACHABLE`, `RECOVERING`, and `SYNC_REQUIRED`. `navigator.onLine` is only a hint: it can move an unreachable client to `RECOVERING`, while a successful trusted request/synchronization establishes `ONLINE`.
