// Snake against one or two rival snakes (the rules live in snakes.ts). Bite their tails to cut them
// short; their first cells are armour, and their heads always win. Arrows or WASD steer, Space
// starts, and a swipe steers on touch screens. It speeds up a little with every honey.
import { Button, Segmented } from "@lupinos/ui";
import { useRef, useState } from "react";
import { useCanvasLoop, useKeys } from "./canvas";
import { bestOf, finish, GameBar, type GameProps, Panel, Paused } from "./Shell";
import { ARMOUR, COLS, type Death, newWorld, type P, ROWS, rivalDir, tick, type World } from "./snakes";

const DIRS: Record<string, P> = { ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 } };
const RIVAL_COLORS = ["#6fb7e6", "#b98cf2"];
const DEATHS: Record<Death, string> = {
  wall: "You hit the wall.",
  self: "You bit yourself.",
  armour: "You ran into armour.",
  head: "Head to head with a rival. Rivals always win those.",
};

type State = { world: World; queue: P[]; acc: number; every: number };
const start = (rivals: number): State => ({ world: newWorld(rivals), queue: [], acc: 0, every: 130 });

export default function Snake({ focused }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rivals, setRivals] = useState<1 | 2>(1);
  const s = useRef<State>(start(rivals));
  const [status, setStatus] = useState<"ready" | "play" | "over">("ready");
  const [score, setScore] = useState(0);
  const [death, setDeath] = useState<Death | null>(null);
  const touch = useRef<P | null>(null);
  const scoreKey = `snake-${rivals}`;

  const go = (n = rivals) => {
    s.current = start(n);
    setScore(0);
    setDeath(null);
    setStatus("play");
  };
  const steer = (d: P) => {
    const st = s.current;
    const last = st.queue.at(-1) ?? st.world.snakes[0].dir;
    if (d.x === -last.x && d.y === -last.y) return;
    if (st.queue.length < 3) st.queue.push(d);
  };

  useKeys(focused, (e) => {
    if (DIRS[e.code]) {
      e.preventDefault();
      if (status !== "play") go();
      steer(DIRS[e.code]);
    } else if (e.code === "Space" && status !== "play") {
      e.preventDefault();
      go();
    }
  });

  const step = () => {
    const st = s.current;
    const w = st.world;
    const before = w.score;
    const dirs = w.snakes.map((sn, i) => (i ? rivalDir(w, i) : (st.queue.shift() ?? sn.dir)));
    tick(w, dirs, st.every);
    if (w.score !== before) {
      setScore(w.score);
      st.every = Math.max(65, st.every - 3);
    }
    if (w.over) {
      setDeath(w.over);
      setStatus("over");
      finish(scoreKey, w.score);
    }
  };

  useCanvasLoop(canvas, {
    running: status === "play" && focused,
    step: (dt) => {
      const st = s.current;
      st.acc += dt;
      while (st.acc >= st.every && !st.world.over) {
        st.acc -= st.every;
        step();
      }
    },
    draw: (ctx, w, h, c) => {
      const world = s.current.world;
      const cell = Math.floor(Math.min(w / COLS, h / ROWS));
      const ox = (w - cell * COLS) / 2;
      const oy = (h - cell * ROWS) / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = c.i4;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(ox, oy, cell * COLS, cell * ROWS);
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = c.i3;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(ox + x * cell, oy);
        ctx.lineTo(ox + x * cell, oy + ROWS * cell);
        ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + y * cell);
        ctx.lineTo(ox + COLS * cell, oy + y * cell);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // honey: small hexagons
      ctx.fillStyle = "#f2b33d";
      for (const f of world.food) {
        const fx = ox + (f.x + 0.5) * cell;
        const fy = oy + (f.y + 0.5) * cell;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) ctx.lineTo(fx + Math.cos((Math.PI / 3) * k) * cell * 0.38, fy + Math.sin((Math.PI / 3) * k) * cell * 0.38);
        ctx.fill();
      }
      // Tail first so heads sit on top. Armour is solid with a rim; the rest is softer, and bitable.
      world.snakes.forEach((sn, si) => {
        if (!sn.alive) return;
        const color = si ? RIVAL_COLORS[si - 1] : c.accent;
        for (let i = sn.body.length - 1; i >= 0; i--) {
          const p = sn.body[i];
          const armour = i < ARMOUR;
          const pad = i === 0 ? 1 : armour ? 1.5 : 2.5;
          const x = ox + p.x * cell + pad;
          const y = oy + p.y * cell + pad;
          const size = cell - pad * 2;
          ctx.globalAlpha = armour ? 1 : 0.55;
          ctx.fillStyle = i === 0 && !si ? c.i3 : color;
          ctx.fillRect(x, y, size, size);
          if (armour && i > 0) {
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
          }
        }
        // eyes, looking where the head is going
        const head = sn.body[0];
        const cx = ox + (head.x + 0.5) * cell + sn.dir.x * cell * 0.15;
        const cy = oy + (head.y + 0.5) * cell + sn.dir.y * cell * 0.15;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#1b1b1f";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(cx + sn.dir.y * side * cell * 0.2, cy + sn.dir.x * side * cell * 0.2, Math.max(1.2, cell * 0.08), 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    },
  });

  const best = bestOf(scoreKey);
  return (
    <div className="game arcade">
      <GameBar>
        <span className="led">{String(score).padStart(3, "0")}</span>
        <span className="muted">Best {best ?? 0}</span>
        <Segmented
          label="Rivals"
          value={String(rivals)}
          onChange={(v) => {
            const n = v === "2" ? 2 : 1;
            setRivals(n);
            s.current = start(n);
            setScore(0);
            setStatus("ready");
          }}
          options={[
            { value: "1", label: "1 rival" },
            { value: "2", label: "2 rivals" },
          ]}
        />
        <Button onClick={() => go()}>{status === "play" ? "Restart" : "Start"}</Button>
      </GameBar>
      <div
        className="arcade-stage"
        onPointerDown={(e) => {
          touch.current = { x: e.clientX, y: e.clientY };
          if (status !== "play") go();
        }}
        onPointerUp={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.clientX - t.x;
          const dy = e.clientY - t.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          steer(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
        }}
      >
        <canvas ref={canvas} aria-label={`Snake against ${rivals} ${rivals > 1 ? "rivals" : "rival"}. Score ${score}.`} role="img" />
        <Paused show={!focused && status === "play"} />
        {status === "ready" && (
          <Panel title="Snake">
            <p>Arrows or WASD to steer. Space to start.</p>
            <p>Bite a rival's tail to cut it off. The first {ARMOUR} cells of every snake are armour, and a rival's head always wins.</p>
          </Panel>
        )}
        {status === "over" && (
          <Panel title={`Score ${score}`}>
            <p>{death && DEATHS[death]}</p>
            <p>{best !== undefined && score >= best && score > 0 ? "A new best. The hive approves." : `Best ${best ?? 0}`}</p>
            <Button variant="primary" onClick={() => go()}>
              Play again
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
