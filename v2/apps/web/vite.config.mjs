import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      manifest: {
        name: "AI Clinical Simulation Platform V2",
        short_name: "Clinical Simulation",
        description: "Server-authoritative clinical simulation application shell",
        start_url: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#0f172a"
      },
      workbox: {
        cacheId: "ai-clinical-simulation-v2-app-shell",
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ["**/*.{html,js,css,ico,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/v1(?:\/|$)/u],
        runtimeCaching: []
      }
    })
  ]
});
