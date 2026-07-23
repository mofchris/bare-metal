---
id: m10/01-why-a-second-runtime
title: "Why a second runtime exists — what a framework does that a runtime does not"
objectives:
  - "Explain what a framework carries that a deployment runtime can shed"
  - "Explain why seeing the whole graph at once enables optimizations eager mode cannot do"
  - "State honestly where a runtime helps and where it does not, without quoting invented speedups"
sources:
  - "ONNX Runtime documentation: architecture and overview (onnxruntime.ai/docs)"
  - "ONNX: Open Neural Network Exchange, format specification (onnx.ai)"
  - "PyTorch docs: torch.onnx and TorchScript (pytorch.org/docs)"
---

## What this lesson answers

M8/04 ended at a boundary: export takes a model out of PyTorch into a format
another runtime can load, and that runtime runs the graph with no Python to fall
back on. This module is about the other side of that boundary. This lesson
answers the first question anyone should ask before crossing it: why would you,
when the model already runs in PyTorch?

The answer is not that PyTorch is slow. It is that PyTorch is carrying weight it
needs for development and does not need for deployment, and that a runtime seeing
the whole graph at once can do things eager mode structurally cannot.

## What is a runtime, and what is ONNX?

A **runtime** here means a program whose only job is to load a fixed model graph
and execute it fast, with none of the machinery for building, training, or
debugging models. **ONNX Runtime** is the specific one this module uses.

**ONNX**, Open Neural Network Exchange, is the file format the graph is exported
into. It is a standard way to write down a model's operations and weights so that
a tool other than the one that trained it can load it. You export from PyTorch to
an ONNX file, and ONNX Runtime loads that file.

The value of a shared format is worth naming. A model trained in PyTorch can be
run by any runtime that reads ONNX, on hardware the training framework never
supported, without rewriting the model. The format decouples where a model is
built from where it runs.

## What does the framework carry that a runtime sheds?

M8/01 and M8/03 already itemized most of this without framing it as deployment
overhead.

The framework carries **autograd**. M5 and M8/03 showed the tape recording every
operation and pinning activations for a backward pass. At inference there is no
backward pass, and M8/03's `inference_mode` already removes this inside PyTorch,
but a runtime built only for inference never had it to begin with.

The framework carries **the dispatcher and Python**. M8/01 showed that each
operation pays per-operation overhead: Python resolving the call, the dispatcher
choosing an implementation by dtype and device. A runtime executing a fixed graph
has already made every one of those choices once, at load time, and does not
repeat them per operation or per inference.

The framework carries **flexibility you are no longer using**. Eager mode can run
arbitrary Python, take data-dependent branches, and change shapes per input
(M8/04). A deployed model usually does none of that, and the machinery that
allows it has a cost even when unused.

Shedding all of this is a real saving, and it is honest to say so without a
number attached. The exact speedup depends entirely on the model and the machine,
which is why this lesson quotes none. What it can say precisely is the mechanism:
a runtime pays fixed costs once at load rather than repeatedly at inference.

## Why does seeing the whole graph matter?

This is the deeper reason, and it is the one eager mode cannot match no matter how
much overhead you strip.

Eager mode executes one operation at a time and, by construction, does not know
what comes next (M8/01). A runtime loads the entire graph before running
anything, so it can see the whole computation at once, and that global view
enables optimizations that are impossible when you only see one operation.

Two examples, both developed properly in lesson 03. If two operations can be
combined into one that does the same work with a single pass over memory, only
something seeing both operations together can combine them. If part of the graph
computes a value that never changes between inferences, only something seeing the
whole graph can compute it once at load and skip it forever after.

The principle is general and worth holding onto. Local decisions, made one
operation at a time, cannot capture global structure. A runtime trades eager
mode's flexibility for a complete, fixed picture, and it spends that picture on
optimizations that need to see across operations.

## Where does a runtime not help?

Honesty about the boundary is part of understanding it, and this connects to M7.

A runtime does not make a memory-bound operation compute-bound. M1's roofline is
hardware, and no amount of graph optimization moves the roof. If a model's time
is dominated by streaming large weights from memory (M1/03), a runtime can remove
overhead around that streaming but cannot make the memory faster.

A runtime does not fix a slow algorithm. If the model is doing too much
arithmetic, a runtime executes that arithmetic more efficiently but does not
reduce it. Choosing a smaller model or compressing it (M9) is a different lever.

And a runtime's benefit is a measurement, not a guarantee. M7's discipline
applies exactly: whether export is worth it for your model on your hardware is a
question you answer by exporting, measuring against the PyTorch baseline with
warmup and repetition (M2), and comparing. This module teaches what a runtime
can do so that the measurement is not a mystery, not so that you can skip it.

## Check your understanding

A colleague insists that exporting any PyTorch model to ONNX Runtime will make it
faster, and treats it as a free win to apply everywhere. You have a model whose
inference time is dominated by streaming one very large weight matrix from memory
on each call.

Give the two-part honest response: what a runtime genuinely removes, and why it
may barely help this particular model. A correct answer says a runtime sheds the
framework overhead that PyTorch carries for development — autograd, per-operation
Python and dispatcher cost, unused flexibility — and can optimize across the
whole graph because it sees it at once, which eager mode cannot. But this model
is memory-bound on a large weight (M1/03), and a runtime cannot move M1's
roofline: it can trim overhead around the streaming but not make the memory
faster, so the benefit may be small. It should add that the only way to know is
to export and measure against the PyTorch baseline (M2, M7).
