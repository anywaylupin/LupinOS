// The desktop hero: a tiny pixel character who lives on top of the dock. It patrols, fights the
// glitch bugs that crawl in from the edges, sleeps when you are idle, cheers when a window
// opens, and levels up as you explore. Levels unlock looks only, never content.
// One full-screen canvas behind the windows draws everything; it never takes clicks meant for
// the dock, only a small hit box over the hero does.
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { emit, on } from "./bus";
import * as os from "./store";

export type Item = { id: string; name: string; slot: "hat" | "weapon" | "pet"; level?: number; rare?: boolean };
export const ITEMS: Item[] = [
  { id: "cap", name: "Courier cap", slot: "hat", level: 2 },
  { id: "stick", name: "Debug stick", slot: "weapon", level: 3 },
  { id: "bee", name: "Pet bee", slot: "pet", level: 4 },
  { id: "band", name: "Akira headband", slot: "hat", level: 5 },
  { id: "sword", name: "Refactor blade", slot: "weapon", level: 6 },
  { id: "crown", name: "Hive crown", slot: "hat", rare: true },
  { id: "laser", name: "Laser pointer", slot: "weapon", rare: true },
];

const HINTS = [
  "Have you tried the terminal? Type help.",
  "The projects are two clicks away. Always.",
  "Alt+T tiles every window. Alt+T again floats them.",
  "Hover the maximise button for snap layouts.",
  "Drag me onto a window. I like the view.",
  "Win a game and I find a chest.",
  "Ctrl+K searches everything.",
  "Some folders are hidden. Files has a setting for that.",
];

type Bug = { x: number; dir: number; hp: number; t: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number };

/** Gives xp and announces level-ups and the looks they unlock. */
function gainXp(n: number) {
  const h = os.session()?.hero;
  if (!h) return;
  const before = os.heroLevel(h.xp);
  const xp = h.xp + n;
  const after = os.heroLevel(xp);
  const unlocked = ITEMS.filter((it) => it.level && it.level <= after && !h.items.includes(it.id));
  os.setHero({ xp, items: [...h.items, ...unlocked.map((it) => it.id)] });
  if (after >= 5) emit({ type: "egg", id: "hero5" });
  if (after > before) os.notify(`Hero reached level ${after}`, unlocked.length ? `Unlocked: ${unlocked.map((u) => u.name).join(", ")}.` : "Keep exploring.");
}

function grantRare() {
  const h = os.session()?.hero;
  const pool = ITEMS.filter((it) => !h?.items.includes(it.id) && (it.rare || (it.level ?? 99) > os.heroLevel(h?.xp ?? 0)));
  const it = pool[Math.floor(Math.random() * pool.length)];
  if (!h || !it) return os.setHero({ gold: (h?.gold ?? 0) + 25 });
  os.setHero({ items: [...h.items, it.id], gold: h.gold + 10 });
  os.notify("Your hero found a chest", `${it.name}. Equip it from the Hero window.`);
}

export function Hero({ hero }: { hero: os.Hero }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hit = useRef<HTMLButtonElement>(null);
  const [bubble, setBubble] = useState<{ text: string; x: number; y: number } | null>(null);
  const equip = useRef(hero);
  equip.current = hero;

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const px = () => (equip.current.small ? 2 : 3);
    const me = { x: innerWidth / 2, dir: 1, frame: 0, state: "walk" as "walk" | "fight" | "sleep" | "cheer" | "sit", until: 0, attack: 0, sitOn: null as HTMLElement | null, sitX: 0 };
    const bugs: Bug[] = [];
    const sparks: Spark[] = [];
    let lastInput = performance.now();
    let focusNap = false;
    let nextBug = performance.now() + 8000;
    let raf = 0;
    let last = performance.now();

    const fit = () => {
      const dpr = devicePixelRatio || 1;
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    addEventListener("resize", fit);
    const poke = () => {
      lastInput = performance.now();
      if (me.state === "sleep" && !focusNap) me.state = "walk";
    };
    for (const e of ["pointermove", "keydown", "pointerdown"]) addEventListener(e, poke, { passive: true });
    const off = on((e) => {
      if (e.type === "app-open") {
        gainXp(3);
        if (me.state !== "sit") {
          me.state = "cheer";
          me.until = performance.now() + 1200;
        }
      } else if (e.type === "game-won") grantRare();
      else if (e.type === "read-end") os.setHero({ gold: (os.session()?.hero.gold ?? 0) + 10 });
      else if (e.type === "egg") grantRare();
      else if (e.type === "focus") {
        focusNap = e.running;
        if (e.running) me.state = "sleep";
      }
    });

    const dockRect = () => document.querySelector(".lui-dock")?.getBoundingClientRect();

    const drawHero = (x: number, feet: number, colors: CSSStyleDeclaration, t: number) => {
      const p = px();
      const h = equip.current;
      const accent = colors.getPropertyValue("--lui-accent").trim() || "#c24a3c";
      const dark = "#1d1a22";
      const skin = "#f1c9a5";
      const walk = me.state === "walk" || me.state === "fight";
      const step = walk ? Math.floor(t / 140) % 2 : 0;
      const jump = me.state === "cheer" ? Math.abs(Math.sin(t / 120)) * 6 * p : 0;
      const y0 = feet - 13 * p - jump;
      const r = (cx: number, cy: number, w: number, hh: number, col: string) => {
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x + (me.dir > 0 ? cx : 10 - cx - w) * p - 5 * p), Math.round(y0 + cy * p), w * p, hh * p);
      };
      const lying = me.state === "sleep";
      if (lying) {
        ctx.save();
        ctx.translate(x, feet);
        ctx.rotate(-Math.PI / 2 * me.dir);
        ctx.translate(-x, -feet + 2 * p);
      }
      // legs, body, head
      r(3, 10, 2, 3 - (step ? 1 : 0), dark);
      r(6, 10, 2, 3 - (step ? 0 : 1), dark);
      r(2, 6, 7, 4, accent);
      r(2, 9, 7, 1, dark);
      r(3, 1, 5, 5, skin);
      r(3, 1, 5, 1, dark);
      r(lying ? 6 : 7, 3, 1, lying ? 1 : 2, dark);
      // arms: up when cheering, forward when attacking
      if (me.state === "cheer") {
        r(1, 4, 1, 3, skin);
        r(9, 4, 1, 3, skin);
      } else r(me.attack > 0 ? 9 : 8, 7, 2, 1, skin);
      // hat
      if (h.hat === "cap") {
        r(2, 0, 6, 2, accent);
        r(7, 1, 3, 1, dark);
      } else if (h.hat === "band") {
        r(2, 2, 7, 1, "#e5484d");
        r(1, 2, 1, 2, "#e5484d");
      } else if (h.hat === "crown") {
        r(3, -1, 5, 2, "#f2c14e");
        r(3, -2, 1, 1, "#f2c14e");
        r(5, -2, 1, 1, "#f2c14e");
        r(7, -2, 1, 1, "#f2c14e");
      }
      // weapon
      if (h.weapon && me.state !== "sleep") {
        const col = h.weapon === "stick" ? "#8a5a2b" : h.weapon === "sword" ? "#d8dde6" : accent;
        if (me.attack > 0) r(10, 6, 5, 1, col);
        else r(10, 3, 1, 5, col);
        if (h.weapon === "laser" && me.attack > 0) {
          ctx.fillStyle = accent;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x + (me.dir > 0 ? 9 : -40) * p, y0 + 6 * p, 31 * p, p);
          ctx.globalAlpha = 1;
        }
      }
      if (lying) ctx.restore();
      // pet bee bobbing behind
      if (h.pet === "bee") {
        const bx = x - me.dir * 9 * p;
        const by = y0 - 2 * p + Math.sin(t / 200) * 3;
        ctx.fillStyle = "#f5c542";
        ctx.fillRect(bx - 2 * p, by, 4 * p, 3 * p);
        ctx.fillStyle = dark;
        ctx.fillRect(bx - p, by, p, 3 * p);
        ctx.fillStyle = "rgb(255 255 255 / 0.8)";
        ctx.fillRect(bx - p, by - p - (Math.floor(t / 60) % 2) * p, 2 * p, p);
      }
      if (me.state === "sleep") {
        ctx.fillStyle = colors.getPropertyValue("--lui-ink").trim() || "#fff";
        ctx.font = `600 ${5 * p}px monospace`;
        const k = (t / 900) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.fillText("z", x + 4 * p, feet - 14 * p - k * 12 * p);
        ctx.globalAlpha = 1;
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      raf = requestAnimationFrame(frame);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const h = equip.current;
      const d = dockRect();
      if (!h.on || !d) return;
      const colors = getComputedStyle(c);
      const p = px();
      let feet = d.top;
      const left = d.left + 10;
      const right = d.right - 10;

      if (me.state !== "sleep" && t - lastInput > 20_000) me.state = "sleep";
      if (me.state === "cheer" && t > me.until) me.state = "walk";
      if (me.state === "sit") {
        const r = me.sitOn?.isConnected ? me.sitOn.getBoundingClientRect() : null;
        if (!r || me.sitOn?.dataset.minimized !== undefined) me.state = "walk";
        else {
          feet = r.top + 1;
          me.x = Math.min(r.right - 20, Math.max(r.left + 20, r.left + me.sitX));
        }
      }

      // glitch bugs crawl in along the dock now and then
      if (me.state !== "sleep" && me.state !== "sit" && t > nextBug && bugs.length < 3) {
        nextBug = t + 9000 + Math.random() * 12000;
        const fromLeft = Math.random() < 0.5;
        bugs.push({ x: fromLeft ? left : right, dir: fromLeft ? 1 : -1, hp: 2, t });
      }
      for (const b of bugs) b.x += b.dir * 0.02 * dt * (me.state === "sleep" ? 0 : 1);

      if (me.state === "walk" || me.state === "fight") {
        const target = bugs.reduce<Bug | null>((a, b) => (!a || Math.abs(b.x - me.x) < Math.abs(a.x - me.x) ? b : a), null);
        me.state = target ? "fight" : "walk";
        if (target && Math.abs(target.x - me.x) < 16 * p) {
          me.dir = Math.sign(target.x - me.x) || me.dir;
          if (me.attack <= 0) {
            me.attack = 260;
            target.hp--;
            if (target.hp <= 0) {
              for (let k = 0; k < 10; k++) sparks.push({ x: target.x, y: feet - 4 * p, vx: (Math.random() - 0.5) * 0.25, vy: -Math.random() * 0.3, life: 600 });
              bugs.splice(bugs.indexOf(target), 1);
              gainXp(2);
            }
          }
        } else {
          if (target) me.dir = Math.sign(target.x - me.x) || me.dir;
          me.x += me.dir * 0.035 * dt * (target ? 1.6 : 1);
          if (me.x > right) me.dir = -1;
          if (me.x < left) me.dir = 1;
        }
      }
      me.attack -= dt;
      me.x = me.state === "sit" ? me.x : Math.min(right, Math.max(left, me.x));

      for (const b of bugs) {
        const flick = Math.floor(t / 80) % 2;
        ctx.fillStyle = flick ? "#ff2bd6" : "#21e6ff";
        ctx.fillRect(b.x - 3 * p, feet - 4 * p, 6 * p, 3 * p);
        ctx.fillStyle = "#1d1a22";
        ctx.fillRect(b.x - 4 * p + (flick ? p : 0), feet - p, p, p);
        ctx.fillRect(b.x + 3 * p - (flick ? p : 0), feet - p, p, p);
      }
      for (const s of sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 0.0008 * dt;
        s.life -= dt;
        ctx.fillStyle = "#f2c14e";
        ctx.globalAlpha = Math.max(0, s.life / 600);
        ctx.fillRect(s.x, s.y, p, p);
      }
      ctx.globalAlpha = 1;
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);

      drawHero(me.x, feet, colors, t);
      const box = hit.current;
      if (box) Object.assign(box.style, { left: `${me.x - 7 * p}px`, top: `${feet - 15 * p}px`, width: `${14 * p}px`, height: `${15 * p}px` });
    };
    raf = requestAnimationFrame(frame);

    // Dragging the hero onto a window makes it sit on that window's top edge.
    const box = hit.current;
    const grab = (e: PointerEvent) => {
      if (e.button !== 0 || !box) return;
      box.setPointerCapture(e.pointerId);
      const sx = e.clientX;
      let moved = false;
      const move = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - e.clientY) > 6) moved = true;
        if (moved) {
          me.state = "cheer";
          me.until = performance.now() + 100000;
          me.x = ev.clientX;
        }
      };
      const up = (ev: PointerEvent) => {
        box.removeEventListener("pointermove", move);
        box.removeEventListener("pointerup", up);
        if (!moved) {
          setBubble({ text: HINTS[Math.floor(Math.random() * HINTS.length)], x: me.x, y: (dockRect()?.top ?? innerHeight) - 16 * px() });
          return;
        }
        const win = document.elementsFromPoint(ev.clientX, ev.clientY).find((el) => el.classList.contains("lui-window")) as HTMLElement | undefined;
        if (win) {
          me.state = "sit";
          me.sitOn = win;
          me.sitX = ev.clientX - win.getBoundingClientRect().left;
        } else me.state = "walk";
      };
      box.addEventListener("pointermove", move);
      box.addEventListener("pointerup", up);
    };
    box?.addEventListener("pointerdown", grab);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", fit);
      for (const e of ["pointermove", "keydown", "pointerdown"]) removeEventListener(e, poke);
      box?.removeEventListener("pointerdown", grab);
      off();
    };
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const t = setTimeout(() => setBubble(null), 4200);
    return () => clearTimeout(t);
  }, [bubble]);

  if (!hero.on) return null;
  return (
    <>
      <canvas ref={canvas} className="hero-canvas" aria-hidden="true" />
      <button
        ref={hit}
        type="button"
        className="hero-hit"
        aria-label={`Desktop hero, level ${os.heroLevel(hero.xp)}. Click for a hint.`}
        onContextMenu={(e) => {
          e.preventDefault();
          os.open("hero");
        }}
        onDoubleClick={() => os.open("hero")}
      />
      {bubble && (
        <div className="hero-bubble" role="status" style={{ left: bubble.x, top: bubble.y } as CSSProperties}>
          {bubble.text}
        </div>
      )}
    </>
  );
}
