---
id: m2/04-benchmarking-ml
title: "Benchmarking ML: throughput, latency, and the tail"
objectives:
  - "Define throughput and latency precisely and explain why batching trades one for the other"
  - "Explain what p99 latency is and why the tail matters more than the average"
  - "Name the two ML-specific timing traps: compilation warmup and asynchronous execution"
sources:
  - "Mattson et al., MLPerf Training Benchmark, MLSys 2020 (and mlcommons.org benchmark rules)"
  - "Gil Tene, How NOT to Measure Latency (talk, 2015)"
  - "PyTorch docs: torch.cuda.synchronize and CUDA semantics (pytorch.org/docs)"
---

## Two metrics, one tension

- **Throughput**: work per unit time — samples/second in training, requests
  or tokens/second in serving.
- **Latency**: time for one unit of work, start to finish.

They are not reciprocals. Batching (M1's temporal locality, industrialized)
raises throughput — the fixed costs of a pass are shared across the batch —
while _raising_ each request's latency, because a request now waits for the
batch to fill up before anything happens to it, then travels with the group.
Every serving system lives on this dial; M7 builds a simulator for it. A
number without its pair is half a claim: "5000 samples/s" at what latency?
"12 ms" at what load?

## The tail is the product

Report latency as **percentiles**. A percentile is the value a given
proportion of your runs come in under: p50 is the value half the runs beat —
the median from lesson 02 — and **p99** is the value 99% come in under, so
only the slowest 1% exceed it. It is a way of describing the bad end of the
distribution without being at the mercy of the single worst run.

Why care about the slowest 1%? Because real usage makes many requests: a user
session touching a service 100 times will experience the p99 roughly once per
session — the _tail_ is what users actually remember. So **SLOs** (service
level objectives — the performance promise a team commits to, like "95% of
requests under 200 ms") are written against percentiles, and capacity planning
is done against the throughput sustainable while _meeting_ them. That number
has its own name: **goodput**, throughput that also hits the SLO.

Tene's warning when _load testing_ deserves its name — **coordinated
omission**: if your test client sends a request, waits for the reply, then
sends the next, a slow reply delays the next request, so the system's worst
moments suppress the very measurements that would expose them. You end up
sampling the system least often exactly when it is worst. Fixed-rate load
generation (send on schedule regardless of replies) avoids lying to yourself;
it's also exactly the interleaving discipline of lesson 02 wearing serving
clothes.

## Trap 1: the first iterations are compilation

ML frameworks compile on first contact. `torch.compile` watches your model run
once, records the operations, and generates optimized kernels for them. cuDNN
(NVIDIA's neural-network library) **autotunes**: it tries several algorithms
for your convolution at your exact tensor sizes and keeps whichever won.
Caches fill. The result is that the first iterations can be 10–1000× slower
than steady state.

Warmup (lesson 01) isn't optional hygiene here — it's the difference between
benchmarking your model and benchmarking the compiler. Measure and report
steady state, and if cold start _is_ your question (serverless inference,
where a model may be loaded fresh to serve one request), measure it as its own
number, deliberately.

## Trap 2: the accelerator runs behind your back

GPU execution is **asynchronous**: when your Python code calls a GPU
operation, the framework adds the work to a queue and returns immediately,
before the GPU has done any of it. Your program races ahead while the device
churns through the backlog. Stop a CPU-side timer after that return and you've
measured how fast you can _ask_ for work, not how fast it gets _done_ — a
classic way to "measure" physically impossible speeds.

The fix is one line: synchronize with the device (`torch.cuda.synchronize()`,
which blocks until the queue is actually empty) before reading the clock,
every time, at both ends of the measurement. On this laptop the labs are
CPU-bound so the trap stays theoretical until M8's simulators — but it's the
single most common real-world ML benchmarking bug, so it gets learned now.

## Why MLPerf exists

Vendors used to benchmark whatever flattered them — different models, batch
sizes, number formats, warmup policies — making the published numbers
incomparable. MLPerf (run by the MLCommons consortium) fixes the workload, the
quality target ("train until accuracy X", "serve within latency Y"), and the
measurement rules, so systems compete on the same question.

The lesson transfers to your own work directly: **a benchmark is a
specification** — workload, metric, statistic, warmup policy, machine state —
and the labs' harness writes that specification into every results file it
emits, so future-you can trust past-you's numbers.

## The module in one paragraph

Machines vary (L01), so results are distributions (L02); profiles say where
time goes before you spend effort (L03); and ML adds a moving dial
(throughput↔latency), a tail that matters more than the middle, and two
traps — compilation and asynchrony — that fake numbers for the unwary (L04).
That's the complete measurement discipline the rest of this curriculum
stands on. Next stop: using it, in the Stage C labs.
