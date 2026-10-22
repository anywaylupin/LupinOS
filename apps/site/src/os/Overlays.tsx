// Everything that floats above the windows: search, shortcuts, the window switcher, the app
// launcher, notifications, alert dialogs and the glyph rain.
import { AppIcon, CommandPalette, type MenuItem, type PaletteItem, Toasts, UiIcon, useContextMenu } from "@lupinos/ui";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { commands, openNode, shortcuts } from "./actions";
import { apps } from "./apps";
import * as os from "./store";
import { nodeIcon, rectOf } from "./ui";
import { useT } from "./i18n";
import { pathOf } from "./vfs";
import { WidgetGallery } from "./Widgets";
import { dialogSwaps } from "./fun";

function Search() {
  const sess = os.useSession();
  const open = os.useOS((s) => s.overlay === "search");
  const items = useMemo<PaletteItem[]>(() => {
    const nodes = os.nodesOf(sess);
    return [
      ...Object.values(apps)
        .filter((a) => !a.hidden)
        .map((a) => ({ id: `app-${a.id}`, label: a.name, section: "Applications", hint: "App", icon: <AppIcon name={a.icon} />, onSelect: () => os.open(a.id) })),
      ...nodes
        .filter((n) => n.parent && !n.hidden && !n.trashedAt && !sess?.hiddenIds.includes(n.id))
        .map((n) => ({ id: `node-${n.id}`, label: n.name, section: "Files", hint: pathOf(nodes, n.id), icon: <AppIcon name={nodeIcon(n)} />, onSelect: () => openNode(n) })),
      ...commands().map((c) => ({
        id: `cmd-${c.id}`,
        label: c.label,
        section: "Commands",
        hint: c.kbd,
        icon: <span className="palette-cmd"><UiIcon name="sparkle" /></span>,
        onSelect: c.run,
      })),
    ];
  }, [sess]);
  return (
    <CommandPalette
      open={open}
      onClose={() => os.setOverlay(null)}
      items={items}
      suggestions={items.filter((i) => i.section === "Applications")}
      placeholder="Search apps, files and commands"
      emptyText="Nothing found"
    />
  );
}

function Shortcuts() {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking outside the sheet closes it
    <div className="scrim" onPointerDown={() => os.setOverlay(null)}>
      <div className="sheet" role="dialog" aria-label="Keyboard shortcuts">
        <h2>Keyboard Shortcuts</h2>
        <div className="keys">
          {shortcuts.map(([k, d]) => (
            <div key={k} className="key-row">
              <span>{d}</span>
              <kbd>{k}</kbd>
            </div>
          ))}
        </div>
        <p className="muted">On a Mac, Cmd stands in for Ctrl and Option for Alt.</p>
      </div>
    </div>
  );
}

/** Alt+` cycles through windows while Alt is held; letting go picks one. */
function Switcher() {
  const sess = os.useSession();
  const wins = useMemo(() => [...(sess?.windows ?? [])].sort((a, b) => b.z - a.z), [sess?.windows]);
  const [i, setI] = useState(wins.length > 1 ? 1 : 0);
  const iRef = useRef(i);
  iRef.current = i;
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Backquote") {
        e.preventDefault();
        setI((v) => (v + (e.shiftKey ? -1 : 1) + wins.length) % Math.max(1, wins.length));
      } else if (e.code === "Escape") os.setOverlay(null);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      const w = wins[iRef.current];
      os.setOverlay(null);
      if (w) {
        os.setWs(w.ws);
        os.focus(w.id);
      }
    };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    if (!wins.length) setTimeout(() => os.setOverlay(null), 500);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
    };
  }, [wins]);
  return (
    <div className="scrim center">
      <div className="switcher" role="listbox" aria-label="Open windows">
        {wins.length === 0 && <p className="muted">No open windows</p>}
        {wins.map((w, k) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: Alt+` drives this list
          <div
            key={w.id}
            role="option"
            aria-selected={k === i}
            onClick={() => {
              os.setOverlay(null);
              os.setWs(w.ws);
              os.focus(w.id);
            }}
          >
            <AppIcon name={apps[w.app].icon} />
            <span>{w.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Launcher() {
  const t = useT();
  const [q, setQ] = useState("");
  const list = Object.values(apps).filter((a) => !a.hidden && a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking empty space closes the launcher
    <div className="launcher" role="dialog" aria-label="All apps" onPointerDown={(e) => e.target === e.currentTarget && os.setOverlay(null)}>
      <input
        className="lui-field launcher-search"
        // biome-ignore lint/a11y/noAutofocus: typing filters the apps straight away
        autoFocus
        placeholder={t("Search")}
        aria-label={t("Search")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && list[0] && (os.setOverlay(null), os.open(list[0].id))}
      />
      <div className="launcher-grid">
        {list.map((a, i) => (
          <button
            key={a.id}
            type="button"
            className="launcher-app"
            data-app={a.id}
            style={{ "--i": i } as CSSProperties}
            onClick={(e) => {
              os.setOverlay(null);
              os.open(a.id, { from: rectOf(e.currentTarget.firstElementChild) });
            }}
          >
            <AppIcon name={a.icon} />
            <span>{t(a.name)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The helper bee prank: a pop-up offer of help. Close it, or never see it again. */
function HelperBee() {
  const close = () => os.useOS.setState({ prank: null });
  return (
    <aside className="helper-bee" role="dialog" aria-label="Helper bee">
      {/* The block bee: rounded bars like the LupinOS mark, the red square for an eye, an L for an antenna. */}
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <g className="bee-wing">
          <rect x="19" y="5" width="14" height="21" rx="6" transform="rotate(-18 26 15.5)" />
        </g>
        <g className="bee-wing">
          <rect x="31" y="7" width="13" height="19" rx="6" transform="rotate(16 37.5 16.5)" />
        </g>
        <path className="bee-ink" d="M5 38 11 35.5v5z" />
        <rect x="10" y="25" width="34" height="26" rx="9" fill="#f5c542" />
        <path d="M20 25h5.5v26H20zM30 25h5.5v26H30z" fill="#1f1a14" />
        <rect x="42" y="27" width="16" height="20" rx="5" fill="#1f1a14" stroke="#f5c542" strokeWidth="1.2" />
        <rect x="50" y="32" width="4.5" height="4.5" rx="1" fill="#e5484d" />
        <path className="bee-antenna" d="M50 27 53 20h3.5" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <strong>It looks like you are hiring.</strong>
        <p>Need help? I can open the resume or the contact form.</p>
        <div className="row">
          <button type="button" className="lui-button" data-variant="primary" onClick={() => (close(), os.open("resume"))}>
            Show the resume
          </button>
          <button type="button" className="lui-button" onClick={() => (close(), os.open("contact"))}>
            Contact
          </button>
          <button type="button" className="lui-button" data-variant="plain" onClick={() => (close(), os.setSettings({ serious: true }))}>
            Never show again
          </button>
        </div>
      </div>
      <button type="button" className="lui-button helper-close" data-variant="plain" data-icon aria-label="Close" onClick={close}>
        <UiIcon name="close" />
      </button>
    </aside>
  );
}

function Notifications() {
  const toasts = os.useOS((s) => s.toasts);
  const notes = os.useOS((s) => s.notes);
  const shown = toasts.flatMap((id) => {
    const n = notes.find((x) => x.id === id);
    return n ? [{ id: n.id, title: n.title, body: n.body, icon: <AppIcon name="settings" className="lui-toast-icon" /> }] : [];
  });
  return <Toasts toasts={shown} onDismiss={os.dismissToast} />;
}

/** A macOS-style alert: icon, title, message, two buttons. Escape cancels. */
function Dialog() {
  const dialog = os.useOS((s) => s.dialog);
  const ref = useRef<HTMLDialogElement>(null);
  const [swapped, setSwapped] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (dialog && d && !d.open) d.showModal();
    // A prank, once per visitor: the buttons trade places. Escape still closes it.
    setSwapped(false);
    if (!dialog || !dialogSwaps()) return;
    const t = setTimeout(() => setSwapped(true), 700);
    return () => clearTimeout(t);
  }, [dialog]);
  if (!dialog) return null;
  return (
    <dialog ref={ref} className="alert" aria-labelledby="alert-title" onClose={os.closeDialog}>
      <AppIcon name="settings" className="alert-icon" />
      <h2 id="alert-title">{dialog.title}</h2>
      <p>{dialog.body}</p>
      <div className="alert-actions" data-swapped={swapped || undefined}>
        <button type="button" className="lui-button" onClick={os.closeDialog}>
          Cancel
        </button>
        <button
          type="button"
          className="lui-button"
          data-variant="primary"
          onClick={() => {
            dialog.run();
            os.closeDialog();
          }}
        >
          {dialog.ok}
        </button>
      </div>
    </dialog>
  );
}

const GLYPHS = "01アイウエオカキ蜂金墨光未来";

function GlyphRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = innerWidth;
    c.height = innerHeight;
    const color = getComputedStyle(c).getPropertyValue("--lui-accent") || "#e4745f";
    const cols = Array.from({ length: Math.ceil(innerWidth / 18) }, () => Math.random() * -40);
    let frame = 0;
    const draw = () => {
      ctx.fillStyle = "rgb(0 0 0 / 0.12)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = color;
      ctx.font = "16px monospace";
      cols.forEach((y, i) => {
        ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * 18, y * 18);
        cols[i] = y * 18 > c.height && Math.random() > 0.97 ? 0 : y + 1;
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="fx" aria-hidden="true" onClick={() => os.useOS.setState({ fx: null })} />;
}

/** What a right-click offers where nothing more specific has a menu of its own. */
function menuFor(el: Element, t: (key: string, vars?: Record<string, string>) => string): MenuItem[] {
  const picked = getSelection()?.toString() ?? "";
  const items: MenuItem[] = picked ? [{ label: t("Copy"), onSelect: () => void navigator.clipboard?.writeText(picked) }, "separator"] : [];
  const app = el.closest<HTMLElement>("[data-app]")?.dataset.app;
  const note = el.closest<HTMLElement>("[data-note], .lui-toast[data-id]");
  const win = el.closest(".lui-window");
  // a window's own controls, so the menu closes, minimises and zooms with the same motion they do
  const press = (kind: string) => () => win?.querySelector<HTMLButtonElement>(`.lui-control[data-kind="${kind}"]`)?.click();
  if (app && apps[app]) {
    const def = apps[app];
    items.push(
      { label: t("Open"), onSelect: () => (os.setOverlay(null), os.open(app)) },
      { label: t("About {name}", { name: t(def.name) }), onSelect: () => os.notify(t(def.name), def.description) },
    );
  } else if (note) {
    const id = note.dataset.note ?? note.dataset.id ?? "";
    items.push({ label: t("Dismiss"), onSelect: () => os.removeNote(id) }, { label: t("Clear All"), onSelect: os.clearNotes });
  } else if (el.closest(".lui-calendar, .nc-today")) {
    items.push(
      { label: t("Copy Today's Date"), onSelect: () => void navigator.clipboard?.writeText(new Date().toLocaleDateString(document.documentElement.lang || undefined, { dateStyle: "full" })) },
      { label: t("Date and Region Settings…"), onSelect: () => os.open("settings", { arg: "language" }) },
    );
  } else if (el.closest(".lui-drawer")) {
    items.push({ label: t("Clear All"), onSelect: os.clearNotes }, { label: t("Settings…"), onSelect: () => os.open("settings") });
  } else if (win) {
    items.push(
      { label: t("Minimise"), onSelect: press("minimize") },
      { label: win.hasAttribute("data-maximized") ? t("Restore") : t("Maximise"), onSelect: press(win.hasAttribute("data-maximized") ? "restore" : "maximize") },
      "separator",
      { label: t("Close"), onSelect: press("close") },
    );
  } else if (el.closest(".lui-menubar")) {
    items.push(
      { label: t("Settings…"), onSelect: () => os.open("settings") },
      { label: t("Keyboard Shortcuts"), onSelect: () => os.setOverlay("shortcuts") },
      "separator",
      { label: t("Lock Screen"), onSelect: os.lock },
    );
  } else {
    items.push(
      { label: t("All Apps"), onSelect: () => os.setOverlay("launcher") },
      { label: t("Change Wallpaper…"), onSelect: () => os.open("settings", { arg: "wallpaper" }) },
      { label: t("Settings…"), onSelect: () => os.open("settings") },
    );
  }
  return items;
}

/**
 * Right-click anywhere. The desktop, dock, widgets and Files open menus of their own; everything
 * else lands here, with a menu that fits what was clicked. Text fields keep the browser's menu,
 * for paste and spelling.
 */
function GlobalMenu() {
  const t = useT();
  const { open, menu } = useContextMenu();
  useEffect(() => {
    const on = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (e.defaultPrevented || !el?.closest || el.closest("input, textarea, [contenteditable='true']")) return;
      open(e, menuFor(el, t));
    };
    addEventListener("contextmenu", on);
    return () => removeEventListener("contextmenu", on);
  }, [open, t]);
  return menu;
}

export function Overlays() {
  const overlay = os.useOS((s) => s.overlay);
  const fx = os.useOS((s) => s.fx);
  const prank = os.useOS((s) => s.prank);
  return (
    <>
      <GlobalMenu />
      {prank === "helper-bee" && <HelperBee />}
      <Search />
      {overlay === "shortcuts" && <Shortcuts />}
      {overlay === "switcher" && <Switcher />}
      {overlay === "launcher" && <Launcher />}
      {overlay === "widgets" && <WidgetGallery />}
      {fx === "matrix" && <GlyphRain />}
      <Notifications />
      <Dialog />
    </>
  );
}
