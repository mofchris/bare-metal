---
id: m10/03-graph-optimisation
title: "Graph optimisation — constant folding, fusion, and what a runtime can see"
objectives:
  - "Explain constant folding and why only a whole-graph view can do it"
  - "Explain operator fusion and connect its benefit to M1's per-operation and memory costs"
  - "Explain why these optimizations preserve the model's outputs while changing its speed"
sources:
  - "ONNX Runtime docs: graph optimizations (onnxruntime.ai/docs/performance/model-optimizations)"
  - "Horace He, Making Deep Learning Go Brrrr From First Principles (horace.io/brrr_intro.html, 2022)"
  - "Chen et al., TVM: An Automated End-to-End Optimizing Compiler for Deep Learning, OSDI 2018"
---

## What this lesson answers

Lesson 01 claimed that seeing the whole graph at once lets a runtime do things
eager mode cannot, and promised two examples. This lesson delivers them, and it
is where the runtime actually earns its speed.

Both optimizations rest on the same foundation from M1: the cost of a model is
not only its arithmetic but the overhead around each operation and the memory
traffic between operations. A runtime that can see across operations can attack
both, and it changes the graph's speed while leaving its outputs identical.

## What is constant folding?

**Constant folding** computes, once at load time, any part of the graph whose
result never changes between inferences, and replaces it with the precomputed
value.

Work an example. Suppose a graph contains an operation that multiplies two weight
tensors together, and both are fixed weights that do not depend on the input.
Their product is the same on every single inference. Computing it fresh each time
is wasted work.

A runtime seeing the whole graph notices that both inputs to this operation are
constants, computes the product once when it loads the model, and stores the
result. Every inference afterward uses the stored value and skips the
multiplication entirely.

Now see why only a whole-graph view can do this. Eager mode executes one
operation when your Python reaches it and does not know that this operation's
inputs will be the same next time, because it does not look ahead (M8/01). The
knowledge that a value is constant across inferences is a property of the whole
graph over time, not of one operation in isolation. You have to see the graph to
find its constants.

The saving is real but bounded: it removes work that was genuinely redundant. It
does nothing for the input-dependent arithmetic that makes up most of a model,
which is why the next optimization matters more.

## What is operator fusion?

**Operator fusion** combines several operations that run one after another into a
single combined operation that produces the same result in one pass.

The classic case is a chain of elementwise operations, the exact case M1/03
identified as low arithmetic intensity. Suppose a graph adds a bias, then applies
an activation function, then scales the result. Unfused, that is three
operations, and here is what M1 says each one costs.

Each operation, run separately, reads its entire input tensor from memory and
writes its entire output tensor back (M1/03). So three elementwise operations
make three round trips through memory for the same data. And each operation pays
the per-operation overhead from M8/01: a dispatched call, an implementation
chosen, a kernel launched.

Fusion collapses all three into one operation that reads the input once, does the
add and the activation and the scale while the data is in registers, and writes
the output once. Follow the two savings, because they are exactly M1's two costs.

The memory saving is the large one. Three round trips through memory become one.
For a memory-bound elementwise chain, which M1/03 showed spends nearly all its
time moving bytes, cutting the memory traffic by two-thirds is close to cutting
the time by two-thirds. This is the systems payoff M1/03 promised when it named
kernel fusion as the reason low-intensity operations can be made to ride along
free.

The overhead saving is the smaller one. Three dispatched operations become one,
so the per-operation cost from M8/01 is paid once instead of three times. It
matters most exactly where M8/01 said it did: for many small operations, where
the overhead was a real fraction of the work.

Fusion needs the whole-graph view for the same reason constant folding does. To
combine three consecutive operations, something has to see all three together and
recognize that they form a fusable chain. Eager mode, seeing one at a time,
cannot.

## Why do these keep the outputs the same?

This is the property that makes graph optimization safe, and it is worth being
explicit about, because a change that alters results is not an optimization but a
bug.

Constant folding computes exactly the value the operation would have computed at
inference; it just computes it earlier. The result is identical, only the timing
moved.

Fusion computes exactly the same sequence of arithmetic — add, then activation,
then scale — on the same numbers; it just avoids writing the intermediates to
memory and reading them back. The arithmetic is unchanged.

There is one honest caveat, and M3 supplies it. Doing the arithmetic in registers
without rounding to memory in between can change the last bits, because
intermediate values may be kept at higher precision than a stored intermediate
would be, and M3/04 established that changing when rounding happens changes the
result slightly. So a fused graph can produce numerically slightly different
output, in the same way and for the same reason that M8/05's reproducibility
discussion described. It is the intended arithmetic, not a different one, which is
why the export check in lesson 02 compares against a tolerance rather than
demanding exact equality.

## Which optimizations run, and can you see them?

ONNX Runtime applies a set of these transformations automatically when it loads a
model, at a configurable optimization level. The default level applies the safe,
broadly-applicable ones; higher levels apply more aggressive fusions that may be
specific to certain hardware.

Two practical points follow. First, this is why loading a model into a runtime is
not instant: the constant folding and fusion happen at load time, which is work
done once so that every inference afterward is faster, exactly the trade lesson 01
described. Second, the runtime can emit the optimized graph so you can inspect
what it fused, which is the honest way to know what actually happened rather than
assuming. When lesson 04's execution providers enter, that inspection is also how
you see which parts of the graph each provider claimed.

## Check your understanding

A model contains, in sequence, an add of a constant bias, a ReLU, and a
multiplication by a constant scale, applied elementwise to a large activation
tensor. It runs in eager PyTorch as three separate operations. You export it and
a runtime fuses the three.

Explain the two costs the fusion removes, say which is larger and why, and state
why the outputs stay (essentially) the same. A correct answer says the three
unfused operations each read the whole tensor from memory and write it back,
making three round trips, and each pays M8/01's per-operation overhead; fusion
makes one round trip and pays the overhead once. The memory saving is the larger
one, because M1/03 showed an elementwise chain is memory-bound and spends nearly
all its time moving bytes, so cutting three round trips to one is close to
cutting the time by two-thirds. The outputs stay essentially the same because
fusion does the identical arithmetic on the identical numbers, only skipping the
memory round trips; the last bits can differ because intermediates are not
rounded to memory in between (M3/04, M8/05), which is why the check uses a
tolerance.
