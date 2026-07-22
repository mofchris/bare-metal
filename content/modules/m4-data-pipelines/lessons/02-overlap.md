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

## What this lesson answers

Lesson 01 established that a pipeline runs at the speed of its slowest stage.
That is true when the stages take turns. This lesson is about not taking turns.

There are two separate techniques here and they are frequently confused.
Overlap hides the cost of preparation behind computation. Parallelism reduces
the cost of preparation itself. Only one of them helps in any given situation,
and knowing which is the difference between a fix and a wasted afternoon.

## What does prefetching actually do?

Consider the naive arrangement. Prepare batch 1, compute on batch 1, prepare
batch 2, compute on batch 2. Preparation takes 30 ms and computation takes 50
ms, so each step takes 80 ms and the accelerator sits idle for 30 of them.

**Prefetching** changes the arrangement. While the model computes on batch N,
the pipeline is already preparing batch N+1 on the CPU. Those two activities use
different hardware, so they genuinely proceed at the same time.

Now each step takes 50 ms rather than 80. Preparation still costs 30 ms of CPU
time, but that time is spent during computation the accelerator was doing
anyway, so it costs nothing in wall-clock time. The 30 ms did not get faster; it
became invisible.

That is the goal state, and it is worth stating precisely: preparation hidden,
not preparation eliminated.

## How far ahead should the pipeline run?

One batch of lookahead is enough whenever preparation is reliably faster than
computation. If preparation always takes 30 ms and computation always takes 50,
the next batch is always ready in time.

Preparation is not reliably anything, though. An unusually large image, a
boundary between files, or the operating system taking a core all make one
batch slow. This is M2/02's right-skew appearing again: a floor, and an
occasional long tail.

A small buffer absorbs those spikes. Holding 2 to 4 prepared batches means a
single slow batch is covered by the reserve rather than stalling the model.

Buffering further buys very little and costs host memory, because a queue that
is already always full cannot become fuller. Frameworks expose this directly as
PyTorch's `prefetch_factor` and tf.data's `prefetch`.

## When does prefetching stop being enough?

Prefetching hides preparation behind computation. It follows that prefetching
can only hide preparation that is _shorter_ than computation.

Reverse the earlier numbers. Preparation takes 80 ms and computation takes 50.
Overlap them perfectly and each step still takes 80 ms, because the model
finishes and waits 30 ms for the next batch every single time. No amount of
buffering helps, since the buffer drains faster than it fills.

Now preparation itself has to get faster, and the standard tool is **parallel
workers**: several processes, each preparing different samples at the same time.
Processes rather than threads, for the GIL reason from lesson 01.

Adding workers scales throughput roughly linearly at first, because each new
process gets its own core. It stops scaling when some shared resource
saturates: every physical core is busy, memory bandwidth is spent, or the disk
reaches its **IOPS** limit. IOPS means input/output operations per second,
meaning how many separate read requests a drive can service, which is a
different limit from how many bytes per second it can stream.

Past that point, more workers actively hurt. They compete for cores that are
already busy, and each one holds prepared batches in RAM.

The best worker count therefore has to be found by measurement rather than by
formula, because it depends on this laptop's core count, its drive, and the
decode cost of the actual dataset.

## What does full overlap look like?

The transfer stage can overlap too, and two mechanisms make it possible.

**Pinned memory** comes first. Normally an operating system may relocate your
data within physical RAM or move it out to disk, so a copy has to go through the
CPU, which can handle the bookkeeping. Pinning locks those memory pages in
place. Once the data cannot move, a **DMA engine** can read it directly. A DMA
engine is a small piece of hardware that copies memory on its own without
involving the CPU at all. In PyTorch this is `pin_memory=True`.

**Asynchronous transfer** builds on it. Because the DMA engine works
independently, the copy of batch N+1 can travel to the device while the device
computes on batch N. Issuing that copy on a separate **stream**, meaning an
independent queue of device work, lets the two proceed without taking turns.

Fully overlapped, a timeline shows three lanes busy at once, each on a different
batch: CPU workers preparing batch N+2, the bus transferring batch N+1, and the
accelerator computing on batch N.

On a CPU-only laptop the transfer lane does not exist, but the two-lane version,
preparation running alongside computation, is exactly the arrangement described
above.

## Check your understanding

Training steps take 120 ms each. You measure preparation at 90 ms per batch and
computation at 120 ms per batch, with `num_workers=0` and no prefetching. You
enable prefetching with 4 worker processes, and step time drops to 120 ms.

Explain why the step time settled where it did, and predict what happens if the
dataset is replaced with one whose preparation takes 200 ms per batch. A correct
answer says that preparation at 90 ms is shorter than computation at 120 ms, so
overlap hides it entirely and the step is limited by computation at 120 ms;
adding workers beyond that point cannot help because preparation was never the
bottleneck. With 200 ms preparation, preparation becomes the slower stage, so
overlap alone leaves the accelerator waiting 80 ms per step, and the fix is more
workers or cheaper per-sample work rather than more buffering.
