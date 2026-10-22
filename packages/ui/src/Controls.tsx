// Small building blocks for window content: sidebar sections and items, a segmented control,
// a switch and a button. They are thin wrappers over the lui-* classes in lupin.css.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="lui-sidebar" role="group" aria-label={title}>
      <div className="lui-sidebar-section">{title}</div>
      {children}
    </div>
  );
}

export function SidebarItem({
  icon,
  label,
  current,
  badge,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  current?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="lui-sidebar-item" aria-current={current || undefined} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {badge !== undefined && <span className="lui-badge">{badge}</span>}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="lui-segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.title} aria-label={o.title} onClick={() => o.value !== value && onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="checkbox" role="switch" className="lui-switch" {...props} />;
}

export function Button({
  variant,
  icon,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "plain"; icon?: boolean }) {
  return (
    <button
      type="button"
      className={className ? `lui-button ${className}` : "lui-button"}
      data-variant={variant}
      data-icon={icon || undefined}
      {...rest}
    />
  );
}
