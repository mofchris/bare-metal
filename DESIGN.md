# DESIGN.md — Metal

The single source of truth for visual decisions. Tokens live in
`src/style.css` `:root`; this file explains the system. Established at D-020.

## Concept

A circuit board. Surfaces are solder mask, text is silkscreen, progress and
identity are copper traces. The one signature element is the **via rail**:
lesson lists are threaded by a vertical trace; each lesson is a via — hollow
(untouched), copper ring (started), filled copper (done).

## Color

| Token                    | Value             | Role                                        |
| ------------------------ | ----------------- | ------------------------------------------- |
| `--board`                | #0d1412           | page background (solder mask, green-black)  |
| `--mask`                 | #141d18           | raised surface                              |
| `--mask-2`               | #1a2620           | inset/hover surface                         |
| `--hairline`             | #24312a           | borders, rules                              |
| `--ink`                  | #e8ece9           | primary text (silkscreen)                   |
| `--ink-dim`              | #91a198           | secondary text                              |
| `--copper`               | #d08a4a           | THE accent: identity, progress, interaction |
| `--copper-bright`        | #e2a468           | hover state of copper                       |
| `--led-ok` / `--led-err` | #62c084 / #e07268 | RESERVED: quiz correctness + errors only    |

Rules: copper is the only decorative accent; LED colors never decorate.
Dark theme is forced by the use scene (evening study in dim rooms), not by
taste. No pure #000/#fff anywhere.

## Typography

- **IBM Plex Mono** (400/500/600): wordmark, headings, nav, labels, numbers.
- **IBM Plex Sans** (400–700): body reading.
- Self-hosted woff2 in `public/fonts/` with OFL license; never CDN.
- Body line length ≤ 70ch. Hierarchy by scale + weight, mono/sans contrast.

## Layout

- Reading surfaces (lessons, quiz) stay a centered ~42rem column.
- The home/dashboard landing uses the full viewport (max ~90rem) with a
  main column + side rail grid on ≥1024px, stacking on mobile.
- Whitespace is deliberate; boxes are not the default — sections separate by
  spacing and hairlines before they reach for a card.

## Motion

- Ease-out (quart/quint), 150–450ms. Animate opacity/transform only.
- Page-load: short staggered rise of major sections.
- Progress (via fills, bars) transitions visibly — progress should feel physical.
- `prefers-reduced-motion` disables everything.

## Voice in UI copy

Plain verbs, sentence case, no filler, no exclamation marks. Empty states
say exactly what to do next ("Start Lesson 1") rather than describing
absence.
