# @lupinos/ui

Desktop components for React that look and move like a real operating system: a window manager with snapping and momentum, a magnifying dock, a menu bar, context menus, a Spotlight-style command palette, notification banners, two icon sets and seven themes.

This is the component library behind LupinOS, a portfolio built as a made-up desktop OS.

## Install

```bash
npm install @lupinos/ui
```

React 18 or newer is a peer dependency. There are no other runtime dependencies.

## Quick start

```tsx
import { AppIcon, Dock, LupinRoot, MenuBar, StatusCapsule, Wallpaper, Window } from "@lupinos/ui";
import "@lupinos/ui/styles.css";
import { useState } from "react";

export function Desktop() {
  const [rect, setRect] = useState({ x: 120, y: 80, w: 640, h: 420 });
  const [open, setOpen] = useState(true);

  return (
    <LupinRoot theme="peli" mode="light" style={{ position: "fixed", inset: 0 }}>
      <Wallpaper />
      <MenuBar
        logo="◆"
        logoItems={[{ label: "About This Computer" }, "separator", { label: "Restart…" }]}
        appName="Notes"
        menus={[{ label: "File", items: [{ label: "New Note", shortcut: "⌘N", onSelect: () => setOpen(true) }] }]}
        status={<StatusCapsule>Tue 20 Oct 09:41</StatusCapsule>}
      />
      {open && (
        <Window title="Notes" rect={rect} onRectChange={setRect} focused onClose={() => setOpen(false)}>
          <p style={{ padding: 16 }}>Hello.</p>
        </Window>
      )}
      <Dock items={[{ id: "notes", label: "Notes", icon: <AppIcon name="doc" />, running: open, onClick: () => setOpen(true) }]} />
    </LupinRoot>
  );
}
```

Everything renders inside `LupinRoot`, which sets the theme and mode. Menus and popovers portal into it, so they always match.

## Themes

Seven themes run red through pink. Each blends three or four colours and works in light and dark mode.

| Theme | Colour | Mood |
| --- | --- | --- |
| `kova` | Garnet | Akira × cyberpunk |
| `tazu` | Kiln | Wukong × anime |
| `mimo` | Pollen | Bee × anime |
| `olvi` | Moss | Wukong × hanyu |
| `lisen` | Glacier | Far future × Akira |
| `yune` | Dusk Iris | Cyberpunk × anime |
| `peli` | Peony | Anime × hanyu |

`themeList` gives you `{ id, name, hue, mood, mode, wallpaper, swatches }` for each, for pickers and previews.

Every component reads only `--lui-*` CSS variables, so you can make your own theme by setting them on `.lui`:

```css
.lui[data-lui-theme="mine"][data-lui-mode="light"] {
  --lui-wall: linear-gradient(160deg, #cfe0ff, #f6d6ff);
  --lui-content: #f7f5fb;
  --lui-sidebar: rgb(240 236 248 / 0.6);
  --lui-side-sel: rgb(0 0 0 / 0.07);
  --lui-menu: rgb(248 246 252 / 0.78);
  --lui-accent: #6a5acd;
  --lui-on-accent: #fff;
  --lui-i1: #6a5acd; --lui-i2: #3d3a6e; --lui-i3: #f6f4fb; --lui-i4: #1f1d33;
}
```

## Components

| Component | What it does |
| --- | --- |
| `LupinRoot` | Sets `theme`, `mode` and `motion` for everything inside. |
| `Wallpaper` | The theme gradient, or your own `image` or `video`. Fades between changes. |
| `MenuBar`, `StatusCapsule` | The top bar. Click a title, then slide across; arrow keys walk the menus. |
| `Menu`, `MenuButton`, `useContextMenu` | Menus that grow from the pointer, open submenus on hover, and support arrows, Enter, Escape and type-ahead. |
| `Window`, `Lights` | A controlled window: traffic lights, an optional full-height `sidebar`, a `toolbar`, drag with momentum, edge and corner snapping, eight resize grips, shake to clear, and open, close and minimise motion. |
| `Dock`, `dockRect` | A frosted dock with macOS-style magnification, labels, running dots and a launch bounce. |
| `CommandPalette` | Spotlight-style search with sections, keyboard navigation and suggestions. |
| `Toasts` | Notification banners that slide in and out. |
| `SidebarSection`, `SidebarItem`, `Segmented`, `Switch`, `Button` | Building blocks for window content. |
| `AppIcon` | Solid 2D app icons coloured by the theme: `files`, `folder`, `project`, `about`, `resume`, `doc`, `mail`, `terminal`, `settings`, `music`, `photos`, `video`, `games`, `launcher`, `trash`, `user`. |
| `UiIcon` | Line glyphs that animate when their button is hovered: `wifi`, `battery`, `volume`, `bell`, `search`, `settings`, `sun`, `moon`, `home`, `trash`, `folder`, `grid`, `list`, `mail`, `lock`, `power` and more. |

### Window

`Window` does not keep its own position. Pass `rect` and update it in `onRectChange(rect, zone)`, which fires when a drag, throw, snap or resize ends. That makes layouts easy to save.

Mark any part of your content `data-lui-drag` to make it a drag handle, or `data-lui-nodrag` to opt a control out.

### Geometry helpers

`zoneAt`, `zoneRect`, `dockScale` and `clamp` are the pure functions behind snapping and magnification, exported in case you want to build your own window manager.

## Accessibility

Windows are labelled dialogs. Menus use `menu` and `menuitem` roles with full keyboard support and return focus when they close. The palette is a combobox with a listbox. Notifications live in a polite live region. Motion follows the system "reduce motion" setting unless you set `motion` on `LupinRoot` (`"full"`, `"reduced"` or `"none"`).

## License

MIT
