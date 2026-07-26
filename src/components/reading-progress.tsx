// Scroll progress and the resume-where-you-stopped bookmark (D-035).
// Depends on: lib/reading-position (pure maths), lib/progress-store.
// Depended on by: app.tsx (the bar, on every screen) and components/
// lesson-view.tsx (the bookmark, on lessons only).
//
// TWO SEPARATE THINGS, deliberately. The BAR belongs on every scrollable
// screen — Christopher asked for it "not just the study part but parts like
// the quiz part home screen and other areas too" — so it lives in the app
// shell. The BOOKMARK only makes sense for a lesson: nobody needs to resume a
// home screen, and saving a position for one would be noise.
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
 * The bar across the top of the viewport. Rendered by the app shell on every
 * screen, and keyed by route there so it resets when the page changes.
 */
export function ReadingBar() {
  const fraction = useScrollFraction();
  return (
    <div class="reading-bar" role="presentation">
      <div class="reading-bar-fill" style={{ width: `${fraction * 100}%` }} />
    </div>
  );
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
