---
id: m5/02-memory-bill
title: "The memory bill: where the gigabytes go"
objectives:
  - "Itemize training memory: weights, gradients, optimizer state, activations"
  - "Compute the 16-bytes-per-parameter rule for Adam and apply it to a model size"
  - "Explain which components scale with batch size and which don't"
sources:
  - "Rajbhandari et al., ZeRO: Memory Optimizations Toward Training Trillion Parameter Models, SC 2020"
  - "Korthikanti et al., Reducing Activation Recomputation in Large Transformer Models, MLSys 2023"
  - "PyTorch docs: CUDA memory management"
---

## What this lesson answers

Lesson 01 explained why training holds every activation in memory at once. That
is one item on a larger bill.

This lesson itemizes the whole thing, because knowing it turns "will this model
train on my machine?" from a question you answer by trying into one you answer
by multiplying. That one multiplication explains more failed training runs than
any other fact in the field.

## What are the four things occupying memory?

**Weights.** The parameters themselves, at whatever bytes per parameter the
format costs.

**Gradients.** One gradient number per weight, from lesson 01, so this array has
exactly the same shape and size as the weights.

**Optimizer state.** The **optimizer** is the rule that turns gradients into the
actual weight update. Which optimizer you choose decides how much memory this
line costs, and the two common choices differ sharply.

**SGD**, or stochastic gradient descent, simply subtracts a fraction of the
gradient from each weight. It stores nothing beyond what it was given.

**Adam**, the modern default, keeps two extra numbers per weight. The first is
**momentum**, a running average of that weight's recent gradient direction, so
updates keep rolling in a consistent direction instead of jittering. The second
is **variance**, a running average of how much that weight's gradient has been
bouncing around, used to take smaller steps where the signal is noisy. Two extra
numbers per weight, held for the whole run.

**Activations.** Every layer's output, held from the forward pass until backward
consumes it, for the reason lesson 01 established.

The first three are fixed by the model and the optimizer. The fourth is the one
you control day to day, because it is the only one that grows with batch size.

## Where does the 16-bytes-per-parameter rule come from?

Take float32 weights with Adam and add up the bytes per parameter:

4 (weight) + 4 (gradient) + 4 (momentum) + 4 (variance) = **16 bytes per
parameter**

That total exists before a single activation is stored.

The interesting part is that mixed precision does not reduce it. The standard
recipe stores a 2-byte fp16 weight, a 2-byte fp16 gradient, a 4-byte float32
master weight, and float32 momentum and variance at 4 bytes each. Add them:
2 + 2 + 4 + 4 + 4 = 16, exactly the same. This is the figure the ZeRO paper
made famous, and the paper's whole subject is how to survive it on large models.

Now apply it. A model with 1 billion parameters needs 1,000,000,000 × 16 bytes
= **16 GB** of weights, gradients and optimizer state. Your laptop has 16 GB of
RAM in total, so that model is out of memory before a single activation exists
or the operating system takes its share.

Run it the other way for a model that fits. 100 million parameters × 16 bytes =
1.6 GB, which leaves real room to train.

The failure this predicts has a name. **OOM** stands for out of memory, meaning
an allocation failed and the job died on the spot.

The rule also explains a technique you will meet constantly. **LoRA** freezes
the original weights and trains a small set of added parameters instead. Since
gradients and optimizer state are only kept for parameters being trained, the
16-byte multiplier applies to a far smaller count.

## Which item grows when you raise the batch size?

Only activations, and they grow in direct proportion.

Activation memory is roughly the sum over layers of the outputs kept for
backward, multiplied by bytes per element. Since each sample in a batch produces
its own activations, doubling the batch doubles this line while the other three
do not move at all.

For **transformers**, the architecture behind essentially every modern language
model, the per-sample footprint is set by three numbers multiplied together:
**sequence length**, meaning how many tokens the model processes at once;
**hidden size**, meaning how many numbers represent each token internally; and
the number of layers. The attention mechanism adds further terms, and Korthikanti
and colleagues give the exact formulas.

This is why the practical limit on batch size is memory rather than anything
about the mathematics, and why an OOM error arrives at a specific batch size
that you can predict in advance from how activation memory grows.

## What does the clean arithmetic miss?

Real allocations cost more than the itemized bill, in three ways.

The **CUDA context** is the working state NVIDIA's driver establishes for your
process. It costs hundreds of megabytes and is spent before your model receives
a single byte.

**Temporary workspaces** are scratch space that convolution and matrix-multiply
algorithms request while they run, and then release.

**Fragmentation** is the subtle one. Memory is allocated and freed in blocks of
varying size, and over time the free space ends up split into many pieces that
are individually too small to satisfy one large request. Adding up the free
space says there is plenty; no single contiguous piece is big enough, so the
allocation fails anyway. It is the same problem as a fragmented disk.

One more thing distorts what you observe. PyTorch's caching allocator keeps
freed blocks for reuse rather than returning them to the operating system, so
tools watching from outside over-report your usage. Read
`torch.cuda.memory_allocated()` instead, which reports what your tensors
actually hold.

Budget 10 to 20% above the itemized bill, and measure rather than trusting the
arithmetic alone.

## Check your understanding

You want to fine-tune a 7-billion-parameter model with Adam on a GPU with 24 GB
of memory.

Compute whether the optimizer-adjacent state fits, and say what LoRA changes
about the calculation. A correct answer computes 7,000,000,000 × 16 bytes =
112 GB against 24 GB available, so it does not fit by a factor of nearly five,
and that is before any activations, the CUDA context, or fragmentation. It then
notes that LoRA freezes the 7 billion original weights, so gradients and
optimizer state are kept only for the small number of added parameters; the
frozen weights still occupy memory at 2 or 4 bytes each, but the 16-byte
multiplier no longer applies to all 7 billion.
