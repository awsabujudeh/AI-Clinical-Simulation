import { createRoot } from "react-dom/client";
import { App } from "../../../apps/web/src/App.tsx";
import { voiceUiHarness } from "../../fixtures/voice/ui-services.ts";
import "../../../apps/web/src/styles.css";
const h = voiceUiHarness(new URL(location.href).searchParams.get("scenario") ?? "success");
declare global { interface Window { __VOICE_TEST__: typeof h } }
window.__VOICE_TEST__ = h;
createRoot(document.getElementById("root")!).render(<App services={h.services} initialEntries={["/sessions/session.ui-neutral"]} />);
