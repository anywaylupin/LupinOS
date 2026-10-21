// FreeCell on the card engine. Every deal has a number, so a good one can be shared. Click a card
// to send it to its best spot; safe cards fly home on their own.
import { Button } from "@lupinos/ui";
import { type CSSProperties, useEffect, useState } from "react";
import { type Card, dealFreeCell, type FcFrom, fcAutoStep, fcBest, fcMove, fcWon, type FreeCell as Game, isRed, rankLabel } from "./cards";
import { Face } from "./Klondike";
import { dailySeed, hashSeed } from "./rng";
import { bestOf, finish, fmtTime, GameBar, type GameProps, Panel, Paused, useElapsed } from "./Shell";

const randomDeal = () => 1 + Math.floor(Math.random() * 32000);

export default function FreeCell({ focused, daily }: GameProps) {
  const [game, setGame] = useState<Game>(() => dealFreeCell(daily ? 1 + (hashSeed(`freecell-${dailySeed()}`) % 32000) : randomDeal()));
  const [past, setPast] = useState<Game[]>([]);
  const [nope, setNope] = useState<string | null>(null);
  const done = fcWon(game);
  const seconds = useElapsed(game.moves > 0 && !done && focused, game.deal);
  const key = `freecell${daily ? "-daily" : ""}`;

  const click = (from: FcFrom, c: Card) => {
    const to = fcBest(game, from);
    const next = to && fcMove(game, from, to);
    if (!next) {
      setNope(c.id);
      setTimeout(() => setNope(null), 320);
      return;
    }
    setPast((p) => [...p.slice(-99), game]);
    setGame(next);
  };

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      const next = fcAutoStep(game);
      if (next) setGame(next);
    }, 140);
    return () => clearTimeout(t);
  }, [game, done]);

  useEffect(() => {
    if (done) finish(key, seconds, { lower: true, won: true });
    // biome-ignore lint/correctness/useExhaustiveDependencies: once per win
  }, [done]);

  const card = (c: Card, from: FcFrom, style?: CSSProperties) => (
    <button
      key={c.id}
      type="button"
      className="card"
      data-up=""
      data-red={isRed(c.suit) || undefined}
      data-nope={nope === c.id || undefined}
      aria-label={`${rankLabel(c)} of ${{ S: "spades", H: "hearts", D: "diamonds", C: "clubs" }[c.suit]}`}
      style={style}
      onClick={() => click(from, c)}
    >
      <Face card={c} />
    </button>
  );

  const best = bestOf(key);
  return (
    <div className="game klondike freecell">
      <GameBar>
        <span className="led" title="Deal number">
          #{game.deal}
        </span>
        <span className="led">{fmtTime(seconds)}</span>
        <Button variant="plain" disabled={!past.length} onClick={() => (setGame(past[past.length - 1]), setPast(past.slice(0, -1)))}>
          Undo
        </Button>
        <Button onClick={() => (setGame(dealFreeCell(randomDeal())), setPast([]))}>New deal</Button>
      </GameBar>
      <div className="k-table">
        <div className="k-row fc-row">
          {game.cells.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: four fixed cells
            <div key={`cell${i}`} className="k-slot fc-cell">
              {c && card(c, { pile: "cell", i })}
            </div>
          ))}
          {game.found.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: four fixed foundations
            <div key={`found${i}`} className="k-slot k-found">
              {p.slice(-1).map((c) => card(c, { pile: "found", i }))}
            </div>
          ))}
        </div>
        <div className="k-row fc-row k-tab">
          {game.tab.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: eight fixed piles
            <div key={i} className="k-slot k-pile">
              {p.map((c, at) => card(c, { pile: "tab", i, at }, { top: `calc(${at} * var(--ch) * 0.24)` }))}
            </div>
          ))}
        </div>
        <Paused show={!focused && game.moves > 0 && !done} />
        {done && (
          <Panel title={`Deal #${game.deal} solved`}>
            <p>
              {fmtTime(seconds)}
              {best !== undefined && ` · best ${fmtTime(best)}`}
            </p>
            <Button variant="primary" onClick={() => (setGame(dealFreeCell(randomDeal())), setPast([]))}>
              Next deal
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
