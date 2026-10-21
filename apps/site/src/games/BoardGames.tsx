// Connect Four against the board engine's computer, which looks a few moves ahead on Hard.
// You play first, as the accent colour.
import { Button, Segmented } from "@lupinos/ui";
import { type CSSProperties, useEffect, useState } from "react";
import { bestMove, C4_COLS, C4_ROWS, c4, c4Empty, c4Win, type Columns } from "./board";
import { bestOf, finish, GameBar, type GameProps, Panel } from "./Shell";

type Level = "easy" | "hard";

function useComputer<S>(state: S, myTurn: boolean, over: boolean, move: () => void) {
  useEffect(() => {
    if (myTurn || over) return;
    const t = setTimeout(move, 420);
    return () => clearTimeout(t);
    // biome-ignore lint/correctness/useExhaustiveDependencies: the computer answers each new position
  }, [state, myTurn, over]);
}

export function ConnectFour(_: GameProps) {
  const [level, setLevel] = useState<Level>("hard");
  const [s, setS] = useState<Columns>(c4Empty);
  const w = c4.winner(s);
  const line = c4Win(s)?.cells ?? [];
  useComputer(s, c4.turn(s) === 1, w !== null, () => {
    const m = bestMove(c4, s, level === "hard" ? 6 : 2);
    if (m !== undefined) setS(c4.play(s, m));
  });
  useEffect(() => {
    if (w === 1) finish("c4-wins", (bestOf("c4-wins") ?? 0) + 1, { won: true });
    // biome-ignore lint/correctness/useExhaustiveDependencies: once per game
  }, [w]);
  const drop = (c: number) => w === null && c4.turn(s) === 1 && s[c].length < C4_ROWS && setS(c4.play(s, c));
  return (
    <div className="game board-game">
      <GameBar>
        <Segmented label="Level" value={level} onChange={(l) => (setLevel(l), setS(c4Empty()))} options={[{ value: "easy", label: "Easy" }, { value: "hard", label: "Hard" }]} />
        <span className="muted">Wins {bestOf("c4-wins") ?? 0}</span>
        <Button onClick={() => setS(c4Empty())}>New game</Button>
      </GameBar>
      <div className="board-stage">
        <div className="c4" role="grid" aria-label="Connect Four" style={{ "--cols": C4_COLS } as CSSProperties}>
          {Array.from({ length: C4_COLS }, (_, c) => (
            <button key={c} type="button" className="c4-col" aria-label={`Drop in column ${c + 1}`} onClick={() => drop(c)} disabled={w !== null || s[c].length >= C4_ROWS}>
              {Array.from({ length: C4_ROWS }, (_, r) => {
                const v = s[c][C4_ROWS - 1 - r];
                const row = C4_ROWS - 1 - r;
                return <i key={r} data-v={v || undefined} data-line={line.some(([x, y]) => x === c && y === row) || undefined} style={{ "--fall": C4_ROWS - row } as CSSProperties} />;
              })}
            </button>
          ))}
        </div>
        {w !== null && (
          <Panel title={w === 1 ? "Four in a row" : w === -1 ? "The hive connects" : "Board full"}>
            <Button variant="primary" onClick={() => setS(c4Empty())}>
              Again
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
