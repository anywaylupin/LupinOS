// The arcade, laid out like a game launcher: a featured game up top (today's pick, or the one you
// chose), genre tabs, the library as cover tiles, and a shelf of games that are coming soon.
import { Button } from "@lupinos/ui";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from "react";
import { COMING_SOON, GAMES, type GameDef, GENRES, type Genre, gameById } from "../games/list";
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

/** Cover art: one line drawing per game, white on the game's own colour. */
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
  sudoku: <path d="M8 8h32v32H8zM18.7 8v32M29.3 8v32M8 18.7h32M8 29.3h32" />,
  mahjong: (
    <>
      <path d="M10 14h14v20H10zM20 10h14v20H20z" />
      <circle cx="27" cy="20" r="3" />
    </>
  ),
  breakout: (
    <>
      <path d="M8 10h9v5H8zM19.5 10h9v5h-9zM31 10h9v5h-9zM13.5 18h9v5h-9zM25 18h9v5h-9z" />
      <circle cx="26" cy="31" r="2.5" />
      <path d="M16 40h16" />
    </>
  ),
  stack: <path d="M10 30h9v9h-9zM19 30h9v9h-9zM19 21h9v9h-9zM28 21h9v9h-9zM24 8h9v9h-9z" />,
  pinball: (
    <>
      <circle cx="30" cy="14" r="4" />
      <path d="M10 38l10-4M38 38l-10-4M12 8v18M36 8v18" />
      <circle cx="18" cy="20" r="2.5" />
    </>
  ),
  chess: <path d="M17 40h16M19 40l1-8h8l1 8M20 32c-4-4-3-10 1-14l-3-4 6-2c6 0 9 5 8 11l-2 3 1 6" />,
};

const bestLine = (g: GameDef, scores: Record<string, number>) => {
  const vals = g.keys.map((k) => scores[k]).filter((v) => v !== undefined);
  if (!vals.length) return "New";
  if (g.score === "time") return `Best ${fmtTime(Math.min(...vals))}`;
  if (g.score === "moves") return `Best ${Math.min(...vals)} moves`;
  if (g.score === "wins") return `${Math.max(...vals)} wins`;
  return `Best ${Math.max(...vals)}`;
};

const hue = (h: number) => ({ "--h": h }) as CSSProperties;
/** Today's pick: the same game for everyone today, a different one tomorrow. */
const todays = GAMES[Math.floor(Date.now() / 864e5) % GAMES.length];

export default function Games() {
  const sess = os.useSession();
  const scores = sess?.scores ?? {};
  const [genre, setGenre] = useState<Genre | "All">("All");
  const [pick, setPick] = useState(todays.id);
  const [board, setBoard] = useState(false);
  const g = gameById(pick) ?? todays;
  const play = (x: GameDef, daily = false) => os.open("game", { arg: daily ? `${x.id}:daily` : x.id, title: daily ? `${x.name} · Daily` : x.name });
  const shown = (genreOf: Genre) => genre === "All" || genre === genreOf;
  const library = GAMES.filter((x) => shown(x.genre));
  const soon = COMING_SOON.filter((x) => shown(x.genre));
  return (
    <div className="hub">
      <section className="hub-hero" style={hue(g.hue)} aria-label={`Featured: ${g.name}`}>
        <div className="hub-art">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            {glyphs[g.id]}
          </svg>
        </div>
        <div className="hub-hero-text">
          <span className="hub-kicker">
            {g.id === todays.id ? "Today's pick" : "Selected"} · {g.genre}
          </span>
          <h2>{g.name}</h2>
          <p>{g.blurb}</p>
          <div className="hub-actions">
            <Button variant="primary" onClick={() => play(g)}>
              Play
            </Button>
            {g.daily && <Button onClick={() => play(g, true)}>Daily challenge</Button>}
            {online && (
              <Button variant="plain" onClick={() => setBoard(!board)}>
                {board ? "Hide leaderboard" : "Leaderboard"}
              </Button>
            )}
            <span className="hub-best">{bestLine(g, scores)}</span>
          </div>
          {board && <Board key={g.id} game={g} keyName={g.keys[0]} mine={scores[g.keys[0]]} />}
        </div>
      </section>

      <div className="hub-tabs" role="tablist" aria-label="Genres">
        {(["All", ...GENRES] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={genre === x} onClick={() => setGenre(x)}>
            {x}
          </button>
        ))}
      </div>

      <h3 className="hub-h">
        Library <small>{library.length}</small>
      </h3>
      <div className="hub-grid">
        {library.map((x, i) => (
          <button
            key={x.id}
            type="button"
            className="hub-tile"
            aria-pressed={x.id === pick}
            title={`${x.name}: select, or double-click to play`}
            style={{ ...hue(x.hue), "--i": i } as CSSProperties}
            onClick={() => setPick(x.id)}
            onDoubleClick={() => play(x)}
          >
            <span className="hub-cover">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                {glyphs[x.id]}
              </svg>
              {x.daily && <b className="hub-badge">Daily</b>}
            </span>
            <span className="hub-name">{x.name}</span>
            <span className="hub-sub">{bestLine(x, scores)}</span>
          </button>
        ))}
      </div>

      {soon.length > 0 && (
        <>
          <h3 className="hub-h">
            Coming soon <small>{soon.length}</small>
          </h3>
          <div className="hub-grid">
            {soon.map((x, i) => (
              <div key={x.id} className="hub-tile" data-soon aria-disabled="true" style={{ ...hue(x.hue), "--i": i } as CSSProperties}>
                <span className="hub-cover">
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    {glyphs[x.id]}
                  </svg>
                  <b className="hub-badge">Soon</b>
                </span>
                <span className="hub-name">{x.name}</span>
                <span className="hub-sub">{x.blurb}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
