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

## Layout is destiny (disk edition)

M1 taught that walking memory along the order it's laid out in is fast, and
walking across that order is slow. Storage has the same law with much bigger
constants: **sequential reads** — asking for bytes in the order they physically
sit — stream at the device's full bandwidth, while random **seeks** — jumping
to an unrelated position — pay a fixed overhead per access before any data
arrives.

So the question "how should a dataset be laid out?" is really "what will the
access pattern be?" — and ML training's pattern is peculiar: read _whole
samples_, all fields at once, in _randomized order_, epoch after epoch.

## Row vs column

**Row-oriented** layouts store each record contiguously — all of sample 1,
then all of sample 2. Read one sample and everything about it arrives in one
touch.

**Columnar** layouts (Parquet, Arrow) store each _field_ contiguously instead
— every record's first field together, then every record's second field. That
lets you read one column across a million rows without touching the rest,
which is why analytics ("average price by month") loves them, per Abadi's
classic comparison. Columnar also compresses better, because similar values
end up sitting next to each other.

Training reads whole samples, which is row-shaped — hence TFRecord and
WebDataset are row-oriented containers. But tabular ML blurs the line: feature
engineering reads columns (columnar wins), then training reads sample rows.
Parquet's answer is **row groups** — column layout _within_ chunks of rows —
so a reader pulling a batch of rows still gets reasonable sequential behavior
either way. The honest rule: name the dominant access pattern first; the
format follows.

## The small-file trap

The naive layout — one file per sample, a million JPEGs in folders — is a
pipeline disaster out of all proportion to its innocence. Every file costs a
**metadata lookup** first: the OS must find the file, check permissions, and
set up a handle (`open`, `stat`, `close`) before a single byte of content
arrives. Random placement across the disk turns reading into seeking. And
object stores (cloud storage like S3) bill and rate-limit _per request_, not
per byte.

The fix is **sharding**: pack the samples into a few hundred large archive
files instead. WebDataset literally uses `tar` archives; TFRecord uses its own
framing. Readers then stream each shard start to finish — full-bandwidth
sequential reads — and "random order" gets approximated cheaply by two tricks
instead of true random access: shuffle _which_ shards you read each epoch, and
shuffle _within_ a buffer of samples held in memory as they stream past. That
shuffle-buffer compromise buys approximate randomness at sequential-read
prices.

## Compression: spend CPU to buy bandwidth

Compressed data moves fewer bytes (over disk or network — often the scarce
resource) but must be decompressed by the CPU, which is the same CPU the
pipeline is already starving (lesson 01).

On slow storage, compression wins outright. On a fast local **NVMe** drive —
an SSD connected straight to the high-speed bus rather than through an older
disk interface — heavy compression can _invert_ the tradeoff: the drive
delivers bytes faster than the CPU can inflate them, and decompression becomes
the new bottleneck stage.

That's why pipeline-oriented formats default to cheap, fast codecs (snappy, or
zstd at low settings — both tuned for decompression speed over maximum size
reduction) rather than maximum-ratio ones, and use none at all for data that's
already compressed, like JPEGs. It's a roofline argument with "storage
bandwidth" on one axis and "decode CPU" on the other — and like every trade in
this curriculum, it ends with _measure it_ (M2), because the answer flips with
the hardware.

## What this laptop teaches

Lab L4.1's dataset ships both ways — a folder of small files and packed shards
— and the first exercise is simply timing an epoch of each. The gap (often
several-fold, even on NVMe) is the whole lesson, felt.
