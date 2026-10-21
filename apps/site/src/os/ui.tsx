// Small helpers the site shares between its screens. Components that anyone can use live in @lupinos/ui.
import { AppIcon } from "@lupinos/ui";
import { type CSSProperties, useEffect, useState } from "react";
import { localeOf } from "./i18n";
import { useOS } from "./store";

/** App icon by name; a thin alias so the site reads like before. */
export const Icon = ({ name, className }: { name: string; className?: string; accent?: boolean }) => <AppIcon name={name} className={className} />;

/** Icon name for a file node. */
export function nodeIcon(n: { kind: string; open?: string; mime?: string; id?: string }) {
  if (n.id === "games") return "games";
  if (n.kind === "folder") return "folder";
  if (n.mime?.startsWith("image")) return "image";
  if (n.mime?.startsWith("video")) return "video";
  if (n.open === "project") return "project";
  if (n.open === "viewer" || !n.open) return "doc";
  return n.open === "contact" ? "mail" : n.open;
}

export function Avatar({ name, hue, size = 64 }: { name: string; hue: number; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`av-${hue}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 45% 62%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 45% 44%)`} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#av-${hue})`} />
      <text x="32" y="41" textAnchor="middle" style={{ fill: "#fff", font: "600 25px -apple-system, 'Segoe UI', system-ui" }}>
        {name.slice(0, 1).toUpperCase()}
      </text>
    </svg>
  );
}

/** The LupinOS mark: a heavy L and one accent square that square off into a landscape rectangle. Each piece slides in on boot. */
export function LupinMark({ size = 96, animate = false }: { size?: number; animate?: boolean }) {
  const parts: [string, string, number, number][] = [
    ["M9 11h9v26H9z", "currentColor", -40, 0],
    ["M9 28h30v9H9z", "currentColor", 0, 40],
    ["M30 11h9v9h-9z", "var(--lui-accent)", 40, -40],
  ];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-label="LupinOS" className={animate ? "mark animate" : "mark"}>
      {parts.map(([d, fill, dx, dy], i) => (
        <path key={d} d={d} fill={fill} style={{ animationDelay: `${i * 0.12}s`, "--dx": `${dx}px`, "--dy": `${dy}px` } as CSSProperties} />
      ))}
    </svg>
  );
}

/** Calls `onOut` on a click outside `ref` or on Escape. Used by popovers that are not menus. */
export function useOutside(ref: { current: HTMLElement | null }, onOut: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onOut();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onOut();
    // Next tick, so the click that opened it does not close it again.
    const t = setTimeout(() => {
      addEventListener("pointerdown", down, true);
      addEventListener("keydown", key);
    });
    return () => {
      clearTimeout(t);
      removeEventListener("pointerdown", down, true);
      removeEventListener("keydown", key);
    };
  }, [ref, onOut, active]);
}

/** Settings of whoever is signed in, or the last user before anyone is. */
const prefs = () => {
  const s = useOS.getState();
  return s.sessions[s.current ?? s.lastUser ?? ""]?.settings;
};

export function clock(d: Date, seconds = false) {
  const p = prefs();
  return d.toLocaleTimeString(localeOf(p?.lang ?? "en"), {
    hour: "2-digit",
    minute: "2-digit",
    ...(p ? { hourCycle: p.clock24 ? "h23" : "h12" } : {}),
    ...(seconds ? { second: "2-digit" } : {}),
  });
}

/** A date in the user language, such as "Tue 20 Oct" or "10月20日 周二". */
export const day = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(localeOf(prefs()?.lang ?? "en"), opts);

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const rectOf = (el: Element | null | undefined) => {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : undefined;
};
