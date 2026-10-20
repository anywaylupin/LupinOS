// Files: a sidebar of places, a toolbar, and the folder itself in icon or list view.
import { AppIcon, Button, MenuButton, Segmented, SidebarItem, SidebarSection, UiIcon, useContextMenu } from "@lupinos/ui";
import { type CSSProperties, type KeyboardEvent, type MouseEvent, useEffect, useState } from "react";
import { create } from "zustand";
import { openNode } from "../os/actions";
import type { AppProps } from "../os/apps";
import * as os from "../os/store";
import { nodeIcon } from "../os/ui";
import { children, isGone, pathOf, type VNode } from "../os/vfs";

type Prefs = { view: "grid" | "list"; hidden: boolean };
const usePrefs = create<Record<string, Prefs>>(() => ({}));
const prefsOf = (id: string): Prefs => usePrefs.getState()[id] ?? { view: "grid", hidden: false };
const setPrefs = (id: string, p: Partial<Prefs>) => usePrefs.setState((s) => ({ [id]: { ...prefsOf(id), ...s[id], ...p } }));

function useFolder(win: os.Win) {
  const sess = os.useSession();
  const nodes = os.nodesOf(sess);
  const dir = win.arg && !isGone(nodes, win.arg) ? win.arg : "root";
  const here = nodes.find((n) => n.id === dir);
  const go = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    os.setArg(win.id, id, n?.parent ? n.name : "LupinOS");
  };
  return { sess, nodes, dir, here, go };
}

const places = [
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "home", label: "Home", icon: "home" },
  { id: "desktop", label: "Desktop", icon: "display" },
  { id: "pictures", label: "Pictures", icon: "sparkle" },
];

export function Sidebar({ win }: AppProps) {
  const { dir, go } = useFolder(win);
  return (
    <>
      <SidebarSection title="Favourites">
        {places.map((p) => (
          <SidebarItem key={p.id} icon={<UiIcon name={p.icon} />} label={p.label} current={dir === p.id} onClick={() => go(p.id)} />
        ))}
      </SidebarSection>
      <SidebarSection title="Locations">
        <SidebarItem icon={<UiIcon name="display" />} label="LupinOS" current={dir === "root"} onClick={() => go("root")} />
        <SidebarItem icon={<UiIcon name="trash" />} label="Trash" onClick={() => os.open("trash")} />
      </SidebarSection>
    </>
  );
}

export function Toolbar({ win }: AppProps) {
  const { here, dir, go, sess } = useFolder(win);
  const prefs = usePrefs((s) => s[win.id]) ?? prefsOf(win.id);
  return (
    <>
      <Button variant="plain" icon aria-label="Enclosing folder" disabled={!here?.parent} onClick={() => here?.parent && go(here.parent)}>
        <UiIcon name="chevron-left" />
      </Button>
      <Segmented
        label="View"
        value={prefs.view}
        onChange={(view) => setPrefs(win.id, { view })}
        options={[
          { value: "grid", label: <UiIcon name="grid" />, title: "Icons" },
          { value: "list", label: <UiIcon name="list" />, title: "List" },
        ]}
      />
      <Button variant="plain" icon aria-label="New folder" disabled={here?.locked} onClick={() => os.createNode(dir, "untitled folder", { kind: "folder" })}>
        <UiIcon name="plus" />
      </Button>
      <MenuButton
        label="More"
        className="lui-button"
        items={[
          { label: "Show Hidden Files", checked: prefs.hidden, onSelect: () => setPrefs(win.id, { hidden: !prefs.hidden }) },
          { label: `Unhide ${sess?.hiddenIds.length ?? 0} Items`, disabled: !sess?.hiddenIds.length, onSelect: os.unhideAll },
        ]}
      >
        <UiIcon name="chevron-down" />
      </MenuButton>
    </>
  );
}

export default function Files({ win }: AppProps) {
  const { sess, nodes, dir, here, go } = useFolder(win);
  const prefs = usePrefs((s) => s[win.id]) ?? prefsOf(win.id);
  const [sel, setSel] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const ctx = useContextMenu();
  const items = children(nodes, dir, prefs.hidden, sess?.hiddenIds);
  const open = (n: VNode) => (n.kind === "folder" ? (go(n.id), setSel([])) : openNode(n));

  // Phone edge swipe and similar "back" gestures go up one folder first.
  useEffect(() => {
    const back = (e: Event) => {
      if (os.topWindow(os.session())?.id === win.id && here?.parent) {
        e.preventDefault();
        go(here.parent);
      }
    };
    addEventListener("lupin-back", back);
    return () => removeEventListener("lupin-back", back);
  });

  const onKey = (e: KeyboardEvent) => {
    if (renaming) return;
    if (e.key === "Delete" && sel.length) {
      if (e.shiftKey) {
        const mine = sel.filter((id) => !os.isOwnerFile(id));
        if (mine.length) os.confirmDialog("Delete for good?", "These items skip the Trash. This cannot be undone.", "Delete", () => os.destroy(mine));
      } else os.trash(sel);
      setSel([]);
    } else if (e.key === "F2" && sel.length === 1) {
      e.preventDefault();
      setRenaming(sel[0]);
    } else if (e.key === "Backspace" && here?.parent) go(here.parent);
  };

  const itemMenu = (e: MouseEvent, n: VNode) => {
    setSel([n.id]);
    const owned = os.isOwnerFile(n.id);
    ctx.open(e, [
      { label: "Open", onSelect: () => open(n) },
      "separator",
      { label: "Rename", shortcut: "F2", disabled: owned, onSelect: () => setRenaming(n.id) },
      { label: owned ? "Hide" : "Move to Trash", shortcut: "⌫", onSelect: () => os.trash([n.id]) },
      ...(n.blob && n.mime?.match(/^(image|video)/) ? (["separator", { label: "Set as Wallpaper", onSelect: () => os.setSettings({ wallpaper: n.id }) }] as const) : []),
    ]);
  };

  const name = (n: VNode) =>
    renaming === n.id ? (
      <input
        className="rename"
        // biome-ignore lint/a11y/noAutofocus: rename starts typing straight away
        autoFocus
        defaultValue={n.name}
        aria-label="New name"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setRenaming(null);
        }}
        onBlur={(e) => {
          os.rename(n.id, e.currentTarget.value);
          setRenaming(null);
        }}
      />
    ) : (
      <span>{n.name}</span>
    );

  const select = (e: MouseEvent, id: string) => setSel(e.ctrlKey || e.metaKey ? (sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]) : [id]);
  const kind = (n: VNode) => (n.kind === "folder" ? "Folder" : n.open === "project" ? "Project" : n.mime ? n.mime.split("/")[0] : "Document");

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the selection
    <div className="files" onKeyDown={onKey}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: clicking empty space clears the selection */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: same */}
      <div
        className="files-scroll"
        onClick={(e) => e.target === e.currentTarget && setSel([])}
        onContextMenu={(e) =>
          e.target === e.currentTarget &&
          ctx.open(e, [{ label: "New Folder", disabled: here?.locked, onSelect: () => os.createNode(dir, "untitled folder", { kind: "folder" }) }])
        }
      >
        {!items.length && <p className="empty">This folder is empty</p>}
        {prefs.view === "grid" ? (
          <div className="files-grid" role="listbox" aria-label={here?.name || "LupinOS"} aria-multiselectable="true">
            {items.map((n, i) => (
              <button
                key={n.id}
                type="button"
                role="option"
                className="files-item"
                style={{ "--i": i } as CSSProperties}
                aria-selected={sel.includes(n.id)}
                onClick={(e) => select(e, n.id)}
                onDoubleClick={() => open(n)}
                onKeyDown={(e) => e.key === "Enter" && !renaming && open(n)}
                onContextMenu={(e) => itemMenu(e, n)}
              >
                <AppIcon name={nodeIcon(n)} />
                {name(n)}
              </button>
            ))}
          </div>
        ) : (
          items.length > 0 && (
            <table className="files-list">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Where</th>
                </tr>
              </thead>
              <tbody>
                {items.map((n) => (
                  <tr
                    key={n.id}
                    aria-selected={sel.includes(n.id)}
                    tabIndex={0}
                    onClick={(e) => select(e, n.id)}
                    onDoubleClick={() => open(n)}
                    onKeyDown={(e) => e.key === "Enter" && !renaming && open(n)}
                    onContextMenu={(e) => itemMenu(e, n)}
                  >
                    <td>
                      <AppIcon name={nodeIcon(n)} />
                      {name(n)}
                    </td>
                    <td>{kind(n)}</td>
                    <td>{os.isOwnerFile(n.id) ? "Portfolio" : "Yours"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
      <footer className="files-status">
        {items.length} {items.length === 1 ? "item" : "items"} · {pathOf(nodes, dir)}
        {here?.locked && " · read-only"}
      </footer>
      {ctx.menu}
    </div>
  );
}
