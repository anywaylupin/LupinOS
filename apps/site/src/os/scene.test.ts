import assert from "node:assert/strict";
import { test } from "node:test";
import { BLEED, FRAME, frameFit, HORIZON, SCENES } from "./scene.ts";

test("the frame covers any screen, its horizon where the ripples start", () => {
  for (const [w, h] of [[1920, 1080], [1440, 900], [2560, 1080], [1080, 1920], [800, 600]]) {
    const { s, ox, oy } = frameFit(w, h);
    assert.ok(ox <= 0 && ox + FRAME.w * s >= w - 0.01, `${w}×${h} sides`);
    assert.ok(oy - BLEED * s <= 0, `${w}×${h} top`);
    assert.ok(oy + (FRAME.h + BLEED) * s >= h, `${w}×${h} bottom`);
    assert.ok(Math.abs(oy + FRAME.y * s - HORIZON * h) < 0.01, `${w}×${h} horizon`);
  }
});

test("every sun sits on the horizon inside the frame, and decorations stay on their side of it", () => {
  for (const [id, { sun, decos }] of Object.entries(SCENES)) {
    assert.ok(sun.x - sun.d / 2 > 0 && sun.x + sun.d / 2 < FRAME.w, `${id} in frame`);
    // its centre above the line, but never risen clear of it
    assert.ok(sun.lift >= 0 && sun.lift < 0.5, `${id} on the horizon`);
    // a decoration may run past its edge (Olvi's ridges stand with their feet below the line), never start past it
    for (const d of decos) assert.ok(d.y >= 0 && d.y < (d.layer === "water" ? FRAME.h - FRAME.y : FRAME.y), `${id} decoration`);
  }
});
