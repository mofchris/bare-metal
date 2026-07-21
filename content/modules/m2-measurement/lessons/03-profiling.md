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

A benchmark answers "is it slow?" A **profile** answers "which part?" — a
breakdown of your program's runtime attributed to the individual functions
that consumed it. The answer is reliably humiliating. Decades of engineering
folklore agree: intuition about where time goes is wrong more often than
right, which is why the rule is _measure before optimizing_. The bottleneck in
lab L2.3 will not be where it looks. That's by design.

## Two ways to profile, one tradeoff

**Instrumenting profilers** (Python's `cProfile`) attach a hook to every
function call — a small piece of bookkeeping code that runs on entry and exit
— and count everything exactly. Complete data, but the hooks themselves cost
time, sometimes multiplying runtime several-fold and _distorting the very
distribution of time you're measuring_: a cheap function called millions of
times looks artificially expensive, because it pays the hook cost on every
single call while an expensive function pays it once.

**Sampling profilers** (`py-spy`, Linux `perf`) take a different approach:
interrupt the program a few hundred times a second and write down the **call
stack** — the chain of "main called train, which called forward, which called
matmul" that says where execution currently is. Do that thousands of times and
the proportion of samples landing in each function estimates the proportion of
time spent there. Statistical rather than exact, near-zero overhead, safe to
run against a live production system — but rare, fast events can fall between
samples and go unseen.

The tradeoff is exactness vs distortion. Practical rule: **start with
sampling** to find where time goes at honest proportions; reach for
instrumentation when you need exact call counts and can tolerate the skew.

## Reading a profile

Two numbers matter per function. **Self time** is time spent executing that
function's own code. **Cumulative time** is self time plus everything it
called. High cumulative + low self = an orchestrator, a function that mostly
delegates — the real target is somewhere below it. High self = you've found
the target itself.

**Flame graphs** (Gregg) draw this: each box is a function, boxes sit on top
of whatever called them, and a box's width is proportional to time. You read
them by scanning for wide plateaus, because width is time and width is the
only thing worth attacking. Wide and flat at the top of a tower means hot leaf
code — a function burning time in its own body rather than in its callees.

## Amdahl's law: the cap on your winnings

If a component takes fraction _p_ of runtime and you speed it up by factor
_s_, overall speedup = 1 / ((1 − p) + p/s). The brutal corollary: a part
that's 5% of runtime caps your total win at ~1.05× **even if you make it
infinitely fast** — the other 95% still has to run. Profile first precisely to
learn _p_; it tells you what an optimization is worth before you spend a week
on it, and it's the same law that will cap multi-GPU scaling in M9.

## Profile the real thing

A profile of a toy input is a profile of a different program: small inputs fit
in cache (M1!), skip slow paths, and hide memory-allocation churn — the
repeated cost of requesting and releasing memory that only shows up at real
sizes. Profile the realistic workload, or state loudly that you didn't. And
close the loop: after optimizing, re-profile — the bottleneck _moves_, and
yesterday's 40% plateau being gone is what "done" looks like.
