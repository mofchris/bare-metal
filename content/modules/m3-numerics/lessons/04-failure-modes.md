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

- **Overflow**: result exceeds the format's max → **±inf**, and inf
  contaminates everything downstream (inf − inf = NaN). In fp16 this starts
  at 65504 — an activation spike away.
- **Underflow**: result smaller than the smallest representable → flushed
  toward **0**. Silent — no error, just information gone. Small fp16
  gradients die this way, and those weights simply stop learning.
- **Absorption**: adding small to large discards the small (1.0 + 1e−9 =
  1.0 in fp32, lesson 01's spacing at work). A long sum of small terms into
  a large accumulator can lose _most of its inputs_ one by one.
- **Catastrophic cancellation**: subtracting nearly equal numbers. The
  leading digits — the accurately known ones — cancel to zero, promoting
  old rounding noise to the front of the result. Computing variance as
  E[x²] − E[x]² is the classic own-goal; lab L3.1 has you detonate it
  deliberately.

## Addition is not associative

(a + b) + c ≠ a + (b + c) in floats — each ordering rounds differently.
Consequence with real teeth: **parallel reductions sum in different orders
than serial ones**, so the "same" computation on a different core count (or
a different GPU) legitimately produces different bits. Run-to-run
non-determinism in training loss is often exactly this, not a bug. The
mitigations are ordering discipline (fixed reduction trees when
reproducibility matters), wider accumulators (the standing theme), or
compensated algorithms like Kahan summation that carry the lost bits in a
side variable.

## Symptoms at training scale

A loss curve that goes **NaN** is an overflow/cancellation event upstream —
by the time NaN reaches the loss, it has flowed through the graph. A loss
that quietly plateaus while small gradients underflow is subtler and nastier
— nothing _looks_ broken. Debug numerically: check for infs/NaNs at layer
boundaries, watch gradient-norm histograms, and suspect the narrowest format
in the pipeline first.

## Loss scaling: the fp16 survival trick

The fp16 problem from lesson 02, now with its solution. Small gradients
underflow fp16's floor (~6×10⁻⁵ for normals). **Loss scaling** multiplies
the _loss_ by a factor S (say 2¹⁰) before backprop; by linearity every
gradient arrives scaled by S — lifted bodily out of the underflow zone —
then gradients are divided by S (in fp32) before the weight update. Nothing
about the mathematics changes; the values just travel through the dangerous
territory at a survivable magnitude. Dynamic loss scaling automates the
tuning: grow S until infs appear, skip that step and shrink, repeat. That
machinery — checking every step for infs — is why fp16 training feels
fragile, and why bf16's "just have fp32's range" won (lesson 02).

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
