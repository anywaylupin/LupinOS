// App registry. Each app is code-split and loads only when its first window opens.
// Apps can also ship a Sidebar (drawn full height under the traffic lights) and a Toolbar.
import { type ComponentType, lazy } from "react";
import type { Win } from "./store";

export type AppProps = { win: Win };
type Part = ComponentType<AppProps>;
type Module = Promise<Record<string, Part>>;

export type AppDef = {
  id: string;
  name: string;
  /** AppIcon name. */
  icon: string;
  w: number;
  h: number;
  minW: number;
  minH: number;
  multi?: boolean; // several windows at once
  pinned?: boolean; // kept in the dock
  hidden?: boolean; // opened from files only, not listed in the launcher
  description: string;
  Component: Part;
  Sidebar?: Part;
  Toolbar?: Part;
  sidebarWidth?: number;
};

const part = (load: () => Module, name: string) => lazy(() => load().then((m) => ({ default: m[name] })));

const def = (
  id: string,
  name: string,
  icon: string,
  size: [number, number, number, number],
  description: string,
  load: () => Module,
  extra: Partial<AppDef> & { parts?: ("Sidebar" | "Toolbar")[] } = {},
): AppDef => {
  const [w, h, minW, minH] = size;
  const { parts = [], ...rest } = extra;
  return {
    id,
    name,
    icon,
    w,
    h,
    minW,
    minH,
    description,
    Component: part(load, "default"),
    Sidebar: parts.includes("Sidebar") ? part(load, "Sidebar") : undefined,
    Toolbar: parts.includes("Toolbar") ? part(load, "Toolbar") : undefined,
    ...rest,
  };
};

const files = () => import("../apps/Files") as unknown as Module;
const settings = () => import("../apps/Settings") as unknown as Module;

export const apps: Record<string, AppDef> = Object.fromEntries(
  [
    def("files", "Files", "files", [820, 500, 480, 300], "Browse projects and your own files.", files, { multi: true, pinned: true, parts: ["Sidebar", "Toolbar"], sidebarWidth: 190 }),
    def("project", "Project", "project", [740, 580, 380, 320], "One project with its summary, stack and links.", () => import("../apps/Project") as unknown as Module, { multi: true, hidden: true }),
    def("about", "About", "about", [560, 460, 320, 240], "A short bio.", () => import("../apps/About") as unknown as Module, { pinned: true }),
    def("resume", "Resume", "resume", [640, 680, 380, 340], "The resume, with a download button.", () => import("../apps/Resume") as unknown as Module, { pinned: true }),
    def("contact", "Contact", "mail", [440, 560, 340, 380], "Send the owner a message.", () => import("../apps/Contact") as unknown as Module, { pinned: true }),
    def("terminal", "Terminal", "terminal", [700, 440, 380, 240], "Commands for every section.", () => import("../apps/Terminal") as unknown as Module, { multi: true, pinned: true }),
    def("settings", "Settings", "settings", [760, 540, 520, 380], "Themes, wallpaper, motion and accessibility.", settings, { pinned: true, parts: ["Sidebar"], sidebarWidth: 200 }),
    def("games", "Games", "games", [680, 520, 420, 360], "The arcade, with your best scores.", () => import("../apps/Games") as unknown as Module, { pinned: true }),
    def("game", "Game", "games", [720, 600, 360, 340], "One game.", () => import("../apps/Game") as unknown as Module, { multi: true, hidden: true }),
    def("music", "Music", "music", [620, 420, 460, 340], "Placeholder tracks with a visualiser.", () => import("../apps/Music") as unknown as Module, { pinned: true }),
    def("guestbook", "Guestbook", "mail", [520, 560, 360, 380], "Leave a note for the owner and the next visitor.", () => import("../apps/Guestbook") as unknown as Module),
    def("achievements", "Achievements", "games", [620, 520, 380, 360], "A shelf of badges you have earned.", () => import("../apps/Achievements") as unknown as Module),
    def("trash", "Trash", "trash", [660, 440, 400, 260], "Deleted items, ready to restore.", () => import("../apps/Trash") as unknown as Module),
    def("viewer", "Viewer", "doc", [540, 420, 300, 220], "Opens text files and pictures.", () => import("../apps/Viewer") as unknown as Module, { multi: true, hidden: true }),
  ].map((a) => [a.id, a]),
);

/** The shareable URL for a window, like /app/files/projects/project-01. */
export function routeFor(app: string, arg?: string): string {
  if (app === "project" && arg) return `/app/files/projects/${arg}`;
  if (app === "files" && arg) return `/app/files${arg === "/" ? "" : arg.toLowerCase()}`;
  return `/app/${app}`;
}
