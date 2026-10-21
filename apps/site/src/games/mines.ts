// Minesweeper rules, kept pure so they are easy to test. Mines are placed on the first reveal,
// never under or next to it, so the first click always opens an area.

export type Cell = { mine: boolean; open: boolean; flag: boolean; n: number };
export type Board = { w: number; h: number; mines: number; cells: Cell[]; placed: boolean };

export const LEVELS = {
  easy: { w: 9, h: 9, mines: 10 },
  medium: { w: 16, h: 16, mines: 40 },
  hard: { w: 30, h: 16, mines: 99 },
} as const;
export type Level = keyof typeof LEVELS;

export function newBoard(w: number, h: number, mines: number): Board {
  return { w, h, mines, placed: false, cells: Array.from({ length: w * h }, () => ({ mine: false, open: false, flag: false, n: 0 })) };
}

export function neighbours(b: Pick<Board, "w" | "h">, i: number): number[] {
  const x = i % b.w;
  const y = Math.floor(i / b.w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < b.w && ny < b.h) out.push(ny * b.w + nx);
    }
  return out;
}

/** Lays the mines anywhere except `safe` and its neighbours, then counts each cell's neighbours. */
export function place(b: Board, safe: number, rand: () => number): Board {
  const keepClear = new Set([safe, ...neighbours(b, safe)]);
  const spots = b.cells.map((_, i) => i).filter((i) => !keepClear.has(i));
  const cells = b.cells.map((c) => ({ ...c, mine: false, n: 0 }));
  for (let k = 0; k < Math.min(b.mines, spots.length); k++) {
    const j = k + Math.floor(rand() * (spots.length - k));
    [spots[k], spots[j]] = [spots[j], spots[k]];
    cells[spots[k]].mine = true;
  }
  for (let i = 0; i < cells.length; i++) cells[i].n = neighbours(b, i).filter((j) => cells[j].mine).length;
  return { ...b, cells, placed: true };
}

/** Opens a cell. Empty cells open their neighbours too. `boom` is true when it was a mine. */
export function reveal(b: Board, i: number, rand: () => number): { board: Board; boom: boolean } {
  let board = b.placed ? { ...b, cells: b.cells.map((c) => ({ ...c })) } : place(b, i, rand);
  const start = board.cells[i];
  if (start.open || start.flag) return { board, boom: false };
  if (start.mine) {
    board = { ...board, cells: board.cells.map((c) => (c.mine ? { ...c, open: true } : c)) };
    return { board, boom: true };
  }
  const queue = [i];
  while (queue.length) {
    const j = queue.pop() as number;
    const c = board.cells[j];
    if (c.open || c.flag) continue;
    c.open = true;
    if (c.n === 0) queue.push(...neighbours(board, j).filter((k) => !board.cells[k].open));
  }
  return { board, boom: false };
}

/** Clicking an open number whose flags are all placed opens the rest of its neighbours. */
export function chord(b: Board, i: number, rand: () => number): { board: Board; boom: boolean } {
  const c = b.cells[i];
  const around = neighbours(b, i);
  if (!c.open || around.filter((j) => b.cells[j].flag).length !== c.n) return { board: b, boom: false };
  let board = b;
  let boom = false;
  for (const j of around) {
    if (board.cells[j].open || board.cells[j].flag) continue;
    const r = reveal(board, j, rand);
    board = r.board;
    boom ||= r.boom;
  }
  return { board, boom };
}

export function toggleFlag(b: Board, i: number): Board {
  if (b.cells[i].open) return b;
  return { ...b, cells: b.cells.map((c, j) => (j === i ? { ...c, flag: !c.flag } : c)) };
}

export const won = (b: Board) => b.placed && b.cells.every((c) => c.mine || c.open);
export const flagsLeft = (b: Board) => b.mines - b.cells.filter((c) => c.flag).length;
