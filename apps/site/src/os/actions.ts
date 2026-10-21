// Things several parts of the OS do: open files, follow deep links, run commands and snap windows.
import { themeList, tileRects, zoneRect } from "@lupinos/ui";
import { apps } from "./apps";
import * as os from "./store";
import type { Rect, Settings, Zone } from "./store";
import { resolve, type VNode } from "./vfs";
import { chainLayout, clampOffset, type Dir, neighbour, nextWidth } from "./wm";

export const TOP = 26;
/** Height the dock keeps clear at the bottom: its icons plus padding and the gap below. */
export const dockSpace = () => (os.session()?.settings.dockSize ?? 50) + 28;

export function openNode(n: VNode, from?: Rect) {
  if (n.kind === "folder") return os.open("files", { arg: n.id, title: n.name || "Files", from });
  if (n.open === "project") return os.open("project", { arg: n.arg, title: n.name, from });
  if (n.open && n.open !== "viewer") return os.open(n.open, { arg: n.arg, from });
  return os.open("viewer", { arg: n.id, title: n.name, from });
}

/** Opens the window a URL like /app/files/projects/project-01 points at. */
export function openPath(pathname: string) {
  const [app, ...rest] = pathname.replace(/^\/app\/?/, "").split("/").filter(Boolean);
  if (!app) return;
  if (app === "files") {
    const node = resolve(os.nodesOf(os.session()), `/${rest.join("/")}`);
    return node ? openNode(node) : os.open("files", { arg: "root" });
  }
  if (apps[app] && !apps[app].hidden) os.open(app);
}

// ---- power ----------------------------------------------------------------

export function restart() {
  os.playFx("crt", 700);
  setTimeout(() => os.setPower("boot"), 600);
}
export function shutdown() {
  os.playFx("crt", 700);
  setTimeout(() => os.setPower("off"), 600);
}
export function panic() {
  os.setPower("panic");
  setTimeout(() => os.useOS.getState().power === "panic" && os.setPower("desktop"), 5000);
}

// ---- appearance --------------------------------------------------------------

const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

export const effectiveMode = (s: Settings): "light" | "dark" => (s.mode === "system" ? (systemDark() ? "dark" : "light") : s.mode);

export function effectiveMotion(s: Settings): "full" | "reduced" | "none" | undefined {
  return s.motion === "system" ? undefined : s.motion;
}

export function toggleMode() {
  const s = os.session()?.settings;
  if (s) os.crossfade(() => os.setSettings({ mode: effectiveMode(s) === "dark" ? "light" : "dark" }));
}

// ---- window geometry ------------------------------------------------------------

/** Where windows snap and maximise: below the menu bar, above the dock. */
export const deskArea = (): Rect => ({ x: 0, y: TOP, w: innerWidth, h: innerHeight - TOP - dockSpace() });

/** Space between snapped and tiled windows, and around the edge of the screen. */
export const GAP = 10;

/** Where each window sits in Tiling mode: the visible windows on a desktop, in list order. */
export function tileLayout(sess: os.Session, ws: number): Map<string, Rect> {
  if (sess.wm !== "tile") return new Map();
  const wins = sess.windows.filter((w) => w.ws === ws && !w.min);
  const rects = tileRects(wins.length, deskArea(), GAP, sess.tileRatio);
  return new Map(wins.map((w, i) => [w.id, rects[i]]));
}

/** Chain mode: each window's column on the strip, the strip's width and how far it is scrolled. */
export function chainFor(sess: os.Session, ws: number, offset = os.useOS.getState().chainOffset[ws] ?? 0) {
  const wins = sess.windows.filter((w) => w.ws === ws && !w.min);
  // Columns stop short of the bottom so the strip minimap never covers them.
  const area = { ...deskArea(), h: deskArea().h - 40 };
  const { rects, width } = chainLayout(wins, area, GAP);
  return { rects, width, offset: clampOffset(offset, width, area.w) };
}

/** The layout the keyboard moves through: tiles or chain columns on the current desktop. */
const layoutNow = (sess: os.Session) => (sess.wm === "tile" ? tileLayout(sess, sess.ws) : chainFor(sess, sess.ws).rects);

const ARROWS: Record<string, Dir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

/** Alt+arrows in Tiling and Chain: move focus. With Shift: swap with, or move past, the neighbour. */
function arrowKey(sess: os.Session, dir: Dir, shift: boolean) {
  const w = os.topWindow(sess);
  if (!w) return;
  const next = neighbour(layoutNow(sess), w.id, dir);
  if (!next) return;
  if (!shift) return os.focus(next);
  if (sess.wm === "tile") return os.swapWindows(w.id, next);
  const order = sess.windows.filter((x) => x.ws === sess.ws && !x.min);
  os.moveWindowTo(w.id, order.findIndex((x) => x.id === next));
}

export function snapFocused(dir: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown") {
  const w = os.topWindow(os.session());
  if (!w || os.session()?.wm !== "free") return;
  const z = w.zone;
  const next: Record<string, Zone | "restore"> = {
    ArrowLeft: z === "top-right" ? "top-left" : z === "bottom-right" ? "bottom-left" : "left",
    ArrowRight: z === "top-left" ? "top-right" : z === "bottom-left" ? "bottom-right" : "right",
    ArrowUp: z === "left" || z === "bottom-left" ? "top-left" : z === "right" || z === "bottom-right" ? "top-right" : "maximize",
    ArrowDown: z === "left" || z === "top-left" ? "bottom-left" : z === "right" || z === "top-right" ? "bottom-right" : "restore",
  };
  const to = next[dir];
  if (to === "maximize") return os.toggleMax(w.id);
  if (to === "restore") return w.restore && os.moveWin(w.id, { ...w.restore, restore: undefined, zone: undefined });
  os.moveWin(w.id, { ...zoneRect(to, deskArea(), GAP), zone: to, restore: w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h } });
}

// ---- commands: search, menus and the terminal all list these -----------------------

export type Command = { id: string; label: string; kbd?: string; run: () => void };

export const commands = (): Command[] => [
  { id: "lock", label: "Lock Screen", kbd: "Alt+L", run: os.lock },
  { id: "switch", label: "Switch User", run: os.lock },
  { id: "restart", label: "Restart", run: restart },
  { id: "shutdown", label: "Shut Down", run: shutdown },
  { id: "mode", label: "Toggle Light and Dark", kbd: "Alt+D", run: toggleMode },
  { id: "keys", label: "Keyboard Shortcuts", kbd: "Alt+/", run: () => os.setOverlay("shortcuts") },
  { id: "launcher", label: "Show All Apps", run: () => os.setOverlay("launcher") },
  { id: "wm-free", label: "Freestyle Windows", run: () => os.setWinMode("free") },
  { id: "wm-tile", label: "Tiling Windows", run: () => os.setWinMode("tile") },
  { id: "wm-chain", label: "Chain Windows", run: () => os.setWinMode("chain") },
  { id: "wm-next", label: "Next Window Mode", kbd: "Alt+T", run: os.cycleWinMode },
  { id: "cascade", label: "Cascade Windows", run: () => os.cascade(deskArea()) },
  ...themeList.map((t) => ({ id: `theme-${t.id}`, label: `Theme: ${t.name} (${t.hue})`, run: () => os.switchTheme(t.id) })),
  ...[0, 1, 2, 3].map((i) => ({ id: `ws-${i}`, label: `Go to Desktop ${i + 1}`, kbd: `Alt+${i + 1}`, run: () => os.setWs(i) })),
  { id: "plain", label: "Open the Plain Version", run: () => location.assign("/plain") },
  { id: "hide-all", label: "Show Desktop", run: os.minimizeAll },
];

// ---- keyboard --------------------------------------------------------------------------

export const shortcuts: [string, string][] = [
  ["Ctrl+K", "Search apps, files and commands"],
  ["Alt+/", "Show every shortcut"],
  ["Alt+`", "Switch windows"],
  ["Alt+Q", "Close the focused window"],
  ["Alt+M", "Minimise the focused window"],
  ["Alt+F", "Zoom or restore"],
  ["Alt+T", "Next window mode: Freestyle, Tiling, Chain"],
  ["Alt+Shift+Arrows", "Freestyle: snap to a half or a corner"],
  ["Alt+Arrows", "Tiling and Chain: move focus"],
  ["Alt+Shift+Arrows", "Tiling: swap windows. Chain: move along the strip"],
  ["Alt+- and Alt+=", "Tiling: shrink or grow the main window"],
  ["Alt+R", "Chain: cycle the column width"],
  ["Alt+1 to 4", "Go to desktop 1 to 4"],
  ["Alt+Shift+1 to 4", "Send the window to desktop 1 to 4"],
  ["Alt+Return", "Open Terminal"],
  ["Alt+E", "Open Files"],
  ["Alt+D", "Light or dark"],
  ["Alt+L", "Lock"],
  ["Delete", "Move the selection to Trash"],
  ["Shift+Delete", "Delete for good"],
  ["Ctrl+Z", "Undo the last delete, move or rename"],
  ["F2", "Rename the selected file"],
  ["Escape", "Close the open menu, dialog or overlay"],
];

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Global shortcuts. Reads physical key codes, so Option on a Mac still works as Alt. */
export function onKey(e: KeyboardEvent) {
  const st = os.useOS.getState();
  if (st.power !== "desktop") return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.code === "KeyK") {
    e.preventDefault();
    return os.setOverlay(st.overlay === "search" ? null : "search");
  }
  if (mod && e.code === "KeyZ" && !e.altKey && !typing(e.target)) {
    e.preventDefault();
    return os.undo();
  }
  if (e.code === "Escape" && st.overlay && st.overlay !== "switcher") return os.setOverlay(null);
  if (!e.altKey || mod) return;
  const w = os.topWindow(os.session());
  const act: Record<string, () => void> = {
    Slash: () => os.setOverlay(st.overlay === "shortcuts" ? null : "shortcuts"),
    Backquote: () => st.overlay !== "switcher" && os.setOverlay("switcher"),
    KeyQ: () => w && os.close(w.id),
    KeyM: () => w && os.minimize(w.id),
    KeyF: () => w && os.toggleMax(w.id),
    Enter: () => os.open("terminal"),
    KeyE: () => os.open("files", { arg: "root" }),
    KeyD: toggleMode,
    KeyL: os.lock,
    KeyT: os.cycleWinMode,
    Digit1: () => os.setWs(0),
    Digit2: () => os.setWs(1),
    Digit3: () => os.setWs(2),
    Digit4: () => os.setWs(3),
  };
  const sess = os.session();
  if (!sess) return;
  if (ARROWS[e.code]) {
    e.preventDefault();
    if (sess.wm !== "free") return arrowKey(sess, ARROWS[e.code], e.shiftKey);
    if (e.shiftKey) snapFocused(e.code as "ArrowLeft");
    return;
  }
  // Hyprland's movetoworkspace: send the window over and follow it.
  const digit = /^Digit([1-4])$/.exec(e.code);
  if (digit && e.shiftKey) {
    e.preventDefault();
    const ws = Number(digit[1]) - 1;
    if (w) os.moveToDesktop(w.id, ws);
    return os.setWs(ws);
  }
  if (sess.wm === "tile" && (e.code === "Minus" || e.code === "Equal")) {
    e.preventDefault();
    return os.setTileRatio(sess.tileRatio + (e.code === "Equal" ? 0.05 : -0.05));
  }
  if (sess.wm === "chain" && e.code === "KeyR" && w) {
    e.preventDefault();
    return os.moveWin(w.id, { w: nextWidth(w.w, deskArea().w, GAP) });
  }
  const run = act[e.code];
  if (run) {
    e.preventDefault();
    run();
  }
}
