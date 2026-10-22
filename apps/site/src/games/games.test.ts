import assert from "node:assert/strict";
import { test } from "node:test";
import { bestMove, canFound, canStack, type Card, dealKlondike, drawStock, type Klondike, moveCards, won as klondikeWon, autoStep } from "./cards.ts";
import { chord, newBoard, neighbours, reveal, toggleFlag, won } from "./mines.ts";
import { dailySeed, mulberry32, shuffle } from "./rng.ts";

const card = (suit: Card["suit"], rank: number, up = true): Card => ({ id: `${suit}${rank}`, suit, rank, up });

test("the same seed gives the same sequence and the same shuffle", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  assert.deepEqual(shuffle([1, 2, 3, 4, 5], mulberry32(7)), shuffle([1, 2, 3, 4, 5], mulberry32(7)));
  assert.equal(dailySeed(new Date(Date.UTC(2026, 9, 21))), 20261021);
});

test("the first reveal is never a mine and opens its neighbourhood", () => {
  for (let seed = 1; seed < 30; seed++) {
    const { board, boom } = reveal(newBoard(9, 9, 10), 40, mulberry32(seed));
    assert.equal(boom, false);
    assert.equal(board.cells.filter((c) => c.mine).length, 10);
    for (const j of [40, ...neighbours(board, 40)]) assert.equal(board.cells[j].mine, false);
    assert.ok(board.cells.filter((c) => c.open).length >= 9);
  }
});

test("flags, chords and winning", () => {
  // One mine in the corner of a 3x3 board: everything else opens on the first click.
  let { board } = reveal(newBoard(3, 3, 1), 8, () => 0);
  assert.equal(board.cells[0].mine, true);
  assert.ok(won(board));
  board = toggleFlag(newBoard(3, 3, 1), 4);
  assert.equal(board.cells[4].flag, true);
  // A chord on an unflagged number does nothing.
  const first = reveal(newBoard(4, 1, 1), 3, () => 0).board;
  assert.equal(chord(first, 1, () => 0).board, first);
});

test("stacking and foundation rules", () => {
  assert.ok(canStack(card("H", 6), card("S", 7)));
  assert.ok(!canStack(card("H", 6), card("D", 7)));
  assert.ok(!canStack(card("H", 6), card("S", 8)));
  assert.ok(canStack(card("S", 13), undefined));
  assert.ok(!canStack(card("S", 12), undefined));
  assert.ok(canFound(card("C", 1), []));
  assert.ok(canFound(card("C", 2), [card("C", 1)]));
  assert.ok(!canFound(card("D", 2), [card("C", 1)]));
});

test("a Klondike deal has seven piles and a 24-card stock, and replays from its seed", () => {
  const g = dealKlondike(123);
  assert.deepEqual(g.tab.map((p) => p.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(g.tab.every((p) => p.at(-1)?.up && p.slice(0, -1).every((c) => !c.up)));
  assert.equal(g.stock.length, 24);
  assert.deepEqual(dealKlondike(123), g);
});

test("drawing turns cards over and recycles the waste", () => {
  let g = dealKlondike(5, 3);
  g = drawStock(g);
  assert.equal(g.waste.length, 3);
  assert.ok(g.waste.every((c) => c.up));
  for (let i = 0; i < 7; i++) g = drawStock(g);
  assert.equal(g.stock.length, 0);
  g = drawStock(g);
  assert.equal(g.stock.length, 24);
  assert.equal(g.waste.length, 0);
});

test("moves follow the rules and turn over the uncovered card", () => {
  const g: Klondike = {
    stock: [],
    waste: [card("H", 1)],
    found: [[], [], [], []],
    tab: [[card("S", 9, false), card("S", 7)], [card("H", 8)], [], [], [], [], []],
    draw: 1,
    moves: 0,
  };
  assert.equal(moveCards(g, { pile: "tab", i: 0, at: 1 }, { pile: "tab", i: 2 }), null);
  const next = moveCards(g, { pile: "tab", i: 0, at: 1 }, { pile: "tab", i: 1 });
  assert.ok(next);
  assert.equal(next.tab[1].length, 2);
  assert.equal(next.tab[0][0].up, true);
  assert.deepEqual(bestMove(g, { pile: "waste" }), { pile: "found", i: 0 });
  const done = autoStep(g);
  assert.equal(done?.found[0].length, 1);
  assert.equal(klondikeWon(g), false);
});

import { c4, c4Empty, bestMove as aiMove, ttt, type Cells } from "./board.ts";
import { dealFreeCell, fcBest, fcMove, maxRun } from "./cards.ts";
import { canMove, move as mergeMove, slideLine, spawn } from "./merge.ts";
import { newWorld, tick, type P as Pt, type Snake as SnakeT, type World } from "./snakes.ts";

test("FreeCell deal 1 matches the classic layout", () => {
  const g = dealFreeCell(1);
  const label = (c: Card) => `${["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"][c.rank - 1]}${c.suit}`;
  assert.deepEqual(g.tab.map((p) => label(p[0])), ["JD", "2D", "9H", "JC", "5D", "7H", "7C", "5H"]);
  assert.deepEqual(g.tab.map((p) => p.length), [7, 7, 7, 7, 6, 6, 6, 6]);
});

test("FreeCell limits runs by free cells and empty columns", () => {
  const g = dealFreeCell(1);
  assert.equal(maxRun(g, false), 5);
  const parked = fcMove(g, { pile: "tab", i: 0, at: 6 }, { pile: "cell", i: 0 });
  assert.ok(parked);
  assert.equal(maxRun(parked, false), 4);
  assert.ok(fcBest(g, { pile: "tab", i: 0, at: 6 }));
});

test("the tic-tac-toe computer takes a win and blocks a loss", () => {
  // X (1) to play can win on 2; O (-1) to play must block 2.
  const win: Cells = [1, 1, 0, -1, -1, 0, 0, 0, 0];
  assert.equal(aiMove(ttt, win, 9), 2);
  const block: Cells = [1, 1, 0, -1, 0, 0, 0, 0, 0];
  assert.equal(aiMove(ttt, block, 9), 2);
});

test("perfect tic-tac-toe against itself is always a draw", () => {
  let s: Cells = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  while (ttt.winner(s) === null) s = ttt.play(s, aiMove(ttt, s, 9) as number);
  assert.equal(ttt.winner(s), 0);
});

test("Connect Four finds a winning column and spots four in a row", () => {
  let s = c4Empty();
  for (const m of [0, 6, 1, 6, 2]) s = c4.play(s, m);
  // Player 1 has three along the bottom and player -1 must block column 3.
  assert.equal(aiMove(c4, s, 4), 3);
  const won = c4.play(c4.play(s, 5), 3);
  assert.equal(c4.winner(won), 1);
});

test("merge slides, combines each pair once and knows when it is stuck", () => {
  assert.deepEqual(slideLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], points: 8 });
  assert.deepEqual(slideLine([0, 4, 4, 8]), { line: [8, 8, 0, 0], points: 8 });
  const r = mergeMove([2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "right");
  assert.equal(r.grid[3], 4);
  assert.equal(r.moved, true);
  assert.equal(canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]), false);
});

test("doubled 2048 spawns eights and sixteens", () => {
  const rand = mulberry32(3);
  for (let i = 0; i < 20; i++) {
    const g = spawn(Array(16).fill(0), rand, 8);
    assert.ok(g.every((v) => v === 0 || v === 8 || v === 16));
  }
});

const R: Pt = { x: 1, y: 0 };
const L: Pt = { x: -1, y: 0 };
const U: Pt = { x: 0, y: -1 };
const sn = (cells: [number, number][], dir: Pt): SnakeT => ({ body: cells.map(([x, y]) => ({ x, y })), dir, grow: 0, alive: true, wait: 0 });
const world = (...snakes: SnakeT[]): World => ({ snakes, food: [], score: 0, over: null });

test("snake keeps one honey fewer than there are snakes", () => {
  assert.equal(newWorld(1, mulberry32(1)).food.length, 1);
  assert.equal(newWorld(2, mulberry32(1)).food.length, 2);
  assert.equal(newWorld(2, mulberry32(1)).snakes.length, 3);
});

test("a head through a rival's body bites off everything behind the armour", () => {
  const you = sn([[5, 5], [4, 5], [3, 5]], R);
  const rival = sn([[6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6]], U);
  const w = world(you, rival);
  tick(w, [R, U], 100, mulberry32(1));
  assert.equal(w.over, null);
  assert.equal(rival.body.length, 5);
  assert.equal(w.score, 1);
  assert.equal(you.grow, 1);
});

test("running into armour or a rival's head ends the game", () => {
  const armour = world(sn([[5, 5], [4, 5], [3, 5]], R), sn([[6, 4], [6, 5], [6, 6]], U));
  tick(armour, [R, U], 100, mulberry32(1));
  assert.equal(armour.over, "armour");
  const head = world(sn([[5, 5], [4, 5], [3, 5]], R), sn([[7, 5], [8, 5], [9, 5]], L));
  tick(head, [R, L], 100, mulberry32(1));
  assert.equal(head.over, "head");
});

test("rivals that meet head on: the longer one lives", () => {
  const long = sn([[10, 10], [11, 10], [12, 10], [13, 10]], L);
  const short = sn([[8, 10], [7, 10], [6, 10]], R);
  const w = world(sn([[2, 2], [1, 2], [0, 2]], R), long, short);
  tick(w, [R, L, R], 100, mulberry32(1));
  assert.equal(w.over, null);
  assert.equal(long.alive, true);
  assert.equal(short.alive, false);
});
