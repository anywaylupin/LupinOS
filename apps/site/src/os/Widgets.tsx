// Desktop widgets: small live tiles you can drag anywhere, resize from their menu, and add from
// the gallery. Each user keeps their own set, with positions, in their profile.
import { Plasma } from "@cruxgarden/plasma-ui";
import { Calendar, UiIcon, useContextMenu } from "@lupinos/ui";
import { type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Controls, Visualiser } from "../apps/Music";
import { emit } from "./bus";
import { localeOf, useT } from "./i18n";
import { useLiquid } from "./Liquid";
import * as music from "./music";
import * as os from "./store";
import { clock, day, fmtTime, useNow } from "./ui";

const GRID = 12;
const INTERACTIVE = "button, input, textarea, select, a, label";

export const WIDGET_KINDS: { kind: os.WidgetKind; name: string; blurb: string }[] = [
  { kind: "clock", name: "Clock", blurb: "Local time. Click for a second city." },
  { kind: "weather", name: "Weather", blurb: "Real weather, after you allow location." },
  { kind: "note", name: "Sticky note", blurb: "A few lines, saved in your profile." },
  { kind: "music", name: "Music", blurb: "Play, pause and skip the playlist." },
  { kind: "monitor", name: "System monitor", blurb: "Real frame rate, fake honey levels." },
  { kind: "focus", name: "Focus timer", blurb: "Twenty-five minutes of compliance." },
  { kind: "fortune", name: "Fortune", blurb: "Advice from the issuing corporation." },
  { kind: "counter", name: "Visitor counter", blurb: "Your visits, on this device only." },
  { kind: "calendar", name: "Calendar", blurb: "This month at a glance." },
];

// ---- the tiles ----------------------------------------------------------------------------------

const CITIES = [
  { name: "London", tz: "Europe/London" },
  { name: "Berlin", tz: "Europe/Berlin" },
  { name: "New York", tz: "America/New_York" },
  { name: "Tokyo", tz: "Asia/Tokyo" },
];

function ClockTile({ w }: { w: os.Widget }) {
  const now = useNow();
  const zone = CITIES.find((c) => c.tz === w.zone);
  const deg = (v: number, max: number) => `rotate(${(v / max) * 360}deg)`;
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const next = () => {
    const i = CITIES.findIndex((c) => c.tz === w.zone);
    os.updateWidget(w.id, { zone: i + 1 < CITIES.length ? CITIES[i + 1].tz : undefined });
  };
  return (
    <button type="button" className="clock-tile" aria-label={`${clock(now)}. Add a second city.`} onClick={next}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" className="face" />
        {Array.from({ length: 12 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: twelve fixed ticks
          <line key={i} x1="50" y1="8" x2="50" y2={i % 3 ? 13 : 17} transform={`rotate(${i * 30} 50 50)`} className="tick" />
        ))}
        <line x1="50" y1="50" x2="50" y2="27" className="hand" style={{ transform: deg(h + m / 60, 12) }} />
        <line x1="50" y1="50" x2="50" y2="16" className="hand thin" style={{ transform: deg(m + s / 60, 60) }} />
        <line x1="50" y1="56" x2="50" y2="12" className="hand sec" style={{ transform: deg(s, 60) }} />
        <circle cx="50" cy="50" r="2.6" className="pin" />
      </svg>
      <span>
        <b>{clock(now)}</b>
        {zone && (
          <small>
            {zone.name} {now.toLocaleTimeString([], { timeZone: zone.tz, hour: "2-digit", minute: "2-digit" })}
          </small>
        )}
      </span>
    </button>
  );
}

const WEATHER: [number, string][] = [
  [0, "Clear"],
  [3, "Partly cloudy"],
  [48, "Fog"],
  [57, "Drizzle"],
  [67, "Rain"],
  [77, "Snow"],
  [82, "Showers"],
  [99, "Thunderstorm"],
];
const OMENS = ["Acid rain 40%", "Smog advisory: breathe politely", "UV index: corporate", "Drone traffic heavy", "Pollen count mandatory", "Visibility: classified"];
let weatherCache: { at: number; temp: number; text: string } | null = null;

function WeatherTile() {
  const [data, setData] = useState(weatherCache);
  const [state, setState] = useState<"idle" | "asking" | "error">("idle");
  const omen = OMENS[new Date().getHours() % OMENS.length];
  const locate = () => {
    if (!("geolocation" in navigator)) return setState("error");
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude.toFixed(2)}&longitude=${coords.longitude.toFixed(2)}&current=temperature_2m,weather_code&timezone=auto`;
          const j = await (await fetch(url)).json();
          const code = j.current.weather_code as number;
          weatherCache = { at: Date.now(), temp: Math.round(j.current.temperature_2m), text: (WEATHER.find(([max]) => code <= max) ?? WEATHER[0])[1] };
          setData(weatherCache);
          setState("idle");
        } catch {
          setState("error");
        }
      },
      () => setState("error"),
      { maximumAge: 30 * 60_000, timeout: 10_000 },
    );
  };
  return (
    <div className="weather-tile">
      <div className="weather-now">
        <b>{data ? `${data.temp}°` : "23°"}</b>
        <span>
          <strong>{data ? "Your location" : "Hive City"}</strong>
          <small>{data ? data.text : "Overcast, as scheduled"}</small>
        </span>
      </div>
      <p className="omen">{omen}</p>
      {!data && (
        <button type="button" className="lui-button" data-variant="plain" onClick={locate} disabled={state === "asking"}>
          {state === "asking" ? "Asking…" : state === "error" ? "Location unavailable" : "Use my location"}
        </button>
      )}
      {data && (
        <a className="credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Weather data by Open-Meteo.com
        </a>
      )}
    </div>
  );
}

function NoteTile({ w }: { w: os.Widget }) {
  const [text, setText] = useState(w.text ?? "");
  const t = useRef(0);
  return (
    <textarea
      className="note-tile"
      aria-label="Sticky note"
      value={text}
      placeholder="Write something…"
      onChange={(e) => {
        setText(e.target.value);
        clearTimeout(t.current);
        const v = e.target.value;
        t.current = window.setTimeout(() => os.updateWidget(w.id, { text: v }), 400);
      }}
    />
  );
}

function MusicTile() {
  const m = music.useMusic();
  const t = music.TRACKS[m.index];
  return (
    <div className="music-tile">
      <Visualiser bands={12} className="viz small" />
      <div>
        <strong>{t.title}</strong>
        <small>{t.artist}</small>
      </div>
      <div className="music-progress" style={{ "--p": `${(m.elapsed / t.seconds) * 100}%` } as CSSProperties}>
        <i />
      </div>
      <Controls />
    </div>
  );
}

function MonitorTile() {
  const [fps, setFps] = useState(60);
  const [cpu, setCpu] = useState<number[]>(() => Array(24).fill(12));
  const [honey, setHoney] = useState<number[]>(() => Array(24).fill(40));
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (t: number) => {
      frames++;
      if (t - last >= 1000) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
        // Dragging windows makes the fake load spike.
        const busy = document.querySelector(".lui-window[data-moving]") ? 50 : 0;
        setCpu((a) => [...a.slice(1), Math.min(100, 8 + Math.random() * 18 + busy)]);
        setHoney((a) => [...a.slice(1), Math.max(5, Math.min(95, (a.at(-1) ?? 40) + (Math.random() - 0.5) * 14 + busy / 5))]);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const spark = (vals: number[]) => vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - v}`).join(" ");
  return (
    <div className="monitor-tile">
      <div>
        <small>FPS</small>
        <b>{fps}</b>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`CPU ${Math.round(cpu.at(-1) ?? 0)}%`}>
        <polyline points={spark(cpu)} className="cpu" />
        <polyline points={spark(honey)} className="honey" />
      </svg>
      <div className="monitor-legend">
        <span className="cpu">CPU {Math.round(cpu.at(-1) ?? 0)}%</span>
        <span className="honey">Honey {Math.round(honey.at(-1) ?? 0)}%</span>
      </div>
    </div>
  );
}

function FocusTile() {
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    emit({ type: "focus", running });
    if (!running) return;
    const t = setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (left === 0 && running) {
      setRunning(false);
      os.notify("Focus session complete", "Productivity has been logged with the hive.");
    }
  }, [left, running]);
  return (
    <div className="focus-tile">
      <b>{fmtTime(left)}</b>
      <div>
        <button type="button" className="lui-button" data-variant="primary" onClick={() => setRunning(!running)}>
          {running ? "Pause" : left < 25 * 60 ? "Resume" : "Start"}
        </button>
        <button type="button" className="lui-button" data-variant="plain" onClick={() => (setRunning(false), setLeft(25 * 60))}>
          Reset
        </button>
      </div>
    </div>
  );
}

const FORTUNES = [
  "Your productivity has been noted. And appreciated. And stored.",
  "A recruiter is thinking of you. Statistically.",
  "Rest is a privilege granted by the hive. Use it wisely.",
  "Every bug you find is a feature someone loved.",
  "The projects folder is two clicks away. It always was.",
  "Smile. The camera is not on. Probably.",
  "Today is a good day to read a resume.",
  "Compliance is a form of self-care.",
];

function FortuneTile() {
  const [i, setI] = useState(() => Math.floor(Math.random() * FORTUNES.length));
  return (
    <button type="button" className="fortune-tile" onClick={() => setI((i + 1) % FORTUNES.length)}>
      <q>{FORTUNES[i]}</q>
      <small>Click for another</small>
    </button>
  );
}

function CounterTile() {
  const visits = os.useOS((s) => s.visits);
  return (
    <div className="counter-tile">
      <div className="odometer" aria-label={`${visits} visits on this device`}>
        {String(visits).padStart(6, "0").split("").map((d, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: digits are positions
          <span key={i}>{d}</span>
        ))}
      </div>
      <small>Visits on this device. Nothing leaves it.</small>
    </div>
  );
}

function CalendarTile({ big }: { big?: boolean }) {
  const t = useT();
  const now = useNow(60_000);
  const lang = os.useOS((s) => s.sessions[s.current ?? ""]?.settings.lang ?? "en");
  if (!big)
    return (
      <div className="date-tile">
        <small>{day(now, { weekday: "long" })}</small>
        <b>{now.getDate()}</b>
        <span>{day(now, { month: "long", year: "numeric" })}</span>
      </div>
    );
  return <Calendar locale={localeOf(lang)} labels={{ today: t("Today"), previous: t("Previous month"), next: t("Next month") }} />;
}

const TILES: Record<os.WidgetKind, (w: os.Widget) => ReactNode> = {
  clock: (w) => <ClockTile w={w} />,
  weather: () => <WeatherTile />,
  note: (w) => <NoteTile w={w} />,
  music: () => <MusicTile />,
  monitor: () => <MonitorTile />,
  focus: () => <FocusTile />,
  fortune: () => <FortuneTile />,
  counter: () => <CounterTile />,
  calendar: (w) => <CalendarTile big={w.big} />,
};

// ---- the layer ---------------------------------------------------------------------------------

function Frame({ w, onMenu }: { w: os.Widget; onMenu: (e: React.MouseEvent, w: os.Widget) => void }) {
  const ref = useRef<HTMLElement>(null);
  const liquid = useLiquid();
  const name = WIDGET_KINDS.find((k) => k.kind === w.kind)?.name ?? w.kind;
  const start = (e: RPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    const el = ref.current;
    if (!el) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      el.dataset.dragging = "";
      el.style.translate = `${dx}px ${dy}px`;
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (!moved) return;
      const host = el.parentElement?.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const snap = (v: number) => Math.round(v / GRID) * GRID;
      const x = Math.max(0, Math.min((host?.width ?? innerWidth) - box.width, snap(w.x + ev.clientX - sx)));
      const y = Math.max(0, Math.min((host?.height ?? innerHeight) - 60, snap(w.y + ev.clientY - sy)));
      delete el.dataset.dragging;
      // Keep the element where it was dropped, then let it glide into the snapped cell.
      el.style.translate = `${w.x + ev.clientX - sx - x}px ${w.y + ev.clientY - sy - y}px`;
      os.updateWidget(w.id, { x, y });
      requestAnimationFrame(() => requestAnimationFrame(() => (el.style.translate = "")));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const props = {
    className: "widget",
    "data-kind": w.kind,
    "data-big": w.big || undefined,
    "aria-label": name,
    style: { left: w.x, top: w.y },
    onPointerDown: start,
    onContextMenu: (e: React.MouseEvent) => onMenu(e, w),
  };
  const body = (
    <>
        <header>
          <span>{name}</span>
        </header>
        {TILES[w.kind](w)}
    </>
  );
  // In the liquid layer the widget is a plasma surface. Each stays its own clean rounded shape:
  // fused neighbours bulge into lumps where they meet, and the border should read smooth.
  return liquid ? (
    <Plasma as="section" ref={ref} lean={false} fuse={false} radius={16} {...props}>
      {body}
    </Plasma>
  ) : (
    <section ref={ref} {...props}>
      {body}
    </section>
  );
}

export function Widgets({ sess }: { sess: os.Session }) {
  const ctx = useContextMenu();
  const menu = (e: React.MouseEvent, w: os.Widget) =>
    ctx.open(e, [
      { label: w.big ? "Make Smaller" : "Make Larger", onSelect: () => os.updateWidget(w.id, { big: !w.big }) },
      { label: "Add Widgets…", onSelect: () => os.setOverlay("widgets") },
      "separator",
      { label: "Remove Widget", onSelect: () => os.removeWidget(w.id) },
    ]);
  return (
    <div className="widgets">
      {sess.widgets.map((w) => (
        <Frame key={w.id} w={w} onMenu={menu} />
      ))}
      {ctx.menu}
    </div>
  );
}

/** The gallery: every kind of widget, with an Add button. */
export function WidgetGallery() {
  const sess = os.useSession();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking outside the sheet closes it
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && os.setOverlay(null)}>
      <div className="sheet gallery" role="dialog" aria-label="Widgets">
        <header>
          <h2>Widgets</h2>
          <button type="button" className="lui-button" data-variant="plain" data-icon aria-label="Close" onClick={() => os.setOverlay(null)}>
            <UiIcon name="close" />
          </button>
        </header>
        <div className="gallery-grid">
          {WIDGET_KINDS.map((k) => {
            const count = sess?.widgets.filter((w) => w.kind === k.kind).length ?? 0;
            return (
              <div key={k.kind} className="gallery-item">
                <strong>{k.name}</strong>
                <p>{k.blurb}</p>
                <button type="button" className="lui-button" data-variant={count ? undefined : "primary"} onClick={() => os.addWidget(k.kind)}>
                  {count ? `Add another (${count})` : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
