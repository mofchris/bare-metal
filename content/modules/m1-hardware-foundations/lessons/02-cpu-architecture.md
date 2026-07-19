---
id: m1/02-cpu-architecture
title: "Why CPUs are fast — and why that's not enough"
objectives:
  - "Explain pipelining, superscalar execution, and branch prediction in a sentence each"
  - "Estimate a CPU's peak FLOPS from cores × SIMD width × FMA × clock"
  - "Explain why a vectorized NumPy operation beats a Python loop by 100× or more"
sources:
  - "Hennessy & Patterson, Computer Architecture: A Quantitative Approach, 6th ed., ch. 3 and appendix C"
  - "Agner Fog, The microarchitecture of Intel, AMD and VIA CPUs (agner.org/optimize)"
  - "Patterson & Hennessy, Computer Organization and Design, RISC-V ed., ch. 4"
---

## The story so far

Lesson 01 said DRAM is ~100× slower than the core. This lesson is the other
half of the picture: just how fast the core itself is, where that speed comes
from, and why all of it can be wasted by code that doesn't cooperate.

## Trick 1: pipelining — the assembly line

Executing an instruction takes several steps: fetch it, decode it, execute
it, touch memory, write the result back. A naive core would do all five steps
for one instruction before starting the next. A **pipelined** core runs them
like an assembly line — while instruction A executes, instruction B is being
decoded and C fetched. Nothing finishes faster, but one instruction
_completes_ nearly every cycle instead of every five.

## Trick 2: superscalar, out-of-order — several assembly lines

Modern cores fetch and decode several instructions per cycle (typically 4–6)
and keep **hundreds of instructions in flight**, executing whichever ones have
their inputs ready — not program order. The hardware finds the independent
work automatically. This is called instruction-level parallelism (ILP), and
it's why "the CPU executes one thing at a time" has been false for decades.

## Trick 3: branch prediction — guessing the future

Pipelines only stay full if the core knows _which_ instructions come next. At
every `if` and loop-end, it doesn't — so it **predicts** (correctly well over
95% of the time in ordinary code) and speculatively runs ahead. A wrong guess
throws away roughly 15–20 cycles of work. Code with unpredictable branches —
say, branching on random data — can run several times slower than the same
work arranged branch-free. Sorted data really is faster to branch on than
shuffled data.

## Trick 4: SIMD — one instruction, many numbers

The registers are wider than the numbers. An AVX2 register is 256 bits: **8
float32 values**, operated on by a single instruction. Better still, an FMA
(fused multiply-add) instruction computes `a×b + c` across all lanes at once
— 2 floating-point operations × 8 lanes = 16 FLOPs from one instruction, and
a core with two FMA units can issue two per cycle.

## Adding it up: peak FLOPS

> peak FLOPS ≈ cores × (SIMD lanes) × 2 (FMA) × (FMA units) × clock

A 4-P-core laptop chip with AVX2, two FMA ports, around 3 GHz:
4 × 8 × 2 × 2 × 3 GHz ≈ **380 GFLOPS** fp32. Lab L1.3 measures what your
Core Ultra 7 actually reaches — expect the measured roof to sit below the
formula, and expect to explain the gap.

## Why this matters for ML: the NumPy lesson

A Python `for` loop summing a million floats runs each addition through the
interpreter: fetch the object, check its type, dispatch the operation —
hundreds of nanoseconds per element, using none of the machinery above.
`numpy.sum` on the same data is a compiled loop that streams 8 lanes per
instruction with predictable branches. That's how the same laptop does the
same arithmetic 100–1000× faster. Nothing about the hardware changed — the
code finally stopped fighting it.

And the closing trap, carried over from lesson 01: all this compute is only
reachable if data arrives fast enough. What "fast enough" means precisely —
bandwidth versus latency versus compute — is the next lesson.
