import { twoCaseSecuritySnapshot, TWO_CASE_SECURITY_EXPECTED } from "../fixtures/security/two-case.ts";

Deno.test("V2-027 exact Browser/Deno two-case security equality", async () => {
  const result = await twoCaseSecuritySnapshot();
  if (JSON.stringify(result) !== JSON.stringify(TWO_CASE_SECURITY_EXPECTED)) throw Error("Two-case security snapshot differs");
});
