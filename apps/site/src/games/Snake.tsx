// Snake: eat honey, grow, don't bite yourself or the walls. Arrows or WASD steer, Space starts,
// and a swipe steers on touch screens. It speeds up a little with every bite.
import { Button } from "@lupinos/ui";
import { useRef, useState } from "react";
import { useCanvasLoop, useKeys } from "./canvas";
import { bestOf, finish, GameBar, type GameProps, Panel, Paused } from "./Shell";

const COLS = 24;
const ROWS = 18;
type P = { x: number; y: number };
const DIRS: Record<string, P> = { ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 } };

type State = { snake: P[]; dir: P; queue: P[]; food: P; acc: number; every: number; score: number; over: boolean };

function freeCell(snake: P[]): P {
  for (;;) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

const start = (): State => {
  const snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
  return { snake, dir: { x: 1, y: 0 }, queue: [], food: freeCell(snake), acc: 0, every: 130, score: 0, over: false };
};

export default function Snake({ focused }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const s = useRef<State>(start());
  const [status, setStatus] = useState<"ready" | "play" | "over">("ready");
  const [score, setScore] = useState(0);
  const touch = useRef<P | null>(null);

  const go = () => {
    s.current = start();
    setScore(0);
    setStatus("play");
  };
  const steer = (d: P) => {
    const st = s.current;
    const last = st.queue.at(-1) ?? st.dir;
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

  const tick = () => {
    const st = s.current;
    st.dir = st.queue.shift() ?? st.dir;
    const head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
    const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
    if (hitWall || st.snake.some((p) => p.x === head.x && p.y === head.y)) {
      st.over = true;
      setStatus("over");
      finish("snake", st.score);
      return;
    }
    st.snake.unshift(head);
    if (head.x === st.food.x && head.y === st.food.y) {
      st.score++;
      setScore(st.score);
      st.food = freeCell(st.snake);
      st.every = Math.max(65, st.every - 3);
    } else st.snake.pop();
  };

  useCanvasLoop(canvas, {
    running: status === "play" && focused,
    step: (dt) => {
      const st = s.current;
      st.acc += dt;
      while (st.acc >= st.every && !st.over) {
        st.acc -= st.every;
        tick();
      }
    },
    draw: (ctx, w, h, c) => {
      const st = s.current;
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
      // honey: a small hexagon
      const fx = ox + (st.food.x + 0.5) * cell;
      const fy = oy + (st.food.y + 0.5) * cell;
      ctx.fillStyle = "#f2b33d";
      ctx.beginPath();
      for (let k = 0; k < 6; k++) ctx.lineTo(fx + Math.cos((Math.PI / 3) * k) * cell * 0.38, fy + Math.sin((Math.PI / 3) * k) * cell * 0.38);
      ctx.fill();
      st.snake.forEach((p, i) => {
        ctx.fillStyle = i === 0 ? c.i3 : c.accent;
        ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i * 0.02);
        const pad = i === 0 ? 1 : 2;
        ctx.fillRect(ox + p.x * cell + pad, oy + p.y * cell + pad, cell - pad * 2, cell - pad * 2);
      });
      ctx.globalAlpha = 1;
    },
  });

  const best = bestOf("snake");
  return (
    <div className="game arcade">
      <GameBar>
        <span className="led">{String(score).padStart(3, "0")}</span>
        <span className="muted">Best {best ?? 0}</span>
        <Button onClick={go}>{status === "play" ? "Restart" : "Start"}</Button>
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
        <canvas ref={canvas} aria-label={`Snake. Score ${score}.`} role="img" />
        <Paused show={!focused && status === "play"} />
        {status === "ready" && (
          <Panel title="Snake">
            <p>Arrows or WASD to steer. Space to start.</p>
          </Panel>
        )}
        {status === "over" && (
          <Panel title={`Score ${score}`}>
            <p>{best !== undefined && score >= best && score > 0 ? "A new best. The hive approves." : `Best ${best ?? 0}`}</p>
            <Button variant="primary" onClick={go}>
              Play again
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
