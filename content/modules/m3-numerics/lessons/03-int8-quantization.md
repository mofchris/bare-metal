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

An int8 holds integers −128…127 — no exponent, no mantissa, just 256 evenly
spaced values. To represent real-valued weights with it, pick a linear map:

> real ≈ **scale** × (int − **zero_point**)

**scale** is the width of one tick (a float, stored alongside the tensor);
**zero_point** is which tick represents real 0.0. Together they stretch a
256-tick ruler over the tensor's actual value range. If weights live in
[−0.4, 0.4], scale ≈ 0.8/255 ≈ 0.003 — every weight lands within half a
tick (~0.0016) of its true value. That's the whole trick: floats spend bits
on range the tensor doesn't use; the scale factor _buys the range back_
externally, so all 8 bits go to precision inside the range that matters.

## Calibration: measuring where values actually live

The map is only as good as the range it's stretched over — and that range
must be _measured_. **Calibration** runs sample data through the model and
records each tensor's observed range (weights are known statically;
activations need the data). The failure modes bracket the choice:

- Range too wide → ticks too coarse → everything rounds harshly.
- Range too tight → values beyond it **clip** (saturate at ±127) — a few
  wild outliers can wreck a layer this way.

Practical refinements exist for exactly this tension: clipping outliers
deliberately (percentile calibration), or giving each output channel its own
scale (**per-channel quantization**) so one loud channel doesn't coarsen the
ruler for everyone. When post-training calibration isn't enough, training
can continue with quantization simulated in the loop (QAT) — M6 picks that
up properly.

## Why bother: the three wins

1. **4× less memory traffic than fp32** (2× vs fp16) — and lesson M1/04
   told you what that means: memory-bound ops get faster in direct
   proportion. For LLM decode — bandwidth-bound reading of weights — int8
   weights approach 4× token speed before any other cleverness.
2. **4× smaller model** — fits in cache levels, phones, and smaller GPUs.
3. **Cheaper arithmetic** — integer multiply-accumulate units are smaller
   and denser than float ones; hardware vector units chew 8-bit integers at
   multiples of their float rate.

The cost is accuracy — usually a fraction of a percent for well-behaved
models at int8, but never free, and it must be _measured_, not assumed
(module M2's whole point). Lab L6.1 does exactly that measurement.

## One integer subtlety worth knowing early

Products of int8s are accumulated in **int32** (the accumulate-wide pattern
from lesson 02 again — hundreds of ±127×±127 products would overflow int8
instantly), then re-quantized to int8 for the next layer using the scales.
Spot the theme: every numeric format in this module protects its
accumulations in a wider type. When you meet a mystery precision bug in the
wild, the accumulator is the first suspect.
