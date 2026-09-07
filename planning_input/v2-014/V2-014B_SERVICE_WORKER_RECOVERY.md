# V2-014B Service-Worker Recovery

## Cache boundary

The generated Workbox service worker precaches only the application shell and approved static resources. Generic runtime caching is empty, `/v1` is excluded from navigation fallback, fetch mutations use `cache: no-store`, and Authorization material is absent from cached requests.

Private API responses are never treated as clinical truth by the service worker. IndexedDB recovery metadata is separate from Cache Storage and remains untrusted input.

## Update behavior

Updates use prompt activation with `skipWaiting: false` and `clientsClaim: false`. An update therefore does not force an active simulation tab onto a new worker. Service-worker update checks do not erase unresolved IndexedDB journal entries or make them executable.

Real-browser coverage proves:

- the offline application shell loads after control is established;
- IndexedDB data survives page reload and is visible to another tab in the same origin;
- principal-scoped cleanup does not expose another principal's record;
- a service-worker update check preserves an unresolved recovery record;
- the active controller is not forcibly replaced;
- Cache Storage contains no `/v1` request and no Authorization header.

## Product boundary

Shell resilience is not an offline Clinical Engine. There is no client scheduler, offline clinical-action queue, diagnostic generator, Assessment authority, media generator, or Visual Patient implementation.
