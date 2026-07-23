---
id: m9/04-pruning
title: "Pruning — structured vs unstructured, and why sparsity is not speed"
objectives:
  - "Explain what pruning removes and why a pruned model can be no faster"
  - "Distinguish unstructured from structured pruning by what each produces and what hardware can exploit"
  - "Explain why the fraction of weights removed is a misleading measure of the win"
sources:
  - "Han, Mao & Dally, Deep Compression, ICLR 2016"
  - "Blalock et al., What is the State of Neural Network Pruning?, MLSys 2020"
  - "Hoefler et al., Sparsity in Deep Learning, JMLR 2021"
---

## What this lesson answers

Quantization made each number smaller. Pruning takes a different route to a
smaller model: it removes numbers entirely, setting weights to zero and
discarding them.

The idea is appealing and the trap is severe. It is easy to remove 90% of a
model's weights and find it runs at exactly the same speed. This lesson is about
why that happens, and what has to be true for removed weights to actually become
saved time.

## What does pruning remove, and why might it be free to accuracy?

**Pruning** sets a chosen subset of a model's weights to zero. A weight that is
zero contributes nothing to any output, so it can be removed from the model
without changing what the model computes, once you account for it being zero.

The reason this can be nearly free to accuracy is that trained networks are
usually **over-parameterized**: they have far more weights than the task
strictly needs, and many end up small enough that their contribution is
negligible. Removing the smallest-magnitude weights, which is the simplest
pruning rule, discards mostly-inconsequential connections. Deep Compression
showed models tolerating large fractions of their weights removed with little
accuracy loss, often after a short retraining to let the survivors compensate.

So the accuracy side of pruning frequently works. The speed side is where the
trouble is, and it is the whole point of this lesson.

## Why can removing 90% of the weights save no time at all?

Here is the trap, stated as sharply as possible: a model with 90% of its weights
set to zero can run at exactly the same speed as the original.

The reason is how the zeros are arranged. Removing the smallest-magnitude
weights scatters the zeros all over the model, wherever a small weight happened
to be. This is called **unstructured pruning**, and it produces a weight matrix
that is mostly zeros but with the zeros in no particular pattern.

Now recall what M1 said about how hardware actually multiplies. The matrix
multiply runs as dense arithmetic over contiguous memory, using SIMD lanes and
full cache lines. A zero in the middle of that is still a number the hardware
loads and multiplies. It multiplies by zero and adds zero, which changes the
result by nothing and saves nothing, because the load, the multiply and the add
all still happened.

To skip a zero, the hardware would have to check each weight, branch on whether
it is zero, and skip the multiply if so. M1/02 priced exactly why that is a bad
trade: the branch per element is unpredictable, and the checking costs more than
the multiply it might save. So dense hardware runs the pruned matrix at dense
speed, zeros and all. The memory footprint can shrink if the zeros are stored
compactly, but the compute does not.

## What does structured pruning do differently?

**Structured pruning** removes weights in whole groups that the hardware can
actually skip: an entire channel, an entire row of a weight matrix, an entire
attention head.

The difference is the arrangement, and it is everything. When you remove a whole
output channel, the matrix that produces it genuinely becomes smaller — it has
fewer rows — and a smaller dense matrix multiply is straightforwardly faster,
because there is simply less arithmetic and less memory traffic, with no
per-element checking and no unpredictable branches. The hardware runs a smaller
dense operation at full efficiency.

The cost of structured pruning is that it is coarser, and therefore harder on
accuracy. Removing one scattered small weight is nearly free; removing an entire
channel removes many weights at once, including some that mattered, so the same
overall sparsity hurts accuracy more when taken in structured chunks. You are
trading accuracy headroom for a speedup that unstructured pruning could not
deliver at all.

There is a middle path worth naming. Some hardware supports specific fixed
sparsity patterns — for example, a rule that exactly two of every four weights
are zero — which is structured enough for that hardware to skip the zeros while
being fine-grained enough to hurt accuracy less than removing whole channels.
This only helps on hardware built for that exact pattern, which is the recurring
theme: sparsity becomes speed only when the hardware can exploit the specific
shape of the zeros.

## Why is "percent of weights removed" a misleading number?

This is the reporting lesson, and it connects straight to M7.

A claim like "we pruned 90% of the weights" measures the wrong thing. It counts
zeros, and M1 just showed that zeros are not automatically time saved. The
number that matters is the measured speedup on the target hardware, and for
unstructured pruning on dense hardware that speedup is often approximately none,
regardless of how impressive the sparsity fraction sounds.

M7's discipline applies directly. The honest claim states the speedup, on named
hardware, against a baseline, and does not let the sparsity percentage stand in
for a performance result it does not imply. A 90% sparsity figure paired with no
latency measurement is a marketing sentence. The same 90% paired with "and it
runs 3× faster on this GPU's structured-sparsity support, with a 1% accuracy
drop" is a result.

## Check your understanding

A colleague reports that they pruned a model to 85% sparsity by zeroing its
smallest weights, and is surprised that inference on the laptop CPU is no faster
than before, though the saved model file is smaller.

Explain both observations, and say what kind of pruning would have produced a
speedup. A correct answer says that zeroing the smallest weights is unstructured
pruning, scattering the zeros with no pattern, and that a dense CPU matrix
multiply still loads and multiplies each zero because checking and branching to
skip it would cost more than the multiply (M1/02), so the compute is unchanged;
the file shrinks only because the scattered zeros can be stored compactly.
Structured pruning, removing whole channels or rows, would have made the matrix
genuinely smaller, giving a faster dense operation, at the cost of more accuracy
loss for the same sparsity. It should note that the honest metric is measured
speedup on the target hardware, not the sparsity percentage (M7).
