// The menu bar along the top. Like macOS: click a title to open its menu, then slide across
// the other titles and their menus follow the pointer. Left and right arrows walk the bar.
import { type ReactNode, useRef, useState } from "react";
import { Menu, type MenuItem } from "./Menu.tsx";

export type MenuBarMenu = { label: string; items: MenuItem[] };

export type MenuBarProps = {
  /** The system mark at the far left. */
  logo: ReactNode;
  logoLabel?: string;
  logoItems: MenuItem[];
  /** The focused app's name, shown in bold after the logo. */
  appName: string;
  menus: MenuBarMenu[];
  /** Centre of the bar, such as the clock. */
  center?: ReactNode;
  /** Right side: status items, usually ending in a <StatusCapsule>. */
  status?: ReactNode;
};

export function MenuBar({ logo, logoLabel = "System menu", logoItems, appName, menus, center, status }: MenuBarProps) {
  const all: MenuBarMenu[] = [{ label: logoLabel, items: logoItems }, ...menus];
  const [open, setOpen] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const anchor = open === null ? undefined : refs.current[open]?.getBoundingClientRect();

  const title = (i: number, node: ReactNode, aria?: string) => (
    <button
      key={all[i].label}
      ref={(el) => {
        refs.current[i] = el;
      }}
      type="button"
      className="lui-menubar-item"
      aria-label={aria}
      aria-haspopup="menu"
      aria-expanded={open === i}
      onPointerDown={(e) => {
        e.preventDefault();
        setOpen(open === i ? null : i);
      }}
      onPointerEnter={() => open !== null && open !== i && setOpen(i)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(i);
        }
      }}
    >
      {node}
    </button>
  );

  return (
    <nav className="lui-menubar" aria-label="Menu bar">
      {title(0, logo, logoLabel)}
      <span className="lui-menubar-item lui-menubar-app">{appName}</span>
      {menus.map((m, i) => title(i + 1, m.label))}
      {center && <div className="lui-menubar-center">{center}</div>}
      {status && <div className="lui-menubar-status">{status}</div>}
      {open !== null && anchor && (
        <Menu
          key={open}
          items={all[open].items}
          x={anchor.left}
          y={anchor.bottom + 3}
          label={all[open].label}
          onClose={() => setOpen((cur) => (cur === open ? null : cur))}
          onNavigate={(dir) => setOpen((open + dir + all.length) % all.length)}
        />
      )}
    </nav>
  );
}

/** The rounded group of status items at the right of the menu bar, ending in the clock. */
export function StatusCapsule({ children, onClick, label }: { children: ReactNode; onClick?: () => void; label?: string }) {
  return (
    <button type="button" className="lui-capsule" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
