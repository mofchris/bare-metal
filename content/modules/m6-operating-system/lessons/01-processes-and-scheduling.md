---
id: m6/01-processes-and-scheduling
title: "Processes, threads, and what the scheduler actually does"
objectives:
  - "Explain what a process owns, what a thread owns, and why that distinction decides parallelism"
  - "Describe what a context switch costs and where that cost comes from"
  - "Explain why a benchmark on an idle machine still shows occasional slow runs"
sources:
  - "Arpaci-Dusseau & Arpaci-Dusseau, Operating Systems: Three Easy Pieces, ch. 4–10 (virtualizing the CPU)"
  - "Robert Love, Linux Kernel Development, 3rd ed., ch. 3–4 (process management, scheduling)"
  - "Python docs: the global interpreter lock (docs.python.org/3/glossary.html#term-global-interpreter-lock)"
---

## What this lesson answers

You have already met the operating system three times without being introduced
to it. M2/01 blamed slow benchmark runs on "the scheduler taking your core".
M4/01 explained that PyTorch uses worker processes because of a lock inside
Python. M4/04 explained that epoch two is fast because the OS kept your files
in spare memory.

Those were asides. This module gives them a home, starting with the most basic
question: your laptop has perhaps 12 cores and is running several hundred
things. How?

## What is a process?

A **process** is a running program together with everything the operating
system gives it to run in. Three of those things matter here.

It has its **own memory**, and cannot read another process's memory. It has its
own **open files and network connections**. And it has at least one thread of
execution, meaning a place in the program where work is currently happening.

The isolation is the point. If a process corrupts its memory or crashes, it
takes nothing else down with it, because nothing else was reachable from it.

## What is a thread, and how is it different?

A **thread** is one sequence of execution inside a process. A process may have
many, and they all share the process's memory.

That sharing is the whole distinction, and it cuts both ways.

It makes communication free. Two threads exchange data by writing to the same
variable, with no copying and no message passing, because they are looking at
the same memory.

It also makes correctness hard. Two threads writing the same variable at the
same time can interleave in ways neither one anticipated, and the result
depends on timing rather than on the program. Separate processes cannot have
this problem, since neither can see the other's memory.

So the trade is: threads are cheap to create and cheap to communicate between,
and dangerous. Processes are expensive to create and expensive to communicate
between, and safe.

## Why does Python not get parallelism from threads?

CPython contains one lock, called the **global interpreter lock** or GIL, and a
thread must hold it to execute Python instructions.

Follow the consequence. Only one thread can hold a lock at a time, so only one
thread runs Python instructions at a time, on a machine with any number of
cores. Adding threads to a Python program that does Python work adds no
parallelism whatsoever.

Two important exceptions keep threads useful. A thread that is waiting on a
disk read or a network reply is not executing Python instructions, so it
releases the lock and another thread proceeds. And library code written in C,
which is what NumPy and PyTorch mostly are, can release the lock while it
computes, because it is no longer touching Python objects.

That is why M4/01's DataLoader uses worker **processes**. Each process has its
own interpreter and therefore its own lock, so their Python-level decoding
genuinely runs at the same time.

## How does one core run hundreds of things?

It does not, in the sense you might expect. It runs one thread at a time and
switches between them fast enough that everything appears to progress.

The **scheduler** is the part of the operating system that decides which thread
runs next on which core. It runs a thread for a short slice of time, typically a
few milliseconds, then stops it and picks another.

Stopping one thread and starting another is a **context switch**, and it costs
more than it looks. The direct cost is saving the stopped thread's registers
and loading the next thread's, which is on the order of a microsecond.

The larger cost is indirect, and M1 already explained it. The new thread's data
is not in the caches, because the previous thread's data was. So the new thread
starts by missing cache repeatedly and paying about 100 ns per miss until its
working data is loaded again. The switch itself is cheap; refilling the caches
after it is not.

## Why does an idle machine still produce slow benchmark runs?

Because "idle" is not idle. A desktop operating system runs background indexing,
update checks, telemetry, and whatever the browser is doing, and every one of
those is a thread the scheduler is entitled to run.

When one of them is scheduled onto the core running your benchmark, your work
stops for a slice, then resumes with cold caches. That is one slow run.

Now recall the shape M2/02 derived: a hard floor with a straggling tail to the
right. This is where a large part of that tail comes from, and it also explains
why the tail is one-directional. The scheduler can take time away from your
benchmark; it has no mechanism for giving your benchmark time it did not use.

There is a second, subtler effect. A thread that was running on core 0 may be
resumed on core 3, because the scheduler is balancing load across cores. Core 3
has different L1 and L2 caches, which do not contain your data, so the thread
pays the refill cost again. Lesson 04 covers what to do about that.

## Check your understanding

A colleague writes an image-processing script and finds it slow. They rewrite
it to use 8 Python threads, each processing different images with pure Python
loops. On their 8-core laptop, the threaded version is very slightly slower
than the original.

Explain the result, and say what change would actually produce parallelism. A
correct answer says the work is Python-level, so every thread must hold the GIL
to execute and only one runs at a time, giving no parallel speedup; and that
the slight slowdown comes from the overhead of switching between eight threads
that cannot proceed simultaneously, including cache refill after each switch.
The fix is to use separate processes, each with its own interpreter and lock,
or to move the per-image work into a C library that releases the lock.
