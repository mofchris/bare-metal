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

A well-run kitchen starts your next course while you eat this one. The
input pipeline's version is **prefetching**: while the model computes on
batch N, the pipeline prepares batch N+1. If preparing a batch takes less
time than computing one, the model _never waits_ — the pipeline's entire
cost vanishes behind compute. That's the goal state: data prep hidden, not
merely fast. (This is M1's latency-hiding idea — the GPU hiding memory
latency behind other warps — replayed one level up the stack.)

## How much lookahead?

One batch of lookahead suffices _if_ prep time < compute time consistently.
Real prep times vary (a shard boundary, a huge image, a scheduler hiccup —
M2's right-skew again), so a small buffer of 2–4 batches absorbs the
spikes. Buffering further buys little and costs host memory: a queue that's
always full doesn't get fuller. Frameworks encode this: PyTorch's
`prefetch_factor`, tf.data's `prefetch(AUTOTUNE)`.

## Workers: widening the slow stage

Prefetching hides prep time; it doesn't shrink it. When one CPU core can't
prep a batch faster than the model eats it, add **parallel workers** —
separate processes (GIL, lesson 01) each decoding different samples.
Throughput scales roughly linearly until a shared resource saturates: all
physical cores busy, disk at its IOPS limit, or memory bandwidth spent.
Past that point more workers just add contention and RAM (each worker holds
batches in flight) — the plateau you'll find experimentally in lab L4.1
rather than by formula, because it depends on this laptop's core count,
SSD, and the decode cost of the actual dataset.

## The transfer stage overlaps too

Host→device copies ride a bus (its own bandwidth budget). Two standard
tricks: **pinned memory** (`pin_memory=True`) locks host pages so the DMA
engine can read them directly — faster copies, and a prerequisite for
**async transfer**, where the copy of batch N+1 rides alongside the compute
of batch N on a separate stream. Fully overlapped, the timeline shows three
lanes — CPU prep, bus transfer, accelerator compute — all busy, all on
different batches. On this laptop (CPU-only labs) the transfer lane is a
no-op, but the two-lane version (prep ∥ compute) is exactly what lab L4.1
builds.

## What overlap cannot do

Overlap hides prep that is _cheaper than compute_. If prep is fundamentally
more expensive — heavy augmentation on a small model — no amount of
buffering saves you: the pipeline law (lesson 01) says the slow stage sets
the rate, and the fixes are structural: cheaper decode (smaller images,
better codecs), pre-computing augmentations, caching decoded samples in RAM
after epoch one, or moving work onto the accelerator itself. Knowing
_which_ situation you're in is a measurement question — lesson 04.
