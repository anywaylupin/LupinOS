// Tablet and phone shells: the same apps, files and users, laid out for touch.
// Phone: full-screen apps, edge swipe back, one pull-down shade.
// Tablet: bigger home, split view, slide-over, and two shades (notifications left, controls right).
import { type CSSProperties, type MouseEvent, type ReactNode, type PointerEvent as RPointerEvent, useRef, useState } from "react";
import { effectiveMode, openNode, restart, toggleMode } from "./actions";
import { apps } from "./apps";
import { NotesList, useBattery } from "./Desktop";
import { themeList } from "@lupinos/ui";
import * as os from "./store";
import { clock, day, Icon, nodeIcon, useNow } from "./ui";
import { AppBody } from "./Window";
import { children, type VNode } from "./vfs";

type Item = { id: string; name: string; icon: string; open: () => void; node?: VNode };
type Shell = "tablet" | "phone";

const vibrate = () => navigator.vibrate?.(12);

/** Tracks one pointer gesture and reports its travel. */
function useSwipe(onEnd: (dx: number, dy: number, ms: number) => void, onHold?: (dy: number) => void) {
  const start = useRef<{ x: number; y: number; t: number; held: boolean } | null>(null);
  const timer = useRef(0);
  const last = useRef({ dx: 0, dy: 0 });
  return {
    onPointerDown: (e: RPointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      start.current = { x: e.clientX, y: e.clientY, t: performance.now(), held: false };
      last.current = { dx: 0, dy: 0 };
      if (onHold)
        timer.current = window.setTimeout(() => {
          if (start.current && last.current.dy < -40) {
            start.current.held = true;
            onHold(last.current.dy);
          }
        }, 380);
    },
    onPointerMove: (e: RPointerEvent) => {
      if (start.current) last.current = { dx: e.clientX - start.current.x, dy: e.clientY - start.current.y };
    },
    onPointerUp: (e: RPointerEvent) => {
      clearTimeout(timer.current);
      const s = start.current;
      start.current = null;
      if (s && !s.held) onEnd(e.clientX - s.x, e.clientY - s.y, performance.now() - s.t);
    },
  };
}

function Shade({ shell, side, sess, onClose }: { shell: Shell; side: "left" | "right" | "full"; sess: os.Session; onClose: () => void }) {
  const mode = effectiveMode(sess.settings);
  const swipe = useSwipe((_, dy) => dy < -50 && onClose());
  const controls = (
    <div className="quick">
      <button type="button" aria-pressed={mode === "dark"} onClick={toggleMode}>
        {mode === "dark" ? "Dark" : "Light"} mode
      </button>
      {themeList.map(({ id: t, name }) => (
        <button key={t} type="button" aria-pressed={sess.settings.theme === t} onClick={() => os.switchTheme(t)}>
          {name}
        </button>
      ))}
      <button type="button" onClick={() => (onClose(), os.open("settings"))}>
        Settings
      </button>
      <button type="button" onClick={os.lock}>
        Lock
      </button>
      <button type="button" onClick={restart}>
        Restart
      </button>
      <a className="btn" href="/plain">
        Plain version
      </a>
    </div>
  );
  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: 399 }} onPointerDown={onClose} aria-hidden="true" />
      <div className={`m-shade${side === "left" ? " left" : ""}`} role="dialog" aria-label={side === "left" ? "Notifications" : "Controls"} {...swipe}>
        {side !== "left" && controls}
        {(side !== "right" || shell === "phone") && <NotesList />}
        <button type="button" className="btn" style={{ width: "100%", marginTop: 8 }} onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

function Switcher({ sess, onPick, onClose }: { sess: os.Session; onPick: (id: string) => void; onClose: () => void }) {
  const wins = [...sess.windows].sort((a, b) => b.z - a.z);
  const [gone, setGone] = useState<string[]>([]);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape and the cards cover keyboard use
    <div className="m-switcher" role="listbox" aria-label="Open apps" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {!wins.length && <p className="sheet">No apps open.</p>}
      {wins.map((w) => (
        <Card
          key={w.id}
          win={w}
          gone={gone.includes(w.id)}
          onPick={() => onPick(w.id)}
          onFlick={() => {
            setGone((g) => [...g, w.id]);
            setTimeout(() => os.close(w.id), 220);
          }}
        />
      ))}
    </div>
  );
}

function Card({ win, gone, onPick, onFlick }: { win: os.Win; gone: boolean; onPick: () => void; onFlick: () => void }) {
  const [dy, setDy] = useState(0);
  const y0 = useRef<number | null>(null);
  return (
    <div
      className="m-card cut"
      role="option"
      aria-selected="false"
      tabIndex={0}
      style={{ transform: gone ? "translateY(-120vh)" : `translateY(${Math.min(0, dy)}px)`, opacity: gone ? 0 : 1 }}
      onPointerDown={(e) => (y0.current = e.clientY)}
      onPointerMove={(e) => y0.current !== null && setDy(e.clientY - y0.current)}
      onPointerUp={() => {
        y0.current = null;
        if (dy < -90) onFlick();
        else if (Math.abs(dy) < 8) onPick();
        setDy(0);
      }}
      onKeyDown={(e) => (e.key === "Enter" ? onPick() : e.key === "Delete" && onFlick())}
    >
      <header>
        <Icon name={apps[win.app].icon} />
        <strong>{win.title}</strong>
      </header>
      <div className="preview">Flick up to close</div>
    </div>
  );
}

function Pane({ win, onBack, extra }: { win: os.Win; onBack: () => void; extra?: ReactNode }) {
  return (
    <section className="m-pane" aria-label={win.title}>
      <div className="m-head">
        <button type="button" className="btn ghost" aria-label="Back" onClick={onBack}>
          &larr;
        </button>
        <h2>{win.title}</h2>
        {extra}
        <button type="button" className="btn ghost" aria-label={`Close ${win.title}`} onClick={() => os.close(win.id)}>
          &times;
        </button>
      </div>
      <AppBody win={win} />
    </section>
  );
}

export function Mobile({ sess, shell }: { sess: os.Session; shell: Shell }) {
  const now = useNow(15_000);
  const battery = useBattery();
  const [shade, setShade] = useState<null | "left" | "right" | "full">(null);
  const [switcher, setSwitcher] = useState(false);
  const [sheet, setSheet] = useState<Item | null>(null);
  const [split, setSplit] = useState<string | null>(null);
  const [slide, setSlide] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pressed = useRef(false);

  const nodes = os.nodesOf(sess);
  const visible = sess.windows.filter((w) => !w.min && w.id !== slide && w.id !== split);
  const active = visible.reduce<os.Win | undefined>((a, w) => (!a || w.z > a.z ? w : a), undefined);
  const splitWin = shell === "tablet" && active ? sess.windows.find((w) => w.id === split && !w.min) : undefined;
  const slideWin = shell === "tablet" ? sess.windows.find((w) => w.id === slide && !w.min) : undefined;

  const app = (id: string, arg?: string): Item => ({ id, name: apps[id].name, icon: apps[id].icon, open: () => os.open(id, { arg }) });
  const fileItem = (n: VNode): Item => ({ id: n.id, name: n.name, icon: nodeIcon(n), node: n, open: () => openNode(n) });
  const projects = nodes.find((n) => n.id === "projects");
  const home: Item[] = [
    ...(projects ? [{ ...fileItem(projects), name: "Projects", icon: "folder" }] : []),
    app("about"),
    app("resume"),
    app("contact"),
    app("files", "root"),
    app("terminal"),
    app("settings"),
    app("trash"),
    ...children(nodes, "desktop", false, sess.hiddenIds)
      .filter((n) => !n.open || n.open === "viewer")
      .map(fileItem),
  ];
  const perPage = shell === "phone" ? 12 : 20;
  const pages = Array.from({ length: Math.ceil(home.length / perPage) }, (_, i) => home.slice(i * perPage, (i + 1) * perPage));
  const dock = shell === "phone" ? home.slice(0, 4) : home.slice(0, 7);

  const goHome = () => {
    setSwitcher(false);
    os.minimizeAll();
    setSplit(null);
    setSlide(null);
  };
  const back = () => {
    const ev = new CustomEvent("lupin-back", { cancelable: true });
    dispatchEvent(ev);
    if (!ev.defaultPrevented && active) os.minimize(active.id);
  };

  const homeBar = useSwipe(
    (_, dy) => dy < -50 && goHome(),
    () => {
      vibrate();
      setSwitcher(true);
    },
  );
  const edge = useSwipe((dx) => dx > 60 && back());
  const topLeft = useSwipe((_, dy) => dy > 30 && setShade(shell === "phone" ? "full" : "left"));
  const topRight = useSwipe((_, dy) => dy > 30 && setShade(shell === "phone" ? "full" : "right"));

  const longPress = (it: Item) => ({
    onPointerDown: () => {
      pressed.current = false;
      const t = window.setTimeout(() => {
        pressed.current = true;
        vibrate();
        setSheet(it);
      }, 500);
      const clear = () => {
        clearTimeout(t);
        removeEventListener("pointerup", clear);
        removeEventListener("pointercancel", clear);
      };
      addEventListener("pointerup", clear);
      addEventListener("pointercancel", clear);
    },
    onClick: () => {
      if (!pressed.current) it.open();
      pressed.current = false;
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      setSheet(it);
    },
  });

  const openAs = (it: Item, as: "split" | "slide") => {
    setSheet(null);
    // Split pairs the new app with the most recent other one, even if it was sent home.
    const before = [...sess.windows].sort((a, b) => b.z - a.z)[0]?.id;
    it.open();
    const id = os.topWindow(os.session())?.id;
    if (!id) return;
    if (as === "slide") {
      setSlide(id);
    } else if (before && before !== id) {
      setSplit(id);
      os.focus(before);
    }
  };

  const icon = (it: Item, i: number) => (
    <button key={it.id} type="button" className="icon" style={{ "--i": i } as CSSProperties} aria-label={it.name} {...longPress(it)}>
      <Icon name={it.icon} accent={it.id === "projects"} />
      <span>{it.name}</span>
    </button>
  );

  return (
    <div className="m-shell" data-shell={shell}>
      <div className="m-status">
        <span>{clock(now)}</span>
        <span>
          {battery.charging ? "⚡" : ""}
          {battery.level}%
        </span>
      </div>
      <div className="m-top-edge" style={{ left: 0 }} {...topLeft} onClick={() => setShade(shell === "phone" ? "full" : "left")} aria-hidden="true" />
      <div className="m-top-edge" style={{ right: 0 }} {...topRight} onClick={() => setShade(shell === "phone" ? "full" : "right")} aria-hidden="true" />

      <div className="m-pages" onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {pages.map((items, p) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: pages are positional
          <div key={p} className="m-page" role="group" aria-label={`Home page ${p + 1}`}>
            {p === 0 && (
              <>
                <div className="m-widget cut">
                  <div className="big">{clock(now)}</div>
                  <div className="muted">{day(now, { weekday: "long", day: "numeric", month: "long" })}</div>
                </div>
                {shell === "tablet" && (
                  <button type="button" className="m-widget cut" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => os.open("project", { arg: "project-01", title: "project-01" })}>
                    <small className="muted">Featured</small>
                    <div className="display" style={{ fontSize: 22 }}>
                      Project 01
                    </div>
                    <div className="muted">Lorem ipsum dolor sit amet.</div>
                  </button>
                )}
              </>
            )}
            {items.map(icon)}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="m-dots" aria-hidden="true">
          {pages.map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional
            <i key={i} className={i === page ? "on" : undefined} />
          ))}
        </div>
      )}
      <nav className="m-dock cut" aria-label="Dock">
        {dock.map(icon)}
      </nav>

      {active && (
        <div className={`m-app${splitWin ? " split" : ""}`}>
          <Pane
            win={active}
            onBack={back}
            extra={
              shell === "tablet" &&
              !splitWin && (
                <button type="button" className="btn ghost" onClick={() => setSwitcher(true)} aria-label="Open apps">
                  &#x25A6;
                </button>
              )
            }
          />
          {splitWin && (
            <>
              <div className="divider" aria-hidden="true" />
              <Pane win={splitWin} onBack={() => setSplit(null)} />
            </>
          )}
        </div>
      )}
      {slideWin && (
        <div className="m-slide cut">
          <Pane win={slideWin} onBack={() => setSlide(null)} />
        </div>
      )}

      {shell === "phone" && active && <div className="m-edge" {...edge} aria-hidden="true" />}
      <div className="m-home-bar" {...homeBar} onDoubleClick={() => setSwitcher(true)} role="button" tabIndex={0} aria-label="Home. Swipe up to go home, swipe up and hold for open apps." onKeyDown={(e) => e.key === "Enter" && goHome()}>
        <i />
      </div>

      {switcher && (
        <Switcher
          sess={sess}
          onClose={() => setSwitcher(false)}
          onPick={(id) => {
            setSwitcher(false);
            if (id === split) setSplit(null);
            if (id === slide) setSlide(null);
            os.focus(id);
          }}
        />
      )}
      {shade && <Shade shell={shell} side={shade} sess={sess} onClose={() => setShade(null)} />}
      {sheet && (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 410 }} onPointerDown={() => setSheet(null)} aria-hidden="true" />
          <div className="m-sheet cut" role="menu" aria-label={`${sheet.name} actions`}>
            <strong>{sheet.name}</strong>
            <button type="button" role="menuitem" onClick={() => (setSheet(null), sheet.open())}>
              Open
            </button>
            {shell === "tablet" && sess.windows.length > 0 && (
              <button type="button" role="menuitem" onClick={() => openAs(sheet, "split")}>
                Open in split view
              </button>
            )}
            {shell === "tablet" && (
              <button type="button" role="menuitem" onClick={() => openAs(sheet, "slide")}>
                Open as slide-over
              </button>
            )}
            {sheet.node && sheet.node.id !== "projects" && (
              <button type="button" role="menuitem" onClick={() => (setSheet(null), os.trash([sheet.id]))}>
                {os.isOwnerFile(sheet.id) ? "Hide" : "Move to Trash"}
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => setSheet(null)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
