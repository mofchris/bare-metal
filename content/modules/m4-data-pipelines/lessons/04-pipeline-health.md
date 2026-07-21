---
id: m4/04-pipeline-health
title: "Pipeline health: who is waiting on whom?"
objectives:
  - "Run the synthetic-data experiment and interpret both possible outcomes"
  - "Diagnose input-bound vs compute-bound training from utilization signals"
  - "Name the measurement traps specific to pipeline benchmarking"
sources:
  - "Mohan et al., Analyzing and Mitigating Data Stalls in DNN Training, VLDB 2021"
  - "PyTorch profiler docs (pytorch.org/docs/stable/profiler); tf.data performance guide"
---

## The one question that orders all the others

Every pipeline investigation starts the same way: **is the model waiting on
data, or is data waiting on the model?** Only one of those is a problem worth
fixing, and everything in lessons 01–03 only matters in the first case. M2
taught the discipline; this lesson is its application.

## The decisive experiment: synthetic data

Replace the real pipeline with a fake one — a single batch of random numbers,
generated once and served over and over, so there is zero reading, zero
decoding, zero collating — and time training both ways:

- **Same speed with fake data** → the pipeline was never the limit. You are
  compute-bound; close this module and go optimize the model.
- **Fake data much faster** → the gap _is_ your data stall, measured directly.
  A 30% gap means 30% of your accelerator's time was idle waiting for input.

This experiment is cheap, unambiguous, and the single highest-value diagnostic
in this module — lab L4.2's centerpiece. It's also a controlled comparison in
M2's sense: exactly one variable (the pipeline) changed, everything else held
identical.

## Reading the utilization signals

**Utilization** means the fraction of time a piece of hardware was actually
doing work rather than sitting idle — it's what the percentages in a task
manager or `nvidia-smi` report.

Without touching code, watch per-stage utilization during training.
Accelerator utilization that **sawtooths** — busy, idle gap, busy, idle gap,
tracing a repeating up-down pattern — is the signature of stalls at batch
boundaries: the queue empties, everyone waits, it refills.

Then look at the producer side to find which stage is responsible:

- All DataLoader worker cores pegged at 100% → prep is the bottleneck (widen
  it, lesson 02).
- Cores idle but the disk at 100% → you're I/O bound (pack shards, lesson 03).
- Everything idle in turns, nothing saturated → likely serialization: some
  stage running under a lock so only one thing proceeds at a time, or simply
  too few workers to keep the chain full.

Timeline profilers (PyTorch's, which annotates DataLoader activity) show the
same story with more precision: per-step gaps between "data ready" and "step
start."

## Pipeline-specific measurement traps

Three ways to lie to yourself, all M2 patterns wearing pipeline clothes:

1. **The first epoch is a different program.** After epoch one, the OS **page
   cache** holds recently read files in spare RAM — so epoch two reads from
   memory at DRAM speed, never touching the disk at all. Benchmarking epoch 2
   tells you nothing about cold I/O; benchmarking epoch 1 tells you nothing
   about steady state. Decide which question you're asking, and state it
   (warmup discipline, M2/01).
2. **Warmup includes the pipeline.** Worker processes have to spawn, buffers
   have to fill, shard file handles have to open — the first dozen steps are
   startup cost, not throughput.
3. **The tail is where stalls live.** A pipeline that's fast on median and
   occasionally starves shows up in p95 step time, not in the mean (M2/02's
   skew, again). A series of per-step times beats an aggregate average here,
   because the aggregate averages the stalls away.

## The module, closed

Feeding the model is a chain of classical systems stages (L01); overlap
hides their cost when they're cheap enough (L02); layout and packing decide
the I/O floor (L03); and one synthetic-data experiment plus utilization
eyes tell you who's actually waiting (L04). With M5, the story moves inside
the training step itself — what backprop costs and where the memory goes.
