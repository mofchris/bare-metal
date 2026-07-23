---
id: m9/05-distillation
title: "Distillation — small models learning from large ones"
objectives:
  - "Explain what a student learns from a teacher that it does not learn from the labels alone"
  - "Explain why soft targets carry more information than hard labels, and what temperature does"
  - "Place distillation against quantization and pruning as a different kind of compression"
sources:
  - "Hinton, Vinyals & Dean, Distilling the Knowledge in a Neural Network, NeurIPS 2014 workshop"
  - "Buciluă, Caruana & Niculescu-Mizil, Model Compression, KDD 2006"
  - "Sanh et al., DistilBERT, a distilled version of BERT, arXiv 2019"
---

## What this lesson answers

Quantization made each number smaller. Pruning removed numbers. Distillation is
the third kind of compression, and it is different in kind: instead of shrinking
a trained model, it trains a small model from scratch to imitate a large one.

The interesting question is why that works better than just training the small
model on the original data directly, since the small model could have been
trained that way in the first place. The answer is about what a trained model
knows that the raw labels do not contain, and it is the point of the lesson.

## What is the setup?

**Distillation** trains a small model, called the **student**, to reproduce the
outputs of a large trained model, called the **teacher**.

The teacher is a model that already works well and is too large or slow for where
you want to deploy. The student is small enough to deploy. Rather than train the
student on the original labeled data alone, you train it to match what the
teacher produces on that data.

The immediate objection is the right one to raise: if the student learns from the
teacher's outputs, and the teacher learned from the labels, why not train the
student on the labels directly and skip the teacher? The next section is the
answer, and it is the whole idea.

## What does the teacher know that the labels do not?

Consider a model classifying an image of a dog. The label is a **hard target**:
it says "dog" and nothing else. Formally it is a 1 for dog and a 0 for every
other class, so it asserts that the image is a dog and equally not-anything-else.

The teacher produces something richer. Its output is a **soft target**: a
probability for every class. It might say 90% dog, 7% wolf, 2% cat, and tiny
fractions for the rest.

Look at what that distribution contains that the label did not. It says the image
is a dog, agreeing with the label. But it also says this dog looks somewhat like
a wolf and very unlike a cat. That is real knowledge about the image and about
the relationships between classes, and the hard label threw all of it away by
collapsing to a single 1.

This is the crux. The teacher's soft targets carry the teacher's learned sense of
how classes relate and how confident it is, information that took the large model
and the full dataset to acquire. A student trained to match those soft targets
learns from that richer signal, which is why it can end up better than the same
small model trained on the hard labels alone. The teacher is not just relaying
the labels; it is relaying everything it learned around them.

## What does temperature do?

There is a practical wrinkle. A confident teacher's soft target might be 99.3%
dog, 0.4% wolf, 0.1% cat, and so on. Those small probabilities are exactly the
useful part — the relationships between classes — but they are so small that they
barely influence the student's training.

The fix is a knob called **temperature**. Raising the temperature softens the
teacher's output distribution, spreading the probability so the small values
grow: the same example might become 70% dog, 12% wolf, 5% cat. The ranking is
unchanged and the relationships are preserved, but now they are large enough to
teach from.

The name comes from an analogy to physics and the mechanism is not worth
belabouring; what matters is the effect. Temperature is turned up during
distillation to expose the teacher's knowledge about class relationships, and the
student is trained against these softened targets. It is a knob to tune by
measuring, like the percentile setting in lesson 02.

## How does distillation relate to the other two techniques?

Place all three together, because that is the useful summary of the module.

Quantization (lessons 01 to 03) keeps the model's structure and shrinks the
representation of each number. Pruning (lesson 04) keeps the number format and
removes numbers. Both start from the trained model and reduce it.

Distillation does neither. It trains a genuinely different, smaller architecture,
and the teacher's only role is to provide a better training signal than the labels
alone. The output is a new model, not a reduced version of the old one.

That difference has practical consequences. Distillation can change the
architecture freely, so the student can be shaped for the target hardware from
the start rather than inheriting the teacher's shape. But it costs a full
training run for the student, like QAT, and it needs a good teacher to exist
first. And the three compose: a common recipe distills a large model into a small
student, then quantizes the student, getting both a smaller architecture and a
smaller representation.

The unifying idea across the whole module is the one M5/04 named for memory
tricks and that recurs everywhere in systems: these are trades, each spending
something to buy something else. Quantization spends precision, pruning spends
model capacity, distillation spends a training run and the existence of a
teacher. There is no free compression, only compression whose price you can
afford for a given deployment.

## Check your understanding

A student model trained directly on labeled data reaches 82% accuracy. The same
architecture, trained by distillation from a large teacher, reaches 86%. A
colleague finds this impossible, arguing the student cannot exceed what the
labels contain since the teacher only learned from those same labels.

Resolve the apparent paradox. A correct answer explains that the hard labels are
a single correct class per example and nothing more, while the teacher's soft
targets are a probability over all classes that also encodes how classes relate
and how confident the teacher is — information the large model and full dataset
produced but the labels discard. The student trained on soft targets learns from
that richer signal, which is why it can beat the same architecture trained on
hard labels alone. It may add that temperature is raised during distillation so
the small but informative probabilities are large enough to teach from.
