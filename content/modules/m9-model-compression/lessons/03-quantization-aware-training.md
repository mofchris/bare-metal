---
id: m9/03-quantization-aware-training
title: "Quantization-aware training — when post-training calibration is not enough"
objectives:
  - "Explain what QAT simulates during training and why that improves the final quantized model"
  - "Explain the gradient problem rounding creates and how the straight-through estimator sidesteps it"
  - "Decide between PTQ and QAT for a given situation, weighing accuracy against cost"
sources:
  - "Jacob et al., Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference, CVPR 2018"
  - "Bengio, Léonard & Courville, Estimating or Propagating Gradients Through Stochastic Neurons (the straight-through estimator), arXiv 2013"
  - "Nagel et al., A White Paper on Neural Network Quantization, arXiv 2021"
---

## What this lesson answers

Lessons 01 and 02 quantized a finished model without retraining. That is cheap,
and for many models it is enough. For some models it is not: the accuracy drop
from quantization is too large to accept, no matter how carefully you calibrate.

This lesson is about the more expensive option for those cases. Rather than
quantizing after training and hoping the model tolerates it, you let the model
learn to tolerate it during training. The idea is simple; the one hard part is a
genuine problem with gradients that has a clever and slightly dishonest fix worth
understanding.

## Why does quantizing after training lose accuracy at all?

Start with why PTQ loses anything, because QAT is a direct response to it.

A model trained in float32 arrived at its exact weights by a long search (M5).
Those weights are tuned to float32 precision. Quantizing them rounds every one
to the nearest tick, and that rounding is a perturbation the model never saw
during training and was never given a chance to compensate for.

For a robust model the perturbation is small and accuracy barely moves. For a
sensitive one it is enough to matter, because the model is operating at weights
where small changes have large effects, and rounding is exactly such a change.

The core insight of the fix follows immediately. The model lost accuracy because
quantization was a surprise sprung on it after training. So do not surprise it.
Show it the rounding during training, and let the search find weights that are
still good after they are rounded.

## What does QAT actually simulate?

**Quantization-aware training**, abbreviated QAT, inserts the quantization
operation into the model during training, so that the forward pass computes with
rounded values while the training loop keeps running.

Be precise about what is and is not quantized, because this is the part people
misread. QAT does not train in integers. The weights are still stored and
updated in float32. What QAT adds is a step, on the forward pass, that takes a
weight or activation, quantizes it to int8 and back to float, so the value the
forward pass actually uses is the rounded one. This is called **fake
quantization**: the number is float, but it has been forced through the
int8 grid and carries the rounding error it would have in real int8.

Now follow the consequence through the training loop from M5. The forward pass
produces a loss computed from rounded values, so the loss reflects the rounded
model. The gradients computed from that loss therefore push the weights in
directions that reduce the loss of the rounded model, not the float one. Over
many steps, the search settles on weights that are good after rounding, which is
exactly the goal.

When training finishes, you quantize for real, and because the model was trained
against that rounding, the final drop is small.

## What is the gradient problem, and how is it dodged?

There is one genuine obstacle, and it comes from M5/01. The training loop needs a
gradient through every operation, and the quantization operation has a gradient
that is useless.

See why. Quantization rounds its input to the nearest tick, so its output is a
staircase: as the input moves a little, the output stays flat, then jumps. The
derivative of a staircase is zero almost everywhere and undefined at the jumps.
A zero gradient means no signal reaches the weights through that operation, and
the whole point was to let a signal through. Backpropagation, run honestly
across the rounding step, would deliver nothing.

The fix is a deliberate lie called the **straight-through estimator**. On the
forward pass, the quantization operation rounds as normal. On the backward pass,
it pretends it was the identity function — it passes the incoming gradient
straight through unchanged, as if no rounding had happened.

This is not mathematically correct, and it does not have to be. M5/01 established
that gradients only need to point roughly downhill for the search to work. The
straight-through estimator gives a gradient that is approximately right — the
weight should still move the way it would without rounding — which is enough to
train. It is one of several places in this field where an inexact gradient is
accepted because it works, and knowing it is a deliberate approximation stops it
from looking like magic.

## When is QAT worth it, and when is it not?

The trade is stark and easy to state. QAT recovers accuracy that PTQ lost, and
it costs a training run.

That cost is the whole decision. QAT needs the training data, the training
pipeline, and the compute for a training run, which is exactly what PTQ was
prized for not needing. So QAT is not a better PTQ; it is a more expensive tool
for the cases PTQ cannot handle.

The sensible order follows. Try PTQ first, because it is nearly free. Measure the
accuracy drop honestly (M2), against a baseline (M7). If the drop is acceptable,
you are done, and QAT would have been wasted effort. If the drop is too large and
you have the data and compute, reach for QAT. If the drop is too large and you do
not have the training setup, your options are a less aggressive quantization, a
different technique from this module, or accepting the model as it is.

This is a recurring shape in systems work: a cheap technique that usually
suffices, and an expensive one held in reserve for when it does not. Spending the
expensive one by default is the mistake.

## Check your understanding

A small vision model quantized with careful PTQ, including percentile and
per-channel calibration, still loses 4% accuracy, which your application cannot
accept. You have the original training data and pipeline.

Say what to do, explain what the technique simulates, and explain the one
non-obvious mechanism that makes it trainable. A correct answer chooses
quantization-aware training, since PTQ was tried first and its drop is
unacceptable and the training setup is available. It explains that QAT inserts
fake quantization into the forward pass, so the model computes with int8-rounded
values while weights are still stored and updated in float32, and the training
loop therefore finds weights that remain good after rounding. And it explains
that the quantization step has a zero-or-undefined gradient because rounding is a
staircase, so the straight-through estimator is used: the backward pass treats
the rounding as the identity and passes the gradient through unchanged, an
approximate but downhill-pointing gradient that is good enough to train (M5/01).
