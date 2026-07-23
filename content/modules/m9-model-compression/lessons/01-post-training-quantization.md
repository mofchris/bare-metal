---
id: m9/01-post-training-quantization
title: "Post-training quantization — dynamic vs static, and when each applies"
objectives:
  - "Explain what post-training quantization does and why it needs no retraining"
  - "Distinguish dynamic from static quantization by what is quantized when"
  - "Choose between them for a given model from where its time and memory go"
sources:
  - "Jacob et al., Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference, CVPR 2018"
  - "Nagel et al., A White Paper on Neural Network Quantization, arXiv 2021"
  - "PyTorch docs: Quantization (pytorch.org/docs/stable/quantization.html)"
---

## What this lesson answers

M3/03 gave you the idea of quantization: map real weights onto a 256-tick
integer ruler with a scale and a zero-point, and get four times less memory
traffic, four times smaller storage, and cheaper arithmetic. That lesson was
about the representation.

This module is about doing it to a real model, where the representation is the
easy part and the decisions around it are the work. This first lesson covers the
cheapest version, the one that needs no retraining, and the single most
important choice inside it: what to quantize when.

## What does post-training quantization actually do?

**Post-training quantization**, abbreviated PTQ, takes a model that was trained
in float32 and converts it to use integers, without any further training.

The name is the whole promise. Training is expensive and needs the original
data and pipeline. PTQ needs neither. You take the finished weights, compute a
scale and zero-point for them using M3/03's arithmetic, and replace the floats
with integers plus their scales.

For the weights this is straightforward, because the weights are known. They sit
in the file, you can see their range directly, and M3/03 already showed how to
turn a known range into a scale.

The activations are the hard part, and the reason there is more than one kind of
PTQ. An activation's range depends on the input, which you do not have at
conversion time. The two kinds of PTQ are two different answers to "so when do
we deal with the activations?"

## What is dynamic quantization?

**Dynamic quantization** quantizes the weights ahead of time and leaves the
activations in floating point until the moment they are computed, then quantizes
them on the fly during inference.

Follow the sequence for one layer. The weights were converted to int8 once, at
conversion time. When an input arrives, the activation is produced in float, its
range is measured right then, a scale is chosen on the spot, it is quantized,
the integer matrix multiply runs, and the result is turned back into float.

The appeal is that it needs nothing but the model. There is no calibration step,
because the activation ranges are measured live rather than estimated in advance.
You convert the model and it works.

The cost is that measuring each activation's range and quantizing it happens
during inference, on every input, which is real per-inference work. Whether that
work is worth it depends on what the layer was spending its time on, which the
next section makes precise.

## What is static quantization?

**Static quantization** quantizes both the weights and the activations ahead of
time. The activation scales are fixed before inference, so nothing about
quantization happens live.

But an activation's range depends on the input, and static quantization commits
to the scales in advance. How? By measuring the ranges on sample data first, in
a step called **calibration**, which M3/03 named and lesson 02 covers in full.
You run representative inputs through the model, record how large the activations
actually get, and freeze scales that cover those ranges.

The appeal is speed. With every scale fixed, inference is pure integer
arithmetic with no on-the-fly range-finding, so a layer runs as fast as integers
allow.

The cost is the calibration step, which needs representative data and can go
wrong if that data does not match what the model will really see. That failure
mode is lesson 02's subject.

## How do you choose between them?

The choice comes down to where a layer spends its time, and M1's vocabulary
makes it precise.

Dynamic quantization pays a per-inference cost to find activation ranges but
avoids needing calibration data. Static quantization pays a one-time calibration
cost and then runs with no live overhead. So the question is whether the live
range-finding of dynamic quantization is small or large relative to the layer's
real work.

For a layer that is memory-bound on weights, dynamic quantization is often
enough. M1/03 and M3/03 showed that reading int8 weights instead of float32
quarters the bytes, and for a bandwidth-bound layer that is where nearly all the
benefit lives. The activations are small relative to the weights, so quantizing
them live costs little. This is the common case for the large weight matrices in
language models, which is why dynamic quantization is the usual first reach for
them.

For a layer whose activations are large and whose arithmetic is the bottleneck,
static quantization earns its calibration step. Here the live range-finding of
dynamic quantization would be repeated on large activations every inference, and
paying it once at calibration instead is the better trade. Convolutional vision
models, with their large activation maps, are the typical case.

The honest summary is that this is a measurement question, not a rule. M2's whole
discipline applies: convert both ways, measure latency and accuracy on your
model and your hardware, and let the numbers decide. What this lesson gives you
is the reason the answer differs by model, so the measurement is not a
mystery.

## Check your understanding

You have two models to quantize on this CPU. Model A is a language model
dominated by a few very large weight matrices, whose activations at each step
are small. Model B is a vision model with large activation maps flowing through
many convolutions.

Say which PTQ kind is the natural first choice for each, and why. A correct
answer picks dynamic quantization for Model A, because its cost and memory are
dominated by reading the large int8 weights (a bandwidth win from M1/03), the
activations are small so quantizing them live is cheap, and this avoids needing
calibration data. It picks static quantization for Model B, because its large
activations would make dynamic quantization's live range-finding expensive on
every inference, so paying that cost once during calibration and then running
pure integer arithmetic is the better trade. It should add that both should be
measured rather than assumed (M2).
