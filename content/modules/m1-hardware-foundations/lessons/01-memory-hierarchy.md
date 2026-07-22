---
id: m1/01-memory-hierarchy
title: "The memory hierarchy"
objectives:
  - "Rank registers, L1/L2/L3 cache, and DRAM by latency, within an order of magnitude"
  - "Explain temporal and spatial locality, and why caches work only because of them"
  - "Predict which of two access patterns will be faster by reasoning about cache lines"
sources:
  - "Hennessy & Patterson, Computer Architecture: A Quantitative Approach, 6th ed., ch. 2 and appendix B"
  - "Ulrich Drepper, What Every Programmer Should Know About Memory (2007), sections 3–4"
  - "Latency Numbers Every Programmer Should Know (Jeff Dean's numbers, via norvig.com/21-days.html)"
---

## The problem this lesson exists for

A processor can perform an **instruction**, meaning one primitive step of
machine work such as adding two numbers, in well under a nanosecond.

Fetching a value from main memory takes about 100 nanoseconds. Main memory is
the several gigabytes of RAM in your laptop. Engineers call it **DRAM**, and it
sits on separate chips a few centimetres from the processor. The time you wait
between asking for a value and receiving it is called **latency**.

Put those two numbers together. If the processor needed a fresh value from DRAM
for every instruction, it would spend under 1 nanosecond working and about 100
nanoseconds waiting. That is roughly 99% of its time doing nothing.

No chip designer accepts that. Almost every strange-looking feature of modern
hardware exists to avoid paying the 100 nanoseconds, and this lesson covers the
main one.

## What sits between the processor and DRAM?

Hardware designers solved the problem by putting small, fast memories between
the processor and DRAM, and arranging them in a ladder.

A **register** is the top rung. Registers are tiny pieces of storage inside the
core itself, holding a handful of bytes, and they are where arithmetic actually
happens.

Below the registers sit three levels of **cache**. A cache is a small memory
holding copies of data recently taken from DRAM. The three levels are numbered
by how close they are to the core: L1 is nearest and smallest, L3 is furthest
and largest.

| Level     | Typical size (per core)   | Typical latency  |
| --------- | ------------------------- | ---------------- |
| Registers | ~a few hundred bytes      | none (immediate) |
| L1 cache  | 32–64 KB                  | ~1 ns            |
| L2 cache  | 0.25–2 MB                 | ~3–10 ns         |
| L3 cache  | 8–36 MB (shared by cores) | ~10–40 ns        |
| DRAM      | gigabytes                 | ~60–100 ns       |

Exact sizes and latencies differ between chips. What stays the same is the
shape of the ladder: each rung down is roughly ten times slower than the rung
above it, and holds far more data.

The reason for the trade is physical. Fast memory must be small, because a
larger memory takes longer to search and sits further from the core, and signals
travel at a finite speed. You cannot have one memory that is both large and
fast, so designers build several and stack them.

Here is how the stack is used. When the core asks for an address, the hardware
checks L1, then L2, then L3. Finding the data at a level is called a **hit**,
and the data comes back at that level's speed. Not finding it is a **miss**, and
the request drops to the next level down. A request that misses every cache pays
the full 100 nanoseconds to DRAM.

## Why does keeping copies help at all?

A cache is thousands of times smaller than DRAM, so it can only ever hold a
sliver of your data. If programs touched addresses at random, that sliver would
almost never be the part you wanted, and caches would be pointless.

Programs are not random, and the two ways they are predictable have names.

**Temporal locality** means that data touched recently is likely to be touched
again soon. A loop counter is read and written on every iteration. A model's
weights are used again for every sample in a batch.

**Spatial locality** means that after touching one address, a program is likely
to touch a neighbouring address soon. Walking through an array from start to
finish does exactly this.

Hardware exploits spatial locality by refusing to move single bytes. Memory
travels between DRAM and cache in fixed blocks called **cache lines**, and a
cache line is typically 64 bytes. A `float32` occupies 4 bytes, and 64 ÷ 4 = 16,
so asking for one float32 brings 15 of its neighbours along at no extra cost.

That single fact decides the speed of most loops. Walk an array in order and
only every sixteenth access is a miss, because the other fifteen were already
delivered. Jump around randomly and each access can land on a different line, so
nearly every one is a miss. The two loops perform identical arithmetic on
identical data, and one of them waits ten times longer.

## What does this mean for machine learning?

Four terms first, because the rest of the curriculum uses them constantly.

A **model**, also called a neural network, is a large collection of numbers
together with the arithmetic that turns an input into an output. The numbers a
model learns are its **weights**, also called its **parameters**; the two words
mean the same thing. A **tensor** is a large multi-dimensional array of numbers,
and it is how both weights and input data are stored. A **batch** is a group of
samples pushed through the model together instead of one at a time.

Now apply the lesson. A tensor is an array, so everything above governs it
directly.

A tensor has a layout, meaning the order its elements are arranged in memory.
Reading a tensor along its layout gives you spatial locality and mostly hits.
Reading across the layout gives you a miss on nearly every element. This is why
tutorials on fast numerical code spend so long on memory layout.

Matrix multiplication shows the same principle at a larger scale. Implementations
**tile** their loops, meaning they cut the matrices into blocks small enough to
sit in cache, then finish all the work on one block before moving on. Each loaded
block is reused many times while it is still fast to reach, which is temporal
locality applied deliberately.

Batching is the same idea again. Loading a weight once and using it for 32
samples spreads the cost of that load across 32 pieces of useful work.

## Check your understanding

Two loops add up every element of the same 4096×4096 float32 matrix. The matrix
is stored row by row in memory. Loop A walks it row by row. Loop B walks it
column by column. Both perform 16.7 million additions on the same numbers, yet
Loop B takes several times longer.

Explain the difference in terms of cache lines. A correct answer says that each
64-byte line holds 16 consecutive float32 values from one row, that Loop A uses
all 16 before needing another line, and that Loop B uses 1 value from each line
before jumping to a different row, so it discards 15 of every 16 bytes it made
DRAM deliver.
