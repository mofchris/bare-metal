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

M1 taught that walking memory along its layout is fast and across it is
slow. Storage has the same law with bigger constants: **sequential reads**
stream at full device bandwidth; random seeks pay per-access overhead. So
the question "how should a dataset be laid out?" is really "what will the
access pattern be?" — and ML training's pattern is peculiar: read _whole
samples_, all fields at once, in _randomized order_, epoch after epoch.

## Row vs column

**Row-oriented** layouts store each record contiguously — read one sample,
get everything about it in one touch. **Columnar** layouts (Parquet, Arrow)
store each _field_ contiguously — read one column across a million rows
without touching the rest, which is why analytics ("average price by
month") loves them, per Abadi's classic comparison. Columnar also
compresses better: similar values sit together.

Training reads whole samples, which is row-shaped — hence TFRecord and
WebDataset are row-oriented containers. But tabular ML blurs the line:
feature engineering reads columns (columnar wins), then training reads
sample rows. Parquet's answer is **row groups** — column layout _within_
chunks of rows — giving batch readers reasonable sequential behavior both
ways. The honest rule: name the dominant access pattern first; the format
follows.

## The small-file trap

The naive layout — one file per sample, a million JPEGs in folders — is a
pipeline disaster out of proportion to its innocence: every file costs a
metadata lookup (open, stat, close) before the first byte, random placement
turns reading into seeking, and object stores bill and throttle per
request. The fix is **sharding**: pack samples into a few hundred large
archive files (WebDataset literally uses tar files; TFRecord its own
framing). Readers stream shards sequentially — full-bandwidth reads — and
"random order" is approximated cheaply: shuffle _which_ shards each epoch,
and shuffle _within_ a memory buffer as samples stream (the
shuffle-buffer compromise: approximate randomness at sequential-read
prices).

## Compression: spend CPU to buy bandwidth

Compressed data moves fewer bytes (disk, network — often the scarce
resource) but must be decompressed by the CPU — the same CPU the pipeline
is already starving (lesson 01). On slow storage, compression wins
outright. On a fast local NVMe, heavy compression can _invert_: the drive
delivers bytes faster than the CPU can inflate them, and decompression
becomes the bottleneck stage. That's why pipeline-oriented formats default
to cheap, fast codecs (snappy, zstd at low levels, or none for
already-compressed JPEGs) rather than maximum-ratio ones. It's a roofline
argument with "storage bandwidth" on one axis and "decode CPU" on the other
— and like every trade in this curriculum, it ends with _measure it_ (M2),
because the answer flips with the hardware.

## What this laptop teaches

Lab L4.1's dataset ships both ways — a folder of small files and packed
shards — and the first exercise is simply timing an epoch of each. The gap
(often several-fold, even on NVMe) is the whole lesson, felt.
