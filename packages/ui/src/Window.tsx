// A LupinOS window: a bevelled glass pane with its controls on the right, a full-height
// sidebar, a unified toolbar, drag with momentum, edge snapping, a snap-layout picker, eight
// resize grips, shake to clear, and genie-style motion. It is controlled: you own the rect.
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { clamp, type Rect, type SnapZone, type Zone, zoneAt, zoneRect } from "./geometry.ts";

/** What ended in a rect change: a drag (with where the pointer let go) or a resize. */
export type RectChange = { kind: "drag" | "resize"; pointer?: { x: number; y: number } };

export type WindowProps = {
  title: string;
  /** A short label shown before the title, such as "02". */
  tag?: string;
  /** Position and size, in the coordinates of the window's container. */
  rect: Rect;
  /**
   * Called when a drag, throw, snap or resize ends. `zone` is set when it snapped.
   * If you keep the old rect, the window glides back to it.
   */
  onRectChange?: (rect: Rect, zone: SnapZone | null, change: RectChange) => void;
  zIndex?: number;
  focused?: boolean;
  minimized?: boolean;
  maximized?: boolean;
  /** The area to snap and maximise into. Defaults to the viewport below a 26px menu bar. */
  bounds?: () => Rect;
  minWidth?: number;
  minHeight?: number;
  /** Content for a full-height sidebar. */
  sidebar?: ReactNode;
  sidebarWidth?: number;
  /** Controls on the right of the toolbar, before the window controls. */
  toolbar?: ReactNode;
  /** "unified": tall toolbar with a bold title. "title": slim bar. */
  chrome?: "unified" | "title";
  snapping?: boolean;
  /** Space between snapped windows and around the edge, in px. */
  gap?: number;
  /** A quick flick throws the window, and it glides to a stop. */
  momentum?: boolean;
  resizable?: boolean;
  /**
   * The size to go back to when a snapped window is dragged away. The window takes this size
   * as the drag starts, keeping the same spot under the pointer, like macOS.
   */
  restoreSize?: { w: number; h: number };
  /** Where the window grows from when it first appears, such as the icon that opened it. */
  openFrom?: Rect;
  /** Where it shrinks to on close or minimise, usually its dock icon. */
  dockTarget?: () => Rect | undefined;
  onFocus?: () => void;
  onClose?: () => void;
  /** Asked before closing from the close button. Return false to keep the window open. */
  canClose?: (button: HTMLElement) => boolean;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  /** Shaking the window side to side. */
  onShake?: () => void;
  className?: string;
  children?: ReactNode;
};

const defaultBounds = (): Rect => ({ x: 0, y: 26, w: innerWidth, h: innerHeight - 26 });
const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
const INTERACTIVE = "button, input, textarea, select, a, [contenteditable], [data-lui-nodrag]";
const DRAG_START = 4;

function reducedMotion(el: Element) {
  const m = el.closest<HTMLElement>(".lui")?.dataset.luiMotion;
  if (m === "none" || m === "reduced") return m;
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
}

/** A smooth ease-out with no overshoot, for everything a window does. */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Runs an animation with the window marked as flying. The glass blur pauses meanwhile: blurring
 * what is behind a moving, scaling pane every frame is what makes it stutter.
 */
const inFlight = new WeakMap<HTMLElement, number>();
function flying(el: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
  inFlight.set(el, (inFlight.get(el) ?? 0) + 1);
  el.dataset.flying = "";
  return el
    .animate(frames, options)
    .finished.catch(() => {})
    .finally(() => {
      const left = (inFlight.get(el) ?? 1) - 1;
      inFlight.set(el, left);
      if (left <= 0) delete el.dataset.flying;
    });
}

/**
 * Plays a change of rect as a transform: the box is already at its new place, and it eases there
 * from the old one. Cheap for the browser, unlike animating width and height.
 */
function glide(el: HTMLElement, from: Rect, to: Rect) {
  if (reducedMotion(el) !== "full" || !to.w || !to.h) return;
  if (from.x === to.x && from.y === to.y && from.w === to.w && from.h === to.h) return;
  for (const a of el.getAnimations()) if ((a as Animation & { id: string }).id === "glide") a.cancel();
  const start = `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.w / to.w}, ${from.h / to.h})`;
  void flying(el, [{ transformOrigin: "0 0", transform: start }, { transformOrigin: "0 0", transform: "none" }], { duration: 280, easing: EASE, id: "glide" });
}

/** Animates the window between its own box and another rect, like the genie effect. */
function fly(el: HTMLElement, target: Rect | undefined, dir: "in" | "out", kind: "open" | "minimize") {
  const motion = reducedMotion(el);
  if (motion === "none") return Promise.resolve();
  const r = el.getBoundingClientRect();
  const fade = [{ opacity: dir === "in" ? 0 : 1 }, { opacity: dir === "in" ? 1 : 0 }];
  if (motion === "reduced" || !target) {
    const small = { opacity: 0, transform: "scale(0.96)" };
    const frames = motion === "reduced" ? fade : dir === "in" ? [small, { opacity: 1, transform: "none" }] : [{ opacity: 1, transform: "none" }, small];
    return flying(el, frames, { duration: dir === "in" ? 220 : 160, easing: EASE });
  }
  const dx = target.x + target.w / 2 - (r.left + r.width / 2);
  const dy = target.y + target.h / 2 - (r.top + r.height / 2);
  const sx = Math.max(0.04, target.w / r.width);
  const sy = Math.max(0.04, target.h / r.height);
  const small = { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: kind === "minimize" ? 0.3 : 0 };
  const big = { transform: "none", opacity: 1 };
  return flying(el, dir === "in" ? [small, big] : [big, small], {
    duration: dir === "in" ? 300 : kind === "minimize" ? 280 : 200,
    easing: dir === "in" ? EASE : "cubic-bezier(0.4, 0, 0.6, 1)",
  });
}

const glyph = {
  minimize: <path d="M3 8h10" />,
  maximize: <path d="M3.5 3.5h9v9h-9z" />,
  restore: <path d="M5.5 3.5h7v7M3.5 5.5h7v7h-7z" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
};

export function WindowControls({
  onClose,
  onMinimize,
  onZoom,
  maximized,
}: {
  onClose?: (button: HTMLButtonElement) => void;
  onMinimize?: () => void;
  onZoom?: () => void;
  maximized?: boolean;
}) {
  const zoomKind = maximized ? "restore" : "maximize";
  return (
    <div className="lui-controls" data-lui-nodrag>
      <button type="button" className="lui-control" data-kind="minimize" aria-label="Minimise" onClick={onMinimize}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          {glyph.minimize}
        </svg>
      </button>
      <button type="button" className="lui-control" data-kind={zoomKind} aria-label={maximized ? "Restore" : "Maximise"} onClick={onZoom}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          {glyph[zoomKind]}
        </svg>
      </button>
      <button type="button" className="lui-control" data-kind="close" aria-label="Close" onClick={(e) => onClose?.(e.currentTarget)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          {glyph.close}
        </svg>
      </button>
    </div>
  );
}

/** The old name, kept so existing imports work. */
export const Lights = WindowControls;

export function Window({
  title,
  tag,
  rect,
  onRectChange,
  zIndex,
  focused,
  minimized,
  maximized,
  bounds = defaultBounds,
  minWidth = 300,
  minHeight = 200,
  sidebar,
  sidebarWidth,
  toolbar,
  chrome,
  snapping = true,
  gap = 0,
  momentum = true,
  resizable = true,
  restoreSize,
  openFrom,
  dockTarget,
  onFocus,
  onClose,
  canClose,
  onMinimize,
  onToggleMaximize,
  onShake,
  className,
  children,
}: WindowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const wasMin = useRef(minimized);
  const box = maximized ? bounds() : rect;
  const boxRef = useRef(box);
  boxRef.current = box;
  const mode = chrome ?? (sidebar || toolbar ? "unified" : "title");

  useLayoutEffect(() => {
    if (ref.current && openFrom) fly(ref.current, openFrom, "in", "open");
    // biome-ignore lint/correctness/useExhaustiveDependencies: the opening animation runs once
  }, []);
  useLayoutEffect(() => {
    if (ref.current && wasMin.current && !minimized) fly(ref.current, dockTarget?.(), "in", "minimize");
    wasMin.current = minimized;
  }, [minimized, dockTarget]);

  // Snaps, tiling, maximise and layout picks change the rect; the window glides to it.
  const shown = useRef(box);
  useLayoutEffect(() => {
    const el = ref.current;
    const from = shown.current;
    shown.current = box;
    if (el && el.dataset.moving === undefined) glide(el, from, box);
  }, [box.x, box.y, box.w, box.h]);

  /**
   * After a drag or resize the element was moved by hand to `dropped`. Once the owner has
   * answered, the window glides from there to wherever the props now say.
   */
  const settle = (el: HTMLElement, dropped: Rect) =>
    requestAnimationFrame(() => {
      delete el.dataset.moving;
      delete el.dataset.unsnap;
      const b = boxRef.current;
      shown.current = b;
      Object.assign(el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      glide(el, dropped, b);
    });

  const closeAnimated = async (button?: HTMLElement) => {
    if (button && canClose && !canClose(button)) return;
    if (ref.current) await fly(ref.current, dockTarget?.(), "out", "open");
    onClose?.();
  };
  const minimizeAnimated = async () => {
    if (ref.current) await fly(ref.current, dockTarget?.(), "out", "minimize");
    onMinimize?.();
  };

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || !target.closest("[data-lui-drag]") || target.closest(INTERACTIVE)) return;
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const area = bounds();
    const from = { ...box };
    // A snapped or maximised window goes back to its own size once the drag really starts.
    const grow = maximized ? { w: rect.w, h: rect.h } : restoreSize;
    let { w, h } = from;
    const start = { px: e.clientX, py: e.clientY, x: from.x, y: from.y };
    let pos = { x: from.x, y: from.y };
    let moving = false;
    let zone: Zone | null = null;
    const samples: { x: number; y: number; t: number }[] = [];
    let lastDir = 0;
    let flips: number[] = [];

    const move = (ev: PointerEvent) => {
      if (!moving) {
        if (Math.hypot(ev.clientX - start.px, ev.clientY - start.py) < DRAG_START) return;
        moving = true;
        el.dataset.moving = "";
        if (grow && (grow.w !== w || grow.h !== h)) {
          const fx = (start.px - from.x) / from.w;
          w = grow.w;
          h = grow.h;
          start.x = start.px - fx * w;
          el.dataset.unsnap = "";
          Object.assign(el.style, { width: `${w}px`, height: `${h}px` });
        }
      }
      pos = {
        x: clamp(start.x + ev.clientX - start.px, area.x + 80 - w, area.x + area.w - 80),
        y: clamp(start.y + ev.clientY - start.py, area.y, area.y + area.h - 40),
      };
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      const now = performance.now();
      const prev = samples.at(-1);
      samples.push({ x: ev.clientX, y: ev.clientY, t: now });
      if (samples.length > 6) samples.shift();
      const dir = prev ? Math.sign(ev.clientX - prev.x) : 0;
      if (dir && lastDir && dir !== lastDir && Math.abs(ev.clientX - (prev?.x ?? 0)) > 3) {
        flips = [...flips.filter((t) => now - t < 500), now];
        if (flips.length >= 5) {
          flips = [];
          onShake?.();
        }
      }
      if (dir) lastDir = dir;
      if (snapping) {
        zone = zoneAt(ev.clientX, ev.clientY, area);
        setPreview(zone ? zoneRect(zone, area, gap) : null);
      }
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (!moving) return;
      move(ev);
      setPreview(null);
      const pointer = { x: ev.clientX, y: ev.clientY };
      const finish = (r: Rect, z: SnapZone | null) => {
        onRectChange?.(r, z, { kind: "drag", pointer });
        settle(el, { x: Math.round(pos.x), y: Math.round(pos.y), w, h });
      };
      if (zone === "maximize") {
        finish({ x: Math.round(pos.x), y: Math.round(pos.y), w, h }, null);
        return onToggleMaximize?.();
      }
      if (zone) return finish(zoneRect(zone, area, gap), zone);
      const a = samples[0];
      const b = samples.at(-1);
      const dt = a && b ? b.t - a.t : 0;
      let vx = dt > 0 && a && b ? (b.x - a.x) / dt : 0;
      let vy = dt > 0 && a && b ? (b.y - a.y) / dt : 0;
      if (!b || performance.now() - b.t > 60 || Math.hypot(vx, vy) < 0.5 || !momentum || reducedMotion(el) !== "full") {
        return finish({ x: Math.round(pos.x), y: Math.round(pos.y), w, h }, null);
      }
      // Thrown: glide with friction and bounce softly off the edges.
      let t0 = performance.now();
      const maxX = area.x + area.w - w;
      const maxY = area.y + area.h - 60;
      const step = (t: number) => {
        const d = Math.min(32, t - t0);
        t0 = t;
        pos.x += vx * d;
        pos.y += vy * d;
        if (pos.x < area.x || pos.x > maxX) {
          pos.x = clamp(pos.x, area.x, maxX);
          vx = -vx * 0.5;
        }
        if (pos.y < area.y || pos.y > maxY) {
          pos.y = clamp(pos.y, area.y, maxY);
          vy = -vy * 0.5;
        }
        vx *= 0.92;
        vy *= 0.92;
        el.style.left = `${pos.x}px`;
        el.style.top = `${pos.y}px`;
        if (Math.hypot(vx, vy) > 0.03) requestAnimationFrame(step);
        else finish({ x: Math.round(pos.x), y: Math.round(pos.y), w, h }, null);
      };
      requestAnimationFrame(step);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const startResize = (e: ReactPointerEvent<HTMLDivElement>, edge: string) => {
    if (maximized) return;
    e.stopPropagation();
    const el = ref.current;
    const grip = e.currentTarget;
    if (!el) return;
    grip.setPointerCapture(e.pointerId);
    el.dataset.moving = "";
    const area = bounds();
    const s = { px: e.clientX, py: e.clientY, ...rect };
    let r = { ...rect };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - s.px;
      const dy = ev.clientY - s.py;
      r = { x: s.x, y: s.y, w: s.w, h: s.h };
      if (edge.includes("e")) r.w = Math.max(minWidth, s.w + dx);
      if (edge.includes("s")) r.h = Math.max(minHeight, s.h + dy);
      if (edge.includes("w")) {
        r.w = Math.max(minWidth, s.w - dx);
        r.x = s.x + s.w - r.w;
      }
      if (edge.includes("n")) {
        r.y = clamp(s.y + dy, area.y, s.y + s.h - minHeight);
        r.h = s.y + s.h - r.y;
      }
      Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      onRectChange?.(r, null, { kind: "resize" });
      settle(el, r);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  };

  const controls = (
    <WindowControls
      onClose={closeAnimated}
      onMinimize={minimizeAnimated}
      onZoom={onToggleMaximize}
      maximized={maximized}
    />
  );

  return (
    <>
      <div
        ref={ref}
        role="dialog"
        aria-label={title}
        aria-hidden={minimized || undefined}
        className={className ? `lui-window ${className}` : "lui-window"}
        data-chrome={mode}
        data-focused={focused || undefined}
        data-minimized={minimized || undefined}
        data-maximized={maximized || undefined}
        style={{
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          zIndex,
          ...(sidebarWidth ? { "--lui-sidebar-w": `${sidebarWidth}px` } : {}),
        } as CSSProperties}
        onPointerDownCapture={() => !focused && onFocus?.()}
        onFocusCapture={() => !focused && onFocus?.()}
        onPointerDown={startDrag}
        onDoubleClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("[data-lui-drag]") && !t.closest(INTERACTIVE)) onToggleMaximize?.();
        }}
      >
        {sidebar && (
          <aside className="lui-window-sidebar" data-lui-drag>
            {sidebar}
          </aside>
        )}
        <div className="lui-window-main">
          <header className="lui-window-toolbar" data-lui-drag>
            <span className="lui-window-title">
              {tag && <b className="lui-window-tag">{tag}</b>}
              <span>{title}</span>
            </span>
            {toolbar && <div className="lui-window-tools">{toolbar}</div>}
            {controls}
          </header>
          <div className="lui-window-body">{children}</div>
        </div>
        {!maximized &&
          resizable &&
          EDGES.map((g) => <div key={g} className="lui-grip" data-edge={g} onPointerDown={(e) => startResize(e, g)} />)}
      </div>
      {preview && <div className="lui-snap" style={{ left: preview.x, top: preview.y, width: preview.w, height: preview.h }} />}
    </>
  );
}
