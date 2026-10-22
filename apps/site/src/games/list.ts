// Every game in the arcade. Each one loads only when its window first opens.
import { type ComponentType, lazy } from "react";
import type { GameProps } from "./Shell";

/** Lazy loads one named component from a module that holds several games. */
const named = (load: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType<GameProps> })));

export type Genre = "Puzzle" | "Cards" | "Arcade" | "Board";
export const GENRES: Genre[] = ["Puzzle", "Cards", "Arcade", "Board"];

export type GameDef = {
  id: string;
  name: string;
  blurb: string;
  genre: Genre;
  /** The cover art's hue, 0–360. */
  hue: number;
  /** How the best score reads: a time or moves (lower wins), points or wins. */
  score: "time" | "points" | "moves" | "wins";
  /** Offers the shared daily deal or field. */
  daily?: boolean;
  /** The score keys this game saves under, for the best-score line. */
  keys: string[];
  Component: ComponentType<GameProps>;
};

export const GAMES: GameDef[] = [
  { id: "mines", name: "Minesweeper", blurb: "Clear the field without waking a mine.", genre: "Puzzle", hue: 205, score: "time", daily: true, keys: ["mines-easy", "mines-medium", "mines-hard"], Component: lazy(() => import("./Minesweeper")) },
  { id: "klondike", name: "Solitaire", blurb: "Klondike rules. Draw one or three.", genre: "Cards", hue: 150, score: "time", daily: true, keys: ["klondike"], Component: lazy(() => import("./Klondike")) },
  { id: "snake", name: "Snake", blurb: "Rival snakes. Cut their tails, never touch their heads.", genre: "Arcade", hue: 95, score: "points", keys: ["snake-1", "snake-2"], Component: lazy(() => import("./Snake")) },
  { id: "flappy", name: "Flappy", blurb: "One button. Many hives. No mercy.", genre: "Arcade", hue: 42, score: "points", keys: ["flappy"], Component: lazy(() => import("./Flappy")) },
  { id: "freecell", name: "FreeCell", blurb: "Every deal numbered, so good ones can be shared.", genre: "Cards", hue: 175, score: "time", daily: true, keys: ["freecell"], Component: lazy(() => import("./FreeCell")) },
  { id: "merge", name: "2048", blurb: "Slide tiles, combine equals, aim for 2048. Or start at 8.", genre: "Puzzle", hue: 25, score: "points", keys: ["merge", "merge-double"], Component: named(() => import("./Puzzles"), "Merge") },
  { id: "lights", name: "Lights Out", blurb: "Every press flips a cross. Turn them all off.", genre: "Puzzle", hue: 280, score: "moves", keys: ["lights"], Component: named(() => import("./Puzzles"), "LightsOut") },
  { id: "c4", name: "Connect Four", blurb: "Drop discs, line up four before the hive does.", genre: "Board", hue: 350, score: "wins", keys: ["c4-wins"], Component: named(() => import("./BoardGames"), "ConnectFour") },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

/** On the shelf, not yet playable. */
export type SoonDef = { id: string; name: string; blurb: string; genre: Genre; hue: number };
export const COMING_SOON: SoonDef[] = [
  { id: "sudoku", name: "Sudoku", blurb: "Nine boxes, nine digits, no guessing.", genre: "Puzzle", hue: 220 },
  { id: "mahjong", name: "Mahjong Solitaire", blurb: "Match the free tiles until the table is clear.", genre: "Cards", hue: 160 },
  { id: "breakout", name: "Breakout", blurb: "Bounce, break, repeat. The bricks are honeycomb.", genre: "Arcade", hue: 330 },
  { id: "stack", name: "Blocks", blurb: "Falling blocks that fit, if you are quick.", genre: "Arcade", hue: 262 },
  { id: "pinball", name: "Pinball", blurb: "Flippers, bumpers and one very stubborn ball.", genre: "Arcade", hue: 12 },
  { id: "chess", name: "Chess", blurb: "Sixty-four squares against the hive.", genre: "Board", hue: 35 },
];
