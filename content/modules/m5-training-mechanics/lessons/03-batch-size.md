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

## One knob, three dials

Batch size is the most-turned knob in training, and it moves three things
at once — hardware efficiency, memory, and optimization behavior. Confusing
their effects is the standard way to draw wrong conclusions from a batch
size sweep, so this lesson separates them.

## Dial 1: hardware throughput (up, then flat)

Bigger batches make bigger matmuls. From M1: bigger matmuls have higher
arithmetic intensity and amortize fixed per-step costs (kernel launches,
Python overhead, optimizer step) across more samples — so **samples/second
rises with batch size**. But once the hardware's execution units are
saturated, the curve goes flat: a batch of 512 on a machine saturated at
128 computes no faster per sample. Free lunch until saturation, zero lunch
after — and where saturation lands is machine-specific (lab L5.1's sweep
finds this laptop's).

## Dial 2: memory (up, linearly, forever)

Last lesson: activations scale linearly with batch size, everything else
doesn't. So the practical ceiling on batch size is almost always memory,
and it arrives as an OOM at some exact batch size you can predict from the
activation slope (lab L5.1 again).

## Dial 3: optimization (better gradients, diminishing returns)

A batch's gradient is an average over its samples — a _noisy estimate_ of
the true gradient. More samples → less noise. Near-perfectly at first:
doubling a small batch roughly halves the steps needed, so time-to-result
scales beautifully. But Shallue et al.'s large empirical study mapped what
follows: a **diminishing-returns regime**, then a **maximal useful batch
size** past which more samples per step buy _nothing_ — the gradient is
already accurate enough, and extra averaging is wasted samples. Where those
regimes sit varies by model and dataset; no universal number exists.

Two couplings to respect when scaling batch up:

- **Learning rate must move with it** — the classic recipe (Goyal et al.)
  scales LR linearly with batch size, with a warmup period to survive the
  early large steps. Sweeping batch size at fixed LR measures the wrong
  thing.
- **Generalization**: very large batches sometimes end at slightly worse
  test accuracy (the noise in small-batch gradients acts as a mild
  regularizer). Real, but second-order next to getting the LR right.

## What batch size does NOT change

The FLOPs per epoch: every sample's forward and backward costs the same
arithmetic regardless of how samples are grouped. Batch size changes how
_efficiently_ the hardware executes those FLOPs (dial 1) and how many
epochs you need (dial 3) — never the per-epoch arithmetic itself. When a
bigger batch "trains faster," always ask which dial actually moved:
hardware utilization, or fewer steps? The honest experiment separates
them — steps-to-target-accuracy and samples/second, reported side by side
(M2's discipline: name the metric).

## The gradient-accumulation preview

If optimization wants a big batch but memory forbids it, run k small
micro-batches, summing gradients without stepping, then step once —
mathematically the same gradient, activations of only one micro-batch in
memory at a time. That's **gradient accumulation**, the first of the
compute-for-memory trades that fill the next lesson.
