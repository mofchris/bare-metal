// App shell: top-level layout and (for now) a placeholder home screen.
// Depends on: nothing app-internal yet. Depended on by: main.tsx.
// The real navigation (lessons / quiz / dashboard) arrives with the lesson
// renderer and quiz engine later in Stage A; this file is the walking
// skeleton's first vertebra, kept honest — no dead links, no fake screens.

export function App() {
  return (
    <div class="shell">
      <header class="shell-header">
        <h1>Metal</h1>
        <p class="tagline">Machine Learning Systems, learned properly.</p>
      </header>
      <main class="shell-main">
        <p>
          Walking skeleton (Stage A) under construction. The lesson renderer, quiz engine,
          and Module 1 land next — see{" "}
          <a href="https://github.com/mofchris/bare-metal">the build log</a>.
        </p>
      </main>
    </div>
  );
}
