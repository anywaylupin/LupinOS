// The shared loop for canvas games: sizes the canvas to its box at the device pixel ratio, runs
// `step` only while the game is running and the tab is visible, and redraws when needed.
import { type RefObject, useEffect, useRef } from "react";

export type Palette = { bg: string; ink: string; muted: string; accent: string; i1: string; i2: string; i3: string; i4: string };

/** The theme colours, read from the CSS tokens around the canvas. */
export function palette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim() || "#888";
  return { bg: v("--lui-content"), ink: v("--lui-ink"), muted: v("--lui-muted"), accent: v("--lui-accent"), i1: v("--lui-i1"), i2: v("--lui-i2"), i3: v("--lui-i3"), i4: v("--lui-i4") };
}

type Loop = {
  running: boolean;
  step: (dt: number) => void;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, colors: Palette) => void;
};

export function useCanvasLoop(ref: RefObject<HTMLCanvasElement | null>, loop: Loop) {
  const current = useRef(loop);
  current.current = loop;
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let w = 0;
    let h = 0;
    let colors = palette(c);
    let dirty = true;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = devicePixelRatio || 1;
      w = r.width;
      h = r.height;
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      colors = palette(c);
      dirty = true;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    // A theme or mode switch changes the tokens on the root.
    const mo = new MutationObserver(() => {
      colors = palette(c);
      dirty = true;
    });
    const root = c.closest(".lui");
    if (root) mo.observe(root, { attributes: true, attributeFilter: ["data-lui-theme", "data-lui-mode", "style"] });
    let raf = 0;
    let last = performance.now();
    let wasRunning = false;
    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const { running, step, draw } = current.current;
      if (running) step(dt);
      if (running || dirty || running !== wasRunning) draw(ctx, w, h, colors);
      wasRunning = running;
      dirty = false;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref]);
}

/** Calls `fn` for keys while `active`, so only the focused game window hears them. */
export function useKeys(active: boolean, fn: (e: KeyboardEvent) => void) {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    if (!active) return;
    const k = (e: KeyboardEvent) => !e.altKey && !e.ctrlKey && !e.metaKey && f.current(e);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [active]);
}
