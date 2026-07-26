// The animated node network behind the hero (D-039).
// Depends on: nothing but the DOM. Depended on by: components/home.tsx.
//
// Replaces the static PCB trace with drifting points joined by lines whenever
// they come close — the reference Christopher sent. It suits Metal better than
// it looks: a network that keeps rewiring itself is what the curriculum is
// about, and it reads as a circuit rather than decoration because the palette
// stays copper.
//
// THREE THINGS MAKE IT FEEL ALIVE rather than merely moving, after he asked for
// something more dynamic than the first version:
//   - node sizes and speeds vary, so the field never settles into one sweep
//   - the pointer becomes a node: nearby points link to it and drift aside
//   - signal pulses run down links, which is what makes it read as a circuit
//     carrying something rather than a lattice sitting there
//
// CANVAS, NOT SVG. Roughly forty nodes means hundreds of candidate lines every
// frame; as SVG that is hundreds of DOM elements mutating 60 times a second,
// which is exactly the kind of thing that makes a phone warm. One canvas draw
// call per frame does not.
//
// AND THREE THINGS KEEP IT CHEAP, because this sits behind the home screen of a
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
/** How far the pointer reaches, as a fraction of canvas width. */
const POINTER_RADIUS_RATIO = 0.22;
/** Simultaneous signal pulses travelling along links. */
const MAX_PULSES = 3;
/** Chance per frame that a new pulse starts, when there is room for one. */
const PULSE_SPAWN_CHANCE = 0.014;
/** Fraction of a link traversed per frame. */
const PULSE_SPEED = 0.013;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Per-node radius, so the field has some depth instead of uniform dots. */
  radius: number;
}

/** A bright dot running from one node to another along their link. */
interface Pulse {
  from: number;
  to: number;
  /** 0 at the source, 1 on arrival. */
  t: number;
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
    let pulses: Pulse[] = [];
    let frame = 0;
    let running = false;
    const pointer = { x: 0, y: 0, active: false };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.width === width && rect.height === height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fewer nodes on a phone: the same count on a small canvas is a scribble,
      // and the link test is quadratic in node count.
      const count = Math.max(14, Math.round((NODE_TARGET * width) / 1200));
      // Keep the nodes that already exist and just bring them inside the new
      // bounds. Rebuilding the whole field on every measurement would make the
      // network visibly jump each time the hero's height changed.
      nodes = nodes.slice(0, count).map((node) => ({
        ...node,
        x: Math.min(node.x, width),
        y: Math.min(node.y, height),
      }));
      while (nodes.length < count) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          // Slow, but varied — a uniform speed reads as a screensaver.
          vx: (Math.random() - 0.5) * 0.34,
          vy: (Math.random() - 0.5) * 0.34,
          radius: 1.2 + Math.random() * 1.4,
        });
      }
      pulses = [];
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const linkDistance = width * LINK_DISTANCE_RATIO;
      const pointerRadius = width * POINTER_RADIUS_RATIO;

      for (const node of nodes) {
        // The pointer nudges nearby nodes gently aside, so the field reacts to
        // the cursor instead of ignoring it. Deliberately weak: it should feel
        // like the network noticing you, not like dragging it around.
        if (pointer.active) {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0.001 && distance < pointerRadius) {
            const push = (1 - distance / pointerRadius) * 0.35;
            node.x += (dx / distance) * push;
            node.y += (dy / distance) * push;
          }
        }
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off the edges rather than wrapping: wrapping makes lines snap
        // across the whole canvas as a node teleports.
        //
        // REFLECT the position and force the velocity INWARD, rather than
        // clamping to the edge and flipping the sign. The clamp-and-flip
        // version had a real bug: when the pointer pushed a node past the
        // boundary, the clamp pinned it exactly on the edge and the sign
        // flipped every single frame without the node ever moving, so nodes
        // collected in a line along the bottom and the links between them drew
        // a permanent gold smear (Christopher's "gold residue"). Reflecting the
        // overshoot puts the node back inside the canvas, and taking abs() of
        // the velocity guarantees it is now heading away from that wall, so it
        // cannot get stuck there however hard the pointer pushes.
        if (node.x < 0) {
          node.x = -node.x;
          node.vx = Math.abs(node.vx);
        } else if (node.x > width) {
          node.x = 2 * width - node.x;
          node.vx = -Math.abs(node.vx);
        }
        if (node.y < 0) {
          node.y = -node.y;
          node.vy = Math.abs(node.vy);
        } else if (node.y > height) {
          node.y = 2 * height - node.y;
          node.vy = -Math.abs(node.vy);
        }
        // A reflection can still land outside if the overshoot exceeded the
        // canvas — only possible under a violent resize — so clamp as a floor.
        node.x = Math.min(width, Math.max(0, node.x));
        node.y = Math.min(height, Math.max(0, node.y));
      }

      context.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > linkDistance) continue;
          // Fade the line out as the pair separates, so links appear and vanish
          // smoothly instead of blinking at the threshold.
          const alpha = 0.28 * (1 - distance / linkDistance);
          context.strokeStyle = "rgba(208, 138, 74, " + alpha + ")";
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      // Links to the pointer itself, so it reads as another node in the mesh.
      if (pointer.active) {
        for (const node of nodes) {
          const distance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
          if (distance > pointerRadius) continue;
          const alpha = 0.3 * (1 - distance / pointerRadius);
          context.strokeStyle = "rgba(226, 164, 104, " + alpha + ")";
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(pointer.x, pointer.y);
          context.stroke();
        }
      }

      // Signal pulses: a bright dot running down a link, which is what makes
      // the thing read as a circuit carrying something rather than a lattice.
      if (
        nodes.length > 1 &&
        pulses.length < MAX_PULSES &&
        Math.random() < PULSE_SPAWN_CHANCE
      ) {
        const from = Math.floor(Math.random() * nodes.length);
        const source = nodes[from]!;
        const candidates: number[] = [];
        for (let i = 0; i < nodes.length; i++) {
          if (i === from) continue;
          const n = nodes[i]!;
          if (Math.hypot(n.x - source.x, n.y - source.y) < linkDistance)
            candidates.push(i);
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        if (pick !== undefined) pulses.push({ from, to: pick, t: 0 });
      }
      pulses = pulses.filter((pulse) => {
        const a = nodes[pulse.from];
        const b = nodes[pulse.to];
        if (!a || !b) return false;
        pulse.t += PULSE_SPEED;
        if (pulse.t >= 1) return false;
        // A pulse whose link has stretched past the join distance dies with it,
        // rather than flying across empty space.
        if (Math.hypot(a.x - b.x, a.y - b.y) > linkDistance) return false;
        const x = a.x + (b.x - a.x) * pulse.t;
        const y = a.y + (b.y - a.y) * pulse.t;
        // Fade in and out so it never pops into existence.
        const brightness = Math.sin(pulse.t * Math.PI);
        context.fillStyle = "rgba(240, 190, 140, " + 0.85 * brightness + ")";
        context.beginPath();
        context.arc(x, y, 2.1, 0, Math.PI * 2);
        context.fill();
        return true;
      });

      context.fillStyle = "rgba(226, 164, 104, 0.55)";
      for (const node of nodes) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
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

    // A window resize is NOT the only way this canvas changes size. The hero
    // grows and shrinks with its own contents — adding the whole-curriculum bar
    // made it taller with no resize event at all — and the JS width/height then
    // stayed stale. Everything below the stale height was drawn but never
    // cleared, leaving a permanent copper smear along the bottom (Christopher's
    // "gold residue"). A ResizeObserver watches the element itself, so the
    // measurement follows the layout however it changed.
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);

    // Pointer tracking listens on the PARENT: the canvas itself has
    // pointer-events disabled so it can never swallow a click on the hero.
    // Touch is deliberately not wired — on a phone the finger is scrolling, and
    // a mesh recoiling from every scroll would be noise.
    const host = canvas.parentElement;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    host?.addEventListener("pointermove", onPointerMove);
    host?.addEventListener("pointerleave", onPointerLeave);

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host?.removeEventListener("pointermove", onPointerMove);
      host?.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} class="hero-constellation" aria-hidden="true" />;
}
