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

## What this lesson answers

Lessons 01 to 03 gave you three ways to make a pipeline faster. Applying any of
them to a pipeline that was never the problem wastes the effort entirely.

So one question comes before all the others: is the model waiting on data, or is
data waiting on the model? This lesson answers it two ways, one experimental and
one observational, and then covers the ways pipeline benchmarks lie.

## What is the one experiment that settles it?

Replace the real pipeline with a fake one. Generate a single batch of random
numbers once, hold it in memory, and feed that same batch to the model over and
over. There is no reading, no decoding, no augmenting and no collating.

Then time training both ways. There are exactly two outcomes and each one tells
you what to do next.

**If both versions run at the same speed**, the pipeline was never the limit.
The model was already the bottleneck, so you are compute-bound. Stop working on
the pipeline entirely and go optimize the model.

**If the fake version is faster**, the difference is your data stall, measured
directly rather than inferred. Suppose a real step takes 100 ms and a synthetic
step takes 70 ms. The model needs only 70 ms of that, so 30 ms of every 100 ms
was the accelerator sitting idle, which is 30% of its time.

This experiment is cheap, it is unambiguous, and it is a properly controlled
comparison in the sense of M2: exactly one thing changed, everything else held
identical.

## What can you tell without changing any code?

**Utilization** is the fraction of time a piece of hardware spent doing work
rather than waiting. It is what the percentages in a task manager or in
`nvidia-smi` report.

Watch the accelerator's utilization during training and look at its shape rather
than its average. Utilization that **sawtooths**, meaning it climbs to busy,
drops to idle, and climbs again in a repeating pattern, is the signature of
stalling at batch boundaries. The queue empties, the model waits, the queue
refills.

Once you see that pattern, look at the producer side to find which stage is
responsible.

If every DataLoader worker core is pegged at 100%, preparation is the
bottleneck, so widen it with more workers or cheaper per-sample work.

If the worker cores are mostly idle while the disk is at 100%, you are limited
by reading, so the fix is in lesson 03: pack shards, or compress less.

If nothing is saturated and everything idles in turns, the likely cause is
serialization. Some stage is running under a lock so only one thing proceeds at
a time, or there are simply too few workers to keep the chain occupied.

A timeline profiler gives the same diagnosis with more precision. PyTorch's
annotates DataLoader activity, so the gap between "data ready" and "step start"
is directly visible per step.

## What lies do pipeline benchmarks tell?

Three, and all three are M2 patterns in pipeline clothing.

**The first epoch is a different program.** After one pass over the data, the
operating system holds recently read files in spare RAM, in what is called the
**page cache**. Epoch two therefore reads from memory at DRAM speed and may not
touch the disk at all. Benchmarking epoch 2 tells you nothing about how the job
behaves on cold storage; benchmarking epoch 1 tells you nothing about its steady
state. Decide which question you are asking, and say which one you measured.

**Warmup includes the pipeline, not just the model.** Worker processes have to
be spawned, prefetch buffers have to fill, and shard file handles have to open.
The first dozen steps are measuring startup rather than throughput.

**Stalls hide in the tail.** A pipeline that keeps up almost always and starves
occasionally has a healthy median and an ugly p95, and averaging the steps
together conceals exactly the events you were looking for. Record a series of
per-step times and look at its distribution, as M2/02 required.

## Check your understanding

A training job runs at 100 ms per step. You rerun it with synthetic data and it
takes 100 ms per step. A colleague suggests adding more DataLoader workers and
switching the dataset to sharded storage.

Say what the synthetic-data result proves, evaluate the colleague's suggestion,
and say where the effort should go instead. A correct answer says that identical
timings prove the pipeline was already keeping up and the job is compute-bound,
so the accelerator never waits on data; that adding workers and resharding
addresses a bottleneck that does not exist and will change end-to-end step time
by nothing; and that the effort belongs in the model itself, found by profiling
the training step as in M2/03.
