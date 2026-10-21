// One store for the whole OS: power state, users, and each user's saved session.
// Local users persist to IndexedDB; owner and guest sessions live in memory only.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apps } from "./apps";
import { emit } from "./bus";
import type { WinMode } from "./wm";
import { idbDel, idbGet, idbSet } from "./idb";
import { isThemeId, type Rect, type SnapZone, type ThemeId, type Zone } from "@lupinos/ui";
import { descendants, HOME, isGone, ownerNodes, purge, restoreTarget, uniqueName, type VNode } from "./vfs";

export type { Rect, SnapZone, Zone };
/** boot: logo and progress. welcome: a short greeting, then straight to the desktop. lock: the user picker. */
export type Power = "boot" | "welcome" | "lock" | "desktop" | "panic" | "off";
export type Win = Rect & {
  id: string;
  app: string;
  arg?: string;
  title: string;
  z: number;
  min: boolean;
  max: boolean;
  ws: number;
  restore?: Rect; // size to go back to after a snap
  zone?: SnapZone;
  from?: Rect; // where the open animation starts
};
export type Settings = {
  theme: ThemeId;
  mode: "system" | "light" | "dark";
  wallpaper: string; // "theme" for the theme gradient, or a node id for an upload
  iconSize: "s" | "m" | "l";
  motion: "system" | "full" | "reduced" | "none";
  plainCursor: boolean;
  /** "" follows the theme font. */
  font: string;
  /** "" keeps the theme text colour. */
  textColor: string;
  textScale: number;
  /** Window and panel opacity, 0.4 (very clear) to 1 (solid). */
  glass: number;
  blur: number;
  shadow: number;
  radius: number;
  dockSize: number;
  magnify: number;
  momentum: boolean;
  snapping: boolean;
  shake: boolean;
  lang: Lang;
  lunar: boolean;
  clock24: boolean;
  /** Serious mode: no pranks at all. */
  serious: boolean;
  /** Liquid glass (WebGL) for the top bar, dock and widgets. */
  liquid: boolean;
};
export type Session = {
  windows: Win[];
  ws: number;
  nodes: VNode[];
  hiddenIds: string[];
  settings: Settings;
  seen: string[]; // one-time effects already played, like the About typing
  /** Desktop icon grid cells, by icon id. Missing ones fall into the next free cell. */
  iconPos: Record<string, { col: number; row: number }>;
  /** Pinned dock apps in the order the user dragged them. */
  dockOrder: string[];
  /** How windows are arranged: floating, tiled like Hyprland, or chained on a scrolling strip. */
  wm: WinMode;
  /** Tiling: how much of the screen the first window takes. */
  tileRatio: number;
  /** Best score per game, such as "snake" or "mines-easy". */
  scores: Record<string, number>;
  /** Live tiles on the desktop. Positions are in px from the top left of the desk. */
  widgets: Widget[];
  hero: Hero;
  /** Unlocked achievements and when. */
  achievements: Record<string, number>;
};
export type WidgetKind = "clock" | "weather" | "note" | "music" | "monitor" | "focus" | "fortune" | "counter" | "calendar";
export type Widget = { id: string; kind: WidgetKind; x: number; y: number; big?: boolean; text?: string; zone?: string };
/** The desktop hero: a little character on the dock who levels up while you explore. */
export type Hero = { on: boolean; small: boolean; xp: number; gold: number; items: string[]; hat?: string; weapon?: string; pet?: string };
export type User = { id: string; name: string; hue: number; pin?: string; kind: "owner" | "guest" | "local" };
export type Note = { id: string; title: string; body?: string; at: number };
export type Overlay = null | "search" | "shortcuts" | "launcher" | "switcher" | "widgets";

const OLD_THEMES: Record<string, ThemeId> = {
  holo: "yune", akira: "kova", kurenai: "kova", jindou: "olvi", neonhive: "yune",
  shin: "kova", jin: "olvi", mira: "peli", mel: "mimo", vex: "yune", orin: "lisen", mo: "tazu",
  velra: "kova", embra: "tazu", celan: "olvi", ceru: "lisen", lyren: "yune", sakri: "peli",
};

export const OWNER: User = { id: "owner", name: "Lupin", hue: 42, kind: "owner" };
export const GUEST: User = { id: "guest", name: "Guest", hue: 200, kind: "guest" };

export type Lang = "en" | "zh-Hans" | "zh-Hant";
const guessLang = (): Lang => {
  const l = typeof navigator === "undefined" ? "en" : navigator.language;
  return /^zh-(TW|HK|MO|Hant)/i.test(l) ? "zh-Hant" : /^zh/i.test(l) ? "zh-Hans" : "en";
};

export const defaultSettings = (): Settings => ({
  theme: "kova",
  mode: "system",
  wallpaper: "theme",
  iconSize: "m",
  motion: "system",
  plainCursor: false,
  font: "",
  textColor: "",
  textScale: 1,
  glass: 0,
  blur: 40,
  shadow: 1,
  radius: 14,
  dockSize: 50,
  magnify: 1.3,
  momentum: true,
  snapping: true,
  shake: true,
  lang: guessLang(),
  lunar: false,
  serious: false,
  liquid: true,
  clock24: !new Intl.DateTimeFormat([], { hour: "numeric" }).resolvedOptions().hour12,
});
const newSession = (): Session => ({ windows: [], ws: 0, nodes: [], hiddenIds: [], settings: defaultSettings(), seen: [], iconPos: {}, dockOrder: [], wm: "free", tileRatio: 0.5, scores: {}, widgets: defaultWidgets(), hero: defaultHero(), achievements: {} });
const defaultWidgets = (): Widget[] => [
  { id: "w-clock", kind: "clock", x: 18, y: 14 },
  { id: "w-weather", kind: "weather", x: 18, y: 144 },
  { id: "w-note", kind: "note", x: 18, y: 300, text: "Welcome, valued visitor.\nThe projects are on the right." },
];
const defaultHero = (): Hero => ({ on: true, small: false, xp: 0, gold: 0, items: [] });

export const uid = () => Math.random().toString(36).slice(2, 10);
let z = 10;

type State = {
  hydrated: boolean;
  power: Power;
  users: User[]; // local users only; owner and guest are fixed
  current: string | null;
  lastUser: string | null;
  visits: number;
  sessions: Record<string, Session>;
  notes: Note[];
  toasts: string[];
  overlay: Overlay;
  undo: VNode[][];
  dialog: null | { title: string; body: string; ok: string; run: () => void };
  fx: null | "meltdown" | "matrix" | "glitch" | "crt";
  /** The Konami code: red, black and speed lines until it is entered again. */
  akira: boolean;
  /** A prank that needs something on screen, such as the helper bee. */
  prank: null | "helper-bee";
  /** Chain mode: how far each desktop's strip is scrolled, in px. Not saved: it changes on every scroll. */
  chainOffset: number[];
};

export const useOS = create<State>()(
  persist(
    (): State => ({
      hydrated: false,
      power: "boot",
      users: [],
      current: null,
      lastUser: null,
      visits: 0,
      sessions: {},
      notes: [],
      toasts: [],
      overlay: null,
      undo: [],
      dialog: null,
      fx: null,
      akira: false,
      prank: null,
      chainOffset: [0, 0, 0, 0],
    }),
    {
      name: "lupinos",
      version: 6,
      // Older builds had other theme sets. Move each to its closest new theme; uploaded wallpapers stay.
      migrate: (old) => {
        const s = old as Pick<State, "sessions">;
        for (const sess of Object.values(s.sessions ?? {})) {
          const st = sess.settings as Settings & { theme: string };
          const theme: ThemeId = isThemeId(st.theme) ? st.theme : (OLD_THEMES[st.theme] ?? "kova");
          const upload = sess.nodes.some((n) => n.id === st.wallpaper);
          sess.settings = { ...defaultSettings(), ...st, theme, wallpaper: upload ? st.wallpaper : "theme" };
          const old = sess as Session & { tiling?: boolean };
          sess.wm ??= old.tiling ? "tile" : "free";
          delete old.tiling;
          sess.tileRatio ??= 0.5;
          // The old tinted defaults become the new blur-only glass; a chosen value stays.
          if (sess.settings.glass === 0.86 || sess.settings.glass === 0.45) sess.settings.glass = 0;
          sess.iconPos ??= {};
          sess.scores ??= {};
          sess.widgets ??= defaultWidgets();
          sess.hero ??= defaultHero();
          sess.achievements ??= {};
          sess.dockOrder ??= [];
        }
        return s as State;
      },
      storage: createJSONStorage(() => ({
        getItem: async (k) => (await idbGet<string>(k)) ?? null,
        setItem: (k, v) => idbSet(k, v),
        removeItem: (k) => idbDel(k),
      })),
      partialize: (s) => ({
        users: s.users,
        lastUser: s.lastUser,
        visits: s.visits,
        sessions: Object.fromEntries(Object.entries(s.sessions).filter(([id]) => s.users.some((u) => u.id === id))),
      }),
      onRehydrateStorage: () => () => useOS.setState((s) => ({ hydrated: true, visits: s.visits + 1 })),
    },
  ),
);

const set = useOS.setState;
const get = useOS.getState;

// ---- selectors -------------------------------------------------------------

export const allUsers = (users: User[]) => [OWNER, ...users, GUEST];
export const userById = (id: string | null) => allUsers(get().users).find((u) => u.id === id);
export const useSession = () => useOS((s) => (s.current ? s.sessions[s.current] : undefined));
export const session = () => {
  const s = get();
  return s.current ? s.sessions[s.current] : undefined;
};
export const nodesOf = (sess?: Session) => (sess ? [...ownerNodes, ...sess.nodes] : ownerNodes);
export const topWindow = (sess?: Session) =>
  sess?.windows.filter((w) => w.ws === sess.ws && !w.min).reduce<Win | undefined>((a, w) => (!a || w.z > a.z ? w : a), undefined);

function patch(fn: (s: Session) => Partial<Session>) {
  const { current, sessions } = get();
  if (!current) return;
  const sess = sessions[current];
  set({ sessions: { ...sessions, [current]: { ...sess, ...fn(sess) } } });
}
const patchWin = (id: string, fn: (w: Win) => Partial<Win>) =>
  patch((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...fn(w) } : w)) }));

// ---- notifications, dialogs, effects ------------------------------------------

export function notify(title: string, body?: string, ms = 4000) {
  const note = { id: uid(), title, body, at: Date.now() };
  set((s) => ({ notes: [note, ...s.notes].slice(0, 50), toasts: [...s.toasts, note.id] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t !== note.id) })), ms);
}

/** Unlocks an achievement once, with a toast. Returns true the first time. */
export function unlock(id: string, name: string) {
  const sess = session();
  if (!sess || sess.achievements[id]) return false;
  patch((s) => ({ achievements: { ...s.achievements, [id]: Date.now() } }));
  notify("Achievement unlocked", name);
  return true;
}
export const seen = (key: string) => !!session()?.seen.includes(key);
export const dismissToast = (id: string) => set((s) => ({ toasts: s.toasts.filter((t) => t !== id) }));
export const clearNotes = () => set({ notes: [], toasts: [] });

export const confirmDialog = (title: string, body: string, ok: string, run: () => void) => set({ dialog: { title, body, ok, run } });
export const closeDialog = () => set({ dialog: null });

export function playFx(fx: State["fx"], ms: number) {
  set({ fx });
  setTimeout(() => set((s) => (s.fx === fx ? { fx: null } : {})), ms);
}

// ---- power and users ---------------------------------------------------------

export const setPower = (power: Power) => set({ power, overlay: null });

/** Signs in. A profile that has never been used opens About and Projects side by side. */
export function login(id: string, { intro = true } = {}) {
  const s = get();
  const sess = s.sessions[id] ?? newSession();
  set({
    current: id,
    power: "desktop",
    lastUser: s.users.some((u) => u.id === id) ? id : s.lastUser,
    undo: [],
    sessions: { ...s.sessions, [id]: { ...sess, nodes: purge(sess.nodes) } },
  });
  if (!sess.seen.includes("intro")) {
    markSeen("intro");
    if (intro && !sess.windows.length) setTimeout(openIntro, 450);
  }
}

function openIntro() {
  const gap = 24;
  const room = innerWidth - 130; // keep the desktop icon column on the right clear
  const w = Math.min(560, (room - gap * 3) / 2);
  const h = Math.min(500, innerHeight - 26 - 110);
  const left = Math.max(gap, (room - (w * 2 + gap)) / 2);
  const about = open("about");
  const files = open("files", { arg: "projects", title: "Projects" });
  if (about) moveWin(about, { x: Math.round(left), y: 56, w: Math.round(w), h });
  if (files) moveWin(files, { x: Math.round(left + w + gap), y: 76, w: Math.round(w), h });
}

export const setIconPos = (pos: Session["iconPos"]) => patch(() => ({ iconPos: pos }));

// ---- widgets and the hero -------------------------------------------------------

export const addWidget = (kind: WidgetKind) =>
  patch((s) => ({ widgets: [...s.widgets, { id: uid(), kind, x: 160 + (s.widgets.length % 5) * 24, y: 60 + (s.widgets.length % 5) * 24 }] }));
export const updateWidget = (id: string, p: Partial<Widget>) => patch((s) => ({ widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...p } : w)) }));
export const removeWidget = (id: string) => patch((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) }));
export const setHero = (p: Partial<Hero>) => patch((s) => ({ hero: { ...s.hero, ...p } }));
/** Level from experience: 25 xp for level 2, then each level needs a little more. */
export const heroLevel = (xp: number) => Math.floor(Math.sqrt(xp / 25)) + 1;
export const xpFor = (level: number) => (level - 1) ** 2 * 25;

/** Keeps the best score for a game. Times are better when lower. Returns true for a new best. */
export function recordScore(game: string, value: number, lowerIsBetter = false): boolean {
  const sess = session();
  if (!sess) return false;
  const old = sess.scores[game];
  const better = old === undefined || (lowerIsBetter ? value < old : value > old);
  if (better) patch((s) => ({ scores: { ...s.scores, [game]: value } }));
  return better;
}
export const setDockOrder = (dockOrder: string[]) => patch(() => ({ dockOrder }));

/** Lock and switch user both return to the welcome screen; every session stays as it was. */
export const lock = () => set({ power: "lock", overlay: null });

export function addUser(name: string, pin?: string): User {
  const user: User = {
    id: uid(),
    name: name.trim().slice(0, 24) || "Visitor",
    hue: Math.floor(Math.random() * 360),
    pin: pin || undefined,
    kind: "local",
  };
  set((s) => ({ users: [...s.users, user] }));
  return user;
}

export function removeUser(id: string) {
  set((s) => {
    const { [id]: _, ...sessions } = s.sessions;
    return { users: s.users.filter((u) => u.id !== id), sessions, lastUser: s.lastUser === id ? null : s.lastUser };
  });
}

// ---- windows -----------------------------------------------------------------

export function open(app: string, opts: { arg?: string; title?: string; from?: Rect } = {}) {
  const sess = session();
  const def = apps[app];
  if (!sess || !def) return;
  const existing = sess.windows.find((w) => w.app === app && (!def.multi || (opts.arg !== undefined && w.arg === opts.arg)));
  if (existing) {
    patch(() => ({ ws: existing.ws }));
    patchWin(existing.id, () => ({ min: false, z: ++z, ...(opts.arg !== undefined ? { arg: opts.arg } : {}) }));
    return existing.id;
  }
  const vw = innerWidth;
  const vh = innerHeight - 40 - 76; // top bar and dock
  const n = sess.windows.filter((w) => w.ws === sess.ws).length;
  const w = Math.min(def.w, vw - 40);
  const h = Math.min(def.h, vh - 16);
  const win: Win = {
    id: uid(),
    app,
    arg: opts.arg,
    title: opts.title ?? def.name,
    x: Math.round(Math.max(10, Math.min(vw - w - 10, (vw - w) / 2 + (n % 6) * 28 - 70))),
    y: Math.round(Math.max(48, Math.min(40 + vh - h, 70 + (n % 6) * 28))),
    w,
    h,
    z: ++z,
    min: false,
    max: false,
    ws: sess.ws,
    from: opts.from,
  };
  patch((s) => ({ windows: [...s.windows, win] }));
  emit({ type: "app-open", app });
  return win.id;
}

export const close = (id: string) => patch((s) => ({ windows: s.windows.filter((w) => w.id !== id) }));
export const focus = (id: string) => patchWin(id, (w) => ({ z: w.z === z ? w.z : ++z, min: false }));
export const minimize = (id: string) => patchWin(id, () => ({ min: true }));
export const toggleMax = (id: string) => patchWin(id, (w) => ({ max: !w.max, z: ++z }));
export const moveWin = (id: string, r: Partial<Rect> & { restore?: Rect; zone?: SnapZone }) => patchWin(id, () => ({ ...r, max: false, from: undefined }));
const MODES: WinMode[] = ["free", "tile", "chain"];
export const MODE_NAMES: Record<WinMode, string> = { free: "Freestyle", tile: "Tiling", chain: "Chain" };

/** Switches how windows are arranged. Maximised windows are let go, so the layout takes over. */
export function setWinMode(wm: WinMode) {
  patch((s) => ({ wm, windows: s.windows.map((w) => ({ ...w, max: false })) }));
  if (wm === "tile") emit({ type: "egg", id: "tiling" });
}
export function cycleWinMode() {
  const cur = session()?.wm ?? "free";
  const wm = MODES[(MODES.indexOf(cur) + 1) % MODES.length];
  setWinMode(wm);
  notify(`${MODE_NAMES[wm]} windows`, wm === "tile" ? "Alt+arrows move focus, Alt+Shift+arrows swap." : wm === "chain" ? "Alt+Left and Right scroll the strip, Alt+R resizes." : "Drag windows anywhere.", 2500);
}
export const setTileRatio = (r: number) => patch(() => ({ tileRatio: Math.min(0.8, Math.max(0.2, r)) }));
export const setChainOffset = (ws: number, x: number) => set((s) => ({ chainOffset: s.chainOffset.map((v, i) => (i === ws ? Math.max(0, Math.round(x)) : v)) }));

/** Moves a window to a place among the windows of its desktop, which is the tiling and chain order. */
export const moveWindowTo = (id: string, index: number) =>
  patch((s) => {
    const win = s.windows.find((w) => w.id === id);
    if (!win) return {};
    const rest = s.windows.filter((w) => w.id !== id);
    const same = rest.filter((w) => w.ws === win.ws && !w.min);
    const before = same[index];
    const at = before ? rest.indexOf(before) : rest.length;
    return { windows: [...rest.slice(0, at), win, ...rest.slice(at)] };
  });

/** Sends a window to another desktop, like Hyprland's movetoworkspace. */
export const moveToDesktop = (id: string, ws: number) => patchWin(id, () => ({ ws, z: ++z }));
/** Swaps two windows in the tiling order, which is the order of the windows list. */
export const swapWindows = (a: string, b: string) =>
  patch((s) => {
    const i = s.windows.findIndex((w) => w.id === a);
    const j = s.windows.findIndex((w) => w.id === b);
    if (i < 0 || j < 0) return {};
    const windows = [...s.windows];
    [windows[i], windows[j]] = [windows[j], windows[i]];
    return { windows };
  });
/** Stacks the windows on the current desktop from the top left, each a step down and right. */
export const cascade = (area: Rect) =>
  patch((s) => {
    let n = 0;
    return {
      wm: "free" as WinMode,
      windows: s.windows.map((w) => {
        if (w.ws !== s.ws || w.min) return w;
        const k = n++;
        return { ...w, max: false, zone: undefined, restore: undefined, x: area.x + 40 + k * 30, y: area.y + 20 + k * 30, z: ++z };
      }),
    };
  });
export const setArg = (id: string, arg: string, title?: string) => patchWin(id, (w) => ({ arg, title: title ?? w.title }));
export const minimizeOthers = (id: string) =>
  patch((s) => ({ windows: s.windows.map((w) => (w.id !== id && w.ws === s.ws ? { ...w, min: true } : w)) }));
export const minimizeAll = () => patch((s) => ({ windows: s.windows.map((w) => ({ ...w, min: true })) }));
export const setWs = (ws: number) => patch(() => ({ ws }));
export const setOverlay = (overlay: Overlay) => set({ overlay });

// ---- settings ----------------------------------------------------------------

export const setSettings = (p: Partial<Settings>) => patch((s) => ({ settings: { ...s.settings, ...p } }));
export const markSeen = (key: string) => patch((s) => ({ seen: [...s.seen, key] }));

/** Factory reset for the signed-in user: default settings, no windows, their own files and uploads gone. */
export function resetSession() {
  const { current, sessions } = get();
  if (!current) return;
  for (const n of sessions[current].nodes) if (n.blob) idbDel(n.blob);
  set({ sessions: { ...sessions, [current]: newSession() }, undo: [] });
}

/** Crossfades the whole screen through a change, where the browser supports view transitions. */
export function crossfade(apply: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
  else apply();
}

export function switchTheme(theme: ThemeId) {
  const s = session();
  if (s && s.settings.theme !== theme) crossfade(() => setSettings({ theme }));
}

// ---- files and trash ---------------------------------------------------------

/** Every change to a user's files goes through here, so Ctrl+Z can step back. */
function mutate(fn: (nodes: VNode[]) => VNode[]) {
  const sess = session();
  if (!sess) return;
  set((s) => ({ undo: [...s.undo, sess.nodes].slice(-20) }));
  patch((s) => ({ nodes: fn(s.nodes) }));
}

export function undo() {
  const prev = get().undo.at(-1);
  if (!prev) return notify("Nothing to undo", "The hive forgets nothing, but it cannot go back.");
  set((s) => ({ undo: s.undo.slice(0, -1) }));
  patch(() => ({ nodes: prev }));
}

export const isOwnerFile = (id: string) => ownerNodes.some((n) => n.id === id);

export function createNode(parent: string, name: string, extra: Partial<VNode> = {}): string | undefined {
  const all = nodesOf(session());
  const target = all.find((n) => n.id === parent);
  if (!target || target.locked || target.kind !== "folder") {
    notify("That folder is sealed", "Portfolio folders are maintained by the issuing corporation.");
    return;
  }
  const id = uid();
  mutate((nodes) => [...nodes, { id, name: uniqueName(all, parent, name), kind: "file", parent, at: Date.now(), ...extra }]);
  return id;
}

export function rename(id: string, name: string) {
  const all = nodesOf(session());
  const node = all.find((n) => n.id === id);
  const clean = name.trim().replace(/\//g, "-");
  if (!node || !clean || node.name === clean) return;
  if (isOwnerFile(id)) return notify("Read-only", "Owner files are edited through the repo, never from here.");
  mutate((nodes) => nodes.map((n) => (n.id === id ? { ...n, name: uniqueName(all, n.parent ?? HOME, clean) } : n)));
}

export function editText(id: string, text: string) {
  if (isOwnerFile(id)) return;
  mutate((nodes) => nodes.map((n) => (n.id === id ? { ...n, text } : n)));
}

/** Moves items to Trash. Owner files can only be hidden. */
export function trash(ids: string[]) {
  const owned = ids.filter(isOwnerFile);
  const mine = ids.filter((id) => !isOwnerFile(id));
  if (owned.length) {
    patch((s) => ({ hiddenIds: [...new Set([...s.hiddenIds, ...owned])] }));
    notify("Hidden, not deleted", "Portfolio files cannot be deleted. Unhide them from the Files View menu.");
  }
  if (mine.length) {
    const at = Date.now();
    mutate((nodes) => nodes.map((n) => (mine.includes(n.id) ? { ...n, trashedAt: at } : n)));
    notify(mine.length === 1 ? "Moved to Trash" : `${mine.length} items moved to Trash`, "Ctrl+Z brings it back.");
  }
  const s = session();
  if (s && mine.includes(s.settings.wallpaper)) setSettings({ wallpaper: "theme" });
}

export function restore(id: string) {
  const all = nodesOf(session());
  mutate((nodes) => nodes.map((n) => (n.id === id ? { ...n, trashedAt: undefined, parent: restoreTarget(all, n) } : n)));
}

export function destroy(ids: string[]) {
  const sess = session();
  if (!sess) return;
  const drop = new Set(ids.flatMap((id) => descendants(sess.nodes, id)));
  for (const n of sess.nodes) if (drop.has(n.id) && n.blob) idbDel(n.blob);
  mutate((nodes) => nodes.filter((n) => !drop.has(n.id)));
}

export const trashed = (sess?: Session) => (sess?.nodes ?? []).filter((n) => n.trashedAt);
export const unhideAll = () => patch(() => ({ hiddenIds: [] }));
export const exists = (id: string) => !isGone(nodesOf(session()), id);

/** Stores an uploaded file in IndexedDB and adds it to Home/Pictures. Never sent anywhere. */
export async function upload(file: Blob, name: string): Promise<string | undefined> {
  const key = `blob:${uid()}`;
  await idbSet(key, file);
  return createNode("pictures", name, { blob: key, mime: file.type, open: "viewer" });
}
