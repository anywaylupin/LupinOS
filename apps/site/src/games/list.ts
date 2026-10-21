// Every game in the arcade. Each one loads only when its window first opens.
import { type ComponentType, lazy } from "react";
import type { GameProps } from "./Shell";

/** Lazy loads one named component from a module that holds several games. */
const named = (load: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType<GameProps> })));

export type GameDef = {
  id: string;
  name: string;
  blurb: string;
  /** How the best score reads: a time or moves (lower wins), points or wins. */
  score: "time" | "points" | "moves" | "wins";
  /** Offers the shared daily deal or field. */
  daily?: boolean;
  /** The score keys this game saves under, for the best-score line. */
  keys: string[];
  Component: ComponentType<GameProps>;
};

export const GAMES: GameDef[] = [
  { id: "mines", name: "Minesweeper", blurb: "Clear the field without waking a mine.", score: "time", daily: true, keys: ["mines-easy", "mines-medium", "mines-hard"], Component: lazy(() => import("./Minesweeper")) },
  { id: "klondike", name: "Klondike", blurb: "The classic solitaire. Draw one or three.", score: "time", daily: true, keys: ["klondike"], Component: lazy(() => import("./Klondike")) },
  { id: "snake", name: "Snake", blurb: "Eat honey, grow longer, stay off the walls.", score: "points", keys: ["snake"], Component: lazy(() => import("./Snake")) },
  { id: "flappy", name: "Flappy Bee", blurb: "One button. Many hives. No mercy.", score: "points", keys: ["flappy"], Component: lazy(() => import("./Flappy")) },
  { id: "freecell", name: "FreeCell", blurb: "Every deal numbered, so good ones can be shared.", score: "time", daily: true, keys: ["freecell"], Component: lazy(() => import("./FreeCell")) },
  { id: "merge", name: "Merge", blurb: "Slide tiles, combine equals, aim for 2048.", score: "points", keys: ["merge"], Component: named(() => import("./Puzzles"), "Merge") },
  { id: "lights", name: "Lights Out", blurb: "Every press flips a cross. Turn them all off.", score: "moves", keys: ["lights"], Component: named(() => import("./Puzzles"), "LightsOut") },
  { id: "c4", name: "Connect Four", blurb: "Drop discs, line up four before the hive does.", score: "wins", keys: ["c4-wins"], Component: named(() => import("./BoardGames"), "ConnectFour") },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
