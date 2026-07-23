---
id: m10/04-execution-providers
title: "Execution providers and threading — mapping a graph onto this machine"
objectives:
  - "Explain what an execution provider is and how one graph can run across several"
  - "Explain the two kinds of threading in a runtime and which one a single request uses"
  - "Reason about why more threads can make a single inference slower, using M1 and M6"
sources:
  - "ONNX Runtime docs: execution providers (onnxruntime.ai/docs/execution-providers)"
  - "ONNX Runtime docs: thread management and performance tuning (onnxruntime.ai/docs/performance)"
  - "Intel oneDNN and the CPU execution provider (oneapi-src.github.io/oneDNN)"
---

## What this lesson answers

The previous lessons produced an optimized graph. This one is about running it on
actual hardware, which is the last step and the one with the most knobs.

Two ideas cover it. First, a runtime does not have one built-in way to execute
each operation; it has pluggable back-ends for different hardware, and it maps the
graph onto whichever are available. Second, how many threads it uses is a real
decision with a non-obvious answer, and getting it wrong can make a single
inference slower rather than faster. Both connect straight back to M1 and M6.

## What is an execution provider?

An **execution provider** is a back-end that knows how to run graph operations on
a particular kind of hardware. ONNX Runtime has a CPU execution provider, a CUDA
one for NVIDIA GPUs, others for various accelerators, and it can use several in
one run.

The mechanism is worth seeing, because it is more flexible than "pick a device".
When the runtime loads a graph, it asks the available providers which operations
each can run, in a priority order you set. A provider claims the operations it
supports; anything left over falls to the next provider, and ultimately to the
CPU provider, which supports everything as a fallback.

So one graph can run split across providers. Most of it might run on a GPU
provider, with a handful of operations that provider does not support falling back
to the CPU provider. This is the same fallback idea as M8/04's graph breaks, one
level down: where torch.compile fell back to eager Python, the runtime falls back
to a provider that can handle the operation.

That flexibility has a cost worth knowing. Every time execution crosses from one
provider to another — GPU to CPU and back — the data has to move between their
memories, which is M4/01's host-device transfer over a bus with its own bandwidth
ceiling. A graph that bounces repeatedly between providers can spend more time
moving data than it saves, so a provider claiming most but not all of a graph is
not automatically faster than the CPU doing all of it. Which, again, is a
measurement (M2, M7).

On this laptop, with no NVIDIA GPU, the relevant provider is the CPU one, and it
is a genuinely optimized back-end using the SIMD and multi-core ideas from M1.

## What are the two kinds of threading?

A runtime running on a multi-core CPU has two independent ways to use threads,
and confusing them is the source of most tuning mistakes.

**Intra-operation threading** parallelizes the work inside a single operation. A
large matrix multiply is split across several threads that each compute part of
the result, exactly the data-parallel work M1/05 described. This is what makes one
big operation use multiple cores.

**Inter-operation threading** runs different operations of the graph at the same
time, when the graph structure allows it. If two branches of the graph do not
depend on each other, their operations can run on different threads
concurrently — the same independence M1/02 exploited for instruction-level
parallelism, now at the level of whole operations.

The distinction that matters for tuning: a single inference of a typical
sequential model is mostly served by intra-operation threading, because most
models are a chain where each operation needs the previous one's output, leaving
little for inter-operation threading to run in parallel. So for one request at a
time, the intra-operation thread count is the knob that matters.

## Why can more threads make one inference slower?

This is the counterintuitive result, and M1 and M6 together explain it fully.

The naive expectation is that more threads is always faster. It is not, and there
are three reasons, each already established.

**Not all work parallelizes, and coordination costs.** Splitting an operation
across threads requires dividing the work and combining the results, which is
overhead that grows with thread count. Past some point, adding a thread adds more
coordination than computation, the plateau M4/02 found for DataLoader workers,
here inside a single operation.

**Threads contend for shared hardware.** M6/04 established that hyper-threaded
logical cores share execution units and cache, and that dense arithmetic on both
siblings runs at half speed each. A matrix multiply split across more threads than
there are physical cores puts contending threads on shared units and shrinks each
one's cache share, so it can run slower, not faster.

**Memory bandwidth is finite.** M1/03 established that a memory-bound operation is
limited by bandwidth, not compute. Adding threads to a memory-bound operation adds
demand for a bandwidth that is already saturated, so the threads wait on memory
together and finish no sooner.

The practical consequence is that the best thread count is found by measurement,
and it is often fewer than the total logical core count — frequently around the
physical core count for compute-bound work, and sometimes lower for memory-bound
work. Setting it to the advertised core count because that number is largest is
the mistake M6/04 warned about, now with a concrete place to make it.

## How does this land for serving?

One connection forward, because M12 builds on it.

Everything above is about serving one request. A server handling many requests at
once has a second dimension: it can run several inferences concurrently, each
using few threads, or fewer inferences each using many threads. That is a
throughput-versus-latency dial in the exact sense of M2/04, and it interacts with
the thread settings here. M12 takes up how to turn these knobs under real request
load; this lesson gives you what a single inference does with the threads it is
given.

## Check your understanding

You benchmark a compute-bound model in ONNX Runtime on this laptop, which has a
handful of physical cores plus hyper-threading. You set the intra-operation
thread count to the full logical core count expecting the best speed, but a lower
setting turns out faster.

Explain why, drawing on M6 and M1. A correct answer says the full logical count
includes hyper-threaded siblings that share execution units and cache (M6/04), so
splitting a compute-bound matrix multiply across more threads than physical cores
puts contending threads on the same units and shrinks each thread's cache share,
running slower rather than faster; coordination overhead of dividing and combining
the work also grows with thread count, past the point where it exceeds the added
computation. The best count is found by measurement and is often near the physical
core count, which is exactly the trap M6/04 named about reading the advertised
core number.
