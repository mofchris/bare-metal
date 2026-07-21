---
id: m1/03-three-budgets
title: "Bandwidth vs latency vs compute — the three budgets"
objectives:
  - "Define latency, bandwidth, and compute, and state which units each is measured in"
  - "Compute the arithmetic intensity of a simple operation from its FLOPs and bytes"
  - "Classify an operation as memory-bound or compute-bound given machine peak numbers"
sources:
  - "Williams, Waterman & Patterson, Roofline: An Insightful Visual Performance Model for Multicore Architectures, CACM 2009"
  - "Ulrich Drepper, What Every Programmer Should Know About Memory (2007), sections 2 and 6"
  - "Horace He, Making Deep Learning Go Brrrr From First Principles (horace.io/brrr_intro.html, 2022)"
---

## Three numbers describe a machine

Every performance question on any hardware comes down to three budgets:

| Budget        | What it is                        | Units       | Laptop-class value  |
| ------------- | --------------------------------- | ----------- | ------------------- |
| **Latency**   | time for one round trip to memory | nanoseconds | ~100 ns to DRAM     |
| **Bandwidth** | bytes moved per second, streaming | GB/s        | ~100 GB/s (LPDDR5X) |
| **Compute**   | arithmetic operations per second  | GFLOPS      | ~400 GFLOPS fp32    |

Read the units, because they are the whole point. **Latency** is a _duration_
— how long you wait for one thing, in nanoseconds. **Bandwidth** is a _rate_ —
how many bytes per second arrive once data is flowing; GB/s is gigabytes per
second, billions of bytes each second. (LPDDR5X is just the name of the memory
technology soldered into a laptop like yours.) **Compute** is also a rate, but
of arithmetic rather than bytes: GFLOPS is billions of floating-point
operations per second, the FLOPS from lesson 02.

The everyday analogy that keeps them straight: latency is how long the first
delivery van takes to arrive, bandwidth is how much the vans carry per hour
once they're running, and compute is how fast you can unpack them.

They are not interchangeable. Latency is about _waiting once_; bandwidth is
about _streaming continuously_; compute is what you wish you were doing while
the other two hold you up. Hardware can buy bandwidth (wider buses, more
channels) far more easily than it can buy latency — which is why bandwidth
has grown ~100× over the decades while DRAM latency barely moved.

## Arithmetic intensity: the exchange rate

For any piece of code, count two things: floating-point operations performed,
and bytes moved to/from memory. Their ratio is the **arithmetic intensity**
(AI), in FLOPs per byte. It answers "how much maths do I get out of each byte
I go and fetch?" — and that single number tells you which budget the code
lives on.

Work the examples by hand once — this is the skill:

- **Elementwise add** `c[i] = a[i] + b[i]` (fp32) — "elementwise" meaning the
  operation is applied to each position independently, no mixing: per element,
  1 FLOP; bytes: read 4+4, write 4 = 12. AI ≈ **0.08 FLOP/byte**.
- **Dot product**: per element pair, 2 FLOPs (multiply + add); 8 bytes read.
  AI = **0.25 FLOP/byte**.
- **Matrix multiply** (N×N): 2N³ FLOPs over 3N² × 4 bytes of matrices — if
  cached perfectly, AI ≈ **N/6 FLOP/byte**. It _grows with problem size_:
  every loaded value can be reused N times. This is the single fact that
  makes fast matmul kernels — and therefore deep learning — possible.
  ("matmul" is the standard shorthand for matrix multiply; you'll see it
  everywhere from here on.)

## The break-even point

Divide peak compute by peak bandwidth: 400 GFLOPS ÷ 100 GB/s = **4
FLOPs/byte**. That's the machine's exchange rate: for every byte it can
deliver per second, it can perform 4 operations. Code below that intensity
cannot use all the compute — the memory system can't feed it. Code above it
can. So on this laptop:

- Elementwise add at 0.08 → **memory-bound**, meaning memory is the thing
  actually setting the speed limit — ~50× below break-even. Its speed limit is
  100 GB/s ÷ 12 B × 1 FLOP ≈ 8 GFLOPS — 2% of peak, and **no amount of extra
  compute, cores, or clock speed changes that**.
- Large matmul at N/6 → **compute-bound** once N is a few dozen: the
  arithmetic units are the limit, so optimizing arithmetic is worth doing.

Memory-bound and compute-bound are the two labels this whole curriculum sorts
work into. Getting the label right before optimizing is most of the job.

## Why ML engineers care daily

A model is built from **layers** — a layer being one stage that takes numbers
in, does its arithmetic, and passes numbers out — and the numbers flowing
between them are called **activations**. Most of a neural network's operations
by _count_ are low-intensity (activations being scaled and added,
normalization, elementwise everything) while most of its FLOPs sit in
high-intensity matmuls.

That's why **kernel fusion** (M10) exists — gluing elementwise operations onto
the matmul before or after them so their bytes ride along free instead of
making their own trip to memory — and why "the GPU is at 100% utilization" can
still mean "the expensive arithmetic units are idle, waiting on memory."
Utilization of _what_ is the question this lesson teaches you to ask.

One distinction to carry from here: **training** is the process of adjusting a
model's weights until it stops being wrong; **inference** is using the
finished model to get answers. They stress these three budgets differently,
and the curriculum treats them separately from M3 onward.

Next lesson: drawing these three budgets as one picture — the roofline — so a
single glance answers "what's the speed limit here, and which knob moves it?"
