---
id: m9/02-calibration-in-practice
title: "Calibration in practice — choosing the range, and what clipping costs"
objectives:
  - "Explain why the min-max range is often the wrong range to calibrate to"
  - "Explain the outlier problem and how percentile and per-channel calibration each address it"
  - "Reason about how much calibration data is needed and what makes it representative"
sources:
  - "Nagel et al., A White Paper on Neural Network Quantization, arXiv 2021"
  - "Migacz, 8-bit Inference with TensorRT (NVIDIA GTC 2017)"
  - "Wu et al., Integer Quantization for Deep Learning Inference: Principles and Empirical Evaluation, arXiv 2020"
---

## What this lesson answers

Lesson 01 said static quantization needs calibration: run sample data through
the model, measure the activation ranges, and freeze scales that cover them.
M3/03 named the two ways to get it wrong — too wide a range makes every tick
coarse, too tight a range clips values.

This lesson is about actually choosing the range, because the obvious choice is
usually the wrong one, and the reason is a specific and common property of neural
network activations.

## Why is the obvious range the wrong one?

The obvious range is the minimum to the maximum of the observed values. It
guarantees nothing clips, because by construction every value fits.

M3/03 already showed why that can be a bad trade, with the worked example of
weights in ±2.0 plus four outliers at ±15.0: the true range spans 30, so the
step is 30 ÷ 255 ≈ 0.118, and the ordinary values that make up almost the entire
tensor are resolved seven times more coarsely than they would be under a ±2.0
range. Nearly all the resolution is spent on empty territory the outliers
created.

The property that makes this common rather than a contrived example is worth
stating plainly. Neural network activations are frequently **heavy-tailed**:
almost all values sit in a narrow band, and a small fraction sit far outside it.
Calibrating to the min and max lets that small fraction dictate the scale for
everyone, and the many pay for the few.

So the real calibration question is not "what is the range" but "what range
should I cover, accepting that covering less means clipping the rest".

## What does percentile calibration do?

**Percentile calibration** deliberately chooses a range narrower than the full
min-max, covering, say, 99.9% of observed values, and lets the remaining 0.1%
clip.

Trace the trade it makes. Clipping the extreme 0.1% introduces error on those
few values, because they saturate at the end of the ruler instead of being
represented. In exchange, the range shrinks to what the bulk of the values
actually occupy, so the tick size drops and every one of the other 99.9% is
represented more precisely.

For a heavy-tailed distribution this is usually a large net win, because you are
trading a little error on a handful of values for less error on almost all of
them. The 99.9% figure is not magic; it is a knob, and the right setting is
found by measuring accuracy at a few settings and picking the best, which is M2's
discipline again.

There is a limit to when clipping is safe, and it is worth knowing. The outliers
can be discarded cheaply only when they were not carrying important information.
Sometimes a large activation is large because it matters, and clipping it hurts
accuracy badly. That is why this is calibrated and measured, not assumed, and it
is the same caution M3/03 raised.

## What does per-channel calibration do?

The second tool attacks the problem from a different direction. M3/03 introduced
it: give each output **channel** its own scale, where a channel is one of a
layer's parallel output streams.

The reason this helps is specific. Different channels of the same layer often
have genuinely different ranges — one channel's values might span ±1 while
another's span ±50 — and a single scale for the whole layer must stretch to
cover the widest channel, coarsening every quieter one. Per-channel scales let
each channel be quantized to its own range, so a loud channel no longer forces a
coarse ruler on the quiet ones.

Per-channel calibration is standard for weights, where it is cheap: the channels
are known statically, so computing a scale per channel is a one-time
calculation. It is used more carefully for activations, because there the
per-channel scales interact with how the integer matrix multiply is implemented,
and not all hardware handles per-channel activation scales efficiently.

The two tools compose. Percentile calibration handles the heavy tail within a
channel; per-channel scales handle the differences between channels. A model
that resists quantization with plain min-max often quantizes cleanly with both
applied.

## How much calibration data do you need, and of what kind?

Two questions, and the second matters more than the first.

The amount is modest. Calibration is estimating a range, not training, so it
does not need the full dataset. A few hundred representative samples are
typically enough to see the activation ranges stabilize, and you can check
stabilization directly: calibrate on more data and see whether the chosen scales
move meaningfully. If they do not, you have enough.

The kind is where calibration quietly fails. The calibration data must match the
distribution the model will actually see in production, because the scales are
frozen to whatever ranges that data produced. Calibrate a vision model on
daytime images and deploy it on night images, and the real activations may fall
outside the frozen range and clip everywhere, or fall well inside it and waste
resolution. Nothing errors; the model just gets less accurate for a reason that
is invisible unless you suspect it.

This connects straight to M7's construct validity. Calibration data is a sample,
and a scale frozen from an unrepresentative sample answers the wrong question.
The obligation is the same: know what distribution your calibration set
represents, and whether it is the one you will deploy against.

## Check your understanding

You statically quantize a model with plain min-max calibration and accuracy
drops sharply. Inspecting the activations, you find that in most layers 99.9% of
values lie in a narrow band but a few are far larger, and that within each layer
some channels have much wider ranges than others.

Name the two calibration changes that would help and say what each one fixes. A
correct answer identifies percentile calibration, which narrows the range to
cover the bulk of the values and clips the rare large ones, fixing the coarse
tick size that the heavy tail forced under min-max; and per-channel calibration,
which gives each output channel its own scale, fixing the coarsening that a
single layer-wide scale caused when one loud channel had to be covered by the
same ruler as the quiet ones. It may add that the percentile setting should be
tuned by measuring accuracy, and that clipping is only safe when the outliers
were not carrying important information.
