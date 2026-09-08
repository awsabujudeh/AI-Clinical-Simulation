# V2-017 Learner Timeline Disclosure

## Source and ordering

The learner timeline is a strict, bounded server projection over committed Session events. It preserves authoritative `sequence_no` order and event Clinical Time. It does not sort by browser time, receipt order, or localized label.

The projection exposes only a safe event reference, sequence number, Clinical Time, learner-safe item category, localized label, and the already learner-visible Action identity where applicable. The current response is bounded to 256 safe items and declares truncation when applicable.

## Disclosure

Unmapped internal events are omitted. The response does not expose raw event payloads, Patient State, rule identities, scheduler work, effects, scoring criteria, hidden diagnosis, future events, Case hashes, source/review/approval governance, or internal timestamps. Investigation availability appears only when the Case-owned learner visibility policy permits the committed milestone.

The timeline reports what was committed; it never labels active Assessment activity correct, incorrect, optimal, unsafe, or missed. Access uses the same authenticated, tenant-aware Session authorization as other private Session reads. Timeline responses are not added to generic Workbox runtime caching.

## Client behavior

The browser renders the returned order without deriving clinical history. A stale/offline Session does not fetch or fabricate a fresh timeline. Empty and unavailable states explicitly state that no local activity was inferred.
