// Settings: a sidebar of panes like System Settings. The open pane lives in the window's arg,
// so the sidebar and the content stay in step. Every change applies live.
import { Button, Segmented, SidebarItem, SidebarSection, Switch, themeList, UiIcon } from "@lupinos/ui";
import { type CSSProperties, type DragEvent, type ReactNode, useState } from "react";
import { effectiveMode, restart } from "../os/actions";
import type { AppProps } from "../os/apps";
import { useT } from "../os/i18n";
import * as os from "../os/store";
import { LupinMark } from "../os/ui";
import { uploadWallpaper, useBlobUrl } from "../os/Wallpaper";
import type { VNode } from "../os/vfs";

const panes = [
  { id: "appearance", label: "Appearance", icon: "display" },
  { id: "wallpaper", label: "Wallpaper", icon: "sparkle" },
  { id: "text", label: "Text", icon: "text" },
  { id: "windows", label: "Windows", icon: "grid" },
  { id: "dock", label: "Dock and Desktop", icon: "home" },
  { id: "motion", label: "Motion", icon: "motion" },
  { id: "language", label: "Language and Region", icon: "globe" },
  { id: "access", label: "Accessibility", icon: "accessibility" },
  { id: "about", label: "About", icon: "info" },
];
const paneOf = (win: os.Win) => (panes.some((p) => p.id === win.arg) ? (win.arg as string) : "appearance");

const fonts = [
  { value: "", label: "Theme font" },
  ...[...new Set(themeList.map((t) => t.font))].map((f) => ({ value: `"${f}"`, label: f })),
  { value: "system-ui", label: "System" },
  { value: 'Georgia, "Noto Serif SC", "Noto Serif TC", serif', label: "Serif" },
  { value: "ui-monospace, Menlo, Consolas, monospace", label: "Monospace" },
];
const inks = [
  { value: "#f6f1e7", label: "Ivory" },
  { value: "#2a2a2f", label: "Graphite" },
  { value: "#33415e", label: "Ink" },
  { value: "#5a3a2c", label: "Umber" },
];

export function Sidebar({ win }: AppProps) {
  const pane = paneOf(win);
  const t = useT();
  return (
    <SidebarSection title={t("Settings")}>
      {panes.map((p) => (
        <SidebarItem key={p.id} icon={<UiIcon name={p.icon} />} label={t(p.label)} current={pane === p.id} onClick={() => os.setArg(win.id, p.id, p.label)} />
      ))}
    </SidebarSection>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div>
        <div>{label}</div>
        {hint && <small>{hint}</small>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

/** A slider row. The track fills up to the value, like the macOS sliders. */
function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <Row label={label}>
      <span className="set-slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          style={{ "--v": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <output>{format ? format(value) : value}</output>
      </span>
    </Row>
  );
}

function UploadTile({ node, active }: { node: VNode; active: boolean }) {
  const url = useBlobUrl(node.blob);
  return (
    <div className="wall-tile-wrap">
      <button type="button" className="wall-tile" aria-pressed={active} aria-label={`Wallpaper ${node.name}`} onClick={() => os.setSettings({ wallpaper: node.id })}>
        {url && (node.mime?.startsWith("video") ? <video src={url} muted /> : <img src={url} alt="" />)}
      </button>
      <button type="button" className="wall-remove" aria-label={`Move ${node.name} to Trash`} onClick={() => os.trash([node.id])}>
        <UiIcon name="close" />
      </button>
      <span>{node.name}</span>
    </div>
  );
}

/** Puts the listed settings back to their defaults. */
const restore = (keys: (keyof os.Settings)[]) => {
  const d = os.defaultSettings();
  os.setSettings(Object.fromEntries(keys.map((k) => [k, d[k]])));
};

export default function Settings({ win }: AppProps) {
  const sess = os.useSession();
  const t = useT();
  const [over, setOver] = useState(false);
  if (!sess) return null;
  const s = sess.settings;
  const set = os.setSettings;
  const pane = paneOf(win);
  const mode = effectiveMode(s);
  const uploads = sess.nodes.filter((n) => n.blob && !n.trashedAt && n.mime?.match(/^(image|video)/));
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadWallpaper(f);
  };

  return (
    <div className="settings" key={pane}>
      {pane === "appearance" && (
        <>
          <h2>{t("Appearance")}</h2>
          <div className="set-group">
            <Row label={t("Mode")}>
              <Segmented
                label={t("Mode")}
                value={s.mode}
                onChange={(m) => set({ mode: m })}
                options={[
                  { value: "system", label: t("Auto") },
                  { value: "light", label: t("Light") },
                  { value: "dark", label: t("Dark") },
                ]}
              />
            </Row>
          </div>
          <h3>{t("Theme")}</h3>
          <div className="theme-grid" role="radiogroup" aria-label={t("Theme")}>
            {themeList.map((th) => (
              // biome-ignore lint/a11y/useSemanticElements: theme cards acting as a radio group
              <button key={th.id} type="button" role="radio" aria-checked={s.theme === th.id} className="theme-card" onClick={() => os.switchTheme(th.id)}>
                {/* Each preview is its own themed root, so it shows the theme's real window and font. */}
                <span className="theme-preview lui" data-lui-theme={th.id} data-lui-mode={mode} style={{ background: th.wallpaper, "--lui-font-face": "initial" } as CSSProperties}>
                  <span className="theme-win">
                    <span className="theme-win-bar">
                      <i />
                      <i />
                      <i />
                    </span>
                    <b>{th.name}</b>
                    <span>{t("The quick fox jumps over the lazy dog")}</span>
                    <em />
                  </span>
                </span>
                <strong>{th.name}</strong>
                <small>
                  {th.hue} · {th.font}
                </small>
              </button>
            ))}
          </div>
        </>
      )}

      {pane === "wallpaper" && (
        <>
          <h2>{t("Wallpaper")}</h2>
          <div className="wall-grid">
            <div className="wall-tile-wrap">
              <button type="button" className="wall-tile" aria-pressed={s.wallpaper === "theme"} aria-label={t("Theme gradient")} onClick={() => set({ wallpaper: "theme" })}>
                <span className="lui-wallpaper" />
              </button>
              <span>{t("Theme gradient")}</span>
            </div>
            {uploads.map((n) => (
              <UploadTile key={n.id} node={n} active={s.wallpaper === n.id} />
            ))}
          </div>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target next to a real file picker */}
          <div
            className="drop"
            data-over={over || undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={drop}
          >
            <UiIcon name="download" />
            <p>Drop an image or a short video here, or</p>
            <label className="lui-button">
              {t("Choose a File…")}
              <input type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadWallpaper(e.target.files[0])} />
            </label>
            <small>Up to 10 MB. It stays in this browser and is never uploaded.</small>
          </div>
        </>
      )}

      {pane === "text" && (
        <>
          <h2>{t("Text")}</h2>
          <p className="text-sample" style={{ fontFamily: s.font || undefined }}>
            {t("The quick fox jumps over the lazy dog")} · 敏捷的狐狸 · 0123
          </p>
          <div className="set-group">
            <Row label={t("Font")}>
              <select className="lui-field set-select" value={s.font} aria-label={t("Font")} onChange={(e) => set({ font: e.target.value })}>
                {fonts.map((f) => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
                    {t(f.label)}
                  </option>
                ))}
              </select>
            </Row>
            <Row label={t("Text colour")}>
              <span className="ink-swatches" role="radiogroup" aria-label={t("Text colour")}>
                {/* biome-ignore lint/a11y/useSemanticElements: swatches acting as a radio group */}
                <button type="button" role="radio" aria-checked={!s.textColor} className="ink auto" title={t("Default")} aria-label={t("Default")} onClick={() => set({ textColor: "" })} />
                {inks.map((c) => (
                  // biome-ignore lint/a11y/useSemanticElements: swatches acting as a radio group
                  <button key={c.value} type="button" role="radio" aria-checked={s.textColor === c.value} className="ink" title={c.label} aria-label={c.label} style={{ background: c.value }} onClick={() => set({ textColor: c.value })} />
                ))}
                <label className="ink custom" title="Custom" aria-checked={!!s.textColor && !inks.some((c) => c.value === s.textColor)}>
                  <input type="color" aria-label="Custom colour" value={s.textColor || "#808080"} onChange={(e) => set({ textColor: e.target.value })} />
                </label>
              </span>
            </Row>
            <Slider label={t("Text size")} value={s.textScale} min={0.85} max={1.3} step={0.05} format={pct} onChange={(v) => set({ textScale: v })} />
          </div>
          <Button variant="plain" onClick={() => restore(["font", "textColor", "textScale"])}>
            {t("Restore Defaults")}
          </Button>
        </>
      )}

      {pane === "windows" && (
        <>
          <h2>{t("Windows")}</h2>
          <div className="set-group">
            <Slider label={t("Transparency")} value={1 - s.glass} min={0} max={0.6} step={0.02} format={pct} onChange={(v) => set({ glass: Math.round((1 - v) * 100) / 100 })} />
            <Slider label={t("Blur")} value={s.blur} min={0} max={60} step={2} format={(v) => `${v}px`} onChange={(v) => set({ blur: v })} />
            <Slider label={t("Shadow")} value={s.shadow} min={0} max={2} step={0.1} format={pct} onChange={(v) => set({ shadow: v })} />
            <Slider label={t("Corner radius")} value={s.radius} min={4} max={26} step={1} format={(v) => `${v}px`} onChange={(v) => set({ radius: v })} />
          </div>
          <h3>{t("Dragging")}</h3>
          <div className="set-group">
            <Row label={t("Throw windows")} hint="Flick a window and it glides to a stop.">
              <Switch checked={s.momentum} onChange={(e) => set({ momentum: e.target.checked })} aria-label={t("Throw windows")} />
            </Row>
            <Row label={t("Snap to edges")} hint="Drag to an edge or corner to fill half or a quarter.">
              <Switch checked={s.snapping} onChange={(e) => set({ snapping: e.target.checked })} aria-label={t("Snap to edges")} />
            </Row>
            <Row label={t("Shake to minimise others")}>
              <Switch checked={s.shake} onChange={(e) => set({ shake: e.target.checked })} aria-label={t("Shake to minimise others")} />
            </Row>
          </div>
          <Button variant="plain" onClick={() => restore(["glass", "blur", "shadow", "radius", "momentum", "snapping", "shake"])}>
            {t("Restore Defaults")}
          </Button>
        </>
      )}

      {pane === "dock" && (
        <>
          <h2>{t("Dock and Desktop")}</h2>
          <div className="set-group">
            <Slider label={t("Dock size")} value={s.dockSize} min={36} max={72} step={2} format={(v) => `${v}px`} onChange={(v) => set({ dockSize: v })} />
            <Slider label={t("Magnification")} value={s.magnify} min={1} max={1.8} step={0.05} format={(v) => (v === 1 ? t("None") : `${v.toFixed(2)}×`)} onChange={(v) => set({ magnify: v })} />
            <Row label={t("Icon size")}>
              <Segmented
                label={t("Icon size")}
                value={s.iconSize}
                onChange={(iconSize) => set({ iconSize })}
                options={[
                  { value: "s", label: t("Small") },
                  { value: "m", label: t("Medium") },
                  { value: "l", label: t("Large") },
                ]}
              />
            </Row>
            <Row label={t("Clean Up")} hint="Drag icons anywhere on the desktop or in the dock. This puts desktop icons back in a column.">
              <Button onClick={() => os.setIconPos({})}>{t("Clean Up")}</Button>
            </Row>
          </div>
          <Button variant="plain" onClick={() => restore(["dockSize", "magnify", "iconSize"])}>
            {t("Restore Defaults")}
          </Button>
        </>
      )}

      {pane === "motion" && (
        <>
          <h2>{t("Motion")}</h2>
          <div className="set-group">
            <Row label={t("Animation")} hint="Reduced swaps movement for a short fade. None turns animation off.">
              <Segmented
                label={t("Motion")}
                value={s.motion}
                onChange={(motion) => set({ motion })}
                options={[
                  { value: "system", label: t("Auto") },
                  { value: "full", label: t("Full") },
                  { value: "reduced", label: t("Reduced") },
                  { value: "none", label: t("None") },
                ]}
              />
            </Row>
          </div>
        </>
      )}

      {pane === "language" && (
        <>
          <h2>{t("Language and Region")}</h2>
          <div className="set-group">
            <Row label={t("Language")}>
              <Segmented
                label={t("Language")}
                value={s.lang}
                onChange={(lang) => set({ lang })}
                options={[
                  { value: "en", label: "English" },
                  { value: "zh-Hans", label: "简体中文" },
                  { value: "zh-Hant", label: "繁體中文" },
                ]}
              />
            </Row>
            <Row label={`${t("Lunar calendar")} · Âm lịch`} hint={t("Show lunar dates in the calendar")}>
              <Switch checked={s.lunar} onChange={(e) => set({ lunar: e.target.checked })} aria-label={t("Lunar calendar")} />
            </Row>
            <Row label={t("24-hour time")}>
              <Switch checked={s.clock24} onChange={(e) => set({ clock24: e.target.checked })} aria-label={t("24-hour time")} />
            </Row>
          </div>
        </>
      )}

      {pane === "access" && (
        <>
          <h2>{t("Accessibility")}</h2>
          <div className="set-group">
            <Slider label={t("Text size")} value={s.textScale} min={0.85} max={1.3} step={0.05} format={pct} onChange={(v) => set({ textScale: v })} />
            <Row label={t("Standard pointer")} hint="Use the system cursor instead of the LupinOS pointer.">
              <Switch checked={s.plainCursor} onChange={(e) => set({ plainCursor: e.target.checked })} aria-label={t("Standard pointer")} />
            </Row>
          </div>
          <p className="muted">Every icon, window and menu can be reached with Tab and opened with Enter. Alt+/ lists every shortcut.</p>
        </>
      )}

      {pane === "about" && (
        <div className="about-os">
          <LupinMark size={72} />
          <h2>LupinOS</h2>
          <p className="muted">Version 0.6 · Built with @lupinos/ui</p>
          <p>A made-up desktop operating system that is also a portfolio. The windows, dock, menus and themes are an open component library anyone can install.</p>
          <p className="muted">
            No cookies. Profiles, files and wallpapers stay in this browser. <a href="/plain">Plain version</a>
          </p>
          <Button
            onClick={() =>
              os.confirmDialog("Reset this profile?", "Settings, windows, files and uploads in this profile will be erased.", "Reset", () => {
                os.resetSession();
                restart();
              })
            }
          >
            {t("Reset This Profile…")}
          </Button>
        </div>
      )}
    </div>
  );
}
