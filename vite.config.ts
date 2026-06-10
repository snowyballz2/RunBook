/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const PAPER = "#FAFAF8";

// Base path. Defaults to "/" (local dev, `npm run preview`, custom domains, and
// user/org GitHub Pages sites). For a GitHub Pages *project* site served from
// https://<user>.github.io/<repo>/, the deploy workflow sets BASE_PATH=/<repo>/.
let base = process.env.BASE_PATH || "/";
if (!base.startsWith("/")) base = "/" + base;
if (!base.endsWith("/")) base += "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "icons/apple-touch-icon.png",
        "guides/**/*.md",
      ],
      workbox: {
        // Precache the app shell, fonts, icons, and the bundled guides so the
        // app is fully usable offline on first run.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2,md}"],
        // Serve the app shell for any in-scope navigation (base-aware).
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        // id/start_url/scope are base-relative so the installed app's identity
        // and navigation scope match wherever it is hosted (root or subpath).
        id: base,
        start_url: base,
        scope: base,
        name: "RunBook — checkable procedure guides",
        short_name: "RunBook",
        description:
          "Turn a Markdown procedure into a calm, sequential, checkable guide. Local-first and offline.",
        theme_color: PAPER,
        background_color: PAPER,
        display: "standalone",
        orientation: "portrait-primary",
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icons/icon-maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: {
        // Let us exercise the SW during `vite dev` if needed.
        enabled: false,
      },
    }),
  ],
  // Quiet, deterministic dev server.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
