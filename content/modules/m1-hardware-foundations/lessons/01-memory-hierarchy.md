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

## The one fact this lesson exists for

A processor can execute an instruction in well under a nanosecond, but fetching
a value from main memory takes on the order of **100 nanoseconds**. Main
memory is the gigabytes of RAM in your laptop — the hardware people call
**DRAM** — and it sits physically far from the processor, on separate chips.
If the CPU had to wait for DRAM on every access, it would spend roughly 99% of
its time doing nothing.

Almost everything strange-looking about hardware is a response to this single
gap: caches, prefetchers (hardware that notices your access pattern and starts
fetching the next data before you ask for it), and the shape of fast ML
**kernels** — a kernel being one routine that does one specific piece of
arithmetic over arrays, like a matrix multiply. Confusingly it is not the
operating-system thing of the same name; in this curriculum "kernel" always
means the maths routine.

## The hierarchy

Between the CPU and DRAM sits a ladder of progressively bigger, slower
memories. **Registers** are the top rung — the handful of bytes the core does
its arithmetic in, the only place the maths actually happens. Below them sit
three levels of **cache**, numbered by distance from the core: L1 is closest
and smallest, L3 furthest and largest.

| Level     | Typical size (per core)   | Typical latency   |
| --------- | ------------------------- | ----------------- |
| Registers | ~a few hundred bytes      | none (same cycle) |
| L1 cache  | 32–64 KB                  | ~1 ns             |
| L2 cache  | 0.25–2 MB                 | ~3–10 ns          |
| L3 cache  | 8–36 MB (shared by cores) | ~10–40 ns         |
| DRAM      | gigabytes                 | ~60–100 ns        |

Sizes and exact latencies vary by chip — what stays constant is the _shape_:
each level is roughly an order of magnitude slower and much larger than the one
above it. Your laptop's Core Ultra 7 follows this pattern; lab L1.1 will
measure where its cliffs actually are.

A cache holds copies of recently used DRAM data. When the CPU asks for an
address, hardware checks L1, then L2, then L3; a **hit** means the data was
found at that level and comes back quickly, a **miss** means it wasn't and the
request falls through to the next level down. A miss all the way down pays the
full DRAM price.

## Why caching works at all: locality

A cache that held random data would be useless — it's tiny compared to DRAM.
Caches work because real programs are not random:

- **Temporal locality:** something touched recently will likely be touched
  again soon (a loop counter, a hot function's local variables, a model's
  weights reused across a batch — more on those words in a moment).
- **Spatial locality:** after touching an address, a program will likely touch
  a _neighboring_ address soon (walking an array element by element).

Hardware exploits spatial locality by never moving single bytes: memory is
transferred in **cache lines**, typically **64 bytes**. Touch one `float32`
and the 15 next to it arrive for free. Iterate an array in order and most
accesses are hits on a line already fetched; jump randomly and every access
can be a fresh miss — same data, same amount of work, order of magnitude
difference in how long you actually wait.

## What this means for ML systems

Three words first, because the rest of this curriculum leans on them
constantly. A **model** (or neural network) is a big pile of numbers plus the
arithmetic that turns an input into an output. The numbers it learns are its
**weights**, also called its **parameters** — same thing, two names. A
**tensor** is just a big multi-dimensional array of numbers, which is how
weights and data are both stored. And a **batch** is a group of samples pushed
through the model together in one go, rather than one at a time.

With those in hand:

- A tensor being just a big array means all of the above applies to it
  directly. Whether a kernel walks a tensor along the order it's laid out in
  memory or across that order decides whether it runs at cache speed or DRAM
  speed — this is why "memory layout" gets a whole discussion in every
  fast-kernel tutorial, and why matrix-multiply implementations **tile** their
  loops: chopping the matrices into blocks small enough to stay in cache while
  they're being reused (much more on that in M8).
- Reusing data while it's still in cache — batching, and **loop fusion**
  (doing two operations in one pass over the data instead of two passes) — is
  temporal locality engineering under another name.
- When a model or batch stops fitting in cache, performance drops in visible
  steps — you'll see those steps as measured cliffs in lab L1.1.

## Check your intuition

Before the quiz: two loops sum the same 4096×4096 float32 matrix. One iterates
row by row (the order it's laid out in memory), the other column by column.
Both do 16.7 million additions. Why is the second one several times slower? If
your answer mentions cache lines going to waste, you have the idea.
