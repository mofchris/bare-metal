# DECISIONS.md — numbered record of every non-trivial decision

Format (defined in BUILD_PLAN.md):

> **D-NNN** | Stage X | _One-line summary._
> Options considered: ... Tradeoff: ... My question to Christopher: none / [question].
> Status: pending / ratified at Gate X.

Decisions are appended, never rewritten. If a decision is reversed later, a new
entry references the old one.

---

**D-001** | Stage 0 | _Deployment: fully static, offline-capable PWA on GitHub Pages; progress in IndexedDB; labs run locally via a lab-runner in this repo; simulators run in-browser._
Options considered: this architecture (pre-made in BUILD_PLAN.md, validated here); Cloudflare Pages/Workers (adds an account + platform dependency, sync needs a server — deferred, see D-002); self-hosted server (needs always-on hardware and money, kills offline-first). Tradeoff: no cross-device sync in v1 — the one-file export/backup is the bridge between laptop and phone. Validation: the proposed stack (D-003…D-008) produces plain static files at build time; nothing at runtime needs a server. My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19).

**D-002** | Stage 0 | _Cloudflare Worker progress sync: considered and deferred to Stage E+._
Options considered: build sync now (real cross-device continuity, but needs auth, a backend, and conflict resolution — weeks of work before any studying happens); defer (export/backup file covers the risk at near-zero cost). Tradeoff: manually moving a backup file between devices is friction, but v1's job is studying, not infrastructure. My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19).

**D-003** | Stage 0 | _Language: TypeScript, compiled at build time (no server at runtime)._
Options considered: plain JavaScript (zero build step, but a data-heavy app — curriculum schemas, progress records, spaced-repetition state — loses too many errors to runtime); TypeScript (types document the data model and fail loudly at compile time; also a portfolio signal). Tradeoff: requires a build step, but GitHub Pages is fed by a build anyway (see D-006). My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19).

**D-004** | Stage 0 | _UI framework: Preact (~4 KB) instead of React or vanilla DOM code._
Options considered: React (industry standard but ~45 KB and nothing in this app needs it over Preact); vanilla TS (zero deps, but the quiz engine + dashboard have enough UI state that hand-rolled DOM updates become the clever-dense code CLAUDE.md bans); Svelte (good fit technically, but compiler-generated output is harder for a stranger to map back to source); Preact (React's exact component model at 1/10 the size — readable to any reviewer who knows React, fits the 2 s cold-start budget). Tradeoff: slightly smaller ecosystem than React; acceptable because dependencies are liabilities here anyway. My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19).

**D-005** | Stage 0 | _Curriculum authored as Markdown + YAML frontmatter, compiled to JSON at build time._
Options considered: author directly in JSON (machine-friendly, miserable for humans writing lessons); parse Markdown in the browser at runtime (ships a parser to the client, and malformed content fails at study time — silently or late); compile at build time (authoring stays pleasant, the compiler validates every lesson/question and fails the build loudly on malformed content, runtime just loads pre-validated JSON). Tradeoff: content changes need a rebuild — fine, content ships with the app anyway. My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19).

**D-006** | Stage 0 | _Build tool: Vite; tests: Vitest; deploy: GitHub Actions → GitHub Pages._
Options considered: no bundler (ES modules straight to Pages — possible, but no TS, no content compilation, no service-worker precache manifest generation); Webpack (does everything, config burden not worth it); Vite (near-zero config, first-class TS, Vitest shares its config so tests need no separate setup). Tradeoff: Vite is a dev-time dependency only — nothing of it runs at runtime, so static hosting stays valid. My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19).

**D-007** | Stage 0 | _Progress storage: IndexedDB via the `idb` wrapper (~1 KB)._
Options considered: localStorage (synchronous, ~5 MB cap, string-only — too small once quiz history grows); raw IndexedDB API (no dependency, but its callback/event API is notoriously verbose and error-prone — exactly where silent bugs live); `idb` (thin promise wrapper, ~1 KB, well-maintained, keeps our code readable). Dependency justification per CLAUDE.md: tiny, boring, maintained by a Chrome team member, replaceable in an afternoon. Tradeoff: one more dependency; accepted for correctness. My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19).

**D-008** | Stage 0 | _Service worker: hand-rolled (~100 lines), not Workbox._
Options considered: Workbox (Google's library — robust, but a black box that defeats the BUILD_PLAN requirement that Christopher understand how offline caching works); hand-rolled precache-on-install + cache-first worker with a build-generated asset manifest (small, fully readable, and itself a systems lesson). Tradeoff: we own the cache-versioning bugs; mitigated by keeping the worker dead simple and testing offline behavior at Gate A. My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19).

**D-009** | Stage 0 | _Lab-runner: Python + PyTorch (CPU), reporting results as a signed-ish JSON token the web app imports._
Options considered: JavaScript labs in-browser (no install friction, but MLSys labs need NumPy/PyTorch and real OS-level timing — the browser hides exactly what we're studying); Python lab-runner (the actual tools of the field, runs on the laptop where measurement is honest). Result hand-off: small JSON results file the app imports (no server, works offline). Tradeoff: Windows Python setup friction — mitigated by a documented one-time setup in Stage C. My question to Christopher: none.
Status: ratified at Gate 0 (2026-07-19); detailed design deferred to Stage C.

**D-011** | Stage 0 | _Progress sync will be a NEW Cloudflare Worker purpose-built for Metal — not a reuse of the existing study-sync Worker. Timing: still Stage E+, not v1._ (Refines D-002; also corrects it: D-002 implied no sync infrastructure existed, but `study-sync.mofchris.workers.dev` already serves the GRE and Network+ sims.)
Options considered: reuse study-sync as-is (fastest, proven auth + merge, but its model is "one localStorage blob per app" — Metal's IndexedDB stores with append-only attempts, SRS state, and lab results don't fit a single-blob PUT without lossy flattening); extend study-sync (couples three apps to one worker — a Metal schema change could break the exam sims); new Metal-specific Worker (clean fit to Metal's data model, can sync per-store with real merge semantics, and is itself a portfolio piece — while still stealing study-sync's proven patterns: Turnstile, token auth, baseUpdatedAt concurrency, offline-as-a-status). Tradeoff: duplicated auth plumbing across workers; accepted for isolation. Timing unchanged from BUILD_PLAN: the app must be fully usable without sync (offline-first is a hard constraint), so the Worker is designed in v1 documents but built at Stage E — building it earlier delays studying (RISKS.md R3). My question to Christopher: confirm the timing — new Worker at Stage E as recommended, or do you want sync in v1 badly enough to grow Stage B's scope? → Christopher confirmed 2026-07-19: new Worker, Stage E timing.
Status: ratified at Gate 0 (2026-07-19).

**D-010** | Stage 0 | _v1 curriculum scope: modules M1–M7 (runnable-heavy core); M8–M10 (GPU kernels, distributed training, compilers) authored as theory+simulator modules in Stage D._
Options considered: everything in v1 (curriculum authoring is the single biggest effort in this build — see RISKS.md R2 — and would delay actual studying by months); core-first (M1–M7 are prerequisite for M8–M10 anyway and are mostly runnable on the laptop, so studying starts at Stage A). Tradeoff: the flashiest topics (distributed training) come last; correct order pedagogically anyway. My question to Christopher: does the module list in docs/CURRICULUM.md match what you want to learn before Fall 2027?
Status: ratified at Gate 0 (2026-07-19).

**D-012** | Stage A | _Public GitHub repo named `bare-metal` (→ live URL mofchris.github.io/bare-metal/)._
Options considered: `metal` (short but generic — collides with Apple's Metal API in searches); `bare-metal` (matches the local folder, and "bare metal" is the systems term for running close to hardware — on-theme for MLSys). Public from day one: the repo is a portfolio piece and the history should show the whole build. Tradeoff: renaming later breaks the Pages URL and `base` path, so this wants to be settled now. My question to Christopher: veto within Stage A if you want a different name — cost of renaming grows once the URL is shared anywhere. → Confirmed by Christopher 2026-07-19: `bare-metal`.
Status: ratified 2026-07-19.

**D-013** | Stage A | _Formatter: Prettier (default config, printWidth 90), enforced in CI. Linter: deferred._
Options considered: Prettier alone (zero-decision formatting, covers the CLAUDE.md consistency rule; `format:check` gates the deploy); Prettier + ESLint (adds real static analysis, but its value overlaps heavily with TypeScript strict mode in a small codebase — revisit when the codebase or contributor count grows); nothing (style drift, rejected outright). Tradeoff: some bug classes ESLint would catch are left to strict TS + tests for now. My question to Christopher: none.
Status: ratified at Gate A (2026-07-19).

**D-014** | Stage A | _Content compiler dependencies: `yaml` (~parse authored YAML) and `marked` (Markdown → HTML at build time). Both dev-only._
Options considered: js-yaml (fine, but `yaml` has better TypeScript types and maintenance cadence); remark/unified for Markdown (powerful plugin pipeline we don't need yet); marked (small, boring, widely used, synchronous API). Per CLAUDE.md both are liabilities: justified because hand-rolling a YAML or Markdown parser is weeks of correctness bugs for zero learning value in scope. Neither ships to the client — they run only at build time, so the runtime bundle stays at ~5 KB. Tradeoff: marked's default HTML output is unsanitized; acceptable because all input is our own repo-reviewed content, not user input (re-evaluate if content ever comes from elsewhere). My question to Christopher: none.
Status: ratified at Gate A (2026-07-19).

**D-015** | Stage A | _Compiler runs via Node's native TypeScript type-stripping (`node cli.ts`); validation is hand-rolled, not a schema library._
Options considered: tsx/ts-node to execute TS tools (extra dependency doing what Node ≥ 22.18 now does natively — our Node 24 runs .ts directly); compiling tools with tsc first (build-step bookkeeping for no gain). Validation: zod (nice API, but a ~14 KB dependency to express ~15 checks) vs hand-rolled validators with error accumulation (plain conditionals a stranger can read; every problem reported in one pass, tagged with the offending file). Tradeoff: hand-rolled checks must be updated by hand as the schema grows — acceptable, the schema is ours and small. Constraint accepted: type-stripping requires `.ts` extensions on relative imports in tools/ (`allowImportingTsExtensions`). My question to Christopher: none.
Status: ratified at Gate A (2026-07-19).

**D-016** | Stage A | _Navigation uses hash routing (`#/lesson/<id>`), not the history API._
Options considered: history-API routes like `/lesson/m1/x` (cleaner URLs, but GitHub Pages is a static file server — refreshing or direct-linking such a URL 404s unless we add a 404.html redirect hack); hash routes (the fragment never reaches the server, so refresh, bookmarks, PWA launches, and offline all work with zero server config). Tradeoff: URLs are slightly uglier; irrelevant for a personal study app. Implementation is ~20 lines in `src/lib/route.ts` — no router dependency. My question to Christopher: none.
Status: ratified at Gate A (2026-07-19).

**D-017** | Stage A | _Mid-quiz durability via per-answer attempt writes, not an autosaved quiz snapshot; tests run on `fake-indexeddb` (new dev dependency)._
Options considered: GRE-sim-style `inprogress` snapshot with resume (serializes whole quiz state every ~10 s; needs resume/discard UI and a snapshot format to maintain); write each attempt to the append-only store the moment it's graded (killing the app loses at most the question on screen, no snapshot format, no resume UI — a 5-question quiz doesn't need resumption). The append-only store was already the DATA_MODEL ground truth, so the snapshot would have been redundant machinery. Tradeoff: no mid-quiz resume — you restart the quiz, but answered questions are already in history. Test infra: `fake-indexeddb` (dev-only) polyfills IndexedDB in Node so the Gate A persistence tests are automated rather than manual-only; alternative was browser-based test running (heavier, slower, not needed yet). My question to Christopher: none.
Status: ratified at Gate A (2026-07-19).
