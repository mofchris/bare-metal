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

## What this lesson answers

Lesson 01 established that repeated runs disagree. This lesson decides what to
do with the disagreement: which single number to publish, what to publish
alongside it, and how to tell a real improvement from noise.

## Why is the shape of the results lopsided?

Run a benchmark 30 times and you hold 30 numbers. Together they form a
**distribution**, meaning the full set of results and how often each value
occurred. Picture the runs sorted into buckets by duration.

Now look at what lesson 01 listed. The scheduler taking your core, thermal
throttling, and a cold cache all make a run take longer. Nothing in that list
can make a run take less time than the work requires.

That asymmetry decides the shape. There is a hard floor, the time the work
actually takes with no interference, and most runs cluster just above it. There
is no ceiling, so unlucky runs trail off upward with no limit. The result is a
tight cluster on the left and a thin tail stretching right.

Statisticians call that shape **right-skewed**, because the tail points toward
the larger values. Every recommendation below follows from it.

## Which single number should you report?

Three summaries are defensible, and they answer different questions.

The **mean** is the ordinary average: add the runs and divide by how many. Its
weakness follows directly from the skew. One run that took ten times as long as
the others drags the mean upward, so the mean mixes "how fast is this code"
with "how disturbed was this machine". The mean is the right choice when total
cost across many executions is genuinely the question, as with a batch job's
total cloud bill.

The **median** is the middle value once the runs are sorted. It describes a
typical run. Its strength also follows from the skew: a catastrophic outlier
moves the middle by one position regardless of how catastrophic it was, so the
tail cannot distort it. This is the default headline number for measurements in
this curriculum.

The **minimum** is the fastest observed run, meaning the run with the least
interference. For a **microbenchmark**, meaning a small isolated piece of code
timed on its own, this is a reasonable estimate of the code's intrinsic cost,
because interference only ever adds time. Python's `timeit` documentation
recommends it for exactly this reason.

The minimum becomes misleading as soon as the work involves waiting on a disk,
a network, or memory allocation. Those waits are part of the real cost rather
than interference, so the luckiest run describes a situation that will never
repeat in production.

Whichever you choose, state which one you chose. Changing the summary changes
the conclusion, and a reader cannot audit a choice you did not disclose.

## Why is one number never enough?

A median on its own hides whether the machine was steady. Two benchmarks can
share a median while one was rock solid and the other swung wildly, and those
are different results.

Report an interval alongside it. The **interquartile range**, written IQR, is
the simplest robust choice. Sort the runs, cut them into four equal groups, and
the IQR is the span from the boundary at 25% to the boundary at 75%, covering
the middle half of the runs.

The IQR ignores both extremes by construction, which is what you want when the
extremes are the machine misbehaving rather than the code varying.

Measure your own machine's IQR on a benchmark that does nothing interesting,
and you have its noise floor. Any speedup smaller than that floor is not a
finding.

## How many runs are enough?

The rule that survives in the literature is to run until the summary stops
moving. For a quiet, CPU-bound microbenchmark, 10 to 30 measured runs usually
suffice. Noisy or long-running benchmarks need more.

That rule can be tested rather than assumed. Run the entire experiment a second
time. If your headline number moves by more than the spread you reported, then
you did not take enough runs, or the machine is not in a state where it can be
measured at all.

## How do you tell two results apart?

The common mistake is to run A once, run B once, subtract, and publish.

Here is why that fails. Each version produces a distribution, not a value. If
A's slower runs overlap B's faster runs, then which version "wins" depends
entirely on which sample you happened to catch, and the comparison changes sign
from day to day.

The honest procedure has three parts. Interleave the runs of A and B so drift
over time hits both. Compare medians rather than single runs. Then check
whether the distributions actually separate: if the IQRs overlap substantially,
report that there is no measurable difference.

That last outcome is a real experimental result, not a failure. "No measurable
difference on this machine" is more useful than a fabricated 3%.

## What should you do with an extreme run?

An **outlier** is a run far out of line with the rest, such as one taking ten
times the median.

An outlier is evidence that something happened: a virus scan started, the chip
hit a thermal limit, the operating system moved memory to disk. Investigate it,
or report it and say you could not explain it.

Deleting outliers silently is how clean-looking results get manufactured, and
it destroys the one signal telling you the machine was not in a measurable
state.

## Check your understanding

You benchmark two sorting implementations, 30 interleaved runs each. Version A
has a median of 100 ms and an IQR from 98 to 104 ms. Version B has a median of
97 ms and an IQR from 94 to 112 ms. Version B also has one run at 340 ms.

Say whether B is faster than A, justify it from the intervals, and say what to
do about the 340 ms run. A correct answer observes that the IQRs overlap
substantially, 98 to 104 against 94 to 112, so the 3 ms difference in medians
is inside the noise and the honest conclusion is no measurable difference; and
that the 340 ms run should be investigated and reported rather than deleted,
because it is evidence about the machine or about a worst case in B.
