---
id: m7/01-shape-of-a-result
title: "The shape of a technical result — question, method, baseline, finding"
objectives:
  - "Name the four parts every empirical claim needs and say what each one rules out"
  - "Explain why a measurement without a baseline is not a result"
  - "Separate what was measured from what is being claimed, in someone else's writing"
sources:
  - "Blackburn et al., The Truth, The Whole Truth, and Nothing But the Truth: A Pragmatic Guide to Assessing Empirical Evaluations, ACM TOPLAS 2016"
  - "Hoefler & Belli, Scientific Benchmarking of Parallel Computing Systems, SC15"
  - "Simon Peyton Jones, How to Write a Great Research Paper (Microsoft Research, talk notes)"
---

## What this lesson answers

M2 taught you how to produce a trustworthy number. This module is about what
happens either side of that: deciding which number would settle a question, and
turning numbers into a claim somebody else can check.

That skill points in two directions and you will use the second far more often
than the first. Writing up your own work is occasional. Reading a paper, a
benchmark table or a blog post and deciding how much to believe it is
continuous, and it is the same skill.

## What are the four parts?

Every empirical claim, whether in a paper or a README, rests on four things.
Each one rules out a specific way of being wrong, which is why leaving one out
is not a stylistic lapse.

**The question.** What are you actually asking? "Is my code fast?" is not a
question, because no measurement can answer it. "Does replacing the Python loop
with a vectorized call reduce median step time on this laptop?" is, because you
can imagine the measurement that settles it.

**The method.** What did you run, on what, how many times, and how did you
summarize? M2 gave the contents of this part: warmup discarded and counted,
number of runs, the statistic chosen and why, the spread, and the machine's
state. A method section exists so a reader can decide whether to trust the
number, and so you can reproduce it in six months.

**The baseline.** What are you comparing against? This is the part most often
missing and the one that does the most work, so the next section is about it.

**The finding.** What the numbers say, stated no more strongly than they
support. This is where most honest work goes wrong, usually by describing a 3%
difference as an improvement when the noise floor was 5%.

## Why is a number without a baseline not a result?

Suppose you report that your inference server handles 800 requests per second.

Ask what that tells anyone. Is it good? Nothing in the sentence says. It could
be twice what the obvious implementation achieves, or a tenth. Both are
consistent with the number, so the number distinguishes nothing, and a
measurement that distinguishes nothing is not evidence.

A **baseline** is the alternative you are measuring against. It converts a
number into a comparison, and only comparisons carry information.

The choice of baseline is also where honest work quietly becomes dishonest, so
three rules are worth holding.

**The baseline must be the obvious thing done competently.** Comparing your
optimized version against code you deliberately wrote badly proves nothing
about your optimization. If the sensible default implementation is a NumPy call,
that is the baseline, not a Python loop.

**The baseline must run under identical conditions.** Same machine, same data,
same warmup, same number of runs, interleaved as M2/02 required. A baseline
measured last week on a cooler laptop is not a baseline.

**The baseline must be stated.** A reader who cannot see what you compared
against cannot evaluate the comparison, and "3× faster" with no stated
comparison is a marketing sentence rather than a result.

## Where does a claim outrun its evidence?

This is the gap to look for, in your writing and in everybody else's. The
measurement is usually fine. The sentence built on top of it is usually wider.

Consider a real shape. You measure that int8 quantization cuts median latency by
40% on one model, on one laptop, at batch size 1. All of that is honest.

Now watch the sentence grow. "Quantization cut latency by 40%" has dropped the
model, the machine and the batch size. "Quantization makes inference 40% faster"
now claims something about inference in general. "Quantization is the most
effective optimization for inference" was never measured at all, because nothing
else was tested.

Each step feels like a small tidy-up and each one adds scope the experiment did
not cover. The discipline is to write the claim and the measurement next to each
other, then check that every word in the claim corresponds to something you
varied.

The same reading works in reverse on a paper. Find the strongest sentence in the
abstract, then find the experiment that supports it. The distance between the
two is the thing you are assessing.

## What does this look like in practice?

A complete result reads roughly like this, and the shape matters more than the
wording:

> **Question:** does replacing the elementwise post-processing loop with a
> fused NumPy expression reduce median step time?
> **Method:** 30 interleaved runs of each version on the same laptop, plugged
> in and idle, 5 warmup runs discarded, median and interquartile range
> reported, `time.perf_counter()`.
> **Baseline:** the existing loop, unchanged, measured in the same session.
> **Finding:** median step time fell from 210 ms (IQR 205 to 218) to 154 ms
> (IQR 151 to 159), a 27% reduction. The intervals do not overlap.

Every number in that has something to compare against, and a reader can tell
what would have to be true for it to be wrong. Notice also what it does not
say: nothing about other machines, other data sizes, or other operations.

## Check your understanding

A blog post reports: "We rewrote our data loader and training got 2× faster."
There is no other detail.

Name the missing parts using this lesson's four-part structure, and say for each
one what could be hiding in the gap. A correct answer notes that the question is
unstated, so it is unclear whether the claim is about step time, epoch time or
time to a target accuracy; the method is absent, so the number of runs, the
warmup and the machine state are unknown and the 2× could be inside the noise;
the baseline is unstated, so the original loader may have been unusually poor
rather than the new one being good; and the finding generalizes to "training"
when only one model on one machine was presumably measured.
