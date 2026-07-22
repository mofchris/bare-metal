---
id: m6/02-virtual-memory
title: "Virtual memory — pages, page tables, and why an address is not a location"
objectives:
  - "Explain what a virtual address is and what translates it into a physical one"
  - "Explain what the TLB does and why a large random access pattern can miss it"
  - "Explain why a process can allocate memory it never actually receives"
sources:
  - "Arpaci-Dusseau & Arpaci-Dusseau, Operating Systems: Three Easy Pieces, ch. 13–22 (virtualizing memory)"
  - "Ulrich Drepper, What Every Programmer Should Know About Memory (2007), section 4 (virtual memory)"
  - "Hennessy & Patterson, Computer Architecture, 6th ed., appendix B.4 (virtual memory and the TLB)"
---

## What this lesson answers

Lesson 01 said each process has its own memory and cannot see another's. That
raises a question it did not answer: your laptop has one set of RAM chips, so
how do two processes both use "address 0x1000" and get different data?

The answer is a translation layer sitting between every address your program
uses and the actual hardware. This lesson covers how it works, and then the two
places where it becomes a performance problem rather than an invisible
convenience.

## What is a virtual address?

Every address your program handles is a **virtual address**. It is not a
location in RAM. It is a number that means something only inside your process.

The hardware translates each virtual address into a **physical address**, which
is an actual location in the RAM chips, and it does this on every single memory
access. Two processes using the same virtual address are translated to
different physical addresses, so they never collide.

Translation happens in fixed-size blocks called **pages**, typically 4 KB. The
system does not track individual bytes, because a table with one entry per byte
would be larger than the memory it described. It tracks pages, and the offset
within a page is carried through untranslated.

The structure holding the mapping is the **page table**, one per process. The
operating system builds it; the hardware reads it.

## What does this buy?

Three things, and they are the reason every general-purpose system works this
way.

**Isolation.** A process can only reach physical memory that its own page table
maps. Nothing else is addressable, so lesson 01's guarantee is enforced by
hardware rather than by good behaviour.

**The illusion of contiguity.** Your program sees one continuous address space.
The physical pages behind it can be scattered anywhere in RAM, which means the
system never has to find a large contiguous free region to satisfy a large
allocation.

**Overcommit.** A page can be mapped lazily, meaning the mapping exists but no
physical page has been assigned yet. The process believes it has the memory.
Physical RAM is only committed when the page is first touched.

That third one has a consequence worth remembering. Allocating a large array
often succeeds instantly and costs nothing, and the real cost arrives later, at
first touch, spread across the loop that fills it. A benchmark that allocates
inside its timed region may be measuring page assignment rather than the work.

## Why is translation not slow?

Reading the page table on every memory access would be a disaster: the page
table is itself in memory, so every access would become two or more accesses.

The hardware solves it with a cache, exactly as M1/01 solved the DRAM problem.
The **TLB**, or translation lookaside buffer, is a small fast store of recently
used translations, sitting inside the core.

A TLB hit translates the address in essentially no time. A TLB miss requires
walking the page table in memory, costing tens to hundreds of cycles before the
access you actually wanted can even begin.

Now the number that matters. A TLB typically holds on the order of 1500 to 3000
entries. At 4 KB per page, that covers roughly 6 to 12 MB of memory.

## When does the TLB become your problem?

Work out what that coverage implies. A program striding randomly through an
array much larger than about 10 MB touches a new page on most accesses, so most
accesses miss the TLB. Each miss costs a page-table walk _on top of_ whatever
cache miss the access itself causes.

This is why very large random-access workloads can be slower than M1's cache
arithmetic alone predicts. You are paying two independent misses per access:
one for the translation, one for the data.

Two mitigations exist and both are worth recognising. **Huge pages** raise the
page size from 4 KB to 2 MB, so the same number of TLB entries covers several
gigabytes instead of several megabytes. And the same access-order discipline
from M1/01 helps here for the same reason: walking memory in order means many
consecutive accesses fall inside one page, so one translation serves all of
them.

## What happens when physical memory runs out?

The operating system reclaims pages. It picks pages that have not been used
recently, writes them to disk if their contents cannot be regenerated, and
reassigns the physical page to whoever needs it now.

If the process later touches a reclaimed page, the hardware finds no valid
mapping and raises a **page fault**. The operating system pauses the process,
fetches the page back from disk, updates the page table, and resumes.

Note the cost scale, because it is the largest number in this curriculum so
far. A cache miss costs about 100 nanoseconds. A page fault that must read from
an SSD costs on the order of 100 microseconds, which is a thousand times worse.

When a system is short of memory and faulting constantly, it is said to be
**thrashing**: nearly all of its time goes to moving pages rather than to work.
This is the difference between a program that is slow and a machine that has
stopped responding.

## Check your understanding

You benchmark two versions of a program that both sum a 64 MB float32 array.
Version A walks the array in order. Version B visits the same elements in a
random order. Both do identical arithmetic, and B is roughly 30 times slower —
more than the cache argument from M1/01 alone would predict.

Name the second effect and explain why it applies here. A correct answer says
that B also misses the TLB: 64 MB spread over 4 KB pages is 16,000 pages, far
more than the roughly 1500 to 3000 entries a TLB holds, so a random access
usually needs a page-table walk before the data access even starts. A pays this
almost never, because consecutive elements sit in the same page and one
translation serves about 1000 float32 values.
