# PRODUCT.md — Metal

register: product

## What it is

Metal is a self-contained, offline-first study platform for Machine Learning
Systems. One user: Christopher, a Nigerian CS graduate self-studying MLSys
ahead of a US MSc (Fall 2027). It is simultaneously his daily study tool and
a public portfolio piece read by professors and admissions committees.

## Users

- Christopher, daily: evenings on an HP laptop (Windows), in-bed and
  on-the-go sessions on an iPhone XR (installed PWA, often offline).
- Occasional skimmers: professors/reviewers opening the live demo for 90
  seconds. First impression matters; depth must be discoverable in one tap.

## Product purpose

Make daily studying happen. Lessons feed quizzes; quizzes feed a spaced
repetition schedule; the schedule and streak pull the user back tomorrow.
The interface's job is to make "open it and study" the path of least
resistance, and progress feel physical.

## Brand / identity

The product's name is the identity: bare metal, the circuit board. Dark
solder-mask green surfaces, copper as the only identity/progress accent
(traces), silkscreen-white text, IBM Plex Mono as the engineering voice.
Signature element: the via rail (lesson lists threaded by a trace; vias fill
with copper as lessons complete). Design decision log: D-020 in DECISIONS.md.

## Tone

Direct, technical, plain language. No gamification cuteness, no mascots, no
exclamation points. Numbers are shown honestly (a 0-day streak is a 0).

## Anti-references

- Duolingo-style gamified learning UIs (badges, confetti, characters).
- Generic SaaS dashboards (hero-metric tiles, gradient accents).
- Fake-terminal aesthetics (blinking cursors, $ prompts, CRT effects) — the
  board metaphor is material, not a costume.

## Constraints

- Offline-first is absolute: no external assets, requests, or fonts at
  runtime; everything ships in the repo and rides the service-worker precache.
- Two real viewports: ~1600px laptop and 414px iPhone XR. Both first-class.
- Bundle stays small (cold start budget 2 s; currently ~11 KB gz JS).
