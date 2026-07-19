# DECISIONS.md — numbered record of every non-trivial decision

Format (defined in BUILD_PLAN.md):

> **D-NNN** | Stage X | *One-line summary.*
> Options considered: ... Tradeoff: ... My question to Christopher: none / [question].
> Status: pending / ratified at Gate X.

Decisions are appended, never rewritten. If a decision is reversed later, a new
entry references the old one.

---

**D-001** | Stage 0 | *Deployment: fully static, offline-capable PWA on GitHub Pages; progress in IndexedDB; labs run locally via a lab-runner in this repo; simulators run in-browser.*
Options considered: this architecture (pre-made in BUILD_PLAN.md, validated here); Cloudflare Pages/Workers (adds an account + platform dependency, sync needs a server — deferred, see D-002); self-hosted server (needs always-on hardware and money, kills offline-first). Tradeoff: no cross-device sync in v1 — the one-file export/backup is the bridge between laptop and phone. Validation: the proposed stack (D-003…D-008) produces plain static files at build time; nothing at runtime needs a server. My question to Christopher: none.
Status: pending (ratify at Gate 0).

**D-002** | Stage 0 | *Cloudflare Worker progress sync: considered and deferred to Stage E+.*
Options considered: build sync now (real cross-device continuity, but needs auth, a backend, and conflict resolution — weeks of work before any studying happens); defer (export/backup file covers the risk at near-zero cost). Tradeoff: manually moving a backup file between devices is friction, but v1's job is studying, not infrastructure. My question to Christopher: none.
Status: pending (ratify at Gate 0).

**D-003** | Stage 0 | *Language: TypeScript, compiled at build time (no server at runtime).*
Options considered: plain JavaScript (zero build step, but a data-heavy app — curriculum schemas, progress records, spaced-repetition state — loses too many errors to runtime); TypeScript (types document the data model and fail loudly at compile time; also a portfolio signal). Tradeoff: requires a build step, but GitHub Pages is fed by a build anyway (see D-006). My question to Christopher: none.
Status: pending (ratify at Gate 0).

**D-004** | Stage 0 | *UI framework: Preact (~4 KB) instead of React or vanilla DOM code.*
Options considered: React (industry standard but ~45 KB and nothing in this app needs it over Preact); vanilla TS (zero deps, but the quiz engine + dashboard have enough UI state that hand-rolled DOM updates become the clever-dense code CLAUDE.md bans); Svelte (good fit technically, but compiler-generated output is harder for a stranger to map back to source); Preact (React's exact component model at 1/10 the size — readable to any reviewer who knows React, fits the 2 s cold-start budget). Tradeoff: slightly smaller ecosystem than React; acceptable because dependencies are liabilities here anyway. My question to Christopher: none.
Status: pending (ratify at Gate 0).

**D-005** | Stage 0 | *Curriculum authored as Markdown + YAML frontmatter, compiled to JSON at build time.*
Options considered: author directly in JSON (machine-friendly, miserable for humans writing lessons); parse Markdown in the browser at runtime (ships a parser to the client, and malformed content fails at study time — silently or late); compile at build time (authoring stays pleasant, the compiler validates every lesson/question and fails the build loudly on malformed content, runtime just loads pre-validated JSON). Tradeoff: content changes need a rebuild — fine, content ships with the app anyway. My question to Christopher: none.
Status: pending (ratify at Gate 0).

**D-006** | Stage 0 | *Build tool: Vite; tests: Vitest; deploy: GitHub Actions → GitHub Pages.*
Options considered: no bundler (ES modules straight to Pages — possible, but no TS, no content compilation, no service-worker precache manifest generation); Webpack (does everything, config burden not worth it); Vite (near-zero config, first-class TS, Vitest shares its config so tests need no separate setup). Tradeoff: Vite is a dev-time dependency only — nothing of it runs at runtime, so static hosting stays valid. My question to Christopher: none.
Status: pending (ratify at Gate 0).

**D-007** | Stage 0 | *Progress storage: IndexedDB via the `idb` wrapper (~1 KB).*
Options considered: localStorage (synchronous, ~5 MB cap, string-only — too small once quiz history grows); raw IndexedDB API (no dependency, but its callback/event API is notoriously verbose and error-prone — exactly where silent bugs live); `idb` (thin promise wrapper, ~1 KB, well-maintained, keeps our code readable). Dependency justification per CLAUDE.md: tiny, boring, maintained by a Chrome team member, replaceable in an afternoon. Tradeoff: one more dependency; accepted for correctness. My question to Christopher: none.
Status: pending (ratify at Gate 0).

**D-008** | Stage 0 | *Service worker: hand-rolled (~100 lines), not Workbox.*
Options considered: Workbox (Google's library — robust, but a black box that defeats the BUILD_PLAN requirement that Christopher understand how offline caching works); hand-rolled precache-on-install + cache-first worker with a build-generated asset manifest (small, fully readable, and itself a systems lesson). Tradeoff: we own the cache-versioning bugs; mitigated by keeping the worker dead simple and testing offline behavior at Gate A. My question to Christopher: none.
Status: pending (ratify at Gate 0).

**D-009** | Stage 0 | *Lab-runner: Python + PyTorch (CPU), reporting results as a signed-ish JSON token the web app imports.*
Options considered: JavaScript labs in-browser (no install friction, but MLSys labs need NumPy/PyTorch and real OS-level timing — the browser hides exactly what we're studying); Python lab-runner (the actual tools of the field, runs on the laptop where measurement is honest). Result hand-off: small JSON results file the app imports (no server, works offline). Tradeoff: Windows Python setup friction — mitigated by a documented one-time setup in Stage C. My question to Christopher: none.
Status: pending (ratify at Gate 0, detailed design deferred to Stage C).

**D-011** | Stage 0 | *Progress sync will be a NEW Cloudflare Worker purpose-built for Metal — not a reuse of the existing study-sync Worker. Timing: still Stage E+, not v1.* (Refines D-002; also corrects it: D-002 implied no sync infrastructure existed, but `study-sync.mofchris.workers.dev` already serves the GRE and Network+ sims.)
Options considered: reuse study-sync as-is (fastest, proven auth + merge, but its model is "one localStorage blob per app" — Metal's IndexedDB stores with append-only attempts, SRS state, and lab results don't fit a single-blob PUT without lossy flattening); extend study-sync (couples three apps to one worker — a Metal schema change could break the exam sims); new Metal-specific Worker (clean fit to Metal's data model, can sync per-store with real merge semantics, and is itself a portfolio piece — while still stealing study-sync's proven patterns: Turnstile, token auth, baseUpdatedAt concurrency, offline-as-a-status). Tradeoff: duplicated auth plumbing across workers; accepted for isolation. Timing unchanged from BUILD_PLAN: the app must be fully usable without sync (offline-first is a hard constraint), so the Worker is designed in v1 documents but built at Stage E — building it earlier delays studying (RISKS.md R3). My question to Christopher: confirm the timing — new Worker at Stage E as recommended, or do you want sync in v1 badly enough to grow Stage B's scope? → Christopher confirmed 2026-07-19: new Worker, Stage E timing.
Status: pending (formal ratification at Gate 0 with D-001…D-010; substance already agreed).

**D-010** | Stage 0 | *v1 curriculum scope: modules M1–M7 (runnable-heavy core); M8–M10 (GPU kernels, distributed training, compilers) authored as theory+simulator modules in Stage D.*
Options considered: everything in v1 (curriculum authoring is the single biggest effort in this build — see RISKS.md R2 — and would delay actual studying by months); core-first (M1–M7 are prerequisite for M8–M10 anyway and are mostly runnable on the laptop, so studying starts at Stage A). Tradeoff: the flashiest topics (distributed training) come last; correct order pedagogically anyway. My question to Christopher: does the module list in docs/CURRICULUM.md match what you want to learn before Fall 2027?
Status: pending (ratify at Gate 0).
