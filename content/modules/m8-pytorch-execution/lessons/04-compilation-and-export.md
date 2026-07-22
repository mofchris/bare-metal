---
id: m8/04-compilation-and-export
title: "Compilation and export boundaries — where a graph starts and stops"
objectives:
  - "Explain why capturing a graph from eager code is harder than it sounds"
  - "Distinguish tracing from scripting, and say what each one captures and misses"
  - "Explain what a graph break is and why it limits the speedup a compiler can deliver"
sources:
  - "PyTorch docs: torch.compile and TorchDynamo (pytorch.org/docs/stable/torch.compiler.html)"
  - "PyTorch docs: torch.jit.trace and torch.jit.script (pytorch.org/docs)"
  - "PyTorch docs: torch.onnx export (pytorch.org/docs/stable/onnx.html)"
---

## What this lesson answers

Lesson 01 said eager mode runs each operation as Python reaches it, and that
this is why models are easy to write and debug. It also said the cost is
per-operation overhead paid many times.

The way to recover that cost is to capture the operations into a graph and hand
the whole graph to something that can optimize it. But eager mode's great
strength, that a model is ordinary Python, is exactly what makes capturing the
graph hard. This lesson is about that tension, the tools that manage it, and why
they succeed on some models and struggle on others. It is also the direct
foundation for M10, which takes a captured graph to a different runtime.

## Why is capturing a graph hard?

M5/01 already contained the difficulty without naming it. PyTorch builds the tape
by define-by-run: whatever Python actually executed is what got recorded. That
works because it only ever records one specific execution.

A graph you want to optimize and reuse needs more. It needs to represent the
computation for inputs you have not seen yet, and an eager model can do things
that depend on the actual input in ways a static graph cannot express.

Two examples show the gap. A model with `if x.sum() > 0:` takes a different path
depending on the data, so there is no single graph, there are two. A model whose
loop runs `x.shape[0]` times does a different amount of work per input. Ordinary
Python handles both trivially because it just runs. A captured graph has to
either pick one version or represent the choice, and neither is free.

So graph capture is not a mechanical transcription of your code. It is an attempt
to pin down something that was deliberately left dynamic, and the tools differ in
how they handle the parts that will not pin down.

## What is the difference between tracing and scripting?

PyTorch's older graph tools take two opposite approaches to the problem, and
knowing which is which prevents a classic silent bug.

**Tracing** runs your model once on an example input and records the operations
that actually executed. It is simple and it works on almost any code, because it
only has to record one real execution, exactly like the tape.

Its weakness is the direct consequence of that strength. A trace records the path
taken for the example input and bakes it in. If your model has an `if` that went
down the true branch for the example, the trace contains only the true branch,
and it will silently take that branch for every future input, including ones that
should have gone the other way. The trace is not wrong about what it saw; it is
wrong to assume what it saw is the whole model.

**Scripting** instead analyses your code as source, including its `if`s and
loops, and produces a graph that preserves the control flow. It captures the
branching that tracing loses.

Its weakness is the mirror image. Analysing source means it only supports the
subset of Python it knows how to translate, so models using constructs outside
that subset need rewriting to be scriptable.

The rule that falls out: trace models that are just a straight run of operations,
script models whose control flow depends on the data, and never trace a model
with data-dependent branches unless you want the example's path frozen in.

## What does torch.compile do differently?

The modern tool, `torch.compile`, was built to avoid forcing that choice, and
the way it does so introduces the concept this lesson is really about.

`torch.compile` captures graphs from ordinary eager code automatically, with no
rewriting. When it reaches a piece of Python it cannot put into the graph, such
as a data-dependent branch or an unsupported operation, it does not fail and it
does not silently freeze a path. It stops the graph there, lets that piece run
in normal eager mode, and starts a new graph afterwards.

That stopping point is called a **graph break**. The model still runs correctly,
because the awkward piece simply ran eagerly. What you lose is optimization
scope: the compiler can only optimize within each unbroken graph, so a model
chopped into many small graphs by many breaks gets much less benefit than one
captured whole.

This reframes the speedup question. The gain from compilation is not a fixed
property of a model. It depends on how much of the model can be captured into
large graphs, which depends on how much data-dependent Python sits in the hot
path. Removing a graph break, often by restructuring a branch, can matter more
than any other single change.

## What is export, and how is it stricter?

Everything so far kept the graph inside PyTorch. **Export** takes the graph out
of PyTorch entirely, into a format another runtime can load, which is the subject
of M10.

Export is the strictest form of graph capture, and the reason is now clear. A
`torch.compile` graph break can fall back to eager Python because Python is still
there. An exported graph runs somewhere with no Python at all, so there is
nothing to fall back to. Every operation must be in the graph, or export fails.

This is why export surfaces problems the other tools tolerated. A model that runs
fine eagerly, and even compiles with a few harmless graph breaks, can refuse to
export because one operation has no equivalent in the target format, or because a
data-dependent shape cannot be pinned down. The export boundary is where a model
stops being "Python that computes tensors" and has to become "a fixed graph a
runtime can execute", and not every model crosses it without changes.

M10 is about what lives on the other side of that boundary and why you would want
to send a model across it.

## Check your understanding

You trace a model with `torch.jit.trace` using an example image, and it works.
In production it gives correct-looking but subtly wrong outputs for some inputs.
The model contains a line `if x.mean() > 0.5: x = self.branch_a(x) else: x =
self.branch_b(x)`, and your example image had a mean above 0.5.

Explain the bug and name a capture method that would not have it. A correct
answer says tracing records only the operations that executed for the example,
so because the example's mean exceeded 0.5 the trace contains `branch_a` alone
and silently uses it for every input, including those that should take
`branch_b`. Scripting would preserve the `if` because it analyses the source's
control flow rather than one execution, and `torch.compile` would keep the model
correct by inserting a graph break at the data-dependent branch and running it
eagerly.
