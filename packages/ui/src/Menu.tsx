// Menus that behave like a desktop OS: they grow from where you clicked, follow the pointer,
// open submenus on hover, and answer to arrow keys, Enter, Escape and type-ahead.
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePortalTarget } from "./Root.tsx";

export type MenuItem =
  | {
      label: string;
      /** Shown on the right, like ⌘K. Display only. */
      shortcut?: string;
      checked?: boolean;
      disabled?: boolean;
      icon?: ReactNode;
      onSelect?: () => void;
      /** A submenu. */
      items?: MenuItem[];
    }
  | "separator";

export type MenuProps = {
  items: MenuItem[];
  /** Screen position of the top-left corner (it flips to stay on screen). */
  x: number;
  y: number;
  onClose: () => void;
  label?: string;
  /** Called after a leaf item is chosen; used by submenus to close the whole chain. */
  onDone?: () => void;
  /** Left and right arrows from a menu bar menu. */
  onNavigate?: (dir: -1 | 1) => void;
  isSubmenu?: boolean;
};

const CLOSE_MS = 110;

export function Menu({ items, x, y, onClose, label = "Menu", onDone, onNavigate, isSubmenu }: MenuProps) {
  const target = usePortalTarget();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y, origin: "top left" });
  const [closing, setClosing] = useState(false);
  const [sub, setSub] = useState<{ index: number; x: number; y: number } | null>(null);
  const returnFocus = useRef<Element | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);
  const done = onDone ?? close;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const flipX = x + r.width > innerWidth - 4;
    const flipY = y + r.height > innerHeight - 4;
    setPos({
      x: flipX ? Math.max(4, (isSubmenu ? x - r.width - 6 : x - r.width)) : x,
      y: flipY ? Math.max(4, innerHeight - r.height - 4) : y,
      origin: `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}`,
    });
    if (!isSubmenu) returnFocus.current = document.activeElement;
    el.focus({ preventScroll: true });
  }, [x, y, isSubmenu]);

  // Clicks anywhere outside every open menu close it.
  useEffect(() => {
    if (isSubmenu) return;
    const down = (e: PointerEvent) => {
      if (!(e.target as Element)?.closest?.(".lui-menu")) close();
    };
    const blur = () => close();
    const t = setTimeout(() => {
      addEventListener("pointerdown", down, true);
      addEventListener("blur", blur);
    });
    return () => {
      clearTimeout(t);
      removeEventListener("pointerdown", down, true);
      removeEventListener("blur", blur);
      if (returnFocus.current instanceof HTMLElement && document.contains(returnFocus.current)) returnFocus.current.focus({ preventScroll: true });
    };
  }, [close, isSubmenu]);

  const buttons = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>(":scope > .lui-menu-item:not(:disabled)") ?? [])];

  const openSub = (index: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setSub({ index, x: r.right + 2, y: r.top - 5 });
  };

  const choose = (index: number, el: HTMLElement) => {
    const it = items[index];
    if (it === "separator" || it.disabled) return;
    if (it.items) return openSub(index, el);
    done();
    it.onSelect?.();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = buttons();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (n: number) => all[(n + all.length) % all.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        focusAt(i + 1);
        break;
      case "ArrowUp":
        focusAt(i < 0 ? all.length - 1 : i - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(all.length - 1);
        break;
      case "ArrowRight": {
        const el = all[i];
        const idx = el ? Number(el.dataset.index) : -1;
        const it = items[idx];
        if (el && it && it !== "separator" && it.items) openSub(idx, el);
        else onNavigate?.(1);
        break;
      }
      case "ArrowLeft":
        if (isSubmenu) onClose();
        else onNavigate?.(-1);
        break;
      case "Escape":
        if (isSubmenu) onClose();
        else close();
        break;
      case "Tab":
        close();
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const now = performance.now();
          typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
          all.find((b) => b.textContent?.trim().toLowerCase().startsWith(typed.current.text))?.focus();
          break;
        }
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  if (!target) return null;
  const subItem = sub ? items[sub.index] : undefined;

  return createPortal(
    <>
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        className="lui-menu"
        data-closing={closing || undefined}
        style={{ left: pos.x, top: pos.y, "--lui-origin": pos.origin } as CSSProperties}
        onKeyDown={onKey}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((it, i) =>
          it === "separator" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: separators have no identity
            <div key={`sep-${i}`} className="lui-menu-sep" role="separator" />
          ) : (
            <button
              key={it.label}
              type="button"
              role={it.checked === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={it.checked}
              aria-haspopup={it.items ? "menu" : undefined}
              aria-expanded={it.items ? sub?.index === i : undefined}
              data-index={i}
              data-active={sub?.index === i || undefined}
              disabled={it.disabled}
              className="lui-menu-item"
              onPointerEnter={(e) => {
                e.currentTarget.focus({ preventScroll: true });
                if (it.items) openSub(i, e.currentTarget);
                else if (sub) setSub(null);
              }}
              onClick={(e: ReactMouseEvent<HTMLButtonElement>) => choose(i, e.currentTarget)}
            >
              {it.checked && <span className="lui-menu-check">✓</span>}
              {it.icon}
              {it.label}
              {it.shortcut && <kbd>{it.shortcut}</kbd>}
              {it.items && <span className="lui-menu-chevron">›</span>}
            </button>
          ),
        )}
      </div>
      {sub && subItem && subItem !== "separator" && subItem.items && (
        <Menu
          items={subItem.items}
          x={sub.x}
          y={sub.y}
          label={subItem.label}
          isSubmenu
          onDone={done}
          onClose={() => {
            setSub(null);
            buttons().find((b) => Number(b.dataset.index) === sub.index)?.focus();
          }}
        />
      )}
    </>,
    target,
  );
}

/** A button that opens a menu below itself. */
export function MenuButton({
  items,
  label,
  className = "lui-button",
  children,
}: {
  items: MenuItem[];
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={!!at}
        aria-label={label}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { x: r.left, y: r.bottom + 4 });
        }}
      >
        {children}
      </button>
      {at && <Menu items={items} x={at.x} y={at.y} label={label} onClose={() => setAt(null)} />}
    </>
  );
}

/** Right-click menus: spread `onContextMenu` on any element and render `menu` once. */
export function useContextMenu() {
  const [state, setState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const open = useCallback((e: { clientX: number; clientY: number; preventDefault(): void; stopPropagation?(): void }, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation?.();
    setState({ x: e.clientX, y: e.clientY, items });
  }, []);
  const menu = state ? <Menu items={state.items} x={state.x} y={state.y} label="Context menu" onClose={() => setState(null)} /> : null;
  return { open, menu, isOpen: !!state };
}
