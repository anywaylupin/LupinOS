// Music: a spinning record, a visualiser and the placeholder playlist. The same player drives
// the desktop widget and the volume slider in quick settings.
import { UiIcon } from "@lupinos/ui";
import { type CSSProperties, useEffect, useRef } from "react";
import { fmtTime } from "../os/ui";
import * as music from "../os/music";

/** Bars that follow the music, updated straight on the DOM so React stays out of the frame loop. */
export function Visualiser({ bands = 16, className = "viz" }: { bands?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const bars = ref.current?.children;
      if (bars) music.levels(bands).forEach((v, i) => ((bars[i] as HTMLElement).style.scale = `1 ${0.08 + v * 0.92}`));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bands]);
  return (
    <div ref={ref} className={className} aria-hidden="true">
      {Array.from({ length: bands }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: bars are positions
        <i key={i} />
      ))}
    </div>
  );
}

export function Controls() {
  const m = music.useMusic();
  return (
    <div className="music-controls">
      <button type="button" className="lui-button" data-variant="plain" data-icon aria-label="Previous track" onClick={music.prev}>
        <UiIcon name="chevron-left" />
      </button>
      <button type="button" className="lui-button music-play" data-variant="primary" aria-label={m.playing ? "Pause" : "Play"} onClick={music.toggle}>
        {m.playing ? "❚❚" : "▶"}
      </button>
      <button type="button" className="lui-button" data-variant="plain" data-icon aria-label="Next track" onClick={music.next}>
        <UiIcon name="chevron-right" />
      </button>
    </div>
  );
}

export default function Music() {
  const m = music.useMusic();
  const t = music.TRACKS[m.index];
  return (
    <div className="music">
      <section className="music-deck">
        <div className="record" data-spinning={m.playing || undefined}>
          <span />
        </div>
        <div className="music-now">
          <strong>{t.title}</strong>
          <small>{t.artist}</small>
        </div>
        <div className="music-progress" style={{ "--p": `${(m.elapsed / t.seconds) * 100}%` } as CSSProperties}>
          <i />
          <span>
            {fmtTime(Math.floor(m.elapsed))} / {fmtTime(t.seconds)}
          </span>
        </div>
        <Controls />
        <Visualiser bands={20} />
        <label className="music-volume">
          <UiIcon name="volume" />
          <input type="range" min={0} max={1} step={0.01} value={m.volume} aria-label="Volume" onChange={(e) => music.setVolume(Number(e.target.value))} style={{ "--v": `${m.volume * 100}%` } as CSSProperties} />
        </label>
      </section>
      <ol className="playlist" aria-label="Playlist">
        {music.TRACKS.map((tr, i) => (
          <li key={tr.title}>
            <button type="button" aria-current={i === m.index || undefined} onClick={() => music.pick(i)}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{tr.title}</strong>
              <small>{tr.artist}</small>
              <time>{fmtTime(tr.seconds)}</time>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
