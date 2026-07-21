---
id: m3/04-failure-modes
title: "Numerical failure modes — and how training survives them"
objectives:
  - "Recognize overflow, underflow, absorption, and catastrophic cancellation from symptoms"
  - "Explain why floating-point addition is not associative and what that does to parallel sums"
  - "Explain loss scaling: the problem it solves and the mechanism"
sources:
  - "Goldberg, What Every Computer Scientist Should Know About Floating-Point Arithmetic, ACM Computing Surveys 1991"
  - "Micikevicius et al., Mixed Precision Training, ICLR 2018"
  - "Higham, Accuracy and Stability of Numerical Algorithms, 2nd ed., ch. 1–4"
---

## The rogues' gallery

Four ways float arithmetic goes wrong, each with a distinct signature:

- **Overflow**: the result exceeds the format's maximum → **±inf**, and inf
  contaminates everything downstream (inf − inf = NaN). In fp16 this starts at
  65504 — one activation spike away.
- **Underflow**: the result is smaller than the smallest representable value →
  flushed toward **0**. Silent: no error is raised, the information is simply
  gone. Small fp16 gradients die this way, and the weights they belonged to
  simply stop learning.
- **Absorption**: adding a small number to a large one discards the small one
  entirely (1.0 + 1e−9 = 1.0 in fp32 — lesson 01's spacing at work, since 1e−9
  is far below machine epsilon). A long sum of small terms into a large running
  total can lose _most of its inputs_, one by one, each vanishing on arrival.
- **Catastrophic cancellation**: subtracting two nearly equal numbers. Their
  leading digits — the ones known accurately — cancel to zero, which promotes
  whatever rounding noise was hiding in the trailing digits to the front of the
  result. You're left with a small number made almost entirely of error.
  Computing variance as E[x²] − E[x]² is the classic own-goal: for data with a
  large mean, those two quantities are nearly equal and their difference is
  mostly garbage. Lab L3.1 has you detonate it deliberately.

## Addition is not associative

In ordinary maths, (a + b) + c = a + (b + c) — that property is called
**associativity**, and it means grouping doesn't matter. In floats it fails,
because each grouping rounds at different moments and therefore rounds
differently.

The consequence has real teeth. Summing a large array in parallel means
splitting it across cores, summing the pieces separately, then combining — an
operation called a **reduction**. That produces a different grouping than a
single serial loop, so the "same" computation on a different core count (or a
different GPU) legitimately produces different bits. Run-to-run
non-determinism in training loss is often exactly this, not a bug.

The mitigations: ordering discipline (fix the reduction structure so it's the
same every run, when reproducibility matters), wider accumulators (the
standing theme of this module), or compensated algorithms like **Kahan
summation**, which keeps a second variable tracking the error that each
addition threw away and feeds it back into the next one.

## Symptoms at training scale

A loss curve that goes **NaN** is an overflow or cancellation event somewhere
upstream — by the time NaN reaches the loss it has already flowed through the
model, so the visible symptom is far from the cause. A loss that quietly
plateaus while small gradients underflow is subtler and nastier: nothing
_looks_ broken at all.

Debug numerically: check for infs and NaNs at layer boundaries to find where
they first appear, watch the distribution of gradient magnitudes across
training (a **gradient-norm histogram** — how many gradients are large,
middling, or nearly zero), and suspect the narrowest format in the pipeline
first.

## Loss scaling: the fp16 survival trick

The fp16 problem from lesson 02, now with its solution. Small gradients
underflow fp16's floor (~6×10⁻⁵ for normal values).

**Loss scaling** multiplies the _loss_ by a factor S (say 2¹⁰ = 1024) before
the backward pass. Because differentiation is linear — scaling the thing you
differentiate scales all its derivatives by the same factor — every gradient
then arrives multiplied by S, lifted bodily out of the underflow zone. The
gradients are divided by S again (in fp32) before the weights are updated.
Nothing about the mathematics changes; the values just travel through the
dangerous stretch of the pipeline at a survivable magnitude.

Dynamic loss scaling automates the tuning: grow S until infs start appearing,
throw away that step and shrink S, repeat. That machinery — checking every
single step for infs — is why fp16 training feels fragile, and why bf16's
"just have fp32's range" won (lesson 02).

## The module's one-paragraph residue

Floats are scientific notation with fixed bits: range from the exponent,
precision from the mantissa (L01). Sixteen-bit formats split those budgets
differently, and training chose range — bf16 (L02). Below that, integers
plus a measured scale beat floating point at its own game (L03). And all of
it fails in four characteristic ways, tamed by the same two habits:
**accumulate wider than you store**, and **assume every equality and every
sum ordering is approximate** (L04). With M1's hardware picture, M2's
measurement discipline, and M3's numerics, you now hold the complete toolkit
the hands-on modules spend.
