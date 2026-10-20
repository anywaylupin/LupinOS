import assert from "node:assert/strict";
import { test } from "node:test";
import { cellKey, layoutIcons, nearestFree } from "./grid.ts";

test("saved cells stay, new icons fill the first free cells column by column", () => {
  const out = layoutIcons(["a", "b", "c", "d"], { b: { col: 0, row: 0 } }, 3, 2);
  assert.deepEqual(out, { b: { col: 0, row: 0 }, a: { col: 0, row: 1 }, c: { col: 1, row: 0 }, d: { col: 1, row: 1 } });
});

test("cells off a smaller screen and duplicate cells fall back to auto layout", () => {
  const out = layoutIcons(["a", "b"], { a: { col: 5, row: 0 }, b: { col: 0, row: 0 } }, 2, 2);
  assert.deepEqual(out, { b: { col: 0, row: 0 }, a: { col: 0, row: 1 } });
  const dup = layoutIcons(["a", "b"], { a: { col: 1, row: 1 }, b: { col: 1, row: 1 } }, 2, 2);
  assert.deepEqual(dup, { a: { col: 1, row: 1 }, b: { col: 0, row: 0 } });
});

test("nearestFree returns the wanted cell, or the closest empty one", () => {
  const taken = new Set([cellKey({ col: 1, row: 1 })]);
  assert.deepEqual(nearestFree({ col: 0, row: 0 }, taken, 3, 3), { col: 0, row: 0 });
  const near = nearestFree({ col: 1, row: 1 }, taken, 3, 3);
  assert.equal(Math.abs(near.col - 1) + Math.abs(near.row - 1), 1);
  assert.deepEqual(nearestFree({ col: 9, row: -4 }, new Set(), 3, 3), { col: 2, row: 0 });
});
