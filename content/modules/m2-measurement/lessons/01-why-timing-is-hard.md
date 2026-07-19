---
id: m2/01-why-timing-is-hard
title: "Why timing is hard"
objectives:
  - "Name four independent sources of variance in a naive benchmark"
  - "Explain what warmup runs are for and what happens without them"
  - "Pick the right timer for benchmarking and say why the obvious one is wrong"
sources:
  - "Mytkowicz, Diwan, Hauswirth & Sweeney, Producing Wrong Data Without Doing Anything Obviously Wrong!, ASPLOS 2009"
  - "Kalibera & Jones, Rigorous Benchmarking in Reasonable Time, ISMM 2013"
  - "Python docs: time.perf_counter vs time.time (docs.python.org/3/library/time.html)"
---

## The uncomfortable premise

You time the same function twice and get numbers 40% apart. Neither
measurement is broken — _the machine genuinely ran at two different speeds._
Everything M1 taught (caches, prediction, frequency behavior) conspires to
make "how long does this take?" an ill-posed question until you pin it down.
This module exists because every later lab reports numbers, and numbers from
naive timing are worse than no numbers: they're convincing.

## Source 1: the first run is a different program

On first execution, caches are cold, Python has to compile bytecode, branch
predictors know nothing, and lazy imports fire. The second run inherits warm
everything. Which one is "the real time"? It depends on what you're asking —
but mixing them into one average answers no question at all. Hence **warmup
runs**: execute a few times, discard, then measure. You're choosing to
measure the steady state (and saying so).

## Source 2: the clock speed is not constant

Modern CPUs trade frequency against temperature and power continuously. A
thin laptop like this one boosts high for the first seconds, heats up, then
**thermally throttles** — so a 10-second benchmark's first and last second
run at different clock speeds. Battery vs plugged-in changes the policy;
background updates change it again. Mitigations: plug in, let the machine
idle first, interleave the variants you're comparing (A,B,A,B — not
A,A,A,B,B,B) so drift hits both fairly, and _measure_ variance instead of
assuming it away (that's lab L2.2).

## Source 3: you are not alone on the machine

The OS schedules dozens of processes; a browser tab syncs; an index rebuilds.
Any of them can steal your core mid-measurement. This appears as occasional
runs that are _much_ slower — a long tail, which is why the statistics lesson
will be suspicious of means.

## Source 4: the measurement itself, and the surprising one

Timers cost time; calling a high-resolution timer inside a tight loop can
dominate the loop. Measure enough work per timing call to swamp the timer.

And the ASPLOS 2009 result that gives this lesson its sources: things you'd
swear are irrelevant — the _link order_ of a binary, even the _size of your
environment variables_ (which shifts stack alignment) — measurably changed
benchmark results. The authors called it **measurement bias**, and their
point stands: a single configuration is one sample from a distribution of
setups, so a conclusion drawn from one setup may be about the setup, not the
code.

## The practical checklist (used by every lab from here on)

1. Plugged in, machine otherwise idle, thermals settled.
2. Warmup runs, discarded, count stated.
3. Many measured runs — next lesson says how many and what to do with them.
4. `time.perf_counter()`, never `time.time()` — wall-clock time can be
   adjusted by NTP mid-measurement and has coarser resolution; `perf_counter`
   is monotonic and made for intervals.
5. Report the distribution, not a number (lesson 02).

None of this removes variance. It makes variance _visible and honest_ —
which is the entire game.
