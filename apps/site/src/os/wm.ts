// Window-manager maths for the three modes, kept pure so it is easy to test.
// Freestyle: windows float. Tiling: a Hyprland-style layout with keyboard focus and swaps.
// Chain: a scrolling strip, like ChainYourMac or niri, where new windows extend the strip.
type Rect = { x: number; y: number; w: number; h: number };

export type WinMode = "free" | "tile" | "chain";
export type Dir = "left" | "right" | "up" | "down";

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * The window next to `from` in a direction, like Hyprland's movefocus: the nearest one whose
 * centre lies that way, preferring windows straight ahead over ones off to the side.
 */
export function neighbour(rects: Map<string, Rect>, from: string, dir: Dir): string | undefined {
  const a = rects.get(from);
  if (!a) return undefined;
  const c = centre(a);
  let best: { id: string; score: number } | undefined;
  for (const [id, r] of rects) {
    if (id === from) continue;
    const d = centre(r);
    const along = dir === "left" ? c.x - d.x : dir === "right" ? d.x - c.x : dir === "up" ? c.y - d.y : d.y - c.y;
    if (along <= 1) continue;
    const across = dir === "left" || dir === "right" ? Math.abs(d.y - c.y) : Math.abs(d.x - c.x);
    const score = along + across * 2;
    if (!best || score < best.score) best = { id, score };
  }
  return best?.id;
}

/**
 * Lays windows side by side on one strip. Each keeps its own width (at most the screen) and
 * takes the full height. Returns rects in strip coordinates and the strip's total width.
 */
export function chainLayout(wins: { id: string; w: number }[], area: Rect, gap: number) {
  const rects = new Map<string, Rect>();
  let x = area.x + gap;
  const maxW = area.w - gap * 2;
  for (const win of wins) {
    const w = Math.round(Math.min(maxW, Math.max(280, win.w)));
    rects.set(win.id, { x, y: area.y + gap, w, h: area.h - gap * 2 });
    x += w + gap;
  }
  return { rects, width: x - area.x };
}

/** The scroll offset that keeps `offset` where it is unless `r` would be cut off. */
export function reveal(offset: number, r: Rect, viewW: number, gap: number) {
  if (r.x - gap < offset) return Math.max(0, r.x - gap);
  if (r.x + r.w + gap > offset + viewW) return r.x + r.w + gap - viewW;
  return offset;
}

export const clampOffset = (offset: number, stripW: number, viewW: number) => Math.max(0, Math.min(offset, stripW - viewW));

/** Column widths Alt+R steps through in Chain mode, as parts of the screen. */
const WIDTHS = [1 / 3, 1 / 2, 2 / 3];
export function nextWidth(w: number, areaW: number, gap: number) {
  const usable = areaW - gap * 2;
  const i = WIDTHS.findIndex((k) => Math.round(usable * k) > w + 4);
  return Math.round(usable * WIDTHS[i < 0 ? 0 : i]);
}

/** Where a window dragged along the strip should go: before the first column whose centre is past the pointer. */
export function dropIndex(rects: Map<string, Rect>, dragged: string, stripX: number) {
  const others = [...rects].filter(([id]) => id !== dragged);
  const i = others.findIndex(([, r]) => stripX < r.x + r.w / 2);
  return i < 0 ? others.length : i;
}
