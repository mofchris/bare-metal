---
id: m4/02-overlap
title: "Overlap: hiding the kitchen behind the meal"
objectives:
  - "Explain prefetching and why one batch of lookahead often suffices"
  - "Explain what DataLoader workers parallelize and how many to use"
  - "Describe the full overlap ideal: read, prep, transfer, and compute all concurrent"
sources:
  - "Murray et al., tf.data: A Machine Learning Data Processing Framework, VLDB 2021"
  - "PyTorch docs: DataLoader num_workers, prefetch_factor, pin_memory"
  - "Mohan et al., Analyzing and Mitigating Data Stalls in DNN Training, VLDB 2021"
---

## The restaurant that never makes you wait

A well-run kitchen starts your next course while you're still eating this one.
The input pipeline's version is **prefetching**: while the model computes on
batch N, the pipeline is already preparing batch N+1. If preparing a batch
takes less time than computing one, the model _never waits_ — the pipeline's
entire cost vanishes behind compute.

That's the goal state: data prep hidden, not merely fast. (This is M1's
latency-hiding idea — the GPU keeping other warps busy while one waits on
memory — replayed one level up the stack.)

## How much lookahead?

One batch of lookahead suffices _if_ prep time is reliably less than compute
time. Real prep times vary — a shard boundary, an unusually large image, the
OS scheduler taking a core (M2's right-skew again) — so a small buffer of 2–4
batches absorbs the spikes. Buffering further buys little and costs host
memory: a queue that's always full doesn't get any fuller. Frameworks encode
this directly: PyTorch's `prefetch_factor`, tf.data's `prefetch(AUTOTUNE)`.

## Workers: widening the slow stage

Prefetching hides prep time; it doesn't shrink it. When one CPU core can't
prepare a batch faster than the model consumes one, add **parallel workers** —
separate processes (the GIL, lesson 01) each decoding different samples at the
same time.

Throughput scales roughly linearly with worker count until some shared
resource saturates: all physical cores busy, the disk at its **IOPS** limit
(input/output operations per second — how many separate read requests the
drive can service, which is a different limit from how many bytes per second
it can stream), or memory bandwidth spent. Past that point more workers just
add contention and RAM, since each worker holds batches in flight.

The plateau is something you'll find experimentally in lab L4.1 rather than by
formula, because it depends on this laptop's core count, its SSD, and the
decode cost of the actual dataset.

## The transfer stage overlaps too

Host→device copies ride a bus with its own bandwidth budget. Two standard
tricks:

**Pinned memory** (`pin_memory=True`). Normally the OS is free to move your
data around in physical RAM, or push it out to disk, so a copy has to go
through the CPU to be safe. Pinning locks those pages in place, which lets the
**DMA engine** — a small piece of hardware that copies memory on its own
without involving the CPU — read them directly. Faster copies, and a
prerequisite for the second trick.

**Async transfer**, where the copy of batch N+1 happens alongside the compute
of batch N, on a separate **stream** — an independent queue of GPU work, so
two things the device can do at once don't have to take turns.

Fully overlapped, the timeline shows three lanes — CPU prep, bus transfer,
accelerator compute — all busy, all working on different batches. On this
laptop (CPU-only labs) the transfer lane is a no-op, but the two-lane version
(prep alongside compute) is exactly what lab L4.1 builds.

## What overlap cannot do

Overlap hides prep that is _cheaper than compute_. If prep is fundamentally
more expensive — heavy augmentation feeding a small model — no amount of
buffering saves you: the pipeline law (lesson 01) says the slow stage sets the
rate.

The fixes are then structural: cheaper decode (smaller images, better codecs),
pre-computing augmentations once instead of every epoch, caching decoded
samples in RAM after the first epoch, or moving the work onto the accelerator
itself. Knowing
_which_ situation you're in is a measurement question — lesson 04.
