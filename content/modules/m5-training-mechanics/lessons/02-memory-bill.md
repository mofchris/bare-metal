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

The first three are fixed by the model and optimizer; the last is the
variable you actually control day to day.

## The 16-bytes-per-parameter rule

Plain fp32 + Adam: 4 (weight) + 4 (gradient) + 4 (m) + 4 (v) = **16 bytes
per parameter** before a single activation. The standard mixed-precision
recipe lands at the same total — fp16 weight (2) + fp16 gradient (2) +
fp32 master weight (4) + fp32 m (4) + fp32 v (4) = 16 — the ZeRO paper's
famous figure; the savings show up in activations and speed, not in state.

Apply it: a 1B-parameter model needs **16 GB of optimizer-adjacent state**
— your 16 GB laptop is full before the first batch. A 100M-param model:
1.6 GB, leaving room to train for real. This one multiplication explains
more OOM errors than any other fact in ML, and it's why "just fine-tune a
7B model locally" fails without tricks (LoRA and friends exist precisely
to shrink the trainable-parameter count this rule multiplies against).

## Activations: the batch-scaled item

Activation memory ≈ sum over layers of (outputs kept for backward) ×
bytes-per-element — proportional to **batch size × per-sample activation
footprint** (for transformers: sequence length × hidden size × layers,
with attention adding its own terms — Korthikanti et al. give exact
formulas). Double the batch, double this line item; the other three don't
move. That's why the OOM boundary is a _batch size_ in practice, and why
lab L5.1 has you measure activation growth against batch size, predict
the OOM point from the slope, then hit it on purpose.

## The fine print

Real allocators add overhead the clean model misses: CUDA context and
framework runtime (hundreds of MB), temporary workspaces for conv/matmul
algorithms, and **fragmentation** — free memory split into pieces too
small to satisfy a large allocation, producing OOM with "free" memory
showing. PyTorch's caching allocator holds freed blocks for reuse rather
than returning them to the OS, so external tools over-report usage;
`torch.cuda.memory_allocated()` (or its CPU-profiler equivalents) is the
honest ledger. Budget ~10–20% above the itemized bill and measure (M2)
rather than trusting arithmetic alone.
