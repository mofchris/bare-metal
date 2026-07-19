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
Lesson 02: that's the one line item scaling with batch size. When it
doesn't fit, you have two currencies to pay with instead — compute and
precision — and this lesson is the exchange rate table.

## Gradient checkpointing: forget on purpose, recompute on demand

The insight (Chen et al.): activations don't have to be _stored_ — they can
be _re-derived_, because the forward pass is deterministic. Split the
network into segments; keep only each segment's **boundary** activations;
discard everything inside. During backward, when a segment's turn comes,
**recompute its interior forward from the stored boundary**, use the fresh
activations, free them, move on.

The arithmetic that makes it famous: with √n segments of √n layers each,
stored activations drop from O(n) to **O(√n)** — a 100-layer network keeps
~10 layers' worth — for the price of one extra forward pass per segment,
**roughly +30% compute time** overall. A 5× memory cut for 1.3× time is
usually a spectacular trade: it converts "impossible on this hardware" into
"30% slower," which is why every large-model recipe uses it. Lab L5.2
measures both sides of the bargain on this laptop.

## Mixed precision, now as a memory play

M3 sold bf16/fp16 as bandwidth; here it's capacity: half-width activations
halve the batch-scaled line item (and gradients too). Note what it does
_not_ halve — the fp32 master weights and Adam moments (the 16-byte rule
survives) — which is why mixed precision alone often disappoints people
expecting memory miracles: it shrinks the right item for _batch size_
headroom, not for _model size_ headroom.

## Gradient accumulation, formalized

From lesson 03: k micro-batches, gradients summed, one optimizer step —
the large-batch gradient at small-batch activation cost. The price is
neither memory nor arithmetic but **wall-clock structure**: k sequential
forwards/backwards per step, and the per-step fixed costs stop amortizing
(dial 1 runs backward). It composes freely with checkpointing and mixed
precision; the three together are the standard "train big on small"
toolkit — and the exact stack lab L5.2 assembles.

## The pattern worth keeping

Zoom out and it's everywhere in this curriculum: recompute vs store
(checkpointing here; KV cache in M7 is the same decision taken the other
way), narrow vs wide numbers (M3), cache vs refetch (M1), and later,
shard vs replicate optimizer state across GPUs (ZeRO, M9 — lesson 02's
16 bytes divided by the cluster). **Memory and compute are exchangeable
currencies; systems design is choosing the exchange rate that fits your
hardware.** Say that sentence at an MSc interview and mean it — this
module is the receipts.
