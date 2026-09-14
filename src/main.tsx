import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

const rootElement = document.getElementById("root") || (() => {
  const el = document.createElement("div");
  el.id = "root";
  document.body.appendChild(el);
  return el;
})();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register PWA Service Worker for offline capability & mobile installation
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    const swPath = "./sw.js";
    navigator.serviceWorker
      .register(swPath)
      .then((reg) => {
        // Automatically check for updates on reload
        reg.update().catch(() => {});
      })
      .catch(() => {
        // Silently continue if SW cannot register
      });
  });
}

// Capture native PWA install prompt for modern browsers
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
  window.dispatchEvent(new CustomEvent("pwa-prompt-available"));
});

