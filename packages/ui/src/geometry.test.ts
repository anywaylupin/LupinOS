import assert from "node:assert/strict";
import { test } from "node:test";
import { dockScale, zoneAt, zoneRect } from "./geometry.ts";

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
