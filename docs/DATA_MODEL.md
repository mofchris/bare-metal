# DATA_MODEL.md — curriculum, question bank, and progress schemas (Stage 0 draft)

Three data domains, three very different lifetimes:

| Domain             | Lives in                          | Written by       | Read by              |
| ------------------ | --------------------------------- | ---------------- | -------------------- |
| Curriculum content | `content/` (Markdown+YAML in git) | authors (us)     | content compiler     |
| Compiled content   | JSON emitted at build time        | content compiler | web app              |
| Progress data      | IndexedDB in the browser          | web app          | web app, export file |

The content compiler is the wall between "human-friendly" and
"machine-trusted": everything in `content/` is validated at build time, so the
app never parses untrusted structure at runtime. Malformed content = failed
build with a message naming the file and the problem (per CLAUDE.md: loud
failures).

---

## 1. Curriculum content format (`content/`)

```
content/
  modules/
    m1-hardware-foundations/
      module.yaml          # module metadata + ordering
      lessons/
        01-memory-hierarchy.md
        02-cpu-architecture.md
      questions.yaml       # question bank for the whole module
      labs/
        l1-1-memory-hierarchy/
          lab.yaml         # spec: targets, measured metrics, runnable|simulated
          instructions.md
```

### module.yaml

```yaml
id: m1-hardware-foundations # kebab-case, globally unique, stable forever
title: "Hardware foundations: what code actually runs on"
prereqs: [] # module ids; compiler rejects cycles/unknowns
lessons: # explicit order (filenames don't encode order)
  - 01-memory-hierarchy
  - 02-cpu-architecture
labs:
  - l1-1-memory-hierarchy
```

### Lesson file (Markdown + YAML frontmatter)

```markdown
---
id: m1/01-memory-hierarchy # module-qualified, stable — progress refs this
title: "The memory hierarchy"
objectives: # what you can do after, not what the text covers
  - "Rank the memory levels by latency within an order of magnitude"
sources: # required — see RISKS.md R4 (content quality)
  - "Hennessy & Patterson, Computer Architecture, 6th ed., ch. 2"
---

Lesson body in plain Markdown…
```

### questions.yaml

```yaml
- id: m1/q-001 # stable forever; progress history refs this
  lesson: m1/01-memory-hierarchy
  type: mcq # mcq | short
  prompt: "Roughly how much slower is a DRAM access than an L1 hit?"
  options: # mcq only; 2–6 entries
    - "~2x"
    - "~20x"
    - "~200x"
  answer: 2 # index into options
  explanation: "L1 ~1ns vs DRAM ~100ns…" # shown after answering — required
  tags: [memory, latency]

- id: m1/q-002
  lesson: m1/01-memory-hierarchy
  type: short # graded by normalized match against accept list
  prompt: "What principle makes caches effective despite their tiny size?"
  accept: ["locality", "locality of reference", "temporal and spatial locality"]
  explanation: "…"
```

Compiler validation (build fails loudly on any violation): unique ids; every
`lesson`/`prereqs` reference resolves; mcq `answer` in range; `accept`
non-empty for short; `explanation` and `sources` present; no orphan lessons
(in a folder but not in `module.yaml`).

### lab.yaml (Stage C fleshes this out; draft shape)

```yaml
id: m1/l1-1-memory-hierarchy
title: "Measure the memory hierarchy"
mode: runnable # runnable | simulated
measures: ["latency_ns per stride/size point"]
targets: # what the harness verifies
  - "latency cliff detected within 2x of this laptop's L2 size"
limitations: "Timing noise from thermal throttling; see M2/L2.2 noise floor."
```

---

## 2. Compiled content (build output)

One `curriculum.json` (or per-module chunks if size demands — decide in
Stage A with real numbers): the same data as above, validated, with Markdown
already rendered to HTML. The app treats it as read-only and versioned
(`contentVersion` = content hash) so the service worker knows when to refetch.

---

## 3. Progress schema (IndexedDB)

Database `metal-progress`, versioned via IndexedDB's own `version` +
`schemaVersion` in a `meta` store (migrations run on upgrade, loudly).

| Store            | Key          | Value (shape)                                                                                                                                       |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attempts`       | auto-id      | `{ questionId, at (ISO), correct, givenAnswer, sessionId }`                                                                                         |
| `lessonProgress` | `lessonId`   | `{ status: "not-started"\|"in-progress"\|"done", completedAt? }`                                                                                    |
| `srsState`       | `questionId` | `{ dueAt, intervalDays, ease, reps, lapses, lastReviewedAt }` — derived, rebuildable by replaying `attempts` through the SM-2-binary engine (D-018) |
| `labResults`     | `labId`      | `{ importedAt, metrics: {...}, passed, runnerVersion }`                                                                                             |
| `meta`           | fixed keys   | `{ schemaVersion, lastExportAt, installId }`                                                                                                        |

Design rules:

- **Append-only history** (`attempts`) is the ground truth; dashboard numbers
  and SRS state are derived and can always be recomputed from it. This is what
  makes export→wipe→restore lossless (Gate B test).
- Content ids (`questionId`, `lessonId`) are the foreign keys into curriculum —
  which is why content ids are stable forever (renaming a question id orphans
  history; the compiler will refuse id changes without a migration note).
- `lastExportAt` drives the weekly export reminder (BUILD_PLAN Stage B).

## 4. Export/backup file

Single JSON file, human-inspectable:

```json
{
  "format": "metal-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-07-19T12:00:00Z",
  "stores": { "attempts": [...], "lessonProgress": [...], "srsState": [...],
              "labResults": [...], "meta": {...} }
}
```

Restore validates `format` + `schemaVersion` before touching the database,
runs migrations if the file is older than the app, and **merges by default**
(union of attempts, newest-wins for keyed stores) so restoring a laptop backup
on the phone doesn't erase phone progress. Merge semantics get their own
D-entry in Stage B before implementation.

## 5. Lab results hand-off (Stage C draft)

The lab-runner writes `results-<labId>-<timestamp>.json`: `{ labId, metrics,
passed, runnerVersion, machineFingerprint }`. The app imports it via file
picker into `labResults`. No cryptographic signing in v1 — it's a self-honesty
tool, not an exam; noted in the file so nobody mistakes it for proof.
