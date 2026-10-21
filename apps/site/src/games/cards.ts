// The card engine: a deck, the stacking rules every solitaire shares, and Klondike on top.
// Pure functions over plain objects, so moves are easy to test and to undo.
import { mulberry32, shuffle } from "./rng.ts";

export type Suit = "S" | "H" | "D" | "C";
export type Card = { id: string; suit: Suit; rank: number; up: boolean };

export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const SUIT_GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const isRed = (s: Suit) => s === "H" || s === "D";
export const rankLabel = (c: Card) => RANKS[c.rank - 1];

export const deck = (): Card[] => SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({ id: `${suit}${i + 1}`, suit, rank: i + 1, up: false })));

/** Alternating colours, one rank down. An empty pile takes `emptyRank` (a King in Klondike). */
export function canStack(card: Card, onto: Card | undefined, emptyRank: number | null = 13) {
  if (!onto) return emptyRank === null || card.rank === emptyRank;
  return onto.up && isRed(card.suit) !== isRed(onto.suit) && card.rank === onto.rank - 1;
}

/** Same suit, one rank up, starting from the Ace. */
export function canFound(card: Card, pile: Card[]) {
  const top = pile.at(-1);
  return top ? top.suit === card.suit && card.rank === top.rank + 1 : card.rank === 1;
}

// ---- Klondike ----------------------------------------------------------------------------------

export type Klondike = { stock: Card[]; waste: Card[]; found: Card[][]; tab: Card[][]; draw: 1 | 3; moves: number };
export type From = { pile: "waste" } | { pile: "found"; i: number } | { pile: "tab"; i: number; at: number };
export type To = { pile: "found"; i: number } | { pile: "tab"; i: number };

/** Seven piles of one to seven cards with the top card face up; the rest is the stock. */
export function dealKlondike(seed: number, draw: 1 | 3 = 1): Klondike {
  const cards = shuffle(deck(), mulberry32(seed));
  const tab: Card[][] = [];
  let k = 0;
  for (let i = 0; i < 7; i++) {
    tab.push(cards.slice(k, k + i + 1).map((c, j) => ({ ...c, up: j === i })));
    k += i + 1;
  }
  return { stock: cards.slice(k), waste: [], found: [[], [], [], []], tab, draw, moves: 0 };
}

const clone = (g: Klondike): Klondike => ({ ...g, stock: [...g.stock], waste: [...g.waste], found: g.found.map((p) => [...p]), tab: g.tab.map((p) => [...p]) });

/** Turns one or three cards from the stock, or turns the waste back over when the stock is empty. */
export function drawStock(g: Klondike): Klondike {
  if (!g.stock.length) {
    if (!g.waste.length) return g;
    return { ...g, stock: [...g.waste].reverse().map((c) => ({ ...c, up: false })), waste: [], moves: g.moves + 1 };
  }
  const n = Math.min(g.draw, g.stock.length);
  const taken = g.stock.slice(-n).reverse().map((c) => ({ ...c, up: true }));
  return { ...g, stock: g.stock.slice(0, -n), waste: [...g.waste, ...taken], moves: g.moves + 1 };
}

/** The cards a move would pick up: one from the waste or a foundation, a run from a pile. */
export function pick(g: Klondike, from: From): Card[] {
  if (from.pile === "waste") return g.waste.slice(-1);
  if (from.pile === "found") return g.found[from.i].slice(-1);
  return g.tab[from.i].slice(from.at);
}

/** Moves cards if the rules allow it, and turns over the card left on top. Null if not allowed. */
export function moveCards(g: Klondike, from: From, to: To): Klondike | null {
  const cards = pick(g, from);
  if (!cards.length || !cards[0].up) return null;
  if (from.pile === to.pile && "i" in from && from.i === to.i) return null;
  if (to.pile === "found" ? cards.length !== 1 || !canFound(cards[0], g.found[to.i]) : !canStack(cards[0], g.tab[to.i].at(-1))) return null;
  const next = clone(g);
  if (from.pile === "waste") next.waste.pop();
  else if (from.pile === "found") next.found[from.i].pop();
  else {
    next.tab[from.i] = next.tab[from.i].slice(0, from.at);
    const top = next.tab[from.i].at(-1);
    if (top && !top.up) next.tab[from.i][next.tab[from.i].length - 1] = { ...top, up: true };
  }
  if (to.pile === "found") next.found[to.i].push(cards[0]);
  else next.tab[to.i].push(...cards);
  next.moves = g.moves + 1;
  return next;
}

/** Where a click sends a card: a foundation first, then a pile with cards, then an empty pile. */
export function bestMove(g: Klondike, from: From): To | null {
  const cards = pick(g, from);
  if (!cards.length || !cards[0].up) return null;
  if (cards.length === 1 && from.pile !== "found") {
    const i = g.found.findIndex((p) => canFound(cards[0], p));
    if (i >= 0) return { pile: "found", i };
  }
  const piles = g.tab.map((p, i) => ({ p, i })).filter(({ i }) => !(from.pile === "tab" && from.i === i));
  const hit = piles.find(({ p }) => p.length && canStack(cards[0], p.at(-1))) ?? piles.find(({ p }) => !p.length && canStack(cards[0], undefined));
  // A King already at the bottom of a pile gains nothing by moving to another empty pile.
  if (hit && !hit.p.length && from.pile === "tab" && from.at === 0) return null;
  return hit ? { pile: "tab", i: hit.i } : null;
}

export const won = (g: Klondike) => g.found.every((p) => p.length === 13);

/** Everything is face up and the stock is gone, so the rest can play itself. */
export const canAutoFinish = (g: Klondike) => !g.stock.length && !g.waste.length && g.tab.every((p) => p.every((c) => c.up));

/** One automatic step towards the finish: the lowest card that fits a foundation. */
export function autoStep(g: Klondike): Klondike | null {
  let best: { from: From; rank: number } | null = null;
  g.tab.forEach((p, i) => {
    const c = p.at(-1);
    if (c && g.found.some((f) => canFound(c, f)) && (!best || c.rank < best.rank)) best = { from: { pile: "tab", i, at: p.length - 1 }, rank: c.rank };
  });
  const w = g.waste.at(-1);
  if (w && g.found.some((f) => canFound(w, f)) && (!best || w.rank < (best as { rank: number }).rank)) best = { from: { pile: "waste" }, rank: w.rank };
  if (!best) return null;
  const to = bestMove(g, (best as { from: From }).from);
  return to ? moveCards(g, (best as { from: From }).from, to) : null;
}

// ---- FreeCell ---------------------------------------------------------------------------------------

export type FreeCell = { cells: (Card | null)[]; found: Card[][]; tab: Card[][]; moves: number; deal: number };
export type FcFrom = { pile: "cell"; i: number } | { pile: "found"; i: number } | { pile: "tab"; i: number; at: number };
export type FcTo = { pile: "cell"; i: number } | { pile: "found"; i: number } | { pile: "tab"; i: number };

/**
 * The classic numbered deal: the same shuffle the old desktop FreeCell used, so "deal 1" is the
 * same layout everywhere and players can share deal numbers.
 */
export function dealFreeCell(deal: number): FreeCell {
  let state = deal >>> 0;
  const rand = () => {
    state = (state * 214013 + 2531011) & 0x7fffffff;
    return state >> 16;
  };
  const order: Suit[] = ["C", "D", "H", "S"];
  const deck = Array.from({ length: 52 }, (_, i) => i);
  const tab: Card[][] = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < 52; i++) {
    const left = 52 - i;
    const j = rand() % left;
    const c = deck[j];
    deck[j] = deck[left - 1];
    const suit = order[c % 4];
    const rank = Math.floor(c / 4) + 1;
    tab[i % 8].push({ id: `${suit}${rank}`, suit, rank, up: true });
  }
  return { cells: [null, null, null, null], found: [[], [], [], []], tab, moves: 0, deal };
}

const fcClone = (g: FreeCell): FreeCell => ({ ...g, cells: [...g.cells], found: g.found.map((p) => [...p]), tab: g.tab.map((p) => [...p]) });

/** A run that can move together: alternating colours, each one rank lower. */
export const isRun = (cards: Card[]) => cards.every((c, i) => i === 0 || canStack(c, cards[i - 1], null));

/** How many cards can move at once with the free cells and empty columns available. */
export function maxRun(g: FreeCell, toEmpty: boolean) {
  const free = g.cells.filter((c) => !c).length;
  const empty = g.tab.filter((p) => !p.length).length - (toEmpty ? 1 : 0);
  return (free + 1) * 2 ** Math.max(0, empty);
}

export function fcPick(g: FreeCell, from: FcFrom): Card[] {
  if (from.pile === "cell") return g.cells[from.i] ? [g.cells[from.i] as Card] : [];
  if (from.pile === "found") return g.found[from.i].slice(-1);
  return g.tab[from.i].slice(from.at);
}

export function fcMove(g: FreeCell, from: FcFrom, to: FcTo): FreeCell | null {
  const cards = fcPick(g, from);
  if (!cards.length || (from.pile === to.pile && from.i === to.i)) return null;
  if (to.pile === "cell" && (cards.length !== 1 || g.cells[to.i])) return null;
  if (to.pile === "found" && (cards.length !== 1 || !canFound(cards[0], g.found[to.i]))) return null;
  if (to.pile === "tab") {
    const pile = g.tab[to.i];
    if (!isRun(cards) || cards.length > maxRun(g, !pile.length) || !canStack(cards[0], pile.at(-1), null)) return null;
  }
  const next = fcClone(g);
  if (from.pile === "cell") next.cells[from.i] = null;
  else if (from.pile === "found") next.found[from.i].pop();
  else next.tab[from.i] = next.tab[from.i].slice(0, from.at);
  if (to.pile === "cell") next.cells[to.i] = cards[0];
  else if (to.pile === "found") next.found[to.i].push(cards[0]);
  else next.tab[to.i].push(...cards);
  next.moves = g.moves + 1;
  return next;
}

/** Where a click sends cards: foundation, a pile with cards, an empty pile, then a free cell. */
export function fcBest(g: FreeCell, from: FcFrom): FcTo | null {
  const cards = fcPick(g, from);
  if (!cards.length) return null;
  const tries: FcTo[] = [
    ...g.found.map((_, i) => ({ pile: "found" as const, i })),
    ...g.tab.flatMap((p, i) => (p.length ? [{ pile: "tab" as const, i }] : [])),
    ...g.tab.flatMap((p, i) => (p.length ? [] : [{ pile: "tab" as const, i }])),
    ...(from.pile === "cell" ? [] : g.cells.map((_, i) => ({ pile: "cell" as const, i }))),
  ];
  return tries.find((to) => fcMove(g, from, to)) ?? null;
}

/** Moves cards home while it is safe: nothing of the other colour could still need them. */
export function fcAutoStep(g: FreeCell): FreeCell | null {
  const height = (suit: Suit) => g.found.find((p) => p[0]?.suit === suit)?.length ?? 0;
  const safe = (c: Card) => c.rank <= 2 || SUITS.filter((s) => isRed(s) !== isRed(c.suit)).every((s) => height(s) >= c.rank - 1);
  const sources: FcFrom[] = [...g.cells.map((_, i) => ({ pile: "cell" as const, i })), ...g.tab.map((p, i) => ({ pile: "tab" as const, i, at: p.length - 1 }))];
  for (const from of sources) {
    const [c] = fcPick(g, from);
    if (!c || !safe(c)) continue;
    const i = g.found.findIndex((p) => canFound(c, p));
    if (i >= 0) return fcMove(g, from, { pile: "found", i });
  }
  return null;
}

export const fcWon = (g: FreeCell) => g.found.every((p) => p.length === 13);
