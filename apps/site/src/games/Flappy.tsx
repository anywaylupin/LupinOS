// Flappy bee: one button keeps the bee in the air between hive columns. Space, Up, a click or
// a tap flaps. The world is measured in screen heights, so any window size plays the same.
import { Button } from "@lupinos/ui";
import { useRef, useState } from "react";
import { useCanvasLoop, useKeys } from "./canvas";
import { bestOf, finish, GameBar, type GameProps, Panel, Paused } from "./Shell";

const GRAVITY = 2.4;
const FLAP = -0.66;
const SPEED = 0.34;
const GAP = 0.3;
const PIPE_W = 0.13;
const BEE_X = 0.3;
const BEE_R = 0.035;

type Pipe = { x: number; gap: number; passed: boolean };
type State = { y: number; vy: number; pipes: Pipe[]; until: number; score: number; t: number; over: boolean };

const start = (): State => ({ y: 0.45, vy: 0, pipes: [], until: 0.6, score: 0, t: 0, over: false });

export default function Flappy({ focused }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const s = useRef<State>(start());
  const width = useRef(1.4);
  const [status, setStatus] = useState<"ready" | "play" | "over">("ready");
  const [score, setScore] = useState(0);

  const flap = () => {
    if (status === "over") return;
    if (status === "ready") {
      s.current = start();
      setScore(0);
      setStatus("play");
    }
    s.current.vy = FLAP;
  };
  const again = () => {
    s.current = start();
    setScore(0);
    setStatus("ready");
  };

  useKeys(focused, (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (status === "over") again();
      else flap();
    }
  });

  const crash = () => {
    const st = s.current;
    if (st.over) return;
    st.over = true;
    setStatus("over");
    finish("flappy", st.score, { won: st.score >= 10 });
  };

  useCanvasLoop(canvas, {
    running: status === "play" && focused,
    step: (ms) => {
      const st = s.current;
      if (st.over) return;
      const dt = ms / 1000;
      st.t += dt;
      st.vy += GRAVITY * dt;
      st.y += st.vy * dt;
      st.until -= dt;
      if (st.until <= 0) {
        st.until = 1.55;
        st.pipes.push({ x: width.current + PIPE_W, gap: 0.22 + Math.random() * 0.5, passed: false });
      }
      for (const p of st.pipes) {
        p.x -= SPEED * dt * (1 + Math.min(0.5, st.score * 0.02));
        if (!p.passed && p.x + PIPE_W < BEE_X - BEE_R) {
          p.passed = true;
          st.score++;
          setScore(st.score);
        }
        const inX = BEE_X + BEE_R > p.x && BEE_X - BEE_R < p.x + PIPE_W;
        const inGap = st.y - BEE_R > p.gap - GAP / 2 && st.y + BEE_R < p.gap + GAP / 2;
        if (inX && !inGap) crash();
      }
      st.pipes = st.pipes.filter((p) => p.x > -PIPE_W);
      if (st.y > 1 - BEE_R || st.y < BEE_R) crash();
    },
    draw: (ctx, w, h, c) => {
      const st = s.current;
      width.current = w / h;
      const u = h;
      ctx.clearRect(0, 0, w, h);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, c.i4);
      sky.addColorStop(1, c.i2);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // hive columns with a honeycomb face
      for (const p of st.pipes) {
        const x = p.x * u;
        const pw = PIPE_W * u;
        const top = (p.gap - GAP / 2) * u;
        const bottom = (p.gap + GAP / 2) * u;
        ctx.fillStyle = "#e9a93a";
        ctx.fillRect(x, 0, pw, top);
        ctx.fillRect(x, bottom, pw, h - bottom);
        ctx.strokeStyle = "rgb(120 70 10 / 0.35)";
        ctx.lineWidth = 1;
        const r = pw / 6;
        for (let yy = 0; yy < h; yy += r * 1.8) {
          if (yy > top - r && yy < bottom + r) continue;
          for (let k = 0; k < 3; k++) {
            const cx = x + r * (1.2 + k * 1.8) + ((yy / (r * 1.8)) % 2 ? r * 0.9 : 0);
            ctx.beginPath();
            for (let a = 0; a < 6; a++) ctx.lineTo(cx + Math.cos((Math.PI / 3) * a) * r * 0.8, yy + Math.sin((Math.PI / 3) * a) * r * 0.8);
            ctx.closePath();
            ctx.stroke();
          }
        }
        ctx.fillStyle = "rgb(0 0 0 / 0.18)";
        ctx.fillRect(x, top - 8, pw, 8);
        ctx.fillRect(x, bottom, pw, 8);
      }
      // the bee
      const bx = BEE_X * u;
      const by = st.y * u;
      const br = BEE_R * u;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.max(-0.5, Math.min(0.9, st.vy * 1.2)));
      ctx.fillStyle = "rgb(255 255 255 / 0.75)";
      ctx.beginPath();
      ctx.ellipse(-br * 0.2, -br * 0.9, br * 0.7, br * (0.35 + 0.15 * Math.sin(st.t * 40)), -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5c542";
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 1.25, br, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1f1a14";
      for (const sx of [-0.35, 0.15]) ctx.fillRect(sx * br, -br, br * 0.28, br * 2);
      ctx.beginPath();
      ctx.arc(br * 0.8, -br * 0.2, br * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = c.ink;
    },
  });

  const best = bestOf("flappy");
  return (
    <div className="game arcade">
      <GameBar>
        <span className="led">{String(score).padStart(3, "0")}</span>
        <span className="muted">Best {best ?? 0}</span>
        <Button onClick={again}>Reset</Button>
      </GameBar>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the whole stage is the flap button; Space works too */}
      <div className="arcade-stage" onPointerDown={() => (status === "over" ? again() : flap())}>
        <canvas ref={canvas} aria-label={`Flappy bee. Score ${score}.`} role="img" />
        <Paused show={!focused && status === "play"} />
        {status === "ready" && (
          <Panel title="Flappy Bee">
            <p>Space, Up or a tap to flap. Mind the hive.</p>
          </Panel>
        )}
        {status === "over" && (
          <Panel title={`Score ${score}`}>
            <p>{score >= 10 ? "Certified flight crew." : `Best ${best ?? 0}`}</p>
            <Button variant="primary" onClick={again}>
              Fly again
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
