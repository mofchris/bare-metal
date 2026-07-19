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

## Session 2026-07-19 (fifth block — quiz engine)

**Stage:** A — Walking Skeleton | **Gate status:** Gate A unsigned
**Done this session:**

- Quiz grading glue: `src/lib/quiz.ts` (`gradeResponse` maps MCQ/short responses onto questions; throws on type mismatch instead of silently marking wrong) + 3 tests
- Quiz screen: `components/quiz.tsx` — one question at a time, MCQ option buttons + short-answer input (Enter submits, empty submits ignored), immediate feedback showing your answer / the correct one / the explanation, end summary with per-question ✓✗ review, retry, and an explicit "results aren't saved yet" note
- Routing: `#/quiz/<lessonId>` added (route.ts + tests); lesson view gained a "Take the quiz (N questions)" CTA; `questionsFor` added to lookup.ts
- Quiz styles in style.css (options, feedback colors, summary)
- 22 tests total, all passing; bundle 8.5 KB gzipped
- End-to-end verified in headless browser: lesson → quiz CTA → answered all 5 M1 questions (one deliberately wrong) → feedback correct on both paths → summary shows 4/5 with ✗ on the missed one; zero console errors; mobile (414×896) screenshot clean
- Note: during verification hit a stale-cache false alarm (browser held the previous build's JS; reload fixed) — not an app bug

**In progress / half-finished:** Stage A ~60%. Quiz results are session-only by design until persistence lands. Not built yet: IndexedDB persistence (next), PWA manifest + service worker, M1 lessons 02–05, README v1.
**Next session should start with:** the carried-over Gate 0 quiz, then IndexedDB persistence (D-007: `idb` dependency, attempts + lessonProgress stores per docs/DATA_MODEL.md) wired to quiz completion — after that, killing the app mid-quiz can be tested (Gate A manual test).
**Open questions for Christopher:**

- Gate 0 quiz answers (carried over — fifth time; the app now has a quiz engine, you have no excuse)
- Internet/power reliability note for BUILD_PLAN MY SETUP
- D-013…D-016 pending batch review
  **New DECISIONS.md entries this session:** none

## Session 2026-07-19 (sixth block — IndexedDB persistence)

**Stage:** A — Walking Skeleton | **Gate status:** Gate A unsigned
**Done this session:**

- Progress persistence live: `src/lib/progress-store.ts` — database `metal-progress` v1 (stores: `attempts` append-only with by-question index, `lessonProgress` keyed by lessonId, `meta` with installId). New runtime dep `idb` (D-007, ratified at Gate 0)
- Durability design (D-017): every answer writes to `attempts` the moment it's graded — no quiz snapshot needed; killing the app mid-quiz loses at most the on-screen question. Each quiz run gets a `sessionId` (UUID) for Stage B grouping
- Quiz records attempts + marks lesson in-progress on first answer, done on completion; summary now truthfully reports "All N answers were recorded on this device" or a loud NOT-saved warning with the reason
- Home shows per-lesson badges: "started ·" / "done ✓" read from lessonProgress
- App shell opens the db at boot; failure (e.g. blocked storage) shows a banner and the app keeps working unrecorded
- 5 new automated persistence tests on `fake-indexeddb` (dev dep, D-017): read/write, reopen durability, index filtering, status upsert — 27 tests total, all green
- End-to-end verified in headless browser: answered 2 questions → hard reload (simulated kill) → both attempts present in IndexedDB and home shows "started"; completed full quiz → 5/5, home shows "done ✓"; 7 attempts across 2 session ids

**In progress / half-finished:** Stage A ~75%. Gate A's "kill mid-quiz, no data loss" now passes in simulation — Christopher must still do it by hand on laptop + phone at the gate. Not built: PWA manifest + service worker (next), M1 lessons 02–05, README v1.
**Next session should start with:** the carried-over Gate 0 quiz, then the PWA layer — manifest + hand-rolled service worker (D-008) with precache manifest generated at build, then offline verification.
**Open questions for Christopher:**

- Gate 0 quiz answers (carried over — sixth time)
- Internet/power reliability note for BUILD_PLAN MY SETUP
- D-013…D-017 pending batch review
  **New DECISIONS.md entries this session:** D-017 (pending)

## Session 2026-07-19 (seventh block — PWA layer)

**Stage:** A — Walking Skeleton | **Gate status:** Gate A unsigned
**Done this session:**

- Hand-rolled service worker (D-008) via `tools/sw/`: generator scans dist/, emits sw.js with the full precache list + a content-hash cache version; precache-on-install, cache-first, navigations fall back to the cached app shell, old caches deleted on activate; `npm run build:sw` is the last build step
- PWA manifest (`public/manifest.webmanifest`): standalone display, scoped to /bare-metal/; icons generated from `tools/icons/icon-source.html` (committed PNGs: 512 maskable, 192, apple-touch 180); index.html carries manifest + apple-touch-icon + iOS meta
- SW registration in main.tsx — production builds only (dev stays uncached on purpose)
- 3 new generator tests (precache list correctness, version-changes-only-on-content-change, refuses unbuilt dist) — 30 tests total, green
- **Offline verified end-to-end:** installed SW in headless browser, killed the preview server, reloaded — full lesson AND quiz render with zero console errors, server confirmed dead
- **Bug found & fixed during verification (the reason we hand-roll):** crossorigin-attributed loads (module JS + stylesheet) send an Origin header, and the Cache API's default Vary matching made exactly those two lookups miss offline. Fix: `ignoreVary` in cache matches — correct since all cached entries are same-origin static assets keyed by URL. First offline attempt failed empty; diagnosis via network log (the two failures were precisely the two crossorigin resources)

**In progress / half-finished:** Stage A ~85%. Remaining: M1 lessons 02–05 + their questions (largest chunk), README v1 setup instructions, then Gate A manual tests (Christopher: install on iPhone from live URL, offline check, mid-quiz kill on both devices, cold-start ≤2 s measurement). PWA install on real iOS is UNVERIFIED — headless Chromium ≠ iOS Safari; that's a Gate A manual item.
**Next session should start with:** the carried-over Gate 0 quiz, then authoring M1 lessons 02–05 (curriculum outline in docs/CURRICULUM.md; format proven by lesson 01), then README v1.
**Open questions for Christopher:**

- Gate 0 quiz answers (carried over — seventh time)
- Internet/power reliability note for BUILD_PLAN MY SETUP
- D-013…D-017 pending batch review
  **New DECISIONS.md entries this session:** none (SW design was already D-008)

## Session 2026-07-19 (eighth block — M1 lessons 02–05)

**Stage:** A — Walking Skeleton | **Gate status:** Gate A unsigned
**Done this session:**

- Authored M1 lessons 02–05, all genuinely sourced (no stubs): 02 CPU architecture (pipelining, superscalar/OoO, branch prediction, SIMD/FMA, peak-FLOPS formula, the NumPy-vs-Python-loop lesson; H&P + Agner Fog), 03 the three budgets (latency/bandwidth/compute, arithmetic intensity worked by hand for add/dot/matmul, break-even at 4 FLOPs/byte; Williams et al. + Drepper + Horace He), 04 roofline model (formula, ridge point, three positions → three actions, honest limitations; CACM 2009 + H&P), 05 GPUs from 10,000 feet (latency vs throughput machines, SIMT/warps, HBM, what fits and what doesn't; CUDA guide + H&P ch 4)
- 17 new questions (q-006…q-022; mix of MCQ and short) — M1 bank now 22 questions across 5 lessons
- module.yaml lists all 5 lessons; compiler validates clean; content version 0906ef57d6207af2
- Verified in browser: home lists all 5 lessons with counts (lesson 01 "done ✓" badge intact), lesson 04 renders the roofline formula, no console errors
- Caught and fixed one authoring slip before commit: a garbled sentence in lesson 05's HBM paragraph

**In progress / half-finished:** Stage A ~95% of build work. M1 theory + quiz bank complete. Remaining: README v1 (setup instructions a stranger could follow), then the Gate A manual checklist belongs to Christopher.
**Next session should start with:** the carried-over Gate 0 quiz, then README v1, then present the Gate A package (automated tests all green; manual items: lesson+quiz on laptop AND phone, PWA install on iPhone, offline check, mid-quiz kill, cold-start ≤2 s measured and recorded in BUILD_PLAN).
**Open questions for Christopher:**

- Gate 0 quiz answers (carried over — eighth time)
- Internet/power reliability note for BUILD_PLAN MY SETUP
- D-013…D-017 pending batch review
- Scope note needing your ruling at Gate A: BUILD_PLAN Stage A says the first module is authored "theory + labs + quiz bank," but the lab harness is a Stage C deliverable — labs can't exist before it. Proposal (standing rule 2): treat M1 labs as Stage C work, note the edit in BUILD_PLAN at gate sign-off.
  **New DECISIONS.md entries this session:** none

## Session 2026-07-19 (ninth block — README v1, Gate A package)

**Stage:** A — Walking Skeleton | **Gate status:** unsigned — package presented, awaiting Christopher's manual tests + sign-off
**Done this session:**

- README v1 rewritten: live URL at top, what-works-today list, stranger-proof setup instructions, architecture diagram updated to as-built (content compiler + sw generator), repo layout, docs table
- Setup instructions verified by running them exactly: `npm ci` → 30/30 tests → clean build, from the locked dependency state
- Cold start measured on this laptop (headless Chromium, localhost preview, uncached): **183 ms total load / 131 ms DOM interactive** — >10× inside the 2 s budget. Preliminary: Christopher's own measurement on the live URL fills the BUILD_PLAN blank at the gate
- All Stage A build deliverables now complete; remaining gate items are manual and Christopher's

**In progress / half-finished:** nothing half-finished. Design pass deliberately deferred (Stage E per plan; noted in chat 2026-07-19 — current styling is functional, not designed).
**Next session should start with:** Christopher's Gate A results — the manual checklist below, the Gate 0 quiz (still owed), the labs-scope ruling, D-013…D-017 batch, internet/power note. No Stage B work before Gate A signs.
**Gate A manual checklist for Christopher (from BUILD_PLAN):**

1. Complete one full lesson + quiz on the laptop, from the live URL
2. Same on the iPhone; install to home screen (Share → Add to Home Screen)
3. Kill the app mid-quiz on either device; confirm answered questions survived
4. Airplane mode / wifi off; confirm lessons + quizzes fully work offline
5. Measure cold start on the laptop; write the number into BUILD_PLAN Stage A
6. Then: "APPROVED + date" on Gate A, or the list of what failed
   **Open questions for Christopher:** Gate 0 quiz (ninth time), internet/power note, D-013…D-017, labs-scope ruling (above)
   **New DECISIONS.md entries this session:** none

## Session 2026-07-19 (tenth block — Gate A signed)

**Stage:** A → B boundary | **Gate status:** GATE A SIGNED — APPROVED 2026-07-19 by Christopher, with recorded caveats
**Done this session:**

- Gate A sign-off written into BUILD_PLAN with an explicit ⚠ caveat block: approved WITHOUT the gate's own manual tests
- Labs-scope amendment applied to Stage A wording (theory + quiz bank; labs follow the Stage C harness) — covered by the blanket approval of the presented package
- D-013…D-017 marked ratified at Gate A (they were explicitly in the package)
- Cold-start blank filled with the preliminary 183 ms measurement, labeled preliminary; Christopher's own measurement noted as not taken

**Open risk items carried forward (not resolved by the signature):**

1. PWA install on real iOS Safari — never attempted on the actual iPhone XR
2. Offline behavior on real devices — verified only in headless Chromium
3. Mid-quiz kill on real devices — simulated only
4. No lesson or quiz has ever been completed by Christopher on any device
5. Gate 0 explain-back quiz — still unanswered after nine sessions
6. Internet/power reliability note — still [to confirm]

**In progress / half-finished:** nothing. Stage B may begin.
**Next session should start with:** Stage B kickoff — but the FIRST thing to ask for is items 1–4 above (10 minutes on the phone settles them), because Gate B's own test is "a week of real daily use logged before sign-off," which cannot be simulated by the agent, rubber-stamped, or skipped without making the whole platform theater. Then: progress dashboard design (derive from attempts store), SRS engine (algorithm decision needed — new D entry), export/restore.
**Open questions for Christopher:** items 1–6 above
**New DECISIONS.md entries this session:** none (D-013…D-017 status updates only)

## Session 2026-07-19 (eleventh block — Stage B start: spaced repetition)

**Stage:** B — Memory & Measurement | **Gate status:** Gate B unsigned
**Done this session:**

- SRS engine `src/lib/srs.ts` (D-018, pending Gate B): binary-grade SM-2 variant — correct: 1 d → 6 d → ×ease (2.5 start); wrong: lapse, ease −0.2 (floor 1.3), relearn at 1 d; intervals capped at 90 d. Pure functions; 7 tests feed fake histories and assert exact resurfacing dates (Gate B automated requirement)
- Progress DB schema v2: `srsState` store (keyed by questionId); v1→v2 migration rebuilds SRS by replaying the append-only attempts history — derived-state principle proven in a test
- Every graded answer now also folds into its SRS schedule (lesson quizzes AND review runs)
- Quiz component generalized (title/back/markDone props) and reused by the new review screen: `#/review` serves all due questions across modules, oldest-due first; home shows a review card ("N due / Review now", or "up to date — next: date")
- docs/DATA_MODEL.md srsState row updated to as-built
- **Bug found & fixed during verification:** first quiz answer could race the async DB open and go silently unrecorded (summary would still claim it saved). Fix: app renders no screens until storage settles (open or definitive failure). Verified closed by rapid-firing answers after a wiped DB — both rows present
- End-to-end verified: miss a question → SRS row with lapse; rewind its dueAt → home shows "1 question is due" → review deck serves exactly it → answer correctly → schedule advances, home returns to "up to date". 40 tests green
- Test-infra note: the browse daemon restarted mid-session once, invalidating a page context — re-ran the flow, no product impact

**In progress / half-finished:** Stage B ~35%. Remaining: progress dashboard (mastery per topic, trends, streak calendar, weakest areas; must render instantly with 1000+ records), export/backup + restore with lossless round-trip test, weekly export reminder. Gate B also requires Christopher's week of real daily use.
**Next session should start with:** the dashboard block (derive everything from attempts; add a 1000+ record perf fixture), then export/restore.
**Open questions for Christopher:** unchanged (Gate A caveat items 1–6, incl. Gate 0 quiz + internet/power note); D-018 ratifies at Gate B
**New DECISIONS.md entries this session:** D-018 (pending)

## Session 2026-07-19 (twelfth block — dashboard)

**Stage:** B — Memory & Measurement | **Gate status:** Gate B unsigned
**Done this session:**

- Dashboard derivations `src/lib/stats.ts` (pure, from the attempts store): mastery per lesson (a question is "known" iff its LATEST attempt was correct — current knowledge, not historical accuracy), weakest-lessons ranking, run history grouped by sessionId, streak with a today-grace rule (an unstudied today doesn't break the streak until midnight)
- Dashboard screen at `#/dashboard`: 4 stat tiles (streak, current mastery, questions tracked, due for review), last-10-runs single-series column trend (per-run tooltips, direct label on latest only), 8-week study-day calendar grid (today ringed, per-cell titles), weakest-areas panel linking to lessons, full mastery-by-lesson list with bars; dataviz method followed (stat tiles for headlines, one axis, no legend for single series, text in text tokens, color never the only carrier)
- Persistent shell nav added: Modules / Dashboard / Review
- 8 new tests: latest-attempt mastery (incl. recovered/regressed cases), weakest ranking, run grouping, streak rules, local-date keys, and a 5000-attempt perf pin (<200 ms budget; typical single-digit ms) — 48 tests total, green
- **Gate B perf requirement verified in-browser:** seeded 1200 attempts across 40 days/120 sessions into IndexedDB; dashboard rendered in 103 ms — stat tiles, trend, calendar, weakest areas all correct; mobile (414×896) screenshot clean; seeded test data wiped afterwards

**In progress / half-finished:** Stage B ~65%. Remaining: export/backup + restore (lossless round-trip test, merge semantics D-entry) and the weekly export reminder. Then Gate B waits on Christopher's week of real daily use.
**Next session should start with:** export/restore block — one-file JSON export per docs/DATA_MODEL.md §4, restore with validate + merge (needs a D-entry for merge semantics before implementation), export→wipe→restore automated test, weekly reminder wired to meta.lastExportAt.
**Open questions for Christopher:** unchanged (Gate A caveats incl. Gate 0 quiz; D-018 at Gate B)
**New DECISIONS.md entries this session:** none

## Session 2026-07-19 (thirteenth block — export/backup/restore)

**Stage:** B — Memory & Measurement | **Gate status:** Gate B unsigned — ALL build deliverables complete; gate now waits on Christopher's week of real use
**Done this session:**

- D-019 logged (merge semantics) before implementation, per DATA_MODEL's requirement: restore MERGES — attempts union by (questionId, at, sessionId) identity; lessonProgress by rank (done > in-progress, earliest completedAt wins); srsState never merged, always rebuilt from merged attempts; meta stays local
- `src/lib/backup.ts`: buildBackup / validateBackup (loud, specific rejections incl. newer-schema files) / restoreBackup / exportReminder — all pure or db-parameterized
- ProgressDb: addAttemptsIfMissing (dedup union), putLessonProgress (preserves original completedAt), getMeta/setMeta
- Backup screen at `#/backup` (+ shell nav entry): export downloads `metal-backup-YYYY-MM-DD.json` and stamps meta.lastExportAt; restore via file picker, reports "N new attempts, M lessons updated"
- Weekly reminder on home (BUILD_PLAN deliverable): warns when never-exported (with history) or export ≥7 days old, links to #/backup; pure rule unit-tested
- 5 new test groups incl. **the Gate B round-trip: export → indexedDB.deleteDatabase (real data-loss simulation) → restore → byte-equal stores**; cross-device merge idempotence; lessonProgress rank rules — 53 tests total, green
- Browser-verified end-to-end: fresh history → "never been backed up" banner on home → export (message + timestamp) → uploaded a crafted other-device backup → "Restore merged: 1 new attempts, 1 lesson records updated" → merged lesson shows done ✓ on home
- One TS strictness fix (unknown narrowing in validateBackup); one test-env recurrence of the stale-SW cache serving an old build during verification (cleared, re-verified — no product bug)

**In progress / half-finished:** nothing half-finished. Stage B build work is DONE: dashboard ✓, SRS ✓, export/restore ✓, weekly reminder ✓, all three automated Gate B test requirements ✓ (progress math, SRS scheduling with fake histories, lossless round-trip).
**Next session should start with:** nothing to build for Stage B. The gate waits on: (1) Christopher's week of real daily use, logged here per BUILD_PLAN; (2) D-018 + D-019 ratification; (3) the standing Gate A caveat items (incl. Gate 0 quiz, internet/power note). Only after Gate B signs: Stage C (lab harness + first 3 labs).
**Open questions for Christopher:** start the week of real use — the app is complete enough to be your actual daily study tool now
**New DECISIONS.md entries this session:** D-019 (pending)

## Session 2026-07-19 (fourteenth block — M2 authoring)

**Stage:** B (build complete; gate waiting on Christopher) — this block is curriculum authoring, which belongs to every stage (RISKS.md R2 mitigation). No Stage C work was touched.
**Done this session:**

- Authored M2 — Measurement, complete (4 lessons, sourced): 01 why timing is hard (warmup, thermal throttling, measurement bias per Mytkowicz ASPLOS 2009, perf_counter, the labs' checklist), 02 statistics for benchmarks (right-skew, mean/median/min as different questions, IQR noise floor, interleaved A/B comparison, outliers-are-data; Georges OOPSLA 2007, Kalibera & Jones), 03 profiling (sampling vs instrumentation, self vs cumulative, flame graphs, Amdahl cap; Gregg), 04 benchmarking ML (throughput↔latency dial, p50/p99 + goodput, coordinated omission per Tene, compilation warmup, async-execution sync trap; MLPerf)
- 16 new questions (m2/q-001…q-016) — bank now 38 questions across 9 lessons, 2 modules
- First multi-module compile: prereqs (`m2 → m1`) validated and topologically ordered by the compiler; verified on home (M1 listed before M2, all lessons + counts, no console errors)
- The module deliberately teaches the exact methodology the Stage C harness will implement (checklist, IQR noise floor, interleaving, results-file-as-specification) — lab L2.x specs will cite these lessons

**In progress / half-finished:** nothing half-finished. M3 (numerics) is the next authoring target if gate-waiting continues.
**Next session should start with:** Christopher's Gate B inputs (week-of-use log, D-018/D-019, standing carried items). If still waiting: author M3.
**Open questions for Christopher:** unchanged
**New DECISIONS.md entries this session:** none

## Session 2026-07-19 (fifteenth block — M3 authoring)

**Stage:** B (build complete; gate waiting on Christopher) — curriculum authoring block, no Stage C work touched.
**Done this session:**

- Authored M3 — Numerics, complete (4 lessons, sourced): 01 IEEE 754 from the bits up (1/8/23 split, why 0.1 doesn't exist, spacing/machine epsilon, rounding, specials; Goldberg 1991), 02 fp16 vs bf16 (range-vs-precision split, why bf16 won training, store-narrow/accumulate-wide, roofline tie-in; Micikevicius ICLR 2018), 03 int8 quantization (affine map, scale/zero-point, calibration + clipping tension, the three wins, int32 accumulators; Jacob CVPR 2018, Nagel 2021), 04 failure modes (overflow/underflow/absorption/cancellation, non-associativity → parallel non-determinism, NaN debugging, loss scaling; Higham)
- 16 new questions (m3/q-001…q-016) — curriculum now 3 modules, 13 lessons, 54 questions, all compiling clean
- Verified in browser (after clearing the test daemon's stale SW — recurring test-env nuisance, not a product bug): M3 on home, lesson renders, no console errors
- Deliberate cross-links: M3 leans on M1's roofline (precision as a bandwidth dial) and sets up M6 (quantization) and the L3.x labs

**In progress / half-finished:** nothing half-finished. M1–M3 are the complete "toolkit" arc (hardware, measurement, numerics); M4 (data pipelines) is the next authoring target.
**Next session should start with:** Christopher's Gate B inputs; else M4 authoring.
**Open questions for Christopher:** unchanged
**New DECISIONS.md entries this session:** none

## Session 2026-07-19 (sixteenth block — M4 authoring)

**Stage:** B (build complete; gate waiting on Christopher) — curriculum authoring block, no Stage C work touched.
**Done this session:**

- Authored M4 — Data pipelines, complete (4 lessons, sourced): 01 the input pipeline (five-stage anatomy, decode cost, the pipeline law, GIL → worker processes; tf.data VLDB 2021, Mohan data stalls VLDB 2021), 02 overlap (prefetching + why small buffers suffice, worker scaling to saturation, pinned memory + async transfer, what overlap cannot fix), 03 storage formats (row vs column per Abadi SIGMOD 2008, row groups, the small-file trap + sharding, shuffle buffers, compression as CPU-vs-bandwidth trade that inverts on NVMe), 04 pipeline health (the synthetic-data experiment as decisive diagnostic, sawtooth utilization reading, page-cache/warmup/tail measurement traps)
- 16 new questions (m4/q-001…q-016) — curriculum now 4 modules, 17 lessons, 70 questions
- Prereq chain deepened: m4 → m2 (first non-m1 prereq); compiles and orders correctly
- Verified in browser: M4 on home, storage-formats lesson renders, zero console errors

**In progress / half-finished:** nothing half-finished. Next authoring target: M5 (training mechanics).
**Next session should start with:** Christopher's Gate B inputs; else M5 authoring.
**Open questions for Christopher:** unchanged
**New DECISIONS.md entries this session:** none

## Session 2026-07-19 (seventeenth block — M5 authoring)

**Stage:** B (build complete; gate waiting on Christopher) — curriculum authoring block, no Stage C work touched.
**Done this session:**

- Authored M5 — Training mechanics, complete (4 lessons, sourced): 01 autodiff (symbolic/numeric/automatic, forward vs reverse mode and why reverse wins at 2–3× forward cost, the tape, why activations must live until backward; Baydin JMLR 2018, Griewank & Walther), 02 the memory bill (four line items, the 16-bytes-per-param Adam rule incl. the mixed-precision version, activations as the batch-scaled item, fragmentation/allocator fine print; ZeRO SC 2020, Korthikanti MLSys 2023), 03 batch size (three dials — throughput-to-saturation, linear memory, diminishing optimization returns per Shallue JMLR 2019; Goyal LR scaling; what it does NOT change), 04 memory tricks (gradient checkpointing O(√n) for +30% per Chen 2016, mixed precision as batch-not-model headroom, gradient accumulation, the memory↔compute exchange-rate pattern)
- 16 new questions (m5/q-001…q-016) — curriculum now 5 modules, 21 lessons, 86 questions
- First module with two prereqs (m3 + m4); compiles and orders correctly
- Verified in browser: M5 on home, memory-bill lesson renders, no console errors

**In progress / half-finished:** nothing half-finished. Remaining v1 authoring: M6 (compression), M7 (serving).
**Next session should start with:** Christopher's Gate B inputs; else M6 authoring.
**Open questions for Christopher:** unchanged
**New DECISIONS.md entries this session:** none

## Session 2026-07-19 (eighteenth block — design pass, D-020)

**Stage:** B — design pass pulled forward from Stage E at Christopher's explicit request ("I actually want to use the app, not just because I need to"). Logged + ratified as D-020.
**Done this session:**

- Visual identity designed around the product's own name: a circuit board. Palette: solder-mask green-black (#0d1412 board, #141d18 surfaces, #24312a hairlines), copper (#d08a4a) as the single identity/progress accent, silkscreen ink; LED green/red reserved strictly for quiz correctness. Typography: IBM Plex Mono (display/labels — engineering voice) + IBM Plex Sans (body), self-hosted woff2 vendored from Christopher's own GRE-sim repo with the OFL license file (offline-first: zero external requests; SW precaches fonts automatically)
- Signature element: the via rail — lesson lists are threaded by a trace; each lesson is a via that fills with copper when done, copper-ringed when started (encodes the real dependency-chain structure). home.tsx passes status classes to drive it
- Full style.css rewrite (~tokens, shell, banners, home, lesson typography incl. tables/blockquotes, quiz, dashboard, backup); focus-visible outlines, prefers-reduced-motion respected
- Icons regenerated in board/copper (512/192/apple-touch); manifest + theme-color updated to #0d1412
- Critique pass with screenshots (home, lesson, quiz feedback, dashboard at 414×896): one revision — dashboard/weakest lesson links quieted from copper-underline to ink (boldness spent in one place); one false alarm (h2s looked copper in PNG; computed style confirmed silkscreen ink)
- 53 tests green; build clean (one benign Vite note about font URLs resolving at runtime, expected for base-prefixed public paths)
- Test-env note: the browse daemon's SW cache served a stale build twice; final verification done against the built artifact directly

**In progress / half-finished:** nothing half-finished. Design system is in; DESIGN.md doc not written (tokens are documented in style.css's header comment — a separate DESIGN.md can be Stage E polish if wanted).
**Next session should start with:** Christopher looking at the live app (hard-refresh once) and reacting — the design is for him; his veto/tweaks welcome. Then Gate B inputs or M6 authoring.
**Open questions for Christopher:** does the board/copper identity land for you? Any tweaks before it settles?
**New DECISIONS.md entries this session:** D-020 (ratified — his request)

## Session 2026-07-19 (nineteenth block — dashboard-first home, D-021)

**Stage:** B — continued design work at Christopher's direction ("first page should be the dashboard… full screen… big text/small text… animations").
**Done this session:**

- PRODUCT.md + DESIGN.md created (durable design context; Stage E wanted DESIGN.md anyway). Impeccable skill loaded (product register) to govern the pass
- Home rebuilt dashboard-first (D-021): data-driven hero pushing exactly ONE action — no history → "Start lesson 1" (with lesson/question totals as the sell), due > 0 → "Review N due questions", else → "Continue: <next unfinished lesson>"; big type (3.3rem headline on desktop, copper mono figures), eyebrow shows the streak
- Full-width desktop layout: 84rem shell, top-bar header (wordmark + nav), main + 19rem side-rail grid at ≥1024px; reading routes (lesson/quiz/backup/review/dashboard) wrapped in a 44rem `.narrow` column
- Side rail: streak calendar, run trend, weakest areas, backup status; on first run it becomes a "How it works" explainer written in the app's own via language (hollow → ringed → filled) — the empty state teaches the interface and balances the page
- Modules de-boxed: hairline-separated sections with per-module "n/m done" counts; via rail unchanged
- Panels extracted to components/panels.tsx (shared home + dashboard, one vocabulary); dashboard remains the detail page; nav renamed Modules→Home, Dashboard→Progress
- Motion: staggered 500ms rise on load (opacity/transform only, ease-out-quint, killed by prefers-reduced-motion); via dots transition on state change. Skill bans applied: removed ALL colored side-stripe borders (banners/explanation/blockquote → full hairline + tint)
- Screenshot critique loop at 1440×900 and 414×896, both hero states verified (one iteration: empty-state rail was blank → HowItWorks panel). 53 tests green
- Test-env note: stale-SW-serving-old-build hit twice more during verification; worked around, no product bug

**In progress / half-finished:** nothing half-finished.
**Next session should start with:** Christopher's reaction to the new landing; then Gate B inputs or M6 authoring.
**Open questions for Christopher:** verdict on the dashboard-first landing?
**New DECISIONS.md entries this session:** D-021 (ratified — his direction)

## Session 2026-07-19 (twentieth block — exams + 75% gating, D-023)

**Stage:** B — feature work at Christopher's direction (module exams, gated progression, gradient, progress bars).
**Done this session:**

- Gating library `src/lib/gating.ts` (pure, 7 tests): PASS_MARK 75; lesson N+1 needs lesson N passed; exam needs all lessons passed; module needs all prereq exams passed (real prereq graph — M5 requires M3 AND M4). Legacy score-less done records grandfather as passed
- DB v3: `examResults` store; lessonProgress gains bestScorePct (best-across-retakes, first completedAt kept; done never demotes). Backup v3 exports/merges exams (best-wins) and scores; round-trip + merge tests updated — 60 tests green
- Quiz flow: lesson summaries record score and show pass/fail vs 75% ("passed. The next lesson is open." / "below the 75% mark…"); module exam mode at `#/exam/<moduleId>` runs ALL module questions and records the result
- Home: per-module copper progress bars (always visible — the GRE-sim-style timeline element he asked about), locked lessons as dashed vias with "needs 75% on previous", exam row per module (locked/open/passed with best score), locked modules show exactly what opens them; hero action chain now start → review → module-exam → continue
- Route guard (`components/gated.tsx`): direct URLs to locked content get a plain "what unlocks this" page; storage-unavailable sessions stay open (can't gate what can't be tracked)
- The one animated gradient: a faint copper glow drifting behind the hero (16 s, transform-only, dies with reduced-motion)
- Charts answer for Christopher: run trend, streak calendar, and mastery bars already existed but are data-fed — module progress bars now give day-one visuals
- E2E verified in browser: fresh state shows locks everywhere; scoring 100% on lesson 1 → summary pass line → lesson 2 unlocked, module bar 1/5, hero "Continue: Why CPUs are fast"; locked-lesson deep link correctly blocked; screenshot clean
- NOT done this block (next): study-sync Worker wiring (username+PIN, cross-device) — reverses D-011, needs the private worker repo checked + auth UI; deliberately its own block

**In progress / half-finished:** nothing half-finished.
**Next session should start with:** the study-sync integration block (D-022 to log the D-011 reversal: reuse study-sync — the backup file already IS a lossless blob and client-side merge exists; check worker accepts app=metal; auth UI on Backup page; note Turnstile's external script as an online-only exception to offline-first).
**Open questions for Christopher:** none new — sync lands next block.
**New DECISIONS.md entries this session:** D-023 (ratified — his direction)

## Session 2026-07-19 (hotfix block — app stuck on Loading)

**Stage:** B | **Severity:** live app unusable for Christopher after the v3 deploy
**Root cause:** the D-023 block bumped IndexedDB to v3. A version upgrade BLOCKS indefinitely while any other context (older tab, installed PWA window, cached page) holds the previous version open — and the app renders nothing until storage settles. No blocked/blocking handlers, no timeout: infinite "Loading…" on every page. Found by Christopher, reproduced with a cross-tab v2 holder.
**Fix (three layers):**

- `blocking` handler in openProgressDb: an old-build tab now reloads itself when a newer version wants to upgrade — future migrations won't strand anyone
- `blocked` handler: loud console diagnosis naming the cause
- 4-second timeout in app.tsx: if storage stays blocked, the app renders anyway (browsing works, saving off) with a banner telling the user to close other Metal windows and reload
  **Verified:** cross-tab simulation — holder at v2 in tab A, app in tab B → banner after 4 s + fully rendered home. Normal path unaffected. 60 tests green.
  **Lesson recorded:** schema migrations on a multi-context PWA must always ship blocked/blocking handling; the daemon-based verification missed this because it tests a single fresh context.

## Session 2026-07-19 (twenty-first block — study-time streak calendar, D-024)

**Stage:** B — gamification at Christopher's direction; gradient banding fix.
**Done this session:**

- Study-time tracking: 15-second heartbeat in app.tsx credits time while a lesson/quiz/review/exam is open and the tab visible; per-(day, installId) rows in the new `studyTime` store (DB v4, backup v4, max-per-row idempotent merge). Honest approximation: ±one tick per sitting
- The 30-minute streak rule (`src/lib/study-time.ts`, pure + 7 tests): a day counts at ≥30 tracked minutes; pre-tracking days with attempts grandfather in; today has until midnight before it breaks the chain
- The streak calendar: full month view (Monday-first, day numbers in cells) — goal-met days filled copper, partial days copper-ringed, today outlined with a live X/30-min progress bar, per-cell minute tooltips, streak count in big copper mono. On Home's rail (always visible, even day one — the goal teaches itself) and on Progress; the old 8-week strip and attempt-based streakInfo removed (one definition of "streak" everywhere)
- Gradient removed after Christopher reported banding on his LCD (dark radial gradients band on 8-bit panels — recorded in D-024 so it doesn't come back). Replaced with a flat-stroke animated PCB-trace SVG (draws/retreats over 14 s; solid colors cannot band; freezes under reduced-motion)
- 63 tests green; verified in browser with seeded data: "4 day streak", "today 18/30 min", calendar states all correct, trace visible, no banner
- Bonus field-validation: the hotfix's degrade path fired for real during testing (a leftover test tab held an old DB version — banner + usable app, exactly as designed). One franken-DB artifact came from the test scaffold itself, not the product
  **In progress / half-finished:** nothing half-finished. Study-sync (username+PIN, D-022) remains the queued next block.
  **Next session should start with:** Christopher's reaction; then study-sync integration.
  **Open questions for Christopher:** none new
  **New DECISIONS.md entries this session:** D-024 (ratified — his direction)
