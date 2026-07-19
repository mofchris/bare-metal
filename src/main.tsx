// Entry point: mounts the app. Nothing else belongs here — boot logic
// (service worker registration, storage init) will be added in later
// Stage A steps so each piece lands in its own reviewed commit.
import { render } from "preact";
import { App } from "./app";
import "./style.css";

const root = document.getElementById("app");
if (!root) {
  // Fail loudly (CLAUDE.md): a missing mount node means a broken index.html,
  // and a blank page with no message would hide that.
  throw new Error("Metal: #app mount element not found in index.html");
}
render(<App />, root);

// Offline support (D-008): sw.js is generated into dist/ by the build
// (tools/sw), so it only exists in production builds — the dev server runs
// uncached on purpose, otherwise every edit would fight the cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((e: unknown) => {
        // No UI for this: the app works identically without the worker, it
        // just won't be available offline. The console entry keeps it loud
        // enough to notice while debugging.
        console.error("Metal: service worker registration failed", e);
      });
  });
}
