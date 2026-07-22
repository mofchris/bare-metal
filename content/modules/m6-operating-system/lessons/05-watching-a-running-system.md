---
id: m6/05-watching-a-running-system
title: "Watching a running system — the counters the OS already keeps"
objectives:
  - "Name the four resources to check first when a program is slow, and what each one rules out"
  - "Explain what a hardware performance counter measures that a sampling profiler cannot"
  - "State which of these tools exist on this laptop and which do not"
sources:
  - "Brendan Gregg, Systems Performance, 2nd ed., ch. 2 and 6 (methodology, CPUs)"
  - "Linux perf wiki (perf.wiki.kernel.org) — events, counters, and perf stat"
  - "Microsoft docs: Windows Performance Toolkit and Resource Monitor"
---

## What this lesson answers

M2/03 taught profiling: attribute a program's runtime to its functions. That
answers "which of my functions is slow" and is silent on a different question —
"is my program even the problem?"

A program can be slow because it is waiting on a disk, because the machine is
short of memory and paging, because another process is taking the core, or
because the chip has throttled. A function-level profile shows none of those
directly. The operating system is already counting all of them.

This lesson is about looking there first.

## What should you check, and in what order?

Four resources, and each check rules something out. Checking in this order
means you rarely need all four.

**CPU.** Is a core actually busy? If your program is single-threaded and one
core is at 100% while the rest idle, the program is compute-bound and M2/03's
profiling is the right next step. If no core is busy, the program is waiting on
something and profiling function time will mislead you.

**Memory.** Is the machine paging? Lesson 02 gave the number: a page fault
served from an SSD costs on the order of 100 microseconds, a thousand times a
cache miss. A system that is short of memory is not slow in a way any code
change will fix.

**Disk.** Is the drive saturated, and is it saturated on bytes per second or on
requests per second? M4/02 drew that distinction as IOPS versus bandwidth, and
it decides the fix: many small reads is a layout problem, few large reads at
the device's limit is a hardware ceiling.

**Interference.** Is another process taking the core? Lesson 01 explained the
mechanism and M2/01 made it a benchmarking rule. Here it is a diagnosis: your
code did not get slower, it got less machine.

The value of this order is that three of the four are one glance each, and each
one either eliminates a whole class of explanation or hands you the answer.

## What do hardware counters see that a profiler cannot?

Every modern processor contains **performance counters**: small pieces of
hardware that count events as they happen. Cycles executed. Instructions
retired. Cache misses at each level. Branch mispredictions. TLB misses.

They are qualitatively different from the sampling profiler in M2/03. A
sampling profiler interrupts your program and asks where it is, so it can say
_which function_ consumed the time. It cannot say _why_ that function was slow.

Counters answer the why. Consider two functions that both take 10 ms. One
retires 30 million instructions with almost no cache misses. The other retires
2 million instructions and suffers 400,000 last-level cache misses. Those are
completely different problems — the first is doing too much work, the second is
waiting on memory — and a profiler shows them as identical.

Two derived numbers are worth knowing by name. **IPC**, instructions per cycle,
is instructions retired divided by cycles elapsed; a superscalar core (M1/02)
can retire several per cycle, so an IPC near 0.3 says the core is mostly
stalled. **Cache miss rate** per thousand instructions tells you whether the
stall is a memory problem.

This is how you would confirm, rather than assume, that a kernel sits on the
memory-bound side of M1/04's roofline.

## What exists on this laptop, and what does not?

The field's standard tool is `perf`, and it is Linux-only. This laptop runs
Windows 11, so it is not available. Saying otherwise would be the kind of
promise the rest of this curriculum has been careful not to make.

Here is the honest mapping.

For the four-resource check, Windows has **Task Manager** and the more detailed
**Resource Monitor**, which cover CPU per core, memory and paging, and disk
activity split into bytes and operations. Both are adequate for the first pass
described above.

For hardware counters, Windows has the **Windows Performance Toolkit** (`xperf`
and Windows Performance Analyzer), and Intel's **VTune** reads the counters
directly on Intel hardware, which this laptop has.

For the Linux tooling by name, **WSL2** runs a real Linux kernel on Windows, so
`perf` can be installed there. Be aware of what that measures: it is a
virtualized environment, and counter access under virtualization is restricted,
so treat WSL numbers as indicative rather than as measurements of the bare
machine.

If you take one thing from this section, take the habit rather than the tool
names: before optimizing a program, spend one minute finding out whether the
program is the thing that is slow.

## How does this connect to the rest of the curriculum?

This lesson closes M6 by tying its four lessons to a single practice.

Lesson 01 explained why another process can steal your time, which is the
interference check. Lesson 02 explained page faults, which is the memory check.
Lesson 03 explained that a read is a system call that may or may not touch the
drive, which is the disk check. Lesson 04 explained core placement, which is why
the CPU check must be read per core rather than as one average.

And all four sit underneath M2's measurement discipline. M2 told you to take
many runs and report the spread. This module tells you what to look at when the
spread is large.

## Check your understanding

A training script takes 40 minutes instead of the expected 12. You check the
system: one core is at 100%, the other eleven are near idle, memory use is well
under capacity with no paging, and the disk is almost inactive.

Say what has been ruled out, what the likely cause is, and what you would do
next. A correct answer notes that memory and disk are ruled out, since there is
no paging and no disk activity, and that interference is ruled out because the
other cores are idle. One core pegged with eleven idle indicates single-threaded
compute-bound work, so the likely cause is that the job is not using the
available parallelism — for instance a DataLoader with no worker processes
(M4/01), or a library confined by the GIL (M6/01). The next step is a profile
(M2/03) to find which function holds that core.
