---
id: m3/04-failure-modes
title: "Numerical failure modes — and how training survives them"
objectives:
  - "Recognize overflow, underflow, absorption, and catastrophic cancellation from symptoms"
  - "Explain why floating-point addition is not associative and what that does to parallel sums"
  - "Explain loss scaling: the problem it solves and the mechanism"
sources:
  - "Goldberg, What Every Computer Scientist Should Know About Floating-Point Arithmetic, ACM Computing Surveys 1991"
  - "Micikevicius et al., Mixed Precision Training, ICLR 2018"
  - "Higham, Accuracy and Stability of Numerical Algorithms, 2nd ed., ch. 1–4"
---

## What this lesson answers

Lessons 01 to 03 built the formats. This lesson covers the four specific ways
those formats lose information, how each one looks from the outside, and the
technique that makes fp16 training survivable.

Three of the four fail silently, which is what makes them worth memorising. No
error is raised and no value looks obviously wrong.

## What are the four ways arithmetic goes wrong?

**Overflow** happens when a result exceeds the format's largest value. It
becomes infinity, and infinity spreads: any arithmetic touching it produces
infinity or NaN, and inf minus inf is NaN. In fp16 this begins at 65504, which
one large activation can reach.

**Underflow** happens when a result is smaller than the smallest value the
format can express. It is flushed to zero. Nothing is raised and nothing looks
broken; the information is simply gone. This is how small fp16 gradients die,
and the weights they belonged to then stop being updated.

**Absorption** happens when a small number is added to a much larger one.
Lesson 01 showed the mechanism: machine epsilon for float32 is about 1.2 × 10⁻⁷,
so adding 10⁻⁹ to 1.0 gives exactly 1.0, because the true sum falls between two
representable floats and rounds back.

Absorption compounds in a way worth seeing. Sum a million small values into one
large running total, and each addition individually disappears once the total
has grown large enough. The sum can lose most of its inputs, one at a time,
while appearing to work.

**Catastrophic cancellation** happens when two nearly equal numbers are
subtracted. Follow it carefully, because it is the least intuitive of the four.
Each number carries about 7 accurate digits plus rounding noise below them.
Subtracting them cancels the leading digits, which were the accurate ones. What
survives is dominated by the noise that was previously harmless, promoted to
the front of the result.

The classic example is computing variance as E[x²] − E[x]². For data with a
large mean, those two quantities are nearly equal, their difference is small,
and almost all of that small difference is error. Computing variance by
subtracting the mean first avoids the cancellation entirely.

## Why do two identical runs produce different numbers?

In ordinary arithmetic, (a + b) + c equals a + (b + c). That property is called
**associativity**, and it means the grouping of a sum does not matter.

Floating-point addition is not associative, because each grouping rounds at
different moments and therefore rounds differently.

Now connect that to hardware. Summing a large array in parallel means splitting
it across cores, summing each piece separately, and combining the partial
totals. That operation is called a **reduction**, and it produces a different
grouping than a single sequential loop would.

The consequence has real teeth. The same computation on a different number of
cores, or on a different GPU, legitimately produces different bits. Run-to-run
variation in training loss is frequently this and not a bug.

Three responses exist. Fix the reduction structure so the grouping is identical
every run, when reproducibility matters more than speed. Use wider
accumulators, which is this module's recurring answer. Or use a compensated
algorithm such as **Kahan summation**, which keeps a second variable holding
the error each addition discarded and adds it back into the next one.

## What do these failures look like in a real training run?

A loss that becomes **NaN** is an overflow or a cancellation that happened
somewhere upstream. By the time NaN reaches the loss it has flowed through many
layers, so the visible symptom is far from the cause. Find the cause by checking
for infs and NaNs at each layer's boundary to see where they first appear.

A loss that quietly stops improving, while nothing looks broken, is the harder
case. Underflow produces exactly this: gradients reaching zero, weights
receiving no update, and no error anywhere. Diagnose it by watching the
distribution of gradient magnitudes across training, and suspect the narrowest
format in the pipeline first.

## How does loss scaling keep fp16 alive?

Lesson 02 left fp16 with one unresolved problem: small gradients underflow its
floor of about 6 × 10⁻⁵ and become zero.

**Loss scaling** solves it by moving the values rather than changing the
format. Before the backward pass, the loss is multiplied by a factor S, for
example 1024.

The reason this works is that differentiation is linear. Scaling the quantity
you differentiate scales every derivative computed from it by the same factor.
So every gradient arrives multiplied by 1024, which lifts a gradient of 10⁻⁷,
well below fp16's floor, up to about 10⁻⁴, safely inside the representable
range.

The gradients are then divided by S again, in float32, before the weights are
updated. The mathematics is unchanged from end to end. The values simply travel
through the dangerous part of the pipeline at a magnitude the format can hold.

Choosing S is itself automated. Dynamic loss scaling raises S until infinities
start appearing, then discards that step, halves S, and continues. That
machinery, checking every step for infinities, is why fp16 training feels
fragile, and it is the concrete reason bf16's simple "just have float32's
range" won the argument in lesson 02.

## Check your understanding

You compute the variance of a million sensor readings that are all close to
10,000, using the formula E[x²] − E[x]² in float32. The answer comes back
negative, which is impossible for a variance.

Explain the mechanism, and give a fix. A correct answer identifies
catastrophic cancellation: E[x²] and E[x]² are both near 10⁸ and nearly equal,
each carries only about 7 accurate decimal digits so their absolute error is
around 10, and their true difference is far smaller than that error, so the
result is dominated by rounding noise and can come out negative. The fix is to
subtract the mean from each value before squaring, so the quantities being
subtracted are no longer nearly equal.
