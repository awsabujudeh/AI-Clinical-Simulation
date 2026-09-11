# V2-020B1 — Trusted Azure Speech runtime composition

Implementation-only correction to V2-020A. No live Azure call, credential access, cloud resource creation or voice evaluation is performed here. V2-020 remains NOT CLOSED. Frozen Architecture, accepted ADRs, reviewed STEMI content and Terra/Luna policy are unchanged.

## Configuration and authority

Exactly two trusted process-environment inputs:

```text
AZURE_SPEECH_KEY=<AZURE_SPEECH_KEY>
AZURE_SPEECH_REGION=uaenorth
```

There is no endpoint/resource-name variable and no resource-name requirement. Never use a Vite-prefixed secret. No `.env` file or secret-file loader is added or expected.

`packages/api-core/src/voice/runtime-config.ts` owns `readAzureSpeechRuntimeConfig(getEnv)`. It reads only the two names above, rejects absent/blank values, trims/lowercases region and validates the existing regional identifier syntax. It preserves the key value exactly. The provider reuses the same region validation helper. The configuration object is trusted secret-bearing server data; never log or return it.

Failure results contain only fixed codes: `AZURE_SPEECH_KEY_REQUIRED`, `AZURE_SPEECH_REGION_REQUIRED`, `AZURE_SPEECH_REGION_INVALID`, or `AZURE_SPEECH_ENVIRONMENT_UNAVAILABLE`. Getter exceptions are sanitized without secret values, length, prefix, suffix or hash.

`packages/api-core/src/voice/runtime-composition.ts` owns `createAzureSpeechSecureApi`. It receives the existing API dependencies, environment getter, fetch and trusted operational clock. It constructs the existing Azure provider and memory broker, then passes `speech_token_broker` into the existing `createSecureApiApp`. Missing/invalid configuration omits the broker; the authenticated route returns unavailable, while unrelated Session/text/manual APIs still start. Returned server availability metadata contains no configuration/secret. No token is requested on import or construction. No alternate API/auth stack is introduced.

Runtime-specific adapters are outside portable packages:

- `runtime/azure-speech-deno.ts`: `createDenoAzureSpeechSecureApi` supplies `Deno.env.get`, runtime fetch and clock. A host supplies the existing trusted API dependencies and serves the resulting `app`; no listener is automatically started. Grant only the two necessary environment names when that server is explicitly enabled.
- `runtime/azure-speech-node.mjs`: `createNodeAzureSpeechSecureApi` supplies `process.env`, runtime fetch and clock. `readLocalAzureSpeechRuntimeConfig` supports a later explicitly authorized local diagnostic process. Neither function reads files or runs on import.

These adapters compose the existing API but do not invent database/auth credentials or instantiate a production deployment. Shared validation is not duplicated by runtime.

Construct the composition once per server process, not per HTTP request, so the existing process-local token cache/replay and quota state are retained. Recompose/restart deliberately when rotating configuration.

## Regional token compatibility and unchanged semantics

For the configured region, the server would call exactly:

```text
POST https://uaenorth.api.cognitive.microsoft.com/sts/v1.0/issueToken
```

The resource key is sent only in the server-side subscription-key header. The browser retains `SpeechConfig.fromAuthorizationToken(token.authorization_token, token.region)`, so regional issuance and regional SDK routing remain paired. No resource-specific/custom-domain or Entra flow is introduced.

The eight-minute application TTL, 30-second browser minimum remaining lifetime, refresh-key replay/renewal and bounded process-local quota remain unchanged. Resource-wide bearer scope and the need for shared multi-instance quota review remain acknowledged V2-020A limitations. No continuous recognizer auto-refresh is added. Text fallback, partial isolation, explicit final review, approved-text TTS and the 52-definition frozen corpus remain unchanged.

## Exact next-step local setup — NOT performed by this checkpoint

Use a dedicated local PowerShell terminal. This is a process environment, not a repository file path. Do not paste the real key into chat or a command literal/history. After separate authorization to configure the local live environment, the following prompts locally with hidden input and passes the value only to that terminal's child processes:

```powershell
Set-Location -LiteralPath 'C:\Projects\AI-Clinical-Simulation\v2'
$speechSecureInput = Read-Host 'Azure Speech key (local hidden input only)' -AsSecureString
try {
  $env:AZURE_SPEECH_KEY = [System.Net.NetworkCredential]::new('', $speechSecureInput).Password
  $env:AZURE_SPEECH_REGION = 'uaenorth'
} finally {
  $speechSecureInput.Dispose()
  Remove-Variable speechSecureInput
}
```

The environment necessarily holds the plaintext key in process memory; this is not a vault. Never dump that environment. Close the terminal or remove both environment entries after authorized use. Nothing is persisted by these setup instructions.

A newly launched Node process in this terminal inherits these values; no Codex restart is required for that process. An already-running server must be restarted/recomposed to capture new configuration. Setting values in a separate terminal does not update Codex's existing environment. If using Windows User Environment Variables instead, restart the parent application/terminal before launching its child runtime; this checkpoint does not create those persistent variables.

## First future smoke command — DO NOT RUN without separate live authorization

The first proposed smoke is **one token exchange only**, not STT/TTS or the corpus. It reads the environment via the new local reader and uses the existing provider. It prints only completion/region, never the key or issued token. It does not need fake Session data or an unauthenticated API route. A later authenticated application smoke must still use normal Session authorization.

Run from `C:\Projects\AI-Clinical-Simulation\v2`, only when explicitly authorized:

```powershell
node --input-type=module -e @'
import { readLocalAzureSpeechRuntimeConfig } from './runtime/azure-speech-node.mjs';
import { createAzureSpeechTokenProvider } from './packages/api-core/src/voice/azure-token-provider.ts';
const result = readLocalAzureSpeechRuntimeConfig();
if (!result.success) {
  console.error(result.code);
  process.exitCode = 1;
} else {
  try {
    const token = await createAzureSpeechTokenProvider({ ...result.config, fetch }).issue();
    console.log(JSON.stringify({ status: 'TOKEN_EXCHANGE_COMPLETED', region: token.region }));
  } catch {
    console.error('VOICE_TOKEN_UNAVAILABLE');
    process.exitCode = 1;
  }
}
'@
```

No executable live-smoke entry point or automatic evaluation is added. The command above is documentation of the next separately authorized action, not permission to run it now. Do not start the 52-utterance gate from it.

## Permanent tests

`npm run test:v2-020b1` covers configuration, API injection, voice/API regressions, runtime adapters and audits. Browser tests use an injected getter and fetch only. The Node check spawns three isolated child environments containing synthetic values (or missing values), without inheriting or inspecting host credentials. The Deno check has no environment/network permission and verifies capability-local denied-environment behavior. The normal full `verify` includes all Browser/Deno tests and the isolated Node checks.

The voice audit additionally rejects the server environment-key name and synthetic runtime credential marker in browser source/build, voice fixtures and evaluation artifacts. Tests also reject the key/config in API responses and the strict browser contract. No raw credential values are logged. These are conservative signature/boundary checks, not a claim to detect every possible secret format.

## Verification outcome

- Baseline remains `f24fd619b99ea8795b4c1d6d1c47092a35ad865a` on `v2-development`.
- Focused `npm run test:v2-020b1`: PASS, exit 0; 131 Browser tests, four Deno tests, three isolated Node scenarios, typecheck, portability and voice audit PASS. New permanent coverage comprises 14 Browser tests, one Deno test and three Node scenarios.
- Final `npm run verify`: PASS, exit 0; 805 Browser tests across 84 files, 35 Deno tests, 11 workspace and three voice Playwright tests. Local persistence/API regressions, build and all included audits pass. Voice audit 18/18 plus expanded client/build checks pass.
- An initial full-verification attempt stopped at native PostgreSQL initialization because sandboxed `os.userInfo()` returned `uv_os_get_passwd ENOMEM`. A read-only isolated check confirmed success with host OS access; the unchanged full suite then passed with that access. No test/assertion was weakened and no implementation workaround was added. No Playwright process termination was needed in this run.
- A preliminary typecheck caught a test helper's overly narrow inferred header type; it was explicitly typed to permit testing missing authentication before the successful focused/full gates.
- V1 approved hashes, STEMI UNDER_REVIEW/REVIEW_ONLY content and hashes, frozen Architecture, accepted ADRs, selected Terra/Luna policy, browser voice behavior and frozen evaluation corpus remain unchanged.
- No Azure live requests or quota use; no real key was read, requested, logged or persisted. No cloud resources, remote Supabase, deployment, commit, push or V2-021.
- Only this verification documentation was appended after successful full verification. No executable/config/test content changed afterward. Final `git diff --check` passes; no staged/conflict/generated/secret-signature paths.

### Exact scope

Eight created files:

```text
planning_input/v2-020/V2-020B1_TRUSTED_RUNTIME_COMPOSITION.md
v2/packages/api-core/src/voice/runtime-composition.ts
v2/packages/api-core/src/voice/runtime-config.ts
v2/runtime/azure-speech-deno.ts
v2/runtime/azure-speech-node.mjs
v2/scripts/v2-020b1-runtime-test.mjs
v2/tests/browser/voice/runtime-composition.browser.test.ts
v2/tests/deno/voice_runtime_test.ts
```

Five modified files:

```text
v2/package.json
v2/packages/api-core/src/index.ts
v2/packages/api-core/src/voice/azure-token-provider.ts
v2/scripts/v2-020a-voice-audit.mjs
v2/tests/fixtures/api/secure-api.ts
```

Classification: **V2-020B1 AZURE RUNTIME COMPOSITION — REVIEW READY**. V2-020 overall remains **NOT CLOSED**, pending live Jordanian Azure evaluation and human review.
