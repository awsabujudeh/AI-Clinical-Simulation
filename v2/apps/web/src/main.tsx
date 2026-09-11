import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("V2 root element was not found.");
}

if (import.meta.env.DEV && import.meta.env.MODE === "voice-smoke"
  && window.location.origin === "http://127.0.0.1:4182" && window.location.pathname === "/__dev/voice-smoke") {
  void import("./features/voice/VoiceSmoke").then(({ VoiceSmoke }) => {
    createRoot(rootElement).render(<StrictMode><VoiceSmoke /></StrictMode>);
  });
} else createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
