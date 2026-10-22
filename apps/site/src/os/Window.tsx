// Connects the store to the @lupinos/ui window: the store owns position, focus and state,
// the package draws the chrome and handles drag, snap, resize and motion.
import { dockRect, Window } from "@lupinos/ui";
import { Component, type ComponentType, type ReactNode, Suspense, useCallback } from "react";
import { deskArea, GAP } from "./actions";
import { closeDodges } from "./fun";
import type { WinMode } from "./wm";
import { type AppProps, apps } from "./apps";
import { LiquidWindow, useLiquid } from "./Liquid";
import * as os from "./store";
import type { Win } from "./store";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="empty">This app stopped responding. Close it and open it again.</p> : this.props.children;
  }
}

/** One lazily loaded piece of an app (body, sidebar or toolbar), with a spinner while it loads. */
export function AppPart({ part: Part, win, quiet }: { part: ComponentType<AppProps>; win: Win; quiet?: boolean }) {
  return (
    <Boundary>
      <Suspense fallback={quiet ? null : <div className="app-loading"><div className="spinner" /></div>}>
        <Part win={win} />
      </Suspense>
    </Boundary>
  );
}

/** The app inside a window. The touch shells use this directly. */
export const AppBody = ({ win }: { win: Win }) => <AppPart part={apps[win.app].Component} win={win} />;

type Props = {
  win: Win;
  focused: boolean;
  settings: os.Settings;
  /** Short label before the title, such as "02". */
  tag: string;
  mode: WinMode;
  /** Tiling and Chain: the slot the layout gives this window. */
  slot?: os.Rect;
  /** Chain: the strip's area, so a drag can travel the whole strip. */
  bounds?: () => os.Rect;
  /** Tiling and Chain: a dragged window was let go here. */
  onDrop?: (id: string, pointer: { x: number; y: number }) => void;
};

export function DesktopWindow({ win, focused, settings, tag, mode, slot, bounds, onDrop }: Props) {
  const def = apps[win.app];
  const free = mode === "free";
  const liquid = useLiquid() && settings.chrome === "liquid";
  const dockTarget = useCallback(() => dockRect(`win:${win.id}`) ?? dockRect(win.app) ?? dockRect("launcher"), [win.id, win.app]);
  return (
    <Window
      title={win.title}
      tag={tag}
      rect={slot ?? win}
      zIndex={win.z}
      focused={focused}
      minimized={win.min}
      maximized={mode !== "chain" && win.max}
      bounds={bounds ?? deskArea}
      minWidth={def.minW}
      minHeight={def.minH}
      sidebar={def.Sidebar && <AppPart part={def.Sidebar} win={win} quiet />}
      sidebarWidth={def.sidebarWidth}
      toolbar={def.Toolbar && <AppPart part={def.Toolbar} win={win} quiet />}
      // the id, so the right-click menu knows which window it is on
      className={`w-${win.id}`}
      backdrop={liquid && !win.min ? <LiquidWindow radius={settings.radius} /> : undefined}
      snapping={settings.snapping && free}
      momentum={settings.momentum && free}
      resizable={mode !== "tile"}
      gap={GAP}
      restoreSize={free && win.zone && win.restore ? { w: win.restore.w, h: win.restore.h } : undefined}
      openFrom={win.from}
      dockTarget={dockTarget}
      onRectChange={(r, zone, change) => {
        if (!free) {
          // Tiling swaps with the window under the drop; Chain moves the column along the strip.
          if (change.kind === "drag" && change.pointer) onDrop?.(win.id, change.pointer);
          // In Chain only the width of a column can change.
          else if (mode === "chain" && change.kind === "resize") os.moveWin(win.id, { w: r.w });
          return;
        }
        // Snapping remembers the floating rect; dragging away (already back at that size) forgets it.
        if (zone) return os.moveWin(win.id, { ...r, zone, restore: win.restore ?? { x: win.x, y: win.y, w: win.w, h: win.h } });
        os.moveWin(win.id, { ...r, zone: undefined, restore: undefined });
      }}
      onFocus={() => os.focus(win.id)}
      onClose={() => os.close(win.id)}
      canClose={(button) => !closeDodges(button)}
      onMinimize={() => os.minimize(win.id)}
      onToggleMaximize={() => {
        // A chained column grows to the full screen width and back.
        if (mode !== "chain") return os.toggleMax(win.id);
        const full = deskArea().w - GAP * 2;
        os.moveWin(win.id, win.w >= full ? { w: win.restore?.w ?? Math.round(full / 2) } : { w: full, restore: { x: win.x, y: win.y, w: win.w, h: win.h } });
      }}
      onShake={settings.shake && free ? () => os.minimizeOthers(win.id) : undefined}
    >
      <AppPart part={def.Component} win={win} />
    </Window>
  );
}
