// Achievements: a shelf of holographic badges. Locked ones show a hint, never the answer.
import type { CSSProperties, PointerEvent } from "react";
import { ACHIEVEMENTS } from "../os/fun";
import * as os from "../os/store";

/** The shine follows the pointer across the card, like a holographic trading card. */
const tilt = (e: PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
  e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
};

export default function Achievements() {
  const sess = os.useSession();
  const got = sess?.achievements ?? {};
  const count = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  return (
    <div className="badges">
      <header>
        <h2>Achievements</h2>
        <p className="muted">
          {count} of {ACHIEVEMENTS.length} unlocked. Read the whole resume is the one recruiters earn.
        </p>
      </header>
      <div className="badge-grid">
        {ACHIEVEMENTS.map((a, i) => {
          const at = got[a.id];
          return (
            <article key={a.id} className="badge" data-got={at ? "" : undefined} onPointerMove={at ? tilt : undefined} style={{ "--i": i } as CSSProperties}>
              <span className="badge-mark" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong>{at ? a.name : "Locked"}</strong>
              <small>{at ? `Unlocked ${new Date(at).toLocaleDateString()}` : a.hint}</small>
            </article>
          );
        })}
      </div>
    </div>
  );
}
