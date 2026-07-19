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
a value from main memory (DRAM) takes on the order of **100 nanoseconds**. If
the CPU had to wait for DRAM on every access, it would spend roughly 99% of its
time doing nothing. Almost everything strange-looking about hardware — caches,
prefetchers, the shape of fast ML kernels — is a response to this single gap.

## The hierarchy

Between the CPU and DRAM sits a ladder of progressively bigger, slower memories:

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
address, hardware checks L1, then L2, then L3; a **hit** returns quickly, a
**miss** falls through to the next level, and a miss all the way down pays the
full DRAM price.

## Why caching works at all: locality

A cache that held random data would be useless — it's tiny compared to DRAM.
Caches work because real programs are not random:

- **Temporal locality:** something touched recently will likely be touched
  again soon (a loop counter, a hot function's locals, a weight matrix reused
  across a batch).
- **Spatial locality:** after touching an address, a program will likely touch
  a _neighboring_ address soon (walking an array element by element).

Hardware exploits spatial locality by never moving single bytes: memory is
transferred in **cache lines**, typically **64 bytes**. Touch one `float32`
and the 15 next to it arrive for free. Iterate an array in order and most
accesses are hits on a line already fetched; jump randomly and every access
can be a fresh miss — same data, same amount of work, order of magnitude
difference in wall-clock time.

## What this means for ML systems

- A tensor is just a big array. Whether a kernel walks it along the layout
  order or across it decides whether it runs at cache speed or DRAM speed —
  this is why "memory layout" gets a whole discussion in every fast-kernel
  tutorial, and why matrix-multiply implementations tile their loops (much
  more on that in M8).
- Reusing data while it's hot (batching, loop fusion) is temporal locality
  engineering by another name.
- When a model or batch stops fitting in cache, throughput drops in visible
  steps — you'll see those steps as measured cliffs in lab L1.1.

## Check your intuition

Before the quiz: two loops sum the same 4096×4096 float32 matrix. One iterates
row by row (the layout order), the other column by column. Both do 16.7 million
additions. Why is the second one several times slower? If your answer mentions
cache lines going to waste, you have the idea.
