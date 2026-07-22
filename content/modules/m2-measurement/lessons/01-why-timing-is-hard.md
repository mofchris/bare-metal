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

## What this lesson answers

Time the same function twice and the two answers can differ by 40%. Neither
measurement is broken. The machine genuinely ran at two different speeds.

This lesson explains where that difference comes from. There are four separate
causes, they are independent of one another, and none of them can be removed.
The goal is to make them visible instead, because a number produced without
accounting for them is not merely imprecise. It is convincing and wrong.

The word for how much repeated measurements scatter is **variance**. Every
technique below exists to control it or to report it honestly.

## Source 1: why is the first run different?

The first execution of a piece of code does work that later executions do not.

Caches start empty. Lesson M1/01 showed that a miss costs about 100
nanoseconds while a hit costs about 1, so a first run pays full DRAM price for
data that a second run finds in cache.

Branch predictors start empty too. Lesson M1/02 showed that a wrong guess
discards 15 to 20 cycles, and a predictor with no history guesses badly until
it has seen each branch a few times.

Python adds two more first-run costs. It compiles your source into
**bytecode**, meaning the simpler intermediate instructions its interpreter
actually executes, then caches the result. It also imports modules lazily,
meaning a module is only loaded the first time something needs it, so that load
lands inside whichever run touches it first.

So the first run and the tenth run are measuring different programs. Averaging
them together answers no question at all.

The fix is **warmup**: run the code several times, discard those results, then
begin measuring. Understand what you are choosing when you do this. You are
deciding to measure the steady state rather than the cold state, and that is a
legitimate choice only if you say so in your results.

## Source 2: why does the clock speed change underneath you?

Lesson M1/02 treated the clock as a fixed 3 GHz. It is not fixed.

A processor produces heat in proportion to how hard it works, and a thin laptop
can only remove heat so quickly. The chip therefore runs fast while it is cool
and reduces its own clock rate as it warms, to stay within a temperature it can
survive. Deliberately reducing the clock like this is called **thermal
throttling**.

Follow the consequence through. A 10-second benchmark starts on a cool chip and
ends on a hot one, so its first second and its last second run at different
clock rates. Every cycle count you reasoned about in M1 shifts underneath the
measurement while it is running.

Two more things move the same dial. Running on battery rather than mains
changes the power policy. A background update or a virus scan heats the chip
before your benchmark even starts.

The practical response is to plug in, let the machine settle at idle first, and
interleave the variants you are comparing. Interleaving means running them as
A, B, A, B rather than as A, A, A, B, B, B, so that any drift over time affects
both equally rather than penalising whichever ran last.

## Source 3: why does another program's behaviour end up in your number?

You are not alone on the machine. An operating system runs dozens of processes
and gives each of them turns on the cores.

While your benchmark runs, the scheduler can hand your core to a browser tab
syncing in the background or to a file indexer. Your work stops until the core
comes back.

This produces a specific signature rather than a uniform blur. Most runs are
unaffected and land close together, while occasional runs are much slower. That
lopsided pattern is what the next lesson builds its whole argument on.

## Source 4: why does measuring change the measurement?

Reading a clock is itself work. A high-resolution timer call takes tens of
nanoseconds, which is comparable to the cost of the operation you may be trying
to time. Put a timer call inside a tight loop and you are largely measuring the
timer.

The response is to time enough work per clock reading that the timer's own cost
disappears into rounding. Time ten thousand iterations and divide, rather than
timing one iteration.

There is also a stranger version of this problem, and it is the reason this
lesson cites Mytkowicz and colleagues. They found that changes with no
plausible connection to performance changed their measurements: the order the
linker placed functions in the binary, and the total size of the environment
variables in the shell.

The mechanism is worth following, because it sounds like magic and is not.
Environment variables are copied onto the program's stack before it starts, so
their total size shifts where the stack begins. Shifting the stack shifts every
address in it, which changes which addresses share a cache line and which
collide. The code is identical and its cache behaviour is not.

They named this **measurement bias**. Its lesson is that a single machine
configuration is one sample from a large space of possible configurations, so a
result from one setup may be a fact about that setup rather than about your
code.

## What should the whole procedure look like?

1. Plug the machine in, close other applications, and let it sit at idle until
   thermals settle.
2. Run warmup iterations, discard them, and state in your results how many you
   discarded.
3. Take many measured runs. The next lesson says how many and what to do with
   them.
4. Use `time.perf_counter()` rather than `time.time()`.
5. Report the whole spread of results rather than a single number.

Step 4 deserves its reason. `time.time()` reports the current time of day,
which a network time service is entitled to adjust while your benchmark runs,
including backwards. A measurement spanning such an adjustment is wrong by the
size of the adjustment. `time.perf_counter()` is **monotonic**, meaning it only
ever moves forward, and it exists specifically for measuring intervals.

None of this removes variance. It makes variance visible and states it
honestly, which is what separates a measurement from a guess.

## Check your understanding

A colleague reports that their optimization made a function 15% faster. Their
method was: run the old version once, run the new version once, compare the two
numbers. The machine was on battery and they had a video call running.

Name three specific effects from this lesson that could produce a false 15%,
and say what you would change about the method. A correct answer names at least
three of: no warmup, so one run paid cold-cache and cold-predictor costs;
thermal throttling or battery power policy changing the clock rate between the
two runs; the scheduler giving a core to the video call during one of them; and
no interleaving, so any drift over time landed entirely on whichever ran
second. The method changes to plugged in and idle, warmup discarded, many
interleaved runs of both versions, and a reported spread.
