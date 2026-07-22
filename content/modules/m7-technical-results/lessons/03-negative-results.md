---
id: m7/03-negative-results
title: "Negative results and limitations — why stating them strengthens a claim"
objectives:
  - "Explain what publication bias is and how it distorts what a field appears to know"
  - "Report a failed experiment in a form that is useful rather than apologetic"
  - "Explain why a stated limitation makes the surrounding claim more credible, not less"
sources:
  - "Cockburn, Dragicevic, Besançon & Gutwin, Threats of a Replication Crisis in Empirical Computer Science, CACM 2020"
  - "Blackburn et al., The Truth, The Whole Truth, and Nothing But the Truth, ACM TOPLAS 2016"
  - "Hoefler & Belli, Scientific Benchmarking of Parallel Computing Systems, SC15"
---

## What this lesson answers

Most experiments fail. An optimization does nothing, a technique that worked in
a paper does not work on your workload, a change makes things slower.

The instinct is to delete those and report what worked. This lesson argues that
the instinct is wrong on two counts: it damages the field, and it damages the
credibility of the successes you do report. Then it covers how to write a
failure down so it is worth reading.

## What happens when only successes get reported?

If everyone reports what worked and quietly discards what did not, the published
record stops representing reality. That distortion has a name: **publication
bias**.

Work through the mechanism, because the size of the effect is surprising.

Suppose twenty groups independently try the same optimization and it genuinely
does nothing. Measurement noise means results scatter, so a few of those groups
will see an apparent improvement by chance. If only apparent improvements get
written up, the literature now contains several papers reporting that the
optimization works, and none reporting that it does not.

A reader doing their homework finds consistent positive evidence. The evidence
is consistent because the negatives were filtered out, not because the effect is
real.

The practical consequence for you is a reading habit rather than a crisis. When
a technique is widely reported to help and does nothing on your workload, the
first hypothesis should not be that you made a mistake. It may be that your
workload is one of the cases where it does not help, and those cases are
systematically less visible.

## Why does admitting a failure make you more believable?

This is counterintuitive and worth being precise about, because it is not a
matter of tone or humility.

A report containing only successes gives a reader no way to tell two situations
apart: an author who tried five things and found one that worked, and an author
who tried one thing that worked. Those imply very different levels of
confidence, and the write-up hides which one happened.

Reporting the failures resolves it. "I tried four changes; three did nothing
measurable and this one produced a 27% reduction" tells the reader you were
capable of detecting a null result, and that the reported effect survived
against alternatives. That is much stronger evidence than the same 27% with the
other three deleted.

There is a second effect, which matters for anyone reading your work with a
professional eye. Someone assessing an engineer is assessing judgment, not just
outcomes. A candidate who can say "this seemed promising, here is why it failed,
here is what I concluded" is demonstrating exactly the reasoning that is hard to
find. A page of unbroken successes demonstrates that they know how to present.

## How do you write a failure so it is useful?

An apologetic failure is worthless. A useful one has four parts, and they map
onto lesson 01's structure.

**What you expected, and why.** The reasoning that made the change look
promising. This is the part that carries the transferable content: your model of
the system was wrong somewhere, and the reader wants to know where.

**What you did.** The same method discipline as any other result. A failure
measured badly is not a finding, it is an absence of information.

**What happened.** The numbers, with their spread. In particular, distinguish
two very different failures: the change made things worse, or the change did
nothing detectable. "No measurable difference, with the intervals overlapping"
is a real result (M2/02), not a failed one.

**What you concluded.** Which explanation you now favour, and what would test
it. This is what turns an anecdote into something a reader can build on.

Here is the shape, compressed:

> Prefetching more aggressively should have hidden the remaining data stalls,
> since M4/02 says buffering absorbs spikes in preparation time. Raising
> `prefetch_factor` from 2 to 8 changed median step time from 118 ms
> (IQR 116 to 124) to 119 ms (IQR 116 to 125), so no measurable difference.
> The synthetic-data experiment (M4/04) then showed the job was compute-bound,
> so there were no stalls left to hide. The buffer was never the constraint.

That paragraph is more useful than a paragraph reporting a win, because it
teaches a reader when not to reach for the technique.

## What belongs in a limitations section?

A limitation is a boundary on the claim, and lesson 02 already produced the
list: the conditions you did not vary, the confounds you could not remove, and
the gap between your metric and the thing you care about.

Two rules keep it honest.

**State limitations you actually believe matter.** A list of every conceivable
caveat is a way of hiding the important one in noise. If the result is tied to
one machine and you expect that to matter, say that, plainly and first.

**Do not use a limitations section to smuggle in a stronger claim.** "This was
only tested on one machine, but it would obviously generalize" has asserted
generalization without evidence while appearing to be modest about it. Say what
you tested. If you have a reason to expect it generalizes, give the reason and
mark it as expectation rather than result.

## Check your understanding

You spend two days implementing gradient checkpointing on a model, expecting the
memory saving M5/04 describes. Memory falls by only 8% and training time rises
by 31%. You discover afterwards that activations were a small part of this
model's memory because the model is large and the batch is tiny.

Write this as a useful negative result rather than deleting it. A correct answer
states the expectation and its reasoning, that checkpointing trades roughly 30%
more compute for a large cut in activation memory; the method and the measured
numbers with spread; the outcome, that the compute cost appeared in full at 31%
while the memory saving did not, at 8%; and the conclusion, that activations
were not the dominant line item here because batch size was small, so the
technique was aimed at the wrong item on M5/02's bill. It should also note the
transferable lesson: itemize memory before choosing a memory technique.
