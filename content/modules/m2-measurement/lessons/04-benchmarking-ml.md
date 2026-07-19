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
while _raising_ each request's latency, because requests wait for the batch
to fill and travel with it. Every serving system lives on this dial; M7
builds a simulator for it. A number without its pair is half a claim: "5000
samples/s" at what latency? "12 ms" at what load?

## The tail is the product

Report latency as **percentiles**: p50 (median — lesson 02), p95, p99. The
p99 answer to "why?" is that real usage makes many requests: a user session
touching a service 100 times experiences the p99 roughly once per session —
the _tail_ is what users remember. SLOs are therefore written against
percentiles, and capacity planning against the throughput sustainable while
_meeting_ them ("goodput": throughput that also hits the SLO).

Tene's warning when _load testing_ deserves its name — **coordinated
omission**: if your test client sends a request, waits for the reply, then
sends the next, a slow reply delays the next request — the system's worst
moments suppress the very measurements that would expose them. Fixed-rate
load generation (send on schedule regardless of replies) avoids lying to
yourself; it's also exactly the interleaving discipline of lesson 02 wearing
serving clothes.

## Trap 1: the first iterations are compilation

ML frameworks compile on first contact: `torch.compile` traces and generates
kernels, cuDNN autotunes convolution algorithms, caches fill. The first
iterations can be 10–1000× slower than steady state. Warmup (lesson 01)
isn't optional hygiene here — it's the difference between benchmarking your
model and benchmarking the compiler. Measure and report steady state, and if
cold start _is_ your question (serverless inference), measure it as its own
number, deliberately.

## Trap 2: the accelerator runs behind your back

GPU (and NPU) execution is **asynchronous**: framework calls enqueue work
and return immediately, while the device churns through the queue. Stop a
CPU-side timer after the _enqueue_ and you've measured how fast you can ask,
not how fast it answers — a classic way to "measure" impossible speeds. The
fix is one line: synchronize with the device (`torch.cuda.synchronize()`)
before reading the clock, every time, both ends. On this laptop the labs are
CPU-bound so the trap stays theoretical until M8's simulators — but it's the
single most common real-world ML benchmarking bug, so it gets learned now.

## Why MLPerf exists

Vendors used to benchmark whatever flattered them — different models, batch
sizes, precisions, warmup policies — making numbers incomparable. MLPerf
fixes the workload, the quality target ("train to accuracy X", "serve within
latency Y"), and the measurement rules, so systems compete on the same
question. The lesson transfers to your own work directly: **a benchmark is a
specification** — workload, metric, statistic, warmup policy, machine state
— and the labs' harness writes that specification into every results file it
emits, so future-you can trust past-you's numbers.

## The module in one paragraph

Machines vary (L01), so results are distributions (L02); profiles say where
time goes before you spend effort (L03); and ML adds a moving dial
(throughput↔latency), a tail that matters more than the middle, and two
traps — compilation and asynchrony — that fake numbers for the unwary (L04).
That's the complete measurement discipline the rest of this curriculum
stands on. Next stop: using it, in the Stage C labs.
