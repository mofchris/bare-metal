---
id: m4/03-storage-formats
title: "Storage formats: row vs column, and the small-file trap"
objectives:
  - "Choose between row-oriented and columnar layouts for a given access pattern"
  - "Explain why a million small files is a pipeline disaster and what sharding fixes"
  - "Reason about compression as a bandwidth-vs-CPU trade"
sources:
  - "Abadi, Madden & Hachem, Column-Stores vs. Row-Stores: How Different Are They Really?, SIGMOD 2008"
  - "Apache Parquet documentation (parquet.apache.org); Apache Arrow format docs"
  - "WebDataset documentation (github.com/webdataset/webdataset)"
---

## What this lesson answers

Lesson 01 listed reading as the first pipeline stage and moved on. This lesson
covers what decides whether reading is cheap or ruinous, which comes down
entirely to how the dataset was written to disk in the first place.

The same law from M1/01 applies, with much larger constants.

## Why does layout matter more on disk than in memory?

A **sequential read** asks for bytes in the order they physically sit on the
device, and it runs at the device's full streaming speed. A **seek** jumps to an
unrelated position, and it pays a fixed setup cost before any data arrives.

That fixed cost is the whole story. In memory, a cache miss costs about 100
nanoseconds. On a solid-state drive, a seek costs tens of microseconds, which is
hundreds of times worse. On network storage it can be milliseconds.

So the question "how should a dataset be laid out?" is really "what order will
it be read in?" Training's answer is unusual: read whole samples, all fields at
once, in randomized order, over and over for many epochs.

## Should each record be stored together, or each field?

**Row-oriented** layouts store each record contiguously. All of sample 1, then
all of sample 2. Reading one complete sample touches one contiguous region.

**Columnar** layouts store each field contiguously instead. Every record's first
field together, then every record's second field. Reading one field across a
million records touches one contiguous region, and the other fields are never
read at all. Parquet and Arrow work this way.

Match each to its access pattern. Analytics asks questions like "what was the
average price by month", which needs two fields out of forty, so columnar reads
a twentieth of the data. Abadi and colleagues quantified that advantage.
Columnar also compresses better, because storing similar values next to each
other gives a compressor more repetition to exploit.

Training reads whole samples, which is row-shaped, and that is why TFRecord and
WebDataset are row-oriented containers.

Tabular machine learning sits awkwardly between the two, because feature
engineering reads columns and training then reads rows. Parquet's answer is
**row groups**: apply columnar layout within chunks of rows rather than across
the whole file. A reader pulling a batch of rows then gets acceptable sequential
behaviour, and a reader pulling one column still skips most of the file.

The rule to take away is to name the dominant access pattern first. The format
follows from it rather than the other way round.

## Why is one file per sample a disaster?

The obvious layout is one JPEG per image in a folder tree. It is also the worst
one, for three reasons that compound.

Every file costs a metadata lookup before its first byte arrives. The operating
system has to locate the file, check permissions, and set up a handle. That is
work per file rather than per byte, so a million tiny files pay it a million
times.

Files created separately are placed wherever the filesystem had room, so reading
them in a shuffled order means a seek per sample rather than a stream.

Cloud object storage bills and rate-limits per request rather than per byte, so
a million small objects is both slower and more expensive than one large one
holding the same data.

**Sharding** fixes all three. Pack the samples into a few hundred large archive
files, called shards. WebDataset uses ordinary `tar` archives; TFRecord uses its
own framing.

Readers then stream each shard from start to finish, which is the sequential
case, and the per-file costs are paid a few hundred times rather than a million.

That leaves one problem: training wants randomized order, and streaming a shard
gives fixed order. The solution approximates randomness with two cheap tricks
instead of buying it with seeks. Shuffle which shards are read, and in what
order, each epoch. Then hold a buffer of samples in memory as they stream past
and draw randomly from that buffer. Neither trick produces true uniform
shuffling, and the combination is close enough while keeping every read
sequential.

## When does compressing the data make things slower?

Compression trades one budget for another. Compressed data moves fewer bytes
across disk or network, and it costs CPU time to expand.

Whether that trade wins depends entirely on which of the two is scarce, and
lesson 01 already told you the CPU usually is.

On slow or remote storage, compression wins easily, because the bytes saved
matter far more than the CPU spent.

On a fast local **NVMe** drive, which is a solid-state drive connected directly
to the high-speed bus, the trade can invert. The drive delivers bytes faster
than the CPU can decompress them, so decompression becomes the bottleneck stage
and the pipeline runs slower than it would with uncompressed data.

This is why formats built for training pipelines default to fast codecs such as
snappy, or zstd at low settings, which are tuned for decompression speed rather
than for maximum size reduction. It is also why they leave already-compressed
data such as JPEG alone, since compressing it again spends CPU to save almost
nothing.

## Check your understanding

Two copies of the same 100,000-image dataset sit on an NVMe drive. Copy A is
100,000 separate JPEG files in folders. Copy B is 200 tar shards holding the
same images. You time one epoch of each and copy B finishes several times
sooner.

Give two distinct reasons, and say what B gives up to get that speed. A correct
answer names two of: A pays a metadata lookup per file, 100,000 times against
B's 200; A's files are scattered so shuffled reading becomes a seek per sample
while B streams each shard sequentially; and per-request costs or rate limits
apply per file. It then notes that B gives up true random ordering, since it
approximates shuffling by randomizing shard order and drawing from an in-memory
buffer rather than reading samples in a genuinely random sequence.
