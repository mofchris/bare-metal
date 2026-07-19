# SESSION_LOG.md — append-only work log

Every session ends with an entry in the format defined in CLAUDE.md. The last
entry is the single source of truth for "where did work stop." Newest entry
at the bottom.

---

## Session 2026-07-19

**Stage:** 0 — Discovery & Design | **Gate status:** GATE 0 SIGNED — APPROVED 2026-07-19 by Christopher
**Done this session:**

- Recorded hardware/hours in BUILD_PLAN.md (HP OmniBook X Flip 14, Core Ultra 7, 16 GB, no discrete GPU, Win 11; iPhone XR; ~21 h/week)
- Initialized git repo (branch `main`), first commits made
- Created DECISIONS.md with D-001…D-010 (deployment, stack, formats, lab-runner, v1 scope) — all **pending** Gate 0 ratification
- Created README.md: architecture overview + mermaid diagram + data-flow narrative
- Created docs/CURRICULUM.md: full M1–M10 outline (39 lessons, 23 labs, runnable/simulated flags), M1–M7 proposed as v1
- Created docs/DATA_MODEL.md: content format, question bank, IndexedDB progress schema, export file format
- Created docs/RISKS.md: top 5 risks with mitigations

- Checked how the GRE sim (mofchris/gre-mock-exam-simulator) saves progress (localStorage blob `gre-sim-v1` + study-sync Cloudflare Worker); found its architecture doc stale on sync
- Logged D-011: Metal gets its own purpose-built sync Worker at Stage E (not study-sync reuse); Christopher confirmed timing
- **Gate 0 signed: APPROVED 2026-07-19.** D-001…D-011 ratified.

**In progress / half-finished:** nothing half-finished — all Stage 0 deliverables done. No code exists yet.
**Next session should start with:** (1) the carried-over Gate 0 explain-back quiz — Christopher approved without answering it; it is a required gate test and must open the Stage A kickoff (4 questions are in the 2026-07-19 chat: offline persistence, build-time content validation, lab-results hand-off, no-sync-in-v1). (2) Get the internet/power reliability line for BUILD_PLAN's MY SETUP. (3) Then begin Stage A: repo scaffolding (Vite + TS + Preact + Vitest), content compiler skeleton, M1 authoring.
**Open questions for Christopher:**

- Gate 0 quiz answers (carried over — not optional)
- Internet/power reliability note (still [to confirm] in BUILD_PLAN.md)
  **New DECISIONS.md entries this session:** D-001…D-011 (all ratified at Gate 0)

## Session 2026-07-19 (second block — Stage A start)

**Stage:** A — Walking Skeleton | **Gate status:** Gate A unsigned (early in stage)
**Done this session:**

- Created public GitHub repo `mofchris/bare-metal`, pushed full history (7 commits)
- Scaffolded the app: Vite + TypeScript (strict) + Preact + Vitest + Prettier per D-003…D-006, D-013
- App shell (`src/app.tsx`): honest placeholder home screen — no fake navigation
- First real logic + tests: `src/lib/short-answer.ts` (normalize + accept-list matching for the quiz engine), 5 tests passing
- Deploy pipeline: `.github/workflows/deploy.yml` (format check + tests gate the build), GitHub Pages enabled (workflow mode)
- **Live and verified:** https://mofchris.github.io/bare-metal/ returns the app (HTTP 200, correct base path)
- Prettier run across all docs (one-time reformat noise in this commit)

**In progress / half-finished:** Stage A is ~20% done. Missing (nothing broken, just not built): content compiler, curriculum types, lesson renderer, quiz engine UI, IndexedDB persistence (`idb` not yet installed), PWA manifest + service worker, M1 authoring, README v1 setup instructions. The live page is a labeled placeholder.
**Next session should start with:** the carried-over Gate 0 quiz (still owed), then the content compiler + curriculum schema types (docs/DATA_MODEL.md is the spec) with malformed-content tests — it's the wall every other Stage A piece builds against.
**Open questions for Christopher:**

- Gate 0 quiz answers (carried over a second time)
- Internet/power reliability note for BUILD_PLAN MY SETUP
- D-012: repo name `bare-metal` — veto soon or it sticks
- D-013: Prettier-only (no ESLint for now) — ok?
  **New DECISIONS.md entries this session:** D-012, D-013 (both pending)

## Session 2026-07-19 (third block — content compiler)

**Stage:** A — Walking Skeleton | **Gate status:** Gate A unsigned
**Done this session:**

- D-012 ratified: repo name `bare-metal` confirmed by Christopher
- Curriculum types shared between compiler and app: `src/lib/curriculum.ts`
- Content compiler built (`tools/content-compiler/`): parses content/modules/\*\* (YAML + Markdown frontmatter), validates per docs/DATA_MODEL.md (ids unique, refs resolve, mcq answers in range, non-empty accept lists, sources required, orphan lessons, missing files, prereq cycles), renders Markdown→HTML, emits `public/curriculum.json` with a content-version hash; reports ALL problems in one pass, each naming the offending file, and exits 1
- Compiler tests: 5 new tests over 3 fixtures (valid, many-problems with 7 deliberate defects, prereq-cycle) — 10 tests total passing
- M1 lesson 01 "The memory hierarchy" genuinely authored (sourced: H&P 6th ed, Drepper 2007, Dean's latency numbers) + 5 real quiz questions in `content/modules/m1-hardware-foundations/`
- Wired into build: `npm run build:content` runs before dev and build; curriculum.json verified present in dist/ (8.1 KB); `public/curriculum.json` gitignored as a build artifact
- New deps (dev-only): `yaml`, `marked`, `@types/node` (D-014); tools run via Node's native TS type-stripping, no tsx (D-015)

**In progress / half-finished:** Stage A ~35% done. The app does NOT yet load curriculum.json — the shell is still the placeholder; lesson renderer + quiz UI are next. M1 has 1 of 5 lessons authored. Not built yet: IndexedDB persistence, PWA manifest + service worker, README v1.
**Next session should start with:** the carried-over Gate 0 quiz, then the lesson renderer: fetch curriculum.json, module/lesson list navigation, render lesson HTML — making the deployed app actually show Module 1.
**Open questions for Christopher:**

- Gate 0 quiz answers (carried over a third time — answer them!)
- Internet/power reliability note for BUILD_PLAN MY SETUP
- D-013, D-014, D-015 pending your ok (batched, none urgent)
  **New DECISIONS.md entries this session:** D-014, D-015 (pending); D-012 ratified

## Session 2026-07-19 (fourth block — lesson renderer)

**Stage:** A — Walking Skeleton | **Gate status:** Gate A unsigned
**Done this session:**

- App now loads and renders the curriculum: `src/lib/load-curriculum.ts` (fetch + shape check with actionable error messages), `src/lib/route.ts` (hash routing, D-016), `src/lib/lookup.ts` (lesson lookup + next-lesson nav)
- Screens: `components/home.tsx` (module TOC with per-lesson question counts), `components/lesson-view.tsx` (objectives, compiler-rendered HTML body, sources, next-lesson link); `app.tsx` rewritten with explicit loading/error/not-found states
- Lesson typography in style.css (tables, code, headings — the M1 latency table renders properly)
- 8 new tests (route parsing, curriculum shape validation, lesson lookup) — 18 total, all passing
- End-to-end verified in a real headless browser: home → click lesson → full lesson renders, zero console errors; checked at iPhone-XR viewport (414×896) with screenshot — layout clean
- The deployed placeholder text is gone: the live site now shows actual curriculum

**In progress / half-finished:** Stage A ~50%. Not built yet: quiz engine UI (grading logic exists in lib/short-answer.ts but no screen uses it), IndexedDB persistence, PWA manifest + service worker, M1 lessons 02–05, README v1. Nothing half-broken — every built screen is complete.
**Next session should start with:** the carried-over Gate 0 quiz, then the quiz engine UI (MCQ + short answer, per-lesson quiz flow using the existing grading lib), which unblocks persistence right after.
**Open questions for Christopher:**

- Gate 0 quiz answers (carried over — fourth time)
- Internet/power reliability note for BUILD_PLAN MY SETUP
- D-013…D-016 pending batch review
  **New DECISIONS.md entries this session:** D-016 (pending)
