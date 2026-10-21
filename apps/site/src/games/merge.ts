// Merge: tiles slide on a 4x4 grid and equal neighbours combine. Pure logic, tested.

export type Grid = number[]; // 16 cells, 0 is empty
export type Dir = "left" | "right" | "up" | "down";

/** Slides one line towards its start, merging each pair once. Returns the line and points won. */
export function slideLine(line: number[]): { line: number[]; points: number } {
  const tiles = line.filter((v) => v);
  const out: number[] = [];
  let points = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      points += tiles[i] * 2;
      i++;
    } else out.push(tiles[i]);
  }
  while (out.length < line.length) out.push(0);
  return { line: out, points };
}

const index = (dir: Dir, line: number, k: number) => {
  if (dir === "left") return line * 4 + k;
  if (dir === "right") return line * 4 + (3 - k);
  if (dir === "up") return k * 4 + line;
  return (3 - k) * 4 + line;
};

export function move(g: Grid, dir: Dir): { grid: Grid; points: number; moved: boolean } {
  const grid = [...g];
  let points = 0;
  for (let line = 0; line < 4; line++) {
    const ids = [0, 1, 2, 3].map((k) => index(dir, line, k));
    const r = slideLine(ids.map((i) => g[i]));
    ids.forEach((i, k) => {
      grid[i] = r.line[k];
    });
    points += r.points;
  }
  return { grid, points, moved: grid.some((v, i) => v !== g[i]) };
}

/** Drops a 2 (or sometimes a 4) into a random empty cell. */
export function spawn(g: Grid, rand: () => number = Math.random): Grid {
  const empty = g.flatMap((v, i) => (v ? [] : [i]));
  if (!empty.length) return g;
  const grid = [...g];
  grid[empty[Math.floor(rand() * empty.length)]] = rand() < 0.9 ? 2 : 4;
  return grid;
}

export const canMove = (g: Grid) => (["left", "right", "up", "down"] as Dir[]).some((d) => move(g, d).moved);
