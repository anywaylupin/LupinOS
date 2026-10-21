// The arcade: every game with its best score, a Play button and, for some, today's shared deal.
import { Button } from "@lupinos/ui";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { GAMES, type GameDef } from "../games/list";
import { fmtTime } from "../games/Shell";
import { type BoardRow, leaderboard, online, submitScore } from "../os/net";
import * as os from "../os/store";

/** The public board for one score key: names only, fetched from the API when it is configured. */
function Board({ game, keyName, mine }: { game: GameDef; keyName: string; mine?: number }) {
  const [rows, setRows] = useState<BoardRow[] | null | undefined>(undefined);
  const [posted, setPosted] = useState(false);
  const user = os.userById(os.useOS((s) => s.current));
  const load = useCallback(() => leaderboard(keyName).then((r) => setRows(r?.scores ?? null)), [keyName]);
  useEffect(() => {
    void load();
  }, [load]);
  if (rows === undefined) return <p className="board-note">Waking the server…</p>;
  if (rows === null) return <p className="board-note">The leaderboard server is offline.</p>;
  const fmt = (v: number) => (game.score === "time" ? fmtTime(v) : String(v));
  return (
    <div className="board">
      <ol>
        {rows.length ? rows.slice(0, 5).map((r, i) => <li key={`${r.name}-${i}`}><span>{r.name}</span><b>{fmt(r.score)}</b></li>) : <li className="board-note">No scores yet. Be the first.</li>}
      </ol>
      {mine !== undefined && !posted && (
        <button
          type="button"
          className="lui-button"
          data-variant="plain"
          onClick={async () => {
            if (await submitScore(keyName, user?.name ?? "Guest", mine)) {
              setPosted(true);
              void load();
            }
          }}
        >
          Post my best ({fmt(mine)}) as {user?.name ?? "Guest"}
        </button>
      )}
    </div>
  );
}

const glyphs: Record<string, ReactNode> = {
  mines: (
    <>
      <circle cx="24" cy="26" r="9" />
      <path d="M24 11v6M24 35v6M9 26h6M33 26h6M13.5 15.5l4 4M30.5 32.5l4 4M13.5 36.5l4-4M30.5 19.5l4-4" />
    </>
  ),
  klondike: (
    <>
      <path d="M12 14l14-4 6 22-14 4z" />
      <path d="M22 12l14 2-3 24-14-2z" />
    </>
  ),
  snake: <path d="M10 34h10a6 6 0 0 0 0-12h-4a6 6 0 0 1 0-12h18" />,
  freecell: (
    <>
      <path d="M8 12h12v16H8zM28 12h12v16H28z" />
      <path d="M14 34v4M34 34v4M10 40h28" />
    </>
  ),
  merge: (
    <>
      <path d="M9 9h13v13H9zM26 9h13v13H26zM9 26h13v13H9z" />
      <path d="M26 32h13M32.5 26v13" />
    </>
  ),
  lights: (
    <>
      <circle cx="16" cy="16" r="5" />
      <circle cx="32" cy="16" r="5" />
      <circle cx="16" cy="32" r="5" />
      <circle cx="32" cy="32" r="5" />
    </>
  ),
  c4: (
    <>
      <path d="M8 10v30h32V10" />
      <circle cx="16" cy="33" r="4" />
      <circle cx="24" cy="33" r="4" />
      <circle cx="32" cy="25" r="4" />
    </>
  ),
  flappy: (
    <>
      <ellipse cx="24" cy="27" rx="10" ry="8" />
      <path d="M20 20c-2-6-8-8-10-4M28 20c2-6 8-8 10-4M22 20v14M27 20v14" />
    </>
  ),
};

const bestLine = (g: GameDef, scores: Record<string, number>) => {
  const vals = g.keys.map((k) => scores[k]).filter((v) => v !== undefined);
  if (!vals.length) return "No score yet";
  if (g.score === "time") return `Best ${fmtTime(Math.min(...vals))}`;
  if (g.score === "moves") return `Best ${Math.min(...vals)} moves`;
  if (g.score === "wins") return `${Math.max(...vals)} wins`;
  return `Best ${Math.max(...vals)}`;
};

export default function Games() {
  const sess = os.useSession();
  const [open, setOpen] = useState<string | null>(null);
  const scores = sess?.scores ?? {};
  const play = (g: GameDef, daily = false) => os.open("game", { arg: daily ? `${g.id}:daily` : g.id, title: daily ? `${g.name} · Daily` : g.name });
  return (
    <div className="arcade-list">
      <header>
        <h2>Arcade</h2>
        <p className="muted">Scores stay with your profile. Daily rounds are the same for everyone today.</p>
      </header>
      <div className="arcade-grid">
        {GAMES.map((g) => (
          <article key={g.id} className="arcade-card">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              {glyphs[g.id]}
            </svg>
            <div>
              <h3>{g.name}</h3>
              <p>{g.blurb}</p>
              <small>{bestLine(g, scores)}</small>
            </div>
            <div className="arcade-actions">
              <Button variant="primary" onClick={() => play(g)}>
                Play
              </Button>
              {g.daily && <Button onClick={() => play(g, true)}>Daily</Button>}
              {online && (
                <Button variant="plain" onClick={() => setOpen(open === g.id ? null : g.id)}>
                  {open === g.id ? "Hide board" : "Board"}
                </Button>
              )}
            </div>
            {open === g.id && <Board game={g} keyName={g.keys[0]} mine={scores[g.keys[0]]} />}
          </article>
        ))}
      </div>
    </div>
  );
}
