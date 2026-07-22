---
id: m8/05-reproducibility
title: "Reproducibility — seeds, nondeterminism, and what can honestly be promised"
objectives:
  - "List the independent sources of randomness in a training run and how each is controlled"
  - "Explain why bit-identical results are harder to promise than they appear, drawing on M3"
  - "State the honest reproducibility guarantee to make, versus the one people wrongly expect"
sources:
  - "PyTorch docs: Reproducibility (pytorch.org/docs/stable/notes/randomness.html)"
  - "Micikevicius et al. and M3/04: non-associativity of floating-point addition"
  - "NVIDIA docs: determinism in cuDNN and deterministic algorithms"
---

## What this lesson answers

A result you cannot reproduce is a result you cannot trust, and M2 and M7 both
leaned on being able to re-run an experiment. This lesson is about what it takes
to actually re-run a training job and get the same answer, which is harder than
setting one seed, and about what you can honestly promise when someone asks
"will I get exactly your numbers?"

The honest answer is more nuanced than yes or no, and knowing why is the point.

## What are the independent sources of randomness?

A training run has several sources of randomness, and they are independent, so
controlling one does nothing for the others. This is the first thing people get
wrong: they set one seed and expect determinism.

**Weight initialization.** A model's weights start as random numbers.

**Data order.** The DataLoader from M4 shuffles samples each epoch, and the
shuffle is random.

**Data augmentation.** M4/01's augmentation deliberately varies each sample
randomly.

**Algorithmic randomness inside the model.** Techniques like dropout, which
randomly zero part of the activations during training, draw random numbers on
every forward pass.

Each of these draws from a random number generator, and there can be more than
one generator: PyTorch has its own, NumPy has its own, and Python has its own.
Setting PyTorch's seed leaves NumPy's untouched, so augmentation written with
NumPy stays random after you "set the seed".

Controlling randomness therefore means seeding every generator your code uses,
which is why reproducibility recipes set three or four seeds rather than one.

## Why is a seed not enough for bit-identical results?

Suppose you seed every generator perfectly. You can still get different numbers
across runs, and the reason is not randomness at all. It is M3.

M3/04 established that floating-point addition is not associative:
`(a + b) + c` need not equal `a + (b + c)`, because each grouping rounds
differently. And it established that summing an array in parallel groups the
terms differently than a sequential sum does.

Now connect that to how a framework runs. Many operations are executed by
parallel code that may sum contributions in whatever order the hardware
scheduling happens to produce, and that order can vary from run to run even on
the same machine. Different order, different rounding, different bits. No random
number was involved; the arithmetic itself was nondeterministic.

This is why frameworks distinguish two things. Seeding controls the random draws.
A separate setting, PyTorch's deterministic-algorithms flag, forces operations to
use implementations whose reduction order is fixed, at some cost in speed. You
need both to approach bit-identical results, and even then some operations have
no deterministic implementation available.

## What does hardware add to the problem?

The nondeterminism gets worse across machines, and M3 again explains why.

The same operation can be summed in a different order on a different number of
cores, or on a GPU versus a CPU, because the parallel decomposition differs. So
two machines running seed-identical code with deterministic flags set can still
produce different bits, because "deterministic" fixes the order _for a given
hardware configuration_, not across configurations.

There is a further layer for GPUs. Libraries like cuDNN may pick different
convolution algorithms depending on the exact hardware and even on autotuning
(M2/04), and different algorithms sum in different orders. Fixing this requires
disabling the autotuning that made the model fast, which is a real trade rather
than a free switch.

The picture that emerges is a hierarchy. Same machine, same code, seeds set,
deterministic flags on: reproducible to the bit, slower. Same code and seeds
without the flags: reproducible in behaviour, not in bits. Different machine:
reproducible in behaviour and roughly in numbers, not in bits.

## What should you actually promise?

This is where the lesson connects to M7, because reproducibility is a claim, and
an honest claim states its boundary.

The guarantee people wrongly expect is bit-identical results anywhere. That is
not achievable in general, for the reasons above, and promising it is a claim you
cannot keep.

The guarantee usually worth making, and usually sufficient, is weaker and
truthful: given this code, these seeds, this environment recorded precisely, a
re-run reproduces the reported numbers within the run-to-run variation the paper
states. That is M2's discipline restated. You measured a distribution with a
spread; reproducibility means a re-run lands inside that spread, not that it hits
one exact value.

For an experiment whose whole point is a difference between two conditions, this
is enough. If your reported effect is a 27% reduction with non-overlapping
intervals (M2/02), then a re-run that also shows a large non-overlapping
reduction has reproduced the result, even if the two medians differ in the third
digit. Demanding bit-identity would be demanding more precision than the claim
ever used.

The practical obligation is disclosure, not perfection: record the seeds, the
library versions, the hardware, and whether deterministic mode was on, so that a
reader knows exactly which rung of the hierarchy your result sits on.

## Check your understanding

You set PyTorch's seed and rerun a training job on the same laptop twice. The two
final losses differ in the fourth decimal place. A colleague insists this proves
a bug, because "the seed is set, so it must be deterministic".

Explain why the difference is expected and not a bug, and say what you would
change to make the runs bit-identical. A correct answer says that setting the
seed controls the random draws but not the arithmetic, and that floating-point
addition is not associative (M3/04), so operations executed by parallel code can
sum their contributions in a run-varying order and produce slightly different
bits with no randomness involved. It also notes that other generators, such as
NumPy's, may be unseeded. To approach bit-identical results you would seed every
generator and enable PyTorch's deterministic-algorithms mode, accepting that it
runs slower and that some operations may have no deterministic implementation.
