// A desktop window with macOS proportions: traffic lights, a full-height translucent sidebar,
// a unified toolbar, drag with momentum, edge snapping, eight resize grips, shake to clear,
// and genie-style open, close and minimise motion. It is controlled: you own the rect.
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { clamp, type Rect, type Zone, zoneAt, zoneRect } from "./geometry.ts";

export type WindowProps = {
  title: string;
  /** Position and size, in the coordinates of the window's container. */
  rect: Rect;
  /** Called when a drag, throw, snap or resize ends. `zone` is set when it snapped. */
  onRectChange?: (rect: Rect, zone: Zone | null) => void;
  zIndex?: number;
  focused?: boolean;
  minimized?: boolean;
  maximized?: boolean;
  /** The area to snap and maximise into. Defaults to the viewport below a 26px menu bar. */
  bounds?: () => Rect;
  minWidth?: number;
  minHeight?: number;
  /** Content for a full-height sidebar; the traffic lights sit on top of it. */
  sidebar?: ReactNode;
  sidebarWidth?: number;
  /** Controls on the right of the toolbar. */
  toolbar?: ReactNode;
  /** "unified": tall toolbar with a bold title. "title": slim bar with a centred title. */
  chrome?: "unified" | "title";
  snapping?: boolean;
  /** A quick flick throws the window, and it glides to a stop. */
  momentum?: boolean;
  /** Where the window grows from when it first appears, such as the icon that opened it. */
  openFrom?: Rect;
  /** Where it shrinks to on close or minimise, usually its dock icon. */
  dockTarget?: () => Rect | undefined;
  onFocus?: () => void;
  onClose?: () => void;
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

function reducedMotion(el: Element) {
  const m = el.closest<HTMLElement>(".lui")?.dataset.luiMotion;
  if (m === "none" || m === "reduced") return m;
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
}

/** Animates the window between its own box and another rect, like the genie effect. */
function fly(el: HTMLElement, target: Rect | undefined, dir: "in" | "out", kind: "open" | "minimize") {
  const motion = reducedMotion(el);
  if (motion === "none") return Promise.resolve();
  const r = el.getBoundingClientRect();
  const fade = [{ opacity: dir === "in" ? 0 : 1 }, { opacity: dir === "in" ? 1 : 0 }];
  if (motion === "reduced" || !target) {
    const small = { opacity: 0, transform: "scale(0.94)" };
    const frames = motion === "reduced" ? fade : dir === "in" ? [small, { opacity: 1, transform: "none" }] : [{ opacity: 1, transform: "none" }, small];
    return el.animate(frames, { duration: dir === "in" ? 220 : 160, easing: "cubic-bezier(.2,.8,.2,1)" }).finished.catch(() => {});
  }
  const dx = target.x + target.w / 2 - (r.left + r.width / 2);
  const dy = target.y + target.h / 2 - (r.top + r.height / 2);
  const sx = Math.max(0.04, target.w / r.width);
  const sy = Math.max(0.04, target.h / r.height);
  const small =
    kind === "minimize"
      ? { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) skewX(8deg)`, opacity: 0.4 }
      : { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0 };
  const big = { transform: "none", opacity: 1 };
  return el
    .animate(dir === "in" ? [small, big] : [big, small], {
      duration: dir === "in" ? 340 : kind === "minimize" ? 380 : 240,
      easing: dir === "in" ? "cubic-bezier(.16,1,.3,1)" : "cubic-bezier(.55,0,.75,.35)",
    })
    .finished.catch(() => {});
}

export function Lights({
  onClose,
  onMinimize,
  onZoom,
}: {
  onClose?: () => void;
  onMinimize?: () => void;
  onZoom?: () => void;
}) {
  return (
    <div className="lui-lights" data-lui-nodrag>
      <button type="button" className="lui-light" data-kind="close" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 8 8" aria-hidden="true">
          <path d="M2 2l4 4M6 2 2 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="lui-light" data-kind="minimize" aria-label="Minimise" onClick={onMinimize}>
        <svg viewBox="0 0 8 8" aria-hidden="true">
          <path d="M1.6 4h4.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="lui-light" data-kind="zoom" aria-label="Zoom" onClick={onZoom}>
        <svg viewBox="0 0 8 8" aria-hidden="true">
          <path d="M2 1.8h3.2L2 5z M6 6.2H2.8L6 3z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}

export function Window({
  title,
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
  momentum = true,
  openFrom,
  dockTarget,
  onFocus,
  onClose,
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
  const mode = chrome ?? (sidebar || toolbar ? "unified" : "title");

  useLayoutEffect(() => {
    if (ref.current && openFrom) fly(ref.current, openFrom, "in", "open");
    // biome-ignore lint/correctness/useExhaustiveDependencies: the opening animation runs once
  }, []);
  useLayoutEffect(() => {
    if (ref.current && wasMin.current && !minimized) fly(ref.current, dockTarget?.(), "in", "minimize");
    wasMin.current = minimized;
  }, [minimized, dockTarget]);

  const closeAnimated = async () => {
    if (ref.current) await fly(ref.current, dockTarget?.(), "out", "open");
    onClose?.();
  };
  const minimizeAnimated = async () => {
    if (ref.current) await fly(ref.current, dockTarget?.(), "out", "minimize");
    onMinimize?.();
  };

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || maximized || !target.closest("[data-lui-drag]") || target.closest(INTERACTIVE)) return;
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    el.dataset.moving = "";
    const area = bounds();
    const start = { px: e.clientX, py: e.clientY, x: rect.x, y: rect.y };
    let pos = { x: rect.x, y: rect.y };
    let zone: Zone | null = null;
    const samples: { x: number; y: number; t: number }[] = [];
    let lastDir = 0;
    let flips: number[] = [];
    const { w, h } = rect;

    const move = (ev: PointerEvent) => {
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
        setPreview(zone ? zoneRect(zone, area) : null);
      }
    };
    const up = (ev: PointerEvent) => {
      move(ev);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setPreview(null);
      const finish = (r: Rect, z: Zone | null) => {
        delete el.dataset.moving;
        onRectChange?.(r, z);
      };
      if (zone === "maximize") {
        delete el.dataset.moving;
        onRectChange?.({ x: pos.x, y: pos.y, w, h }, null);
        return onToggleMaximize?.();
      }
      if (zone) return finish(zoneRect(zone, area), zone);
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
      delete el.dataset.moving;
      onRectChange?.(r, null);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  };

  const lights = <Lights onClose={closeAnimated} onMinimize={minimizeAnimated} onZoom={onToggleMaximize} />;

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
            {lights}
            {sidebar}
          </aside>
        )}
        <div className="lui-window-main">
          <header className="lui-window-toolbar" data-lui-drag>
            {!sidebar && lights}
            <span className="lui-window-title">{title}</span>
            {toolbar && <div className="lui-window-tools">{toolbar}</div>}
          </header>
          <div className="lui-window-body">{children}</div>
        </div>
        {!maximized &&
          EDGES.map((g) => (
            <div key={g} className="lui-grip" data-edge={g} onPointerDown={(e) => startResize(e, g)} />
          ))}
      </div>
      {preview && <div className="lui-snap" style={{ left: preview.x, top: preview.y, width: preview.w, height: preview.h }} />}
    </>
  );
}
