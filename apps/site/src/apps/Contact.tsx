// Contact: a chat-style window that turns a message into an email. Nothing is sent from here;
// the visitor's own mail app does the sending.
import { type FormEvent, useEffect, useRef, useState } from "react";
import { owner } from "../content/owner";
import type { AppProps } from "../os/apps";

type Line = { me: boolean; text: string; mail?: string };

export default function Contact({ win }: AppProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(true);
  const [draft, setDraft] = useState(win.arg ?? "");
  const log = useRef<HTMLDivElement>(null);

  const reply = (text: string, mail?: string) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setLines((l) => [...l, { me: false, text, mail }]);
    }, 900);
  };
  useEffect(() => {
    reply(`Hi, this is ${owner.name}'s inbox. Write your message and I will turn it into an email for you.`);
  }, []);
  useEffect(() => {
    log.current?.scrollTo(0, log.current.scrollHeight);
  });

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setLines((l) => [...l, { me: true, text }]);
    setDraft("");
    const mail = `mailto:${owner.email}?subject=${encodeURIComponent("Hello from LupinOS")}&body=${encodeURIComponent(text)}`;
    reply("Got it. Your mail app will open with this message ready to send.", mail);
  };

  return (
    <div className="chat">
      <div className="chat-log" ref={log} aria-live="polite">
        {lines.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the log only grows
          <div key={i} className={`bubble${l.me ? " me" : ""}`}>
            {l.text}
            {l.mail && (
              <div style={{ marginTop: 8 }}>
                <a className="btn primary" href={l.mail}>
                  Open in my mail app
                </a>
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="bubble typing" aria-label="Typing">
            <span />
            <span />
            <span />
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: "auto" }}>
          Or write directly: <a href={`mailto:${owner.email}`}>{owner.email}</a>
        </p>
      </div>
      <form onSubmit={send}>
        <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your message" aria-label="Your message" />
        <button className="btn primary" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
