import assert from "node:assert/strict";
import { test } from "node:test";
import { chainLayout, clampOffset, dropIndex, neighbour, nextWidth, reveal } from "./wm.ts";

const r = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

test("neighbour moves focus like Hyprland: straight ahead first, nothing past the edge", () => {
  // main on the left, two stacked on the right
  const rects = new Map([
    ["main", r(0, 0, 500, 600)],
    ["top", r(500, 0, 500, 300)],
    ["bottom", r(500, 300, 500, 300)],
  ]);
  assert.equal(neighbour(rects, "main", "right"), "top");
  assert.equal(neighbour(rects, "top", "down"), "bottom");
  assert.equal(neighbour(rects, "bottom", "left"), "main");
  assert.equal(neighbour(rects, "main", "left"), undefined);
  assert.equal(neighbour(rects, "top", "up"), undefined);
});

test("chain lays columns side by side at full height", () => {
  const area = r(0, 26, 1000, 600);
  const { rects, width } = chainLayout([{ id: "a", w: 400 }, { id: "b", w: 5000 }], area, 10);
  assert.deepEqual(rects.get("a"), r(10, 36, 400, 580));
  // a column never grows past the screen
  assert.equal(rects.get("b")?.w, 980);
  assert.equal(rects.get("b")?.x, 420);
  assert.equal(width, 10 + 400 + 10 + 980 + 10);
});

test("reveal scrolls only as far as needed", () => {
  assert.equal(reveal(0, r(100, 0, 300, 10), 1000, 10), 0);
  assert.equal(reveal(0, r(900, 0, 400, 10), 1000, 10), 310);
  assert.equal(reveal(500, r(200, 0, 300, 10), 1000, 10), 190);
  assert.equal(clampOffset(900, 1500, 1000), 500);
  assert.equal(clampOffset(-20, 1500, 1000), 0);
});

test("column widths cycle through a third, a half and two thirds", () => {
  const w3 = nextWidth(200, 1000, 10);
  assert.equal(w3, 327);
  assert.equal(nextWidth(w3, 1000, 10), 490);
  assert.equal(nextWidth(490, 1000, 10), 653);
  assert.equal(nextWidth(653, 1000, 10), 327);
});

test("a dragged column drops before the first column whose centre is past the pointer", () => {
  const rects = new Map([
    ["a", r(0, 0, 100, 10)],
    ["b", r(110, 0, 100, 10)],
    ["c", r(220, 0, 100, 10)],
  ]);
  assert.equal(dropIndex(rects, "a", 300), 2);
  assert.equal(dropIndex(rects, "c", 20), 0);
  assert.equal(dropIndex(rects, "b", 140), 1);
});
