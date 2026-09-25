import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  // Diagnostic launch inherits no credentials and never loads an environment file.
  ...(mode === "voice-smoke" ? { envDir: false } : {}),
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      manifest: {
        name: "BALSIM Clinical Simulation",
        short_name: "BALSIM",
        description: "Clinical simulation and structured learning",
        start_url: "/",
        display: "standalone",
        background_color: "#f3f6fc",
        theme_color: "#1456be"
      },
      workbox: {
        cacheId: "ai-clinical-simulation-v2-app-shell",
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        // Preserve the original 4.09 MB review ECG; cache paired local reports,
        // never authoritative API responses or runtime clinical state.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{html,js,css,ico,png,svg,webmanifest}", "media/stemi/1.0.0/*-report.txt"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/v1(?:\/|$)/u],
        runtimeCaching: []
      }
    })
  ]
}));
