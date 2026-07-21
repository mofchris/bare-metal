---
id: m1/04-roofline-model
title: "The roofline model — knowing your speed limit"
objectives:
  - "State the roofline formula and compute attainable performance for a given kernel"
  - "Locate the ridge point of a machine and say what it separates"
  - "Choose the right optimization direction (reuse vs arithmetic) from a kernel's position under the roof"
sources:
  - "Williams, Waterman & Patterson, Roofline: An Insightful Visual Performance Model for Multicore Architectures, CACM 2009"
  - "Hennessy & Patterson, Computer Architecture: A Quantitative Approach, 6th ed., ch. 1 (roofline section)"
---

## One picture instead of three numbers

The last lesson ended with three budgets and a break-even division. The
**roofline model** (Williams, Waterman & Patterson, 2009) turns that
arithmetic into a single plot you can place any kernel on.

Draw performance (GFLOPS) up the vertical axis against arithmetic intensity
(FLOPs per byte) along the horizontal one. Both axes are **log scale** — each
step along an axis multiplies rather than adds (1, 10, 100, 1000…), which is
the only way to fit values spanning several factors of ten onto one readable
picture. Two lines then bound everything the machine can ever do:

- a **slanted line** rising from the bottom-left with slope = peak bandwidth:
  at intensity AI, streaming memory can sustain at most `AI × bandwidth`
  FLOPs/s — double the maths you do per byte, double the speed you're allowed;
- a **flat line** at peak compute: no kernel exceeds the arithmetic units, no
  matter how favourable its intensity gets.

Together they look like a roof: a slope going up, then a horizontal ridge.
The machine's limit at any intensity is whichever of the two is _lower_:

> attainable GFLOPS = min( peak compute, AI × peak bandwidth )

The corner where the lines meet is the **ridge point**: intensity = peak
compute ÷ peak bandwidth. Left of it, kernels are **memory-bound**; right of
it, **compute-bound**. For the laptop-class numbers from lesson 03 (400
GFLOPS, 100 GB/s) the ridge sits at 4 FLOPs/byte — the same break-even you
already computed, now with a place to stand on a picture.

## Reading the plot like an engineer

Place a kernel by its intensity (you computed those by hand last lesson) and
its _measured_ GFLOPS. Three situations, three different actions:

1. **Under the slanted roof** (memory-bound, e.g. elementwise add at 0.08
   FLOP/byte): more cores, higher clocks, wider SIMD are all wasted. The only
   moves that help are _moving fewer bytes_ — better reuse, fusion, or smaller
   **dtypes**. A dtype is which number format a tensor's elements are stored
   in; fp32 is the 32-bit float you've been assuming, and fp16 is a 16-bit
   one, so switching halves the bytes and doubles effective intensity, sliding
   the kernel rightward on the plot. M3 is entirely about that trade.
2. **Under the flat roof** (compute-bound, e.g. large matmul): memory tricks
   are wasted; arithmetic is the game — use the FMA units, use all cores,
   or reduce the FLOPs themselves.
3. **Well below either roof**: the kernel isn't hitting _any_ hardware limit
   — the problem is software (interpreter overhead, poor access patterns
   defeating the prefetcher, or thread imbalance: work split unevenly so some
   cores finish early and idle). Fix the code before blaming the machine.

That third case is the model's quiet superpower: it separates "the hardware
is the limit" from "my code is the limit" with one measurement.

## Honest limitations

The basic roofline assumes perfect overlap of compute and memory traffic —
that the machine is always fetching the next bytes while chewing the current
ones — and it uses _peak_ numbers that real code rarely sustains. Fancier
versions add extra ceilings under the main roof (what you get without SIMD,
what you get on one core, what each cache level's bandwidth allows). Lab L1.3
builds the basic one for your machine from _measured_ peaks — a roofline built
from marketing numbers is a ceiling you'll never touch.

## Where you'll meet it again

Every serious performance discussion in this curriculum stands on this plot:
data loading (M4), the speedups from quantization (M6 — storing numbers in
smaller dtypes, which shifts intensity rightward), why generating text from a
large language model is bandwidth-bound
(M7), and GPU kernel tuning (M8). If you can place a workload on a roofline
and name the binding budget, you already think like an MLSys engineer.
