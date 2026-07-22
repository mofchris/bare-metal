---
id: m6/04-cpu-affinity
title: "CPU affinity — pinning, and why it changes a benchmark"
objectives:
  - "Explain what CPU affinity is and what problem pinning solves"
  - "Explain why hyper-threading makes core counts misleading for compute-bound work"
  - "Decide whether pinning is appropriate for a given measurement, with a reason"
sources:
  - "Robert Love, Linux Kernel Development, 3rd ed., ch. 4 (process scheduling, processor affinity)"
  - "Agner Fog, The microarchitecture of Intel, AMD and VIA CPUs (agner.org/optimize), on simultaneous multithreading"
  - "Ulrich Drepper, What Every Programmer Should Know About Memory (2007), section 6.4 (multi-threaded optimizations)"
---

## What this lesson answers

Lesson 01 ended with a loose thread: the scheduler may resume your work on a
different core than it was running on, and the new core's caches do not hold
your data.

That is a small effect for ordinary software and a large one for measurement.
This lesson explains the mechanism, gives you the control that addresses it,
and then argues about when using that control is honest.

## What is affinity?

**CPU affinity** is a restriction telling the scheduler which cores a thread is
allowed to run on. Setting it is called **pinning**.

One warning about that word before going further, because it is used for two
unrelated things. M4/02 described **pinned memory**, which locks memory pages in
place so a DMA engine can read them directly. This lesson is about pinning a
**thread to a core**. The two share a name and share nothing else: one is about
where data sits in RAM, the other about which core runs your code.

By default a thread may run anywhere, and the scheduler moves threads between
cores to keep load even. That is the right default for a laptop running many
programs, because the alternative is idle cores next to busy ones.

The cost of a move is the one M1 taught. Each core has its own L1 and L2 caches.
A thread moved from core 0 to core 3 finds core 3's caches full of somebody
else's data, so it pays misses at roughly 100 ns each until its working set is
loaded again. Nothing was lost permanently, but a benchmark run that gets moved
looks slower than an identical run that did not.

Pinning removes the variable. The thread stays where it is, its data stays hot,
and that source of run-to-run variance disappears from your measurement.

## Why is the core count on the box not the core count you have?

Two complications sit between the advertised number and the number that matters
for compute-bound work.

**Hyper-threading**, which Intel calls simultaneous multithreading, presents one
physical core as two logical ones. The two share the physical core's execution
units, its L1 cache and its L2 cache. What is genuinely duplicated is the
register state, so the core can switch between the two instantly.

Work out when that helps. A thread stalled on memory leaves the execution units
idle, and its sibling can use them, so throughput rises. But two threads doing
dense arithmetic both want the same FMA units, and those units do not
duplicate. Two such threads then run at roughly half speed each and finish no
more total work, while halving each one's share of L1 and L2.

So for the compute-bound work M1/02 described, the useful number is physical
cores, not logical ones. Running 16 threads on 8 physical cores usually
measures contention rather than parallelism.

**Performance and efficiency cores** are the second complication, and M1/02
already named them. A modern laptop chip mixes large fast P-cores with small
slow E-cores. The scheduler is free to place your benchmark on either.

That is a genuine measurement hazard. The same code on a P-core and on an
E-core produces different numbers, so a benchmark that lands on different core
types across runs has variance that has nothing to do with the code.

## When should you pin, and when is it dishonest?

Pinning makes results cleaner. Cleaner is not automatically more truthful, and
this is the part worth thinking about rather than memorising.

**Pin when you are measuring code.** If the question is "is version B's
algorithm faster than version A's", then core migration and P-core-versus-E-core
placement are noise you are entitled to remove. Pin both, report that you
pinned, and the comparison is fairer.

**Do not pin when you are measuring a system.** If the question is "how will
this serve requests on a laptop that is also running other things", then
migration and core sharing are part of the answer. Pinning produces a number
the deployed system will never achieve.

Both of these are M2/01's discipline restated. Pinning is a decision about which
question you are asking, so the obligation is to state it in your results.

There is one more honest use. Pinning is a diagnostic: if pinning changes your
numbers substantially, then scheduling was affecting your measurement, and that
is worth knowing even if you then unpin.

## What can you actually control here?

This laptop runs Windows 11, so the Linux tooling the field usually names is
not directly available.

On Linux, `taskset` launches a process restricted to chosen cores, and
`sched_setaffinity` sets it from inside a program. On Windows, the equivalent is
`SetProcessAffinityMask`, exposed in Python as `os.sched_setaffinity` on
platforms that support it and through `psutil.Process().cpu_affinity()` more
portably. Task Manager can also set affinity for a running process by hand.

The concepts transfer exactly; only the names differ. What does not transfer is
`perf`, which is Linux-specific, and lesson 05 deals with that honestly rather
than pretending otherwise.

## Check your understanding

You benchmark a single-threaded matrix multiply on a laptop with 4 P-cores, 8
E-cores, and hyper-threading. Unpinned, your 30 runs have a median of 120 ms and
an interquartile range from 118 to 190 ms. Pinned to one P-core, the median is
118 ms with an IQR from 117 to 121 ms.

Explain the wide unpinned spread, and say whether you should report the pinned
number. A correct answer attributes the spread to the scheduler moving the
thread between cores, so some runs land on a slow E-core and some pay cache
refill after migration, producing the long tail up to 190 ms. Reporting the
pinned number is correct if the question is about the code, provided you state
that you pinned; it is wrong if the question is how the program behaves as
actually deployed on a shared laptop.
