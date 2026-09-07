# V2-015 Student UI Information Architecture

## Status

Implemented locally for architecture review. This is a learner shell, not a clinical-action implementation.

## Routes

| Route | Audience | Purpose | Authority boundary |
| --- | --- | --- | --- |
| `/` | Public | Product orientation and safe entry points | Loads no private Session data |
| `/login` | Public | Authentication UX | Authentication is delegated to the injected service; the client does not assign roles |
| `/expo` | Public | Expo-oriented entry with `PRACTICE_DEMO` as the requested default | Authentication and server-side Case access are still required |
| `/app` | Authenticated learner | Start or resume a Session | Server validates Case publication/access and creates authoritative Sessions |
| `/sessions/:sessionId` | Authorized learner | Load the learner workspace from a safe Session projection | Private data is not requested until authentication resolves |

Unknown routes render a safe not-found state. `/sessions` redirects to `/app`.

## Information hierarchy

The active workspace presents, in order:

1. application header, locale selector, and learner identity;
2. connectivity/recovery and request-state banners;
3. safe patient header with display-safe demographics and Session mode;
4. clinical monitor projection;
5. Visual Patient integration slot;
6. investigation integration slot;
7. clinical-action navigation shell;
8. authoritative Clinical-Time/timeline boundary.

Only `SafeSessionProjection` or `LastKnownSafeSessionProjection` crosses into learner presentation. Raw Session aggregates, Patient State internals, scheduler internals, rubric content, review evidence, approval records, and hidden diagnosis are not UI inputs.

## Deferred ownership

- V2-016 owns clinical action submission and action-domain workflows.
- V2-017 owns timeline/debrief behavior.
- V2-021 owns approved Visual Patient resolution and rendering.
- Diagnostic-media display remains a later, separately governed integration.
- Patient AI, RAG, faculty authoring, and Case Builder are absent.

The shell provides visible regions for these future capabilities without simulating their behavior.
