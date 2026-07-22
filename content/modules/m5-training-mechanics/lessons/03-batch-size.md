---
id: m5/03-batch-size
title: "Batch size: what it changes and what it doesn't"
objectives:
  - "Explain why throughput rises with batch size and why it plateaus"
  - "Describe the diminishing-returns curve of large-batch optimization"
  - "State what batch size does NOT change, and the learning-rate coupling"
sources:
  - "Shallue et al., Measuring the Effects of Data Parallelism on Neural Network Training, JMLR 2019"
  - "Goyal et al., Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour, arXiv 2017"
---

## What this lesson answers

Batch size is the most frequently adjusted number in training, and it moves
three unrelated things at the same time: how efficiently the hardware runs, how
much memory is used, and how well the model learns per step.

Because one knob moves three things, experiments that change it produce results
that are easy to misread. This lesson separates the three effects so you can say
which one produced any change you observe.

## Effect 1: why does throughput rise and then stop rising?

Larger batches make larger matrix multiplications, and that helps twice.

First, from M1/03: arithmetic intensity for a matrix multiply grows with size,
so a bigger multiply does more arithmetic per byte fetched and sits further to
the right on the roofline.

Second, every step carries fixed costs that do not depend on batch size:
launching each operation onto the device, Python overhead, and the optimizer's
update pass over the weights. Running 32 samples through one step rather than
one sample through 32 steps pays those costs once instead of 32 times.

So samples per second rises with batch size. It stops rising when the hardware's
execution units are saturated, meaning they are already busy every cycle. Past
that point a larger batch is simply more work for a machine already working
flat out, and per-sample speed stops improving.

Where saturation lands depends on the machine and the model, so it is found by
measurement rather than predicted.

## Effect 2: why does memory rise forever?

Lesson 02 answered this. Activations scale linearly with batch size and the
other three items on the bill do not.

That makes memory the practical ceiling on batch size in nearly every real
situation, and it makes the ceiling predictable. Measure activation memory at
two batch sizes, take the slope, and you can compute the batch size at which the
job will hit OOM before you run it.

## Effect 3: why do bigger batches stop helping the learning?

A batch's gradient is an average of the gradients from its samples, and that
average is an estimate of the gradient you would get from the entire dataset.

Averaging more samples produces a less noisy estimate, so each step points more
accurately downhill. At small batch sizes this works nearly perfectly: doubling
the batch roughly halves the number of steps needed, so the time to reach a
given accuracy scales beautifully.

It does not continue. Shallue and colleagues mapped the curve empirically across
many models and datasets, and found three regions. There is a region of near
perfect scaling, then a region of **diminishing returns** where doubling the
batch reduces the step count by less than half, then a **maximal useful batch
size** beyond which extra samples per step buy nothing at all.

The reason for that ceiling is that the gradient estimate has already stopped
being the limiting factor. Once the direction is accurate enough, making it more
accurate does not let you take a more productive step, so the additional samples
are wasted work. Where the ceiling falls varies by model and dataset, and no
universal number exists.

## What has to change when you change the batch size?

**The learning rate.** The learning rate is how large a step the optimizer takes
along the gradient direction. A larger batch produces a more trustworthy
direction, so you can afford to travel further along it before re-measuring. The
standard recipe, from Goyal and colleagues, scales the learning rate linearly
with the batch size, with a warmup period at the start of training to survive
the early large steps.

The consequence for experiments is direct: sweeping batch size at a fixed
learning rate does not measure what batch size does. It measures batch size
combined with an increasingly wrong learning rate, and it will make large
batches look worse than they are.

**Generalization**, meaning how well the model performs on data it never trained
on, can also shift. Very large batches sometimes end at slightly lower test
accuracy. The usual explanation is that the noise in small-batch gradients acts
as a mild randomizing force, keeping the model from settling too precisely into
the training data. The effect is real and it is second-order next to getting the
learning rate right.

## What does batch size not change?

The FLOPs per epoch. Every sample requires the same forward and backward
arithmetic regardless of how the samples are grouped, and grouping changes the
shape of the matrix multiplications rather than the total number of multiplies
and adds.

So batch size changes how efficiently the hardware executes those FLOPs, and how
many steps are needed, but never the arithmetic itself.

This gives you the right question whenever a larger batch appears to "train
faster": which effect actually moved? Report steps-to-target-accuracy and
samples-per-second side by side, and the answer is visible. Reporting only one
of them makes the two indistinguishable.

## What if optimization wants a batch that will not fit?

Run the large batch in pieces. Split it into k smaller micro-batches, run
forward and backward on each in turn while adding the gradients together, and
apply one weight update at the end using the accumulated sum.

The gradient this produces is mathematically the same as the one a single large
batch would have produced, because summing the gradients of the parts is
summing over the same samples. Yet only one micro-batch's activations exist at a
time, so the memory cost is that of the small batch.

This technique is **gradient accumulation**, and it is the first of the
trades between compute and memory that fill the next lesson.

## Check your understanding

You sweep batch size from 32 to 512 at a fixed learning rate and observe:
samples per second rises from 900 to 2100 and then flattens after 256, memory
grows steadily throughout, and final test accuracy falls at 512.

Say what each of the three observations tells you, and name the flaw in the
experiment. A correct answer attributes the rise and plateau in samples per
second to hardware saturation around batch 256; attributes the steady memory
growth to activations, the only line item that scales with batch size; and
identifies the fixed learning rate as the flaw, since the standard recipe scales
learning rate with batch size, so the accuracy drop at 512 may be an untuned
learning rate rather than a property of large batches.
