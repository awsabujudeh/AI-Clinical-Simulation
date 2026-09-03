import type { HashAdapter } from "../../packages/contracts/src/index.ts";

function bytes(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

/** Browser/Deno test authority using the shared Web Crypto surface. */
export const PORTABLE_SHA256_ADAPTER: HashAdapter = {
  async sha256(value) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      Uint8Array.from(bytes(value)).buffer
    );
    return Array.from(new Uint8Array(digest), (unit) => unit.toString(16).padStart(2, "0")).join("");
  }
};
