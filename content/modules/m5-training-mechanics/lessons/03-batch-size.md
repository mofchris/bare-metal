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

Batch size is the most-turned knob in training, and it moves three things at
once — hardware efficiency, memory, and optimization behavior. Confusing their
effects is the standard way to draw wrong conclusions from a batch size sweep,
so this lesson separates them.

## Dial 1: hardware throughput (up, then flat)

Bigger batches make bigger matmuls. From M1: bigger matmuls have higher
arithmetic intensity, and they spread the fixed per-step costs — launching
each kernel onto the device, Python overhead, the optimizer's own update pass
— across more samples. So **samples/second rises with batch size**.

But once the hardware's execution units are saturated — genuinely busy every
cycle — the curve goes flat: a batch of 512 on a machine already saturated at
128 computes no faster per sample. Free lunch until saturation, zero lunch
after, and where saturation lands is machine-specific (lab L5.1's sweep finds
this laptop's).

## Dial 2: memory (up, linearly, forever)

Last lesson: activations scale linearly with batch size, everything else
doesn't. So the practical ceiling on batch size is almost always memory, and
it arrives as an OOM at some exact batch size you can predict in advance from
the activation slope (lab L5.1 again).

## Dial 3: optimization (better gradients, diminishing returns)

A batch's gradient is an average over its samples — and that average is a
_noisy estimate_ of the gradient you'd get from the entire dataset. More
samples in the average, less noise, so each step points more accurately
downhill.

That works near-perfectly at first: doubling a small batch roughly halves the
number of steps needed, so time-to-result scales beautifully. But Shallue et
al.'s large empirical study mapped what follows: a **diminishing-returns
regime**, and then a **maximal useful batch size** past which more samples per
step buy _nothing_ — the gradient estimate is already accurate enough, and the
extra averaging is wasted work. Where those regimes sit varies by model and
dataset; no universal number exists.

Two couplings to respect when scaling batch up:

- **Learning rate must move with it.** The learning rate is how big a step the
  optimizer takes along the gradient. A bigger batch gives a more trustworthy
  direction, so you can afford to travel further along it — the classic recipe
  (Goyal et al.) scales learning rate linearly with batch size, with a warmup
  period at the start to survive those early large steps. Sweeping batch size
  at fixed learning rate measures the wrong thing entirely.
- **Generalization** — how well the model does on data it never trained on.
  Very large batches sometimes end at slightly worse test accuracy, because
  the noise in small-batch gradients acts as a mild randomizing force that
  keeps the model from settling too precisely into the training data. Real,
  but second-order next to getting the learning rate right.

## What batch size does NOT change

The FLOPs per epoch. Every sample's forward and backward pass costs the same
arithmetic regardless of how the samples are grouped — grouping changes the
shape of the matmuls, not the total multiply-adds.

So batch size changes how _efficiently_ the hardware executes those FLOPs
(dial 1) and how many epochs you need (dial 3) — never the per-epoch
arithmetic itself. When a bigger batch "trains faster," always ask which dial
actually moved: hardware utilization, or fewer steps? The honest experiment
separates them — steps-to-target-accuracy and samples/second, reported side by
side (M2's discipline: name the metric).

## The gradient-accumulation preview

If optimization wants a big batch but memory forbids it, run k small
micro-batches, adding up their gradients without applying an update, then step
once using the sum. Mathematically that's the same gradient a single large
batch would have produced, but only one micro-batch's activations are alive at
any moment.

That's **gradient accumulation**, the first of the compute-for-memory trades
that fill the next lesson.
