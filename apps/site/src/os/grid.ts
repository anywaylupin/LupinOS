// Desktop icon grid. Columns count from the right edge, rows from the top, so a fresh desktop
// fills the right-hand column first, like macOS. Pure functions, so they are easy to test.

export type Cell = { col: number; row: number };

const key = (c: Cell) => `${c.col},${c.row}`;

/** Keeps every saved cell that fits and is free, then fills the rest top to bottom, right to left. */
export function layoutIcons(ids: string[], saved: Record<string, Cell>, cols: number, rows: number): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  const taken = new Set<string>();
  for (const id of ids) {
    const c = saved[id];
    if (c && c.col < cols && c.row < rows && !taken.has(key(c))) {
      out[id] = c;
      taken.add(key(c));
    }
  }
  let next = { col: 0, row: 0 };
  for (const id of ids) {
    if (out[id]) continue;
    while (taken.has(key(next))) next = next.row + 1 < rows ? { col: next.col, row: next.row + 1 } : { col: next.col + 1, row: 0 };
    out[id] = next;
    taken.add(key(next));
  }
  return out;
}

/** The free cell closest to `want`, searching outwards ring by ring. */
export function nearestFree(want: Cell, taken: Set<string>, cols: number, rows: number): Cell {
  const fit = { col: Math.min(Math.max(want.col, 0), cols - 1), row: Math.min(Math.max(want.row, 0), rows - 1) };
  for (let d = 0; d < cols + rows; d++) {
    for (let dc = -d; dc <= d; dc++) {
      const left = d - Math.abs(dc);
      for (const dr of left ? [-left, left] : [0]) {
        const c = { col: fit.col + dc, row: fit.row + dr };
        if (c.col >= 0 && c.col < cols && c.row >= 0 && c.row < rows && !taken.has(key(c))) return c;
      }
    }
  }
  return fit;
}

export const cellKey = key;
