// Notification banners in the top-right corner. They slide in, stack, and slide out when dismissed.
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePortalTarget } from "./Root.tsx";

export type Toast = { id: string; title: string; body?: string; icon?: ReactNode };

export type ToastsProps = {
  toasts: Toast[];
  /** Called when a banner is clicked; remove it from `toasts` to slide it out. */
  onDismiss?: (id: string) => void;
};

const LEAVE_MS = 220;

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  const target = usePortalTarget();
  // Keep removed toasts around just long enough to play their exit.
  const [shown, setShown] = useState<(Toast & { leaving?: boolean })[]>(toasts);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const ids = new Set(toasts.map((t) => t.id));
    setShown((cur) => {
      const kept = cur.map((t) => (ids.has(t.id) ? t : { ...t, leaving: true }));
      const added = toasts.filter((t) => !cur.some((c) => c.id === t.id));
      return [...kept, ...added];
    });
    for (const t of shown) {
      if (!ids.has(t.id) && !timers.current.has(t.id)) {
        timers.current.set(
          t.id,
          setTimeout(() => {
            timers.current.delete(t.id);
            setShown((cur) => cur.filter((c) => c.id !== t.id));
          }, LEAVE_MS),
        );
      }
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: reacts to the incoming list only
  }, [toasts]);

  if (!target) return null;
  return createPortal(
    <div className="lui-toasts" role="status" aria-live="polite">
      {shown.map((t) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: banners dismiss themselves; clicking is a shortcut
        <div key={t.id} className="lui-toast" data-id={t.id} data-leaving={t.leaving || undefined} onClick={() => onDismiss?.(t.id)}>
          {t.icon}
          <div>
            <strong>{t.title}</strong>
            {t.body && <p>{t.body}</p>}
          </div>
        </div>
      ))}
    </div>,
    target,
  );
}
