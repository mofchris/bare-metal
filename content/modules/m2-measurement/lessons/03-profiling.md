---
id: m2/03-profiling
title: "Profiling: finding where the time actually goes"
objectives:
  - "Choose between sampling and instrumenting profilers for a given situation"
  - "Read a profile (or flame graph) and identify the optimization target"
  - "Apply Amdahl's law to cap the possible win before doing any work"
sources:
  - "Brendan Gregg, Systems Performance, 2nd ed., ch. 5–6 (profiling, flame graphs)"
  - "Python docs: cProfile (docs.python.org/3/library/profile.html); py-spy (github.com/benfred/py-spy)"
  - "Hennessy & Patterson, Computer Architecture, 6th ed., ch. 1 (Amdahl's law)"
---

## Timing says how much; profiling says where

A benchmark answers "is it slow?" A **profile** answers "which part?" — and
the answer is reliably humiliating. Decades of engineering folklore agree:
intuition about where time goes is wrong more often than right, which is why
the rule is _measure before optimizing_. The bottleneck in lab L2.3 will not
be where it looks. That's by design.

## Two ways to profile, one tradeoff

**Instrumenting profilers** (Python's `cProfile`) hook every function call
and count everything exactly. Complete data — but the hooks themselves cost
time, sometimes multiplying runtime several-fold and _distorting the very
distribution of time you're measuring_: cheap functions called millions of
times look artificially expensive because the hook fires per call.

**Sampling profilers** (`py-spy`, Linux `perf`) interrupt the program a few
hundred times a second and record the call stack. Statistical, near-zero
overhead, safe on live systems — but rare, fast events fall between samples.

The tradeoff is exactness vs distortion. Practical rule: **start with
sampling** to find where time goes at honest proportions; reach for
instrumentation when you need exact call counts and can tolerate skew.

## Reading a profile

Two numbers matter per function: **self time** (spent in its own code) and
**cumulative time** (self + everything it calls). High cumulative + low self
= an orchestrator; the target is below it. High self = the target itself.
**Flame graphs** (Gregg) draw this: stacks stacked vertically, width ∝ time
— you read them by looking for wide plateaus, which are the places worth
attacking. Wide and flat at the top of a tower = hot leaf code.

## Amdahl's law: the cap on your winnings

If a component takes fraction _p_ of runtime and you speed it up by factor
_s_, overall speedup = 1 / ((1 − p) + p/s). The brutal corollary: a part
that's 5% of runtime caps your total win at ~1.05× **even if you make it
infinitely fast**. Profile first precisely to learn _p_ — it tells you what
an optimization is worth before you spend a week on it, and it's the same
law that will cap multi-GPU scaling in M9.

## Profile the real thing

A profile of a toy input is a profile of a different program: small inputs
fit in cache (M1!), skip slow paths, and hide allocation churn. Profile the
realistic workload, or state loudly that you didn't. And close the loop:
after optimizing, re-profile — the bottleneck _moves_, and yesterday's 40%
plateau being gone is what "done" looks like.
