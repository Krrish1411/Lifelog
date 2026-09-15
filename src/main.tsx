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

// Service Worker handling:
// On native mobile (Capacitor Android/iOS), NEVER run a service worker.
// The APK already hosts assets locally from the app package. Running a service worker causes
// stale asset caching across APK upgrades until data is cleared.
// Therefore, on native mobile we actively purge any old service workers and CacheStorage.
if (typeof window !== "undefined") {
  const isNative =
    (window as any).Capacitor?.isNativePlatform?.() ||
    (window as any).Capacitor?.platform === "android" ||
    (window as any).Capacitor?.platform === "ios" ||
    navigator.userAgent.includes("wv") ||
    navigator.userAgent.includes("LifeLogNativeMobile");

  if (isNative) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(() => {});
        }
      }).catch(() => {});
    }
    if ("caches" in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name).catch(() => {});
        }
      }).catch(() => {});
    }
  } else if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    // Register PWA Service Worker for offline capability on web only
    window.addEventListener("load", () => {
      const swPath = "./sw.js";
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      navigator.serviceWorker
        .register(swPath)
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch(() => {});
    });
  }
}

// Capture native PWA install prompt for modern browsers
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
  window.dispatchEvent(new CustomEvent("pwa-prompt-available"));
});

