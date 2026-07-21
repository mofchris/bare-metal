---
id: m2/02-benchmark-statistics
title: "Statistics for benchmarks"
objectives:
  - "Choose between mean, median, and minimum for a given benchmark, with a reason"
  - "Explain why timing distributions are right-skewed and what that does to the mean"
  - "Decide whether two benchmark results actually differ, beyond eyeballing two numbers"
sources:
  - "Georges, Buytaert & Eeckhout, Statistically Rigorous Java Performance Evaluation, OOPSLA 2007"
  - "Kalibera & Jones, Rigorous Benchmarking in Reasonable Time, ISMM 2013"
  - "Hoefler & Belli, Scientific Benchmarking of Parallel Computing Systems, SC15"
---

## A benchmark result is a distribution

Run a benchmark 30 times and you don't have a number — you have a
**distribution**: the full set of results and how often each value showed up.
Picture the runs sorted into buckets by duration, forming a shape.

Everything in lesson 01 (the OS taking your core, throttling, cache state)
adds _only in one direction_: noise makes runs **slower**, never faster.
Nothing in the universe makes your code finish before it's done. So the shape
is lopsided — a tight cluster of fast runs bunched against a hard floor, with
a straggling tail of slow ones trailing off to the right. Statisticians call
that **right-skewed** (the tail points toward the larger values).

That one fact drives all the advice here.

## Mean, median, minimum — three different questions

- **Mean** (the ordinary average): total time ÷ runs. Every straggler drags it
  upward, so it mixes "how fast is the code" with "how noisy was the machine
  today." Legitimate when total cost over many executions is the actual
  question (batch jobs, cloud bills).
- **Median**: sort the runs and take the middle one. That makes it the typical
  run, and robust to tail events — half the runs beat it regardless of how bad
  the stragglers were, because one catastrophic run only moves the middle by
  one position. The default headline number for the labs in this app.
- **Minimum**: the run with the least interference. For a pure CPU-bound
  microbenchmark — a tiny, isolated piece of code timed on its own — noise
  only slows runs down, so the fastest observed run is the best estimate of
  the code's _intrinsic_ cost. This is why Python's `timeit` documentation
  recommends it. But for anything involving disk or network waits, memory
  allocation, or real concurrency, the minimum is a fantasy case that will
  never repeat in production; don't headline it.

State which one you report and why. Changing the statistic changes the
conclusion, and readers can't audit what you don't disclose.

## Spread is part of the result

A median without spread hides whether the machine was steady. Report an
interval — the **interquartile range** (IQR) is robust and simple. Sort your
runs and chop them into four equal groups; the IQR is the span covering the
middle 50%, from the boundary at 25% to the boundary at 75%. It ignores the
extremes at both ends by construction, which is exactly what you want when the
extremes are the machine misbehaving.

Lab L2.2 measures this laptop's noise floor as an IQR, and every later lab
quotes it: a "speedup" smaller than the noise floor is not a finding, it's
weather.

## How many runs?

Rules of thumb that hold up in the literature above: warm up first (lesson
01), then take **enough runs that the summary stabilizes** — for quiet
CPU-bound microbenchmarks, 10–30 measured runs usually do; noisy or long
benchmarks need more. The test is operational: rerun the whole experiment;
if your headline number moves by more than your reported spread, you didn't
take enough runs (or your machine isn't in a measurable state).

## Comparing A and B honestly

The cardinal sin: one run of A, one run of B, subtract, publish. When the two
distributions overlap — when A's slow runs land in the same range as B's fast
ones — that comparison flips sign from day to day depending on which sample
you happened to catch.

The honest procedure: interleave runs of A and B (so drift over time hits
both), compare medians, and check the distributions actually separate — if
their IQRs overlap substantially, say "no measurable difference," which is a
perfectly good experimental result. When stakes are higher, use a proper
interval method (Kalibera & Jones give one); for these labs, non-overlapping
IQRs with interleaved runs is the bar.

## Outliers are data

An **outlier** — a run wildly out of line with the rest, say 10× slower than
the median — is telling you something happened: antivirus scan, thermal event,
the OS swapping memory out to disk. Investigate it or report it; deleting it
silently is how "clean" results get manufactured. The labs' harness will flag
outliers, not eat them.
