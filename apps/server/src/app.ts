// The LupinOS API: anonymous sessions, visit events and notifications, leaderboards, the
// guestbook and daily seeds. The OS never waits for it; it only makes the site more social.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Event, Store } from "./store.ts";

/** Allowed games, whether a lower score wins (times), and the most a believable score can be. */
export const GAMES: Record<string, { lower: boolean; min: number; max: number }> = {
  "mines-easy": { lower: true, min: 1, max: 9999 },
  "mines-medium": { lower: true, min: 5, max: 9999 },
  "mines-hard": { lower: true, min: 15, max: 9999 },
  klondike: { lower: true, min: 30, max: 99999 },
  snake: { lower: false, min: 0, max: 432 },
  flappy: { lower: false, min: 0, max: 9999 },
  freecell: { lower: true, min: 20, max: 99999 },
  merge: { lower: false, min: 0, max: 4_000_000 },
  lights: { lower: true, min: 1, max: 999 },
  "c4-wins": { lower: false, min: 1, max: 99999 },
};

const EVENT_TYPES = new Set(["visit-start", "app-open", "game-won", "resume-download", "contact-sent", "read-end", "egg", "visit-end"]);
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i;

export type Config = {
  secret: string;
  ownerKey?: string;
  origins?: string[];
  /** Sends a message to the owner, such as through Telegram. Throttling lives in notify.ts. */
  notify?: (text: string) => void;
};

const clean = (s: unknown, max: number) =>
  typeof s === "string"
    ? s
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** Counts hits per key in a sliding window. Single instance, so memory is enough. */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return false;
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

/** The same FNV-1a hash the site uses, so server and browser agree on today's deal. */
export function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function createApp(store: Store, config: Config) {
  const app = new Hono();
  const sign = (id: string) => createHmac("sha256", config.secret).update(id).digest("base64url");
  const tokenFor = (id: string) => `${id}.${sign(id)}`;
  const verify = (token: unknown): string | null => {
    if (typeof token !== "string") return null;
    const [id, mac] = token.split(".");
    if (!id || !mac) return null;
    const a = Buffer.from(mac);
    const b = Buffer.from(sign(id));
    return a.length === b.length && timingSafeEqual(a, b) ? id : null;
  };
  const scoreLimit = limiter(10, 60_000);
  const guestLimit = limiter(1, 60_000);
  const eventLimit = limiter(30, 60_000);
  // One visit summary per session per half hour, however often a browser reports leaving.
  const summaryLimit = limiter(1, 30 * 60_000);
  const notify = config.notify ?? (() => {});

  app.use("*", cors({ origin: config.origins?.length ? config.origins : "*", allowMethods: ["GET", "POST", "DELETE"], allowHeaders: ["content-type", "x-owner-key"] }));

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/session", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: string; device?: string; theme?: string; from?: string };
    const ua = c.req.header("user-agent") ?? "";
    const id = verify(body.token) ?? randomUUID();
    if (BOT.test(ua)) return c.json({ id, token: tokenFor(id), counted: false });
    // Global Privacy Control: an anonymous count only, nothing stored.
    if (c.req.header("sec-gpc") === "1") {
      notify("An anonymous visitor arrived (Global Privacy Control is on).");
      return c.json({ id, token: tokenFor(id), counted: false });
    }
    const country = clean(c.req.header("cf-ipcountry") ?? c.req.header("x-country") ?? "", 8) || "an unknown country";
    const device = clean(body.device, 12) || "desktop";
    const { isNew, visits } = await store.touchSession({ id, country, device });
    if (isNew) notify(`New visitor from ${country}, ${device} shell${body.theme ? `, ${clean(body.theme, 16)} theme` : ""}${body.from ? `, came from ${clean(body.from, 60)}` : ""}.`);
    else if (visits > 1) notify(`A returning visitor is back, visit ${visits}.`);
    return c.json({ id, token: tokenFor(id), counted: true });
  });

  // Sent with navigator.sendBeacon, so the body arrives as text.
  app.post("/events", async (c) => {
    let body: { token?: string; events?: Event[] };
    try {
      body = JSON.parse(await c.req.text());
    } catch {
      return c.json({ error: "bad json" }, 400);
    }
    const id = verify(body.token);
    if (!id) return c.json({ error: "bad token" }, 401);
    if (!eventLimit(id)) return c.json({ error: "slow down" }, 429);
    const events = (Array.isArray(body.events) ? body.events : [])
      .slice(0, 50)
      .filter((e) => e && EVENT_TYPES.has(e.type))
      .map((e) => ({ type: e.type, data: typeof e.data === "object" && e.data ? e.data : undefined }));
    await store.addEvents(id, events);
    for (const e of events) {
      if (e.type === "resume-download") notify("Someone downloaded your resume.");
      if (e.type === "contact-sent") notify("A visitor sent a message from Contact.");
      if (e.type === "visit-end" && summaryLimit(id)) {
        const d = e.data as { seconds?: number; apps?: string[] } | undefined;
        const mins = Math.max(1, Math.round((d?.seconds ?? 0) / 60));
        const apps = Array.isArray(d?.apps) ? d.apps.slice(0, 12).map((a) => clean(a, 24)).join(", ") : "";
        notify(`Visit summary: ${mins} min${apps ? `, opened ${apps}` : ""}.`);
      }
    }
    return c.json({ ok: true, stored: events.length });
  });

  app.get("/leaderboards/:game", async (c) => {
    const rule = GAMES[c.req.param("game")];
    if (!rule) return c.json({ error: "unknown game" }, 404);
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 10) || 10));
    return c.json({ game: c.req.param("game"), lower: rule.lower, scores: await store.topScores(c.req.param("game"), rule.lower, limit) });
  });

  app.post("/scores", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: string; game?: string; name?: string; score?: number };
    const id = verify(body.token);
    if (!id) return c.json({ error: "bad token" }, 401);
    const rule = body.game ? GAMES[body.game] : undefined;
    if (!rule || !body.game) return c.json({ error: "unknown game" }, 400);
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < rule.min || score > rule.max) return c.json({ error: "score out of range" }, 400);
    const name = clean(body.name, 24);
    if (!name) return c.json({ error: "name required" }, 400);
    if (!scoreLimit(id)) return c.json({ error: "slow down" }, 429);
    await store.addScore({ sessionId: id, game: body.game, name, score });
    return c.json({ ok: true });
  });

  app.get("/guestbook", async (c) => c.json({ entries: await store.guestbook(50) }));

  app.post("/guestbook", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: string; name?: string; message?: string };
    const id = verify(body.token);
    if (!id) return c.json({ error: "bad token" }, 401);
    const name = clean(body.name, 24);
    const message = clean(body.message, 280);
    if (!name || !message) return c.json({ error: "name and message required" }, 400);
    if (!guestLimit(id)) return c.json({ error: "one message a minute" }, 429);
    const entry = await store.addGuest({ sessionId: id, name, message });
    notify(`New guestbook entry from ${name}: ${message.slice(0, 80)}`);
    return c.json({ entry });
  });

  app.delete("/guestbook/:id", async (c) => {
    const key = c.req.header("x-owner-key") ?? "";
    const ok = !!config.ownerKey && key.length === config.ownerKey.length && timingSafeEqual(Buffer.from(key), Buffer.from(config.ownerKey));
    if (!ok) return c.json({ error: "owner only" }, 401);
    return c.json({ deleted: await store.deleteGuest(Number(c.req.param("id"))) });
  });

  app.get("/daily", (c) => {
    const d = new Date();
    const day = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    return c.json({ date: day, seeds: { klondike: hashSeed(`klondike-${day}`), "mines-easy": hashSeed(`mines-easy-${day}`) } });
  });

  return app;
}
