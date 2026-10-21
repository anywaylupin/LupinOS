// Paints a theme's CSS wallpaper gradient onto a canvas, so the liquid surfaces have something to
// refract. WebGL cannot read the page, so the gradient is redrawn here from the theme's own CSS.
// Only the shapes the themes use are read: radial-gradient(W% H% at X% Y%, ...) blobs over a
// linear-gradient(Ndeg, ...) base.

export type Stop = { color: string; at: number };
export type Layer =
  | { kind: "radial"; rx: number; ry: number; x: number; y: number; stops: Stop[] }
  | { kind: "linear"; angle: number; stops: Stop[] };

/** Splits on commas that are not inside brackets. */
function split(s: string) {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const stop = (s: string): Stop => {
  const m = /^(.*?)\s+(-?[\d.]+)%$/.exec(s.trim());
  return m ? { color: m[1].trim(), at: Number(m[2]) / 100 } : { color: s.trim(), at: Number.NaN };
};

/** Reads the gradient layers of a CSS background, top layer first. Unknown layers are skipped. */
export function parseWall(css: string): Layer[] {
  const layers: Layer[] = [];
  for (const part of split(css)) {
    const m = /^(radial|linear)-gradient\((.*)\)$/s.exec(part);
    if (!m) continue;
    const [head, ...rest] = split(m[2]);
    if (m[1] === "radial") {
      const g = /([\d.]+)%\s+([\d.]+)%\s+at\s+([\d.]+)%\s+([\d.]+)%/.exec(head);
      if (g) layers.push({ kind: "radial", rx: +g[1] / 100, ry: +g[2] / 100, x: +g[3] / 100, y: +g[4] / 100, stops: rest.map(stop) });
    } else {
      const a = /(-?[\d.]+)deg/.exec(head);
      if (a) layers.push({ kind: "linear", angle: +a[1], stops: rest.map(stop) });
    }
  }
  return layers;
}

/** "transparent" fades to the previous colour at zero alpha, not to black, like CSS does. */
function stopsFor(stops: Stop[]) {
  return stops.map((s, i) => {
    const at = Number.isNaN(s.at) ? i / Math.max(1, stops.length - 1) : s.at;
    if (s.color !== "transparent") return { color: s.color, at };
    const near = stops[i - 1]?.color ?? stops[i + 1]?.color ?? "#000000";
    return { color: /^#[\da-f]{6}$/i.test(near) ? `${near}00` : "rgba(0,0,0,0)", at };
  });
}

/** Draws the layers bottom first, then an optional wash (the light or dark mode dim). */
export function paintWall(ctx: CanvasRenderingContext2D, layers: Layer[], w: number, h: number, wash?: string) {
  ctx.clearRect(0, 0, w, h);
  for (const l of [...layers].reverse()) {
    ctx.save();
    let g: CanvasGradient;
    if (l.kind === "linear") {
      const a = (l.angle * Math.PI) / 180;
      const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
      const dx = (Math.sin(a) * len) / 2;
      const dy = (-Math.cos(a) * len) / 2;
      g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
      for (const s of stopsFor(l.stops)) g.addColorStop(Math.min(1, Math.max(0, s.at)), s.color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else {
      // An ellipse is a unit circle, stretched.
      ctx.translate(l.x * w, l.y * h);
      ctx.scale(l.rx * w, l.ry * h);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const s of stopsFor(l.stops)) g.addColorStop(Math.min(1, Math.max(0, s.at)), s.color);
      ctx.fillStyle = g;
      ctx.fillRect(-4, -4, 8, 8);
    }
    ctx.restore();
  }
  if (wash) {
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
  }
}
