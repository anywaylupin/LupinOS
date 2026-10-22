// The desktop background: the theme's scene, or a picture or short video the user uploaded.
// Uploads stay in this browser (IndexedDB) and are never sent anywhere.
import { type ThemeId, themeList, Wallpaper } from "@lupinos/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { idbGet } from "./idb";
import { drop, line, pond, shade, step } from "./ripple";
import { type Deco, FRAME, frameFit, gradient, HORIZON, SCENES, seaRows } from "./scene";
import { notify, setSettings, upload, useThemeId } from "./store";
import type { VNode } from "./vfs";

const IDS = themeList.map((t) => t.id);
const SEA = [seaRows(0), seaRows(1)];

function Decoration({ d, on }: { d: Deco; on: boolean }) {
  return (
    <div className="deco" data-motion={d.motion} data-on={on || undefined} style={{ left: d.x, top: d.y, width: d.w, height: d.h }}>
      <div>
        <svg width={d.w} height={d.h} viewBox={`0 0 ${d.w} ${d.h}`}>
          {d.shapes.map((s) => (
            <path key={s.d.slice(0, 40) + (s.fill ?? s.stroke)} d={s.d} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.w} strokeLinecap="round" />
          ))}
        </svg>
      </div>
    </div>
  );
}

/**
 * A theme's scene, as layers in a frame scaled to cover its box. On a theme switch the sky and water
 * crossfade, the sun glides along the horizon to its new spot (dipping a little on the way) while its
 * size, colour, halo and reflection follow, and the decorations leave and arrive: rising from behind
 * the horizon, sliding in from a side, drifting up or unrolling down the water. `theme` pins one scene,
 * as in the Settings previews; without it the scene follows the theme the screens wear.
 */
export function ThemeScene({ theme }: { theme?: ThemeId }) {
  const current = useThemeId();
  const id = theme ?? current;
  const ids = theme ? [theme] : IDS;
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<string>();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const size = () => {
      const { s, ox, oy } = frameFit(el.clientWidth, el.clientHeight);
      setFit(`translate(${ox}px, ${oy}px) scale(${s})`);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Each switch swaps the dip class, which restarts the sun's dip; the first paint has none.
  const [dip, setDip] = useState(0);
  const shown = useRef(id);
  useEffect(() => {
    if (shown.current === id) return;
    shown.current = id;
    setDip((n) => n + 1);
  }, [id]);
  const sun = SCENES[id].sun;
  const glide = { left: sun.x };
  const decos = (layer: Deco["layer"], test: (d: Deco) => boolean = () => true) =>
    ids.flatMap((t) => SCENES[t].decos.filter((d) => d.layer === layer && test(d)).map((d) => <Decoration key={`${t}${d.x}${d.y}`} d={d} on={t === id} />));
  return (
    <div ref={ref} className="scene" aria-hidden="true">
      <div className="scene-frame" style={{ transform: fit, visibility: fit ? undefined : "hidden" }}>
        {ids.map((t) => (
          <div key={t} className="scene-sky" style={{ background: gradient(SCENES[t].sky), opacity: t === id ? 1 : 0 }} />
        ))}
        <div className="scene-halo" style={{ ...glide, width: sun.haloD, height: sun.haloD }}>
          <i style={{ backgroundColor: sun.halo }} />
        </div>
        <div className="scene-sun" style={{ ...glide, top: FRAME.y - sun.lift * sun.d }}>
          <div className={dip ? (dip % 2 ? "scene-dip-a" : "scene-dip-b") : undefined}>
            <div className="scene-disc" style={{ width: sun.d, height: sun.d, backgroundColor: sun.core, boxShadow: `0 0 ${sun.glowR}px ${sun.glowS}px ${sun.glow}` }}>
              <i style={{ opacity: sun.bands ? 1 : 0 }} />
            </div>
          </div>
        </div>
        <div className="scene-wisps">
          <i />
          <i />
          <i />
        </div>
        <div className="scene-band" data-layer="sky">
          {decos("sky")}
        </div>
        <div className="scene-haze" />
        {ids.map((t) => (
          <div key={t} className="scene-water" style={{ background: gradient(SCENES[t].water), opacity: t === id ? 1 : 0 }} />
        ))}
        <div className="scene-band" data-layer="water">
          {/* the landscape that stands on the horizon, mirrored and swaying on the water */}
          <div className="scene-mirror">{decos("sky", (d) => d.y + d.h >= FRAME.y - 20)}</div>
          <div className="scene-sea">
            {SEA.map((rows, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two fixed layers
              <div key={i}>
                <svg width={FRAME.w * 2} height={FRAME.h - FRAME.y} viewBox={`0 0 ${FRAME.w * 2} ${FRAME.h - FRAME.y}`}>
                  {rows.map((r) => (
                    <path key={r.d.slice(0, 24)} d={r.d} fill="none" stroke={`rgba(255,255,255,${r.a})`} strokeWidth={r.w} />
                  ))}
                </svg>
              </div>
            ))}
          </div>
          {decos("water")}
        </div>
        <div className="scene-reflect" style={{ ...glide, width: sun.d * 0.8, height: sun.d * 0.32 + 14 }}>
          <i style={{ backgroundColor: sun.reflect }} />
        </div>
        <div className="scene-horizon" />
      </div>
    </div>
  );
}

/** Screen pixels per ripple cell. Cells are wider than tall, so rings lie flat like water seen from the shore. */
const CELL = { w: 6, h: 2.5 };

/**
 * Ripples on the scene's water. The pointer leaves a faint wake across the empty desktop, a fast
 * downward swipe pushes a long swell (longer the faster it goes), a click drops a small ring, and
 * now and then a drop falls by itself. It runs only while the water moves.
 */
function Ripples() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let p = pond(2, 2);
    let img = ctx.createImageData(2, 2);
    let box = c.getBoundingClientRect();
    let raf = 0;
    const fit = () => {
      box = c.getBoundingClientRect();
      const w = Math.max(8, Math.round(box.width / CELL.w));
      const h = Math.max(8, Math.round(box.height / CELL.h));
      c.width = w;
      c.height = h;
      p = pond(w, h);
      img = ctx.createImageData(w, h);
    };
    let frame = 0;
    const tick = () => {
      // Half speed and bold shading: the water moves less, and what it does is easy to see.
      if (frame++ % 2) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const moving = step(p, 0.955) > 0.4;
      shade(p, img.data, 3.2);
      ctx.putImageData(img, 0, 0);
      if (moving) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        p.cur.fill(0);
        p.prev.fill(0);
        ctx.clearRect(0, 0, c.width, c.height);
      }
    };
    const cell = (x: number, y: number) => [Math.round(((x - box.left) / box.width) * p.w), Math.round(((y - box.top) / box.height) * p.h)];
    const inside = (gx: number, gy: number) => gx >= 1 && gy >= 1 && gx <= p.w - 2 && gy <= p.h - 2;
    const splash = (x: number, y: number, r: number, amount: number) => {
      const [gx, gy] = cell(x, y);
      if (!inside(gx, gy)) return;
      drop(p, gx, gy, r, amount);
      raf ||= requestAnimationFrame(tick);
    };
    // A swell as wide as the swipe was fast: a quick flick pushes a short wave, a hard one a long one.
    const swell = (x: number, y: number, speed: number) => {
      const [gx, gy] = cell(x, y);
      if (!inside(gx, gy)) return;
      line(p, gx, gy, Math.round(Math.min(420, Math.max(30, speed * 90)) / CELL.w), Math.min(60, 20 + speed * 14));
      raf ||= requestAnimationFrame(tick);
    };
    // Only the empty desktop stirs the water, not windows, the dock or widgets.
    const onDesk = (e: PointerEvent) => (e.target as Element | null)?.classList?.contains("desk");
    let last = { x: 0, y: 0, t: 0 };
    let lastSwell = 0;
    const move = (e: PointerEvent) => {
      if (!onDesk(e)) return;
      const d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
      const vy = (e.clientY - last.y) / Math.max(1, e.timeStamp - last.t);
      if (d < 48) return;
      if (vy > 1.1 && e.timeStamp - lastSwell > 140) {
        lastSwell = e.timeStamp;
        swell(e.clientX, e.clientY, vy);
      } else splash(e.clientX, e.clientY, 3, Math.min(30, 10 + d * 0.25));
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };
    const down = (e: PointerEvent) => onDesk(e) && splash(e.clientX, e.clientY, 4, 140);
    const rain = setInterval(() => {
      if (!document.hidden && !raf) splash(box.left + Math.random() * box.width, box.top + box.height * (0.12 + Math.random() * 0.8), 2, 25);
    }, 14000);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerdown", down, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(rain);
      ro.disconnect();
      removeEventListener("pointermove", move);
      removeEventListener("pointerdown", down);
    };
  }, []);
  return <canvas ref={ref} className="ripples" aria-hidden="true" style={{ top: `${HORIZON * 100}%`, height: `${(1 - HORIZON) * 100}%` }} />;
}

export function useBlobUrl(blobKey?: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blobKey) return setUrl(undefined);
    let u: string | undefined;
    idbGet<Blob>(blobKey).then((b) => b && setUrl((u = URL.createObjectURL(b))));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [blobKey]);
  return url;
}

/** `live`: the water answers the pointer. Off on phones and when motion is turned down. */
export function DesktopWallpaper({ id, nodes, live }: { id: string; nodes: VNode[]; live: boolean }) {
  const node = id === "theme" ? undefined : nodes.find((n) => n.id === id && !n.trashedAt);
  const url = useBlobUrl(node?.blob);
  const video = node?.mime?.startsWith("video");
  return (
    <Wallpaper image={url && !video ? url : undefined} video={url && video ? url : undefined}>
      <ThemeScene />
      {live && <Ripples />}
    </Wallpaper>
  );
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;

const videoSeconds = (file: Blob) =>
  new Promise<number>((ok) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      ok(v.duration);
    };
    v.onerror = () => ok(Number.POSITIVE_INFINITY);
    v.src = URL.createObjectURL(file);
  });

/** Checks an upload, shrinks images to the screen size, stores it locally and sets it as wallpaper. */
export async function uploadWallpaper(file: File) {
  const image = file.type.startsWith("image/");
  const video = file.type.startsWith("video/");
  if (!image && !video) return notify("Unsupported file", "Wallpapers must be an image or a short video.");
  if (file.size > MAX_BYTES) return notify("File too large", "Wallpapers can be up to 10 MB.");
  let blob: Blob = file;
  if (video && (await videoSeconds(file)) > MAX_VIDEO_SECONDS) return notify("Video too long", `Keep it under ${MAX_VIDEO_SECONDS} seconds.`);
  if (image && file.type !== "image/gif") {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, (Math.max(innerWidth, innerHeight) * devicePixelRatio) / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
      blob = (await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/webp", 0.88))) ?? file;
    } catch {
      return notify("Could not read that image", "The file may be damaged.");
    }
  }
  const id = await upload(blob, file.name);
  if (id) {
    setSettings({ wallpaper: id });
    notify("Wallpaper set", "Stored in this browser only. Nothing was sent anywhere.");
  }
}
