// A glass side panel that slides in from the edge, like a notification centre. Escape or a
// click outside closes it, and it slides back out before unmounting.
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePortalTarget } from "./Root.tsx";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left";
  label: string;
  width?: number;
  children: ReactNode;
};

const LEAVE_MS = 320;

export function Drawer({ open, onClose, side = "right", label, width = 380, children }: DrawerProps) {
  const target = usePortalTarget();
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const t = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, LEAVE_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [open, onClose]);

  if (!mounted || !target) return null;
  return createPortal(
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: clicking outside the drawer closes it */}
      <div className="lui-drawer-catch" onPointerDown={onClose} />
      <aside className="lui-drawer" role="dialog" aria-label={label} data-side={side} data-leaving={leaving || undefined} style={{ width }}>
        {children}
      </aside>
    </>,
    target,
  );
}
