import assert from "node:assert/strict";
import { test } from "node:test";
import { drop, line, pond, shade, step } from "./ripple.ts";

test("a swipe's line becomes a swell that travels up and down, wider than a drop's ring", () => {
  const p = pond(60, 40);
  line(p, 30, 20, 12, 40);
  for (let i = 0; i < 6; i++) step(p);
  const at = (x: number, y: number) => Math.abs(p.cur[y * 60 + x]);
  // the front has moved away from the row, along the whole length of the line
  assert.ok(at(30, 16) > 5 && at(22, 16) > 5 && at(38, 16) > 5);
  // and it stays a line: far past its ends the water is still calm
  assert.ok(at(55, 20) < 0.5);
});

test("a drop spreads out as a ring, then the water goes still", () => {
  const p = pond(40, 40);
  drop(p, 20, 20, 2, 100);
  for (let i = 0; i < 8; i++) step(p);
  // the ring has reached cells well away from where the drop fell
  assert.ok(Math.abs(p.cur[20 * 40 + 27]) > 0.5);
  let max = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 400 && max > 0.4; i++) max = step(p);
  assert.ok(max <= 0.4, `still moving: ${max}`);
});

test("drops stay inside the pond, and shading only lights moving water", () => {
  const p = pond(10, 10);
  drop(p, 0, 0, 3, 50);
  drop(p, 9, 9, 3, 50);
  assert.equal(p.cur[0], 0);
  assert.equal(p.cur[99], 0);
  const px = new Uint8ClampedArray(10 * 10 * 4);
  shade(pond(10, 10), px);
  assert.ok(px.every((v, i) => i % 4 !== 3 || v === 0));
  shade(p, px);
  assert.ok(px.some((v, i) => i % 4 === 3 && v > 0));
});
