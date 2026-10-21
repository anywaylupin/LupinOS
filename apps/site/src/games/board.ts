// The board engine: one minimax with alpha-beta pruning that plays any two-player game given its
// rules, plus the rules for Tic-tac-toe and Connect Four. Pure, so the computer is testable.

export type Rules<S, M> = {
  moves: (s: S) => M[];
  play: (s: S, m: M) => S;
  /** Who moves next: 1 or -1. */
  turn: (s: S) => 1 | -1;
  /** 1 or -1 when that side has won, 0 for a draw, null while the game goes on. */
  winner: (s: S) => 1 | -1 | 0 | null;
  /** Score for side 1 when the search stops early. */
  guess?: (s: S) => number;
};

/** The best move for whoever is to play, searching `depth` plies ahead. */
export function bestMove<S, M>(rules: Rules<S, M>, s: S, depth: number): M | undefined {
  const me = rules.turn(s);
  const search = (st: S, d: number, alpha: number, beta: number): number => {
    const w = rules.winner(st);
    if (w !== null) return w === 0 ? 0 : w * (1000 + d);
    if (d === 0) return rules.guess?.(st) ?? 0;
    const maxing = rules.turn(st) === 1;
    let best = maxing ? -Infinity : Infinity;
    for (const m of rules.moves(st)) {
      const v = search(rules.play(st, m), d - 1, alpha, beta);
      if (maxing) {
        best = Math.max(best, v);
        alpha = Math.max(alpha, v);
      } else {
        best = Math.min(best, v);
        beta = Math.min(beta, v);
      }
      if (beta <= alpha) break;
    }
    return best;
  };
  let pick: M | undefined;
  let bestV = -Infinity;
  for (const m of rules.moves(s)) {
    const v = search(rules.play(s, m), depth - 1, -Infinity, Infinity) * me;
    if (v > bestV) {
      bestV = v;
      pick = m;
    }
  }
  return pick;
}

// ---- Tic-tac-toe ----------------------------------------------------------------------------------

export type Cells = (1 | -1 | 0)[];
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const ttt: Rules<Cells, number> = {
  moves: (s) => s.flatMap((v, i) => (v ? [] : [i])),
  play: (s, m) => s.map((v, i) => (i === m ? ttt.turn(s) : v)) as Cells,
  turn: (s) => (s.filter((v) => v).length % 2 === 0 ? 1 : -1),
  winner: (s) => {
    for (const [a, b, c] of LINES) if (s[a] && s[a] === s[b] && s[a] === s[c]) return s[a] as 1 | -1;
    return s.every((v) => v) ? 0 : null;
  },
};
export const tttLine = (s: Cells) => LINES.find(([a, b, c]) => s[a] && s[a] === s[b] && s[a] === s[c]);

// ---- Connect Four -----------------------------------------------------------------------------------

export const C4_COLS = 7;
export const C4_ROWS = 6;
/** Columns of discs, bottom first. */
export type Columns = (1 | -1)[][];

function c4Line(s: Columns): { side: 1 | -1; cells: [number, number][] } | null {
  const at = (c: number, r: number) => s[c]?.[r];
  for (let c = 0; c < C4_COLS; c++)
    for (let r = 0; r < C4_ROWS; r++) {
      const v = at(c, r);
      if (!v) continue;
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ]) {
        const cells: [number, number][] = [0, 1, 2, 3].map((k) => [c + dc * k, r + dr * k]);
        if (cells.every(([x, y]) => at(x, y) === v)) return { side: v, cells };
      }
    }
  return null;
}
export const c4Win = c4Line;

export const c4: Rules<Columns, number> = {
  // Centre columns first: better moves earlier make pruning much faster.
  moves: (s) => [3, 2, 4, 1, 5, 0, 6].filter((c) => s[c].length < C4_ROWS),
  play: (s, m) => s.map((col, i) => (i === m ? [...col, c4.turn(s)] : col)),
  turn: (s) => (s.reduce((n, col) => n + col.length, 0) % 2 === 0 ? 1 : -1),
  winner: (s) => c4Line(s)?.side ?? (s.every((col) => col.length === C4_ROWS) ? 0 : null),
  guess: (s) => {
    // Discs in the centre column are worth a little.
    let v = 0;
    for (const d of s[3]) v += d * 3;
    for (const d of [...s[2], ...s[4]]) v += d;
    return v;
  },
};
export const c4Empty = (): Columns => Array.from({ length: C4_COLS }, () => []);
