---
id: m5/04-memory-tricks
title: "Trading compute for memory: checkpointing and friends"
objectives:
  - "Explain gradient checkpointing: what's discarded, what's recomputed, and both costs"
  - "Choose the right memory trick for a given constraint"
  - "Recognize the recurring MLSys pattern: memory and compute are exchangeable currencies"
sources:
  - "Chen, Xu, Zhang & Guestrin, Training Deep Nets with Sublinear Memory Cost, arXiv 2016"
  - "Micikevicius et al., Mixed Precision Training, ICLR 2018"
  - "PyTorch docs: torch.utils.checkpoint"
---

## What this lesson answers

Lesson 01 established that the tape must hold every activation until the
backward pass consumes it. Lesson 02 showed that activations are the one item
scaling with batch size. Lesson 03 showed that memory is therefore what caps
batch size in practice.

This lesson covers what to do when the memory is not there. Three techniques
buy memory by spending something else, and the point of the lesson is to know
exactly what each one spends, so you can pick the one whose price you can
afford.

## How can you keep activations without storing them?

The insight, from Chen and colleagues, is that an activation does not have to be
stored, because it can be recreated. The forward pass is deterministic: run the
same inputs through the same weights and you get the same activations every
time.

**Gradient checkpointing** applies that. Divide the network into segments.
Store only the activations at each segment's boundary, and discard everything
computed inside the segment.

When the backward pass reaches a segment, its interior activations are missing,
so they are recomputed: run that segment's forward pass again, starting from the
stored boundary activation. The freshly recomputed activations are used to get
the gradients, then released, and the process moves to the next segment.

Now the arithmetic that made the technique famous. Split a network of n layers
into √n segments of √n layers each. You store √n boundary activations, plus
√n interior activations for whichever single segment is currently being
recomputed. Storage therefore falls from n to about **√n**. For a 100-layer
network, that is roughly 10 layers' worth of activations instead of 100.

The price is one extra forward pass over each segment during the backward pass.
Since a backward pass costs about twice a forward pass, adding one more forward
pass to the total raises training time by roughly **30%**.

Weigh those against each other. Cutting memory by a factor near 5 to 10 in
exchange for 1.3 times the runtime is usually an excellent trade, because it
converts a job that cannot run at all into one that runs somewhat slower.

## What does mixed precision buy here?

M3 sold narrow formats as a bandwidth win. In this lesson they are a capacity
win: half-width activations halve the line item that scales with batch size, and
half-width gradients halve their line too.

Be precise about what it does not halve. Lesson 02 showed that the standard
mixed-precision recipe still keeps a float32 master weight and float32 momentum
and variance, so the 16-bytes-per-parameter total survives intact.

That distinction explains a common disappointment. Mixed precision shrinks the
part of memory that depends on batch size, so it buys headroom for a larger
batch. It does not shrink the part that depends on model size, so it does not
let you train a model that was already too large to hold.

## What does gradient accumulation cost?

Lesson 03 introduced it: k micro-batches, gradients summed, one update.

Its price is neither memory nor arithmetic. The same total number of samples
pass through the same operations, so the FLOPs are unchanged, and only one
micro-batch of activations is alive at a time.

What it costs is the structure of the step. The k forward and backward passes
run one after another rather than as one large batch, so the fixed per-step
costs from lesson 03 stop being spread across a big batch and are paid k times
instead. The matrix multiplications are also smaller, which pushes them back
down the roofline toward lower arithmetic intensity.

In other words, gradient accumulation gives back exactly the hardware efficiency
that a large batch was buying, while keeping the optimization behaviour a large
batch provides.

All three techniques compose. Checkpointing, mixed precision and gradient
accumulation together form the standard toolkit for training a large model on
hardware that should not be able to hold it.

## Why does this pattern keep appearing?

Step back and the same decision shows up throughout systems work: **memory and
compute are exchangeable, and engineering is choosing the exchange rate that
suits your hardware.**

Checkpointing chose to recompute rather than store. Caching in M1/01 chose the
opposite, storing a copy to avoid refetching. M3 chose narrower numbers,
spending precision to buy both memory and bandwidth. Serving systems store the
results of past work so a language model does not recompute them for every new
token, which is again the M1 choice rather than the checkpointing one.

None of these is correct in the abstract. Each one is correct when the resource
it spends is the resource you have spare, which is why the first question is
always a measurement: which budget am I actually short of?

## Check your understanding

Your model trains at batch size 8 and hits OOM at batch size 16. You need an
effective batch of 32 for optimization reasons, and each training step currently
takes 400 ms.

Propose a combination of techniques from this lesson, and state the cost of
each. A correct answer proposes gradient accumulation with 4 micro-batches of 8
to get the effective batch of 32 at batch-8 activation memory, noting the cost
is 4 sequential passes per step with per-step fixed costs paid 4 times and
smaller, less efficient matrix multiplies. It may add gradient checkpointing to
raise the micro-batch that fits, at roughly 30% more compute time, and mixed
precision to halve activation memory, while noting mixed precision leaves the
16-bytes-per-parameter state unchanged.
