import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base must match the GitHub Pages project path: the app is served from
// https://mofchris.github.io/bare-metal/, not from the domain root (D-001).
// Vite's dev server handles the prefix transparently during `npm run dev`.
export default defineConfig({
  base: "/bare-metal/",
  plugins: [preact()],
});
