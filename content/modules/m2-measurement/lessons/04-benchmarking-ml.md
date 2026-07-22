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

## What this lesson answers

Lessons 01 to 03 apply to any program. Machine learning adds three things on
top: two metrics that people routinely confuse, a part of the results
distribution that matters more than the middle, and two traps that produce
numbers which are not merely wrong but impossible.

## Why can't you improve both throughput and latency at once?

Lesson M1/03 defined throughput as work finished per unit of time, and latency
as the time one item takes from start to finish. In serving a model,
**throughput** is requests or tokens per second, and **latency** is the time
one request waits from arrival to answer.

They are not reciprocals, and **batching** is where they pull apart. Batching
means collecting several requests and running the model over all of them
together.

Batching raises throughput for a reason M1 established: a batch of 32 turns 32
small matrix multiplications into one large one, which has higher arithmetic
intensity and spreads each step's fixed costs across 32 samples.

Batching raises latency for a different and equally concrete reason. A request
arriving when the batch is empty must wait for 31 more requests before anything
happens to it, then travels with the group. The waiting is pure addition to
that request's latency.

So the batch size is a dial between the two, and neither end is correct in
general. This is why a performance claim needs both numbers. "5000 samples per
second" is unfinished without saying at what latency, and "12 ms" is unfinished
without saying at what load.

## Why report the slowest 1% rather than the average?

Report latency as **percentiles**. A percentile is the value that a given
proportion of measurements fall below. The 50th percentile, written p50, is the
median from lesson 02. The 99th percentile, written **p99**, is the value that
99% of requests come in under, so only the slowest 1% exceed it.

The reason to care about that slowest 1% is arithmetic about sessions rather
than about requests. Consider a user whose single session makes 100 requests to
your service. If 1% of requests exceed p99, then that user expects to hit
roughly one of them per session. The rare case is not rare from where the user
is sitting; it is what they remember about your product.

This is why performance promises are written against percentiles. An **SLO**,
or service level objective, is a commitment such as "95% of requests complete
under 200 ms". Capacity planning then measures the throughput a system can
sustain while still meeting that promise, and that quantity has its own name:
**goodput**.

## How does a load test hide the problem it exists to find?

Gil Tene named this failure **coordinated omission**, and the mechanism is
worth following slowly, because the flaw looks like correct code.

Write the obvious load-testing client. Send a request, wait for the reply,
record the time, send the next request. Repeat.

Now suppose the system stalls for one second. Your client is blocked waiting on
the reply, so it does not send any requests during the stall. When the reply
finally lands, you record one slow measurement and continue.

Count what should have happened. If you were sending 100 requests per second,
then 100 requests should have hit that stall, and all 100 should have been
slow. You recorded one. Your client stopped sampling exactly when the system
was at its worst, so the stall is almost entirely absent from your results, and
your p99 looks fine.

The fix is to send on a fixed schedule regardless of whether replies have
arrived, so that a stall produces the pile-up of slow measurements it actually
caused.

## Trap 1: what are you measuring in the first iterations?

Machine learning frameworks do substantial work the first time a model runs.

`torch.compile` watches the model execute once, records the operations, and
generates optimized code for them. NVIDIA's cuDNN library autotunes, meaning it
tries several algorithms for your convolution at your exact tensor shapes and
keeps whichever proved fastest. Caches fill.

The size of this effect dwarfs the ordinary warmup of lesson 01. First
iterations can run 10 to 1000 times slower than steady state, so including them
in an average means reporting the compiler's speed rather than the model's.

Discard them, and state how many you discarded. If cold start genuinely is your
question, which happens when a model is loaded fresh to serve a single request,
then measure it deliberately and report it as its own number rather than mixing
it in.

## Trap 2: why can a GPU appear to be infinitely fast?

GPU execution is **asynchronous**. When your Python code calls a GPU operation,
the framework places the work on a queue and returns immediately, before the
GPU has performed any of it.

Follow what that does to a naive timer. You start the clock, call the
operation, and stop the clock. The clock stopped when the work was _queued_,
not when it was _done_, so you measured how fast Python can ask for work. On a
large matrix multiply this reports a speed the hardware could not physically
achieve.

The fix is one line: call `torch.cuda.synchronize()`, which blocks until the
queue is genuinely empty, before reading the clock at both ends of the
measurement.

This is the most common real benchmarking bug in machine learning, and it is
worth learning before you have a GPU, because the first time you see an
implausibly good number this should be your first suspicion.

## Why does a shared benchmark suite exist?

Before MLPerf, vendors published numbers measured on whichever model, batch
size, number format and warmup policy flattered their hardware. Two such
numbers could not be compared, because they answered different questions.

MLPerf, run by the MLCommons consortium, fixes the workload, fixes the quality
target such as "train until this accuracy", and fixes the measurement rules.
Systems then compete on one question instead of on the choice of question.

The transferable lesson is that a benchmark is a specification. It is not a
number; it is the workload, the metric, the summary statistic, the warmup
policy, and the machine state, all recorded together. A result missing any of
those cannot be reproduced, including by you in six months.

## Check your understanding

An engineer reports that their inference server does 8000 requests per second
with a mean latency of 15 ms. Their load-test client sends one request, waits
for the reply, then sends the next. Their benchmark ran for 200 iterations from
a cold process.

Name three separate problems with this result. A correct answer names at least
three of: throughput is reported without the batch size or the latency it was
achieved at, so the pair is incomplete; the mean hides the tail and the figure
that matters for users is p99; the closed-loop client causes coordinated
omission, so any stall is under-sampled and the latency figures are optimistic;
and starting from a cold process means the first iterations measured
compilation and autotuning rather than steady-state serving.
