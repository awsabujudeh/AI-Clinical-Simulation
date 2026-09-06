# V2-013 Disclosure and Data Minimization

The API returns projections of committed authority, never raw Case, Session, checkpoint, or database rows.

- Patient state responses contain current observations, Clinical Time, state/event versions, clock status, safe pinned identity, and the V2-007 disclosure projection.
- They omit hidden diagnosis/facts, rule and scheduler state, rubric/answer key, expected actions, reviews, approvals, evidence sources, package/review hashes, and provider metadata.
- Active `ASSESSMENT` responses expose no correctness, live score, criteria, or future answer. `PRACTICE_DEMO` exposes only already-resolved deterministic findings permitted by V2-007.
- Diagnostic responses expose only components unlocked by committed milestone events and the pinned visibility policy. Pending content is absent; media, structured result, machine interpretation, and formal report remain distinct.
- Final Assessment is computed from authoritative committed Session evidence after trusted finalization. The route does not score and the public projection omits governance hashes.
- Question, Curriculum/RAG, Case Builder, and Visual delivery are never faked. Question and Case Builder shells return explicit unavailability. Curriculum retrieval remains future server-internal work. Visual resolution remains a future pure client capability.

The body limit is 16 KiB, measured as bytes for every mutating private request, including handlers that are currently delivery-pending. CORS is an injected exact-origin allowlist; wildcard credentialed access is impossible and no production origin is invented. V2-013 adds no payload/token logging.
