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

## What this lesson answers

Lesson 02 cut numbers from 32 bits to 16 and kept floating point. Going below
16 bits, floating point stops being worth its own structure, because an
exponent field costs bits that a small format cannot spare.

This lesson covers what replaces it: ordinary integers, plus one scaling number
kept on the side. That combination beats floating point at 8 bits, and the
reason it does is worth understanding precisely.

## How do you represent decimals with whole numbers?

An **int8** is an 8-bit whole number holding values from −128 to 127. That is
256 distinct values, evenly spaced, with nothing expressible between them.

To represent real-valued weights with such a thing, choose a linear map:

> real ≈ **scale** × (int − **zero_point**)

The **scale** is the width of one step, stored as an ordinary float alongside
the tensor. The **zero_point** is which integer represents real 0.0, and it
exists because the values being represented are not usually centred on zero, so
the 256 available steps need to be shifted to sit where the numbers actually
are.

Together these stretch a 256-step ruler across the range the tensor occupies.

Work an example. Suppose a layer's weights all lie between −0.4 and 0.4. That
span is 0.8 wide, divided across 255 intervals, so scale ≈ 0.8 ÷ 255 ≈ 0.0031.
Every weight is therefore within half a step of its true value, which is about
0.0016.

Now compare that to what float32 was doing. A float32 spends 8 of its bits on
an exponent covering 10⁻³⁸ to 10³⁸, and this tensor uses none of that range: it
lives entirely inside ±0.4. Those exponent bits were paying for territory that
was never visited. The scale factor buys the range back from outside the
number, so all 8 bits go to resolution inside the range that is actually used.

## How do you know what range to stretch the ruler over?

The map is only as good as the range you chose, and the range has to be
measured rather than assumed.

**Calibration** is that measurement. Sample data is run through the model while
the minimum and maximum of each tensor are recorded. Weights are easy, because
they sit still and can be inspected directly. Activations are not, because they
depend on what data flows through, so they must be observed on real inputs.

Both ways of getting the range wrong have a distinct cost.

Choose a range too wide and the 256 steps are spread across territory that is
mostly empty. Each step becomes coarse, so every value rounds harder than it
needed to.

Choose a range too tight and values beyond it **clip**, meaning they saturate
at the end of the ruler instead of being represented. A handful of unusually
large values can be destroyed this way, and in a layer where those values
carried the signal, accuracy collapses.

Two refinements exist for exactly this tension. Percentile calibration sets the
range to cover, say, 99.9% of observed values and deliberately clips the rest,
trading a few destroyed outliers for a finer step everywhere else. Per-channel
quantization gives each output **channel** its own scale, where a channel is
one of a layer's parallel output streams, so a single loud channel does not
force a coarse ruler on all the quiet ones sharing it.

When calibrating a finished model is not accurate enough, training can continue
with the rounding simulated in the loop, so the model learns weights that
survive being quantized. That approach is **QAT**, quantization-aware training.

## What does int8 actually buy?

**Four times less memory traffic than float32.** One byte per value instead of
four. Lesson M1/04 said what that means for a memory-bound operation: its
ceiling is intensity times bandwidth, so quartering the bytes quadruples the
ceiling. For generating text from a language model, where each token requires
reading the entire model, int8 weights approach four times the token rate
before any other change.

**Four times smaller storage.** A model that needed 4 GB needs 1 GB, which
changes what fits in a cache level, on a phone, or on a smaller GPU.

**Cheaper arithmetic.** The circuitry to multiply and add whole numbers is
simpler than the floating-point equivalent, which needs to align exponents
before it can add. Simpler circuits are smaller, so more of them fit on a chip,
and vector units process 8-bit integers at several times their float rate.

The cost is accuracy. For a well-behaved model at int8 it is typically a
fraction of a percent, but it is never zero and it is never predictable in
advance, so it has to be measured on your model rather than assumed from a
paper.

## Why are int8 products not stored in int8?

Multiply two int8 values near their limits and you get 127 × 127 = 16,129. An
int8 holds a maximum of 127, so the product does not fit in the format its
inputs came from.

A matrix multiplication then sums hundreds of such products, pushing the total
higher still. The running total is therefore kept in **int32**, which has room
for it, and only converted back to int8 for the next layer using the scales.

Notice that this is lesson 02's rule appearing again in a different format:
store narrow, accumulate wide. Every numeric format in this module protects its
accumulations in a wider type, and when you meet an unexplained precision bug,
the accumulator is the first place to look.

## Check your understanding

You quantize a layer whose weights lie between −2.0 and 2.0, except for four
outlier weights at ±15.0. You calibrate using the true minimum and maximum.

Compute the resulting scale, explain what it does to the ordinary weights, and
say which refinement from this lesson would help. A correct answer computes a
span of 30.0 across 255 steps, giving scale ≈ 0.118; observes that the ordinary
weights occupy only ±2.0 and are now resolved in steps of 0.118, roughly 38
times coarser than the 0.0031 they would get from a ±2.0 range, so nearly all
the precision is spent on empty territory; and identifies percentile
calibration, which clips the four outliers deliberately, as the fix.
