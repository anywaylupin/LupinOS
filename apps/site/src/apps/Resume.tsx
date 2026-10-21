// Resume.pdf: a fake PDF viewer. Pages curl when turned; the download is the real file.
import { emit } from "../os/bus";
import { useState } from "react";
import { owner } from "../content/owner";

export default function Resume() {
  const { resume } = owner;
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState("");
  const pages = [
    <div key="1">
      <h1>{owner.name}</h1>
      <p>
        {owner.role} · {owner.location} · {owner.email}
      </p>
      <h2>Experience</h2>
      {resume.experience.map((e, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows repeat
        <p key={i}>
          <strong>{e.role}</strong>, {e.org} <em>({e.when})</em>
          <br />
          {e.text}
        </p>
      ))}
    </div>,
    <div key="2">
      <h2>Education</h2>
      {resume.education.map((e) => (
        <p key={e.org}>
          <strong>{e.role}</strong>, {e.org} <em>({e.when})</em>
        </p>
      ))}
      <h2>Skills</h2>
      <p>{resume.skills.join(" · ")}</p>
      <h2>Links</h2>
      {owner.links.map((l) => (
        <p key={l.label}>
          {l.label}: {l.href}
        </p>
      ))}
    </div>,
  ];
  const go = (d: number) => {
    setTurn(d > 0 ? "turn-next" : "turn-prev");
    setPage((p) => p + d);
    if (page + d === pages.length - 1) emit({ type: "read-end", what: "resume" });
  };
  return (
    <div className="pdf">
      <div className="toolbar">
        <button type="button" className="btn" disabled={page === 0} onClick={() => go(-1)}>
          Previous
        </button>
        <span className="muted" aria-live="polite">
          Page {page + 1} of {pages.length}
        </span>
        <button type="button" className="btn" disabled={page === pages.length - 1} onClick={() => go(1)}>
          Next
        </button>
        <span style={{ flex: 1 }} />
        <a className="btn primary" href={resume.file} download onClick={() => emit({ type: "resume-download" })}>
          Download PDF
        </a>
      </div>
      <div className="pdf-stage">
        <div key={page} className={`page ${turn}`}>
          {pages[page]}
        </div>
      </div>
    </div>
  );
}
