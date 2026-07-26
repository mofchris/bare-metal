---
id: m1/01b-dram-internals
title: "Inside DRAM — why the first byte is slow"
objectives:
  - "Show by calculation that the wire to the memory chip is not what makes an access slow"
  - "Name the steps a DRAM chip performs to answer a read, in order"
  - "Explain why the same amount of data takes longer to read in random order than in sequence"
sources:
  - "Ulrich Drepper, What Every Programmer Should Know About Memory (2007), section 2.2"
  - "Bruce Jacob, Spencer Ng & David Wang, Memory Systems: Cache, DRAM, Disk (Morgan Kaufmann, 2007), chapters 10-13"
  - "Onur Mutlu, Computer Architecture lecture notes (ETH Zurich), the main-memory and DRAM lectures"
practice:
  - level: 1
    problem: >-
      A DDR4-3200 part has a 1600 MHz internal clock, so one clock tick is
      0.625 ns. Its CAS latency is 22 ticks. How long, in nanoseconds, does the
      chip take to start returning data once it is asked for a column in a row
      that is ALREADY open?
    hints:
      - "CAS latency is measured in clock ticks, and you are given the length of a tick."
    answer: >-
      22 x 0.625 = **13.75 ns**. That is the best case DRAM offers: the row is
      already sitting in the row buffer and only the column selection remains.
  - level: 2
    problem: >-
      The same part has tRP of 22 ticks and tRCD of 22 ticks. Work out how long
      a read takes when it lands on a row that is NOT open and another row is
      currently open, and say how many times slower that is than the best case
      you just computed.
    hints:
      - "Three things must happen in order: close the open row, open the new one, then read the column."
      - "Each of the three costs 22 ticks of 0.625 ns."
    answer: >-
      tRP + tRCD + CL = 22 + 22 + 22 = 66 ticks, and 66 x 0.625 = **41.25 ns**,
      which is **three times** the 13.75 ns best case. Nothing about the wire
      changed between the two cases; the difference is entirely which rows were
      already open.
  - level: 3
    problem: >-
      A signal travels roughly 15 cm per nanosecond along a circuit-board
      trace. Suppose you could move the memory chip from 3 cm away to touching
      the processor, eliminating the wire completely. Using the 41.25 ns figure
      above, what percentage of the access would you save, and what does that
      tell you about why on-package memory is built?
    hints:
      - "The signal makes a round trip: out to the chip and back."
      - "Compare the round-trip time you get against the whole 41.25 ns access."
    answer: >-
      A 3 cm distance is a 6 cm round trip, and 6 / 15 = **0.4 ns** - about
      **1%** of the 41.25 ns access. Deleting the wire entirely buys almost
      nothing, because the delay lives inside the chip. On-package memory is
      built for BANDWIDTH: a short, dense connection allows a far wider bus,
      and width is the thing that scales.
---

## What this lesson answers

Lesson 01 quoted a number and moved on: a request that misses every cache waits
about 100 ns for DRAM. It said the wait is long without saying what the memory
is doing for those 100 ns, and it claimed that latency cannot be engineered
away the way bandwidth can, supporting that only with an analogy about widening
a road.

This lesson replaces the analogy with the mechanism. By the end you will be
able to say where those nanoseconds actually go, and why the same total amount
of data takes longer to read in one order than another.

## Is the wire the problem?

The intuitive suspect is distance. The memory sits a few centimetres from the
processor, so perhaps the wait is the journey.

That is checkable. An electrical signal travels along a circuit-board trace at
roughly 15 centimetres per nanosecond, a little over half the speed of light. A
memory chip 3 cm away therefore sits 6 cm away as a round trip, out and back,
which takes 6 / 15 = **0.4 ns**.

Against an access of 40 to 100 ns, 0.4 ns is under one percent. Even deleting
the wire completely — moving the memory onto the processor's own package, which
is exactly what Apple's M-series chips and every phone chip do — cannot recover
more than that one percent of the wait.

So the distance is not the problem, and the rest of this lesson is about where
the other 99% goes.

It is worth noticing that on-package memory is nonetheless worth building, for
a different reason. **Bandwidth** is how many bytes arrive per second once data
is flowing steadily — a rate, as opposed to latency's single wait. Putting the
memory millimetres away allows a much wider connection between it and the
processor, and more wires side by side means more bytes arriving per second. So
on-package memory is a bandwidth technique that happens to shave a fraction off
the latency, not the other way round.

## What happens inside the chip?

The delay is internal, so the internals need naming. Four terms, each of which
is a physical thing on the chip.

A DRAM chip is divided into **banks**, which are independent sub-units that can
be working on different requests at the same time. Each bank holds a grid of
storage cells, and the grid's horizontal lines are called **rows**. A row is
typically 8192 bits wide, which is far more than any one request needs.

Each cell stores one bit as a tiny electrical charge in a capacitor, which is a
component that holds charge the way a very small bucket holds water. That
charge is minuscule, and reading it is the crux of everything in this lesson.

A **sense amplifier** is the analog circuit that detects that tiny charge and
amplifies it into a clean digital 0 or 1. There is one per column of the grid,
and together they form the **row buffer**: a strip of storage holding one
complete row that has been read out and amplified.

Now the sequence. When the processor asks for an address, the memory controller
splits it into fields naming the bank, the row, and the column. No searching
happens — decoders use those bits to switch on exactly one bank and exactly one
row directly, which is why this part is fast. Then:

1. **Activate.** The chosen row's line is energised, and every cell along it
   dumps its charge onto the sense amplifiers, which detect and amplify it. The
   whole row now sits in the row buffer. This is slow because sensing a tiny
   charge is an analog measurement, not a digital lookup.
2. **Read the column.** The requested bytes are selected out of the row buffer
   and sent back.
3. **Precharge.** Before a different row in that bank can be activated, the
   bank must be reset to a neutral state, because reading drained the cells and
   the sense amplifiers must be returned to a known starting point.

## What do tRCD, CL, tRP and tRAS mean?

Each of those steps has a minimum duration, published as a timing parameter.
Four matter here, and their names are worth decoding because they appear on
every memory module you will ever buy.

| Parameter | What it is                                               |
| --------- | -------------------------------------------------------- |
| tRCD      | activate a row, before its columns can be read           |
| CL        | read a column out of an open row, before data returns    |
| tRP       | precharge, closing a row before another can open         |
| tRAS      | minimum time a row must stay open, so cells are restored |

They are quoted not in nanoseconds but in ticks of the memory's **clock**, the
steady electrical pulse that paces every step a chip takes — nothing happens
between pulses, so every duration on a chip is naturally counted in them. A
DDR4-3200 part pulses its internal clock 1.6 billion times a second, written
1600 MHz, so one tick lasts 1 / 1.6e9 seconds = **0.625 ns**. A typical
parameter value of 22 ticks is therefore 22 x 0.625 = **13.75 ns**.

Put the sequence together for the two cases that matter.

If the row you want is **already open** in the row buffer, only the column read
remains: CL alone, about **13.75 ns**.

If a different row is open, all three steps run: tRP to close it, tRCD to open
yours, then CL to read. That is 22 + 22 + 22 = 66 ticks, or about **41.25 ns**
— **three times** the first case, for exactly the same quantity of data.

Real measured latency is higher again, nearer the 100 ns of lesson 01, because
the request also queues at the memory controller behind other cores' requests
and waits for its turn on the shared bus. The controller is the part that can
be improved by better scheduling; the 41.25 ns is close to a floor.

Work the three numbers yourself before reading on — the arithmetic is the whole
argument of this lesson, and the third problem settles the question the lesson
opened with.

{{practice:1}}

{{practice:2}}

{{practice:3}}

## Why is random access slower than sequential?

The two cases above have names. Finding your row already open is a **row-buffer
hit**; finding a different one open is a **row-buffer miss**.

This is where the mechanism pays off, because it explains a fact lesson 01 could
only assert. Walking an array in order touches addresses that share a row, so
after the first access every subsequent one is a row-buffer hit at 13.75 ns.
Jumping around at random lands in a different row almost every time, paying the
full 41.25 ns. Same array, same number of bytes, same arithmetic — three times
the memory time, decided entirely by the order.

That is a second, independent reason sequential access wins, sitting underneath
the cache-line argument of lesson 01. Cache lines explain why you should use all
64 bytes you fetched. Row buffers explain why fetching them in order is cheaper
than fetching them scattered.

## So why hasn't latency improved?

Because every route to improving it costs something the market values more.

Sensing a smaller charge faster needs more sensitive amplifiers and shorter
internal lines, which means fewer cells per row and more amplifiers per chip.
That is more silicon area for the same capacity, so the memory gets more
expensive per gigabyte. More banks would allow more requests in flight, but each
bank needs its own decoders and amplifiers, which is again area. Every one of
these trades capacity or cost against a delay that caches already hide most of
the time.

Bandwidth faces no such wall. Adding another channel or widening the connection
adds wires, and wires are cheap and work in parallel. That asymmetry — width scales, sensing
does not — is the whole reason lesson 01's rule holds: you can usually get more
bytes per second, and you can rarely get the first byte sooner.

## Check your understanding

You benchmark two loops over the same 64 MB array. One walks it in order, the
other visits the same elements in a random order. The random version is far
slower.

Name the two independent effects making it slower and say which lesson each
comes from. A correct answer names cache lines from lesson 01 — the random walk
uses one value from every 64-byte line it fetches, wasting the other 15 float32
values — and row-buffer misses from this lesson — each jump lands in a different
DRAM row, paying tRP + tRCD + CL instead of CL alone. Both are consequences of
order rather than of quantity.
