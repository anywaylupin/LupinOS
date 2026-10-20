// Connects the store to the @lupinos/ui window: the store owns position, focus and state,
// the package draws the chrome and handles drag, snap, resize and motion.
import { dockRect, Window } from "@lupinos/ui";
import { Component, type ComponentType, type ReactNode, Suspense, useCallback } from "react";
import { deskArea } from "./actions";
import { type AppProps, apps } from "./apps";
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

export function DesktopWindow({ win, focused, settings }: { win: Win; focused: boolean; settings: os.Settings }) {
  const def = apps[win.app];
  const dockTarget = useCallback(() => dockRect(`win:${win.id}`) ?? dockRect(win.app) ?? dockRect("launcher"), [win.id, win.app]);
  return (
    <Window
      title={win.title}
      rect={win}
      zIndex={win.z}
      focused={focused}
      minimized={win.min}
      maximized={win.max}
      bounds={deskArea}
      minWidth={def.minW}
      minHeight={def.minH}
      sidebar={def.Sidebar && <AppPart part={def.Sidebar} win={win} quiet />}
      sidebarWidth={def.sidebarWidth}
      toolbar={def.Toolbar && <AppPart part={def.Toolbar} win={win} quiet />}
      snapping={settings.snapping}
      momentum={settings.momentum}
      openFrom={win.from}
      dockTarget={dockTarget}
      onRectChange={(r, zone) => {
        // Dragging a snapped window away gives it back its old size, like macOS.
        const draggedOut = !zone && win.zone && win.restore && r.w === win.w && r.h === win.h;
        if (draggedOut && win.restore) return os.moveWin(win.id, { x: r.x, y: r.y, w: win.restore.w, h: win.restore.h, restore: undefined, zone: undefined });
        os.moveWin(win.id, zone ? { ...r, zone, restore: win.restore ?? { x: win.x, y: win.y, w: win.w, h: win.h } } : { ...r, zone: undefined, restore: undefined });
      }}
      onFocus={() => os.focus(win.id)}
      onClose={() => os.close(win.id)}
      onMinimize={() => os.minimize(win.id)}
      onToggleMaximize={() => os.toggleMax(win.id)}
      onShake={settings.shake ? () => os.minimizeOthers(win.id) : undefined}
    >
      <AppPart part={def.Component} win={win} />
    </Window>
  );
}
