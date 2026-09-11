import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createVoiceSmokeHost, listenVoiceSmokeHost, SMOKE_ORIGIN } from "../runtime/voice-smoke-host.mjs";

// Executed only by the explicit opt-in launcher. No dotenv, secret arguments, or environment dumps.
const host = createVoiceSmokeHost({ getEnv: name => process.env[name], fetch: globalThis.fetch });
if (!host.success) {
  console.error(`Voice smoke unavailable: ${host.code}`);
  process.exitCode = 1;
} else {
  let child;
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    child?.kill();
    host.server.closeAllConnections();
    host.server.close();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  try {
    await listenVoiceSmokeHost(host.server);
    // Allowlist only OS execution variables. Credentials never enter the Vite child environment.
    const childEnv = {};
    for (const name of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA"]) {
      if (process.env[name] !== undefined) childEnv[name] = process.env[name];
    }
    child = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
      "--mode", "voice-smoke", "--host", "127.0.0.1", "--port", "4182", "--strictPort"], {
      cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)), env: childEnv,
      stdio: ["ignore", "inherit", "inherit"], windowsHide: true
    });
    child.once("error", () => { console.error("Voice smoke web server unavailable."); process.exitCode = 1; close(); });
    child.once("exit", code => { if (!closing && code !== 0) process.exitCode = 1; close(); });
    console.log(`LOCAL ElevenLabs STT / exact-text TTS: ${SMOKE_ORIGIN}/__dev/voice-smoke`);
    console.log("Synthetic content only. Provider requests require Start recording or Generate TTS. Ctrl+C closes both owned servers.");
  } catch {
    console.error("Voice smoke localhost startup failed. Check that ports 4182/4183 are available.");
    process.exitCode = 1; close();
  }
}
