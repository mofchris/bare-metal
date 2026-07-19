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
