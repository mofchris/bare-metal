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

## What this lesson answers

M3 used gradients as given: the per-weight instructions for making the loss
smaller. This lesson covers where they come from.

The question has real weight, because a model has millions of weights and needs
a gradient for every one of them on every step. Two of the three obvious methods
are hopeless at that scale. Understanding why the third one works explains a
memory cost that dominates the rest of this module.

## What is a gradient, precisely?

A **derivative** measures how much an output moves when you nudge one input
slightly. If nudging a weight up by a tiny amount raises the loss, that
derivative is positive, and the weight should move down instead.

A **gradient** is the collection of those derivatives, one per parameter. It
says, for every weight in the model at once, which direction that weight should
move and how strongly.

Derivatives through a chain of operations combine by the **chain rule**: if a
feeds b and b feeds c, then the sensitivity of c to a is the sensitivity of c to
b multiplied by the sensitivity of b to a. Sensitivities multiply along the
path. That single fact is the machinery behind everything below.

## Why not compute derivatives the ways you already know?

**Symbolic differentiation** manipulates the expressions themselves, which is
what you did in calculus, and produces a formula for the derivative.

It fails on scale. A neural network is a composition of millions of operations,
and applying the chain rule symbolically to that composition produces an
expression that grows enormous long before it can be evaluated.

**Numerical differentiation** uses finite differences: nudge one parameter by a
tiny amount, run the whole model again, see how much the loss moved, and divide
by the nudge.

It fails twice. First on cost: getting one gradient requires one full forward
pass, so a million parameters requires a million forward passes per training
step. Second on accuracy: the method subtracts two nearly identical loss values,
which is catastrophic cancellation straight out of M3/04, so the answer is made
largely of rounding noise.

It survives only as a slow check on other methods, where it is called
gradcheck.

**Automatic differentiation** is the third option and is neither of the above.
Rather than manipulating formulas or re-running the program, it runs the program
once and applies the chain rule to the execution itself.

The insight it rests on is that every program is ultimately built from primitive
operations such as addition, multiplication, exponentiation and matrix multiply.
The derivative of each primitive is a known, simple formula. So if you record
which primitives ran and on what values, you can multiply their known local
derivatives together along the chain, and the answer is exact to floating-point
precision.

## Why does the direction of the chain rule matter so much?

The chain rule multiplies sensitivities along a path, and multiplication can be
performed starting from either end. That choice produces two different
algorithms with wildly different costs.

**Forward mode** carries derivatives alongside the computation, from inputs
toward the output. One pass gives the derivative of everything with respect to
_one input_. To get derivatives with respect to a million inputs, you need a
million passes.

**Reverse mode** runs the function forward once, then propagates sensitivities
backward from the output. One backward pass gives the derivative of _one output_
with respect to **every input at once**.

Now count what training needs. It has millions of inputs, the parameters, and
exactly one output, the loss, which is a **scalar**, meaning a single number
rather than an array.

Forward mode would need one pass per parameter, which is finite differences all
over again. Reverse mode needs one backward pass total, and that pass costs
roughly **2 to 3 times a forward pass** regardless of how many parameters exist.

That asymmetry is the reason deep learning is computationally possible.
Backpropagation is reverse-mode automatic differentiation applied to neural
networks.

## What does the framework have to remember?

Going backward requires knowing what happened forward, so the framework records
it during the forward pass. The record is called **the tape**: each operation
performed, its inputs, and whatever else is needed to compute that operation's
local derivative later.

Calling `loss.backward()` walks the tape in reverse, multiplying local
derivatives according to the chain rule and accumulating the result for each
parameter into its `.grad`.

PyTorch builds a fresh tape on every forward pass, which is called
**define-by-run**. This is why ordinary Python control flow works inside a
model: whatever actually executed is what got recorded, so an `if` that took the
other branch this time simply produces a different tape.

## Why does training use so much more memory than inference?

Here is the pivotal consequence, and it drives the next three lessons.

Computing a local derivative usually requires the forward pass's actual values.
For y = W·x, the derivative with respect to the weights W depends on **x**,
which is the layer's input activation. For **ReLU**, the simplest common layer,
which keeps positive numbers and sets negative ones to zero, the backward pass
needs to know which inputs were positive, because gradient flows through those
positions and not the others.

So the tape cannot discard activations. Every layer's output stays in memory
from the moment it is computed until the backward pass reaches that layer and
consumes it. Only then is the memory released, and because backward runs in
reverse, the deepest layers are freed first and the earliest layers are held
longest.

Now compare the two modes of use. Inference discards each activation as soon as
the next layer has consumed it, because there is no backward pass coming.
Training keeps all of them alive simultaneously.

Training memory therefore grows with **depth × batch size**, entirely separately
from the size of the weights. Lesson 02 turns that into an itemized bill.

## Check your understanding

A model has 50 million parameters and produces a single scalar loss. A colleague
proposes computing its gradients with forward-mode automatic differentiation,
arguing that forward mode avoids storing activations and therefore saves memory.

Evaluate the proposal on cost. A correct answer says forward mode gives
derivatives with respect to one input per pass, so 50 million parameters would
need 50 million forward passes per training step, against reverse mode's single
backward pass costing 2 to 3 forward passes; and concludes that the memory saved
is irrelevant because the compute cost is larger by a factor of tens of millions.
