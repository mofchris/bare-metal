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
      .then((registration) => {
        // Registering is not the same as CHECKING. Without an explicit
        // update() the browser only looks for a new sw.js on its own
        // schedule, so an installed PWA can run stale code for days —
        // Christopher hit exactly this: "if i dont hard refresh it doesn't
        // really update". Check at boot and whenever he returns to the tab,
        // which for a PWA is the moment he opens the app.
        void registration.update();
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void registration.update();
        });
      })
      .catch((e: unknown) => {
        // No UI for this: the app works identically without the worker, it
        // just won't be available offline. The console entry keeps it loud
        // enough to notice while debugging.
        console.error("Metal: service worker registration failed", e);
      });

    // The worker calls skipWaiting() and claim(), so a new version takes
    // control of THIS page — but the page is still running the JavaScript it
    // loaded from the old cache. Reloading once on the handover is what
    // actually puts the new code on screen.
    //
    // Two guards. A page with NO controller at load time is a first-ever
    // install, where claim() also fires controllerchange — reloading there
    // would bounce a brand-new visitor for nothing. And `reloading` stops the
    // handover from triggering a second reload after the first.
    const wasControlled = navigator.serviceWorker.controller !== null;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!wasControlled || reloading) return;
      reloading = true;
      location.reload();
    });
  });
}
