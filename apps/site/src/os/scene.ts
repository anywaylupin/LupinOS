// The theme scenes: a sky, a sun parked on the horizon, one decoration of the theme's own, and
// still water. All of it is data in a 1280×720 frame. Wallpaper.tsx draws it as DOM layers, so a
// theme switch is plain CSS transitions: the sky crossfades, the sun glides along the horizon to its
// new spot, size and light, and the decorations rise or slide in. paintScene draws the same frame on
// a canvas, for the liquid glass to refract.
import type { ThemeId } from "@lupinos/ui";

/** Where the water starts, as a part of the height. The ripple layer starts here too. */
export const HORIZON = 0.64;
/** The frame every scene is drawn in, and its horizon line. */
export const FRAME = { w: 1280, h: 720, y: 460 };

type Stops = [number, string][];
export type Motion = "rise" | "slideL" | "slideR" | "drift";
export type Shape = { d: string; fill?: string; stroke?: string; w?: number };
/** A decoration: a box in the sky (y from the frame top) or on the water (y from the horizon). */
export type Deco = { layer: "sky" | "water"; motion: Motion; x: number; y: number; w: number; h: number; shapes: Shape[] };
/** x: along the horizon. lift: how far its centre sits above the line, as a part of its size. */
export type Sun = { x: number; d: number; lift: number; core: string; glow: string; glowR: number; glowS: number; halo: string; haloD: number; reflect: string; bands?: boolean };
export type Scene = { sky: Stops; water: Stops; sun: Sun; decos: Deco[] };

/** Scales the frame to cover a w×h box, its horizon at HORIZON of the height. */
export function frameFit(w: number, h: number) {
  const s = Math.max(w / FRAME.w, h / FRAME.h);
  return { s, ox: (w - FRAME.w * s) / 2, oy: HORIZON * h - FRAME.y * s };
}

/** The sky reaches a little above the frame and the water below it, so a cover fit never shows an edge. */
export const BLEED = 60;

export const gradient = (stops: Stops) => `linear-gradient(180deg, ${stops.map(([at, c]) => `${c} ${at * 100}%`).join(", ")})`;

const n = (v: number) => +v.toFixed(2);
const circle = (cx: number, cy: number, r: number) => `M${n(cx - r)} ${cy}a${r} ${r} 0 1 0 ${n(r * 2)} 0a${r} ${r} 0 1 0 ${n(-r * 2)} 0Z`;
const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;

const POLLEN = [
  [120, 300, 3], [210, 380, 2.5], [300, 240, 4], [380, 330, 2], [470, 410, 3], [540, 280, 2.5],
  [620, 360, 3.5], [700, 250, 2], [780, 400, 3], [860, 310, 2.5], [950, 380, 2], [1010, 270, 3],
  [1120, 350, 2.5], [1200, 300, 3], [260, 170, 2], [660, 150, 2.5], [900, 190, 2], [1160, 210, 2.5],
];
const TOWERS = [
  [0, 70, 34], [38, 110, 26], [68, 84, 40], [112, 140, 22], [138, 96, 46], [188, 160, 30], [222, 104, 38],
  [264, 72, 26], [294, 122, 44], [342, 88, 30], [376, 132, 36], [416, 64, 24], [444, 100, 40], [488, 78, 30],
];
const PINK = [[8, 112], [50, 96], [76, 100], [116, 48], [166, 110], [196, 30], [232, 80], [270, 112], [320, 90], [350, 100], [386, 54], [454, 86], [496, 108]];
const CYAN = [[20, 130], [44, 74], [92, 120], [118, 84], [148, 90], [204, 64], [196, 104], [248, 110], [304, 62], [330, 120], [398, 92], [424, 120], [468, 118]];
const windows = (list: number[][]) => list.map(([x, y]) => rect(x, y, 5, 7)).join("");

export const SCENES: Record<ThemeId, Scene> = {
  // Kova: a big ember sun cut into Akira bands; the bands are its mark
  kova: {
    sky: [[0, "#2a1b2e"], [0.3, "#4e2441"], [0.64, "#9a3a48"], [1, "#e4745f"]],
    water: [[0, "#7a3448"], [0.6, "#3a1d33"], [1, "#1e1424"]],
    sun: { x: 900, d: 220, lift: 0.16, core: "#ff9a73", glow: "rgba(255,110,80,0.55)", glowR: 90, glowS: 24, halo: "#ff7a5a", haloD: 980, reflect: "#ffb08a", bands: true },
    decos: [],
  },
  // Tazu: a warm kiln sun, and Wukong's cloud sliding in from the left
  tazu: {
    sky: [[0, "#a8594f"], [0.45, "#d27c55"], [1, "#f8c99a"]],
    water: [[0, "#c27a5c"], [1, "#8e4c44"]],
    sun: { x: 760, d: 168, lift: 0.3, core: "#ffd29a", glow: "rgba(255,186,110,0.6)", glowR: 110, glowS: 30, halo: "#ffc07a", haloD: 1100, reflect: "#ffd7a6" },
    decos: [
      {
        layer: "sky", motion: "slideL", x: 150, y: 110, w: 320, h: 140,
        shapes: [
          { d: circle(96, 84, 38) + circle(150, 60, 50) + circle(214, 76, 40) + circle(132, 98, 32) + circle(188, 100, 34), fill: "rgba(255,248,238,0.88)" },
          { d: "M70 96C36 102 20 72 40 58C56 48 74 64 62 76C55 83 45 77 50 70", stroke: "rgba(255,248,238,0.88)", w: 9 },
        ],
      },
    ],
  },
  // Mimo: the brightest sun, high and small, and pollen drifting up over the water
  mimo: {
    sky: [[0, "#c49a52"], [0.4, "#e2b65e"], [1, "#fdeeb6"]],
    water: [[0, "#d9b56a"], [1, "#9c7c3e"]],
    sun: { x: 1040, d: 128, lift: 0.4, core: "#fff3c4", glow: "rgba(255,238,160,0.75)", glowR: 120, glowS: 36, halo: "#ffeaa0", haloD: 900, reflect: "#fff1c0" },
    decos: [
      {
        layer: "sky", motion: "drift", x: 0, y: 0, w: 1280, h: 460,
        shapes: [
          { d: POLLEN.map(([x, y, r]) => circle(x, y, n(r * 3.4))).join(""), fill: "rgba(255,246,200,0.26)" },
          { d: POLLEN.map(([x, y, r]) => circle(x, y, r)).join(""), fill: "rgba(255,250,222,0.92)" },
        ],
      },
    ],
  },
  // Olvi: a pale dawn low on the left, half behind ink-wash ridges that rise from the horizon
  olvi: {
    sky: [[0, "#5f7652"], [0.4, "#7f9767"], [1, "#d4dcb2"]],
    water: [[0, "#9db08a"], [1, "#4f6646"]],
    sun: { x: 380, d: 110, lift: 0.3, core: "#f2f5d8", glow: "rgba(236,246,200,0.45)", glowR: 60, glowS: 14, halo: "#e4eec2", haloD: 560, reflect: "#edf2d2" },
    decos: [
      {
        // set low, their feet below the horizon, so the sun's top half clears them
        layer: "sky", motion: "rise", x: 0, y: 300, w: 1280, h: 200,
        shapes: [
          { d: "M0 200L0 118Q110 56 220 92Q330 24 450 80Q560 122 650 66Q740 30 840 104L900 200Z", fill: "rgba(58,90,70,0.45)" },
          { d: "M360 200L360 150Q500 96 630 138Q760 84 890 128Q1010 64 1130 116Q1210 140 1280 106L1280 200Z", fill: "rgba(24,50,36,0.62)" },
        ],
      },
    ],
  },
  // Lisen: a small cold sun among glacier peaks, and a ringed planet sliding in from the right
  lisen: {
    sky: [[0, "#1a2142"], [0.35, "#263463"], [0.7, "#4b67a3"], [1, "#b4cfee"]],
    water: [[0, "#5d78ad"], [1, "#1d2850"]],
    sun: { x: 400, d: 80, lift: 0.22, core: "#eef6ff", glow: "rgba(196,222,255,0.6)", glowR: 70, glowS: 18, halo: "#c8dcff", haloD: 520, reflect: "#e4efff" },
    decos: [
      {
        layer: "sky", motion: "rise", x: 460, y: 300, w: 520, h: 160,
        shapes: [
          { d: "M40 160L120 72L132 160ZM330 160L408 82L420 160ZM150 160L262 18L282 160Z", fill: "rgba(238,246,255,0.94)" },
          { d: "M120 72L204 160L132 160ZM408 82L498 160L420 160ZM262 18L392 160L282 160Z", fill: "rgba(155,181,222,0.9)" },
        ],
      },
      {
        layer: "sky", motion: "slideR", x: 1010, y: 80, w: 220, h: 130,
        shapes: [
          { d: "M33.1 87.05A80 18 -16 0 1 186.9 42.95", stroke: "rgba(225,238,255,0.7)", w: 3 },
          { d: circle(110, 65, 34), fill: "#b9cbec" },
          { d: circle(101, 56, 19), fill: "rgba(242,247,255,0.7)" },
          { d: "M186.9 42.95A80 18 -16 0 1 33.1 87.05", stroke: "rgba(225,238,255,0.92)", w: 3 },
        ],
      },
    ],
  },
  // Yune: a vivid neon sun almost set on the left, and a skyline rising on the right
  yune: {
    sky: [[0, "#2a2150"], [0.45, "#47367e"], [0.75, "#6a4ea6"], [1, "#e08bb8"]],
    water: [[0, "#8a5aa8"], [1, "#2a1f4c"]],
    sun: { x: 250, d: 150, lift: 0.06, core: "#ff9bdc", glow: "rgba(255,100,210,0.62)", glowR: 100, glowS: 30, halo: "#ff72cc", haloD: 820, reflect: "#ffb0e4" },
    decos: [
      {
        layer: "sky", motion: "rise", x: 700, y: 290, w: 540, h: 170,
        shapes: [
          { d: TOWERS.map(([x, h, w]) => rect(x, 170 - h, w, h)).join("") + rect(202, 0, 2, 10), fill: "rgba(28,18,54,0.92)" },
          { d: circle(203, 2, 2.5), fill: "#ff5a78" },
          { d: windows(PINK), fill: "#ff6fd0" },
          { d: windows(CYAN), fill: "#6fe6ff" },
        ],
      },
    ],
  },
  // Peli: a gentle blush sun low over a peony sky and a rose sea
  peli: {
    sky: [[0, "#cdb0e0"], [0.5, "#ec9fb2"], [1, "#ffdcd6"]],
    water: [[0, "#e8a8b8"], [1, "#b06f8c"]],
    sun: { x: 820, d: 118, lift: 0.26, core: "#fff0f2", glow: "rgba(255,196,212,0.65)", glowR: 90, glowS: 24, halo: "#ffcfdc", haloD: 760, reflect: "#ffe2ea" },
    decos: [],
  },
};

/**
 * The sea's surface: rows of swells, thin and packed near the horizon, long and bold near the
 * viewer. Two layers drift past each other, so the water never repeats a frame. Every wavelength
 * divides the frame width, so a strip twice as wide loops without a seam.
 */
const WAVELENGTHS = [32, 40, 64, 80, 128, 160, 256, 320];
export function seaRows(layer: 0 | 1) {
  return Array.from({ length: 15 }, (_, k) => {
    const t = (k + layer * 0.5) / 15;
    const y = n(3 + 252 * t ** 1.7);
    const len = WAVELENGTHS[Math.min(WAVELENGTHS.length - 1, Math.floor(t * WAVELENGTHS.length))];
    const amp = n((0.5 + 4.5 * t) * (layer ? -1 : 1));
    const halves = Math.ceil((FRAME.w * 2 + len * 2) / (len / 2));
    return {
      d: `M${-len * (1 + layer / 2)} ${y}q${len / 4} ${-amp} ${len / 2} 0${`t${len / 2} 0`.repeat(halves)}`,
      w: n(0.5 + 1.3 * t),
      a: n(0.05 + 0.08 * t),
    };
  });
}

const rgba = (hex: string, a: number) => {
  const v = Number.parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
};

type Ctx = CanvasRenderingContext2D;

function drawDecos(ctx: Ctx, decos: Deco[], layer: Deco["layer"]) {
  for (const d of decos) {
    if (d.layer !== layer) continue;
    ctx.save();
    ctx.translate(d.x, layer === "water" ? FRAME.y + d.y : d.y);
    for (const s of d.shapes) {
      const p = new Path2D(s.d);
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fill(p);
      }
      if (s.stroke) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.w ?? 1;
        ctx.lineCap = "round";
        ctx.stroke(p);
      }
    }
    ctx.restore();
  }
}

/** Paints a theme's scene as it looks once settled, then an optional wash (the light or dark mode dim). */
export function paintScene(ctx: Ctx, id: ThemeId, w: number, h: number, wash?: string) {
  const { sky, water, sun, decos } = SCENES[id];
  const { s, ox, oy } = frameFit(w, h);
  const Y = FRAME.y;
  const lin = (stops: Stops, y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [at, c] of stops) g.addColorStop(at, c);
    return g;
  };
  ctx.save();
  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.fillStyle = lin(sky, -BLEED, Y);
  ctx.fillRect(0, -BLEED, FRAME.w, Y + BLEED);

  const halo = ctx.createRadialGradient(sun.x, Y, 0, sun.x, Y, sun.haloD / 2);
  halo.addColorStop(0, rgba(sun.halo, 0.5));
  halo.addColorStop(0.28, rgba(sun.halo, 0.18));
  halo.addColorStop(0.66, rgba(sun.halo, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(sun.x - sun.haloD / 2, Y - sun.haloD / 2, sun.haloD, sun.haloD);

  const cy = Y - sun.lift * sun.d;
  const r = sun.d / 2;
  ctx.save();
  ctx.shadowColor = sun.glow;
  ctx.shadowBlur = sun.glowR * s;
  ctx.fillStyle = sun.glow;
  ctx.beginPath();
  ctx.arc(sun.x, cy, r + sun.glowS / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(sun.x, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sun.core;
  ctx.fillRect(sun.x - r, cy - r, sun.d, sun.d);
  const shine = ctx.createRadialGradient(sun.x - r * 0.24, cy - r * 0.4, 0, sun.x - r * 0.24, cy - r * 0.4, r * 1.2);
  shine.addColorStop(0, "rgba(255,255,255,0.75)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(sun.x - r, cy - r, sun.d, sun.d);
  if (sun.bands) {
    // the same cuts as the CSS: 9%–15% of every band repeat, from 44% down
    const top = cy - r + sun.d * 0.44;
    const span = sun.d * 0.56;
    ctx.fillStyle = "#d9624f";
    for (let t = 0; t < 1; t += 0.15) ctx.fillRect(sun.x - r, top + span * (t + 0.09), sun.d, span * 0.06);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -BLEED, FRAME.w, Y + BLEED);
  ctx.clip();
  drawDecos(ctx, decos, "sky");
  ctx.restore();
  const haze = ctx.createLinearGradient(0, Y - 60, 0, Y);
  haze.addColorStop(0, "rgba(255,255,255,0)");
  haze.addColorStop(1, "rgba(255,255,255,0.14)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, Y - 60, FRAME.w, 60);

  ctx.fillStyle = lin(water, Y, FRAME.h + BLEED);
  ctx.fillRect(0, Y, FRAME.w, FRAME.h - Y + BLEED);
  const rw = sun.d * 0.8;
  const rh = sun.d * 0.32 + 14;
  ctx.save();
  ctx.translate(sun.x, Y + 1 + rh / 2);
  ctx.scale(1, rh / rw);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rw / 2);
  glow.addColorStop(0, rgba(sun.reflect, 0.5));
  glow.addColorStop(1, rgba(sun.reflect, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(-rw / 2, -rw / 2, rw, rw);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, Y, FRAME.w, FRAME.h - Y + BLEED);
  ctx.clip();
  drawDecos(ctx, decos, "water");
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fillRect(0, Y - 1, FRAME.w, 1);
  ctx.restore();

  if (wash) {
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
  }
}
