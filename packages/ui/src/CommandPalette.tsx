// A Spotlight-style search box: type to filter, arrows to move, Enter to run, Escape to close.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UiIcon } from "./icons.tsx";
import { usePortalTarget } from "./Root.tsx";

export type PaletteItem = {
  id: string;
  label: string;
  /** Grey text on the right, such as a path or a shortcut. */
  hint?: string;
  /** Results are grouped under their section name. */
  section?: string;
  icon?: ReactNode;
  /** Extra words that should match, not shown. */
  keywords?: string;
  onSelect: () => void;
};

export type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
  placeholder?: string;
  /** Shown when the box is empty. Defaults to the first ten items. */
  suggestions?: PaletteItem[];
  emptyText?: string;
};

export function CommandPalette({ open, onClose, items, placeholder = "Search", suggestions, emptyText = "No results" }: CommandPaletteProps) {
  const target = usePortalTarget();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setI(0);
    }
  }, [open]);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return suggestions ?? items.slice(0, 10);
    return items
      .filter((h) => `${h.label} ${h.hint ?? ""} ${h.keywords ?? ""}`.toLowerCase().includes(t))
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(t)) - Number(!b.label.toLowerCase().startsWith(t)))
      .slice(0, 40);
  }, [q, items, suggestions]);

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [i]);

  if (!open || !target) return null;
  const run = (h?: PaletteItem) => {
    if (!h) return;
    onClose();
    h.onSelect();
  };

  let lastSection: string | undefined;
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking outside the box closes it
    <div className="lui-palette-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lui-palette" role="dialog" aria-label={placeholder}>
        <div className="lui-palette-head">
          <UiIcon name="search" />
          <input
            className="lui-palette-input"
            // biome-ignore lint/a11y/noAutofocus: a search box exists to be typed in
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="lui-palette-list"
            aria-activedescendant={hits[i] ? `lui-p-${hits[i].id}` : undefined}
            aria-label={placeholder}
            placeholder={placeholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setI((i + 1) % Math.max(1, hits.length));
              else if (e.key === "ArrowUp") setI((i - 1 + hits.length) % Math.max(1, hits.length));
              else if (e.key === "Enter") run(hits[i]);
              else if (e.key === "Escape") onClose();
              else return;
              e.preventDefault();
            }}
          />
        </div>
        {hits.length ? (
          <ul ref={list} id="lui-palette-list" className="lui-palette-list" role="listbox" aria-label="Results">
            {hits.map((h, k) => {
              const head = h.section && h.section !== lastSection ? h.section : undefined;
              lastSection = h.section;
              return (
                <li key={h.id} role="presentation">
                  {head && <div className="lui-palette-section">{head}</div>}
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard is handled by the combobox */}
                  <div
                    id={`lui-p-${h.id}`}
                    role="option"
                    aria-selected={k === i}
                    className="lui-palette-item"
                    onPointerMove={() => k !== i && setI(k)}
                    onClick={() => run(h)}
                  >
                    {h.icon}
                    <span>{h.label}</span>
                    {h.hint && <small>{h.hint}</small>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="lui-palette-empty">{emptyText}</div>
        )}
      </div>
    </div>,
    target,
  );
}
