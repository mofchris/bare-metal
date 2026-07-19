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

A training step is really two programs running in tandem: the model's math,
and the machinery that gets each batch _to_ the math. That machinery — the
**input pipeline** — is pure classical systems: file I/O, codecs, memory
copies, queues. When it falls behind, a five-figure accelerator sits idle
waiting on it, and Mohan et al. measured exactly that happening in a large
fraction of real training jobs. This module is about noticing, measuring
(M2), and fixing it.

## Anatomy of one sample's journey

For an image dataset, a sample passes through five stages:

1. **Read** — bytes off disk or network (an M1 story: sequential reads are
   fast, random seeks are not — lesson 03 exploits this).
2. **Decode** — JPEG bytes → pixel tensor. Deceptively expensive:
   milliseconds of real CPU per image, because JPEG decoding is actual
   computation (entropy decoding, IDCT), not a copy.
3. **Transform/augment** — resize, crop, flip, normalize. More per-sample
   CPU arithmetic, on the CPU's time.
4. **Collate** — stack N samples into one batch tensor (a big memory copy —
   M1's bandwidth budget, spent on the host).
5. **Transfer** — host memory → accelerator memory, over a bus that has its
   own bandwidth ceiling.

Text pipelines swap decode for tokenization; tabular swaps it for parsing.
The shape is identical: a chain of stages, each consuming CPU, memory
bandwidth, or I/O.

## The pipeline law

A chain processes at the rate of its **slowest stage** — the bottleneck.
Speeding up any other stage changes nothing (Amdahl, M2/03, in pipeline
clothes). So pipeline engineering is really two skills: _find_ the
bottleneck stage (lesson 04's whole topic), and _widen_ it — more parallel
workers, cheaper work per sample, or work moved elsewhere (decode on GPU,
augment ahead of time, cache what repeats).

## Why the CPU is chronically the underdog

Accelerators improved faster than CPUs for a decade, and one accelerator is
typically fed by a handful of CPU cores that also run Python — where the
**GIL** (global interpreter lock) prevents true thread parallelism for
Python-level work, which is why PyTorch's DataLoader uses worker
_processes_, not threads (`num_workers`), each decoding samples
independently. The practical consequence you'll measure in lab L4.1: a
"slow model" is very often a fast model behind a slow kitchen.

## The mental model to carry forward

Producer (CPU pipeline) and consumer (accelerator) connected by a queue.
Everything in the next lesson — prefetching, overlap, workers — is about
keeping that queue from ever being the reason anyone waits.
