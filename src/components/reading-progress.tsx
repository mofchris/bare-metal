// The reading-progress bar and the resume-where-you-stopped prompt (D-035).
// Depends on: lib/reading-position (pure maths), lib/progress-store.
// Depended on by: components/lesson-view.tsx.
//
// Two jobs, deliberately in one component because they share the same scroll
// listener: draw how far through the lesson you are, and remember where you
// stopped so the next sitting does not start with a hunt down the page.
//
// The save is THROTTLED. Scroll fires dozens of times a second and an
// IndexedDB write per event would be absurd; a write every SAVE_INTERVAL_MS
// while scrolling, plus one on the way out, loses at most a couple of
// paragraphs of accuracy — far below the resolution anyone reads at.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  isResumable,
  offsetForFraction,
  parseStoredFraction,
  readingPositionKey,
  scrollFraction,
} from "../lib/reading-position";
import type { ProgressDb } from "../lib/progress-store";

/** How often a scrolling reader's position is written. */
const SAVE_INTERVAL_MS = 2000;

export function ReadingProgress({
  lessonId,
  db,
}: {
  lessonId: string;
  db: ProgressDb | null;
}) {
  const [fraction, setFraction] = useState(0);
  const [resumeTo, setResumeTo] = useState<number | null>(null);
  const lastSavedAt = useRef(0);
  const latestFraction = useRef(0);
  // Whether the reader has actually scrolled during THIS visit. Nothing is
  // persisted until they have, which protects the saved bookmark twice over:
  // the initial draw on mount would otherwise write "position 0" and destroy
  // the very bookmark this component is about to offer (found in browser
  // testing — the resume prompt never appeared because the position had
  // already been overwritten), and opening a lesson then leaving without
  // reading would wipe it on the way out.
  const hasScrolled = useRef(false);

  // Track scrolling: drive the bar continuously, persist occasionally.
  useEffect(() => {
    const draw = () => {
      const current = scrollFraction(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
      );
      setFraction(current);
      latestFraction.current = current;
      return current;
    };
    const onScroll = () => {
      const current = draw();
      hasScrolled.current = true;
      const now = performance.now();
      if (db && now - lastSavedAt.current > SAVE_INTERVAL_MS) {
        lastSavedAt.current = now;
        void db.setMeta(readingPositionKey(lessonId), String(current));
      }
    };
    draw(); // size the bar correctly before any scrolling — draw only, no save
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      // Leaving the lesson is the most valuable moment to record — it is
      // exactly the position he will want back.
      if (db && hasScrolled.current) {
        void db.setMeta(readingPositionKey(lessonId), String(latestFraction.current));
      }
    };
  }, [lessonId, db]);

  // Offer to resume, once, on opening a lesson left part-read.
  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    void db
      .getMeta(readingPositionKey(lessonId))
      .then((raw) => {
        if (cancelled) return;
        const saved = parseStoredFraction(raw);
        if (isResumable(saved)) setResumeTo(saved);
      })
      .catch(() => {
        // A failed read just means no offer; never block reading over it.
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, db]);

  const jumpToSaved = () => {
    if (resumeTo === null) return;
    window.scrollTo({
      top: offsetForFraction(
        resumeTo,
        window.innerHeight,
        document.documentElement.scrollHeight,
      ),
      behavior: "smooth",
    });
    setResumeTo(null);
  };

  return (
    <>
      <div class="reading-bar" role="presentation">
        <div class="reading-bar-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      {resumeTo !== null && (
        // An offer, not a jump: being thrown down the page on load is
        // disorienting, especially when you came back to reread from the top.
        <p class="resume-prompt">
          You stopped {Math.round(resumeTo * 100)}% through this lesson.{" "}
          <button class="link-button" onClick={jumpToSaved}>
            Pick up where you left off →
          </button>
        </p>
      )}
    </>
  );
}
