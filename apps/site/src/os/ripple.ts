// Water ripples on a coarse grid: the classic two-buffer height field. Pure, so it is tested
// without a canvas. Wallpaper.tsx shades it onto a small canvas that the browser scales up, and
// runs it only while the water moves.

export type Pond = { w: number; h: number; cur: Float32Array; prev: Float32Array };

export const pond = (w: number, h: number): Pond => ({ w, h, cur: new Float32Array(w * h), prev: new Float32Array(w * h) });

/** Pushes the water at (x, y) down by `amount`, fading out over `r` cells. */
export function drop(p: Pond, x: number, y: number, r: number, amount: number) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      const d = Math.hypot(dx, dy);
      if (d > r || cx < 1 || cy < 1 || cx > p.w - 2 || cy > p.h - 2) continue;
      p.cur[cy * p.w + cx] += amount * (1 - d / (r + 1));
    }
}

/**
 * Pushes the water down along a row, `half` cells either side of x, tapered at the ends: a long
 * swell that rolls away up and down the screen, like a wave pushed by a fast swipe.
 */
export function line(p: Pond, x: number, y: number, half: number, amount: number) {
  if (y < 1 || y > p.h - 3) return;
  for (let dx = -half; dx <= half; dx++) {
    const cx = x + dx;
    if (cx < 1 || cx > p.w - 2) continue;
    const taper = Math.cos(((dx / (half + 1)) * Math.PI) / 2);
    p.cur[y * p.w + cx] += amount * taper;
    p.cur[(y + 1) * p.w + cx] += amount * taper * 0.5;
  }
}

/** Advances the water one step. Returns the largest height left, so the caller knows when it is still. */
export function step(p: Pond, damp = 0.96) {
  const { w, h, cur } = p;
  const next = p.prev;
  let max = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = ((cur[i - 1] + cur[i + 1] + cur[i - w] + cur[i + w]) * 0.5 - next[i]) * damp;
      next[i] = v;
      if (v > max) max = v;
      else if (-v > max) max = -v;
    }
  p.prev = cur;
  p.cur = next;
  return max;
}

/** Shades the water onto RGBA pixels: slopes that face the sky catch light, the others darken a little. */
export function shade(p: Pond, px: Uint8ClampedArray, gain = 2.2) {
  const { w, h, cur } = p;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const s = (cur[i + w] - cur[i - w] + (cur[i + 1] - cur[i - 1]) * 0.35) * gain;
      const o = i * 4;
      const v = s > 0 ? 255 : 0;
      px[o] = v;
      px[o + 1] = v;
      px[o + 2] = v;
      px[o + 3] = s > 0 ? s : -s * 0.5;
    }
}
