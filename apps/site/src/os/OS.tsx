// The one React island. Boot, a short welcome, then straight to the desktop as the last user
// (or Guest). Picks the shell, sets the theme, and keeps the URL in step with the focused window.
import { LupinRoot } from "@lupinos/ui";
import "@lupinos/ui/styles.css";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { effectiveMode, effectiveMotion, onKey, openPath, panic } from "./actions";
import { routeFor } from "./apps";
import { Desktop } from "./Desktop";
import { Mobile } from "./Mobile";
import { Overlays } from "./Overlays";
import { Boot, Greeting, Off, Panic, PhoneLock, Saver, UserPicker } from "./Power";
import { moment, startFun } from "./fun";
import { startVisitLog } from "./net";
import * as os from "./store";
import { pathOf } from "./vfs";
import { DesktopWallpaper } from "./Wallpaper";
import "./styles.css";

type Shell = "desktop" | "tablet" | "phone";

const phoneQ = "(max-width: 639px)";
const tabletQ = "(max-width: 1023px), (pointer: coarse) and (max-width: 1366px)";

/** Picked by screen width and pointer type, not device name. Switches live on resize or rotation. */
function useShell(): Shell {
  return useSyncExternalStore(
    (cb) => {
      addEventListener("resize", cb);
      return () => removeEventListener("resize", cb);
    },
    () => (matchMedia(phoneQ).matches ? "phone" : matchMedia(tabletQ).matches ? "tablet" : "desktop"),
  );
}

/** Re-render when the system light/dark or reduced-motion setting changes. */
function useSystemPrefs() {
  const [, force] = useState(0);
  useEffect(() => {
    const qs = [matchMedia("(prefers-color-scheme: dark)"), matchMedia("(prefers-reduced-motion: reduce)")];
    const f = () => force((n) => n + 1);
    for (const q of qs) q.addEventListener("change", f);
    return () => {
      for (const q of qs) q.removeEventListener("change", f);
    };
  }, []);
}

/** Who the welcome screen greets: the last local user without a PIN, otherwise Guest. */
const autoUser = () => {
  const last = os.userById(os.useOS.getState().lastUser);
  return last && !last.pin ? last : os.GUEST;
};

export default function OS() {
  const power = os.useOS((s) => s.power);
  const hydrated = os.useOS((s) => s.hydrated);
  const fx = os.useOS((s) => s.fx);
  const akira = os.useOS((s) => s.akira);
  const current = os.useOS((s) => s.current);
  const lastUser = os.useOS((s) => s.lastUser);
  const sessions = os.useOS((s) => s.sessions);
  const sess = os.useSession();
  const shell = useShell();
  const [idle, setIdle] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const deepLink = useRef(location.pathname.startsWith("/app/") ? location.pathname : null);
  useSystemPrefs();

  // Before anyone is signed in, screens wear the last user's theme.
  const settings = sess?.settings ?? (lastUser ? sessions[lastUser]?.settings : undefined) ?? os.defaultSettings();
  const user = os.userById(current);

  // Deep links skip the boot and open their window straight away.
  useEffect(() => {
    if (!hydrated || !deepLink.current) return;
    os.login(autoUser().id, { intro: false });
    openPath(deepLink.current);
    deepLink.current = null;
  }, [hydrated]);

  useEffect(() => {
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (power === "lock") setUnlocked(false);
  }, [power]);

  // Idle for 60 seconds on the desktop starts the screensaver.
  useEffect(() => {
    if (power !== "desktop") return;
    let t = setTimeout(() => setIdle(true), 60_000);
    const poke = () => {
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 60_000);
    };
    const evs = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"];
    for (const e of evs) addEventListener(e, poke, { passive: true });
    // A rare kernel panic, at most once per sign-in.
    const p = Math.random() < 0.02 ? setTimeout(panic, 45_000) : undefined;
    return () => {
      clearTimeout(t);
      clearTimeout(p);
      for (const e of evs) removeEventListener(e, poke);
    };
  }, [power]);

  // Once someone reaches the desktop, the visit log starts (when an API is configured).
  useEffect(() => {
    if (power !== "desktop") return;
    startVisitLog({ device: shell, theme: settings.theme });
    startFun();
  }, [power, shell, settings.theme]);

  // The address bar follows the focused window, so any window can be shared as a link.
  const top = os.topWindow(sess);
  useEffect(() => {
    if (power !== "desktop" || !sess) return;
    const route = top ? routeFor(top.app, top.app === "files" && top.arg ? pathOf(os.nodesOf(sess), top.arg) : top.arg) : "/";
    if (location.pathname !== route) history.replaceState(null, "", route);
    document.title = top ? `${top.title} · LupinOS` : "LupinOS";
  }, [top, power, sess]);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const wake = useCallback(() => setIdle(false), []);
  const signIn = useCallback(() => os.login(autoUser().id), []);

  let screen: ReactNode;
  if (power === "boot") screen = <Boot onDone={() => os.setPower("welcome")} />;
  else if (power === "welcome") screen = <Greeting user={autoUser()} settings={settings} mode={effectiveMode(settings)} onDone={signIn} />;
  else if (power === "off") screen = <Off />;
  else if (power === "panic") screen = <Panic />;
  else if (power === "lock" || !sess || !user)
    screen = shell === "phone" && !unlocked ? <PhoneLock onUnlock={() => setUnlocked(true)} /> : <UserPicker />;
  else
    screen = (
      <>
        <DesktopWallpaper id={settings.wallpaper} nodes={sess.nodes} />
        {shell === "desktop" ? <Desktop sess={sess} user={user} /> : <Mobile sess={sess} shell={shell} />}
        {idle && <Saver onWake={wake} />}
      </>
    );

  return (
    <LupinRoot
      className={`os${fx === "crt" ? " crt" : ""}`}
      theme={settings.theme}
      mode={effectiveMode(settings)}
      motion={effectiveMotion(settings)}
      data-shell={shell}
      data-icons={settings.iconSize}
      data-cursor={settings.plainCursor ? "plain" : undefined}
      data-akira={akira || undefined}
      data-moment={moment() ?? undefined}
      lang={settings.lang}
      // Settings knobs go straight onto the package tokens, so every window and panel follows.
      style={
        {
          "--lui-font-face": settings.font || undefined,
          "--lui-ink": settings.textColor || undefined,
          "--lui-text-scale": settings.textScale,
          "--lui-glass": settings.glass,
          "--lui-blur": `${settings.blur}px`,
          "--lui-shadow-k": settings.shadow,
          "--lui-r-window": `${settings.radius}px`,
          "--dock-space": `${settings.dockSize + 28}px`,
        } as CSSProperties
      }
    >
      {screen}
      {(power === "desktop" || power === "lock") && <Overlays />}
    </LupinRoot>
  );
}
