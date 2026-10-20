// The desktop shell: menu bar, desktop icons, windows on four desktops, and the dock.
// Chrome comes from @lupinos/ui; this file wires it to the store.
import { AppIcon, Calendar, Dock, type DockItem, Drawer, lunarDate, MenuBar, type MenuItem, StatusCapsule, themeList, UiIcon, useContextMenu } from "@lupinos/ui";
import { type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
import { effectiveMode, openNode, restart, shutdown, toggleMode } from "./actions";
import { apps } from "./apps";
import { cellKey, layoutIcons, nearestFree } from "./grid";
import { localeOf, useT } from "./i18n";
import * as os from "./store";
import { clock, day, LupinMark, nodeIcon, rectOf, useNow, useOutside } from "./ui";
import { children, type VNode } from "./vfs";
import { uploadWallpaper } from "./Wallpaper";
import { DesktopWindow } from "./Window";

/** Re-renders on window resize. */
function useViewport() {
  const [v, setV] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const r = () => setV({ w: innerWidth, h: innerHeight });
    addEventListener("resize", r);
    return () => removeEventListener("resize", r);
  }, []);
  return v;
}

// ---- status area ----------------------------------------------------------------------

/** A battery that drains suspiciously fast, then quietly charges again. */
export function useBattery() {
  const [b, setB] = useState({ level: 100, charging: false });
  useEffect(() => {
    const t = setInterval(
      () =>
        setB(({ level, charging }) =>
          charging ? (level >= 100 ? { level: 100, charging: false } : { level: level + 4, charging }) : level <= 8 ? { level, charging: true } : { level: level - 1, charging },
        ),
      2500,
    );
    return () => clearInterval(t);
  }, []);
  return b;
}

export function NotesList() {
  const notes = os.useOS((s) => s.notes);
  const t = useT();
  return (
    <section className="cc-notes" aria-label={t("Notifications")}>
      <header>
        <strong>{t("Notifications")}</strong>
        {notes.length > 0 && (
          <button type="button" className="lui-button" data-variant="plain" onClick={os.clearNotes}>
            {t("Clear")}
          </button>
        )}
      </header>
      {notes.length ? (
        notes.map((n, i) => (
          <div key={n.id} className="cc-note" style={{ "--i": i } as CSSProperties}>
            <AppIcon name="settings" />
            <div>
              <strong>{n.title}</strong>
              {n.body && <p>{n.body}</p>}
            </div>
            <time>{clock(new Date(n.at))}</time>
          </div>
        ))
      ) : (
        <p className="nc-empty">
          <UiIcon name="bell" />
          {t("No notifications")}
        </p>
      )}
    </section>
  );
}

/** Notification centre, like Windows 11: notifications on top, today and the month below. */
function NotificationCentre({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: os.Settings }) {
  const t = useT();
  const now = useNow(30_000);
  const zh = settings.lang !== "en";
  const tz = zh ? "Asia/Shanghai" : "Asia/Ho_Chi_Minh";
  const l = settings.lunar ? lunarDate(now, tz) : undefined;
  return (
    <Drawer open={open} onClose={onClose} label={t("Notifications")} width={364}>
      <div className="nc-card nc-notes">
        <NotesList />
      </div>
      <div className="nc-card nc-today">
        <strong>{day(now, { weekday: "long" })}</strong>
        <span>{day(now, { day: "numeric", month: "long", year: "numeric" })}</span>
        {l && <small>{t("Âm lịch {day}/{month}", { day: String(l.day), month: l.month })}</small>}
      </div>
      <div className="nc-card">
        <Calendar
          locale={localeOf(settings.lang)}
          lunar={settings.lunar}
          lunarTimeZone={tz}
          labels={{ today: t("Today"), previous: t("Previous month"), next: t("Next month") }}
        />
      </div>
    </Drawer>
  );
}

/** Quick settings: Wi-Fi, light and dark, lunar dates, sound and theme. */
function QuickSettings({ sess, onClose }: { sess: os.Session; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  const [volume, setVolume] = useState(60);
  useOutside(ref, onClose);
  const dark = effectiveMode(sess.settings) === "dark";
  return (
    <div ref={ref} className="cc" role="dialog" aria-label={t("Quick Settings")}>
      <div className="cc-tiles">
        <button type="button" className="cc-tile" aria-pressed="true" onClick={() => os.notify("Connected to HIVE-NET", "Signal strength: adequate for compliance.")}>
          <span>
            <UiIcon name="wifi" />
          </span>
          {t("Wi-Fi")}
        </button>
        <button type="button" className="cc-tile" aria-pressed={dark} onClick={toggleMode}>
          <span>
            <UiIcon name={dark ? "moon" : "sun"} />
          </span>
          {dark ? t("Dark") : t("Light")}
        </button>
        <button type="button" className="cc-tile" aria-pressed={sess.settings.lunar} onClick={() => os.setSettings({ lunar: !sess.settings.lunar })}>
          <span>
            <UiIcon name="calendar" />
          </span>
          {t("Lunar calendar")}
        </button>
      </div>
      <label className="cc-slider">
        <span>{t("Sound")}</span>
        <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ "--v": `${volume}%` } as CSSProperties} />
      </label>
      <div className="cc-themes" role="radiogroup" aria-label={t("Theme")}>
        {themeList.map((th) => (
          // biome-ignore lint/a11y/useSemanticElements: round swatches acting as a radio group
          <button
            key={th.id}
            type="button"
            role="radio"
            aria-checked={sess.settings.theme === th.id}
            title={`${th.name} · ${th.hue}`}
            aria-label={`${th.name}, ${th.hue}`}
            style={{ background: th.wallpaper }}
            onClick={() => os.switchTheme(th.id)}
          />
        ))}
      </div>
      <button
        type="button"
        className="cc-more"
        onClick={() => {
          onClose();
          os.open("settings");
        }}
      >
        <UiIcon name="settings" />
        {t("Settings…")}
      </button>
    </div>
  );
}

function StatusArea({ sess }: { sess: os.Session }) {
  const now = useNow();
  const battery = useBattery();
  const notes = os.useOS((s) => s.notes.length);
  const t = useT();
  const [qs, setQs] = useState(false);
  const [nc, setNc] = useState(false);
  return (
    <>
      <button type="button" className="lui-menubar-item" aria-label={t("Search")} onClick={() => os.setOverlay("search")}>
        <UiIcon name="search" />
      </button>
      <StatusCapsule label={t("Quick Settings")} onClick={() => setQs(!qs)}>
        <UiIcon name="wifi" />
        <UiIcon name="volume" />
        <span className="bat">
          <UiIcon name="battery" />
          {battery.level}%
        </span>
      </StatusCapsule>
      <button type="button" className="lui-capsule clock-capsule" aria-label={t("Notifications")} aria-expanded={nc} onClick={() => setNc(!nc)}>
        <span>
          {day(now, { weekday: "short", day: "numeric", month: "short" })} {clock(now)}
        </span>
        {notes > 0 && <i className="nc-dot" aria-hidden="true" />}
      </button>
      {qs && <QuickSettings sess={sess} onClose={() => setQs(false)} />}
      <NotificationCentre open={nc} onClose={() => setNc(false)} settings={sess.settings} />
    </>
  );
}

function TopBar({ sess }: { sess: os.Session }) {
  const t = useT();
  const top = os.topWindow(sess);
  const def = top ? apps[top.app] : undefined;
  const logoItems: MenuItem[] = [
    { label: t("About LupinOS"), onSelect: () => os.open("settings", { arg: "about" }) },
    { label: t("Settings…"), onSelect: () => os.open("settings") },
    "separator",
    { label: t("Show All Apps"), onSelect: () => os.setOverlay("launcher") },
    "separator",
    { label: t("Restart…"), onSelect: () => os.confirmDialog("Restart LupinOS?", "Your windows come back where you left them.", "Restart", restart) },
    { label: t("Shut Down…"), onSelect: () => os.confirmDialog("Shut down LupinOS?", "You can turn it back on from the same tab.", "Shut Down", shutdown) },
    "separator",
    { label: t("Lock Screen"), shortcut: "⌥L", onSelect: os.lock },
    { label: t("Switch User…"), onSelect: os.lock },
  ];
  const menus = [
    {
      label: t("File"),
      items: [
        { label: t("New Window"), disabled: !def?.multi, onSelect: () => def && os.open(def.id) },
        { label: t("New Folder"), onSelect: () => os.createNode("desktop", "untitled folder", { kind: "folder" }) },
        "separator",
        { label: t("Close Window"), shortcut: "⌥Q", disabled: !top, onSelect: () => top && os.close(top.id) },
      ] as MenuItem[],
    },
    {
      label: t("Edit"),
      items: [
        { label: t("Undo"), shortcut: "⌘Z", onSelect: os.undo },
        { label: t("Undo Life Choices"), onSelect: () => os.notify("Request denied", "Life choices are final. Please continue working.") },
      ] as MenuItem[],
    },
    {
      label: t("View"),
      items: [
        { label: t("Light and Dark"), shortcut: "⌥D", onSelect: toggleMode },
        { label: t("Theme"), items: themeList.map((th) => ({ label: `${th.name} · ${th.hue}`, checked: sess.settings.theme === th.id, onSelect: () => os.switchTheme(th.id) })) },
        "separator",
        { label: t("Show Desktop"), onSelect: os.minimizeAll },
      ] as MenuItem[],
    },
    {
      label: t("Go"),
      items: [
        { label: t("Projects"), onSelect: () => os.open("files", { arg: "projects", title: "Projects" }) },
        { label: t("Home"), onSelect: () => os.open("files", { arg: "home", title: "Home" }) },
        { label: t("Files"), shortcut: "⌥E", onSelect: () => os.open("files", { arg: "root" }) },
        { label: t("Terminal"), shortcut: "⌥↩", onSelect: () => os.open("terminal") },
        "separator",
        ...[0, 1, 2, 3].map((i) => ({ label: `${t("Desktop")} ${i + 1}`, shortcut: `⌥${i + 1}`, checked: sess.ws === i, onSelect: () => os.setWs(i) })),
      ] as MenuItem[],
    },
    {
      label: t("Window"),
      items: [
        { label: t("Minimise"), shortcut: "⌥M", disabled: !top, onSelect: () => top && os.minimize(top.id) },
        { label: t("Zoom"), shortcut: "⌥F", disabled: !top, onSelect: () => top && os.toggleMax(top.id) },
        { label: t("Minimise Others"), disabled: !top, onSelect: () => top && os.minimizeOthers(top.id) },
        ...(sess.windows.length ? (["separator"] as MenuItem[]) : []),
        ...sess.windows.map((w) => ({ label: w.title, checked: top?.id === w.id, onSelect: () => (os.setWs(w.ws), os.focus(w.id)) })),
      ] as MenuItem[],
    },
    {
      label: t("Help"),
      items: [
        { label: t("Search"), shortcut: "⌘K", onSelect: () => os.setOverlay("search") },
        { label: t("Keyboard Shortcuts"), shortcut: "⌥/", onSelect: () => os.setOverlay("shortcuts") },
        "separator",
        { label: t("Plain Version"), onSelect: () => location.assign("/plain") },
      ] as MenuItem[],
    },
  ];
  return <MenuBar logo={<LupinMark size={15} />} logoLabel="LupinOS" logoItems={logoItems} appName={def ? t(def.name) : "LupinOS"} menus={menus} status={<StatusArea sess={sess} />} />;
}

// ---- desktop icons ---------------------------------------------------------------------------

type DeskItem = { id: string; name: string; icon: string; node?: VNode; app?: string };

const ICON_PX = { s: 48, m: 60, l: 76 };
const EDGE = 14;

function Icons({ sess }: { sess: os.Session }) {
  const t = useT();
  const nodes = os.nodesOf(sess);
  const [sel, setSel] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [sort, setSort] = useState<"name" | "kind">("name");
  const [band, setBand] = useState<os.Rect | null>(null);
  const [drag, setDrag] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const ctx = useContextMenu();
  const vp = useViewport();

  const projects = nodes.find((n) => n.id === "projects");
  let items: DeskItem[] = children(nodes, "desktop", false, sess.hiddenIds).map((n) => ({ id: n.id, name: n.name, icon: nodeIcon(n), node: n }));
  if (sort === "kind") items.sort((a, b) => a.icon.localeCompare(b.icon));
  items = [
    ...(projects && !sess.hiddenIds.includes("projects") ? [{ id: "projects", name: t("Projects"), icon: "folder", node: projects }] : []),
    ...items,
    { id: "trash", name: t("Trash"), icon: "trash", app: "trash" },
  ];

  // The grid: columns from the right edge, rows from the top, above the dock.
  const px = ICON_PX[sess.settings.iconSize];
  const stepX = px + 46;
  const stepY = px + 48;
  const cols = Math.max(1, Math.floor((vp.w - EDGE * 2) / stepX));
  const rows = Math.max(1, Math.floor((vp.h - 26 - EDGE - (sess.settings.dockSize + 44)) / stepY));
  const cells = layoutIcons(
    items.map((i) => i.id),
    sess.iconPos,
    cols,
    rows,
  );

  const openItem = (it: DeskItem, el: Element) => (it.node ? openNode(it.node, rectOf(el)) : it.app && os.open(it.app, { from: rectOf(el) }));

  const onKey = (e: KeyboardEvent) => {
    if (renaming) return;
    const ids = sel.filter((id) => id !== "trash");
    if (e.key === "Delete" && ids.length) {
      if (e.shiftKey) {
        const mine = ids.filter((id) => !os.isOwnerFile(id));
        if (mine.length) os.confirmDialog("Delete for good?", "These items will not go to the Trash. This cannot be undone.", "Delete", () => os.destroy(mine));
      } else os.trash(ids);
      setSel([]);
    } else if (e.key === "F2" && sel.length === 1) {
      e.preventDefault();
      setRenaming(sel[0]);
    }
  };

  const onBandStart = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    setSel([]);
    const sx = e.clientX;
    const sy = e.clientY;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = { x: Math.min(sx, ev.clientX), y: Math.min(sy, ev.clientY), w: Math.abs(ev.clientX - sx), h: Math.abs(ev.clientY - sy) };
      setBand(r);
      const hit = [...(host.current?.querySelectorAll<HTMLElement>("[data-icon]") ?? [])].filter((i) => {
        const b = i.getBoundingClientRect();
        return b.right > r.x && b.left < r.x + r.w && b.bottom > r.y && b.top < r.y + r.h;
      });
      setSel(hit.map((i) => i.dataset.icon as string));
    };
    const up = () => {
      setBand(null);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  /** Drag an icon (or the whole selection) anywhere. On release it glides into the nearest free cell. */
  const onIconDown = (e: RPointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0 || renaming) return;
    const group = sel.includes(id) ? sel : [id];
    const els = group.map((g) => host.current?.querySelector<HTMLElement>(`[data-icon="${CSS.escape(g)}"]`) ?? null);
    const btn = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    dragged.current = false;
    btn.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) for (const el of els) if (el) el.dataset.dragging = "";
      moved = true;
      for (const el of els) if (el) el.style.translate = `${dx}px ${dy}px`;
    };
    const up = (ev: PointerEvent) => {
      btn.removeEventListener("pointermove", move);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointercancel", up);
      if (!moved) return;
      dragged.current = true;
      setTimeout(() => (dragged.current = false));
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      const dc = -Math.round(dx / stepX);
      const dr = Math.round(dy / stepY);
      const next = { ...cells };
      const taken = new Set(Object.entries(cells).flatMap(([k, c]) => (group.includes(k) ? [] : [cellKey(c)])));
      for (const g of group) {
        const c = nearestFree({ col: cells[g].col + dc, row: cells[g].row + dr }, taken, cols, rows);
        next[g] = c;
        taken.add(cellKey(c));
      }
      // Re-anchor each icon to its new cell without a jump, then let it glide home.
      group.forEach((g, i) => {
        const el = els[i];
        if (!el) return;
        delete el.dataset.dragging;
        el.dataset.dropping = "";
        el.style.translate = `${dx + (next[g].col - cells[g].col) * stepX}px ${dy - (next[g].row - cells[g].row) * stepY}px`;
      });
      os.setIconPos(next);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          for (const el of els) if (el) el.style.translate = "";
          setTimeout(() => {
            for (const el of els) if (el) delete el.dataset.dropping;
          }, 460);
        }),
      );
    };
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
  };

  const arrange = (by: "name" | "kind") => {
    setSort(by);
    os.setIconPos({});
  };
  const deskMenu: MenuItem[] = [
    { label: t("New Folder"), onSelect: () => os.createNode("desktop", "untitled folder", { kind: "folder" }) },
    { label: t("New Text File"), onSelect: () => os.createNode("desktop", "untitled.txt", { open: "viewer", text: "" }) },
    "separator",
    { label: t("Change Wallpaper…"), onSelect: () => os.open("settings", { arg: "wallpaper" }) },
    { label: t("Clean Up"), onSelect: () => os.setIconPos({}) },
    {
      label: t("Sort By"),
      items: [
        { label: t("Name"), checked: sort === "name", onSelect: () => arrange("name") },
        { label: t("Kind"), checked: sort === "kind", onSelect: () => arrange("kind") },
      ],
    },
    "separator",
    { label: t("Show All Apps"), onSelect: () => os.setOverlay("launcher") },
  ];

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadWallpaper(file);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the empty desktop takes rubber-band drags, drops and right-clicks
    <div
      ref={host}
      className="desk"
      data-drop={drag || undefined}
      onPointerDown={onBandStart}
      onContextMenu={(e) => e.target === e.currentTarget && ctx.open(e, deskMenu)}
      onKeyDown={onKey}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <div className="icons" role="listbox" aria-label={t("Desktop")} aria-multiselectable="true" style={{ "--icon": `${px}px`, "--cell": `${stepX - 6}px` } as CSSProperties}>
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            role="option"
            className="icon"
            data-icon={it.id}
            aria-selected={sel.includes(it.id)}
            style={{ right: EDGE + cells[it.id].col * stepX, top: EDGE + cells[it.id].row * stepY, "--i": i } as CSSProperties}
            onPointerDown={(e) => onIconDown(e, it.id)}
            onClick={(e) => {
              if (dragged.current) return;
              setSel(e.ctrlKey || e.metaKey ? (sel.includes(it.id) ? sel.filter((s) => s !== it.id) : [...sel, it.id]) : [it.id]);
            }}
            onDoubleClick={(e) => openItem(it, e.currentTarget)}
            onKeyDown={(e) => e.key === "Enter" && !renaming && openItem(it, e.currentTarget)}
            onContextMenu={(e) => {
              setSel([it.id]);
              const el = e.currentTarget;
              ctx.open(e, [
                { label: t("Open"), onSelect: () => openItem(it, el) },
                "separator",
                { label: t("Rename"), shortcut: "F2", disabled: !it.node || os.isOwnerFile(it.id), onSelect: () => setRenaming(it.id) },
                { label: os.isOwnerFile(it.id) ? t("Hide") : t("Move to Trash"), shortcut: "⌫", disabled: it.id === "trash", onSelect: () => os.trash([it.id]) },
              ]);
            }}
          >
            <AppIcon name={it.icon} />
            {renaming === it.id ? (
              <input
                className="rename"
                // biome-ignore lint/a11y/noAutofocus: rename starts typing straight away
                autoFocus
                defaultValue={it.name}
                aria-label="New name"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") setRenaming(null);
                }}
                onBlur={(e) => {
                  os.rename(it.id, e.currentTarget.value);
                  setRenaming(null);
                }}
              />
            ) : (
              <span>{it.name}</span>
            )}
          </button>
        ))}
      </div>
      {band && <div className="band" style={{ left: band.x, top: band.y - 26, width: band.w, height: band.h }} />}
      {ctx.menu}
    </div>
  );
}

// ---- dock ----------------------------------------------------------------------------------

function DesktopDock({ sess }: { sess: os.Session }) {
  const t = useT();
  const [bouncing, setBouncing] = useState<string | null>(null);
  const running = new Set(sess.windows.map((w) => w.app));
  const top = os.topWindow(sess);
  const ctx = useContextMenu();

  const launch = (app: string, from: os.Rect) => {
    const wins = sess.windows.filter((w) => w.app === app).sort((a, b) => b.z - a.z);
    const w = wins[0];
    if (!w) {
      setBouncing(app);
      setTimeout(() => setBouncing((b) => (b === app ? null : b)), 900);
      return os.open(app, { from, arg: app === "files" ? "root" : undefined });
    }
    if (top?.id === w.id && !w.min) return os.minimize(w.id);
    os.setWs(w.ws);
    os.focus(w.id);
  };

  const appItem = (id: string): DockItem => ({
    id,
    label: t(apps[id].name),
    icon: <AppIcon name={apps[id].icon} />,
    running: running.has(id),
    bouncing: bouncing === id,
    onClick: (_, r) => launch(id, r),
    onContextMenu: (e) =>
      ctx.open(e, [
        ...sess.windows.filter((w) => w.app === id).map((w) => ({ label: w.title, onSelect: () => (os.setWs(w.ws), os.focus(w.id)) })),
        ...(running.has(id) ? (["separator"] as MenuItem[]) : []),
        { label: running.has(id) ? t("New Window") : t("Open"), disabled: running.has(id) && !apps[id].multi, onSelect: () => os.open(id) },
        ...(running.has(id) ? [{ label: t("Quit"), onSelect: () => sess.windows.filter((w) => w.app === id).forEach((w) => os.close(w.id)) }] : []),
      ]),
  });

  // Pinned apps in the order the user last dragged them; new ones go to the end.
  const pinned = ["launcher", ...Object.values(apps).filter((a) => a.pinned).map((a) => a.id)];
  const rank = (id: string) => {
    const i = sess.dockOrder.indexOf(id);
    return i < 0 ? 1000 + pinned.indexOf(id) : i;
  };
  const items: DockItem[] = [...pinned]
    .sort((a, b) => rank(a) - rank(b))
    .map((id) => (id === "launcher" ? { id, label: t("All Apps"), icon: <AppIcon name="launcher" />, onClick: () => os.setOverlay("launcher") } : appItem(id)));
  const trailing: DockItem[] = [
    ...sess.windows
      .filter((w) => w.min)
      .map((w) => ({ id: `win:${w.id}`, label: w.title, icon: <AppIcon name={apps[w.app].icon} />, onClick: () => (os.setWs(w.ws), os.focus(w.id)) })),
    { ...appItem("trash"), icon: <AppIcon name="trash" /> },
  ];
  return (
    <>
      <Dock items={items} trailing={trailing} size={sess.settings.dockSize} magnify={sess.settings.magnify} onReorder={os.setDockOrder} />
      {ctx.menu}
    </>
  );
}

// ---- desktops and windows ------------------------------------------------------------------

function Workspaces({ sess }: { sess: os.Session }) {
  const top = os.topWindow(sess);
  useViewport();
  return (
    <div className="ws-strip" style={{ "--ws": sess.ws } as CSSProperties}>
      {[0, 1, 2, 3].map((ws) => (
        <div key={ws} className="ws" inert={ws !== sess.ws} aria-label={`Desktop ${ws + 1}`}>
          {sess.windows
            .filter((w) => w.ws === ws)
            .map((w) => (
              <DesktopWindow key={w.id} win={w} focused={top?.id === w.id} settings={sess.settings} />
            ))}
        </div>
      ))}
    </div>
  );
}

/** A glass strip that shows which desktop you moved to, then fades away. */
function DesktopHud({ ws }: { ws: number }) {
  const t = useT();
  const [shown, setShown] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setShown((n) => n + 1);
    const tm = setTimeout(() => setShown(0), 1200);
    return () => clearTimeout(tm);
  }, [ws]);
  if (!shown) return null;
  return (
    <div key={shown} className="ws-hud" role="status">
      <div className="ws-hud-strip" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} data-on={i === ws || undefined} />
        ))}
      </div>
      <span>
        {t("Desktop")} {ws + 1}
      </span>
    </div>
  );
}

export function Desktop({ sess }: { sess: os.Session; user: os.User }) {
  const fx = os.useOS((s) => s.fx);
  return (
    <div className={`desktop${fx === "meltdown" ? " meltdown" : ""}`}>
      <Icons sess={sess} />
      <Workspaces sess={sess} />
      <TopBar sess={sess} />
      <DesktopDock sess={sess} />
      <DesktopHud ws={sess.ws} />
    </div>
  );
}
