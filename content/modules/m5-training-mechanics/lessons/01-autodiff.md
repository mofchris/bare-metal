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

## Three ways to get a derivative, two of them wrong for us

**Symbolic** differentiation (what you did in calculus) manipulates
expressions — but the expression for a million-parameter network's gradient
explodes in size. **Numerical** differentiation (finite differences:
nudge a parameter, re-run, divide) needs one full forward pass _per
parameter_ — a million passes — and the subtraction of nearly equal numbers
is catastrophic cancellation from M3/04, so it's slow _and_ inaccurate.
It survives only as a sanity check ("gradcheck").

**Automatic differentiation** is the third way: run the ordinary program,
and because every program is ultimately a composition of primitive ops
(+, ×, exp, matmul…) whose local derivatives are known, apply the chain
rule _to the execution itself_ — numerically exact (to float precision),
at a small constant multiple of the program's own cost.

## Forward mode vs reverse mode

The chain rule can be evaluated in two directions:

- **Forward mode** pushes derivatives along with the computation: one pass
  yields the derivative with respect to _one input direction_. Cost scales
  with the number of **inputs** — great for functions ℝ → ℝᵐ.
- **Reverse mode** runs the function once forward, then propagates
  sensitivities backward from the output: one backward pass yields the
  gradient with respect to **all inputs at once**. Cost scales with the
  number of **outputs**.

Training has millions of inputs (parameters) and one output (scalar loss).
Reverse mode computes the entire gradient for roughly **2–3× the cost of
one forward pass**, independent of parameter count — this asymmetry is the
single fact that makes deep learning computationally feasible.
Backpropagation is reverse-mode autodiff specialized to neural networks.

## The tape

To go backward, the framework must remember what happened forward. During
the forward pass it records a graph (the **tape**): each operation, its
inputs, and enough context to compute its local derivative. `loss.backward()`
walks that graph in reverse, multiplying local derivatives per the chain
rule and accumulating into `.grad`. PyTorch builds the tape dynamically on
every forward pass (define-by-run) — which is why ordinary Python control
flow works inside models: whatever actually executed _is_ the graph.

## Why activations get stored — the module's pivotal fact

Local derivatives usually need the forward pass's **values**. For y = W·x,
the gradient with respect to W needs **x** — the layer's input activation.
For ReLU, the backward pass needs which inputs were positive. So the tape
pins the intermediate activations of _every layer_ in memory, from the
moment they're computed until the backward pass consumes them (only then
is the memory freed, deepest layers first).

Consequence: training memory grows with **depth × batch size**, entirely
apart from the weights themselves — inference can discard each activation
immediately, training cannot. Where exactly the gigabytes land is the next
lesson's accounting; that the tape demands them is the reason.
