// Where the API keeps things. Postgres in production; an in-memory store for local runs and
// tests, so the API works with no database at all. Rows are keyed by the anonymous session id,
// and no IP address is ever stored.
import postgres from "postgres";

export type Score = { name: string; score: number; at: string };
export type Entry = { id: number; name: string; message: string; at: string };
export type Event = { type: string; data?: Record<string, unknown> };

export interface Store {
  /** Creates or refreshes a session. `isNew` is true the first time this id is seen. */
  touchSession(s: { id: string; country: string; device: string }): Promise<{ isNew: boolean; visits: number }>;
  addEvents(sessionId: string, events: Event[]): Promise<void>;
  addScore(row: { sessionId: string; game: string; name: string; score: number }): Promise<void>;
  topScores(game: string, lowerIsBetter: boolean, limit: number): Promise<Score[]>;
  guestbook(limit: number): Promise<Entry[]>;
  addGuest(row: { sessionId: string; name: string; message: string }): Promise<Entry>;
  deleteGuest(id: number): Promise<boolean>;
}

export function memoryStore(): Store {
  const sessions = new Map<string, { visits: number; last: number }>();
  const scores: (Score & { game: string })[] = [];
  const entries: Entry[] = [];
  let nextId = 1;
  return {
    async touchSession({ id }) {
      const s = sessions.get(id);
      if (!s) {
        sessions.set(id, { visits: 1, last: Date.now() });
        return { isNew: true, visits: 1 };
      }
      // A new visit counts after half an hour away.
      if (Date.now() - s.last > 30 * 60_000) s.visits++;
      s.last = Date.now();
      return { isNew: false, visits: s.visits };
    },
    async addEvents() {},
    async addScore({ game, name, score }) {
      scores.push({ game, name, score, at: new Date().toISOString() });
    },
    async topScores(game, lower, limit) {
      return scores
        .filter((s) => s.game === game)
        .sort((a, b) => (lower ? a.score - b.score : b.score - a.score))
        .slice(0, limit)
        .map(({ name, score, at }) => ({ name, score, at }));
    },
    async guestbook(limit) {
      return entries.slice(-limit).reverse();
    },
    async addGuest({ name, message }) {
      const e = { id: nextId++, name, message, at: new Date().toISOString() };
      entries.push(e);
      return e;
    },
    async deleteGuest(id) {
      const i = entries.findIndex((e) => e.id === id);
      if (i >= 0) entries.splice(i, 1);
      return i >= 0;
    },
  };
}

const SCHEMA = `
create table if not exists sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visits int not null default 1,
  country text,
  device text
);
create table if not exists events (
  id bigserial primary key,
  session_id text not null references sessions(id) on delete cascade,
  type text not null,
  data jsonb,
  at timestamptz not null default now()
);
create table if not exists scores (
  id bigserial primary key,
  session_id text not null,
  game text not null,
  name text not null,
  score int not null,
  at timestamptz not null default now()
);
create index if not exists scores_by_game on scores (game, score);
create table if not exists guestbook (
  id bigserial primary key,
  session_id text not null,
  name text not null,
  message text not null,
  at timestamptz not null default now()
);
`;

export async function pgStore(url: string): Promise<Store> {
  const sql = postgres(url, { max: 5, idle_timeout: 30, onnotice: () => {} });
  await sql.unsafe(SCHEMA);
  return {
    async touchSession({ id, country, device }) {
      const [row] = await sql<{ visits: number; inserted: boolean }[]>`
        insert into sessions (id, country, device) values (${id}, ${country}, ${device})
        on conflict (id) do update set
          visits = sessions.visits + case when sessions.last_seen < now() - interval '30 minutes' then 1 else 0 end,
          last_seen = now()
        returning visits, (xmax = 0) as inserted`;
      return { isNew: row.inserted, visits: row.visits };
    },
    async addEvents(sessionId, events) {
      if (!events.length) return;
      const rows = events.map((e) => ({ session_id: sessionId, type: e.type, data: e.data ? sql.json(e.data as postgres.JSONValue) : null }));
      await sql`insert into events ${sql(rows, "session_id", "type", "data")}`;
    },
    async addScore({ sessionId, game, name, score }) {
      await sql`insert into scores (session_id, game, name, score) values (${sessionId}, ${game}, ${name}, ${score})`;
    },
    async topScores(game, lower, limit) {
      const rows = lower
        ? await sql<Score[]>`select name, score, at from scores where game = ${game} order by score asc, at asc limit ${limit}`
        : await sql<Score[]>`select name, score, at from scores where game = ${game} order by score desc, at asc limit ${limit}`;
      return rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() }));
    },
    async guestbook(limit) {
      const rows = await sql<Entry[]>`select id, name, message, at from guestbook order by at desc limit ${limit}`;
      return rows.map((r) => ({ ...r, id: Number(r.id), at: new Date(r.at).toISOString() }));
    },
    async addGuest({ sessionId, name, message }) {
      const [r] = await sql<Entry[]>`insert into guestbook (session_id, name, message) values (${sessionId}, ${name}, ${message}) returning id, name, message, at`;
      return { ...r, id: Number(r.id), at: new Date(r.at).toISOString() };
    },
    async deleteGuest(id) {
      const r = await sql`delete from guestbook where id = ${id}`;
      return r.count > 0;
    },
  };
}
