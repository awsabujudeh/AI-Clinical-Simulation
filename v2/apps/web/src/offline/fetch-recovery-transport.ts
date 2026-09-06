import type {
  RecoveryHttpRequest,
  RecoveryTransport,
  RecoveryTransportResult
} from "@ai-clinical-simulation/recovery-core";

export type AuthenticatedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type RecoveryAuthorizationProvider = () => Promise<string | undefined>;

export function createFetchRecoveryTransport(input: {
  fetch: AuthenticatedFetch;
  get_authorization_header: RecoveryAuthorizationProvider;
  api_origin?: string;
}): RecoveryTransport {
  return Object.freeze({
    async send(request: RecoveryHttpRequest): Promise<RecoveryTransportResult> {
      let authorization: string | undefined;
      try {
        authorization = await input.get_authorization_header();
      } catch {
        return {
          kind: "NOT_SENT",
          failure: "REQUEST_CONSTRUCTION_FAILURE"
        };
      }
      try {
        const headers = new Headers(request.headers);
        if (authorization !== undefined) headers.set("Authorization", authorization);
        const response = await input.fetch(
          new URL(request.path, input.api_origin ?? globalThis.location.origin),
          {
            method: request.method,
            headers,
            body: request.body,
            cache: "no-store",
            credentials: "include"
          }
        );
        const contentType = response.headers.get("content-type") ?? "";
        const body = contentType.includes("application/json")
          ? await response.json()
          : await response.text();
        return {
          kind: "HTTP_RESPONSE",
          status: response.status,
          body
        };
      } catch {
        // Fetch cannot reliably prove whether a mutation reached the server.
        return {
          kind: "AMBIGUOUS_TRANSPORT_FAILURE",
          failure: "BEFORE_RESPONSE_CERTAINTY"
        };
      }
    }
  });
}
