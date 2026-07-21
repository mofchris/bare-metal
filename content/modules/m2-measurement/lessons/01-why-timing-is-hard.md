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

The word for that spread is **variance**: how much your measurements scatter
around each other rather than landing on one value. This module exists
because every later lab reports numbers, and numbers from naive timing are
worse than no numbers: they're convincing.

## Source 1: the first run is a different program

On first execution, caches are cold (nothing useful in them yet, so every
access pays the full DRAM price from M1/01), branch predictors know nothing,
and lazy imports fire — Python only loads a module the first time something
needs it, so that cost lands inside your first measurement. Python also has to
compile your source into **bytecode** first: the simpler intermediate
instructions its interpreter actually executes, cached afterwards so the
second run skips the work.

The second run inherits all of that warm. Which one is "the real time"? It
depends on what you're asking — but mixing them into one average answers no
question at all. Hence **warmup runs**: execute a few times, throw those
results away, then measure. You're choosing to measure the steady state (and
saying so out loud).

## Source 2: the clock speed is not constant

Lesson M1/02 treated the clock as a fixed 3 GHz. It isn't. Modern CPUs trade
frequency against temperature and power continuously. A thin laptop like this
one boosts high for the first seconds, heats up, then **thermally throttles**
— deliberately dropping its clock rate to stop itself cooking. So a 10-second
benchmark's first and last second run at genuinely different clock speeds, and
every cycle-count you reasoned about shifts underneath you. Battery vs
plugged-in changes the policy; background updates change it again.

Mitigations: plug in, let the machine idle first, interleave the variants
you're comparing (A,B,A,B — not A,A,A,B,B,B) so any drift over time hits both
fairly, and _measure_ variance instead of assuming it away (that's lab L2.2).

## Source 3: you are not alone on the machine

The operating system schedules dozens of processes onto the same cores you're
using; a browser tab syncs; a search index rebuilds. Any of them can be given
your core mid-measurement while your work waits. This appears as occasional
runs that are _much_ slower — a long tail of slow results, which is why the
statistics lesson will be suspicious of averages.

## Source 4: the measurement itself, and the surprising one

Timers cost time: calling a high-resolution timer is itself work, and inside a
tight loop that work can dominate what you're trying to measure. Measure
enough work per timing call to swamp the timer's own cost.

And the ASPLOS 2009 result that gives this lesson its sources: things you'd
swear are irrelevant — the _order the linker put functions in_ the binary,
even the _size of your environment variables_ (which shifts where the stack
starts, changing which addresses everything lands on and therefore how it
falls into cache lines) — measurably changed benchmark results. The authors
called it **measurement bias**, and their point stands: a single configuration
is one sample out of many possible setups, so a conclusion drawn from one
setup may be a fact about the setup, not about the code.

## The practical checklist (used by every lab from here on)

1. Plugged in, machine otherwise idle, thermals settled.
2. Warmup runs, discarded, count stated.
3. Many measured runs — next lesson says how many and what to do with them.
4. `time.perf_counter()`, never `time.time()`. `time.time()` reports
   wall-clock time of day, which NTP (the service that keeps your clock
   correct over the network) can adjust mid-measurement — it can even jump
   backwards — and it has coarser resolution. `perf_counter` is **monotonic**:
   it only ever moves forward, and it's built for measuring intervals rather
   than telling you the date.
5. Report the distribution, not a number — meaning the whole spread of results
   rather than one summary value (lesson 02).

None of this removes variance. It makes variance _visible and honest_ —
which is the entire game.
