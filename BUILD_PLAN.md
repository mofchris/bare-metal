# BUILD\_PLAN.md — "Metal" MLSys Learning Platform

**How this file works:** This is the single source of truth for the build. Every
stage below has (1) deliverables, (2) decisions that must be made, (3) tests that
must pass, and (4) an **APPROVAL GATE**. At each gate, Claude Code STOPS, presents
what the gate requires, and waits for me (Christopher) to write "APPROVED" plus the
date into the gate's sign-off line — or to write questions/changes, which get
resolved first. No work on a later stage may begin while an earlier gate is
unsigned. Every decision made anywhere gets a numbered entry in DECISIONS.md in
this format:

> **D-014** | Stage B | _Chose SQLite over JSON files for progress data._
> Options considered: JSON files (simple, but concurrent writes risk corruption),
> SQLite (atomic, queryable, single file). Tradeoff: slight complexity for
> reliability. My question to Christopher: none / \[question]. Status: ratified
> at Gate B.

If I ask "why did we do X?" at any point, the answer must exist in DECISIONS.md.
If it doesn't, that's a process failure — log it retroactively and flag it.

---

## MY SETUP (fill in before Stage 0)

- Laptop: HP OmniBook X Flip 14 — Intel Core Ultra 7, 16 GB RAM, no discrete
  GPU (integrated Intel Arc + NPU), Windows 11 Home
- Phone: iPhone XR (iOS Safari — PWA installs via "Add to Home Screen")
- Weekly study hours available: ~21 (3 hours/day)
- Internet/power reliability notes: \[to confirm with Christopher — assumed
  intermittent; offline-first design treats connectivity as optional anyway]

---

## STAGE 0 — Discovery & Design (no code)

**Deliverables:**

- My hardware specs and weekly study hours recorded at top of this file
- Proposed tech stack with a justification per choice _against my constraints_
  (local-first, modest laptop, mobile browser, offline)
- At least one rejected alternative per major stack choice, with reasons
  (so I learn the landscape, not just the answer)
- Architecture overview: components, how data flows, diagram in the README
- Data model draft: curriculum format, question bank format, progress schema
- Full curriculum outline: every module → lessons → labs, in dependency order,
  flagged as \[runnable on my hardware] or \[simulated]
- Risk list: top 5 things most likely to go wrong in this build and mitigation
  for each
- **Deployment architecture decision (pre-made, to be validated not reopened):**
  the app is a fully static, offline-capable web app deployed to **GitHub Pages**
  from this repo; progress data in IndexedDB with the one-file export/backup as
  the safety net against browser data loss; practical labs (Stage C) run
  **locally** via a lab-runner companion (scripts + harness in this same repo)
  that reports results back into the web app; simulators (Stage D) run fully
  in-browser. Cloudflare is out of scope for v1 — log it in DECISIONS.md as a
  considered-and-deferred option, with progress sync via a Worker noted as a
  possible Stage E+ enhancement. At Gate 0, Claude Code must confirm the chosen
  stack fits static hosting (no build step requiring a server at runtime) and
  explain to me how offline caching will work (service worker) so I understand it.

**Decisions to ratify:** stack, architecture, data formats, curriculum scope for
v1 vs later, deployment architecture as specified above

**Tests:** none (no code) — but I must be able to explain the architecture back
in my own words; Claude Code should quiz me briefly and correct misunderstandings

**⛔ GATE 0 sign-off:** APPROVED 2026-07-19 (Christopher). Note: the
explain-back quiz was not completed at sign-off — carried over as the first
item of the Stage A kickoff (see SESSION_LOG 2026-07-19). Internet/power note
in MY SETUP still \[to confirm].

---

## STAGE A — Walking Skeleton

**Deliverables:**

- App shell runs on laptop and phone browser: navigation, lesson renderer, quiz
  engine (MCQ + short answer), first foundations module fully authored (theory +
  quiz bank; labs follow the Stage C harness — amended at Gate A, see
  SESSION_LOG 2026-07-19), local data persistence working
- Deployed to GitHub Pages and loading on my phone from the live URL
- Installable to my phone's home screen (PWA) and fully functional offline after
  first load
- README v1 with setup instructions a stranger could follow; I do the setup
  myself following only the README
- DECISIONS.md live and current

**Tests that must pass before the gate:**

- Automated: quiz grading logic, persistence read/write, curriculum file parsing
  (malformed content fails loudly, not silently)
- Manual (me): complete one full lesson + quiz on laptop AND on phone; kill the
  app mid-quiz and confirm no data loss; disconnect internet and confirm
  everything works
- Performance: cold start ≤ 2s on my laptop, measured and recorded here:
  183 ms total load / 131 ms DOM interactive — preliminary (headless Chromium
  against localhost on the same laptop, 2026-07-19). Christopher's own
  measurement on the live URL: not taken.

**⛔ GATE A sign-off:** APPROVED 2026-07-19 (Christopher). ⚠ Signed WITHOUT
the manual tests this gate defines: no lesson+quiz completed on laptop or
phone by Christopher, PWA install on real iOS unverified, offline and
mid-quiz-kill tests done only in simulation (headless Chromium), cold start
not measured on the live URL. These are carried as open risk items — see
SESSION_LOG 2026-07-19 (tenth block). The Gate 0 explain-back quiz also
remains unanswered.

---

## STAGE B — Memory & Measurement

**Deliverables:**

- Progress dashboard: mastery per topic, score trends, streak calendar,
  weakest-areas panel linking to lessons
- Spaced repetition engine resurfacing missed questions on a decay schedule
- One-file export/backup and restore of all my data
- Weekly export reminder built into the app (browser storage can be wiped —
  the backup file is my insurance policy)

**Tests:**

- Automated: progress math, spaced-repetition scheduling (feed it fake history,
  verify resurfacing dates), export→wipe→restore round-trip is lossless
- Manual (me): a week of real daily use logged here before sign-off — the gate
  includes _me actually studying_, not just clicking around
- Performance: dashboard renders instantly with 1000+ simulated quiz records

**⛔ GATE B sign-off:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## STAGE C — Practical Labs

**Deliverables:**

- Lab harness framework: runs my code locally on my laptop, measures it,
  verifies targets (speed/accuracy), reports honestly, and feeds results back
  into the web app (result token or results file import)
- First 3 labs live (e.g., data-loader optimization, timing methodology,
  quantization exercise), each flagged runnable vs simulated
- Per-lab documentation of what the harness measures and its limitations

**Tests:**

- Automated: harness detects both passing and failing solutions correctly
  (test with deliberately bad solutions); measurement variance documented
- Manual (me): I complete lab 1 end-to-end and the measurements make sense to
  me — if I can't interpret the output, the lab fails the gate regardless of
  code correctness

**⛔ GATE C sign-off:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## STAGE D — Simulators

**Deliverables:**

- In-browser simulation scenarios for what my hardware can't run:
  batching/throughput-latency tuner, cache visualizer, distributed training
  scheduler (as scoped at Gate 0)
- Each simulator's cost model documented: what's based on real published
  behavior, what's simplified, what it does NOT teach

**Tests:**

- Automated: simulator outputs respond to parameter changes in the correct
  _direction and rough magnitude_ (e.g., bigger batch → higher throughput,
  higher latency)
- Manual (me): for each simulator, I write 3 sentences in DECISIONS.md on what
  it taught me — if I can't, the simulator is theater and gets reworked

**⛔ GATE D sign-off:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## STAGE E — Planner & Polish

**Deliverables:**

- Study planner (weekly hours in → schedule out, adapts to missed days,
  GRE/IELTS-aware)
- Full pass on mobile experience, performance profiling with results recorded,
  ARCHITECTURE.md finalized, README v2 with screenshots and the live GitHub
  Pages demo link at the top
- Portfolio readiness check: would an MLSys professor skimming this repo for
  90 seconds be impressed? List what they'd see and what's still weak.
- Considered-and-deferred list reviewed (incl. Cloudflare Worker progress sync)
  — promote or re-defer with reasons

**Tests:**

- Automated: full test suite green
- Manual: fresh-clone setup on a clean environment using only the README
- Final review: Claude Code quizzes ME on the architecture and 10 key
  decisions; my wrong answers become study items in the app itself

**⛔ GATE E sign-off:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## STANDING RULES for Claude Code across all stages

1. If a decision arises mid-stage that wasn't anticipated at the gate, don't
   silently choose: log it in DECISIONS.md with options, mark it "pending,"
   present it to me at the next natural pause (batch small ones; interrupt me
   immediately only for anything hard to reverse — data formats, stack changes,
   deleting things).
2. If reality diverges from this plan, propose an edit to this file — never
   quietly deviate from it.
3. Scope creep check at every gate: list any features added beyond the plan and
   any cut, with reasons, for my sign-off.
