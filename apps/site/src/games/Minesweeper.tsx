// Minesweeper: left click opens, right click (or F) flags, clicking a satisfied number opens the
// rest of its neighbours. Arrow keys move between cells.
import { Button, Segmented } from "@lupinos/ui";
import { type CSSProperties, type KeyboardEvent, useMemo, useState } from "react";
import { type Board, chord, flagsLeft, LEVELS, type Level, newBoard, reveal, toggleFlag, won } from "./mines";
import { dailySeed, hashSeed, mulberry32 } from "./rng";
import { bestOf, finish, fmtTime, GameBar, type GameProps, Panel, Paused, useElapsed } from "./Shell";

type Status = "ready" | "playing" | "won" | "lost";

export default function Minesweeper({ focused, daily }: GameProps) {
  const [level, setLevel] = useState<Level>("easy");
  const [round, setRound] = useState(0);
  const rand = useMemo(() => mulberry32(daily ? hashSeed(`mines-${level}-${dailySeed()}`) : (Math.random() * 2 ** 32) >>> 0), [daily, level, round]);
  const fresh = () => newBoard(LEVELS[level].w, LEVELS[level].h, LEVELS[level].mines);
  const [board, setBoard] = useState<Board>(fresh);
  const [status, setStatus] = useState<Status>("ready");
  const [lastHit, setLastHit] = useState(-1);
  const seconds = useElapsed(status === "playing" && focused, `${level}-${round}`);
  const key = `mines-${level}${daily ? "-daily" : ""}`;

  const restart = (l: Level = level) => {
    setLevel(l);
    setRound((r) => r + 1);
    setBoard(newBoard(LEVELS[l].w, LEVELS[l].h, LEVELS[l].mines));
    setStatus("ready");
    setLastHit(-1);
  };

  const settle = (next: Board, boom: boolean, at: number) => {
    setBoard(next);
    if (boom) {
      setStatus("lost");
      setLastHit(at);
    } else if (won(next)) {
      setStatus("won");
      finish(key, seconds, { lower: true, won: true });
    } else setStatus("playing");
  };

  const open = (i: number) => {
    if (status === "won" || status === "lost") return;
    const c = board.cells[i];
    const r = c.open ? chord(board, i, rand) : reveal(board, i, rand);
    settle(r.board, r.boom, i);
  };
  const flag = (i: number) => status !== "won" && status !== "lost" && setBoard(toggleFlag(board, i));

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const { w, h } = board;
    const moves: Record<string, number> = { ArrowLeft: i % w ? i - 1 : i, ArrowRight: i % w < w - 1 ? i + 1 : i, ArrowUp: i >= w ? i - w : i, ArrowDown: i < w * (h - 1) ? i + w : i };
    if (e.key in moves) {
      e.preventDefault();
      (e.currentTarget.parentElement?.children[moves[e.key]] as HTMLElement | undefined)?.focus();
    } else if (e.key === "f" || e.key === "F") flag(i);
  };

  const best = bestOf(key);
  return (
    <div className="game mines">
      <GameBar>
        <Segmented
          label="Difficulty"
          value={level}
          onChange={(l) => restart(l)}
          options={[
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Medium" },
            { value: "hard", label: "Hard" },
          ]}
        />
        <span className="led" title="Mines left">
          {String(flagsLeft(board)).padStart(3, "0")}
        </span>
        <span className="led" title="Time">
          {fmtTime(seconds)}
        </span>
        <Button onClick={() => restart()}>New game</Button>
      </GameBar>
      <div className="mines-wrap">
        <div className="mines-grid" role="grid" aria-label="Minefield" style={{ "--w": board.w } as CSSProperties} data-over={status === "lost" || status === "won" || undefined}>
          {board.cells.map((c, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: cells are positions
              key={i}
              type="button"
              role="gridcell"
              className="mine-cell"
              data-open={c.open || undefined}
              data-n={c.open && !c.mine ? c.n : undefined}
              data-mine={c.open && c.mine ? (i === lastHit ? "hit" : "") : undefined}
              data-flag={c.flag || undefined}
              aria-label={c.open ? (c.mine ? "Mine" : c.n ? `${c.n} mines around` : "Empty") : c.flag ? "Flagged" : "Hidden"}
              onClick={() => open(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                flag(i);
              }}
              onKeyDown={(e) => onKey(e, i)}
            >
              {c.open && !c.mine && c.n > 0 ? c.n : ""}
            </button>
          ))}
        </div>
        <Paused show={!focused && status === "playing"} />
        {status === "won" && (
          <Panel title="Field cleared">
            <p>
              {fmtTime(seconds)}
              {best !== undefined && ` · best ${fmtTime(best)}`}
            </p>
            <Button variant="primary" onClick={() => restart()}>
              Play again
            </Button>
          </Panel>
        )}
        {status === "lost" && (
          <Panel title="Boom">
            <p>The hive will deduct this from your wages.</p>
            <Button variant="primary" onClick={() => restart()}>
              Try again
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
