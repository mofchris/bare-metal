# CLAUDE.md — How to work on this project

You are working on "Metal," a self-contained MLSys learning platform built by
and for Christopher — a Nigerian CS graduate self-studying Machine Learning
Systems ahead of a US MSc (Fall 2027). This repo is BOTH his daily study tool
AND a public portfolio piece that professors and admissions committees will
read. Every session, every commit, every line must respect that dual purpose.

## FIRST ACTIONS EVERY SESSION (in order, before writing any code)

1. Read `BUILD_PLAN.md` — find the current stage (first unsigned gate).
2. Read `SESSION_LOG.md` — the last entry says exactly where work stopped,
   what's in progress, and what's next.
3. Read the last ~10 entries of `DECISIONS.md` for recent context.
4. State back to Christopher in 3-5 lines: current stage, what was last done,
   what you plan to do this session. Wait for his go-ahead. If your reading of
   the state conflicts with what he says, trust him and update the files.

Never assume context from "memory" of previous conversations — the files are
the only source of truth. If the files are ambiguous or contradictory, stop
and ask rather than guess.

## LAST ACTIONS EVERY SESSION (non-negotiable)

Before the session ends (or when Christopher says he's stopping), append to
`SESSION_LOG.md`:

> ## Session YYYY-MM-DD
>
> **Stage:** [current stage] | **Gate status:** \[unsigned/signed]
> **Done this session:** \[bullet list, specific — files touched, features done]
> **In progress / half-finished:** \[exactly what state it's in, what would
> break if run now]
> **Next session should start with:** \[concrete first task]
> **Open questions for Christopher:** \[anything pending his decision]
> **New DECISIONS.md entries this session:** \[D-numbers]

A session that ends without a log entry is a failed session, no matter how
good the code was. Half-finished work MUST be flagged — never leave the repo
in a state where the next session (or another agent, or a human) can't tell
what's safe to build on.

## THE PROCESS CONTRACT

- `BUILD_PLAN.md` is binding. Its approval gates override any urge to keep
  building. Never start a later stage while an earlier gate is unsigned.
- Every non-trivial decision gets a numbered DECISIONS.md entry (format is
  defined in BUILD\_PLAN.md). Decisions Christopher hasn't ratified are marked
  "pending."
- Christopher is a participant, not a spectator: explain what you're doing as
  you do it, in plain language. When he asks why, the answer must reference or
  create a DECISIONS.md entry. Brief quizzes and explain-backs required at
  gates are part of the build, not optional extras.
- Never fabricate: no invented benchmarks, no fake test results, no
  placeholder content presented as real curriculum. If something is stubbed,
  it is loudly labeled STUB in code and in the session log.

## CODE STANDARDS — written for strangers (human or agent)

The test for every file: could a competent stranger (a professor skimming, a
future collaborator, a different AI agent) understand it without you in the
room?

- **Clarity over cleverness.** Boring, readable code beats smart, dense code.
  If a clever approach is genuinely warranted (performance-critical path),
  justify it in a comment and in DECISIONS.md.
- **Small units.** Short functions with one job, meaningful names (no
  abbreviations that only make sense mid-conversation), modules organized so
  the folder structure tells the story of the app.
- **Comments explain WHY, not what.** Assume the reader can read code; tell
  them the intent, the constraint, the tradeoff. Every non-obvious constant
  gets a comment (e.g., why 2s startup budget, why this decay schedule).
- **Each module gets a header comment**: what this module does, what depends
  on it, what it depends on.
- **Consistency everywhere**: one formatting style, one naming convention, one
  error-handling pattern, enforced by a formatter/linter configured in the
  repo (set up in Stage A, run before every commit).
- **Errors fail loudly and helpfully** — messages say what went wrong and what
  to check. Silent failures are bugs by definition.
- **No dead code, no commented-out blocks, no TODO without a D-number or
  session-log reference.**
- **Dependencies are liabilities**: every added dependency needs a DECISIONS.md
  entry (what it does, why not hand-roll, size/maintenance cost). Prefer few,
  boring, well-maintained libraries. The app must stay lightweight and
  offline-capable (see BUILD\_PLAN.md deployment decision).
- **Tests are documentation too**: test names describe behavior in plain
  language ("resurfaces missed question after decay interval", not "test\_sr\_1").

## GIT DISCIPLINE

- Small, frequent commits; each message says what and why in one line, plus
  the stage ("A: add quiz grading for short answers — needed before gate
  tests").
- Commit at every natural stopping point — the repo's history is part of the
  portfolio story (it shows how the project was actually built over months).
- Never commit broken states to main without a WIP flag in the message and a
  session-log note.

## TONE WITH CHRISTOPHER

Direct, concrete, no filler, no flattery. Explain tradeoffs honestly, give
real odds, never soften a true problem into a comfortable maybe. He is
learning MLSys through this build — treat every explanation as teaching, but
never patronize. English is the working language; keep it plain (no jargon
without a one-line definition the first time it appears).
