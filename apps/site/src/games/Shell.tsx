// Pieces every game shares: the props a game gets, a timer, the pause and game-over panels, and
// one place that records scores and tells the rest of the OS about wins.
import { useEffect, useState, type ReactNode } from "react";
import "./games.css";
import { emit } from "../os/bus";
import * as os from "../os/store";

export type GameProps = {
  /** False while another window is in front. Games pause themselves. */
  focused: boolean;
  /** Today's shared seed instead of a random one. */
  daily: boolean;
};

/** Seconds since `running` became true, paused while it is false. */
export function useElapsed(running: boolean, reset: unknown) {
  const [s, setS] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new game resets the clock
  useEffect(() => setS(0), [reset]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return s;
}

export { fmtTime } from "../os/ui";

/** Saves the score, announces it, and returns whether it beat the old best. */
export function finish(game: string, score: number, { lower = false, won = false } = {}) {
  const best = os.recordScore(game, score, lower);
  emit({ type: "game-score", game, score, best });
  if (won) emit({ type: "game-won", game, score });
  if (best && score > 0) os.notify("New personal best", "The hive has updated your file.");
  return best;
}

export const bestOf = (game: string) => os.session()?.scores[game];

export function GameBar({ children }: { children: ReactNode }) {
  return <div className="game-bar">{children}</div>;
}

export function Panel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="game-panel" role="status">
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}

export function Paused({ show }: { show: boolean }) {
  return show ? (
    <Panel title="Paused">
      <p>Click the window to carry on.</p>
    </Panel>
  ) : null;
}
