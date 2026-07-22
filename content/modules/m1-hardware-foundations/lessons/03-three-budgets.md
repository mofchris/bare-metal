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

## What this lesson answers

You now have two numbers: memory takes about 100 nanoseconds to answer, and a
core can perform about 380 billion floating-point operations per second. Those
numbers measure different things and cannot be compared directly.

This lesson introduces the third number needed to complete the picture, gives
each of the three its unit, and then shows how to work out which of them is
limiting any particular piece of code.

## What three numbers describe a machine?

**Latency** is the time between asking for a value and receiving it. It is a
duration, so it is measured in nanoseconds. On this laptop, a request that
misses every cache waits about 100 ns for DRAM.

**Bandwidth** is how many bytes arrive per second once data is flowing
continuously. It is a rate, so it is measured in GB/s, meaning gigabytes per
second, or billions of bytes each second. A laptop like yours moves roughly
100 GB/s between DRAM and the core.

**Compute** is how many arithmetic operations the core performs per second. It
is also a rate, but of arithmetic rather than of bytes, so it is measured in
GFLOPS. Lesson 02 derived about 380 GFLOPS for a chip of this class.

| Budget    | What it measures           | Unit        | This laptop |
| --------- | -------------------------- | ----------- | ----------- |
| Latency   | wait for one value         | nanoseconds | ~100 ns     |
| Bandwidth | bytes delivered per second | GB/s        | ~100 GB/s   |
| Compute   | operations done per second | GFLOPS      | ~380 GFLOPS |

Latency and bandwidth are easy to confuse because both concern memory. They
answer different questions. Latency asks how long the first value takes to
arrive. Bandwidth asks how fast values keep arriving after that.

## Why can't more bandwidth fix latency?

Hardware has improved bandwidth by about a hundred times over recent decades
while latency has barely moved. That is not an oversight, and the reason is
worth understanding, because it explains why so much of this curriculum is
about hiding waits rather than removing them.

Bandwidth can be bought by widening. Adding more wires between the memory and
the core, or adding a second memory channel, lets more bytes travel side by
side in the same instant. Doubling the wires roughly doubles the bytes per
second, and this is an engineering choice a chip designer can simply make.

Latency cannot be widened away. A single request has to travel a physical
distance to the memory chip, wait while the memory locates and activates the
correct internal row, and then travel back. Adding a second lane to a road does
not shorten the road. The distance and the internal timing of DRAM are what
they are, and extra parallel paths do nothing for one request in flight.

So the practical rule is that you can usually get more bytes per second, but
you can rarely get the first byte sooner. Designs therefore aim to keep the
core busy with other work during the wait, which is exactly what the caches of
lesson 01 and the out-of-order machinery of lesson 02 are for.

## What is arithmetic intensity?

To decide whether memory or arithmetic is holding a piece of code back, count
two quantities: the floating-point operations it performs, and the bytes it
moves to and from memory.

**Arithmetic intensity** is the ratio of those two, measured in FLOPs per byte.
It answers a single question: how much arithmetic do you get out of each byte
you go and fetch?

Work three examples by hand, because doing this yourself is the skill.

An **elementwise** operation applies the same arithmetic to each position of an
array independently, with no mixing between positions. Take `c[i] = a[i] + b[i]`
on float32 data. Each element costs 1 FLOP, one addition. Each element moves 12
bytes: 4 bytes read from `a`, 4 read from `b`, and 4 written to `c`. The
intensity is 1 ÷ 12 = **0.083 FLOPs per byte**.

A dot product multiplies two arrays elementwise and adds the results together.
Each element pair costs 2 FLOPs, one multiplication and one addition, and moves
8 bytes, 4 from each array. Nothing is written back per element, because the
running total stays in a register. The intensity is 2 ÷ 8 = **0.25 FLOPs per
byte**, three times better than the elementwise add.

Matrix multiplication of two N×N matrices performs 2N³ FLOPs, because each of
the N² output positions needs N multiplications and N additions. It moves three
matrices of N² float32 values, which is 3 × N² × 4 = 12N² bytes. The intensity
is 2N³ ÷ 12N² = **N ÷ 6 FLOPs per byte**.

Look at what makes matrix multiplication different. Its intensity grows with N,
because every value that gets loaded is used N times rather than once. At
N = 1000 the intensity is about 167, which is two thousand times better than the
elementwise add. This one property is why matrix multiplication can run near a
machine's arithmetic limit, and it is the reason deep learning is affordable at
all.

## Where is the break-even point?

A machine has its own exchange rate between the two budgets. Divide its
compute by its bandwidth:

380 GFLOPS ÷ 100 GB/s ≈ **4 FLOPs per byte**

Read that as follows: for every byte this laptop can deliver in a second, it
can perform about 4 operations in that same second. Code that does less
arithmetic per byte than 4 cannot possibly keep the arithmetic units busy,
because the memory system runs out of bytes first.

Apply it to the elementwise add at 0.083 FLOPs per byte. That is about 48 times
below the break-even point, so memory sets the speed. Work out the actual
ceiling: 100 GB/s ÷ 12 bytes per element gives 8.3 billion elements per second,
and at 1 FLOP each that is **8.3 GFLOPS**. Divide by the 380 GFLOPS the chip can
do and you get about 2%. The other 98% of the arithmetic hardware sits idle, and
no extra cores or clock speed would change that number.

Apply it to matrix multiplication. Its intensity passes 4 once N ÷ 6 > 4, so
once N is larger than 24. Beyond that size, arithmetic is the limit and
optimizing the arithmetic is worth doing.

These two situations have names that the rest of the curriculum uses
constantly. Code below the break-even point is **memory-bound**, meaning memory
sets its speed limit. Code above it is **compute-bound**, meaning the
arithmetic units do. Naming which one you face, before optimizing anything, is
most of the job.

## Why does this matter in machine learning?

Two terms first, because the argument needs them.

A **layer** is one stage of a model. It takes an array of numbers in, performs
its arithmetic, and passes an array of numbers out. An **activation** is one of
those arrays travelling between layers, meaning a model's intermediate results.

Now count. A neural network contains two kinds of work. Matrix multiplications
have high intensity and account for most of the FLOPs. Elementwise work on
activations — scaling them, adding them, normalizing them — has intensity near
0.1 and accounts for most of the _operations by count_.

The consequence is that a large fraction of a model's runtime is spent on
operations that use around 2% of the machine's arithmetic. That is why
optimizing a model often means reducing bytes moved rather than operations
performed.

It also explains a reading of hardware monitors that catches people out. A
utilization figure of 100% can mean the chip is busy moving bytes for
low-intensity work while its multipliers idle. Utilization of _what_ is the
question this lesson teaches you to ask.

One last distinction, used from here on. **Training** is the process of
adjusting a model's weights until it stops being wrong. **Inference** is using
a finished model to produce answers. They stress these three budgets
differently.

## Check your understanding

You have a float32 operation `y[i] = 3.0 * x[i]`, run over a 100-million
element array on this laptop.

Compute its arithmetic intensity, say whether it is memory-bound or
compute-bound, and predict whether doubling the machine's core count would make
it faster. A correct answer computes 1 FLOP per element over 8 bytes moved (4
read, 4 written) for an intensity of 0.125, notes that 0.125 is far below the
break-even point of 4, concludes memory-bound, and says doubling the cores
changes nothing because the memory system, not the arithmetic, is the limit.
