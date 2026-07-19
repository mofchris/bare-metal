# RISKS.md — top 5 things most likely to go wrong (Stage 0)

Ordered by expected damage (likelihood × cost), not by how scary they sound.

## R1 — Browser wipes the progress data

iOS Safari evicts site data aggressively (storage pressure, and a 7-day
no-visit rule for non-installed sites); desktop browsers can be cleared by
accident or by "free up space" tools. Months of study history is the most
valuable thing this app will hold.
**Mitigation:** installed PWA on iOS (installed apps get more durable
storage); append-only history + one-file export/restore (Stage B); weekly
export reminder in-app; export tested with a real wipe→restore at Gate B.
**Residual risk:** data loss between exports — capped at one week.

## R2 — Content authoring is the real project, and it stalls

The code is weeks of work; a good curriculum (39 lessons, 23 labs) is months.
The likeliest failure mode of this whole build is a polished empty shell —
which is worthless both as a study tool and as a portfolio piece.
**Mitigation:** M1 authored completely in Stage A (proves the format and the
effort estimate with real data); curriculum work scheduled *inside* every
later stage rather than "at the end"; scope already cut once (D-010: M8–M10
deferred).
**Residual risk:** estimates still too optimistic → cut modules at gates, in
the open, via DECISIONS.md.

## R3 — Building forever instead of studying

Christopher's actual goal is learning MLSys by ~Fall 2027. Every hour on the
app is an hour not studying — the app must start paying rent early.
**Mitigation:** walking skeleton (Stage A) makes real studying possible within
weeks; Gate B *requires* a week of real daily study before sign-off; gates
block gold-plating by definition.
**Residual risk:** tinkering disguised as "polish" — the session log makes it
visible; call it out at gates.

## R4 — The curriculum teaches things that are wrong

AI-assisted authoring can produce confident nonsense; wrong latency numbers or
a wrong explanation of bf16 is worse than no lesson, because it gets memorized
via spaced repetition.
**Mitigation:** every lesson carries a `sources` list (enforced by the content
compiler — build fails without it); claims checked against those sources at
authoring time; quizzes at gates double as review passes; lab measurements
ground theory in observed reality on real hardware.
**Residual risk:** subtle errors survive review → correct-and-log via
DECISIONS.md when found; SRS resurfaces corrected questions.

## R5 — Measurement labs lie on this hardware

A thin laptop thermal-throttles, and Windows background processes add noise.
If lab numbers swing 40% run-to-run, the labs teach superstition instead of
methodology.
**Mitigation:** M2 (measurement methodology) comes before every numeric lab
and produces this machine's documented noise floor (L2.2); the harness reports
variance, not just medians, and refuses to "pass" results inside the noise
floor; each lab documents its limitations (`lab.yaml → limitations`).
**Residual risk:** some experiments stay too noisy on this machine → re-flag
them [simulated] honestly rather than shipping unstable numbers.
