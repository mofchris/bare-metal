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

## What this lesson answers

Lessons 01 to 04 described one way to build a fast processor. There is a second
way, and it is the one machine learning actually runs on. It starts from the
same problem as the first and reaches the opposite conclusion.

This lesson explains what that opposite conclusion is, and why the work of
training a model happens to suit it so well.

## What were the CPU's tricks actually buying?

The problem from lesson 01 was that memory takes about 100 nanoseconds while
the core wants a value every cycle. Every CPU technique you have met is an
answer to it.

Caches keep recently used data close so the wait usually does not happen.
Out-of-order execution finds other instructions to run during a wait that does
happen. Branch prediction keeps the pipeline fed across an `if`.

Notice what all three have in common. They spend transistors and chip area on
making **one thread** run without stopping. A thread is one independent
sequence of instructions; your Python program is one thread. A processor built
this way is a **latency machine**, because its silicon is spent shortening or
hiding the wait faced by a single sequence of work.

That approach has a cost. Caches, reorder buffers and predictors occupy most of
a modern CPU core's area, so a chip only has room for a handful of cores.

## What does a GPU do instead?

A GPU accepts the wait rather than hiding it, and covers it with sheer numbers.

The design drops the expensive machinery. Without large caches, deep reorder
buffers and elaborate predictors, each execution lane becomes small, so tens of
thousands of lanes fit on one chip.

The GPU then keeps far more threads loaded than it has lanes to run them on.
Threads in this state are called **resident**, meaning their working values are
already held on the chip and ready to go.

Now the key move. When a group of threads stalls waiting for memory, the
hardware scheduler switches to a different resident group within a single cycle,
because that group's values are already in place and nothing has to be loaded.
The 100 nanosecond wait has not been shortened at all. It is simply always some
other group's turn to wait.

A processor built this way is a **throughput machine**. Each individual thread
runs slower than it would on a CPU, because it has none of the tricks helping
it. The total work finished per second is far higher, because so many threads
are in flight.

The general term for a chip bought to perform the arithmetic faster than a CPU
could is an **accelerator**. GPUs are the common case, and the word also covers
Google's TPUs and the NPUs in laptop chips.

## What is a warp, and why does branching hurt one?

GPU threads do not run individually. The hardware groups them into fixed sets
that execute in lockstep, and NVIDIA calls a group of 32 threads a **warp**.
Every thread in a warp performs the same instruction in the same cycle, each on
its own data.

That arrangement is called **SIMT**, for single instruction, multiple threads.
It resembles the SIMD of lesson 02, where one instruction operated on eight
lanes of one register, except that here each lane is a thread with its own
address to read from.

Lockstep creates a problem at branches. Suppose an `if` sends 20 threads of a
warp down one path and 12 down the other. The warp cannot run two different
instructions at once, so the hardware runs both paths in sequence. During the
first path, the 12 threads that did not take it are switched off and their
results discarded; during the second, the other 20 are.

Count the cost. The warp spends the time of both paths and gets the work of
one, so heavily branching code can waste most of the machine. Code that
performs the same arithmetic on every element of a tensor never branches apart
and wastes none of it.

## Does the roofline still apply?

It applies unchanged, with larger numbers.

GPU memory on datacenter parts is **HBM**, meaning high-bandwidth memory, and
it delivers 1 to 3 TB/s. TB/s means terabytes per second, and one terabyte is a
thousand gigabytes, so that is ten to thirty times a laptop's 100 GB/s.

Take a card with 50 TFLOPS of fp32 compute, where TFLOPS means trillions of
floating-point operations per second, and 2 TB/s of bandwidth. Its ridge point
is 50 TFLOPS ÷ 2 TB/s = **25 FLOPs per byte**, compared with 4 on your laptop.

Read what that higher ridge means. The compute grew faster than the bandwidth
did, so a GPU needs _more_ arithmetic per byte than a CPU before it is
compute-bound. An elementwise operation at 0.083 FLOPs per byte is 300 times
below the laptop's ridge and 3000 times below this card's. Low arithmetic
intensity is not free on any hardware, and it gets relatively worse on faster
hardware.

## Why did machine learning and GPUs suit each other?

A training step is dominated by matrix multiplications over large tensors. Look
at the properties of that work against what a throughput machine needs.

It is **data-parallel**, meaning the same operation applies to many elements
that do not depend on each other, so there are millions of independent threads
available. It barely branches, so warps stay together. Its arithmetic intensity
grows with size, as lesson 03 showed, so it sits far to the right of even a
GPU's high ridge point.

The match was good enough that hardware changed to suit it further. Modern GPUs
contain **tensor cores**, which are execution units that perform a small matrix
multiplication as a single instruction rather than building it from individual
multiply-adds.

Now the mirror image. Work that does _not_ suit a throughput machine is
branching sequential logic, small irregular problems, and anything without
enough independent work to fill tens of thousands of lanes.

Text generation is the important example. A **large language model** produces
text one **token** at a time, where a token is a chunk of text roughly the size
of a word fragment. Producing each token requires reading the whole model, and
that step is called **decode**. Generating one token for one user involves very
little independent arithmetic while requiring an enormous read, which places it
far to the left of the ridge point. The most expensive hardware ever built for
machine learning spends that step waiting on memory.

## Check your understanding

You are given a GPU with 60 TFLOPS of fp32 compute and 3 TB/s of bandwidth, and
two workloads: multiplying two 4096×4096 matrices, and adding a bias value to
every element of a 4096×4096 tensor.

Compute the card's ridge point, compute each workload's arithmetic intensity,
and say which one the card suits. A correct answer computes a ridge point of
60 ÷ 3 = 20 FLOPs per byte; gives the matrix multiply an intensity of N ÷ 6 =
4096 ÷ 6 ≈ 683, far to the right of 20 and therefore compute-bound; gives the
bias addition 1 FLOP over 8 bytes moved, which is 0.125 and far to the left,
therefore memory-bound; and concludes the card is suited to the matrix multiply
while the bias addition would leave almost all of its arithmetic hardware idle.
