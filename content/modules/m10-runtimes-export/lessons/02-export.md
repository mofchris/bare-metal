---
id: m10/02-export
title: "Export — tracing, the graph you actually get, and where it breaks"
objectives:
  - "Explain how PyTorch export produces an ONNX graph and which capture method it uses"
  - "Explain what an opset is and why an unsupported operator blocks export"
  - "Predict the export failures that follow from M8/04's graph-capture problems"
sources:
  - "PyTorch docs: torch.onnx export and the ONNX exporter (pytorch.org/docs/stable/onnx.html)"
  - "ONNX: operators and opset versioning (github.com/onnx/onnx/blob/main/docs/Operators.md)"
  - "ONNX Runtime docs: model export and compatibility (onnxruntime.ai/docs)"
---

## What this lesson answers

Lesson 01 said you export a PyTorch model to an ONNX file and a runtime loads it.
This lesson is about that export step, which is where most of the real trouble
lives. M8/04 already built the foundation: capturing a graph from eager code is
hard because eager code can be dynamic, and export is the strictest form of
capture because there is no Python to fall back on.

This lesson makes that concrete for ONNX specifically: how the graph is captured,
what the target format demands, and exactly which models refuse to cross.

## How is the graph captured for export?

Exporting to ONNX means turning your PyTorch model into a fixed graph of ONNX
operations. M8/04 gave the two ways to capture a graph, and export has
historically leaned on the first: **tracing**.

Recall what tracing does. It runs the model once on an example input and records
the operations that actually executed. The ONNX exporter does exactly this: you
give it a model and a sample input, it runs the model, and it writes down the
operations it saw as an ONNX graph.

Everything M8/04 warned about tracing therefore applies to export directly, and
with higher stakes, because the traced graph is now leaving PyTorch entirely. A
branch not taken by the example is not in the graph. A loop is unrolled to the
number of iterations the example happened to run. A shape that depended on the
input is frozen to the example's shape.

Inside PyTorch a bad trace gives wrong answers (M8/04). On export, the same
problems often surface earlier and louder, as an export failure rather than a
silent mistake, because the target format cannot represent what the trace tried
to record. That is the subject of the next two sections.

## What is an opset, and why can one operator block everything?

ONNX defines a fixed set of operations it knows how to represent, and that set
has versions. An **opset**, operator set, is a numbered version of the ONNX
operator list: opset 17 supports a particular collection of operations, opset 18
a slightly larger or changed one.

The consequence is a compatibility question with two sides. Your PyTorch model
uses operations, and each must have a corresponding ONNX operator in the opset
you are exporting to, or the exporter does not know how to write it down. And the
runtime loading the file must support that opset, or it cannot read what you
wrote.

Now the failure this produces. If your model uses an operation that has no ONNX
equivalent in the target opset, export fails on that operation. It is not a
warning you can ignore, because M8/04 established the reason: the exported graph
runs where there is no Python, so an operation that is not in the graph has
nowhere to execute. Every operation must be expressible, or the export cannot be
completed.

This is why exporting a standard, widely-used model is usually smooth — its
operations are common and well-supported — while exporting a model with a custom
or unusual operation often is not. The unusual operation is exactly the one
likely to have no ONNX equivalent.

## Which models refuse to export, and why?

Combine the two previous sections and the pattern becomes predictable rather than
mysterious. Export fails, or produces a subtly wrong graph, for models with the
properties M8/04 identified as hard to capture.

**Data-dependent control flow.** A model that branches on its input has more than
one graph, and tracing captures only the example's path. ONNX does have operators
for control flow, so this can sometimes be exported by scripting rather than
tracing, but a plain trace silently bakes in one branch, and the resulting file
is wrong for other inputs in exactly the way M8/04 described.

**Data-dependent shapes.** A model whose tensor shapes depend on the input values,
rather than just on a fixed input size, produces a trace with the example's
shapes frozen in. If the real inputs have different shapes, the exported graph is
wrong or rejects them. Some of this is handled by marking certain dimensions as
dynamic at export time, telling the exporter which sizes are allowed to vary, but
shapes that depend on the data itself remain genuinely hard.

**Unsupported operations.** The opset problem above. A custom operation, or one
too new or too niche to be in the standard set, has no ONNX equivalent and blocks
export until it is replaced, decomposed into supported operations, or registered
as a custom operator the runtime is taught to execute.

The unifying point is that export does not fail randomly. It fails on exactly the
things that make a model more than a fixed sequence of standard operations, which
is precisely the dynamism M8/04 said a static graph cannot express.

## What is the practical export workflow?

Stated plainly, so the earlier cautions turn into a procedure.

Export the model with a representative sample input, marking as dynamic any input
dimensions that will genuinely vary, such as batch size or sequence length. Then
do the one check that catches most trace errors: run the original PyTorch model
and the exported model on several inputs, including inputs that exercise
different branches and shapes, and confirm the outputs match within a numerical
tolerance.

That tolerance is not a formality, and M3 explains why. The exported graph may
sum or order operations slightly differently, so bit-identical output is not
expected (M8/05); what you are checking is that the results agree to the
precision the model actually needs, chosen consciously as M3/01 required. A match
on the example alone proves nothing, because that is the one input the trace was
built from. Testing varied inputs is what surfaces a baked-in branch.

## Check your understanding

You export a model to ONNX using `torch.onnx` with one example image, and it
succeeds. The exported model gives correct outputs on that image but wrong ones
on some other images. The model contains a branch on `if x.mean() > threshold`.

Explain what happened using this module and M8/04, and describe the check that
would have caught it before deployment. A correct answer says export used
tracing, which records only the operations the example ran, so the branch the
example took was baked into the ONNX graph and is used for all inputs, giving
wrong outputs when a different input should have taken the other branch — the
same trace failure as M8/04, now frozen into an exported file. The check is to
run the PyTorch model and the exported model on several varied inputs, including
ones that take the other branch, and confirm the outputs match within a
tolerance chosen for the model's needs (M3/01, M8/05); testing only the example
input proves nothing because that is what the trace was built from.
