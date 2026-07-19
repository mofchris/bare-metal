# CURRICULUM.md — full v1 outline (Stage 0 draft)

Every module → lessons → labs, in dependency order. Each lab is flagged
**[runnable]** (works on the HP OmniBook: Core Ultra 7, 16 GB RAM, no discrete
GPU) or **[simulated]** (in-browser simulator, Stage D — the hardware can't run
the real thing honestly).

Scope decision: **M1–M7 are v1** (authored across Stages A–C), **M8–M10 are
Stage D** (theory + simulators). See D-010. Time budget: at ~21 h/week, each
module is sized at 2–4 weeks of study, not build time.

Legend per module: **Prereqs** → which modules must come first. **Why it's
here** → what an MLSys person actually uses this for.

---

## M1 — Hardware foundations: what code actually runs on

**Prereqs:** none. **Why:** every performance question in ML is a hardware
question wearing a costume.

Lessons:
1. The memory hierarchy — registers, L1/L2/L3, DRAM; latency numbers every
   programmer should know
2. Why CPUs are fast and why that's not enough — pipelining, SIMD, cores
3. Bandwidth vs latency vs compute — the three budgets
4. The roofline model — knowing if you're compute-bound or memory-bound
5. GPUs from 10,000 feet — throughput machines vs latency machines (deep dive
   deferred to M8)

Labs:
- L1.1 Measure the memory hierarchy: stride through arrays of growing size,
  watch latency cliffs at cache boundaries **[runnable]**
- L1.2 SIMD in practice: same loop with/without NumPy vectorization; explain
  the gap **[runnable]**
- L1.3 Build a roofline chart for this laptop from measured peak FLOPS and
  bandwidth **[runnable]**

## M2 — Measurement: how to time things without lying to yourself

**Prereqs:** M1. **Why:** the whole field runs on benchmarks; most are done
wrong. This module is deliberately early — every later lab depends on it.

Lessons:
1. Why timing is hard — warmup, caches, frequency scaling, thermal throttling
   (especially on a thin laptop like mine)
2. Statistics for benchmarks — medians not means, variance, how many runs
3. Profiling — sampling vs instrumentation; reading a profile without drowning
4. Benchmarking ML: what "throughput" and "latency" mean precisely; p50 vs p99

Labs:
- L2.1 Timing methodology: benchmark one function badly, then correctly;
  quantify how wrong the naive numbers were **[runnable]**
- L2.2 Document this laptop's measurement variance (the number every later
  lab cites as its noise floor) **[runnable]**
- L2.3 Profile a slow script and find the actual bottleneck (it won't be
  where it looks) **[runnable]**

## M3 — Numerics: floating point and why precision is a dial, not a given

**Prereqs:** M1. **Why:** fp16/bf16/int8 tradeoffs are half of modern
inference and training economics.

Lessons:
1. IEEE 754 from bits up — sign, exponent, mantissa; what rounds and when
2. fp32 / fp16 / bf16 — range vs precision, and why bf16 won training
3. Integers for inference — int8, scale/zero-point, the quantization idea
4. Numerical failure modes — overflow, underflow, cancellation, loss scaling

Labs:
- L3.1 Break floating point on purpose: catastrophic cancellation and
  accumulation-order experiments **[runnable]**
- L3.2 Implement fp16/bf16 rounding by hand from bit patterns; verify against
  PyTorch **[runnable]**

## M4 — Data pipelines: feeding the model is a systems problem

**Prereqs:** M2. **Why:** starved accelerators are the most common real-world
performance bug; also the first place a new MLSys hire gets pointed at.

Lessons:
1. The input pipeline — decode, transform, batch; where time actually goes
2. Overlap — prefetching, pipelining, workers; hiding latency behind compute
3. Storage formats — row vs column, compression tradeoffs
4. Measuring pipeline health — is the model waiting on data or data on model?

Labs:
- L4.1 Data-loader optimization: take a deliberately slow loader and make it
  fast; measure each fix's contribution **[runnable]**
- L4.2 Find the stall: given a training loop, determine (with evidence)
  whether compute or input is the bottleneck **[runnable]**

## M5 — Training mechanics: what backprop costs

**Prereqs:** M3, M4. **Why:** memory, not compute, is usually what kills a
training run; understanding why requires the autodiff picture.

Lessons:
1. Autodiff — forward vs reverse mode, the tape, why activations get stored
2. The memory bill — activations vs weights vs optimizer state; where 16 GB
   goes
3. Batch size — what it changes (throughput, memory, generalization) and what
   it doesn't
4. Tricks that trade compute for memory — checkpointing, mixed precision

Labs:
- L5.1 Measure activation memory vs batch size on a small CNN; predict the
  OOM point, then hit it **[runnable]**
- L5.2 Gradient checkpointing: measure the memory saved and the compute paid
  **[runnable]**

## M6 — Model compression: smaller, faster, mostly-as-good

**Prereqs:** M3, M5. **Why:** compression is how models fit on real hardware —
including this laptop, which makes it the most honest hands-on module here.

Lessons:
1. Post-training quantization — int8 in practice; calibration; what breaks
2. Quantization-aware training — the idea, when PTQ isn't enough
3. Pruning — structured vs unstructured, why sparsity ≠ speed by default
4. Distillation — small models learning from big ones

Labs:
- L6.1 Quantize a small model to int8; measure size, speed, and accuracy
  deltas honestly **[runnable]**
- L6.2 Prune a model to 50%+ sparsity; show why wall-clock time barely moves
  without structured sparsity **[runnable]**

## M7 — Inference serving: latency, throughput, and the batching dial

**Prereqs:** M2, M6. **Why:** serving is where MLSys meets money; also where
the throughput/latency tension from M1 becomes an engineering discipline.

Lessons:
1. The serving problem — requests arrive one at a time, hardware wants batches
2. Batching strategies — static, dynamic, continuous; the latency price
3. LLM inference specifics — prefill vs decode, the KV cache, why memory
   bandwidth rules decode
4. Serving metrics — p99 latency, goodput, SLOs

Labs:
- L7.1 Build a toy batching server on the laptop; sweep batch size, plot the
  latency/throughput curve **[runnable]**
- L7.2 KV-cache arithmetic: compute cache sizes for real model configs;
  verify against a small model's actual memory use **[runnable]**
- L7.3 Batching/throughput-latency tuner — interactive exploration beyond
  what the laptop can serve **[simulated]**

## M8 — GPU architecture & kernels *(Stage D)*

**Prereqs:** M1, M2. **Why:** the MSc-relevant deep dive; no NVIDIA GPU here,
so honesty demands simulation plus careful theory.

Lessons:
1. The CUDA execution model — grids, blocks, warps, occupancy
2. GPU memory — global/shared/registers; coalescing
3. Anatomy of a matmul kernel — tiling, the arithmetic-intensity story
4. Kernel fusion — why pointwise ops are free-ish when fused

Labs:
- L8.1 Cache/coalescing visualizer: watch access patterns hit or thrash
  **[simulated]**
- L8.2 Tiling explorer: tile-size sweep on a simulated matmul, occupancy vs
  reuse **[simulated]**
- L8.3 (stretch) Tiny kernel on the integrated Intel Arc GPU via SYCL or
  wgpu — flagged experimental; may be cut at Gate D **[runnable, fragile]**

## M9 — Distributed training *(Stage D)*

**Prereqs:** M5, M8. **Why:** every serious training run is distributed; no
cluster here, so simulators carry the load.

Lessons:
1. Data parallelism — all-reduce, gradient synchronization costs
2. Collectives — ring all-reduce arithmetic; bandwidth-optimal ideas
3. Model & pipeline parallelism — tensor splits, pipeline bubbles
4. ZeRO/FSDP — sharding optimizer state, the memory-per-GPU story

Labs:
- L9.1 Distributed training scheduler: place a model on N simulated GPUs,
  watch utilization and bubbles **[simulated]**
- L9.2 Communication cost calculator: predict all-reduce time from cluster
  specs; compare strategies **[simulated]**

## M10 — ML compilers & graph optimization *(Stage D)*

**Prereqs:** M7, M8. **Why:** where the field is heading; rounds out the
"systems" in MLSys.

Lessons:
1. From framework to hardware — graphs, IRs, what a compiler can see that
   eager mode can't
2. Fusion, layout, and scheduling — the big three optimizations
3. The landscape — XLA, TVM, torch.compile; what each bets on

Labs:
- L10.1 torch.compile before/after on CPU: measure, then read the generated
  code to see what fused **[runnable]**
- L10.2 Fusion visualizer: toggle fusions on a small graph, watch memory
  traffic change **[simulated]**

---

## Sizing sanity check

M1–M7: ~28 lessons + 16 labs. At 3 h/day that's roughly 4–6 months of study —
which matches the build timeline (labs land in Stage C while M1–M2 are being
studied). M8–M10 add ~11 lessons + 7 simulators for the following months.
Generous margin before Fall 2027.
