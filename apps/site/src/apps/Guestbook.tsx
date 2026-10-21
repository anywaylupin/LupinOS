// Guestbook: leave a note for the owner and the visitors after you. Names only, no accounts.
import { Button } from "@lupinos/ui";
import { type FormEvent, useEffect, useState } from "react";
import { emit } from "../os/bus";
import { type GuestEntry, guestbook, online, signGuestbook } from "../os/net";
import * as os from "../os/store";

export default function Guestbook() {
  const user = os.userById(os.useOS((s) => s.current));
  const [entries, setEntries] = useState<GuestEntry[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "asleep" | "sending">(online ? "loading" : "asleep");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!online) return;
    guestbook().then((r) => {
      setEntries(r?.entries ?? null);
      setState(r ? "ready" : "asleep");
    });
  }, []);

  const send = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setState("sending");
    setError("");
    const r = await signGuestbook(String(f.get("name") ?? ""), String(f.get("message") ?? ""));
    if (r?.entry) {
      setEntries((list) => [r.entry, ...(list ?? [])]);
      form.reset();
      emit({ type: "egg", id: "guestbook" });
    } else setError("The hive did not accept that. Try again in a minute.");
    setState("ready");
  };

  return (
    <div className="guestbook">
      <form onSubmit={send} className="guest-form">
        <input className="lui-field" name="name" placeholder="Your name" aria-label="Your name" maxLength={24} required defaultValue={user?.kind === "local" ? user.name : ""} />
        <textarea className="lui-field" name="message" placeholder="Say something nice. Or ominous." aria-label="Message" maxLength={280} required rows={3} />
        <div className="row">
          <small className="muted">Your name and message are public. Nothing else is kept.</small>
          <Button type="submit" variant="primary" disabled={!online || state === "sending"}>
            {state === "sending" ? "Sending…" : "Sign"}
          </Button>
        </div>
        {error && <small role="alert">{error}</small>}
      </form>
      {state === "loading" && <p className="muted">Waking the server. Free servers take a minute to get up…</p>}
      {state === "asleep" && <p className="muted">The guestbook server is offline right now. The rest of LupinOS works as usual.</p>}
      <ol className="guest-list">
        {entries?.map((g) => (
          <li key={g.id}>
            <strong>{g.name}</strong>
            <time>{new Date(g.at).toLocaleDateString()}</time>
            <p>{g.message}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
