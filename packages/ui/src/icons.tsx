// Two icon sets.
// AppIcon: solid flat 2D app icons with no outlines, coloured by the theme's four icon tones
//   (--lui-i1 accent, --lui-i2 deep, --lui-i3 paper, --lui-i4 ink). No tile behind them.
// UiIcon: line glyphs for menus, toolbars and the status area. Each one animates when the
//   button or link holding it is hovered.
import type { CSSProperties, ReactNode, SVGProps } from "react";

const t = (n: 1 | 2 | 3 | 4, opacity?: number): CSSProperties => ({ fill: `var(--lui-i${n})`, opacity });

const folderBack = <path style={t(2)} d="M6 13.5A3.5 3.5 0 0 1 9.5 10h9.3a3 3 0 0 1 2.2 1l2.6 2.8H38.5a3.5 3.5 0 0 1 3.5 3.5V21H6z" />;
const folderFront = (
  <>
    <rect style={t(1)} x="6" y="17.5" width="36" height="21.5" rx="3.5" />
    <rect style={{ fill: "#fff", opacity: 0.22 }} x="6" y="17.5" width="36" height="3" rx="1.5" />
  </>
);
const page = <path style={t(3)} d="M12 5h17.5L38 13.5V40a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" />;
const lines = (y: number) => (
  <>
    <rect style={t(2)} x="14" y={y} width="19" height="2.6" rx="1.3" />
    <rect style={t(2)} x="14" y={y + 5} width="19" height="2.6" rx="1.3" />
    <rect style={t(2, 0.6)} x="14" y={y + 10} width="11" height="2.6" rx="1.3" />
  </>
);
const photo = (
  <>
    <rect style={t(3)} x="5" y="9" width="38" height="30" rx="5" />
    <circle style={t(1)} cx="16" cy="19" r="4.2" />
    <path style={t(2)} d="M5 33.6 15.6 25a2 2 0 0 1 2.5 0l6 5 5.3-4.3a2 2 0 0 1 2.5 0L43 34.2V34a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z" />
  </>
);

const apps: Record<string, ReactNode> = {
  folder: (
    <>
      {folderBack}
      {folderFront}
    </>
  ),
  files: (
    <>
      {folderBack}
      {folderFront}
      <circle style={t(3)} cx="30" cy="29" r="6.5" />
      <circle style={t(1)} cx="30" cy="29" r="3.6" />
      <rect style={t(3)} x="34" y="33.4" width="3.2" height="8" rx="1.6" transform="rotate(-45 35.6 37.4)" />
    </>
  ),
  project: (
    <>
      <rect style={t(2)} x="9" y="7" width="30" height="24" rx="4" transform="rotate(-7 24 19)" />
      <rect style={t(3)} x="6" y="13" width="36" height="28" rx="4.5" />
      <circle style={t(1)} cx="33" cy="21.5" r="3.6" />
      <path style={t(2)} d="M6 35.5 16.5 26a2 2 0 0 1 2.7 0l6.3 5.8 4.4-3.8a2 2 0 0 1 2.6 0L42 36.5v.5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" />
    </>
  ),
  about: (
    <>
      <rect style={t(3)} x="5" y="10" width="38" height="28" rx="5" />
      <circle style={t(1)} cx="17" cy="20.5" r="5" />
      <path style={t(1)} d="M9 33.4c.9-4 3.9-6 8-6s7.1 2 8 6v.6H9z" />
      <rect style={t(2)} x="29" y="17.5" width="10" height="3" rx="1.5" />
      <rect style={t(2)} x="29" y="23.5" width="10" height="3" rx="1.5" />
      <rect style={t(2, 0.6)} x="29" y="29.5" width="6" height="3" rx="1.5" />
    </>
  ),
  resume: (
    <>
      {page}
      <path style={t(2, 0.45)} d="M29.5 5 38 13.5h-6a2.5 2.5 0 0 1-2.5-2.5z" />
      <rect style={t(1)} x="14" y="17" width="14" height="5" rx="2" />
      {lines(26)}
    </>
  ),
  doc: (
    <>
      {page}
      <path style={t(1)} d="M29.5 5 38 13.5h-6a2.5 2.5 0 0 1-2.5-2.5z" />
      {lines(21)}
    </>
  ),
  mail: (
    <>
      <rect style={t(3)} x="5" y="11" width="38" height="27" rx="5" />
      <path style={t(2, 0.28)} d="M5 35.5 19 24l5 4 5-4 14 11.5V33a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z" />
      <path style={t(1)} d="M7.5 13h33l-13.7 11.2a4.4 4.4 0 0 1-5.6 0z" />
    </>
  ),
  terminal: (
    <>
      <rect style={t(4)} x="4" y="8" width="40" height="32" rx="6" />
      <path style={t(1)} d="M12.7 18.3a1.6 1.6 0 0 1 2.3-.1l5.2 4.6a1.6 1.6 0 0 1 0 2.4L15 29.8a1.6 1.6 0 1 1-2.2-2.4l3.9-3.4-3.9-3.4a1.6 1.6 0 0 1-.1-2.3z" />
      <rect style={t(3)} x="22" y="27.6" width="12" height="3.2" rx="1.6" />
    </>
  ),
  settings: (
    <>
      <rect style={t(2)} x="6" y="12" width="36" height="3.4" rx="1.7" />
      <rect style={t(2)} x="6" y="22.3" width="36" height="3.4" rx="1.7" />
      <rect style={t(2)} x="6" y="32.6" width="36" height="3.4" rx="1.7" />
      <circle style={t(1)} cx="16" cy="13.7" r="5.2" />
      <circle style={t(3)} cx="31" cy="24" r="5.2" />
      <circle style={t(3)} cx="20" cy="34.3" r="5.2" />
    </>
  ),
  music: (
    <>
      <path style={t(2)} d="M17 12.2 38 7.5v5.4l-21 4.7z" />
      <rect style={t(2)} x="17" y="13" width="3.2" height="21" rx="1.6" />
      <rect style={t(2)} x="34.8" y="8.5" width="3.2" height="21" rx="1.6" />
      <ellipse style={t(1)} cx="14" cy="34" rx="6.2" ry="5.2" />
      <ellipse style={t(1)} cx="31.8" cy="29.6" rx="6.2" ry="5.2" />
    </>
  ),
  photos: photo,
  image: photo,
  video: (
    <>
      <rect style={t(4)} x="5" y="9" width="38" height="30" rx="5" />
      <path style={t(1)} d="M20 17.5v13a1 1 0 0 0 1.5.9l10.6-6.5a1 1 0 0 0 0-1.8l-10.6-6.5a1 1 0 0 0-1.5.9z" />
    </>
  ),
  games: (
    <>
      <path style={t(3)} d="M15 14h18a9 9 0 0 1 8.8 10.9l-1.4 6.7a4.4 4.4 0 0 1-7.5 2.1L29 29H19l-3.9 4.7a4.4 4.4 0 0 1-7.5-2.1l-1.4-6.7A9 9 0 0 1 15 14z" />
      <rect style={t(2)} x="13" y="19.5" width="3.4" height="11" rx="1.4" />
      <rect style={t(2)} x="9.2" y="23.3" width="11" height="3.4" rx="1.4" />
      <circle style={t(1)} cx="31.5" cy="21.5" r="2.6" />
      <circle style={t(1)} cx="36" cy="26.5" r="2.6" />
    </>
  ),
  launcher: (
    <>
      <rect style={t(1)} x="7" y="7" width="15" height="15" rx="4.5" />
      <rect style={t(3)} x="26" y="7" width="15" height="15" rx="4.5" />
      <rect style={t(3)} x="7" y="26" width="15" height="15" rx="4.5" />
      <rect style={t(3)} x="26" y="26" width="15" height="15" rx="4.5" />
    </>
  ),
  trash: (
    <>
      <rect style={t(2)} x="9" y="9.5" width="30" height="5" rx="2.5" />
      <rect style={t(2)} x="19" y="5.5" width="10" height="5.5" rx="2" />
      <path style={t(3)} d="M11 16.5h26l-2 23a4 4 0 0 1-4 3.7H17a4 4 0 0 1-4-3.7z" />
      <rect style={t(2, 0.45)} x="18.4" y="21.5" width="2.8" height="15.5" rx="1.4" />
      <rect style={t(2, 0.45)} x="26.8" y="21.5" width="2.8" height="15.5" rx="1.4" />
    </>
  ),
  user: (
    <>
      <circle style={t(1)} cx="24" cy="17" r="8" />
      <path style={t(3)} d="M8 41c1.6-8.5 7.6-13 16-13s14.4 4.5 16 13z" />
    </>
  ),
};

const aliases: Record<string, string> = { contact: "mail", file: "doc", viewer: "doc", about: "about", txt: "doc", pdf: "resume" };

export const appIconNames = Object.keys(apps);

export type AppIconProps = SVGProps<SVGSVGElement> & { name: string; size?: number | string };

/** A solid app icon. Unknown names fall back to a document. */
export function AppIcon({ name, size, ...rest }: AppIconProps) {
  const glyph = apps[name] ?? apps[aliases[name] ?? "doc"] ?? apps.doc;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" {...rest}>
      {glyph}
    </svg>
  );
}

// ---- interface glyphs -------------------------------------------------------------------

const ui: Record<string, ReactNode> = {
  wifi: (
    <>
      <path className="a3" d="M3.5 9.2a12.5 12.5 0 0 1 17 0" />
      <path className="a2" d="M6.6 12.6a8 8 0 0 1 10.8 0" />
      <path className="a1" d="M9.8 16a3.4 3.4 0 0 1 4.4 0" />
      <circle cx="12" cy="18.7" r=".6" fill="currentColor" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="7.5" width="17" height="9" rx="2.6" />
      <rect className="fill" x="4.6" y="9.6" width="10" height="4.8" rx="1.2" fill="currentColor" stroke="none" />
      <path d="M21.5 10.6v2.8" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.5h3l4.5-4v13L7 14.5H4z" fill="currentColor" />
      <path className="w1" d="M15 9.5a3.5 3.5 0 0 1 0 5" />
      <path className="w2" d="M17.8 7a7.5 7.5 0 0 1 0 10" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6" />
    </>
  ),
  home: (
    <>
      <path className="roof" d="M3.5 11 12 4l8.5 7" />
      <path d="M6 9.5V20h12V9.5M10 20v-5.5h4V20" />
    </>
  ),
  trash: (
    <>
      <path className="lid" d="M4 6.5h16M9.5 6.5V4.5h5v2" />
      <path d="M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2H19a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <path className="flap" d="M3.5 10.5h17" />
    </>
  ),
  doc: (
    <>
      <path d="M6.5 3h7.5l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4.5h4.5M8.5 12.5h7M8.5 16h5" />
    </>
  ),
  grid: (
    <>
      <rect className="c" x="4" y="4" width="7" height="7" rx="1.5" />
      <rect className="c" x="13" y="4" width="7" height="7" rx="1.5" />
      <rect className="c" x="4" y="13" width="7" height="7" rx="1.5" />
      <rect className="c" x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  list: (
    <>
      <path className="l" d="M9 6.5h11M4.5 6.5h.01" />
      <path className="l" d="M9 12h11M4.5 12h.01" />
      <path className="l" d="M9 17.5h11M4.5 17.5h.01" />
    </>
  ),
  "chevron-left": <path d="M14.5 5.5 8 12l6.5 6.5" />,
  "chevron-right": <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path className="flap" d="M4 6.5l8 6.2 8-6.2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path className="shackle" d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  power: <path d="M12 3.5v8M7.2 6.3a7.5 7.5 0 1 0 9.6 0" />,
  download: (
    <>
      <path className="arrow" d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  sparkle: <path d="M12 3.5l1.9 5.6L19.5 11l-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M7 10l3 2.5L7 15M12.5 15.5H17" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M9 4.5v15" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  display: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  motion: <path d="M3.5 12h3l2.5-6 4 12 2.5-6h5" />,
  accessibility: (
    <>
      <circle cx="12" cy="4.8" r="1.6" />
      <path d="M5 8.5l7 1.5 7-1.5M12 10v4.5M12 14.5 9 20.5M12 14.5l3 6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.2 3.6 8.5s-1 6.1-3.6 8.5c-2.6-2.4-3.6-5.2-3.6-8.5s1-6.1 3.6-8.5z" />
    </>
  ),
  text: <path d="M4 18.5 8.5 6.5 13 18.5M5.7 14h5.6M15 11.2c.5-1 1.5-1.6 2.7-1.6 1.6 0 2.6 1 2.6 2.6v6.3M20.3 14.6c-3.6 0-5.6.8-5.6 2.4 0 1 .8 1.7 2 1.7 1.8 0 3.6-1.3 3.6-3.5" />,
};

export const uiIconNames = Object.keys(ui);

export type UiIconProps = SVGProps<SVGSVGElement> & { name: string; size?: number | string };

/** A line glyph sized to the font (1em) by default. Animates when its button is hovered. */
export function UiIcon({ name, size, className, ...rest }: UiIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className ? `lui-ui-icon ${className}` : "lui-ui-icon"}
      data-name={name}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {ui[name] ?? ui.info}
    </svg>
  );
}
