// Liquid glass from @cruxgarden/plasma-ui. One WebGL canvas sits just above the wallpaper and
// draws only its surfaces (ground "clear"): a plate behind the top bar, one behind the dock, and
// every widget. Surfaces close together fuse like liquid; each refracts the theme's own gradient.
// Windows stay CSS glass: they overlap, and plasma surfaces fuse instead of stacking.
import { Plasma, PlasmaCanvas, PlasmaProvider, usePlasmaRuntime } from "@cruxgarden/plasma-ui";
import { themes } from "@lupinos/ui";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { paintWall, parseWall } from "./wallpaint";
import type * as os from "./store";

/**
 * The Aqua preset from the Plasma UI playground: clear as water, every sheen off, only the lens
 * remains. A hairline is what still reads as an edge once the rim is gone. One change: `flow` is
 * off, since its ripple runs along that hairline and reads as a torn edge on fixed chrome.
 */
const AQUA = {
  mood: "tidal",
  tint: "#ffffff",
  opacity: 0,
  frost: 0,
  rim: 0,
  shimmer: 0,
  glow: 0,
  wash: 0,
  grain: 0,
  highlight: 0,
  edgeLine: 0.35,
  rimWidth: 1,
  backgroundBlur: 0,
  viscosity: 0.35,
  stretch: 1,
  flow: 0,
  blend: 40,
  refraction: 1.5,
  dispersion: 1.6,
  smoothness: 1,
  elevation: 0,
  ambientDrops: false,
} as const;

const LiquidContext = createContext(false);
/** True inside the liquid layer: widgets then render as plasma surfaces. */
export const useLiquid = () => useContext(LiquidContext);

/** The picture the surfaces refract: the theme gradient, or the uploaded image or video itself. */
function useBackground(settings: os.Settings, mode: "light" | "dark") {
  const canvas = useMemo(() => (typeof document === "undefined" ? null : document.createElement("canvas")), []);
  const [upload, setUpload] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!canvas) return;
    const t = themes[settings.theme];
    canvas.width = 480;
    canvas.height = Math.round((480 * innerHeight) / innerWidth) || 270;
    const ctx = canvas.getContext("2d");
    // The same dim the CSS wallpaper gets when a theme runs in its other mode.
    const wash = t.mode === mode ? undefined : mode === "dark" ? "rgba(10,8,14,0.4)" : "rgba(255,255,255,0.2)";
    if (ctx) paintWall(ctx, parseWall(t.wallpaper), canvas.width, canvas.height, wash);
  }, [canvas, settings.theme, mode]);
  useEffect(() => {
    if (settings.wallpaper === "theme") return setUpload(null);
    const t = setTimeout(() => setUpload(document.querySelector<HTMLImageElement | HTMLVideoElement>(".lui-wallpaper > img, .lui-wallpaper > video")), 300);
    return () => clearTimeout(t);
  }, [settings.wallpaper]);
  return upload ?? canvas ?? undefined;
}

/** A liquid surface that follows a piece of chrome it cannot wrap, such as the dock. */
function Plate({ selector, radius, fuse = false }: { selector: string; radius: number; fuse?: boolean }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    // Re-measured now and then too: entrance animations and new dock items move the chrome
    // without resizing it. Only a real change re-renders.
    const update = () =>
      setBox((old) => {
        const r = el.getBoundingClientRect();
        return old && old.left === r.left && old.top === r.top && old.width === r.width && old.height === r.height ? old : r;
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    addEventListener("resize", update);
    const tick = setInterval(update, 500);
    return () => {
      ro.disconnect();
      removeEventListener("resize", update);
      clearInterval(tick);
    };
  }, [selector]);
  if (!box) return null;
  return (
    <Plasma
      aria-hidden="true"
      className="liquid-plate"
      radius={radius}
      lean={false}
      fuse={fuse}
      formOut
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  );
}

/** When the welcome drop reaches the card: the release, plus about 0.2 s of the tidal spring's fall. */
export const DROP_MS = 300;
const DROP = 44;

/**
 * The welcome scene: a bead of liquid falls from the top of the screen and lands where the
 * greeting card is; the card's glass then forms around it, fused with the drop like a splash.
 * Leaving lets both shrink away while the card's contents lift off.
 */
export function WelcomeDrop({ leaving, onLanded }: { leaving: boolean; onLanded: () => void }) {
  const [falling, setFalling] = useState(false);
  const [landed, setLanded] = useState(false);
  const { pulse } = usePlasmaRuntime();
  useEffect(() => {
    // A moment at the top first, so the spring has a start to fall from.
    const f = setTimeout(() => setFalling(true), 80);
    const t = setTimeout(() => {
      setLanded(true);
      onLanded();
      // the splash: a ripple runs out from where the drop lands
      pulse(innerWidth / 2, innerHeight / 2, 1);
    }, DROP_MS);
    return () => {
      clearTimeout(f);
      clearTimeout(t);
    };
  }, [onLanded, pulse]);
  if (leaving) return null;
  const top = -Math.round(innerHeight / 2 + DROP);
  return (
    <>
      <Plasma aria-hidden="true" className="welcome-drop" radius={DROP / 2} lean={false} formOut offset={{ x: 0, y: falling ? 0 : top }} />
      {landed && <Plate selector=".greeting-card" radius={28} fuse />}
    </>
  );
}

export function Liquid({
  on,
  settings,
  mode,
  blur = 0,
  children,
}: { on: boolean; settings: os.Settings; mode: "light" | "dark"; blur?: number; children: ReactNode }) {
  const background = useBackground(settings, mode);
  // Draw at the screen's real density (capped): at 1x on a HiDPI screen the hairline edge breaks up.
  const dpr = typeof devicePixelRatio === "number" ? Math.min(2, Math.max(1, devicePixelRatio)) : 1;
  if (!on) return <LiquidContext.Provider value={false}>{children}</LiquidContext.Provider>;
  return (
    <PlasmaProvider
      canvas={false}
      ground="clear"
      background={background}
      theme={mode}
      radius={18}
      pointerDrop={false}
      quality={dpr}
      maxSurfaces={12}
      {...AQUA}
      backgroundBlur={blur}
    >
      <LiquidContext.Provider value>
        <PlasmaCanvas zIndex={0} className="liquid-canvas" />
        {children}
        <Plate selector=".desktop .lui-menubar" radius={0} />
        <Plate selector=".desktop .lui-dock" radius={20} />
      </LiquidContext.Provider>
    </PlasmaProvider>
  );
}
