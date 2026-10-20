// A month calendar. Month and weekday names come from Intl, so any locale works. With `lunar`,
// each day also shows its date in the Chinese lunisolar calendar (Âm lịch / 農曆), computed by
// the browser's Intl support for the "chinese" calendar.
import { useMemo, useState } from "react";
import { UiIcon } from "./icons.tsx";

export type CalendarProps = {
  /** BCP 47 locale for month and weekday names, such as "en", "zh-Hans", "zh-Hant", "vi". */
  locale?: string;
  /** Show lunar dates under each day. */
  lunar?: boolean;
  /** Time zone for lunar dates. Asia/Ho_Chi_Minh gives Vietnamese Âm lịch, Asia/Shanghai gives 农历. */
  lunarTimeZone?: string;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
  value?: Date;
  onChange?: (d: Date) => void;
  labels?: { today: string; previous: string; next: string };
};

/** The lunar month and day for a date, or undefined if the browser lacks the Chinese calendar. */
export function lunarDate(d: Date, timeZone = "Asia/Ho_Chi_Minh"): { month: string; day: number } | undefined {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-chinese", { month: "numeric", day: "numeric", timeZone }).formatToParts(d);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    return Number.isFinite(day) ? { month, day } : undefined;
  } catch {
    return undefined;
  }
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function Calendar({
  locale,
  lunar,
  lunarTimeZone,
  weekStartsOn = 1,
  value,
  onChange,
  labels = { today: "Today", previous: "Previous month", next: "Next month" },
}: CalendarProps) {
  const today = new Date();
  const [view, setView] = useState(() => new Date((value ?? today).getFullYear(), (value ?? today).getMonth(), 1));
  const [dir, setDir] = useState(0);

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() - weekStartsOn + 7) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), 1 - offset + i));
  }, [view, weekStartsOn]);

  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 7 + weekStartsOn + i)));
  }, [locale, weekStartsOn]);

  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(view);
  const go = (n: number) => {
    setDir(n);
    setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  };

  return (
    <div className="lui-calendar">
      <header>
        <strong aria-live="polite">{title}</strong>
        <div>
          <button type="button" className="lui-button" data-variant="plain" data-icon aria-label={labels.previous} onClick={() => go(-1)}>
            <UiIcon name="chevron-left" />
          </button>
          <button
            type="button"
            className="lui-button"
            data-variant="plain"
            onClick={() => {
              setDir(0);
              setView(new Date(today.getFullYear(), today.getMonth(), 1));
            }}
          >
            {labels.today}
          </button>
          <button type="button" className="lui-button" data-variant="plain" data-icon aria-label={labels.next} onClick={() => go(1)}>
            <UiIcon name="chevron-right" />
          </button>
        </div>
      </header>
      <div className="lui-calendar-week" aria-hidden="true">
        {weekdays.map((w, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: narrow weekday names repeat
          <span key={i}>{w}</span>
        ))}
      </div>
      <div key={view.getTime()} className="lui-calendar-grid" role="grid" aria-label={title} data-dir={dir}>
        {days.map((d) => {
          const l = lunar ? lunarDate(d, lunarTimeZone) : undefined;
          return (
            <button
              key={d.getTime()}
              type="button"
              role="gridcell"
              className="lui-calendar-day"
              data-outside={d.getMonth() !== view.getMonth() || undefined}
              data-today={sameDay(d, today) || undefined}
              aria-selected={value ? sameDay(d, value) : undefined}
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(d)}
              onClick={() => onChange?.(d)}
            >
              <span>{d.getDate()}</span>
              {l && <small data-new={l.day === 1 || undefined}>{l.day === 1 ? `${l.day}/${l.month}` : l.day}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
