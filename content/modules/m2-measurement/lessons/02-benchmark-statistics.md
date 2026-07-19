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
distribution. Everything in lesson 01 (scheduler steals, throttling, cache
state) adds _only in one direction_: noise makes runs **slower**, never
faster. So timing distributions are **right-skewed** — a tight cluster of
fast runs and a straggling tail of slow ones.

That one fact drives all the advice here.

## Mean, median, minimum — three different questions

- **Mean**: total time ÷ runs. Dragged upward by every tail event, so it
  mixes "how fast is the code" with "how noisy was the machine today."
  Legitimate when total cost over many executions is the actual question
  (batch jobs, cloud bills).
- **Median**: the typical run. Robust to tail events — half the runs beat
  it regardless of how bad the stragglers were. The default headline number
  for the labs in this app.
- **Minimum**: the run with the least interference. For a pure CPU-bound
  microbenchmark, noise only slows runs down, so the minimum is the best
  estimate of the code's _intrinsic_ cost — this is why Python's `timeit`
  documentation recommends it. But for anything involving I/O, allocation,
  or real concurrency, the minimum is a fantasy case; don't headline it.

State which one you report and why. Changing the statistic changes the
conclusion, and readers can't audit what you don't disclose.

## Spread is part of the result

A median without spread hides whether the machine was steady. Report an
interval — interquartile range (IQR) is robust and simple: the span of the
middle 50% of runs. Lab L2.2 measures this laptop's noise floor as an IQR,
and every later lab quotes it: a "speedup" smaller than the noise floor is
not a finding, it's weather.

## How many runs?

Rules of thumb that hold up in the literature above: warm up first (lesson
01), then take **enough runs that the summary stabilizes** — for quiet
CPU-bound microbenchmarks, 10–30 measured runs usually do; noisy or long
benchmarks need more. The test is operational: rerun the whole experiment;
if your headline number moves by more than your reported spread, you didn't
take enough runs (or your machine isn't in a measurable state).

## Comparing A and B honestly

The cardinal sin: one run of A, one run of B, subtract, publish. With
overlapping distributions that comparison flips sign from day to day. The
honest procedure: interleave runs of A and B (drift hits both), compare
medians, and check the distributions actually separate — if their IQRs
overlap substantially, say "no measurable difference," which is a perfectly
good experimental result. When stakes are higher, use a proper interval
method (Kalibera & Jones give one); for these labs, non-overlapping IQRs
with interleaved runs is the bar.

## Outliers are data

A run 10× slower than the median is telling you something happened —
antivirus scan, thermal event, swap. Investigate or report it; deleting it
silently is how "clean" results get manufactured. The labs' harness will
flag outliers, not eat them.
