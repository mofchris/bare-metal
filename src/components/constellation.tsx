// The animated node network behind the hero (D-039).
// Depends on: nothing but the DOM. Depended on by: components/home.tsx.
//
// Replaces the static PCB trace with drifting points joined by lines whenever
// they come close — the reference Christopher sent. It suits Metal better than
// it looks: a network that keeps rewiring itself is what the curriculum is
// about, and it reads as a circuit rather than decoration because the palette
// stays copper.
//
// CANVAS, NOT SVG. Roughly forty nodes means hundreds of candidate lines every
// frame; as SVG that is hundreds of DOM elements mutating 60 times a second,
// which is exactly the kind of thing that makes a phone warm. One canvas draw
// call per frame does not.
//
// THREE THINGS KEEP IT CHEAP, because this sits behind the home screen of a
// study app and must never compete with the studying:
//   - it stops completely when the tab is hidden or the canvas is scrolled off
//   - device pixel ratio is capped at 2
//   - prefers-reduced-motion draws ONE still frame and stops

import { useEffect, useRef } from "preact/hooks";

/** Nodes at a reference width; scaled down on narrow screens. */
const NODE_TARGET = 42;
/** Distance within which two nodes are joined, as a fraction of canvas width. */
const LINK_DISTANCE_RATIO = 0.18;
const MAX_DPR = 2;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let frame = 0;
    let running = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fewer nodes on a phone: the same count on a small canvas is a scribble,
      // and the link test is quadratic in node count.
      const count = Math.max(14, Math.round((NODE_TARGET * width) / 1200));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        // Slow: a drift you notice only if you look for it.
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const linkDistance = width * LINK_DISTANCE_RATIO;

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        // Bounce off the edges rather than wrapping: wrapping makes lines snap
        // across the whole canvas as a node teleports.
        if (node.x <= 0 || node.x >= width) node.vx *= -1;
        if (node.y <= 0 || node.y >= height) node.vy *= -1;
        node.x = Math.min(width, Math.max(0, node.x));
        node.y = Math.min(height, Math.max(0, node.y));
      }

      context.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance > linkDistance) continue;
          // Fade the line out as the pair separates, so links appear and vanish
          // smoothly instead of blinking at the threshold.
          context.strokeStyle = `rgba(208, 138, 74, ${0.28 * (1 - distance / linkDistance)})`;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      context.fillStyle = "rgba(226, 164, 104, 0.55)";
      for (const node of nodes) {
        context.beginPath();
        context.arc(node.x, node.y, 1.6, 0, Math.PI * 2);
        context.fill();
      }
    };

    const tick = () => {
      if (!running) return;
      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    resize();
    draw(); // one frame immediately, so it is never blank
    if (!reduceMotion) start();

    // Only animate while actually on screen and in a visible tab.
    const observer = new IntersectionObserver(
      ([entry]) => (entry?.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    observer.observe(canvas);
    const onVisibility = () =>
      document.visibilityState === "visible" ? start() : stop();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} class="hero-constellation" aria-hidden="true" />;
}
