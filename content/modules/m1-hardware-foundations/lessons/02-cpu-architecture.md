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

## What this lesson answers

Lesson 01 established that main memory is about 100 times slower than the
core. That statement only means something if you know how fast the core is.
This lesson works that out. It also shows why the core's speed is easy to
waste, which is the part that matters when you write code.

## What is a cycle, and what is an instruction?

A CPU is driven by a **clock**. A clock is an electrical signal that pulses at
a fixed rate, and one pulse is called a **cycle**. Every step the core takes is
paced by these pulses, so hardware speed is nearly always counted in cycles
rather than in seconds.

The clock rate is the GHz figure on a specification sheet. GHz means gigahertz,
or billions of pulses per second. A core running at 3 GHz pulses three billion
times each second, so one cycle lasts 1 ÷ 3,000,000,000 seconds, which is about
0.33 nanoseconds.

That conversion gives lesson 01's numbers their weight. A trip to main memory
takes about 100 nanoseconds. Divide 100 by 0.33 and you get roughly 300. The
core therefore sits through about 300 cycles waiting for one value to arrive.

An **instruction** is one primitive step of machine work. Adding two numbers is
an instruction, loading a value from an address is an instruction, and jumping
to a different part of the program is an instruction. Your compiler turns
source code into a long list of these, and the core's job is to work through
that list.

Everything below is a technique for getting through the list faster.

## Trick 1: why does a core overlap instructions?

Executing one instruction takes five steps. The core fetches the instruction
from memory, decodes it to work out what is being asked, executes it, reads or
writes memory if the instruction needs to, then writes the result back.

Suppose the core did all five steps for one instruction before starting the
next. Each instruction would take five cycles. Worse, four of the five pieces
of hardware would be idle at any moment, because only one step is active at a
time.

**Pipelining** fixes the idleness. In a pipelined core, all five steps run at
once, each working on a different instruction. While instruction A is being
executed, instruction B is being decoded and instruction C is being fetched.

Note what pipelining does not do. Instruction A still takes five cycles to
travel from fetch to write-back. What changes is how often an instruction
_finishes_: one comes out of the end of the pipeline nearly every cycle,
instead of one every five cycles.

So pipelining raises the rate at which work completes without making any single
instruction faster.

## Trick 2: how does a core run more than one instruction at once?

Pipelining caps the core at one finished instruction per cycle. A
**superscalar** core breaks that cap by running several pipelines side by side.
It fetches and decodes four to six instructions per cycle and sends them to
different **execution units**.

An execution unit is a piece of circuitry built to perform one kind of
operation. A core contains several: some handle whole-number arithmetic, others
handle decimal arithmetic, and others handle reading and writing memory.
Because these units are physically separate, they can all be working in the
same cycle.

Running instructions at the same time requires that they not depend on one
another. Two instructions are independent when neither one needs the other's
result. In this pair, nothing in the second line waits for the first:

```
a = b + c
d = e * f
```

The core finds such pairs itself. It keeps hundreds of instructions fetched and
waiting, and it starts whichever ones have their inputs ready rather than
following the order you wrote. This is called **out-of-order execution**.

Reordering would corrupt your program if the results also came out reordered,
so they do not. Finished results wait in a holding area and are made official
in the original program order. Your program cannot tell that anything was
rearranged.

**Instruction-level parallelism** is the name for what this achieves: several
instructions from one ordinary program running during the same cycle. You did
not write anything parallel to get it. You wrote one sequence of steps, and the
core overlapped the ones that did not depend on each other.

## Trick 3: what does the core do when it doesn't know what comes next?

Pipelining only pays off if the fetch stage never runs dry. Every cycle, that
stage needs exactly one thing to do its job: the address of the next
instruction to grab. Most of the time this is easy, because the next
instruction sits at the next address in memory.

A **branch** breaks that pattern. A branch is an instruction that tests a
condition and then picks between two addresses to continue from. One address is
the next one in line; the other is somewhere else entirely. Your `if`
statements, your loop endings, and your function returns all become branches
once compiled. Roughly one instruction in five is a branch, so this is not a
rare case.

Here is the difficulty. The condition a branch tests is a comparison such as
`i < n`, and that comparison is carried out by an earlier instruction. That
earlier instruction is still moving through the pipeline and will not produce
its answer for several more cycles. Meanwhile the fetch stage needs an address
_this_ cycle. The core has reached a branch and does not yet know which of the
two addresses to fetch from.

One response is to stop fetching until the comparison finishes. Stopping like
this is called a **stall**. A stall is expensive for a reason you already know:
while it lasts, no new instruction enters the pipeline, so cycles pass with
nothing completing. That is exactly the waste pipelining was built to remove.
With a branch every five instructions, stalling at each one would give back
most of Trick 1's gain.

So the core guesses instead. A **branch predictor** is a small table inside the
core, indexed by each branch instruction's own address. For every branch it has
seen, the table records which way that branch went the last few times it ran.
When fetch reaches a branch, it looks up that branch and bets on the same
outcome as last time.

The bet wins because of loops. A loop that runs one thousand times takes its
backward branch 999 times and falls out of it once. "Same as last time" is
therefore correct on 999 of those 1000 passes. Across ordinary code, predictors
are right well over 95% of the time.

Having guessed, the core fetches from the guessed address and executes what it
finds there **speculatively**. Speculatively means the results are computed but
not yet made official. They wait in the same holding area that Trick 2 uses to
restore program order.

When the comparison finally delivers its answer, one of two things happens. If
the answer matches the guess, the held results are released and become
official, and nothing was lost because the pipeline never stopped. If the
answer contradicts the guess, every instruction fetched after the branch came
from the wrong address, so all of that work is thrown away and fetch restarts
from the correct address with every stage of the pipeline empty.

Refilling an empty pipeline takes as many cycles as the pipeline has stages.
Trick 1 used five stages to keep the picture simple, but a real core is 15 to 20
stages deep. One wrong guess therefore costs roughly **15 to 20 cycles**. At
3 GHz and 0.33 nanoseconds per cycle, that is about 5 to 7 nanoseconds.

That price is what makes unpredictable branches slow. When a branch depends on
random data, its past behaviour says nothing about its next outcome, so the
predictor is right about half the time. Each of those wrong guesses adds 15 to
20 wasted cycles on top of the useful work.

The standard demonstration is a loop that adds up only the large elements of an
array: `for i: if (data[i] > 128) sum += data[i]`. Sort the array first, and
the condition is false for every element in the first stretch and then true for
every element in the rest, so the predictor guesses wrong exactly once, at the
crossover. Shuffle the same array, and the condition becomes a coin flip on
every iteration, so the predictor is wrong about half the time. Both runs
execute the same instructions over the same numbers and perform the same
additions, yet the shuffled run takes several times longer, entirely because of
discarded pipeline work.

In one sentence: the core must fetch before it knows which way a branch goes,
so it guesses from that branch's recent history, and a wrong guess throws away
15 to 20 cycles of work.

## Trick 4: how does one instruction operate on many numbers?

A **register** is a small piece of storage inside the core, holding a handful
of bytes. Registers are where arithmetic actually happens: values are loaded
from memory into registers, operated on there, and written back. They are the
fastest storage on the chip, which is why they sit at the top of lesson 01's
table.

A register is wider than the numbers usually stored in it. On your laptop's
chip, one register in the **AVX2** set is 256 bits wide. AVX2 is a group of
extra instructions that Intel and AMD added to their processors for exactly
this purpose.

A **float32** number occupies 32 bits. Divide 256 by 32 and you get 8, so eight
float32 values fit side by side in one AVX2 register. Each of those eight slots
is called a **lane**.

**SIMD** stands for single instruction, multiple data. It means one instruction
operates on all eight lanes at the same time: the same operation, applied to
eight different numbers, for the price of one instruction.

An **FMA** instruction goes further. FMA stands for fused multiply-add, and one
FMA computes `a×b + c` in a single step. That is two floating-point operations,
because it performs one multiplication and one addition.

A **FLOP** is one floating-point operation. It is the unit used to count
arithmetic work, in the same way bytes are the unit used to count data.

Now the arithmetic. One FMA instruction performs 2 operations in each of 8
lanes, so 2 × 8 = **16 FLOPs from a single instruction**. A core with two FMA
execution units can start two such instructions per cycle, giving 32 FLOPs in
one cycle of 0.33 nanoseconds.

## How fast can this chip possibly go?

Multiply the four independent factors together and you get the machine's
ceiling, meaning the most arithmetic it could perform per second if it never
waited for anything:

> peak FLOPS ≈ cores × lanes per register × 2 (from FMA) × FMA units × clock

Take a laptop chip with 4 performance cores. Performance cores, often written
P-cores, are the large fast ones; modern Intel chips also include smaller
efficiency cores, which are slower and are left out of this calculation.
Suppose those cores have AVX2, two FMA units each, and a 3 GHz clock:

4 cores × 8 lanes × 2 operations × 2 units × 3,000,000,000 cycles per second
= 384,000,000,000 FLOPS, or about **380 GFLOPS**. GFLOPS means billions of
floating-point operations per second.

Notice the capital S at the end of FLOPS. FLOPS with a capital S is a rate,
measured per second. FLOPs with a lowercase s is a count of operations. One is
a speed and the other is an amount of work, and mixing them up produces
nonsense.

Treat 380 GFLOPS as a ceiling and not a promise. The figure assumes every core
issues two FMA instructions every single cycle, with all eight lanes full and
no waiting. Real code never sustains that, and the largest reason is the one
lesson 01 gave you: the arithmetic units can only work if data reaches them,
and main memory is 100 times slower than the core.

## Why does NumPy beat a Python loop?

Write a Python `for` loop that adds up a million floats. For each element, the
interpreter fetches the object, checks its type, works out which addition
function applies, and calls it. That bookkeeping takes on the order of 100
nanoseconds per element. At 0.33 nanoseconds per cycle, 100 nanoseconds is
about 300 cycles spent to perform one addition.

Look at what the loop fails to use. Each of those additions handles one number,
so seven of the eight lanes sit empty. No FMA instruction is issued. The
interpreter's own branches are unpredictable, so the predictor guesses wrong
often and pays 15 to 20 cycles when it does.

`numpy.sum` runs compiled machine code instead, with no interpreter between the
instruction and the numbers. It processes 8 lanes per instruction, and its
branches are the regular, predictable kind that loops produce. The arithmetic
alone therefore accounts for hundreds of times the throughput.

Measured speedups usually land between 100× and 1000× rather than higher,
because adding a million numbers requires reading a million numbers, and the
memory system becomes the limit. Nothing about the hardware changed between the
two versions. The second one simply stopped fighting it.

## Check your understanding

Two programs run on the same laptop and perform exactly the same 10 million
float32 additions. Program A is a Python `for` loop. Program B calls
`numpy.sum`. Program B finishes roughly 200 times sooner.

Name three separate pieces of machinery from this lesson that Program A leaves
unused, and say what each one would have contributed. A complete answer names
the SIMD lanes (eight numbers per instruction instead of one), the FMA units
(two operations per instruction, issued twice per cycle), and the branch
predictor (the interpreter's dispatch branches are unpredictable, so each wrong
guess discards 15 to 20 cycles).
