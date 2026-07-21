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

## The half of training nobody benchmarks

A training step is really two programs running in tandem: the model's maths,
and the machinery that gets each batch _to_ the maths. That machinery — the
**input pipeline** — is pure classical systems: reading files, decoding
formats, copying memory, moving things through queues. When it falls behind, a
five-figure accelerator sits idle waiting on it, and Mohan et al. measured
exactly that happening in a large fraction of real training jobs. This module
is about noticing it, measuring it (M2), and fixing it.

## Anatomy of one sample's journey

A **sample** is one training example — one image, one sentence, one row. For
an image dataset it passes through five stages:

1. **Read** — pull the bytes off disk or network (an M1 story: reading in
   order is fast, jumping around is not — lesson 03 exploits this).
2. **Decode** — turn compressed JPEG bytes into an actual grid of pixel
   values. Deceptively expensive: milliseconds of real CPU work per image,
   because JPEG decoding is genuine computation, not a copy. (It undoes two
   compression steps — a variable-length code for the bits, and a
   frequency-domain transform for the pixels. What matters here is only that
   it is arithmetic, and there's a lot of it.)
3. **Transform/augment** — resize, crop, flip, normalize. **Augmentation**
   means deliberately varying each sample slightly every **epoch** — one
   epoch being one full pass over the whole dataset — so the model sees more
   variety than the dataset literally contains. More per-sample CPU
   arithmetic, on the CPU's time.
4. **Collate** — stack N samples into one batch tensor. A big memory copy, so
   it spends M1's bandwidth budget on the **host** — the CPU and its RAM, as
   opposed to the **device**, the accelerator and its own separate memory.
5. **Transfer** — host memory → device memory, over a bus (the physical
   connection between them) that has its own bandwidth ceiling.

Text pipelines swap decode for tokenization; tabular data swaps it for
parsing. The shape is identical: a chain of stages, each consuming CPU time,
memory bandwidth, or disk.

## The pipeline law

A chain processes at the rate of its **slowest stage** — the bottleneck.
Speeding up any other stage changes nothing (Amdahl, M2/03, in pipeline
clothes). So pipeline engineering is really two skills: _find_ the bottleneck
stage (lesson 04's whole topic), and _widen_ it — more parallel workers,
cheaper work per sample, or work moved elsewhere (decode on the GPU, augment
ahead of time, cache whatever repeats).

## Why the CPU is chronically the underdog

Accelerators improved faster than CPUs for a decade, and one accelerator is
typically fed by a handful of CPU cores that also have to run your Python.
That's worse than it sounds, because of the **GIL** (global interpreter lock):
a lock inside CPython that lets only one thread execute Python bytecode at a
time. Threads therefore don't buy you parallel Python work, no matter how many
cores you own.

Which is why PyTorch's DataLoader uses worker _processes_ rather than threads
(the `num_workers` setting) — separate processes each get their own
interpreter and their own GIL, so they genuinely decode samples side by side.
The practical consequence you'll measure in lab L4.1: a "slow model" is very
often a fast model behind a slow kitchen.

## The mental model to carry forward

Producer (the CPU pipeline) and consumer (the accelerator), connected by a
queue. Everything in the next lesson — prefetching, overlap, workers — is
about keeping that queue from ever being the reason anyone waits.
