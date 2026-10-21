import assert from "node:assert/strict";
import { test } from "node:test";
import { dockScale, tileRects, zoneAt, zoneRect } from "./geometry.ts";

const area = { x: 0, y: 24, w: 1000, h: 600 };

test("zoneAt finds edges, corners and the top", () => {
  assert.equal(zoneAt(2, 300, area), "left");
  assert.equal(zoneAt(998, 300, area), "right");
  assert.equal(zoneAt(2, 40, area), "top-left");
  assert.equal(zoneAt(998, 610, area), "bottom-right");
  assert.equal(zoneAt(500, 25, area), "maximize");
  assert.equal(zoneAt(500, 300, area), null);
});

test("zoneRect splits the area without gaps", () => {
  const l = zoneRect("left", area);
  const r = zoneRect("right", area);
  assert.equal(l.w + r.w, area.w);
  assert.equal(r.x, l.x + l.w);
  const tl = zoneRect("top-left", area);
  const bl = zoneRect("bottom-left", area);
  assert.equal(tl.h + bl.h, area.h);
  assert.deepEqual(zoneRect("maximize", area), area);
});

test("dockScale peaks under the pointer and fades to 1", () => {
  assert.equal(dockScale(0, 120, 1.8), 1.8);
  assert.equal(dockScale(120, 120, 1.8), 1);
  assert.equal(dockScale(-300, 120, 1.8), 1);
  const mid = dockScale(60, 120, 1.8);
  assert.ok(mid > 1 && mid < 1.8);
});

test("gaps keep neighbouring cells apart by exactly the gap", () => {
  const l = zoneRect("left", area, 10);
  const r = zoneRect("right", area, 10);
  assert.equal(l.x, area.x + 10);
  assert.equal(r.x - (l.x + l.w), 10);
  assert.equal(area.x + area.w - (r.x + r.w), 10);
  assert.deepEqual(zoneRect("maximize", area, 10), area);
});

test("tileRects halves the space for each new window", () => {
  assert.deepEqual(tileRects(1, area), [area]);
  const [a, b, c] = tileRects(3, area);
  assert.equal(a.w, 500);
  assert.equal(a.h, 600);
  assert.equal(b.x, 500);
  assert.equal(b.h + c.h, 600);
  assert.equal(tileRects(0, area).length, 0);
});

test("the first tiled split follows the ratio", () => {
  const [main, side] = tileRects(2, area, 0, 0.6);
  assert.equal(main.w, 600);
  assert.equal(side.x, 600);
  assert.equal(side.w, 400);
});
