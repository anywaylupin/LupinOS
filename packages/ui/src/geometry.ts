// Pure geometry shared by the window manager and the dock. No DOM, so it is easy to test.

export type Rect = { x: number; y: number; w: number; h: number };
export type Zone = "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "maximize";

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

/** The rect a window takes when snapped to a zone. */
export function zoneRect(zone: Zone, area: Rect): Rect {
  if (zone === "maximize") return { ...area };
  const hw = Math.round(area.w / 2);
  const hh = Math.round(area.h / 2);
  const isRight = zone === "right" || zone === "top-right" || zone === "bottom-right";
  const isBottom = zone === "bottom-left" || zone === "bottom-right";
  const isHalf = zone === "left" || zone === "right";
  return {
    x: area.x + (isRight ? hw : 0),
    y: area.y + (isBottom ? hh : 0),
    w: isRight ? area.w - hw : hw,
    h: isHalf ? area.h : isBottom ? area.h - hh : hh,
  };
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
