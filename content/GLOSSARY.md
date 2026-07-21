# GLOSSARY.md — the authoring ledger for "no naked terms" (D-025)

**This file is not shipped to the app.** It is the tool that stops the
curriculum from using a term before it has taught it.

Before authoring or editing any lesson, check this table. If a term you are
about to use has a row, the "First grounded" column says which lesson owns
its explanation:

- **Writing that lesson?** Ground the term there, in flow, at first use.
- **Writing a later lesson?** Use it freely — the reader has met it.
- **Writing an EARLIER lesson?** You have a problem. Either move the
  grounding earlier, or add a one-line placeholder gloss at the point of use
  (D-025 requires the gloss at the point of USE, not a promise that a later
  module will explain it).

New term not in the table? Add a row.

## The rule this table enforces

A gloss may not contain a term that itself needs a gloss. Abstract nouns are
the tell — _parallelism, execution, concurrency, extraction, utilization_.
The acceptance test is Christopher's: **if a sentence sends him to Google,
that sentence is a bug.**

## Why the ordering column exists

These terms were each used for several lessons before anything defined them —
the drift this ledger prevents:

| Term          | Was first used | Was explained     |
| ------------- | -------------- | ----------------- |
| `kernel`      | m1/01          | nowhere (6 files) |
| `tensor`      | m1/01          | nowhere (6 files) |
| `epoch`       | m4/02          | nowhere (4 files) |
| `accelerator` | m2/04          | nowhere (4 files) |
| `activation`  | m1/03          | m5/01 — 7 late    |
| `gradient`    | m3/02          | m5/01 — 4 late    |

## Hardware and systems terms

| Term                    | First grounded | The agreed gloss                                                                                                         |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| cache, hit, miss        | m1/01          | a small fast copy of recently used memory; hit = found there, miss = fall through to the next                            |
| cache line              | m1/01          | memory moves in fixed 64-byte blocks, never single bytes                                                                 |
| locality                | m1/01          | temporal = touched again soon; spatial = neighbours touched soon                                                         |
| register                | m1/01          | the handful of bytes the core does its arithmetic in — fastest storage on the chip                                       |
| DRAM                    | m1/01          | main memory — the gigabytes; slow, far from the core                                                                     |
| kernel (ML sense)       | m1/01          | one routine doing one specific piece of array maths (a matmul, a convolution). **Not** the OS kernel                     |
| clock, cycle, GHz       | m1/02          | clock ticks at a fixed rate; one tick = one cycle; 3 GHz = 3 billion ticks/s = 0.33 ns each                              |
| instruction             | m1/01          | one primitive step of machine work — add these, load that, jump if zero                                                  |
| pipelining              | m1/02          | assembly line: five stages each busy with a different instruction                                                        |
| execution unit          | m1/02          | the separate pieces of circuitry that do the actual work — one for whole numbers, others for decimals, others for memory |
| superscalar, ILP        | m1/02          | several instructions from one ordinary program running at the same instant                                               |
| out-of-order            | m1/02          | starts whichever instructions have their inputs ready, reorders results at the end                                       |
| branch, prediction      | m1/02          | branch = can go one of two ways; the chip bets on history, ~15–20 cycles lost when wrong                                 |
| register width, lane    | m1/02          | a 256-bit register holds 8 float32 side by side; each slot is a lane                                                     |
| SIMD                    | m1/02          | one instruction, all lanes at once                                                                                       |
| FMA                     | m1/02          | fused multiply-add: `a×b + c` in one step = 2 operations                                                                 |
| FLOP vs FLOPS           | m1/02          | FLOP = one floating-point operation (a count). FLOPS = per second (a rate)                                               |
| issue                   | m1/02          | to start an instruction                                                                                                  |
| P-core / E-core         | m1/02          | performance cores are the big fast ones; efficiency cores are small and don't count to peak                              |
| latency                 | m1/01          | time for one round trip — measured in nanoseconds                                                                        |
| bandwidth               | m1/03          | bytes moved per second while streaming — measured in GB/s                                                                |
| throughput              | m1/03          | work finished per unit time (contrast: latency = time for one item)                                                      |
| arithmetic intensity    | m1/03          | FLOPs done per byte moved — which budget the code lives on                                                               |
| memory-/compute-bound   | m1/03          | which of the two is the actual ceiling                                                                                   |
| roofline, ridge point   | m1/04          | the plot; ridge = where the memory limit and compute limit cross                                                         |
| dtype                   | m1/04          | which number format a tensor's elements are stored in (fp32, fp16, int8)                                                 |
| thread                  | m1/05          | one independent sequence of instructions the hardware can run                                                            |
| SIMT, warp              | m1/05          | 32 threads locked in step running the same instruction on different data                                                 |
| accelerator             | m1/05          | the general word for a GPU or any chip bought to do the maths faster than a CPU                                          |
| HBM, TB/s               | m1/05          | GPU memory; terabytes per second — a thousand GB/s                                                                       |
| bytecode                | m2/01          | the intermediate instructions Python compiles your source to before running it                                           |
| warmup                  | m2/01          | discarded early runs; you are choosing to measure the steady state                                                       |
| percentile, p50/p95/p99 | m2/04          | p99 = the value 99% of runs come in under                                                                                |
| host, device            | m4/01          | host = the CPU and its RAM; device = the accelerator and its own memory                                                  |
| epoch                   | m4/01          | one full pass over the whole dataset                                                                                     |
| shard                   | m4/03          | one large archive file packing many samples, read as a stream                                                            |

## ML terms

Grounded on first use even when the full treatment lands later — the gloss
goes at the point of USE (D-025), never deferred to a later module.

| Term                                      | First grounded | The agreed gloss                                                                                                                  |
| ----------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| model, neural network                     | m1/01          | a big pile of numbers plus the arithmetic that turns an input into an output                                                      |
| weight / parameter                        | m1/01          | the numbers a model learns; "parameter" and "weight" are the same thing                                                           |
| tensor                                    | m1/01          | just a big multi-dimensional array of numbers                                                                                     |
| batch                                     | m1/01          | a group of samples pushed through the model together in one go                                                                    |
| activation                                | m1/03          | the numbers a layer hands to the next one — a model's intermediate results                                                        |
| layer                                     | m1/03          | one stage of a model: takes numbers in, does its arithmetic, passes numbers on                                                    |
| training vs inference                     | m1/03          | training = adjusting the weights; inference = using the finished model                                                            |
| token, LLM decode                         | m1/05          | a token is a chunk of text; decode emits them one at a time, each needing the whole model                                         |
| gradient                                  | m3/02          | per weight, which way and how hard to nudge it to make the model less wrong                                                       |
| loss                                      | m3/02          | one number saying how wrong the model currently is; training pushes it down                                                       |
| converge                                  | m3/02          | the loss stops improving — training has arrived                                                                                   |
| backward pass, backprop                   | m3/02          | the return sweep that computes every gradient after a forward pass                                                                |
| mixed precision                           | m3/02          | store and move numbers narrow, add them up wide                                                                                   |
| accumulator                               | m3/02          | the wider running total that products get summed into                                                                             |
| quantization, scale, zero-point           | m3/03          | map real values onto 256 integer ticks; scale = tick width, zero-point = which tick is 0                                          |
| channel                                   | m3/03          | one of a layer's parallel output streams                                                                                          |
| QAT                                       | m3/03          | keep training with the rounding simulated, so the model adapts to it                                                              |
| derivative, chain rule                    | m5/01          | derivative = how much the output moves when you nudge one input                                                                   |
| the tape                                  | m5/01          | the recording of what the forward pass did, so backward can walk it in reverse                                                    |
| ReLU                                      | m5/01          | the simplest layer: keep positives, zero the negatives                                                                            |
| optimizer, Adam, SGD                      | m5/02          | the rule that turns gradients into the actual weight update; Adam keeps two extra buffers                                         |
| OOM                                       | m5/02          | out of memory — the allocation failed and the job dies                                                                            |
| CUDA context                              | m5/02          | the runtime NVIDIA's driver sets up per process; costs hundreds of MB before your model                                           |
| transformer, sequence length, hidden size | m5/02          | the dominant model shape; the two numbers that set its activation footprint                                                       |
| LoRA                                      | m5/02          | train a small add-on instead of the full weights, shrinking what the 16-byte rule multiplies                                      |
| learning rate                             | m5/03          | how big a step the optimizer takes along the gradient                                                                             |
| generalization                            | m5/03          | how well the model does on data it never trained on                                                                               |
| gradient accumulation                     | m5/03          | sum gradients over several small batches, step once — a big batch at small-batch memory                                           |
| gradient checkpointing                    | m5/04          | throw activations away and recompute them in backward: less memory, ~30% more compute                                             |
| KV cache                                  | m5/04          | forward ref (M7): store past work instead of recomputing it — checkpointing's mirror image                                        |
| ZeRO                                      | m5/02          | named as the source of the 16-byte figure; M9 does it properly (split optimizer state across GPUs rather than copying it to each) |

## Known-accepted early uses

The ordering audit flags these four. All are deliberate and correct under
D-025 — kept here so nobody re-litigates them on the next run:

| Term           | Appears in | Why it's fine                                                            |
| -------------- | ---------- | ------------------------------------------------------------------------ |
| `bandwidth`    | m1/02      | closing signpost only: "bandwidth versus latency versus compute is next" |
| `roofline`     | m1/03      | closing signpost only: "one picture — the roofline — is the next lesson" |
| `quantization` | m1/04      | carries its own point-of-use gloss ("storing numbers in smaller dtypes") |
| `optimizer`    | m3/02      | carries its own point-of-use gloss; M5/02 builds it properly             |

The distinction the audit cannot make: a term used _naked_ versus one used
with a placeholder gloss right there. Both look identical to a regex. That is
the concrete reason D-025 deferred building this into the compiler — as a
build gate it would need an allowlist and would fail the build on correct
prose. Run it by hand, triage the output.
