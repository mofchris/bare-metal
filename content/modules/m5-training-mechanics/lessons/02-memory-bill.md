---
id: m5/02-memory-bill
title: "The memory bill: where the gigabytes go"
objectives:
  - "Itemize training memory: weights, gradients, optimizer state, activations"
  - "Compute the 16-bytes-per-parameter rule for Adam and apply it to a model size"
  - "Explain which components scale with batch size and which don't"
sources:
  - "Rajbhandari et al., ZeRO: Memory Optimizations Toward Training Trillion Parameter Models, SC 2020"
  - "Korthikanti et al., Reducing Activation Recomputation in Large Transformer Models, MLSys 2023"
  - "PyTorch docs: CUDA memory management"
---

## Four line items

Training memory is an itemized bill, and the items behave differently:

| Item                | Size                                             | Scales with batch? |
| ------------------- | ------------------------------------------------ | ------------------ |
| **Weights**         | bytes-per-param × params                         | no                 |
| **Gradients**       | same shape as weights                            | no                 |
| **Optimizer state** | Adam: two extra buffers (momentum m, variance v) | no                 |
| **Activations**     | every layer's forward outputs (the tape, L01)    | **yes**            |

Gradients take exactly as much room as the weights because there is precisely
one gradient number per weight — the two arrays are the same shape.

The third item needs a word. The **optimizer** is the rule that turns
gradients into the actual weight update. The simplest, **SGD** (stochastic
gradient descent), just subtracts a fraction of the gradient and stores
nothing extra. **Adam**, the modern default, does better by remembering two
running averages per weight: **momentum** (m — the recent average direction,
so updates keep rolling rather than jittering) and **variance** (v — how much
that weight's gradient has been bouncing around, used to take smaller steps
where the signal is noisy). Two extra numbers per weight, permanently
resident.

The first three items are fixed by the model and optimizer; the last is the
variable you actually control day to day.

## The 16-bytes-per-parameter rule

Plain fp32 + Adam: 4 bytes (weight) + 4 (gradient) + 4 (m) + 4 (v) = **16
bytes per parameter** before a single activation exists.

The standard mixed-precision recipe lands at exactly the same total: 2 bytes
(fp16 weight) plus 2 (fp16 gradient) plus 4 (fp32 master weight) plus 4
(fp32 m) plus 4 (fp32 v) = 16 — the famous figure from the ZeRO paper, whose
whole subject is how to survive this bill on huge models (M9 takes it up). The
savings from mixed precision show up in activations and in speed, not here.

Apply it: a 1-billion-parameter model needs **16 GB of optimizer-adjacent
state** — your 16 GB laptop is full before the first batch arrives. A
100-million-parameter model: 1.6 GB, leaving room to actually train.

This one multiplication explains more **OOM** errors — out of memory, where an
allocation fails and the job dies on the spot — than any other fact in ML.
It's why "just fine-tune a 7B model locally" fails without tricks. **LoRA** and
its relatives exist precisely for this: freeze the original weights and train
a small add-on set instead, shrinking the trainable-parameter count that the
16-byte rule multiplies against.

## Activations: the batch-scaled item

Activation memory ≈ sum over layers of (outputs kept for backward) ×
bytes-per-element — proportional to **batch size × per-sample activation
footprint**.

For **transformers** (the model architecture behind essentially every modern
language model), that footprint is set by **sequence length** — how many
tokens the model looks at in one go — times **hidden size** — how many numbers
represent each token internally — times the number of layers, with the
attention mechanism adding its own terms on top. Korthikanti et al. give the
exact formulas.

Double the batch, double this line item; the other three don't move. That's
why the OOM boundary is a _batch size_ in practice, and why lab L5.1 has you
measure activation growth against batch size, predict the OOM point from the
slope, then hit it on purpose.

## The fine print

Real allocators add overhead the clean model misses:

- **CUDA context and framework runtime** — the working state NVIDIA's driver
  sets up for your process before your model gets a single byte. Hundreds of
  MB, gone before you start.
- **Temporary workspaces** that convolution and matmul algorithms request as
  scratch space while they run.
- **Fragmentation** — free memory chopped into pieces that are individually
  too small to satisfy one large request, so an allocation fails with plenty
  of "free" memory on the books. Same disease as a fragmented disk.

PyTorch's caching allocator also holds freed blocks for reuse rather than
handing them back to the operating system, so tools watching from outside
over-report your usage; `torch.cuda.memory_allocated()` (or its CPU-profiler
equivalents) is the honest ledger. Budget ~10–20% above the itemized bill and
measure (M2) rather than trusting arithmetic alone.
