// The dock: a glass shelf that floats above the bottom edge. The shelf keeps its size; icons
// grow a little as the pointer passes and slide apart to make room. Drag an icon sideways to
// reorder. Labels fade in, running apps get a dot, launching ones bounce.
import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useRef } from "react";
import { flushSync } from "react-dom";
import { dockScale, type Rect } from "./geometry.ts";

export type DockItem = {
  id: string;
  label: string;
  icon: ReactNode;
  running?: boolean;
  /** Bounce while launching or asking for attention. */
  bouncing?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>, iconRect: Rect) => void;
  onContextMenu?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
};

export type DockProps = {
  items: DockItem[];
  /** After the separator: minimised windows, folders, Trash. Not reorderable. */
  trailing?: DockItem[];
  /** Icon size at rest, in px. */
  size?: number;
  /** Largest scale under the pointer. 1 turns magnification off. */
  magnify?: number;
  /** How far the magnification reaches either side, in px. */
  range?: number;
  /** Called with the new order of `items` ids after a drag. Leave unset to disable dragging. */
  onReorder?: (ids: string[]) => void;
  label?: string;
  className?: string;
};

const GAP = 4;

/** Find a dock icon's rect by item id, for windows that shrink into it. */
export function dockRect(id: string): Rect | undefined {
  const r = document.querySelector(`[data-lui-dock-id="${CSS.escape(id)}"]`)?.getBoundingClientRect();
  return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : undefined;
}

export function Dock({ items, trailing = [], size = 50, magnify = 1.3, range, onReorder, label = "Dock", className }: DockProps) {
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const drag = useRef<{ id: string; from: number; to: number; x0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const reach = range ?? size * 2.4;

  const els = () => [...(ref.current?.querySelectorAll<HTMLElement>(".lui-dock-item") ?? [])];
  const centerOf = (el: HTMLElement) => (ref.current?.getBoundingClientRect().left ?? 0) + el.offsetLeft + el.offsetWidth / 2;

  /** Scale each icon by its distance to the pointer, then shift them apart so nothing overlaps. */
  const magnifyAt = (x: number) => {
    if (magnify <= 1 || drag.current?.moved) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const list = els();
      const scales = list.map((el) => dockScale(x - centerOf(el), reach, magnify));
      const extras = scales.map((s) => size * (s - 1));
      const total = extras.reduce((a, b) => a + b, 0);
      let before = 0;
      list.forEach((el, i) => {
        const tx = before + extras[i] / 2 - total / 2;
        before += extras[i];
        el.style.transform = `translateX(${tx}px) scale(${scales[i]})`;
      });
    });
  };
  const rest = () => {
    cancelAnimationFrame(frame.current);
    if (ref.current) delete ref.current.dataset.tracking;
    for (const el of els()) el.style.transform = "";
  };

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, id: string, index: number) => {
    if (!onReorder || e.button !== 0) return;
    drag.current = { id, from: index, to: index, x0: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      rest();
      e.currentTarget.dataset.dragging = "";
    }
    const step = size + GAP;
    // The icon stays on the shelf: it can slide from the first slot to the last, no further.
    const x = Math.max(-d.from * step, Math.min((items.length - 1 - d.from) * step, dx));
    const to = d.from + Math.round(x / step);
    d.to = to;
    els()
      .slice(0, items.length)
      .forEach((el, i) => {
        if (i === d.from) el.style.transform = `translateX(${x}px) scale(1.12)`;
        else if (d.from < to && i > d.from && i <= to) el.style.transform = `translateX(${-step}px)`;
        else if (d.from > to && i < d.from && i >= to) el.style.transform = `translateX(${step}px)`;
        else el.style.transform = "";
      });
  };
  /** Glides the icon into its slot, then swaps the real order in one frame so nothing jumps. */
  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    const el = e.currentTarget;
    delete el.dataset.dragging;
    suppressClick.current = true;
    el.style.transform = `translateX(${(d.to - d.from) * (size + GAP)}px)`;
    setTimeout(() => {
      const list = els();
      for (const x of list) {
        x.style.transition = "none";
        x.style.transform = "";
      }
      if (d.to !== d.from) {
        const ids = items.map((it) => it.id);
        const [moved] = ids.splice(d.from, 1);
        ids.splice(d.to, 0, moved);
        flushSync(() => onReorder?.(ids));
      }
      requestAnimationFrame(() => {
        for (const x of list) x.style.transition = "";
      });
    }, 240);
  };

  const button = (it: DockItem, index: number, reorderable: boolean) => (
    <button
      key={it.id}
      type="button"
      className="lui-dock-item"
      data-lui-dock-id={it.id}
      data-running={it.running || undefined}
      data-bounce={it.bouncing || undefined}
      aria-label={it.label}
      style={{ width: size, height: size }}
      onPointerDown={reorderable ? (e) => startDrag(e, it.id, index) : undefined}
      onPointerMove={reorderable ? moveDrag : undefined}
      onPointerUp={reorderable ? endDrag : undefined}
      onPointerCancel={reorderable ? endDrag : undefined}
      onClick={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        const r = e.currentTarget.getBoundingClientRect();
        it.onClick?.(e, { x: r.left, y: r.top, w: r.width, h: r.height });
      }}
      onContextMenu={it.onContextMenu}
    >
      <span className="lui-dock-icon">{it.icon}</span>
      <span className="lui-dock-label" aria-hidden="true">
        {it.label}
      </span>
    </button>
  );

  return (
    <nav
      ref={ref}
      className={className ? `lui-dock ${className}` : "lui-dock"}
      aria-label={label}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse" && ref.current) ref.current.dataset.tracking = "";
      }}
      onPointerMove={(e) => e.pointerType === "mouse" && magnifyAt(e.clientX)}
      onPointerLeave={() => !drag.current && rest()}
    >
      {items.map((it, i) => button(it, i, !!onReorder))}
      {trailing.length > 0 && <span className="lui-dock-sep" aria-hidden="true" />}
      {trailing.map((it, i) => button(it, items.length + i, false))}
    </nav>
  );
}
