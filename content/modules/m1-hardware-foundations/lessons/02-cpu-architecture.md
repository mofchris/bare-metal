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

## First, the clock — the unit everything here is counted in

A CPU is driven by a **clock**: an electrical pulse ticking at a fixed rate.
One tick is a **cycle**, and every piece of work inside the core is paced by
it — so "how fast is this?" almost always means "how many cycles?"

The clock rate is the GHz number on the spec sheet: gigahertz, billions of
ticks per second. At **3 GHz** the core ticks three billion times a second,
making one cycle about **0.33 nanoseconds**. That one conversion is what
makes lesson 01's numbers bite: a 100 ns trip to DRAM is roughly **300
cycles** the core spends doing nothing. Everything below is the hardware
refusing to waste them.

The other unit: an **instruction** is one primitive step of machine work —
add these two numbers, load this address, jump if this one is zero. Your
compiler turns source code into a long list of them, and the core's entire
job is to get through that list as fast as physics allows.

## Trick 1: pipelining — the assembly line

Executing one instruction takes several steps: fetch it, decode it (work out
what it's asking for), execute it, touch memory if it needs to, write the
result back. A naive core walks one instruction through all five before
starting the next — five cycles each, with four fifths of its hardware idle
at any given moment.

A **pipelined** core runs the steps like an assembly line: while instruction
A executes, B is being decoded and C fetched, every stage busy with a
different instruction. No single instruction finishes any sooner — A still
takes its five cycles end to end — but one instruction _completes_ nearly
every cycle instead of every five.

## Trick 2: superscalar, out-of-order — several assembly lines

Trick 1 got the core to one finished instruction per cycle. This one breaks
that ceiling: a **superscalar** core runs several assembly lines at once, so
_more than one instruction finishes in the same cycle_. It fetches and
decodes 4–6 per cycle and hands them out to several **execution units** —
the separate pieces of circuitry that do the actual work, one for whole-number
maths, others for decimals, others for loading and storing memory. Several
units, several instructions genuinely running at the same instant.

The core also refuses to be held up by the order you wrote. It keeps
**hundreds of instructions in flight** — fetched and waiting, not yet
finished — and starts whichever ones have their inputs ready instead of going
in program order (**out-of-order execution**), then puts the results back in
your order at the end, so the program can never tell. "Inputs ready" is the
whole condition: two instructions are independent when neither needs the
other's answer, and the hardware works that out for itself. In

```
a = b + c
d = e * f
```

nothing in the second line waits on the first, so both can run together.

That is all **instruction-level parallelism** (ILP) means: several
instructions out of one ordinary, everyday program running at the same
instant. Not because you wrote anything parallel — you wrote one plain
sequence of steps, and the chip quietly overlaps the ones that don't depend on
each other. It's why "the CPU executes one thing at a time" has been false for
decades.

## Trick 3: branch prediction — guessing the future

Pipelines only stay full if the core knows _which_ instructions come next. A
**branch** is any instruction that can send execution to one of two places —
an `if`, a loop-end, a function return. At the moment the core wants to fetch
past one, the branch's condition often hasn't been computed yet. It doesn't
know.

So rather than stall, it **predicts**: a small piece of hardware remembers
how each branch went recently and bets the same way — correctly well over
95% of the time in ordinary code — and speculatively runs ahead on the guess.
Right guess, nothing lost. Wrong guess, everything fetched since is thrown
away and the pipeline refills from empty: roughly **15–20 cycles** of work
binned, about 5 ns at 3 GHz.

Which is why code with unpredictable branches — branching on random data,
where no history helps — can run several times slower than the same work
arranged branch-free. Sorted data really is faster to branch on than shuffled
data.

## Trick 4: SIMD — one instruction, many numbers

A **register** is the handful of bytes the core does its arithmetic in — the
fastest storage on the chip (the top row of lesson 01's table) and the only
place the maths actually happens. Values get loaded from memory into
registers, operated on there, and written back.

The trick is that registers are wider than the numbers you put in them. An
**AVX2** register — AVX2 is the name of a batch of extra instructions Intel
and AMD added to their chips for exactly this kind of work, and your laptop
has them — is **256 bits** wide, while a **float32** number takes 32
bits. So eight float32 values sit side by side in one register, each in its
own slot, and a slot is called a **lane**. A single instruction then operates
on all eight lanes at once: same operation, eight different numbers, one go.
That is **SIMD** — single instruction, multiple data.

Better still, an **FMA** (fused multiply-add) instruction computes
`a×b + c` in one step — that's 2 floating-point operations, a multiply and an
add. And a **FLOP** is exactly that: one floating-point operation, the
standard unit for counting arithmetic work the way bytes are the standard
unit for counting data.

So one FMA on an AVX2 register does 2 operations × 8 lanes = **16 FLOPs**.
A core with two FMA units — two of Trick 2's execution units, both wired to
run an FMA — can **issue** (start) two of them per cycle: 32 FLOPs in a third
of a nanosecond.

## Adding it up: peak FLOPS

Multiply the independent multipliers together and you get the machine's
ceiling — the most arithmetic it could do per second if nothing ever waited:

> peak FLOPS ≈ cores × (SIMD lanes) × 2 (FMA) × (FMA units) × clock

Mind the capital S. **FLOPS** is FLOPs per _second_ — a rate, a speed.
Lowercase **FLOPs** is a count of operations — an amount of work. They get
confused constantly, and the two mean opposite kinds of thing.

A laptop chip with 4 P-cores ("performance" cores — the big fast ones;
modern Intel chips pair them with smaller efficiency cores that don't
contribute here), AVX2, two FMA ports, around 3 GHz:
4 × 8 × 2 × 2 × 3 GHz ≈ **380 GFLOPS** fp32 — 380 billion floating-point
operations per second (giga = billion). Lab L1.3 measures what your Core
Ultra 7 actually reaches — expect the measured roof to sit below the
formula, and expect to explain the gap.

## Why this matters for ML: the NumPy lesson

A Python `for` loop summing a million floats runs each addition through the
interpreter: fetch the object, check its type, dispatch the operation —
hundreds of nanoseconds per element, which at 3 GHz is hundreds of cycles of
bookkeeping to perform one addition that costs one. None of the machinery
above gets used: lanes empty, no FMA, branches everywhere.

`numpy.sum` on the same data is a compiled loop — real machine code, no
interpreter in the way — streaming 8 lanes per instruction with predictable
branches. That's how the same laptop does the same arithmetic 100–1000×
faster. Nothing about the hardware changed — the code finally stopped
fighting it.

And the closing trap, carried over from lesson 01: all this compute is only
reachable if data arrives fast enough. What "fast enough" means precisely —
bandwidth versus latency versus compute — is the next lesson.
