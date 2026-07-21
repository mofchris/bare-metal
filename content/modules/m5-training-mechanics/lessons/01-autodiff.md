---
id: m5/01-autodiff
title: "Autodiff: how gradients actually get computed"
objectives:
  - "Distinguish automatic differentiation from symbolic and numerical differentiation"
  - "Explain why reverse mode wins for ML and what the tape records"
  - "Explain why activations must be kept alive until the backward pass"
sources:
  - "Baydin, Pearlmutter, Radul & Siskind, Automatic Differentiation in Machine Learning: a Survey, JMLR 2018"
  - "Griewank & Walther, Evaluating Derivatives, 2nd ed., SIAM 2008"
  - "PyTorch docs: Autograd mechanics (pytorch.org/docs/stable/notes/autograd)"
---

## What we're actually computing

M3 said gradients are the per-weight instructions for making the loss smaller.
This lesson is how a machine produces millions of them without dying.

The underlying quantity is a **derivative**: how much an output moves when you
nudge one input slightly. A **gradient** is just the collection of those, one
per parameter — for every weight in the model, how much the loss would change
if you moved that weight a little. The tool for computing derivatives through
a chain of operations is the **chain rule**: if a feeds b and b feeds c, then
the sensitivity of c to a is the sensitivity of c to b multiplied by the
sensitivity of b to a. Derivatives compose by multiplying along the path.

## Three ways to get a derivative, two of them wrong for us

**Symbolic** differentiation (what you did in calculus) manipulates the
expressions themselves, producing a formula for the derivative — but the
formula for a million-parameter network's gradient explodes in size long
before you can evaluate it.

**Numerical** differentiation uses finite differences: nudge a parameter by a
tiny amount, re-run the whole model, see how much the loss moved, divide. That
needs one full forward pass _per parameter_ — a million passes for a million
parameters — and the subtraction of two nearly equal loss values is
catastrophic cancellation straight from M3/04. It's slow _and_ inaccurate. It
survives only as a sanity check on other methods ("gradcheck").

**Automatic differentiation** is the third way, and it's neither of those: run
the ordinary program, and because every program is ultimately a composition of
primitive operations (+, ×, exp, matmul…) whose individual derivatives are
known formulas, apply the chain rule _to the execution itself_. Numerically
exact (to float precision), at a small constant multiple of the program's own
cost.

## Forward mode vs reverse mode

The chain rule multiplies sensitivities along a path, and multiplication can
be done starting from either end. That's the whole distinction:

- **Forward mode** pushes derivatives along beside the computation, from
  inputs toward outputs. One pass yields the derivative with respect to _one
  input_. Cost scales with the number of **inputs**.
- **Reverse mode** runs the function once forward, then propagates
  sensitivities backward from the output. One backward pass yields the
  gradient with respect to **all inputs at once**. Cost scales with the number
  of **outputs**.

Training has millions of inputs (the parameters) and exactly one output (the
scalar loss — "scalar" meaning a single number, not an array). So reverse mode
computes the entire gradient for roughly **2–3× the cost of one forward
pass**, no matter how many parameters there are. That asymmetry is the single
fact that makes deep learning computationally feasible; forward mode would
need a pass per parameter, exactly like finite differences.

Backpropagation is reverse-mode autodiff specialized to neural networks.

## The tape

To go backward, the framework must remember what happened forward. During the
forward pass it records a graph — **the tape**: each operation performed, its
inputs, and enough context to compute that operation's local derivative later.
`loss.backward()` walks the tape in reverse, multiplying local derivatives per
the chain rule and accumulating the results into each parameter's `.grad`.

PyTorch builds the tape fresh on every forward pass (**define-by-run**), which
is why ordinary Python control flow works inside models: whatever actually
executed _is_ the graph. An `if` that took the other branch this time simply
records a different tape.

## Why activations get stored — the module's pivotal fact

Local derivatives usually need the forward pass's actual **values**. For
y = W·x, the derivative with respect to the weights W needs **x** — the
layer's input activation. For **ReLU** (the simplest common layer: keep
positive numbers, set negatives to zero), the backward pass needs to know
which inputs were positive, or it can't tell which ones to pass gradient
through.

So the tape pins the intermediate activations of _every layer_ in memory, from
the moment they're computed until the backward pass consumes them. Only then
is that memory freed, deepest layers first (since backward runs in reverse
order).

The consequence: training memory grows with **depth × batch size**, entirely
apart from the weights themselves. Inference can throw each activation away
the instant the next layer has consumed it; training cannot. Where exactly the
gigabytes land is the next lesson's accounting — that the tape demands them at
all is the reason.
