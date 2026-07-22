---
id: m8/03-turning-the-tape-off
title: "Turning the tape off — no_grad, inference_mode, and what each saves"
objectives:
  - "Explain what the tape costs at inference time and why it is pure waste there"
  - "Distinguish no_grad from inference_mode by what each one disables"
  - "Explain why forgetting to disable the tape can cause an out-of-memory error during evaluation"
sources:
  - "PyTorch docs: Autograd mechanics; torch.no_grad and torch.inference_mode (pytorch.org/docs)"
  - "PyTorch docs: Inference mode (pytorch.org/cppdocs/notes/inference_mode.html)"
  - "PyTorch forums and release notes: inference_mode versus no_grad performance"
---

## What this lesson answers

M5/01 established that the tape must record every operation and keep every
activation alive, so that the backward pass can compute gradients. That is the
price of training, and it is unavoidable there.

At inference time there is no backward pass. The tape is recording for a journey
that will never happen. This lesson is about switching it off, why that matters
more than it sounds, and the two tools PyTorch gives you, which are not the same.

## What is the tape costing you at inference?

Recall exactly what M5 said the tape does. During the forward pass it records
each operation and pins each layer's activations in memory until backward
consumes them.

Now run a model to make a prediction, with no intention of calling
`loss.backward()`. The tape still records every operation, because it cannot
know you will not go backward. It still pins every activation, because those are
what backward would need.

Both are pure waste. You pay the recording overhead on every operation, and you
hold activations you will never use.

The memory half is the one that bites hardest, and M5/02 already gave the
reason. Training memory grows with depth times batch size precisely because
activations are held. At inference, if the tape is left on, you pay that same
growth for nothing. This is why evaluating a model on a large batch can run out
of memory when the identical forward pass, with the tape off, fits easily.

## What does no_grad do?

The first tool is `torch.no_grad()`, used as a context manager wrapping your
inference code.

Inside a `no_grad` block, PyTorch does not record operations onto the tape. The
operations run exactly as before and produce the same numbers, but nothing is
saved for a backward pass, so activations are freed as soon as the next
operation no longer needs them.

The saving is real and it is mostly the memory. The activations that training
would pin are released immediately, so the depth-times-batch growth from M5/02
does not happen. There is a smaller compute saving too, because the bookkeeping
that builds the tape is skipped.

`no_grad` has been the standard inference wrapper for years, and for most
purposes it is enough.

## What does inference_mode add?

The second tool is `torch.inference_mode()`, newer and stronger.

To see what it adds, you need one fact about how autograd tracks tensors. Every
tensor carries some bookkeeping that lets autograd know whether it participates
in a recorded computation, including version counters that detect whether a
tensor was modified in place after being used. `no_grad` stops recording but
still maintains that bookkeeping, because a tensor created under `no_grad` might
later be used in a context where gradients are on.

`inference_mode` makes a stronger promise: the tensors created inside it will
never take part in autograd at all, ever. That promise lets PyTorch drop the
version counters and related tracking entirely, not just skip recording.

So the difference is precise. `no_grad` disables recording. `inference_mode`
disables recording and the residual per-tensor autograd bookkeeping, by
requiring that its tensors stay out of autograd for good. It is faster,
occasionally noticeably so for many small operations where that per-tensor
bookkeeping was a real fraction of the per-operation overhead from lesson 01.

The cost of the stronger promise is that it is stricter. A tensor produced under
`inference_mode` cannot later be used in a training computation, and trying will
raise an error rather than silently doing the wrong thing. That is the right
trade for a pure inference or evaluation path, and the wrong tool if you need the
outputs to flow back into something that trains.

## Which should you use, and when does it go wrong?

The rule is short. For a path that only ever does inference or evaluation, use
`inference_mode`. If you need the outputs to re-enter a graph that computes
gradients, use `no_grad`, or nothing.

The failure worth recognising is the one from the top of the lesson, because it
is common and its symptom is misleading. You write an evaluation loop, forget to
wrap it, and it runs correctly on small inputs during development. In production
or on the full validation set, at a larger batch size, it runs out of memory.

The instinct is to blame the batch size or the model, and both are innocent. The
tape was left on, so every activation from every evaluation batch was pinned as
if a backward pass were coming. Wrapping the loop in `inference_mode` releases
them and the memory problem disappears, with no change to the model or the batch
size.

## Check your understanding

An evaluation loop over a validation set works fine on batches of 8 during
development but raises an out-of-memory error on batches of 64 in production. The
model and the data are unchanged, and the same forward pass at batch 64 works
when used inside training.

Explain the cause and give the one-line fix. A correct answer says the loop is
not disabling autograd, so the tape records every operation and pins every
activation as M5 described, and since activation memory grows with batch size
(M5/02), batch 64 holds eight times the activations of batch 8 with nothing ever
freeing them. Training works at batch 64 because there the pinned activations are
actually consumed by the backward pass, whereas the evaluation loop pins them for
a backward pass that never comes. The fix is to wrap the loop in
`torch.inference_mode()` (or `no_grad`), which stops recording and frees each
activation once the next operation is done with it.
