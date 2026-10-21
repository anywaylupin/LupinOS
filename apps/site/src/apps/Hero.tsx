// The hero's sheet: level, experience, gold and the looks it has unlocked, with switches to
// turn the hero off or shrink it.
import { Switch } from "@lupinos/ui";
import type { CSSProperties } from "react";
import { ITEMS } from "../os/Hero";
import * as os from "../os/store";

export default function HeroSheet() {
  const sess = os.useSession();
  if (!sess) return null;
  const h = sess.hero;
  const level = os.heroLevel(h.xp);
  const from = os.xpFor(level);
  const to = os.xpFor(level + 1);
  const slots = ["hat", "weapon", "pet"] as const;
  return (
    <div className="hero-sheet">
      <header>
        <div>
          <small>Level</small>
          <b>{level}</b>
        </div>
        <div className="xp" style={{ "--p": `${((h.xp - from) / (to - from)) * 100}%` } as CSSProperties}>
          <i />
          <span>
            {h.xp - from} / {to - from} xp
          </span>
        </div>
        <div>
          <small>Gold</small>
          <b>{h.gold}</b>
        </div>
      </header>
      <p className="muted">Opening apps, beating games and finding secrets make your hero stronger. Levels unlock looks, never content.</p>
      {slots.map((slot) => (
        <section key={slot}>
          <h3>{slot === "hat" ? "Hats" : slot === "weapon" ? "Weapons" : "Pets"}</h3>
          <div className="hero-items">
            {ITEMS.filter((it) => it.slot === slot).map((it) => {
              const owned = h.items.includes(it.id);
              const worn = h[slot] === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  className="hero-item"
                  aria-pressed={worn}
                  disabled={!owned}
                  onClick={() => os.setHero({ [slot]: worn ? undefined : it.id })}
                >
                  <strong>{owned ? it.name : "Locked"}</strong>
                  <small>{owned ? (worn ? "Equipped" : "Click to equip") : it.rare ? "Found in chests" : `Level ${it.level}`}</small>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <div className="set-group">
        <div className="set-row">
          <span>Show the hero</span>
          <Switch checked={h.on} onChange={(e) => os.setHero({ on: e.target.checked })} aria-label="Show the hero" />
        </div>
        <div className="set-row">
          <span>Small hero</span>
          <Switch checked={h.small} onChange={(e) => os.setHero({ small: e.target.checked })} aria-label="Small hero" />
        </div>
      </div>
    </div>
  );
}
