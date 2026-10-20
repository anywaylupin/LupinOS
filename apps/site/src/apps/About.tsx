// About.txt: a short bio that types itself out the first time it opens. Click to skip.
import { useEffect, useState } from "react";
import { owner } from "../content/owner";
import * as os from "../os/store";

export const aboutText = () =>
  [`${owner.name}, ${owner.role}`, `${owner.location}`, "", ...owner.bio.flatMap((p) => [p, ""]), `Contact: ${owner.email}`].join("\n");

export default function About() {
  const seen = os.useSession()?.seen.includes("about") ?? true;
  const text = aboutText();
  const [n, setN] = useState(seen ? text.length : 0);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((v) => Math.min(text.length, v + 3)), 16);
    return () => clearTimeout(t);
  }, [n, text.length]);
  useEffect(() => {
    if (!seen) os.markSeen("about");
  }, [seen]);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: skipping is a convenience; the full text is always in the accessible label
    // biome-ignore lint/a11y/noStaticElementInteractions: same
    <div className="prose mono" style={{ whiteSpace: "pre-wrap", maxWidth: "none" }} onClick={() => setN(text.length)} aria-label={text}>
      <span aria-hidden={n < text.length}>{text.slice(0, n)}</span>
      {n < text.length && <span className="spinner" style={{ display: "inline-block", width: 10, height: 10 }} />}
    </div>
  );
}
