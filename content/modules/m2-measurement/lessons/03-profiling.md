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

## What this lesson answers

A benchmark tells you that a program takes 4 seconds. It does not tell you
which part of the program spent them.

A **profile** answers that second question. It is a breakdown of runtime
attributed to the individual functions that consumed it. This lesson covers how
profiles are produced, how to read one, and how to work out whether an
optimization is worth attempting before you attempt it.

## Why not just guess where the time goes?

Because guesses are wrong often enough that the whole discipline exists.

The reason is structural rather than a failure of intelligence. Cost in a
program is concentrated in whatever runs most often, and a line's cost is the
product of how expensive it is and how many times it runs. Programmers read
code and estimate the first factor while having poor intuition about the
second, because loop counts and call frequencies are not visible in the text.

The result is a standing rule: measure before optimizing, every time.

## How do the two kinds of profiler work?

**Instrumenting profilers**, such as Python's `cProfile`, attach a hook to
every function call. A hook is a small piece of bookkeeping code that runs on
entry and on exit, recording the time.

That produces exact call counts, and it produces a specific distortion. A
function costing 50 nanoseconds that is called ten million times pays the hook
cost ten million times, while a function costing 2 seconds pays it once. Cheap
frequently-called functions therefore look far more expensive than they are,
and total runtime can multiply several-fold.

**Sampling profilers**, such as `py-spy` or Linux `perf`, do the opposite. They
interrupt the program a few hundred times per second and record the **call
stack**, meaning the chain of "main called train, which called forward, which
called matmul" that says where execution currently sits.

The reasoning behind sampling is statistical. If a function occupies 30% of
runtime, then roughly 30% of randomly-timed interrupts land inside it. Collect
thousands of samples and the proportions estimate the time distribution, with
overhead near zero because nothing is added to the program itself.

The trade is exactness against distortion. Start with sampling, because it
gives honest proportions and can run against a live system. Reach for
instrumentation when you specifically need exact call counts and can tolerate
the skew.

## How do you read a profile?

Two numbers per function matter, and confusing them wastes days.

**Self time** is time spent executing that function's own code. **Cumulative
time** is self time plus all the time spent inside functions it called.

Combine them to classify a function. High cumulative with low self means the
function mostly delegates, so it is an orchestrator and the real target is
somewhere beneath it. High self means the function is doing the work itself,
so it is the target.

A **flame graph** displays this. Each function is a box, each box sits on top
of the function that called it, and a box's width is proportional to the time
spent in it.

Reading one is therefore a search for width, not for height. A tall narrow
tower is a deep call chain that costs little. A wide box is expensive, and a
wide box at the top of a tower is expensive code doing its own work, which is
the best target available.

## How much is an optimization worth before you start?

Amdahl's law answers this. If a component takes fraction _p_ of total runtime,
and you speed that component up by a factor _s_, then:

> overall speedup = 1 / ((1 − p) + p/s)

Work through the consequence, because it is brutal and it saves weeks. Suppose
a function is 5% of runtime, so p = 0.05, and you make it infinitely fast, so
p/s becomes 0. The formula gives 1 / 0.95 ≈ **1.05**. Deleting that function
entirely buys 5%.

Now suppose a function is 70% of runtime and you make it twice as fast. That is
1 / (0.30 + 0.35) = 1 / 0.65 ≈ **1.54**, a 54% improvement from a far less
heroic change.

This is the practical use of a profile. It gives you _p_, which converts "this
code is ugly and I want to fix it" into a number telling you what fixing it is
worth.

## What makes a profile misleading?

Profiling a toy input profiles a different program. Small inputs fit entirely
in cache, which hides every memory effect from M1. They skip slow paths that
only trigger at scale. They avoid repeatedly requesting and releasing memory,
which is a real cost at production sizes.

Profile a realistic workload, or state plainly that you did not.

Then close the loop. After an optimization lands, profile again. The bottleneck
moves, because removing the largest cost promotes whatever was second. A
finished optimization is one where the plateau you attacked is gone from the
new profile.

## Check your understanding

A profile of a 60-second training job shows: `data_loading` at 38 seconds
cumulative and 2 seconds self, `jpeg_decode` at 34 seconds self, and
`optimizer_step` at 5 seconds self.

Say which function to attack and why, and compute the best possible whole-job
speedup if you made that function three times faster. A correct answer picks
`jpeg_decode`, because `data_loading` has high cumulative but low self time and
is therefore an orchestrator whose cost is really its callee; then computes
p = 34/60 ≈ 0.57 and s = 3, giving 1 / (0.43 + 0.19) = 1 / 0.62 ≈ **1.6×**.
