// Top progress bar and the resume-where-you-stopped bookmark (D-035, D-040).
// Depends on: lib/reading-position (pure maths), lib/progress-store.
// Depended on by: app.tsx (the scroll bar), components/quiz.tsx (the same bar
// driven by question count) and components/lesson-view.tsx (the bookmark).
//
// THREE SEPARATE THINGS, deliberately. TopBar is the dumb strip: it draws
// whatever fraction it is handed, so the screen that actually knows how far
// along you are is the screen that supplies it. ReadingBar wires it to scroll
// position for reading surfaces. The BOOKMARK only makes sense for a lesson:
// nobody needs to resume a home screen, and saving a position for one would be
// noise.
//
// Why the split (D-040): the bar used to be scroll-driven everywhere, and a
// quiz question fits on one screen with nothing to scroll — which
// scrollFraction reports as 1, correctly for reading and disastrously here. It
// showed a full copper bar on question 3 of 19. On a quiz the honest measure is
// questions answered, not pixels travelled.
//
// The save is THROTTLED. Scroll fires dozens of times a second and an
// IndexedDB write per event would be absurd; a write every SAVE_INTERVAL_MS
// while scrolling, plus one on the way out, loses at most a couple of
// paragraphs of accuracy — far below the resolution anyone reads at.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  consumeResumeIntent,
  formatLastRead,
  isResumable,
  LAST_READ_KEY,
  offsetForFraction,
  parseStoredFraction,
  readingPositionKey,
  scrollFraction,
} from "../lib/reading-position";
import type { ProgressDb } from "../lib/progress-store";

/** How often a scrolling reader's position is written. */
const SAVE_INTERVAL_MS = 2000;

/** Current scroll position as 0..1, updated on scroll. */
function useScrollFraction(): number {
  const [fraction, setFraction] = useState(0);
  useEffect(() => {
    const update = () =>
      setFraction(
        scrollFraction(
          window.scrollY,
          window.innerHeight,
          document.documentElement.scrollHeight,
        ),
      );
    update();
    window.addEventListener("scroll", update, { passive: true });
    // A route change swaps the whole page under us, so the old fraction would
    // be stale until the next scroll; recompute when the document resizes too.
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return fraction;
}

/**
 * The bar across the top of the viewport, drawing a 0..1 fraction. Knows
 * nothing about what it is measuring — the caller does.
 *
 * `label` is what a screen reader announces; the bar is decorative on a
 * scrolling page (the scrollbar already says this) but genuinely informative on
 * a quiz, where nothing else on screen states the position as a proportion.
 */
export function TopBar({ fraction, label }: { fraction: number; label?: string }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const aria = label
    ? ({
        role: "progressbar",
        "aria-label": label,
        "aria-valuenow": Math.round(clamped * 100),
        "aria-valuemin": 0,
        "aria-valuemax": 100,
      } as const)
    : ({ role: "presentation" } as const);
  return (
    <div class="reading-bar" {...aria}>
      <div class="reading-bar-fill" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

/**
 * The scroll-driven bar, for reading surfaces. Rendered by the app shell and
 * keyed by route there so it resets when the page changes.
 */
export function ReadingBar() {
  return <TopBar fraction={useScrollFraction()} />;
}

/**
 * The lesson bookmark: remembers how far down this lesson he got, and offers
 * to put him back there. Renders only the prompt — the bar itself is the app
 * shell's job.
 */
export function ReadingBookmark({
  lessonId,
  db,
}: {
  lessonId: string;
  db: ProgressDb | null;
}) {
  const [resumeTo, setResumeTo] = useState<number | null>(null);
  const lastSavedAt = useRef(0);
  const latestFraction = useRef(0);
  // Whether he has actually scrolled during THIS visit. Nothing is persisted
  // until he has, which protects the saved bookmark twice over: the initial
  // measurement on mount would otherwise write "position 0" and destroy the
  // very bookmark this component is about to offer, and opening a lesson then
  // leaving without reading would wipe it on the way out.
  const hasScrolled = useRef(false);

  useEffect(() => {
    const measure = () =>
      scrollFraction(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
      );
    const save = (fraction: number) => {
      if (!db) return;
      void db.setMeta(readingPositionKey(lessonId), String(fraction));
      // Also record it as THE lesson he was last reading, so the home screen
      // can offer to continue without knowing which lesson to ask about.
      void db.setMeta(LAST_READ_KEY, formatLastRead(lessonId, fraction));
    };
    const onScroll = () => {
      const current = measure();
      latestFraction.current = current;
      hasScrolled.current = true;
      const now = performance.now();
      if (now - lastSavedAt.current > SAVE_INTERVAL_MS) {
        lastSavedAt.current = now;
        save(current);
      }
    };
    latestFraction.current = measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      // Leaving the lesson is the most valuable moment to record — it is
      // exactly the position he will want back.
      if (hasScrolled.current) save(latestFraction.current);
    };
  }, [lessonId, db]);

  // On opening a part-read lesson: jump straight there if he asked for that
  // from the home screen, otherwise offer.
  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    void db
      .getMeta(readingPositionKey(lessonId))
      .then((raw) => {
        if (cancelled) return;
        const saved = parseStoredFraction(raw);
        if (!isResumable(saved)) return;
        if (consumeResumeIntent(lessonId)) {
          scrollTo(saved!);
        } else {
          setResumeTo(saved);
        }
      })
      .catch(() => {
        // A failed read just means no offer; never block reading over it.
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, db]);

  const scrollTo = (fraction: number) => {
    window.scrollTo({
      top: offsetForFraction(
        fraction,
        window.innerHeight,
        document.documentElement.scrollHeight,
      ),
      behavior: "smooth",
    });
  };

  if (resumeTo === null) return null;
  return (
    // An offer, not a jump: being thrown down the page on load is
    // disorienting, especially when you came back to reread from the top.
    <p class="resume-prompt">
      You stopped {Math.round(resumeTo * 100)}% through this lesson.{" "}
      <button
        class="link-button"
        onClick={() => {
          scrollTo(resumeTo);
          setResumeTo(null);
        }}
      >
        Pick up where you left off →
      </button>
    </p>
  );
}
