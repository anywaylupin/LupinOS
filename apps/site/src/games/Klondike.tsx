// Klondike solitaire on the card engine. Click a card to send it to its best spot, or drag it
// where you want it. Click the stock to turn cards. Finishing plays the bouncing cards.
import { Button, Segmented } from "@lupinos/ui";
import { type CSSProperties, type PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
import { autoStep, bestMove, canAutoFinish, type Card, dealKlondike, drawStock, type From, type Klondike, moveCards, rankLabel, SUIT_GLYPH, isRed, type To, won } from "./cards";
import { dailySeed, hashSeed } from "./rng";
import { bestOf, finish, fmtTime, GameBar, type GameProps, Panel, Paused, useElapsed } from "./Shell";

const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

export function Face({ card }: { card: Card }) {
  const s = SUIT_GLYPH[card.suit];
  return (
    <>
      <span className="card-corner">
        {rankLabel(card)}
        <i>{s}</i>
      </span>
      <span className="card-pip">{card.rank > 10 ? rankLabel(card) : s}</span>
      <span className="card-corner end">
        {rankLabel(card)}
        <i>{s}</i>
      </span>
    </>
  );
}

/** Bounces every card off the foundations and across the table, like the old desktop finish. */
function celebrate(root: HTMLElement) {
  const box = root.getBoundingClientRect();
  const cards = [...root.querySelectorAll<HTMLElement>(".k-found .card")];
  cards.forEach((el, n) => {
    const r = el.getBoundingClientRect();
    const vx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3);
    let x = 0;
    let y = 0;
    let vy = -2 - Math.random() * 4;
    const floor = box.bottom - r.bottom;
    const frames: Keyframe[] = [];
    for (let i = 0; i < 90; i++) {
      x += vx;
      vy += 0.6;
      y += vy;
      if (y > floor) {
        y = floor;
        vy *= -0.72;
      }
      frames.push({ transform: `translate(${x * 4}px, ${y}px)` });
    }
    const ghost = el.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: "9500", pointerEvents: "none" });
    ghost.style.setProperty("--cw", `${r.width}px`);
    ghost.style.setProperty("--ch", `${r.height}px`);
    // Appended to the OS root: inside the glass window a fixed element would be placed relative to it.
    (root.closest(".lui") ?? document.body).append(ghost);
    ghost.animate(frames, { duration: 1800, delay: n * 70, easing: "linear", fill: "both" }).finished.then(() => ghost.remove());
  });
}

type Drag = { from: From; cards: Card[]; dx: number; dy: number; x0: number; y0: number; moved: boolean };

export default function KlondikeGame({ focused, daily }: GameProps) {
  const [draw, setDraw] = useState<1 | 3>(1);
  const [seed, setSeed] = useState(() => (daily ? hashSeed(`klondike-${dailySeed()}`) : newSeed()));
  const [game, setGame] = useState<Klondike>(() => dealKlondike(seed, draw));
  const [past, setPast] = useState<Klondike[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [nope, setNope] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const done = won(game);
  const started = game.moves > 0;
  const seconds = useElapsed(started && !done && focused, seed + draw);
  const key = `klondike${daily ? "-daily" : ""}`;

  const deal = (d: 1 | 3 = draw, s = daily ? seed : newSeed()) => {
    setDraw(d);
    setSeed(s);
    setGame(dealKlondike(s, d));
    setPast([]);
  };

  const commit = (next: Klondike | null, id?: string) => {
    if (!next) {
      if (id) {
        setNope(id);
        setTimeout(() => setNope(null), 320);
      }
      return false;
    }
    setPast((p) => [...p.slice(-99), game]);
    setGame(next);
    return true;
  };

  const tryMove = (from: From, to: To | null, id: string) => commit(to && moveCards(game, from, to), id);
  const clickCard = (from: From, id: string) => tryMove(from, bestMove(game, from), id);

  // Once everything is face up, the rest plays itself.
  useEffect(() => {
    if (done || !canAutoFinish(game)) return;
    const t = setTimeout(() => {
      const next = autoStep(game);
      if (next) setGame(next);
    }, 90);
    return () => clearTimeout(t);
  }, [game, done]);

  useEffect(() => {
    if (!done) return;
    finish(key, seconds, { lower: true, won: true });
    if (root.current) celebrate(root.current);
    // biome-ignore lint/correctness/useExhaustiveDependencies: the finish plays once per win
  }, [done]);

  const startDrag = (e: RPointerEvent<HTMLButtonElement>, from: From, cards: Card[]) => {
    if (e.button !== 0 || !cards[0]?.up) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from, cards, dx: 0, dy: 0, x0: e.clientX, y0: e.clientY, moved: false });
  };
  const moveDrag = (e: RPointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > 5 });
  };
  const endDrag = (e: RPointerEvent, id: string) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return clickCard(d.from, id);
    // The pile under the pointer, skipping the one the cards came from.
    const own = (e.currentTarget as HTMLElement).closest("[data-pile]");
    const target = document.elementsFromPoint(e.clientX, e.clientY).find((el) => (el as HTMLElement).dataset?.pile && el !== own) as HTMLElement | undefined;
    const pile = target?.dataset.pile;
    if (!pile) return;
    const [kind, i] = pile.split(":");
    tryMove(d.from, { pile: kind as "tab" | "found", i: Number(i) }, id);
  };

  const dragging = (c: Card) => drag?.moved && drag.cards.some((d) => d.id === c.id);
  const cardStyle = (c: Card, extra: CSSProperties = {}): CSSProperties => (dragging(c) ? { ...extra, translate: `${drag?.dx}px ${drag?.dy}px`, zIndex: 50 } : extra);

  const cardButton = (c: Card, from: From, run: Card[], style: CSSProperties = {}) => (
    <button
      key={c.id}
      type="button"
      className="card"
      data-up={c.up || undefined}
      data-red={isRed(c.suit) || undefined}
      data-nope={nope === c.id || undefined}
      data-dragging={dragging(c) || undefined}
      aria-label={c.up ? `${rankLabel(c)} of ${{ S: "spades", H: "hearts", D: "diamonds", C: "clubs" }[c.suit]}` : "Face-down card"}
      disabled={!c.up}
      style={cardStyle(c, style)}
      onPointerDown={(e) => startDrag(e, from, run)}
      onPointerMove={moveDrag}
      onPointerUp={(e) => endDrag(e, c.id)}
      onKeyDown={(e) => e.key === "Enter" && clickCard(from, c.id)}
    >
      {c.up ? <Face card={c} /> : <span className="card-back" />}
    </button>
  );

  const best = bestOf(key);
  const waste = game.waste.slice(-(game.draw === 3 ? 3 : 1));
  return (
    <div className="game klondike" ref={root}>
      <GameBar>
        <Segmented
          label="Draw"
          value={String(draw)}
          onChange={(v) => deal(Number(v) as 1 | 3)}
          options={[
            { value: "1", label: "Draw 1" },
            { value: "3", label: "Draw 3" },
          ]}
        />
        <span className="led">{fmtTime(seconds)}</span>
        <span className="led" title="Moves">
          {game.moves}
        </span>
        <Button variant="plain" disabled={!past.length} onClick={() => (setGame(past[past.length - 1]), setPast(past.slice(0, -1)))}>
          Undo
        </Button>
        <Button onClick={() => deal()}>New deal</Button>
      </GameBar>
      <div className="k-table">
        <div className="k-row">
          <button type="button" className="k-slot k-stock" aria-label={game.stock.length ? `Stock, ${game.stock.length} cards` : "Turn the waste over"} onClick={() => commit(drawStock(game))}>
            {game.stock.length > 0 && <span className="card" data-up={undefined}><span className="card-back" /></span>}
          </button>
          <div className="k-slot k-waste">
            {waste.map((c, i) => cardButton(c, { pile: "waste" }, [c], { left: `calc(${i} * var(--cw) * 0.22)`, pointerEvents: i === waste.length - 1 ? undefined : "none" }))}
          </div>
          <span />
          {game.found.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: four fixed foundations
            <div key={i} className="k-slot k-found" data-pile={`found:${i}`}>
              {p.slice(-2).map((c) => cardButton(c, { pile: "found", i }, [c]))}
            </div>
          ))}
        </div>
        <div className="k-row k-tab">
          {game.tab.map((p, i) => {
            let top = 0;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: seven fixed piles
              <div key={i} className="k-slot k-pile" data-pile={`tab:${i}`}>
                {p.map((c, at) => {
                  const style = { top: `calc(${top} * var(--ch))` };
                  top += c.up ? 0.26 : 0.12;
                  return cardButton(c, { pile: "tab", i, at }, p.slice(at), style);
                })}
              </div>
            );
          })}
        </div>
        <Paused show={!focused && started && !done} />
        {done && (
          <Panel title="Solved">
            <p>
              {fmtTime(seconds)} · {game.moves} moves{best !== undefined && ` · best ${fmtTime(best)}`}
            </p>
            <Button variant="primary" onClick={() => deal()}>
              Deal again
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
