---
id: m1/05-gpus-overview
title: "GPUs from 10,000 feet — throughput machines vs latency machines"
objectives:
  - "Contrast how CPUs and GPUs each deal with memory latency"
  - "Explain SIMT execution and what a warp is"
  - "Predict whether a workload fits the GPU model, and say why"
sources:
  - "NVIDIA CUDA C++ Programming Guide, ch. 'Hardware Implementation' (docs.nvidia.com/cuda)"
  - "Hennessy & Patterson, Computer Architecture: A Quantitative Approach, 6th ed., ch. 4 (data-level parallelism, GPUs)"
---

## Two answers to the same problem

Lesson 01 posed the problem: memory is ~100× slower than arithmetic. The CPU
lessons showed one answer — **hide latency for a single thread**: big caches,
prediction, out-of-order execution, all spending silicon to keep _one_ stream
of work unblocked. Call that a **latency machine**.

The GPU gives the opposite answer: **don't hide the wait — outnumber it**.
Instead of a handful of heavyweight cores, provide tens of thousands of
simple execution lanes and keep _far more threads resident than lanes_. When
a group of threads stalls on memory, the scheduler swaps in another group in
a single cycle. With enough threads in flight, the memory latency is still
there — it's just always someone else's problem. Call that a **throughput
machine**: each individual thread runs _slower_ than on a CPU; the aggregate
runs orders of magnitude faster.

## SIMT: how the lanes are organized

GPU threads execute in fixed lockstep groups — NVIDIA calls a group of **32
threads a warp** — all running the same instruction on different data (SIMT:
single instruction, multiple threads). It's SIMD wearing a thread costume,
and the costume has a price: if threads in a warp take different `if`
branches, the warp runs _both_ paths with lanes masked off. Divergent, branchy
code can waste most of the machine. Regular, uniform code — "do the same
arithmetic to every element of this tensor" — wastes none of it.

## The memory side is also built for throughput

GPU DRAM (HBM on datacenter parts) delivers on the order of **1–3 TB/s** —
ten to thirty times a laptop's ~100 GB/s. The roofline from lesson 04 applies
unchanged, just with bigger numbers: a card with 50 TFLOPS of fp32 and 2 TB/s
of bandwidth has its ridge point at 25 FLOPs/byte. Higher peaks, same
physics, same plot — and still, elementwise ops sit memory-bound even on an
H100. There is no hardware where low arithmetic intensity is free.

## Why ML and GPUs found each other

A training step is dominated by matrix multiplies over big tensors: enormous,
regular, branch-free, data-parallel work with reuse that scales with size
(lesson 03). That is _exactly_ the shape a throughput machine wants. The fit
is so good that modern GPUs grew dedicated matmul hardware (tensor cores) —
covered properly in M8.

And the mirror image — what does NOT fit: branchy sequential logic, small
irregular workloads, anything without enough parallel work to keep tens of
thousands of lanes busy. A batch of one token being decoded from an LLM has
painfully little parallelism per step — a preview of why inference serving
(M7) is its own discipline.

## Where this leaves you

You now hold the complete mental frame of M1: a memory hierarchy fighting a
100× gap (L01), a latency machine's tricks (L02), three budgets and the
exchange rate between them (L03), the one plot that unifies them (L04), and
the throughput machine that bets everything on parallelism (L05). M8 opens
the GPU up properly — memory coalescing, occupancy, kernel anatomy. Until
then, every lab in the next modules runs on the latency machine in front of
you, where honest measurement is possible.
