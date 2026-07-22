# CURRICULUM.md — full outline

**What this curriculum is.** Metal is Christopher's general MLSys knowledge
base. It holds the understanding. The two flagship repositories named in the
Fall 2027 roadmap — `cheapserve-mlsys` and `trace-to-speed` — hold the
evidence. Same subject, two products, and this file is only responsible for the
first.

**Where the module list comes from.** The roadmap's "MLSys study syllabus"
(page 7) has two columns: STUDY and OUTPUT / PROVING MASTERY. The STUDY column
is this curriculum's contract. The OUTPUT column belongs to the repositories.
D-010 asked whether the original module list matched what Christopher needed to
learn before Fall 2027; the roadmap answered it, and D-027 records the
restructure that followed.

**Study budget:** 8 focused hours per week, studying only. Building the
flagship repositories comes out of separate hours and is not this curriculum's
concern.

**Order:** by dependency, not by flagship deadline. Metal is a knowledge base,
so it is built in the order the topics actually rest on each other.

Legend per module: **Prereqs** → which modules must come first (the app gates
on this). **Roadmap** → which row of the page-7 syllabus it satisfies.

---

## Coverage against the roadmap syllabus

| Roadmap module         | Metal module          | State                              |
| ---------------------- | --------------------- | ---------------------------------- |
| Benchmark discipline   | M2                    | **built**, patches pending         |
| Linux + OS             | M6                    | to author                          |
| Computer architecture  | M1                    | **built**, NUMA pending            |
| PyTorch execution      | M8                    | to author                          |
| ONNX Runtime           | M10                   | to author                          |
| Quantisation           | M3 (concepts) + M9    | M3 **built**; M9 to author         |
| Serving systems        | M12                   | to author                          |
| Profiling              | M2/03 (generic) + M11 | M2 **built**; M11 to author        |
| C++/CUDA foundations   | M13                   | to author                          |
| Distributed basics     | M14                   | to author                          |
| Research communication | M7                    | to author                          |
| _(no roadmap row)_     | M4 data pipelines     | **built** — feeds serving and M11  |
| _(no roadmap row)_     | M5 training mechanics | **built** — underpins M9, M11, M14 |

Two modules from the original outline are **demoted to optional** because the
roadmap does not ask for them: GPU architecture and kernels, and ML compilers
(XLA/TVM). The roadmap wants CUDA only after CPU work is correct and only as
one small extension (covered in M13), and it wants ONNX Runtime graph
optimisation rather than a compiler survey (covered in M10). Both remain
genuinely interesting and are listed at the end.

---

# Built

## M1 — Hardware foundations: what code actually runs on

**Prereqs:** none. **Roadmap:** computer architecture.
5 lessons, 27 questions. **Patch pending:** NUMA concepts.

1. The memory hierarchy
2. Why CPUs are fast — and why that's not enough
3. Bandwidth vs latency vs compute — the three budgets
4. The roofline model
5. GPUs from 10,000 feet — throughput machines vs latency machines

## M2 — Measurement: how to time things without lying to yourself

**Prereqs:** M1. **Roadmap:** benchmark discipline, plus generic profiling.
4 lessons, 20 questions. **Patches pending:** confidence intervals;
hardware/software disclosure as a reporting practice; raw-result storage.

1. Why timing is hard
2. Statistics for benchmarks
3. Profiling: finding where the time actually goes
4. Benchmarking ML: throughput, latency, and the tail

## M3 — Numerics: floating point and why precision is a dial

**Prereqs:** M1. **Roadmap:** quantisation (concepts). 4 lessons, 20 questions.

1. IEEE 754 from the bits up
2. fp16 vs bf16: splitting 16 bits two ways
3. Integers for inference: the quantization idea
4. Numerical failure modes

## M4 — Data pipelines: feeding the model is a systems problem

**Prereqs:** M2. **Roadmap:** no direct row; supplies the DataLoader half of
PyTorch execution and the input-stall half of profiling. 4 lessons, 20 questions.

1. The input pipeline
2. Overlap: hiding the kitchen behind the meal
3. Storage formats: row vs column, and the small-file trap
4. Pipeline health: who is waiting on whom?

## M5 — Training mechanics: what backprop costs

**Prereqs:** M3, M4. **Roadmap:** no direct row; underpins compression,
profiling and distributed. 4 lessons, 20 questions.

1. Autodiff: how gradients actually get computed
2. The memory bill: where the gigabytes go
3. Batch size: what it changes and what it doesn't
4. Trading compute for memory: checkpointing and friends

---

# To author, in dependency order

## M6 — Linux and the OS underneath

**Prereqs:** M1. **Roadmap:** Linux + OS.
**Why here:** M2 already blames "the scheduler took your core", M4 already
leans on the GIL and the page cache, and M12 will need sockets and concurrency.
Those are currently explained inline as asides. This module gives them a home
and makes them usable.

1. Processes, threads, and what the scheduler actually does
2. Virtual memory — pages, page tables, and why an address is not a location
3. Files, descriptors and sockets — how data gets into a process
4. CPU affinity — pinning, and why it changes a benchmark
5. Reading the system's own counters — perf tooling

## M7 — Research communication

**Prereqs:** M2. **Roadmap:** research communication.
**Why here:** it needs M2's measurement discipline as its substance and
nothing else, so it can come early — and everything authored or written after
it improves.

1. The shape of a technical result — question, method, baseline, finding
2. Threats to validity — what makes a comparison believable
3. Negative results and limitations — why they strengthen a report

## M8 — The PyTorch execution model

**Prereqs:** M5. **Roadmap:** PyTorch execution.
**Why here:** `inference_mode` only means something once M5 has established
that a tape exists; strides only mean something once M1 has established cache
lines. Unblocks M10, M11 and M13.

1. Eager execution — what happens when you call an operation
2. Tensors, shapes, strides and views — memory layout inside a framework
3. Turning the tape off — `no_grad`, `inference_mode`, and what each saves
4. Compilation and export boundaries — where a graph starts and stops
5. Reproducibility — seeds, nondeterminism, and what can honestly be promised

## M9 — Model compression

**Prereqs:** M3, M5. **Roadmap:** quantisation (practice).

1. Post-training quantization — dynamic vs static, and when each applies
2. Calibration in practice — choosing the range, and what clipping costs
3. Quantization-aware training — when post-training calibration is not enough
4. Pruning — structured vs unstructured, and why sparsity is not speed
5. Distillation — small models learning from large ones

## M10 — Runtimes and export: ONNX Runtime

**Prereqs:** M8. **Roadmap:** ONNX Runtime.
**Why here:** you export _from_ PyTorch, so the export boundary has to be
understood first.

1. Why a second runtime exists — what a framework does that a runtime does not
2. Export — tracing, the graph you actually get, and where it breaks
3. Graph optimisation — constant folding, fusion, and what a runtime can see
4. Execution providers and threading — mapping a graph onto this machine
5. Runtime profiling — reading a runtime's own numbers

## M11 — Profiling ML workloads

**Prereqs:** M8. **Roadmap:** profiling.
**Why separate from M2/03:** that lesson covers generic Python profiling and
only needs M1. This one needs the tape (M5) and the execution model (M8) before
operator-level attribution means anything.

1. The PyTorch Profiler — what it records, and what recording costs
2. Reading a trace — timelines, spans, and finding the gap
3. Operator-level attribution — which operation, and why it is slow
4. Memory events — allocation, peak usage, and where it went

## M12 — Inference serving

**Prereqs:** M6, M9. **Roadmap:** serving systems.
**Why here:** queues, concurrency and backpressure are operating-system ideas
(M6), and what you serve is usually a compressed model (M9).

1. The serving problem — requests arrive one at a time, hardware wants batches
2. Queues and concurrency — the model behind every server
3. Backpressure and timeouts — what to do when you cannot keep up
4. Batching strategies — static, dynamic, continuous, and the latency price
5. LLM inference — prefill versus decode, and the KV cache
6. Serving metrics in anger — p99, goodput, and SLOs

## M13 — C++ foundations for ML systems

**Prereqs:** M8. **Roadmap:** C++/CUDA foundations.
**Note:** the roadmap is explicit that CUDA comes only after CPU work is
correct, so this module is C++-first and treats CUDA as the last lesson.

1. Why C++ is still underneath everything
2. Memory and ownership — stack, heap, and RAII
3. Build systems — compilation units, linking, and why builds are slow
4. Writing a PyTorch extension — the boundary between Python and C++
5. When CUDA becomes worth it

## M14 — Distributed basics

**Prereqs:** M5. **Roadmap:** distributed basics.
**Scope note:** the roadmap asks for a toy experiment or a design note, not a
cluster. This module is sized to that.

1. Data parallelism — the same model, different samples
2. Collectives — all-reduce and the ring
3. Communication cost — when the network becomes the bottleneck
4. Stragglers and failure — what breaks at scale

---

# Optional, beyond the roadmap syllabus

Neither appears in the page-7 syllabus. Both are worth studying if time exists
after the syllabus is covered; neither should displace it.

## MX1 — GPU architecture and kernels

CUDA execution model, GPU memory and coalescing, matmul kernel anatomy, kernel
fusion. Would need simulators, since there is no NVIDIA GPU on this hardware.

## MX2 — ML compilers and graph optimization

Graphs and IRs, fusion/layout/scheduling, the XLA / TVM / torch.compile
landscape. Partly covered by M10's graph-optimisation lesson.

---

## Sizing

| Group              | Lessons | Questions |
| ------------------ | ------- | --------- |
| Built (M1–M5)      | 21      | 107       |
| To author (M6–M14) | 42      | ~210      |
| **Total syllabus** | **63**  | **~317**  |

At 8 focused study hours per week, and roughly 1 to 1.5 hours per lesson
including its quiz, 42 new lessons is on the order of 3 months of study. Build
time is a separate constraint and does not come out of the 8 hours.

## Open question: labs

The original outline attached runnable labs to every module, and D-001 and
D-010 called the core "runnable-heavy". That rationale has weakened: the
roadmap assigns the artifact burden to the two flagship repositories, so a lab
in Metal would exist only to make a concept stick, not to produce evidence.

No labs exist today. Whether to build any is deliberately left open rather than
quietly dropped — see D-027.
