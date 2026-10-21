// Talking to the LupinOS API. Everything here is optional: with no PUBLIC_API_URL, or when the
// server is asleep, the OS works the same and these calls quietly do nothing.
// Visit events are queued in the browser and sent in the background with sendBeacon, so a visit
// is never slowed down. "This is me" stops the owner's own visits from being counted.
import { on } from "./bus";

// Render passes the API as a bare host name; local runs can give a full URL.
const raw = (import.meta.env.PUBLIC_API_URL as string | undefined)?.trim();
const API = raw ? (raw.startsWith("http") ? raw : `https://${raw}`).replace(/\/$/, "") : undefined;
export const online = !!API;

const SESSION = "lupinos-session";
const ME = "lupinos-this-is-me";
type Ev = { type: string; data?: Record<string, unknown> };

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {}
  },
};

export const isMe = () => store.get(ME) === "1";
export const setMe = (me: boolean) => store.set(ME, me ? "1" : null);

let token: string | null = store.get(SESSION);
let pending: Promise<string | null> | null = null;
const queue: Ev[] = [];

async function call<T>(path: string, init?: RequestInit, timeout = 8000): Promise<T | null> {
  if (!API) return null;
  try {
    const r = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(timeout) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
const post = <T>(path: string, body: unknown, timeout?: number) => call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, timeout);

/** Creates or refreshes the anonymous session. A sleeping free server can take a minute to wake. */
function session(extra: Record<string, unknown> = {}): Promise<string | null> {
  if (!API || isMe()) return Promise.resolve(null);
  pending ??= post<{ token: string }>("/session", { token, ...extra }, 70_000).then((r) => {
    pending = null;
    if (r?.token) {
      token = r.token;
      store.set(SESSION, token);
    }
    return token;
  });
  return pending;
}

function flush(beacon = false) {
  if (!API || !token || !queue.length || isMe()) return;
  const body = JSON.stringify({ token, events: queue.splice(0, 50) });
  if (beacon && navigator.sendBeacon(`${API}/events`, body)) return;
  fetch(`${API}/events`, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
}

let started = false;
/** Starts the visit log once per page load: wakes the server, then sends events in batches. */
export function startVisitLog(info: { device: string; theme: string }) {
  if (!API || started || isMe()) return;
  started = true;
  const opened = new Set<string>();
  const t0 = Date.now();
  let from = "";
  try {
    from = document.referrer ? new URL(document.referrer).hostname : "";
  } catch {}
  void session({ ...info, from });
  on((e) => {
    if (e.type === "app-open") opened.add(e.app);
    if (e.type === "focus" || e.type === "game-score") return;
    const { type, ...data } = e;
    queue.push({ type, data: Object.keys(data).length ? data : undefined });
    if (type === "resume-download" || type === "contact-sent") flush();
  });
  setInterval(() => flush(), 20_000);
  // Hiding the tab only flushes; the summary goes once, when the page is really left.
  addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush(true));
  addEventListener(
    "pagehide",
    () => {
      queue.push({ type: "visit-end", data: { seconds: Math.round((Date.now() - t0) / 1000), apps: [...opened] } });
      flush(true);
    },
    { once: true },
  );
}

export type BoardRow = { name: string; score: number; at: string };
export const leaderboard = (game: string) => call<{ lower: boolean; scores: BoardRow[] }>(`/leaderboards/${encodeURIComponent(game)}`);

export async function submitScore(game: string, name: string, score: number) {
  const t = await session();
  return t ? post<{ ok: boolean }>("/scores", { token: t, game, name, score }) : null;
}

export type GuestEntry = { id: number; name: string; message: string; at: string };
export const guestbook = () => call<{ entries: GuestEntry[] }>("/guestbook", undefined, 70_000);

export async function signGuestbook(name: string, message: string) {
  // The guestbook should work for the owner too, so it gets a session even when "This is me" is on.
  const t = token ?? (API ? (await post<{ token: string }>("/session", {}, 70_000))?.token ?? null : null);
  if (t && !token) {
    token = t;
    store.set(SESSION, t);
  }
  return t ? post<{ entry: GuestEntry }>("/guestbook", { token: t, name, message }) : null;
}
