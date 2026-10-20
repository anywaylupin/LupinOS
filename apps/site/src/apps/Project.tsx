// Project viewer: cover, summary, stack chips and links. The cover tilts towards the pointer.
import type { PointerEvent } from "react";
import { projects } from "../content/owner";
import type { AppProps } from "../os/apps";

export default function Project({ win }: AppProps) {
  const p = projects.find((x) => x.slug === win.arg);
  if (!p) return <p className="empty">This project was recalled by the issuing corporation.</p>;
  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--rx", `${((e.clientX - r.left) / r.width - 0.5) * 10}deg`);
    e.currentTarget.style.setProperty("--ry", `${-((e.clientY - r.top) / r.height - 0.5) * 10}deg`);
  };
  return (
    <article>
      <div className="cover cut" role="img" aria-label={`${p.title} cover image placeholder`} onPointerMove={tilt} onPointerLeave={(e) => e.currentTarget.removeAttribute("style")}>
        {p.title}
      </div>
      <div className="prose" style={{ paddingTop: 0 }}>
        <h1>{p.title}</h1>
        <p className="muted">{p.year}</p>
        <div className="row" style={{ marginBottom: 12 }}>
          {p.stack.map((s) => (
            <span key={s} className="chip">
              {s}
            </span>
          ))}
        </div>
        <p>
          <strong>{p.summary}</strong>
        </p>
        {p.body.map((b, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder paragraphs repeat
          <p key={i}>{b}</p>
        ))}
        <div className="row">
          {p.links.map((l) => (
            <a key={l.label} className="btn primary" href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
