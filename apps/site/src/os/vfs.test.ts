import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOME, ownerNodes, pathOf, purge, resolve, restoreTarget, uniqueName, type VNode } from "./vfs.ts";

const mine: VNode[] = [
  { id: "a", name: "Stuff", kind: "folder", parent: HOME },
  { id: "b", name: "note.txt", kind: "file", parent: "a" },
];
const all = [...ownerNodes, ...mine];

test("resolve and pathOf agree", () => {
  assert.equal(resolve(all, "/projects/PROJECT-01")?.id, "p-project-01");
  assert.equal(resolve(all, "~/stuff/note.txt")?.id, "b");
  assert.equal(resolve(all, "../..", "a")?.id, "root");
  assert.equal(resolve(all, "nope"), undefined);
  assert.equal(pathOf(all, "b"), "/Home/Stuff/note.txt");
  assert.equal(pathOf(all, "root"), "/");
});

test("trash: restore falls back to Home, purge clears after 30 days", () => {
  const now = Date.now();
  const trashed = all.map((n) => (n.id === "a" ? { ...n, trashedAt: now - 31 * DAY } : n.id === "b" ? { ...n, trashedAt: now } : n));
  const b = trashed.find((n) => n.id === "b")!;
  assert.equal(restoreTarget(trashed, b), HOME);
  assert.equal(resolve(trashed, "~/stuff"), undefined);
  const left = purge(trashed, now);
  assert.ok(!left.some((n) => n.id === "a" || n.id === "b"));
});

test("uniqueName adds a number before the extension", () => {
  assert.equal(uniqueName(all, "a", "note.txt"), "note 2.txt");
  assert.equal(uniqueName(all, "a", "new.txt"), "new.txt");
});
