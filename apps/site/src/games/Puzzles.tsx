// Two small puzzles: Merge (slide and combine tiles) and Lights out (turn every light off).
// Turn based, so plain page elements with keyboard support.
import { Button } from "@lupinos/ui";
import { type CSSProperties, useEffect, useState } from "react";
import { useKeys } from "./canvas";
import { canMove, type Dir, type Grid, move, spawn } from "./merge";
import { bestOf, finish, GameBar, type GameProps, Panel } from "./Shell";

// ---- Merge -------------------------------------------------------------------------------------

const KEYS: Record<string, Dir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down" };
const freshGrid = () => spawn(spawn(Array(16).fill(0)));

export function Merge({ focused }: GameProps) {
  const [grid, setGrid] = useState<Grid>(freshGrid);
  const [score, setScore] = useState(0);
  const over = !canMove(grid);
  const go = (d: Dir) => {
    if (over) return;
    const r = move(grid, d);
    if (!r.moved) return;
    setGrid(spawn(r.grid));
    setScore((s) => s + r.points);
  };
  useKeys(focused, (e) => {
    if (KEYS[e.code]) {
      e.preventDefault();
      go(KEYS[e.code]);
    }
  });
  useEffect(() => {
    if (over) finish("merge", score, { won: grid.some((v) => v >= 2048) });
    // biome-ignore lint/correctness/useExhaustiveDependencies: once per game over
  }, [over]);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);
  const restart = () => (setGrid(freshGrid()), setScore(0));
  return (
    <div className="game puzzle">
      <GameBar>
        <span className="led">{score}</span>
        <span className="muted">Best {bestOf("merge") ?? 0}</span>
        <Button onClick={restart}>New game</Button>
      </GameBar>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: swipes for touch screens; arrows work too */}
      <div
        className="board-stage"
        onPointerDown={(e) => setTouch({ x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          if (!touch) return;
          const dx = e.clientX - touch.x;
          const dy = e.clientY - touch.y;
          setTouch(null);
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
          go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        }}
      >
        <div className="merge" role="grid" aria-label={`Merge board, score ${score}`}>
          {grid.map((v, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: sixteen fixed cells
            <div key={i} role="gridcell" className="merge-cell" data-v={v || undefined} style={{ "--t": Math.log2(v || 1) } as CSSProperties}>
              {v || ""}
            </div>
          ))}
        </div>
        {over && (
          <Panel title={`Score ${score}`}>
            <p>No moves left. The tiles have unionised.</p>
            <Button variant="primary" onClick={restart}>
              Again
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}

// ---- Lights out -----------------------------------------------------------------------------------

const N = 5;
/** Starts from a solved board and presses random cells, so every puzzle can be solved. */
function scramble() {
  let b = Array(N * N).fill(false);
  for (let k = 0; k < 10; k++) b = press(b, Math.floor(Math.random() * N * N));
  return b.some(Boolean) ? b : press(b, 12);
}
function press(b: boolean[], i: number) {
  const x = i % N;
  const y = Math.floor(i / N);
  return b.map((on, j) => {
    const jx = j % N;
    const jy = Math.floor(j / N);
    return (jx === x && Math.abs(jy - y) <= 1) || (jy === y && Math.abs(jx - x) <= 1) ? !on : on;
  });
}

export function LightsOut(_: GameProps) {
  const [b, setB] = useState<boolean[]>(scramble);
  const [moves, setMoves] = useState(0);
  const won = b.every((on) => !on);
  useEffect(() => {
    if (won && moves) finish("lights", moves, { lower: true, won: true });
    // biome-ignore lint/correctness/useExhaustiveDependencies: once per win
  }, [won]);
  const restart = () => (setB(scramble()), setMoves(0));
  return (
    <div className="game puzzle">
      <GameBar>
        <span className="led" title="Moves">
          {moves}
        </span>
        <span className="muted">Best {bestOf("lights") ?? "-"}</span>
        <Button onClick={restart}>New puzzle</Button>
      </GameBar>
      <div className="board-stage">
        <div className="lights" role="grid" aria-label="Lights">
          {b.map((on, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
              key={i}
              type="button"
              role="gridcell"
              className="light"
              aria-pressed={on}
              aria-label={`Light ${i + 1}, ${on ? "on" : "off"}`}
              onClick={() => (setB(press(b, i)), setMoves((m) => m + 1))}
              disabled={won}
            />
          ))}
        </div>
        {won && (
          <Panel title={`Lights out in ${moves}`}>
            <p>Energy saved. The hive thanks you.</p>
            <Button variant="primary" onClick={restart}>
              Another
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
