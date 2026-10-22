// Liquid glass from @cruxgarden/plasma-ui. One WebGL canvas sits just above the wallpaper and
// draws only its surfaces (ground "clear"): a plate behind the top bar, one behind the dock, and
// every widget. Each keeps its own smooth shape and refracts the theme's scene behind it.
// Windows stay CSS glass: they overlap, and plasma surfaces fuse instead of stacking.
import { Plasma, PlasmaCanvas, PlasmaProvider, usePlasmaRuntime } from "@cruxgarden/plasma-ui";
import { themes } from "@lupinos/ui";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { paintScene } from "./scene";
import type * as os from "./store";

/**
 * The Aqua preset from the Plasma UI playground: clear as water, every sheen off, only the lens
 * remains. Changed from it: no hairline, so the border is transparent; a soft shadow under each
 * surface (elevation) is what tells it from the scene; the edges flow, which looks like water
 * now that no line runs along them to tear; and a softer lens with a smoothed outline.
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
  edgeLine: 0,
  rimWidth: 1,
  backgroundBlur: 0,
  viscosity: 0.35,
  stretch: 1,
  // a slow breath, not a wobble: higher, the noise behind it shows as bumps on the outline
  flow: 0.2,
  blend: 40,
  // Plasma cuts the outline from a half-resolution mask; at 1x screens the edge stair-steps unless
  // that mask is blurred wider, and a strong lens and colour split trace every step in light.
  refraction: 1.1,
  dispersion: 0.6,
  smoothness: 1.6,
  elevation: 0.32,
  ambientDrops: false,
} as const;

const LiquidContext = createContext(false);
/** True inside the liquid layer: widgets then render as plasma surfaces. */
export const useLiquid = () => useContext(LiquidContext);

/** The picture the surfaces refract: the theme's scene, or the uploaded image or video itself. */
function useBackground(settings: os.Settings, mode: "light" | "dark") {
  const [scene, setScene] = useState<ImageBitmap | null>(null);
  const [upload, setUpload] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const painted = useRef(false);
  useEffect(() => {
    let gone = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const paint = () => {
      const t = themes[settings.theme];
      // Screen size at 1x, capped. A still bitmap goes to the GPU once (a canvas would be sent
      // every frame), so it can be sharp enough for the glass to look clear.
      const k = Math.min(1, 1600 / innerWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(innerWidth * k);
      c.height = Math.round(innerHeight * k);
      const ctx = c.getContext("2d");
      // Before the first layout the window can measure 0, and a 0-wide bitmap throws. A resize retries.
      if (!ctx || !c.width || !c.height) return;
      // The same dim the CSS wallpaper gets when a theme runs in its other mode.
      const wash = t.mode === mode ? undefined : mode === "dark" ? "rgba(10,8,14,0.4)" : "rgba(255,255,255,0.2)";
      paintScene(ctx, settings.theme, c.width, c.height, wash);
      createImageBitmap(c).then((bmp) => !gone && setScene(bmp));
    };
    // After a theme switch the glass takes the new scene as the sun lands, not as it sets off.
    if (painted.current) timer = setTimeout(paint, 900);
    else paint();
    painted.current = true;
    const resize = () => {
      clearTimeout(timer);
      timer = setTimeout(paint, 250);
    };
    addEventListener("resize", resize);
    return () => {
      gone = true;
      clearTimeout(timer);
      removeEventListener("resize", resize);
    };
  }, [settings.theme, mode]);
  useEffect(() => {
    if (settings.wallpaper === "theme") return setUpload(null);
    const t = setTimeout(() => setUpload(document.querySelector<HTMLImageElement | HTMLVideoElement>(".lui-wallpaper > img, .lui-wallpaper > video")), 300);
    return () => clearTimeout(t);
  }, [settings.wallpaper]);
  return upload ?? scene ?? undefined;
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

/** Draw at the screen's real density (capped): at 1x on a HiDPI screen the hairline edge breaks up. */
const density = () => (typeof devicePixelRatio === "number" ? Math.min(2, Math.max(1, devicePixelRatio)) : 1);

/**
 * Liquid chrome, for a window: a surface a few pixels larger than the window, so its rim and lens
 * show around the edge. The window keeps a light blur of its own for what lies under it. Placed
 * inside the window (CSS sets its inset), so it follows every drag, resize and flight.
 */
export function LiquidWindow({ radius }: { radius: number }) {
  return <Plasma aria-hidden="true" className="liquid-window" radius={radius + 6} lean={false} fuse={false} formOut />;
}

/**
 * Liquid chrome, for menus: they open above the windows, where the desktop's liquid layer cannot
 * reach, so a second, clear canvas sits just under the menus and floats each open one on liquid.
 * Menus announce themselves with the "lui-menu" event.
 */
export function LiquidMenus({ settings, mode }: { settings: os.Settings; mode: "light" | "dark" }) {
  const background = useBackground(settings, mode);
  const [menus, setMenus] = useState<{ el: Element; key: number; box: DOMRect }[]>([]);
  useEffect(() => {
    let key = 0;
    const on = (e: Event) => {
      const { el, open } = (e as CustomEvent<{ el: Element | null; open: boolean }>).detail;
      if (!el) return;
      setMenus((list) => {
        const rest = list.filter((m) => m.el !== el);
        if (!open || !el.isConnected) return rest;
        const known = list.find((m) => m.el === el);
        return [...rest, { el, key: known?.key ?? ++key, box: el.getBoundingClientRect() }];
      });
    };
    addEventListener("lui-menu", on);
    return () => removeEventListener("lui-menu", on);
  }, []);
  return (
    <PlasmaProvider canvas={false} ground="clear" background={background} theme={mode} radius={12} pointerDrop={false} quality={density()} maxSurfaces={6} {...AQUA} formSpeed={2}>
      <PlasmaCanvas zIndex={8990} className="liquid-canvas" />
      {menus.map(({ key, box }) => (
        <Plasma
          key={key}
          aria-hidden="true"
          className="liquid-plate"
          radius={12}
          lean={false}
          fuse={false}
          formOut
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      ))}
    </PlasmaProvider>
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
  if (!on) return <LiquidContext.Provider value={false}>{children}</LiquidContext.Provider>;
  return (
    <PlasmaProvider
      canvas={false}
      ground="clear"
      background={background}
      theme={mode}
      radius={18}
      pointerDrop={false}
      quality={density()}
      // room for a liquid rim on several windows when the chrome is liquid
      maxSurfaces={settings.chrome === "liquid" ? 18 : 12}
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
