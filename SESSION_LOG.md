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
