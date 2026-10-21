// Virtual file system: one flat list of nodes, linked by parent id.
// Owner nodes are read-only and shipped with the site; each user adds their own on top.
import { projects } from "../content/owner.ts";

export type VNode = {
  id: string;
  name: string;
  kind: "folder" | "file";
  parent: string | null;
  open?: string; // app id that opens this file
  arg?: string; // passed to that app
  text?: string;
  blob?: string; // IndexedDB key for uploaded files
  mime?: string;
  ro?: boolean; // owner file: can be hidden, never deleted or renamed
  locked?: boolean; // folder that takes no new children
  hidden?: boolean; // dotfile, shown only with "Show hidden"
  trashedAt?: number;
  at?: number; // created
};

export const HOME = "home";
export const DAY = 86_400_000;

const f = (id: string, name: string, parent: string, extra: Partial<VNode> = {}): VNode => ({
  id,
  name,
  parent,
  kind: "file",
  ro: true,
  ...extra,
});
const dir = (id: string, name: string, parent: string | null, extra: Partial<VNode> = {}): VNode => ({
  id,
  name,
  parent,
  kind: "folder",
  ro: true,
  ...extra,
});

export const ownerNodes: VNode[] = [
  dir("root", "", null, { locked: true }),
  dir("desktop", "Desktop", "root"),
  f("about", "About.txt", "desktop", { open: "about" }),
  f("resume", "Resume.pdf", "desktop", { open: "resume" }),
  f("contact", "Contact", "desktop", { open: "contact" }),
  f("games", "Games", "desktop", { open: "games" }),
  dir("projects", "Projects", "root", { locked: true }),
  ...projects.map((p) => f(`p-${p.slug}`, p.slug, "projects", { open: "project", arg: p.slug })),
  dir(HOME, "Home", "root"),
  dir("pictures", "Pictures", HOME),
  f("welcome", "welcome.txt", HOME, {
    open: "viewer",
    text: "Welcome, valued visitor.\nThis Home folder is yours. Everything you make here stays in this browser.",
  }),
  dir("hive", ".hive", "root", { hidden: true, locked: true }),
  f("hive-1", "concept-sketch-01.png", "hive", { open: "viewer", text: "[grey image block]" }),
  f("hive-2", "bloopers.txt", "hive", { open: "viewer", text: "Lorem ipsum dolor sit amet.\nTake 14. The bee escaped again." }),
];

const byId = (nodes: VNode[], id: string | null) => nodes.find((n) => n.id === id);

export function isGone(nodes: VNode[], id: string | null): boolean {
  for (let n = byId(nodes, id); n; n = byId(nodes, n.parent)) if (n.trashedAt) return true;
  return !byId(nodes, id);
}

export function children(nodes: VNode[], id: string, showHidden = false, hiddenIds: string[] = []) {
  return nodes
    .filter((n) => n.parent === id && !n.trashedAt && !hiddenIds.includes(n.id) && (showHidden || !n.hidden))
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
}

export function pathOf(nodes: VNode[], id: string): string {
  const parts: string[] = [];
  for (let n = byId(nodes, id); n?.parent; n = byId(nodes, n.parent)) parts.unshift(n.name);
  return `/${parts.join("/")}`;
}

/** Resolves an absolute or relative path, case-insensitive. `~` is Home. */
export function resolve(nodes: VNode[], path: string, cwd = "root"): VNode | undefined {
  let cur = path.startsWith("/") ? "root" : path.startsWith("~") ? HOME : cwd;
  for (const part of path.replace(/^~/, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      cur = byId(nodes, cur)?.parent ?? "root";
      continue;
    }
    const next = nodes.find((n) => n.parent === cur && !n.trashedAt && n.name.toLowerCase() === part.toLowerCase());
    if (!next) return undefined;
    cur = next.id;
  }
  return byId(nodes, cur);
}

export function descendants(nodes: VNode[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const n of nodes) if (n.parent === out[i]) out.push(n.id);
  return out;
}

/** Where a restored item goes: its old folder, or Home if that folder is gone. */
export const restoreTarget = (nodes: VNode[], n: VNode) => (n.parent && !isGone(nodes, n.parent) ? n.parent : HOME);

/** Drops items that have sat in Trash for more than 30 days, with everything inside them. */
export function purge(nodes: VNode[], now = Date.now()): VNode[] {
  const old = nodes.filter((n) => n.trashedAt && now - n.trashedAt > 30 * DAY);
  const drop = new Set(old.flatMap((n) => descendants(nodes, n.id)));
  return nodes.filter((n) => !drop.has(n.id));
}

export function uniqueName(nodes: VNode[], parent: string, name: string): string {
  const taken = new Set(children(nodes, parent, true).map((n) => n.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}${ext}`.toLowerCase())) return `${base} ${i}${ext}`;
}
