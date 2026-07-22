---
id: m1/04-roofline-model
title: "The roofline model — knowing your speed limit"
objectives:
  - "State the roofline formula and compute attainable performance for a given kernel"
  - "Locate the ridge point of a machine and say what it separates"
  - "Choose the right optimization direction (reuse vs arithmetic) from a kernel's position under the roof"
sources:
  - "Williams, Waterman & Patterson, Roofline: An Insightful Visual Performance Model for Multicore Architectures, CACM 2009"
  - "Hennessy & Patterson, Computer Architecture: A Quantitative Approach, 6th ed., ch. 1 (roofline section)"
---

## What this lesson answers

Lesson 03 gave you a procedure: count FLOPs, count bytes, divide, compare
against the machine's break-even point. That works, but it answers only one
question at a time and gives you no way to see several pieces of code at once.

This lesson turns the same arithmetic into a picture. The picture answers two
questions on sight: what is the fastest this code could possibly run on this
machine, and which change would actually move it.

## How is the picture built?

Draw a graph. Performance in GFLOPS goes up the vertical axis. Arithmetic
intensity in FLOPs per byte goes along the horizontal axis.

Both axes use a **log scale**, meaning each equal step along the axis
multiplies the value rather than adding to it: 1, 10, 100, 1000. That choice is
forced on you by the numbers themselves. Lesson 03 produced intensities of
0.083 and of 167, which differ by a factor of two thousand. On an ordinary axis
one of them would be invisible.

Two lines then bound everything the machine can do.

The first line comes from bandwidth. At an intensity of I FLOPs per byte, a
machine delivering B bytes per second can support at most I × B operations per
second. Double the arithmetic you do per byte and you are allowed double the
speed, so this line rises from the bottom left with a constant slope.

The second line comes from compute. No code exceeds the arithmetic units,
however favourable its intensity, so this line is flat across the whole graph at
the machine's peak GFLOPS.

Together the two lines look like a roof: a slope rising from the left, meeting
a flat top. Hence the name. The machine's limit at any intensity is whichever
of the two lines is lower there:

> attainable GFLOPS = min( peak compute, intensity × peak bandwidth )

## What is the ridge point?

The corner where the sloping line meets the flat one is called the **ridge
point**. It sits at the intensity where the two limits are equal, which is peak
compute divided by peak bandwidth.

For this laptop that is 380 GFLOPS ÷ 100 GB/s ≈ 4 FLOPs per byte, the same
break-even number lesson 03 computed. The graph has not added new information;
it has given that number a location.

To the left of the ridge, the sloping line is lower, so bandwidth is the
binding limit and code there is memory-bound. To the right, the flat line is
lower, so arithmetic is the binding limit and code there is compute-bound.

## How do you read the plot as an engineer?

Place a piece of code on the graph using two numbers: its arithmetic intensity,
which you compute by hand, and its measured GFLOPS, which you obtain by timing
it. Where the point lands tells you what to do next, and there are three cases.

**Case 1: the point sits on the sloping roof.** The code is memory-bound and
already running as fast as bandwidth permits. Adding cores, raising the clock,
or using wider SIMD registers will do nothing, because none of them deliver
bytes any faster. The only changes that help move fewer bytes.

One such change is switching to a smaller **dtype**. A dtype is the number
format a tensor's elements are stored in. Lesson 02 used fp32, which is 4 bytes
per number; fp16 is a 16-bit format at 2 bytes per number. Halving the bytes
while performing the same operations doubles the intensity, which slides the
point rightward along the graph and raises its ceiling.

**Case 2: the point sits on the flat roof.** The code is compute-bound and
already saturating the arithmetic units. Memory tricks are wasted here.
Progress requires either using the arithmetic hardware better, such as issuing
FMA instructions and using every core, or performing fewer operations.

**Case 3: the point sits well below both roofs.** The code is not hitting any
hardware limit at all, so the hardware is not the problem. Something in the
software is: interpreter overhead, an access pattern that defeats the
prefetcher, or work divided unevenly between cores so some finish early and
wait.

Case 3 is the reason the plot is worth building. Before you have it, "my code
is slow" and "this machine is slow" look identical. One measurement separates
them.

## What does the model leave out?

The basic roofline assumes the machine overlaps arithmetic and memory traffic
perfectly, fetching the next bytes while computing on the current ones. Real
hardware does this imperfectly.

It also uses peak figures. Lesson 02 was explicit that 380 GFLOPS assumes every
core issues two full FMA instructions every cycle without ever waiting, which
real code does not sustain. A roofline drawn from a manufacturer's numbers
describes a ceiling you will never reach, so measure your machine's peaks and
draw the roof from those instead.

More detailed versions of the model add extra ceilings beneath the main roof:
the performance available without SIMD, the performance available on a single
core, and the bandwidth of each cache level rather than of DRAM alone. Each
added ceiling answers "what is stopping me from reaching the roof above it?"

## Check your understanding

On a machine with 400 GFLOPS of peak compute and 50 GB/s of bandwidth, you
measure a kernel with an arithmetic intensity of 2 FLOPs per byte running at
40 GFLOPS.

Find the ridge point, say whether this kernel is memory-bound or compute-bound,
state the fastest it could run, and say whether its problem is the hardware or
the code. A correct answer computes a ridge point of 400 ÷ 50 = 8 FLOPs per
byte, places the kernel at 2 which is to the left of 8 and therefore
memory-bound, computes its ceiling as 2 × 50 = 100 GFLOPS, and observes that
40 is well below that ceiling, so the kernel is in case 3 and the code is the
problem rather than the machine.
