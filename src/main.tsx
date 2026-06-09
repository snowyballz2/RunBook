import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted variable fonts — bundled and precached so type works offline.
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";

import "./styles/index.css";
import { App } from "./App";

// Register the service worker (autoUpdate keeps the app fresh on reload).
import { registerSW } from "virtual:pwa-register";
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
