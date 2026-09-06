/** Static shell cache identity follows application builds, never Case versions. */
export const APP_SHELL_CACHE_ID = "ai-clinical-simulation-v2-app-shell" as const;

export const PRIVATE_API_PATH_PREFIX = "/v1/" as const;

/**
 * Workbox has no generic runtime cache. This helper documents and enforces the
 * same browser policy for any future explicit cache decision.
 */
export function classifyBrowserCacheRequest(input: {
  url: string;
  has_authorization_header: boolean;
  method: string;
}): "STATIC_APP_SHELL" | "NETWORK_ONLY_PRIVATE" | "NETWORK_ONLY_OTHER" {
  let pathname: string;
  try {
    pathname = new URL(input.url, "https://app.invalid").pathname;
  } catch {
    return "NETWORK_ONLY_OTHER";
  }
  if (
    input.has_authorization_header
    || pathname === "/v1"
    || pathname.startsWith(PRIVATE_API_PATH_PREFIX)
  ) {
    return "NETWORK_ONLY_PRIVATE";
  }
  if (
    input.method === "GET"
    && (
      pathname === "/"
      || pathname === "/index.html"
      || /\.(?:css|html|ico|js|png|svg|webmanifest)$/u.test(pathname)
    )
  ) {
    return "STATIC_APP_SHELL";
  }
  return "NETWORK_ONLY_OTHER";
}
