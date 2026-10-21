import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp, hashSeed } from "./app.ts";
import { memoryStore } from "./store.ts";

function setup() {
  const sent: string[] = [];
  const app = createApp(memoryStore(), { secret: "test-secret", ownerKey: "owner-key", notify: (t) => sent.push(t) });
  const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const session = async () => (await (await json("/session", { device: "desktop", theme: "kova" }, { "cf-ipcountry": "DE" })).json()) as { id: string; token: string };
  return { app, json, session, sent };
}

test("health answers without a database", async () => {
  const { app } = setup();
  assert.deepEqual(await (await app.request("/health")).json(), { ok: true });
});

test("sessions get signed tokens; forged tokens are refused", async () => {
  const { json, session, sent } = setup();
  const s = await session();
  assert.match(s.token, new RegExp(`^${s.id}\\.`));
  assert.equal(sent.length, 1);
  assert.match(sent[0], /New visitor from DE, desktop shell, kova theme/);
  const forged = await json("/scores", { token: `${s.id}.nope`, game: "snake", name: "x", score: 3 });
  assert.equal(forged.status, 401);
  // The same token comes back as the same session, without a second new-visitor message.
  const again = (await (await json("/session", { token: s.token })).json()) as { id: string };
  assert.equal(again.id, s.id);
  assert.equal(sent.length, 1);
});

test("bots and Global Privacy Control are not stored", async () => {
  const { json, sent } = setup();
  await json("/session", {}, { "user-agent": "Googlebot/2.1" });
  assert.equal(sent.length, 0);
  const gpc = (await (await json("/session", {}, { "sec-gpc": "1" })).json()) as { counted: boolean };
  assert.equal(gpc.counted, false);
  assert.match(sent[0], /anonymous/);
});

test("events keep known types only and alert on resume downloads", async () => {
  const { app, session, sent } = setup();
  const s = await session();
  const r = await app.request("/events", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ token: s.token, events: [{ type: "resume-download" }, { type: "rm -rf" }, { type: "visit-end", data: { seconds: 420, apps: ["files", "terminal"] } }] }),
  });
  assert.deepEqual(await r.json(), { ok: true, stored: 2 });
  assert.ok(sent.some((t) => /downloaded your resume/.test(t)));
  assert.ok(sent.some((t) => /7 min, opened files, terminal/.test(t)));
  // A second report of the same visit ending does not send a second summary.
  await app.request("/events", { method: "POST", body: JSON.stringify({ token: s.token, events: [{ type: "visit-end", data: { seconds: 9 } }] }) });
  assert.equal(sent.filter((t) => /Visit summary/.test(t)).length, 1);
});

test("scores are checked and timed games rank the fastest first", async () => {
  const { app, json, session } = setup();
  const s = await session();
  assert.equal((await json("/scores", { token: s.token, game: "snake", name: "Ana", score: 9999 })).status, 400);
  assert.equal((await json("/scores", { token: s.token, game: "tetris", name: "Ana", score: 3 })).status, 400);
  await json("/scores", { token: s.token, game: "mines-easy", name: "Slow", score: 90 });
  await json("/scores", { token: s.token, game: "mines-easy", name: "Fast", score: 12 });
  const board = (await (await app.request("/leaderboards/mines-easy")).json()) as { scores: { name: string }[] };
  assert.deepEqual(board.scores.map((x) => x.name), ["Fast", "Slow"]);
});

test("the guestbook is rate limited and only the owner can delete", async () => {
  const { app, json, session } = setup();
  const s = await session();
  const first = (await (await json("/guestbook", { token: s.token, name: "Visitor", message: "Lovely OS" })).json()) as { entry: { id: number } };
  assert.equal((await json("/guestbook", { token: s.token, name: "Visitor", message: "Again" })).status, 429);
  const del = (path: string, key?: string) => app.request(path, { method: "DELETE", headers: key ? { "x-owner-key": key } : {} });
  assert.equal((await del(`/guestbook/${first.entry.id}`, "wrong-key")).status, 401);
  assert.deepEqual(await (await del(`/guestbook/${first.entry.id}`, "owner-key")).json(), { deleted: true });
});

test("daily seeds match the browser formula", async () => {
  const { app } = setup();
  const d = (await (await app.request("/daily")).json()) as { date: number; seeds: { klondike: number } };
  assert.equal(d.seeds.klondike, hashSeed(`klondike-${d.date}`));
});
