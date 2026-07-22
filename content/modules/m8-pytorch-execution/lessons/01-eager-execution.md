---
id: m8/01-eager-execution
title: "Eager execution — what happens when you call an operation"
objectives:
  - "Explain what eager execution means and what it does the moment an operation is called"
  - "Explain why Python-level overhead per operation matters for many small operations"
  - "Explain the dispatch step that turns one Python call into one hardware kernel"
sources:
  - "PyTorch docs: PyTorch internals / the dispatcher (blog.ezyang.com, 'Let's talk about the PyTorch dispatcher')"
  - "PyTorch docs: Autograd mechanics and Tensor basics (pytorch.org/docs)"
  - "Paszke et al., PyTorch: An Imperative Style, High-Performance Deep Learning Library, NeurIPS 2019"
---

## What this lesson answers

You have used the pieces PyTorch is built from without seeing the machine that
runs them. M5 explained the tape it records. M1 to M4 explained the hardware it
runs on. This module is about the layer in between: what actually happens when
your Python calls a PyTorch operation, and why knowing that changes how you
write and measure code.

This first lesson answers the most basic version. You write `c = a + b` on two
tensors. What does that line do?

## What does "eager" mean?

PyTorch runs in **eager** mode by default. Eager means each operation executes
the moment your Python reaches it, and returns a real result before the next
line runs.

The alternative is worth naming so the default has something to contrast with.
A **graph** mode records your operations without running them, building a
description of the whole computation, and executes that description later. You
met this idea already: M5's tape is a graph of the forward pass, recorded for
the backward pass to walk.

Eager execution is graph mode's opposite for the forward direction. Nothing is
deferred. `c = a + b` computes `c` right there, and if you print it you see
numbers, not a promise.

The reason PyTorch chose eager as its default is the reason it became popular.
Your model is ordinary Python. An `if` runs when reached, a `print` shows real
values, and a debugger stops on a real tensor. M5/01 called this
define-by-run, and this is the same fact seen from the forward side: whatever
Python executed is what happened.

## What does one operation actually cost?

`c = a + b` looks like one addition. It is much more than that, and the extra is
the point of this lesson.

Follow the call. Python has to work out that `+` on two tensors means
`torch.add`. PyTorch then has to decide which implementation to run, because the
right code depends on the tensors' data type, their device, and whether
gradients are being tracked. Only then does the actual addition happen, and if
gradients are on, M5's tape records the operation as well.

All of that surrounding work is **overhead**: real time spent per operation that
is not the arithmetic. It is on the order of a few microseconds per operation.

Now put that next to M1's numbers. A few microseconds is thousands of cycles at
3 GHz. For a large tensor the arithmetic dwarfs it and the overhead disappears.
For a small tensor the overhead can cost more than the work, exactly as M1/02's
Python-loop-versus-NumPy story described, one level up.

## Why does the number of operations matter more than their size?

This is the practical consequence, and it shapes how fast models are written.

A model that performs its work as a few large operations pays the per-operation
overhead a few times, and each operation gives the hardware enough work to run
efficiently. A model that performs the same work as many tiny operations pays
the overhead many times, and each operation is too small to use the machine
well.

Concretely, ten operations on million-element tensors and ten thousand
operations on thousand-element tensors can do similar total arithmetic while
performing very differently, because the second pays overhead a thousand times
more often.

This is why the fix for slow model code is so often "do the same work in fewer,
larger operations" rather than "make each operation faster". It is also the
first half of why kernel fusion matters, which M10 returns to: fusing many small
operations into one removes both the repeated overhead and the repeated trips to
memory.

## What is the dispatcher, and why should you care?

The step where PyTorch decides which implementation to run has a name worth
knowing, because it explains several things you will otherwise find mysterious.

The **dispatcher** is the part of PyTorch that routes one operation to the
correct concrete implementation, based on the tensors involved. The same
`torch.add` is sent to a CPU implementation for CPU tensors, a CUDA
implementation for GPU tensors, a different path when autograd is recording, and
yet another when the tensors are quantized.

Two things follow that matter later in this module and the next.

First, one Python operation ends up running one compiled routine, and M1's
vocabulary has a word for that routine: a **kernel**. So "PyTorch called a
kernel" means the dispatcher selected a compiled implementation and ran it. When
M11 profiles operator-level time, it is measuring these kernels.

Second, the dispatcher is why the same code runs on CPU and GPU with no changes
on your part. You did not write two versions; the dispatcher chose between them.
That convenience is also a cost, because the choosing is part of the
per-operation overhead above.

## Check your understanding

Two implementations compute the same result on the CPU. Version A applies five
elementwise operations to one 10-million-element tensor. Version B loops over
the tensor in Python and applies the five operations to one element at a time.
Version B is thousands of times slower.

Explain the gap in terms of this lesson, and say which of the two ways of
speeding B up actually helps. A correct answer says that Version A pays PyTorch's
per-operation overhead five times total and hands the hardware large tensors it
can run efficiently, while Version B pays that overhead five times per element,
ten million times over, on operations far too small to use the machine. The fix
is to do the work in a few large tensor operations, as A does, rather than to
make each tiny operation faster, because the cost is the number of dispatched
operations, not their individual speed.
