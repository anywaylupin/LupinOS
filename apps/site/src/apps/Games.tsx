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

/** Cover art: a tiny still of each game being played, white on the game's own colour.
 * Classes: f white, b pale tint, d see-through, k dark ink, h a hole, y the rival's yellow. */
const sq = (x: number, y: number, size: number, cls: string) => <rect x={x} y={y} width={size} height={size} rx={1.6} className={cls} />;
const label = (x: number, y: number, text: string, cls: string, size = 7) => (
  <text x={x} y={y} className={cls} fontSize={size}>
    {text}
  </text>
);
const glyphs: Record<string, ReactNode> = {
  mines: (
    <>
      {sq(4, 4, 12, "d")}
      {label(10, 10.5, "1", "f")}
      {sq(18, 4, 12, "d")}
      {label(24, 10.5, "1", "f")}
      {sq(32, 4, 12, "f")}
      <path d="M36.5 14V7.5" className="ks" strokeWidth="1.4" />
      <path d="M36.5 7.5l5 2.2-5 2.2z" className="k" />
      {sq(4, 18, 12, "d")}
      {sq(18, 18, 12, "d")}
      {label(24, 24.5, "2", "f")}
      {sq(32, 18, 12, "f")}
      {sq(4, 32, 12, "d")}
      {label(10, 38.5, "1", "f")}
      {sq(18, 32, 12, "f")}
      {sq(32, 32, 12, "d")}
      <circle cx="38" cy="38" r="3" className="f" />
      <path d="M38 33.5v9M33.5 38h9M34.8 34.8l6.4 6.4M41.2 34.8l-6.4 6.4" strokeWidth="1.4" />
    </>
  ),
  klondike: (
    <>
      <rect x="5" y="12" width="11" height="16" rx="1.6" className="f" />
      <path d="M10.5 17l2 3-2 3-2-3z" className="k" />
      <rect x="18.5" y="10" width="11" height="16" rx="1.6" className="b" />
      <rect x="18.5" y="17" width="11" height="16" rx="1.6" className="f" />
      <path d="M24 22l2 3-2 3-2-3z" className="k" />
      <rect x="32" y="8" width="11" height="16" rx="1.6" className="b" />
      <rect x="32" y="14" width="11" height="16" rx="1.6" className="b" />
      <rect x="32" y="21" width="11" height="16" rx="1.6" className="f" />
      <path d="M37.5 26l2 3-2 3-2-3z" className="k" />
    </>
  ),
  snake: (
    <>
      <path d="M40 6v11h-9" className="ds" strokeWidth="5" />
      <path d="M7 40h13V27h13" strokeWidth="5" />
      <circle cx="32" cy="27" r="1" className="k" />
      <path d="M14 9.5l3 1.75v3.5L14 16.5l-3-1.75v-3.5z" className="f" />
    </>
  ),
  flappy: (
    <>
      <path d="M31 0h9v12h-9zM29 11h13v4H29zM31 33h9v15h-9zM29 30h13v4H29z" className="b" />
      <circle cx="16" cy="23" r="6" className="f" />
      <circle cx="18" cy="21.5" r="1.2" className="k" />
      <path d="M21.5 23.5l4 1-4 1.5z" className="f" />
      <path d="M11 25c2 2 5 2 6 0" className="ks" strokeWidth="1.4" />
      <path d="M4 30h4M2 20h4" className="ds" strokeWidth="1.6" />
    </>
  ),
  freecell: (
    <>
      <path d="M5 5h8v11H5zM15.5 5h8v11h-8zM25 5h8v11h-8zM35 5h8v11h-8z" strokeWidth="1.2" className="dl" />
      <rect x="15.5" y="5" width="8" height="11" rx="1.2" className="f" />
      <rect x="6" y="20" width="10" height="14" rx="1.4" className="fo" />
      <rect x="6" y="26" width="10" height="14" rx="1.4" className="fo" />
      <rect x="19" y="20" width="10" height="14" rx="1.4" className="fo" />
      <rect x="19" y="25" width="10" height="14" rx="1.4" className="fo" />
      <rect x="19" y="30" width="10" height="14" rx="1.4" className="fo" />
      <rect x="32" y="20" width="10" height="14" rx="1.4" className="fo" />
      <path d="M11 29.5l1.6 2.5-1.6 2.5-1.6-2.5zM24 33.5l1.6 2.5-1.6 2.5-1.6-2.5zM37 24.5l1.6 2.5-1.6 2.5-1.6-2.5z" className="k" />
    </>
  ),
  merge: (
    <>
      {sq(4, 4, 18, "f")}
      {label(13, 13.5, "2", "k", 10)}
      {sq(26, 4, 18, "f")}
      {label(35, 13.5, "4", "k", 10)}
      {sq(4, 26, 18, "d")}
      {sq(26, 26, 18, "k")}
      {label(35, 35.5, "2048", "f", 6.4)}
    </>
  ),
  lights: (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => {
          const on = r === 1 || c === 1;
          return <rect key={`${r}${c}`} x={4 + c * 14} y={4 + r * 14} width={12} height={12} rx={2.4} className={on ? "f glow" : "d"} />;
        }),
      )}
    </>
  ),
  c4: (
    <>
      <rect x="5" y="12" width="38" height="31" rx="3" className="d" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2, 3].map((c) => {
          const v = ["..wy", ".wy.", "wyww"][r][c];
          return <circle key={`${r}${c}`} cx={12 + c * 8} cy={19 + r * 9} r={3.4} className={v === "w" ? "f" : v === "y" ? "y" : "h"} />;
        }),
      )}
      <circle cx="12" cy="5.5" r="3.4" className="y" />
    </>
  ),
  sudoku: (
    <>
      <path d="M6 6h36v36H6zM18 6v36M30 6v36M6 18h36M6 30h36" strokeWidth="1.6" />
      {label(12, 12.5, "5", "f", 8)}
      {label(36, 12.5, "3", "f", 8)}
      {label(24, 24.5, "7", "f", 8)}
      {label(12, 36.5, "9", "f", 8)}
      {label(36, 36.5, "1", "f", 8)}
    </>
  ),
  mahjong: (
    <>
      <rect x="6" y="20" width="12" height="16" rx="1.8" className="f" />
      <rect x="18.5" y="20" width="12" height="16" rx="1.8" className="f" />
      <rect x="31" y="20" width="12" height="16" rx="1.8" className="f" />
      <rect x="12" y="12" width="12" height="16" rx="1.8" className="b" />
      <rect x="25" y="12" width="12" height="16" rx="1.8" className="f" />
      <circle cx="12" cy="31" r="2.4" className="k" />
      <path d="M22.5 26v7M26.5 26v7" className="ks" strokeWidth="1.6" />
      <circle cx="37" cy="31" r="2.4" className="k" />
      <circle cx="31" cy="20" r="2.6" className="k" />
    </>
  ),
  breakout: (
    <>
      <path d="M5 7h8.5v5H5zM15 7h8.5v5H15zM25 7h8.5v5H25zM35 7h8v5h-8zM10 14h8.5v5H10zM30 14h8.5v5H30z" className="f" />
      <path d="M20 14h8.5v5H20z" className="d" />
      <circle cx="27" cy="29" r="2.6" className="f" />
      <path d="M17 41h14" strokeWidth="3.4" />
    </>
  ),
  stack: (
    <>
      <path d="M18 6h12v6H18zM24 12h6v6h-6z" className="f" />
      <path d="M6 30h6v12H6zM12 36h18v6H12zM30 30h12v6H30zM36 36h6v6h-6zM12 30h6v6h-6z" className="b" />
    </>
  ),
  pinball: (
    <>
      <circle cx="16" cy="14" r="4.5" className="d" />
      <circle cx="16" cy="14" r="2" className="f" />
      <circle cx="32" cy="18" r="4.5" className="d" />
      <circle cx="32" cy="18" r="2" className="f" />
      <circle cx="26" cy="30" r="2.6" className="f" />
      <path d="M9 39l9 3M39 39l-9 3" strokeWidth="3.4" />
    </>
  ),
  chess: (
    <>
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => ((r + c) % 2 ? <rect key={`${r}${c}`} x={4 + c * 10} y={4 + r * 10} width={10} height={10} className="d" /> : null)))}
      <path d="M20 37h8l-1-3c2-2 2-6 0-8l-1-1.5a2.6 2.6 0 1 0-4 0L21 26c-2 2-2 6 0 8z" className="fo" />
    </>
  ),
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
