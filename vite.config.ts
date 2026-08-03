import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base must match the GitHub Pages project path: the app is served from
// https://mofchris.github.io/bare-metal/, not from the domain root (D-001).
// Vite's dev server handles the prefix transparently during `npm run dev`.
export default defineConfig({
  base: "/bare-metal/",
  plugins: [preact()],
  // Honour PORT when something else assigns one (agent preview harnesses, some
  // cloud IDEs); otherwise Vite's usual 5173. Nothing about the app depends on
  // the number — there is no OAuth callback or webhook to keep stable.
  server: { port: Number(process.env.PORT) || 5173 },
});
