// Pure geometry shared by the window manager and the dock. No DOM, so it is easy to test.

export type Rect = { x: number; y: number; w: number; h: number };
export type Zone = "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "maximize";
/** Where a window was snapped. */
export type SnapZone = Zone;
/** A cell as fractions of the usable area: [x, y, width, height]. */
export type Frac = [number, number, number, number];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Which snap zone a pointer at (x, y) is in, given the usable area. Edges are 8px, corners 80px. */
export function zoneAt(x: number, y: number, area: Rect, edge = 8, corner = 80): Zone | null {
  const right = area.x + area.w;
  const bottom = area.y + area.h;
  if (x <= area.x + edge) return y < area.y + corner ? "top-left" : y > bottom - corner ? "bottom-left" : "left";
  if (x >= right - edge) return y < area.y + corner ? "top-right" : y > bottom - corner ? "bottom-right" : "right";
  if (y <= area.y + 2) return "maximize";
  return null;
}

const ZONES: Record<Exclude<Zone, "maximize">, Frac> = {
  left: [0, 0, 0.5, 1],
  right: [0.5, 0, 0.5, 1],
  "top-left": [0, 0, 0.5, 0.5],
  "top-right": [0.5, 0, 0.5, 0.5],
  "bottom-left": [0, 0.5, 0.5, 0.5],
  "bottom-right": [0.5, 0.5, 0.5, 0.5],
};

/**
 * A fractional cell as a rect inside `area`. `gap` is the space between neighbouring cells and
 * around the outside, so cells that share an edge line up exactly.
 */
export function fracRect([fx, fy, fw, fh]: Frac, area: Rect, gap = 0): Rect {
  const edge = (start: number, size: number) => [start < 0.001 ? gap : gap / 2, start + size > 0.999 ? gap : gap / 2];
  const [l, r] = edge(fx, fw);
  const [t, b] = edge(fy, fh);
  const x = Math.round(area.x + area.w * fx + l);
  const y = Math.round(area.y + area.h * fy + t);
  return { x, y, w: Math.round(area.x + area.w * (fx + fw) - r) - x, h: Math.round(area.y + area.h * (fy + fh) - b) - y };
}

/** The rect a window takes when snapped to a zone. Maximise always fills the area edge to edge. */
export function zoneRect(zone: Zone, area: Rect, gap = 0): Rect {
  return zone === "maximize" ? { ...area } : fracRect(ZONES[zone], area, gap);
}

/**
 * Tiling layout for `n` windows, like a dwindle layout: the first window takes half of the
 * space, splitting along the longer side, and the rest share the other half the same way.
 */
export function tileRects(n: number, area: Rect, gap = 0, ratio = 0.5): Rect[] {
  const cells: Frac[] = [];
  let f: Frac = [0, 0, 1, 1];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      cells.push(f);
      break;
    }
    const [x, y, w, h] = f;
    const wide = w * area.w >= h * area.h;
    // The first split follows the ratio; deeper ones halve.
    const k = i === 0 ? ratio : 0.5;
    cells.push(wide ? [x, y, w * k, h] : [x, y, w, h * k]);
    f = wide ? [x + w * k, y, w * (1 - k), h] : [x, y + h * k, w, h * (1 - k)];
  }
  return cells.map((c) => fracRect(c, area, gap));
}

/**
 * Dock magnification: the scale of an icon whose centre is `distance` px from the pointer.
 * A cosine falloff over `range` px, like the macOS dock. 1 means no magnification.
 */
export function dockScale(distance: number, range: number, magnify: number): number {
  const d = Math.abs(distance);
  if (d >= range) return 1;
  return 1 + (magnify - 1) * (Math.cos((d / range) * Math.PI) + 1) / 2;
}
