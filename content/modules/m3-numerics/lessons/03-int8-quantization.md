---
id: m3/03-int8-quantization
title: "Integers for inference: the quantization idea"
objectives:
  - "Write the affine quantization mapping and explain scale and zero-point"
  - "Explain what calibration is for and what a badly chosen scale does"
  - "State the three wins of int8 inference and where they come from"
sources:
  - "Jacob et al., Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference, CVPR 2018"
  - "Nagel et al., A White Paper on Neural Network Quantization, arXiv 2021"
---

## A ruler with 256 ticks

An **int8** is an 8-bit whole number, holding values −128…127 — no exponent,
no mantissa, just 256 evenly spaced values with no way to express anything
between them. To represent real-valued weights with it, pick a linear map:

> real ≈ **scale** × (int − **zero_point**)

**scale** is the width of one tick — an ordinary float, stored alongside the
tensor. **zero_point** is which tick represents real 0.0, and it exists
because the values you're representing usually aren't centered on zero;
shifting lets the 256 ticks sit where the numbers actually are.

Together they stretch a 256-tick ruler over the tensor's actual value range.
If weights live in [−0.4, 0.4], scale ≈ 0.8/255 ≈ 0.003 — every weight lands
within half a tick (~0.0016) of its true value. That's the whole trick:
floats spend bits on range the tensor doesn't use, while the scale factor
_buys the range back_ externally, so all 8 bits go to precision inside the
range that actually matters.

## Calibration: measuring where values actually live

The map is only as good as the range it's stretched over — and that range must
be _measured_. **Calibration** runs sample data through the model and records
each tensor's observed minimum and maximum. Weights are known statically (they
just sit there), but activations depend on what data flows through, so they
have to be observed.

The failure modes bracket the choice:

- Range too wide → the 256 ticks are spread thin, each one covering more
  ground → everything rounds harshly.
- Range too tight → values beyond it **clip**, meaning they saturate at the
  end of the ruler (±127) instead of being represented — a few wild outliers
  can wreck a layer this way.

Practical refinements exist for exactly this tension: deliberately clipping
outliers (percentile calibration — set the range to cover 99.9% of values and
let the rest saturate), or giving each output **channel** its own scale
(**per-channel quantization**), a channel being one of a layer's parallel
output streams, so one loud channel doesn't coarsen the ruler for all the
others sharing it.

When calibrating a finished model isn't enough, training can continue with the
rounding simulated in the loop, so the model learns weights that survive being
quantized — that's **QAT**, quantization-aware training, and M6 picks it up
properly.

## Why bother: the three wins

1. **4× less memory traffic than fp32** (2× vs fp16) — and lesson M1/04 told
   you what that means: memory-bound operations get faster in direct
   proportion. For LLM decode — which is bandwidth-bound, since emitting each
   token requires reading the whole model — int8 weights approach 4× token
   speed before any other cleverness.
2. **4× smaller model** — fits in cache levels, phones, and smaller GPUs.
3. **Cheaper arithmetic** — the circuitry for multiplying and adding whole
   numbers is smaller and simpler than the floating-point equivalent, so more
   of it fits on a chip; hardware vector units chew 8-bit integers at
   multiples of their float rate.

The cost is accuracy — usually a fraction of a percent for well-behaved models
at int8, but never free, and it must be _measured_, not assumed (module M2's
whole point). Lab L6.1 does exactly that measurement.

## One integer subtlety worth knowing early

Products of int8s are accumulated in **int32** — the accumulate-wide pattern
from lesson 02 again. The reason is concrete: a single product of two int8s
can reach 127×127 ≈ 16,000, already far outside int8's ±127, and a matmul sums
hundreds of those. The running total is kept in a 32-bit integer that has room
for it, then re-quantized back down to int8 for the next layer using the
scales.

Spot the theme: every numeric format in this module protects its accumulations
in a wider type. When you meet a mystery precision bug in the wild, the
accumulator is the first suspect.
