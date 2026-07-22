---
id: m4/01-input-pipeline
title: "The input pipeline: where the time actually goes"
objectives:
  - "Name the stages a training sample passes through before the model sees it"
  - "Explain why decode and augmentation are usually the expensive stages"
  - "State the pipeline law: throughput is set by the slowest stage"
sources:
  - "Murray et al., tf.data: A Machine Learning Data Processing Framework, VLDB 2021"
  - "Mohan et al., Analyzing and Mitigating Data Stalls in DNN Training, VLDB 2021"
  - "PyTorch docs: torch.utils.data (DataLoader, Dataset)"
---

## What this lesson answers

Modules 1 to 3 were about the arithmetic: how fast a machine can compute, how
to measure it honestly, and what its numbers can represent.

None of that matters if the arithmetic unit has nothing to work on. A training
step needs a batch of data in memory before it can start, and assembling that
batch is a separate program running alongside the model. Mohan and colleagues
measured real training jobs and found a large fraction of them limited by this
second program rather than by the model.

This lesson covers what that program does, and which part of it is usually slow.

## What happens to one sample before the model sees it?

A **sample** is one training example: one image, one sentence, one row of a
table. For an image dataset, a sample passes through five stages.

**Read.** The bytes are pulled off disk or across a network. This is an M1
story with larger constants: reading in the order data was written is fast,
jumping between distant positions is slow.

**Decode.** Compressed JPEG bytes are turned into an actual grid of pixel
values. This is the surprising one, because it looks like reading a file and is
not. A JPEG is stored as compressed frequency information, so decoding it means
running real arithmetic over every block of the image to reconstruct the
pixels. It costs milliseconds of CPU per image, which is thousands of times
more than a copy of the same bytes would cost.

**Transform and augment.** The image is resized, cropped, flipped and
normalized. **Augmentation** means deliberately varying each sample slightly
every **epoch**, where one epoch is one full pass over the whole dataset, so the
model sees more variety than the dataset literally contains. Every one of those
variations is more CPU arithmetic per sample.

**Collate.** N samples are stacked into a single batch tensor. This is a large
memory copy, so it spends the bandwidth budget of M1/03 on the **host**, which
is the CPU and its RAM, as distinct from the **device**, which is the
accelerator and its own separate memory.

**Transfer.** The batch is copied from host memory to device memory over a bus,
which is the physical connection between them and has its own bandwidth
ceiling.

Text pipelines replace decode with tokenization and tabular data replaces it
with parsing, but the shape is identical: a chain of stages, each consuming CPU
time, memory bandwidth, or disk.

## Why does the slowest stage decide everything?

A chain of stages processes at the rate of its slowest stage. That stage is
called the **bottleneck**.

The reason is that stages run concurrently but cannot outpace their supply. If
decode produces 200 images per second and every other stage could handle 2000,
then nothing downstream ever receives more than 200 per second, no matter how
fast it is capable of running.

This is Amdahl's law from M2/03 wearing different clothing, and it has the same
practical consequence: optimizing any stage other than the bottleneck changes
the total by nothing at all.

So pipeline work is two skills. Find which stage is the bottleneck, which is
lesson 04's entire subject. Then widen it, by adding parallel workers, by making
the per-sample work cheaper, or by moving the work somewhere else.

## Why is the CPU usually the one that falls behind?

Two forces push in the same direction.

First, accelerators improved faster than CPUs for over a decade. A single modern
accelerator can consume batches faster than the handful of CPU cores feeding it
can produce them.

Second, those same CPU cores have to run Python, and Python cannot use them
properly. CPython contains the **GIL**, or global interpreter lock, which allows
only one thread to execute Python instructions at a time. Adding threads
therefore adds no parallel Python work regardless of how many cores you own.

PyTorch's answer is visible in its interface. The DataLoader's `num_workers`
setting spawns worker _processes_ rather than threads, because separate
processes each get their own interpreter and their own GIL, so they genuinely
decode samples side by side.

The practical consequence is worth internalising before you ever debug it: a
model that appears slow is very often a fast model waiting on a slow kitchen.

## Check your understanding

A training job processes 400 images per second. Profiling the input pipeline
shows: read at 3000 images/sec, decode at 450 images/sec, augment at 1200
images/sec, collate at 5000 images/sec.

Identify the bottleneck, predict what happens to end-to-end throughput if you
make reading twice as fast, and name two ways to widen the real bottleneck. A
correct answer identifies decode at 450 images/sec as the slowest stage; states
that doubling read speed from 3000 to 6000 changes end-to-end throughput by
nothing, because decode still caps the chain at 450; and names two of: more
DataLoader worker processes to decode in parallel, cheaper decode by storing
smaller images, decoding on the accelerator, or caching decoded samples after
the first epoch.
