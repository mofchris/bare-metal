---
id: m5/04-memory-tricks
title: "Trading compute for memory: checkpointing and friends"
objectives:
  - "Explain gradient checkpointing: what's discarded, what's recomputed, and both costs"
  - "Choose the right memory trick for a given constraint"
  - "Recognize the recurring MLSys pattern: memory and compute are exchangeable currencies"
sources:
  - "Chen, Xu, Zhang & Guestrin, Training Deep Nets with Sublinear Memory Cost, arXiv 2016"
  - "Micikevicius et al., Mixed Precision Training, ICLR 2018"
  - "PyTorch docs: torch.utils.checkpoint"
---

## The bind, restated

Lesson 01: the tape must keep every activation until backward consumes it.
Lesson 02: that's the one line item scaling with batch size. When it doesn't
fit, you have two other currencies to pay with — compute and precision — and
this lesson is the exchange rate table.

## Gradient checkpointing: forget on purpose, recompute on demand

The insight (Chen et al.): activations don't have to be _stored_ — they can be
_re-derived_, because the forward pass is deterministic. Run the same inputs
through the same weights and you get the same activations, every time.

So: split the network into segments. Keep only each segment's **boundary**
activations — the numbers entering and leaving it — and discard everything
computed inside. During backward, when a segment's turn comes, **recompute its
interior forward from the stored boundary**, use those fresh activations to
get the gradients, free them, and move on to the next segment.

The arithmetic that makes it famous: with √n segments of √n layers each,
stored activations drop from O(n) to **O(√n)** — a 100-layer network keeps
about 10 layers' worth instead of 100 — for the price of one extra forward
pass per segment, **roughly +30% compute time** overall.

A 5× memory cut for 1.3× time is usually a spectacular trade: it converts
"impossible on this hardware" into "30% slower," which is why every
large-model recipe uses it. Lab L5.2 measures both sides of the bargain on
this laptop.

## Mixed precision, now as a memory play

M3 sold bf16/fp16 as a bandwidth win; here it's capacity. Half-width
activations halve the batch-scaled line item, and gradients too.

Note what it does _not_ halve: the fp32 master weights and Adam's two moment
buffers stay full width, so the 16-bytes-per-parameter rule survives intact.
This is why mixed precision alone often disappoints people expecting memory
miracles — it shrinks the right item for _batch size_ headroom, and the wrong
one for _model size_ headroom.

## Gradient accumulation, formalized

From lesson 03: k micro-batches, gradients summed, one optimizer step — the
large-batch gradient at small-batch activation cost.

Its price is neither memory nor arithmetic but **wall-clock structure**: k
sequential forward/backward passes per step instead of one, and the per-step
fixed costs stop being amortized across a big batch (dial 1 from lesson 03
runs backward). It composes freely with checkpointing and mixed precision; the
three together are the standard "train big on small" toolkit — and the exact
stack lab L5.2 assembles.

## The pattern worth keeping

Zoom out and it's everywhere in this curriculum: recompute vs store
(checkpointing here — and the **KV cache** in M7 is the identical decision
taken the other way, storing past work so a language model doesn't recompute
it for every new token), narrow vs wide numbers (M3), cache vs refetch (M1),
and later, shard vs replicate optimizer state across GPUs (**ZeRO**, M9 —
splitting lesson 02's 16 bytes across the cluster instead of giving every GPU
its own copy).

**Memory and compute are exchangeable currencies; systems design is choosing
the exchange rate that fits your hardware.** Say that sentence at an MSc
interview and mean it — this module is the receipts.
