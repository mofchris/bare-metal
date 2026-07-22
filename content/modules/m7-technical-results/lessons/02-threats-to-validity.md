---
id: m7/02-threats-to-validity
title: "Threats to validity — what makes a comparison believable"
objectives:
  - "Distinguish internal, external and construct validity, and give a systems example of each"
  - "Identify the confound in a comparison that changed more than one thing"
  - "Explain why a result from one machine and one workload is a narrower claim than it looks"
sources:
  - "Blackburn et al., The Truth, The Whole Truth, and Nothing But the Truth, ACM TOPLAS 2016"
  - "Mytkowicz, Diwan, Hauswirth & Sweeney, Producing Wrong Data Without Doing Anything Obviously Wrong!, ASPLOS 2009"
  - "Cockburn, Dragicevic, Besançon & Gutwin, Threats of a Replication Crisis in Empirical Computer Science, CACM 2020"
---

## What this lesson answers

Lesson 01 gave a result its four parts. This lesson asks the harder question:
given a well-formed result, what could still make it wrong?

There are three distinct failures, they are independent, and a result can be
impeccable on two while failing the third. Naming them separately is what lets
you find the one that applies instead of vaguely distrusting everything.

## Did the change actually cause the effect?

**Internal validity** asks whether the difference you measured was produced by
the thing you changed.

It fails when something else changed too. The name for that something else is a
**confound**: a second difference between your two conditions that could
explain the result on its own.

Confounds are usually mundane. You rewrote the data loader and also bumped the
batch size. You benchmarked the new version after lunch when the laptop had
cooled. You compared a warm run against a cold one. In each case the number is
real and the attribution is wrong.

M2 already supplied most of the defence. Interleaving runs handles drift over
time. Warmup handles cold state. Reporting spread stops you attributing a
difference smaller than the noise floor.

The remaining defence is discipline about scope: change one thing, measure,
change the next. When two changes must land together, say so, and stop claiming
you know which one did the work.

## Does the result hold anywhere else?

**External validity** asks how far a finding travels beyond the conditions you
tested.

This is where systems results are weakest, and the reason is structural rather
than careless. A measurement is taken on one machine, with one dataset, at one
size, on one software version. Every one of those is a dimension along which the
result might not generalize, and testing all of them is not affordable.

Two examples show how sharply it can bite.

A kernel that is memory-bound on your laptop may be compute-bound on a GPU,
because M1/05 showed the ridge point moves from 4 to 25 FLOPs per byte. The same
code, the same correct measurement, the opposite conclusion about what to
optimize.

An optimization that helps at batch size 1 may do nothing at batch size 64,
because the fixed per-step costs it removed were being amortized anyway (M5/03).

The response is not to test everything. It is to state the conditions in the
claim, so that a reader knows the boundary rather than guessing it. "On this
laptop, at batch size 1, for this model" is a smaller claim than "in general",
and it has the advantage of being true.

## Are you measuring what you think you are measuring?

**Construct validity** asks whether your metric represents the thing you care
about.

This one is the subtlest, because the measurement can be flawless while
answering a question nobody asked.

You care about user experience and you measure mean latency, but M2/04 showed
users experience the tail, so p99 was the construct and the mean was not. You
care about training cost and you measure step time, but a change that halves
step time while doubling steps-to-accuracy has made things worse (M5/03). You
care about model quality and you measure accuracy on a test set that overlaps
your training data, so you are measuring memorization.

The check is a sentence: say out loud what you want to know, then say what you
measured, and see whether the second implies the first. When it does not, no
amount of statistical care rescues it.

## Why is one machine a narrower result than it looks?

Recall the ASPLOS 2009 finding from M2/01: benchmark results changed measurably
because of link order and the size of the environment variables, since those
shift stack addresses and therefore cache behaviour.

Follow what that implies for validity. A single machine in a single
configuration is one sample from a large space of possible setups. If a result
can move because of an environment variable, then a result measured in exactly
one environment is a claim about that environment.

This does not mean single-machine results are worthless. Most of what you will
do is single-machine, and it is genuinely informative. It means the honest form
of the claim names the machine, and that a difference of a few percent between
two setups deserves less confidence than a difference of two times.

There is also a practical asymmetry worth knowing. Large effects survive
changes of setup; small ones frequently do not. A 40% improvement measured
carefully on one laptop will probably still be an improvement elsewhere. A 3%
improvement may not survive a different compiler version.

## How do you write this down?

A threats-to-validity paragraph is not an apology and it is not optional
padding. It tells the reader where the result stops, which is information they
cannot get anywhere else.

It answers three questions in a few sentences. What else changed that might
explain this (internal)? What conditions was this measured under, and which of
them do I expect to matter (external)? Does my metric actually stand for the
thing I claim to care about (construct)?

Writing it has a side effect worth the trouble: it is the fastest way to find
out that your own experiment does not support your own conclusion, while there
is still time to fix the experiment.

## Check your understanding

A team reports that their new serving stack improved throughput by 35%. Reading
the details: the new stack ran on a machine with more RAM, the benchmark client
sent a request and waited for the reply before sending the next, and throughput
was measured as requests completed per second with no latency figure.

Name one threat of each kind. A correct answer identifies an internal threat in
the different machine, which is a confound that could explain the gain by
itself; an external threat in that the result is tied to one hardware
configuration and one workload, so it may not hold elsewhere; and a construct
threat in the closed-loop client, which causes coordinated omission (M2/04) so
the throughput figure is not measuring sustained throughput under real arrival
patterns, compounded by reporting throughput with no latency to pair it with.
