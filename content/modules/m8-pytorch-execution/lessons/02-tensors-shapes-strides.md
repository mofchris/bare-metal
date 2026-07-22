---
id: m8/02-tensors-shapes-strides
title: "Tensors, shapes, strides and views — memory layout inside a framework"
objectives:
  - "Explain what strides are and how shape plus strides describe a tensor's layout"
  - "Explain how a view reshapes or transposes a tensor without copying data"
  - "Predict when an operation must copy and connect that cost back to M1's cache lines"
sources:
  - "PyTorch docs: Tensor Views (pytorch.org/docs/stable/tensor_view.html)"
  - "PyTorch docs: torch.Tensor.stride and contiguous (pytorch.org/docs)"
  - "NumPy docs: internal memory layout of an ndarray (strides)"
---

## What this lesson answers

M1/01 said a tensor is a big array and that whether you walk it along its layout
or across it decides cache speed. That was true and incomplete. It did not say
what "the layout" actually is, or how a framework lets you transpose and reshape
a tensor apparently for free.

This lesson makes the layout concrete. Once it is concrete, a class of confusing
performance behaviour and a class of confusing errors both become predictable.

## What is underneath a multi-dimensional tensor?

Memory is one-dimensional. It is a line of bytes with consecutive addresses, as
M1 described. A tensor is multi-dimensional. Something has to bridge that gap.

The bridge is that a tensor is stored as one flat, contiguous run of numbers,
plus a small amount of bookkeeping that says how to interpret that run as having
rows, columns and higher dimensions.

Two pieces of bookkeeping do the work.

The **shape** is the size along each dimension. A 3-by-4 matrix has shape
`(3, 4)`.

The **strides** are the more important and less familiar piece. A stride is how
many elements you step forward in the flat storage to move by one along a given
dimension. For that 3-by-4 matrix stored row by row, moving one column to the
right is one element forward, so the column stride is 1. Moving one row down
skips a whole row of 4 elements, so the row stride is 4.

Shape plus strides is a complete description of the layout. To find the flat
position of element `[i, j]`, multiply each index by its stride and add:
`i * 4 + j`. That formula is all a tensor library does to turn a
multi-dimensional index into an address.

## Why does this let you transpose for free?

Here is the payoff, and it is the source of both a convenience and a trap.

Transposing a matrix swaps its rows and columns. The obvious implementation
copies every element to a new location. A strided tensor does not need to.

To transpose, swap the shape from `(3, 4)` to `(4, 3)` and swap the strides from
`(4, 1)` to `(1, 4)`. The flat storage is untouched. The same numbers in the
same memory are now described as a 4-by-3 matrix, because the formula
`i * stride_row + j * stride_col` now reads them in the other order.

A tensor that shares another tensor's storage but describes it with different
shape or strides is called a **view**. Transpose, reshape where possible,
slicing, and adding a dimension are all views. They are effectively instant and
use no extra memory, because they change only the bookkeeping.

The trap hides in "shares storage". A view is a second window onto the same
numbers, so writing through one view changes what the other sees. That is a
feature when you intend it and a bug when you do not, and it is a frequent source
of surprising results in framework code.

## When does the free transpose stop being free?

The view was free. What you do next may not be, and this is where the layout
reconnects to M1.

After the transpose, the flat storage is still in the original order. Reading the
transposed tensor row by row now jumps through memory with a stride of 4 instead
of 1. M1/01 already priced this: walking with a large stride wastes most of every
cache line, so the transposed read is several times slower than reading the
original, on identical data.

Some operations refuse to work on such a layout and require the elements to be
physically rearranged first. An operation that needs its input laid out in
plain row-by-row order is asking for a **contiguous** tensor, meaning one whose
elements sit in memory in the same order its indices walk. Calling
`.contiguous()` produces that by actually copying the data into fresh storage in
the right order.

So the cost did not vanish when you transposed; it was deferred. Either you pay
it as slow strided reads, or you pay it once as a copy. This is why a profile
(M11) sometimes shows time inside a copy you never wrote: a strided tensor met
an operation that demanded contiguity.

## Why do so many shape errors happen here?

A large fraction of framework errors are shape mismatches, and understanding
strides explains why they are both common and usually shallow.

An operation like matrix multiply requires its inputs' shapes to line up in a
specific way, and the numbers themselves give no hint whether they are correct.
The same 12 values can be a `(3, 4)` or a `(4, 3)` or a `(2, 6)` tensor
depending only on the shape metadata, and only one of those is what the next
operation expects.

The practical habit that follows is to treat shapes as something to check, not
assume. Printing a tensor's shape before an operation that is failing is the
single most useful debugging step in framework code, and it works because shape
is cheap metadata you can always inspect.

There is a second, subtler class: an operation succeeds on the wrong shapes
because of **broadcasting**, the rule that lets a `(3, 1)` and a `(1, 4)` tensor
combine into a `(3, 4)` result by repeating along the size-1 dimensions. It is
convenient and it will occasionally turn a genuine shape bug into a silently
wrong answer rather than an error. When a result has an unexpected shape,
broadcasting is the first suspect.

## Check your understanding

You have a large matrix `A` stored row by row. You compute `B = A.T` (its
transpose), and this returns instantly. You then run a loop that reads `B` row by
row, and it is far slower than the same loop over `A`. Finally you call
`A.T.contiguous()` and it takes real time and allocates memory.

Explain all three observations with one mechanism. A correct answer says the
transpose only swapped `A`'s shape and strides to produce a view, copying no
data, which is why it was instant. Reading `B` row by row walks the untouched
row-major storage with a large stride, wasting most of each cache line as M1/01
described, so it is slow on identical data. And `.contiguous()` takes time and
memory because it actually rearranges the elements into fresh row-major storage,
paying the copy cost that the free transpose had merely deferred.
